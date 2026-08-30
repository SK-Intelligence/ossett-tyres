"""Deterministic local-stock and supplier-procurement orchestration."""

import hashlib
import uuid

from .audit import AuditRecorder
from .errors import (
    DuplicateRequest,
    InventoryUnavailable,
    SafetyRuleViolation,
    SupplierAmbiguousResponse,
    SupplierNotConfigured,
    SupplierTimeout,
    SupplierUnavailable,
)
from .models import (
    CustomerTyreOrder,
    OrderStatus,
    ProcurementRequest,
    SupplierOrder,
    SupplierQuote,
)
from .validation import validate_idempotency_key, validate_product, validate_quantity


def calculate_shortfall(requested_quantity, available_local_stock):
    validate_quantity(requested_quantity)
    if isinstance(available_local_stock, bool) or not isinstance(available_local_stock, int):
        raise ValueError("Local stock must be a non-negative whole number")
    if available_local_stock < 0:
        raise ValueError("Local stock must be a non-negative whole number")
    return max(requested_quantity - available_local_stock, 0)


def generate_idempotency_key(customer_reference, product, quantity):
    source = "|".join(
        [str(customer_reference).strip(), repr(product.exact_key), str(quantity)]
    ).encode("utf-8")
    return "tyre:" + hashlib.sha256(source).hexdigest()


class ProcurementService:
    def __init__(self, inventory, supplier, repository, config, audit=None):
        self.inventory = inventory
        self.supplier = supplier
        self.repository = repository
        self.config = config
        self.audit = audit or AuditRecorder()

    def _save(self, order):
        self.repository.save(order)
        return order

    def _manual_review(self, order, error_code, event_type):
        order.transition(OrderStatus.AWAITING_MANUAL_REVIEW, error_code)
        self.audit.record(order, event_type, error_code=error_code)
        return self._save(order)

    def process(self, request):
        validate_product(request.product, self.config.rules.exact_sku_required)
        validate_quantity(request.quantity)
        validate_idempotency_key(request.idempotency_key)

        order = CustomerTyreOrder(order_id=uuid.uuid4().hex, request=request)
        existing = self.repository.claim(order)
        if existing is not None:
            self.audit.record(existing, "duplicate_request_blocked")
            self.repository.save(existing)
            raise DuplicateRequest("This procurement request has already been processed")

        self.audit.record(order, "customer_request_created")
        order.transition(OrderStatus.PRODUCT_IDENTIFIED)
        self.audit.record(order, "product_selected", supplier_sku=request.product.supplier_sku)
        self._save(order)

        try:
            local_stock = self.inventory.get_available_quantity(request.product)
            shortfall = calculate_shortfall(request.quantity, local_stock)
        except (InventoryUnavailable, ValueError):
            return self._manual_review(
                order,
                "inventory_unavailable",
                "local_inventory_unavailable",
            )

        order.local_stock_quantity = local_stock
        order.wholesale_quantity = shortfall
        order.transition(OrderStatus.STOCK_CHECKED)
        self.audit.record(order, "local_stock_checked", available_quantity=local_stock)
        self.audit.record(order, "shortfall_calculated", quantity_to_order=shortfall)

        if shortfall == 0:
            order.transition(OrderStatus.LOCAL_STOCK_AVAILABLE)
            self.audit.record(order, "local_stock_available")
            return self._save(order)

        order.transition(OrderStatus.WHOLESALE_REQUIRED)
        self.audit.record(order, "wholesale_required", quantity=shortfall)

        try:
            availability = self.supplier.get_availability(request.product, shortfall)
            if (
                isinstance(availability, bool)
                or not isinstance(availability, int)
                or availability < 0
            ):
                raise SupplierAmbiguousResponse("Supplier availability is ambiguous")
            if availability < shortfall:
                raise SupplierUnavailable("Supplier quantity is unavailable")
            self.audit.record(order, "supplier_searched", available_quantity=availability)
            quote = self.supplier.get_quote(request.product, shortfall)
            if not isinstance(quote, SupplierQuote):
                raise SupplierAmbiguousResponse("Supplier quote is ambiguous")
            self.audit.record(
                order,
                "supplier_product_selected",
                supplier=quote.supplier,
                supplier_sku=quote.supplier_sku,
            )
            self.config.rules.validate_quote(request.product, shortfall, quote)
            self.audit.record(order, "price_validated", currency=quote.currency)
        except SupplierNotConfigured:
            return self._manual_review(
                order,
                "supplier_api_not_configured",
                "supplier_not_configured",
            )
        except SupplierUnavailable:
            return self._manual_review(order, "supplier_unavailable", "supplier_unavailable")
        except SafetyRuleViolation as error:
            return self._manual_review(order, "safety_rule_violation", "price_or_product_rejected")
        except (SupplierTimeout, SupplierAmbiguousResponse) as error:
            order.transition(OrderStatus.AWAITING_SUPPLIER_RECONCILIATION, error.__class__.__name__)
            self.audit.record(order, "supplier_outcome_requires_reconciliation")
            return self._save(order)

        order.supplier = quote.supplier
        order.wholesale_cost = quote.unit_price * shortfall
        if not self.config.automatic_procurement_enabled:
            order.transition(OrderStatus.AWAITING_PROCUREMENT_APPROVAL)
            self.audit.record(order, "procurement_approval_requested")
            return self._save(order)

        procurement_request = ProcurementRequest(
            internal_order_id=order.order_id,
            product=request.product,
            quantity=shortfall,
            idempotency_key=request.idempotency_key,
        )
        try:
            supplier_order = self.supplier.create_order(procurement_request, quote)
            if (
                not isinstance(supplier_order, SupplierOrder)
                or not supplier_order.supplier_reference.strip()
                or supplier_order.supplier.casefold() != quote.supplier.casefold()
                or supplier_order.supplier_sku != request.product.supplier_sku
                or supplier_order.quantity != shortfall
                or supplier_order.total_cost != quote.unit_price * shortfall
            ):
                raise SupplierAmbiguousResponse("Supplier order response is ambiguous")
        except (SupplierTimeout, SupplierAmbiguousResponse) as error:
            order.transition(OrderStatus.AWAITING_SUPPLIER_RECONCILIATION, error.__class__.__name__)
            self.audit.record(order, "supplier_outcome_requires_reconciliation")
            return self._save(order)
        except SupplierUnavailable:
            return self._manual_review(order, "supplier_order_failed", "supplier_order_failed")

        order.supplier_reference = supplier_order.supplier_reference
        order.transition(OrderStatus.WHOLESALE_ORDER_SUBMITTED)
        self.audit.record(
            order,
            "supplier_order_submitted",
            supplier=quote.supplier,
            supplier_reference=supplier_order.supplier_reference,
        )
        return self._save(order)
