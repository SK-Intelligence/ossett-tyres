from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
import unittest

from lib.tyres.config import ProcurementConfig
from lib.tyres.errors import (
    DuplicateRequest,
    SupplierAmbiguousResponse,
    SupplierNotConfigured,
    SupplierTimeout,
    ValidationError,
)
from lib.tyres.inventory import MockInventoryService, UnconfiguredInventoryService
from lib.tyres.models import (
    OrderStatus,
    SupplierOrder,
    SupplierQuote,
    TyreProduct,
    TyreRequest,
)
from lib.tyres.pricing import ProcurementRules
from lib.tyres.procurement import ProcurementService, calculate_shortfall
from lib.tyres.repositories import InMemoryOrderRepository
from lib.tyres.suppliers.testing import MockTyreSupplier
from lib.tyres.suppliers.tyrescope import TyreScopeSupplier


def product(sku="SUP-205-55-R16"):
    return TyreProduct(
        width=205,
        profile=55,
        rim_diameter=Decimal("16"),
        load_index="91",
        speed_rating="V",
        brand="Example",
        model="Road",
        supplier_sku=sku,
    )


def request(quantity=4, sku="SUP-205-55-R16", key="request:12345678"):
    return TyreRequest(
        product=product(sku),
        quantity=quantity,
        customer_reference="customer-order-1",
        idempotency_key=key,
        vehicle_registration="AB12CDE",
    )


def config(auto=False, max_unit="100", max_total="1000", max_quantity=20, supplier="tyrescope"):
    return ProcurementConfig(
        automatic_procurement_enabled=auto,
        rules=ProcurementRules(
            maximum_automatic_order_value=Decimal(max_total),
            maximum_automatic_quantity=max_quantity,
            maximum_allowed_unit_price=Decimal(max_unit),
            allowed_supplier=supplier,
            exact_sku_required=True,
        ),
    )


def quote(
    sku="SUP-205-55-R16",
    quantity=4,
    unit="50",
    supplier="tyrescope",
    currency="GBP",
):
    return SupplierQuote(
        supplier=supplier,
        supplier_sku=sku,
        quoted_quantity=quantity,
        available_quantity=quantity,
        unit_price=Decimal(unit),
        currency=currency,
        quote_reference="quote-test-only",
    )


def supplier_order(quantity=4, supplier="tyrescope", total="200"):
    return SupplierOrder(
        supplier=supplier,
        supplier_reference="supplier-order-test-only",
        supplier_sku="SUP-205-55-R16",
        quantity=quantity,
        total_cost=Decimal(total),
        status="submitted",
    )


class ShortfallTests(unittest.TestCase):
    def test_stock_equals_request(self):
        self.assertEqual(calculate_shortfall(4, 4), 0)

    def test_partial_stock(self):
        self.assertEqual(calculate_shortfall(8, 3), 5)

    def test_zero_stock(self):
        self.assertEqual(calculate_shortfall(4, 0), 4)

    def test_surplus_stock(self):
        self.assertEqual(calculate_shortfall(2, 10), 0)


