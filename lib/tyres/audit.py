"""Audit event creation and non-sensitive diagnostic logging."""

import logging

from .models import AuditEvent


class AuditRecorder:
    def __init__(self, logger=None):
        self.logger = logger or logging.getLogger("ossett.procurement")

    def record(self, order, event_type, **details):
        safe_details = {
            key: value
            for key, value in details.items()
            if key not in {"api_key", "password", "payment", "customer_phone"}
        }
        event = AuditEvent(event_type=event_type, order_id=order.order_id, details=safe_details)
        order.audit_history.append(event)
        self.logger.info(
            "procurement_event=%s order_id=%s",
            event_type,
            order.order_id,
        )
        return event
