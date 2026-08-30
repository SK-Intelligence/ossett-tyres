"""Local inventory boundary with explicit production and test adapters."""

from abc import ABC, abstractmethod

from .errors import InventoryUnavailable


class InventoryService(ABC):
    @abstractmethod
    def get_available_quantity(self, product):
        """Return verified local stock for the exact product."""


class UnconfiguredInventoryService(InventoryService):
    def get_available_quantity(self, product):
        del product
        raise InventoryUnavailable("Local inventory integration is not configured")


class MockInventoryService(InventoryService):
    """Explicitly test-only inventory. Never select this from production config."""

    test_only = True

    def __init__(self, quantities=None, error=None):
        self.quantities = dict(quantities or {})
        self.error = error
        self.calls = []

    def get_available_quantity(self, product):
        self.calls.append(product.exact_key)
        if self.error:
            raise self.error
        return self.quantities.get(product.exact_key, 0)
