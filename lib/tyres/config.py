"""Environment-backed procurement feature flags and safety rules."""

import os
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation

from .pricing import ProcurementRules


def _boolean(name, default=False):
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().casefold() in {"1", "true", "yes", "on"}


def _decimal(name, default="0"):
    try:
        value = Decimal(os.environ.get(name, default).strip())
    except (InvalidOperation, AttributeError):
        return Decimal(default)
    return max(value, Decimal("0"))


def _integer(name, default=0):
    try:
        value = int(os.environ.get(name, str(default)).strip())
    except (TypeError, ValueError):
        return default
    return max(value, 0)


@dataclass(frozen=True)
class ProcurementConfig:
    automatic_procurement_enabled: bool
    rules: ProcurementRules

    @classmethod
    def from_environment(cls):
        return cls(
            automatic_procurement_enabled=_boolean("PROCUREMENT_AUTO_ENABLED", False),
            rules=ProcurementRules(
                maximum_automatic_order_value=_decimal("PROCUREMENT_MAX_ORDER_VALUE_GBP"),
                maximum_automatic_quantity=_integer("PROCUREMENT_MAX_QUANTITY"),
                maximum_allowed_unit_price=_decimal("PROCUREMENT_MAX_UNIT_PRICE_GBP"),
                allowed_supplier=os.environ.get("PROCUREMENT_ALLOWED_SUPPLIER", "").strip(),
                expected_currency=os.environ.get("PROCUREMENT_CURRENCY", "GBP").strip()
                or "GBP",
                exact_sku_required=_boolean("PROCUREMENT_EXACT_SKU_REQUIRED", True),
            ),
        )
