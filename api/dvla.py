"""Vercel Function entry point for the existing same-origin tyre lookup."""

from server import Handler


class handler(Handler):
    """Reuse the validated, bounded DVLA/One Auto handler contract."""

    def log_message(self, _format, *args):
        del args
