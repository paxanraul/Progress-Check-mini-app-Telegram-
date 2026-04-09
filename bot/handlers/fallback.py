"""Резервный обработчик непонятых сообщений."""

from aiogram.types import Message

from .common import router


@router.message()
async def fallback(message: Message) -> None:
    await message.answer(
        "Не понял сообщение. Используй /start или кнопки на сообщении.",
    )
