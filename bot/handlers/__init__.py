"""Пакет обработчиков Telegram-бота."""

from .common import FEEDBACK_COMMAND, VIDEO_COMMAND, router
from . import admin as _admin  # noqa: F401
from . import faq as _faq  # noqa: F401
from . import feedback as _feedback  # noqa: F401
from . import profile as _profile  # noqa: F401
from . import start as _start  # noqa: F401
from . import ai as _ai  # noqa: F401
from . import fallback as _fallback  # noqa: F401

AI_COMMAND = _ai.AI_COMMAND
AI_STOP_COMMAND = _ai.AI_STOP_COMMAND

__all__ = ["AI_COMMAND", "AI_STOP_COMMAND", "FEEDBACK_COMMAND", "VIDEO_COMMAND", "router"]
