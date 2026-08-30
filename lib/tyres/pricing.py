"""Configurable deterministic procurement safety policy."""

from dataclasses import dataclass
from decimal import Decimal

from .errors import SafetyRuleViolation


@dataclass(frozen=True)
class ProcurementRules:
    maximum_automatic_order_value: Decimal
    maximum_automatic_quantity: int
    maximum_allowed_unit_price: Decimal
    allowed_supplier: str
    expected_currency: str = "GBP"
    exact_sku_required: bool = True

    def validate_quote(self, product, quantity, quote):
        if quote.currency.strip().upper() != self.expected_currency.strip().upper():
            raise SafetyRuleViolation("Supplier quote currency is not allowed")
        if self.exact_sku_required and quote.supplier_sku != product.supplier_sku:
            raise SafetyRuleViolation("Supplier returned the wrong SKU")
        if quote.available_quantity < quantity:
            raise SafetyRuleViolation("Supplier quantity is unavailable")
        if quote.quoted_quantity != quantity:
            raise SafetyRuleViolation("Supplier quote quantity does not match the request")
        if quote.unit_price <= 0 or quote.unit_price > self.maximum_allowed_unit_price:
            raise SafetyRuleViolation("Supplier unit price exceeds the configured limit")
        if quantity > self.maximum_automatic_quantity:
            raise SafetyRuleViolation("Quantity exceeds the configured automatic limit")
        if quote.unit_price * quantity > self.maximum_automatic_order_value:
            raise SafetyRuleViolation("Order value exceeds the configured automatic limit")
        if quote.supplier.casefold() != self.allowed_supplier.casefold():
            raise SafetyRuleViolation("Supplier is not allowed")
        return quote