class ProcurementTests(unittest.TestCase):
    def service(self, *, stock=0, supplier=None, settings=None, inventory=None):
        selected_inventory = inventory or MockInventoryService({product().exact_key: stock})
        selected_supplier = supplier or MockTyreSupplier(
            availability=20,
            quote=quote(quantity=20),
            order=supplier_order(),
        )
        return ProcurementService(
            selected_inventory,
            selected_supplier,
            InMemoryOrderRepository(),
            settings or config(),
        )

    def test_invalid_quantity(self):
        with self.assertRaises(ValidationError):
            self.service().process(request(quantity=0))

    def test_invalid_exact_product(self):
        with self.assertRaises(ValidationError):
            self.service().process(request(sku=""))

    def test_local_stock_prevents_supplier_call(self):
        supplier = MockTyreSupplier()
        order = self.service(stock=4, supplier=supplier).process(request(quantity=4))
        self.assertEqual(order.status, OrderStatus.LOCAL_STOCK_AVAILABLE)
        self.assertEqual(order.wholesale_quantity, 0)
        self.assertEqual(supplier.calls, [])

    def test_inventory_unavailable_never_falls_back_to_mock_stock(self):
        supplier = MockTyreSupplier()
        order = self.service(
            supplier=supplier,
            inventory=UnconfiguredInventoryService(),
        ).process(request())
        self.assertEqual(order.status, OrderStatus.AWAITING_MANUAL_REVIEW)
        self.assertEqual(order.error_code, "inventory_unavailable")
        self.assertEqual(supplier.calls, [])

    def test_supplier_out_of_stock(self):
        supplier = MockTyreSupplier(availability=2)
        order = self.service(supplier=supplier).process(request(quantity=4))
        self.assertEqual(order.status, OrderStatus.AWAITING_MANUAL_REVIEW)
        self.assertEqual(order.error_code, "supplier_unavailable")
        self.assertFalse(any(call[0] == "create_order" for call in supplier.calls))

    def test_supplier_returns_wrong_sku(self):
        supplier = MockTyreSupplier(availability=4, quote=quote(sku="WRONG", quantity=4))
        order = self.service(supplier=supplier).process(request())
        self.assertEqual(order.status, OrderStatus.AWAITING_MANUAL_REVIEW)
        self.assertEqual(order.error_code, "safety_rule_violation")

    def test_supplier_price_exceeds_limit(self):
        supplier = MockTyreSupplier(availability=4, quote=quote(quantity=4, unit="101"))
        order = self.service(supplier=supplier).process(request())
        self.assertEqual(order.status, OrderStatus.AWAITING_MANUAL_REVIEW)
        self.assertEqual(order.error_code, "safety_rule_violation")

    def test_supplier_quote_wrong_currency_is_rejected(self):
        supplier = MockTyreSupplier(
            availability=4,
            quote=quote(quantity=4, currency="USD"),
        )
        order = self.service(supplier=supplier).process(request())
        self.assertEqual(order.status, OrderStatus.AWAITING_MANUAL_REVIEW)
        self.assertEqual(order.error_code, "safety_rule_violation")

    def test_automatic_procurement_disabled_requests_approval(self):
        supplier = MockTyreSupplier(availability=4, quote=quote(quantity=4))
        order = self.service(supplier=supplier).process(request())
        self.assertEqual(order.status, OrderStatus.AWAITING_PROCUREMENT_APPROVAL)
        self.assertFalse(any(call[0] == "create_order" for call in supplier.calls))

    def test_duplicate_request_is_blocked_before_second_supplier_order(self):
        supplier = MockTyreSupplier(
            availability=4,
            quote=quote(quantity=4),
            order=supplier_order(),
        )
        repository = InMemoryOrderRepository()
        service = ProcurementService(
            MockInventoryService({product().exact_key: 0}),
            supplier,
            repository,
            config(auto=True),
        )
        service.process(request())
        with self.assertRaises(DuplicateRequest):
            service.process(request())
        self.assertEqual(sum(call[0] == "create_order" for call in supplier.calls), 1)

    def test_concurrent_duplicate_requests_claim_idempotency_once(self):
        supplier = MockTyreSupplier(
            availability=4,
            quote=quote(quantity=4),
            order=supplier_order(),
        )
        service = ProcurementService(
            MockInventoryService({product().exact_key: 0}),
            supplier,
            InMemoryOrderRepository(),
            config(auto=True),
        )

        def attempt(_index):
            try:
                service.process(request())
                return "processed"
            except DuplicateRequest:
                return "duplicate"

        with ThreadPoolExecutor(max_workers=8) as executor:
            outcomes = list(executor.map(attempt, range(8)))
        self.assertEqual(outcomes.count("processed"), 1)
        self.assertEqual(outcomes.count("duplicate"), 7)
        self.assertEqual(sum(call[0] == "create_order" for call in supplier.calls), 1)

    def test_supplier_timeout_requires_reconciliation_without_purchase_retry(self):
        supplier = MockTyreSupplier(availability_error=SupplierTimeout("timeout"))
        order = self.service(supplier=supplier).process(request())
        self.assertEqual(order.status, OrderStatus.AWAITING_SUPPLIER_RECONCILIATION)
        self.assertFalse(any(call[0] == "create_order" for call in supplier.calls))

    def test_supplier_ambiguous_order_response_requires_reconciliation(self):
        supplier = MockTyreSupplier(
            availability=4,
            quote=quote(quantity=4),
            order_error=SupplierAmbiguousResponse("ambiguous"),
        )
        order = self.service(supplier=supplier, settings=config(auto=True)).process(request())
        self.assertEqual(order.status, OrderStatus.AWAITING_SUPPLIER_RECONCILIATION)
        self.assertEqual(sum(call[0] == "create_order" for call in supplier.calls), 1)

    def test_supplier_malformed_quote_requires_reconciliation(self):
        supplier = MockTyreSupplier(availability=4, quote=None)
        order = self.service(supplier=supplier).process(request())
        self.assertEqual(order.status, OrderStatus.AWAITING_SUPPLIER_RECONCILIATION)
        self.assertFalse(any(call[0] == "create_order" for call in supplier.calls))

    def test_supplier_order_wrong_supplier_requires_reconciliation(self):
        supplier = MockTyreSupplier(
            availability=4,
            quote=quote(quantity=4),
            order=supplier_order(supplier="different-supplier"),
        )
        order = self.service(supplier=supplier, settings=config(auto=True)).process(request())
        self.assertEqual(order.status, OrderStatus.AWAITING_SUPPLIER_RECONCILIATION)

    def test_supplier_order_wrong_cost_requires_reconciliation(self):
        supplier = MockTyreSupplier(
            availability=4,
            quote=quote(quantity=4),
            order=supplier_order(total="9999"),
        )
        order = self.service(supplier=supplier, settings=config(auto=True)).process(request())
        self.assertEqual(order.status, OrderStatus.AWAITING_SUPPLIER_RECONCILIATION)

    def test_successful_test_order_records_reference_and_audit(self):
        supplier = MockTyreSupplier(
            availability=4,
            quote=quote(quantity=4),
            order=supplier_order(),
        )
        order = self.service(supplier=supplier, settings=config(auto=True)).process(request())
        self.assertEqual(order.status, OrderStatus.WHOLESALE_ORDER_SUBMITTED)
        self.assertEqual(order.supplier_reference, "supplier-order-test-only")
        self.assertIn("supplier_order_submitted", [event.event_type for event in order.audit_history])

    def test_unconfigured_production_supplier_is_explicit(self):
        with self.assertRaisesRegex(SupplierNotConfigured, "Supplier API not configured"):
            TyreScopeSupplier().get_quote(product(), 4)


if __name__ == "__main__":
    unittest.main()
