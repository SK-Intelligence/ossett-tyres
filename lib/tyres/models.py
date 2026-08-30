"""Tyre, stock, quote, order, state, and audit models."""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Any, Mapping, Optional


def utc_now():
    return datetime.now(timezone.utc)


class OrderStatus(str, Enum):
    REQUEST_RECEIVED = "REQUEST_RECEIVED"
    PRODUCT_IDENTIFIED = "PRODUCT_IDENTIFIED"
    STOCK_CHECKED = "STOCK_CHECKED"
    LOCAL_STOCK_AVAILABLE = "LOCAL_STOCK_AVAILABLE"
    WHOLESALE_REQUIRED = "WHOLESALE_REQUIRED"
    AWAITING_PROCUREMENT_APPROVAL = "AWAITING_PROCUREMENT_APPROVAL"
    AWAITING_MANUAL_REVIEW = "AWAITING_MANUAL_REVIEW"
    AWAITING_SUPPLIER_RECONCILIATION = "AWAITING_SUPPLIER_RECONCILIATION"
    WHOLESALE_ORDER_SUBMITTED = "WHOLESALE_ORDER_SUBMITTED"
    WHOLESALE_CONFIRMED = "WHOLESALE_CONFIRMED"
    AWAITING_DELIVERY = "AWAITING_DELIVERY"
    READY_FOR_FITTING = "READY_FOR_FITTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


CUSTOMER_STATUS = {
    OrderStatus.REQUEST_RECEIVED: "Order received",
    OrderStatus.PRODUCT_IDENTIFIED: "Order received",
    OrderStatus.STOCK_CHECKED: "Preparing your order",
    OrderStatus.LOCAL_STOCK_AVAILABLE: "Tyres confirmed",
    OrderStatus.WHOLESALE_REQUIRED: "Preparing your order",
    OrderStatus.AWAITING_PROCUREMENT_APPROVAL: "Preparing your order",
    OrderStatus.AWAITING_MANUAL_REVIEW: "Order received",
    OrderStatus.AWAITING_SUPPLIER_RECONCILIATION: "Preparing your order",
    OrderStatus.WHOLESALE_ORDER_SUBMITTED: "Preparing your order",
    OrderStatus.WHOLESALE_CONFIRMED: "Tyres confirmed",
    OrderStatus.AWAITING_DELIVERY: "Preparing your order",
    OrderStatus.READY_FOR_FITTING: "Ready for fitting",
    OrderStatus.COMPLETED: "Fitting completed",
    OrderStatus.FAILED: "Please contact the workshop",
    OrderStatus.CANCELLED: "Order cancelled",
}


@dataclass(frozen=True)
class TyreProduct:
    width: int
    profile: int
    rim_diameter: Decimal
    load_index: str
    speed_rating: str
    brand: str
    model: str
    supplier_sku: str = ""

    @property
    def exact_key(self):
        return (
            self.supplier_sku.strip(),
            self.width,
            self.profile,
            str(self.rim_diameter),
            self.load_index.strip().upper(),
            self.speed_rating.strip().upper(),
            self.brand.strip().casefold(),
            self.model.strip().casefold(),
        )


@dataclass(frozen=True)
class TyreRequest:
    product: TyreProduct
    quantity: int
    customer_reference: str
    idempotency_key: str
    vehicle_registration: str = ""
    fitting_date: Optional[str] = None
    customer_price: Optional[Decimal] = None


@dataclass(frozen=True)
class InventoryItem:
    product: TyreProduct
    available_quantity: int


@dataclass(frozen=True)
class StockCheck:
    product: TyreProduct
    requested_quantity: int
    available_local_stock: int
    quantity_to_order: int
    checked_at: datetime = field(default_factory=utc_now)


@dataclass(frozen=True)
class ProcurementRequest:
    internal_order_id: str
    product: TyreProduct
    quantity: int
    idempotency_key: str


@dataclass(frozen=True)
class SupplierQuote:
    supplier: str
    supplier_sku: str
    quoted_quantity: int
    available_quantity: int
    unit_price: Decimal
    currency: str = "GBP"
    quote_reference: str = ""

    @property
    def total_price(self):
        return self.unit_price * self.quoted_quantity


@dataclass(frozen=True)
class SupplierOrder:
    supplier: str
    supplier_reference: str
    supplier_sku: str
    quantity: int
    total_cost: Decimal
    status: str


@dataclass(frozen=True)
class AuditEvent:
    event_type: str
    order_id: str
    timestamp: datetime = field(default_factory=utc_now)
    details: Mapping[str, Any] = field(default_factory=dict)


@dataclass
class CustomerTyreOrder:
    order_id: str
    request: TyreRequest
    status: OrderStatus = OrderStatus.REQUEST_RECEIVED
    local_stock_quantity: Optional[int] = None
    wholesale_quantity: int = 0
    supplier: str = ""
    supplier_reference: str = ""
    wholesale_cost: Optional[Decimal] = None
    error_code: str = ""
    created_at: datetime = field(default_factory=utc_now)
    updated_at: datetime = field(default_factory=utc_now)
    audit_history: list[AuditEvent] = field(default_factory=list)

    @property
    def customer_status(self):
        return CUSTOMER_STATUS[self.status]

    def transition(self, status, error_code=""):
        self.status = status
        self.error_code = error_code
        self.updated_at = utc_now()
