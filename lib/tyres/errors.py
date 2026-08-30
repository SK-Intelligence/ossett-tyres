"""Explicit, non-sensitive errors raised at tyre-domain boundaries."""


class TyreDomainError(Exception):
    """Base error for deterministic tyre-domain failures."""


class ValidationError(TyreDomainError):
    """Input is incomplete or unsafe to process."""


class InventoryUnavailable(TyreDomainError):
    """The production inventory source is not available."""


class SupplierNotConfigured(TyreDomainError):
    """No documented production supplier integration is configured."""


class SupplierUnavailable(TyreDomainError):
    """The supplier cannot fulfil the requested product or quantity."""


class SupplierTimeout(TyreDomainError):
    """The supplier outcome is unknown after a timeout."""


class SupplierAmbiguousResponse(TyreDomainError):
    """The supplier response cannot be safely interpreted."""


class SafetyRuleViolation(TyreDomainError):
    """A procurement safety policy rejected the proposed order."""


class DuplicateRequest(TyreDomainError):
    """The idempotency key has already been processed."""


class PersistenceNotConfigured(TyreDomainError):
    """Durable production order persistence is not configured."""
