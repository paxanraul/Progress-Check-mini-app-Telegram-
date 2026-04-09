"""Пакет обработчиков Telegram-бота."""

from .common import FEEDBACK_COMMAND, VIDEO_COMMAND, router
from . import admin as _admin  # noqa: F401
from . import faq as _faq  # noqa: F401
from . import feedback as _feedback  # noqa: F401
from . import profile as _profile  # noqa: F401
from . import start as _start  # noqa: F401
from . import fallback as _fallback  # noqa: F401

__all__ = ["FEEDBACK_COMMAND", "VIDEO_COMMAND", "router"]
