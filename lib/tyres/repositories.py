"""Order persistence boundaries. Production has no silent in-memory fallback."""

from abc import ABC, abstractmethod
import threading

from .errors import PersistenceNotConfigured


class OrderRepository(ABC):
    @abstractmethod
    def claim(self, order):
        """Atomically reserve an idempotency key, returning an existing order."""
        raise NotImplementedError

    @abstractmethod
    def get_by_idempotency_key(self, idempotency_key):
        raise NotImplementedError

    @abstractmethod
    def save(self, order):
        raise NotImplementedError


class UnconfiguredOrderRepository(OrderRepository):
    def claim(self, order):
        del order
        raise PersistenceNotConfigured("Production order persistence is not configured")

    def get_by_idempotency_key(self, idempotency_key):
        del idempotency_key
        raise PersistenceNotConfigured("Production order persistence is not configured")

    def save(self, order):
        del order
        raise PersistenceNotConfigured("Production order persistence is not configured")


class InMemoryOrderRepository(OrderRepository):
    """Test/development repository; data is lost when the process stops."""

    test_only = True

    def __init__(self):
        self._orders = {}
        self._lock = threading.Lock()

    def claim(self, order):
        with self._lock:
            existing = self._orders.get(order.request.idempotency_key)
            if existing is not None:
                return existing
            self._orders[order.request.idempotency_key] = order
            return None

    def get_by_idempotency_key(self, idempotency_key):
        return self._orders.get(idempotency_key)

    def save(self, order):
        with self._lock:
            self._orders[order.request.idempotency_key] = order
        return order
