"""Abstract supplier boundary. No transport assumptions live here."""

from abc import ABC, abstractmethod


class TyreSupplier(ABC):
    @abstractmethod
    def search_products(self, product):
        raise NotImplementedError

    @abstractmethod
    def get_availability(self, product, quantity):
        raise NotImplementedError

    @abstractmethod
    def get_quote(self, product, quantity):
        raise NotImplementedError

    @abstractmethod
    def create_order(self, procurement_request, quote):
        raise NotImplementedError

    @abstractmethod
    def get_order_status(self, supplier_reference):
        raise NotImplementedError
