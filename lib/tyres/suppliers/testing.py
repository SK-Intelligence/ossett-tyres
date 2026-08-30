"""Explicitly test-only supplier adapter with no network behavior."""

from .base import TyreSupplier


class MockTyreSupplier(TyreSupplier):
    test_only = True

    def __init__(
        self,
        *,
        availability=0,
        quote=None,
        order=None,
        availability_error=None,
        quote_error=None,
        order_error=None,
    ):
        self.availability = availability
        self.quote = quote
        self.order = order
        self.availability_error = availability_error
        self.quote_error = quote_error
        self.order_error = order_error
        self.calls = []

    def search_products(self, product):
        self.calls.append(("search_products", product.supplier_sku))
        return [product]

    def get_availability(self, product, quantity):
        self.calls.append(("get_availability", product.supplier_sku, quantity))
        if self.availability_error:
            raise self.availability_error
        return self.availability

    def get_quote(self, product, quantity):
        self.calls.append(("get_quote", product.supplier_sku, quantity))
        if self.quote_error:
            raise self.quote_error
        return self.quote

    def create_order(self, procurement_request, quote):
        self.calls.append(
            ("create_order", procurement_request.idempotency_key, quote.quote_reference)
        )
        if self.order_error:
            raise self.order_error
        return self.order

    def get_order_status(self, supplier_reference):
        self.calls.append(("get_order_status", supplier_reference))
        return self.order.status if self.order else "unknown"
