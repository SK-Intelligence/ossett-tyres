"""Validation for exact tyre identification and safe quantities."""

import re
from decimal import Decimal

from .errors import ValidationError

IDEMPOTENCY_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$")


def validate_product(product, exact_sku_required=True):
    if not isinstance(product.width, int) or not 95 <= product.width <= 455:
        raise ValidationError("Invalid tyre width")
    if not isinstance(product.profile, int) or not 20 <= product.profile <= 100:
        raise ValidationError("Invalid tyre profile")
    try:
        rim = Decimal(product.rim_diameter)
    except Exception as error:
        raise ValidationError("Invalid rim diameter") from error
    if not Decimal("10") <= rim <= Decimal("30"):
        raise ValidationError("Invalid rim diameter")
    for label, value in {
        "load index": product.load_index,
        "speed rating": product.speed_rating,
        "brand": product.brand,
        "model": product.model,
    }.items():
        if not isinstance(value, str) or not value.strip() or len(value.strip()) > 80:
            raise ValidationError(f"Invalid {label}")
    if exact_sku_required and not product.supplier_sku.strip():
        raise ValidationError("An exact supplier SKU is required")
    return product


def validate_quantity(quantity):
    if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity <= 0:
        raise ValidationError("Quantity must be a positive whole number")
    if quantity > 100:
        raise ValidationError("Quantity exceeds the application safety limit")
    return quantity


def validate_idempotency_key(value):
    if not isinstance(value, str) or not IDEMPOTENCY_PATTERN.fullmatch(value):
        raise ValidationError("A valid idempotency key is required")
    return value
