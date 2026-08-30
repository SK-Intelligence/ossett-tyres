"""TyreScope/Bond boundary awaiting an official partner API contract."""

from .base import TyreSupplier
from ..errors import SupplierNotConfigured


class TyreScopeSupplier(TyreSupplier):
    """Production-safe placeholder containing no undocumented HTTP requests."""

    name = "tyrescope"

    @staticmethod
    def _not_configured():
        raise SupplierNotConfigured("Supplier API not configured")

    def search_products(self, product):
        del product
        self._not_configured()

    def get_availability(self, product, quantity):
        del product, quantity
        self._not_configured()

    def get_quote(self, product, quantity):
        del product, quantity
        self._not_configured()

    def create_order(self, procurement_request, quote):
        del procurement_request, quote
        self._not_configured()

    def get_order_status(self, supplier_reference):
        del supplier_reference
        self._not_configured()
