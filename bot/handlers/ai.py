"""AI-режим бота через OpenRouter."""

from __future__ import annotations

from aiogram import F
from aiogram.filters import BaseFilter, Command, StateFilter
from aiogram.types import Message
from aiogram.utils.chat_action import ChatActionSender

from bot.ai_service import AiServiceError, generate_openrouter_reply, is_ai_enabled
from bot.db import (
    clear_ai_history,
    get_ai_history,
    get_user,
    is_ai_mode_enabled,
    set_ai_history,
    set_ai_mode,
)

from .common import router


AI_COMMAND = "ai"
AI_STOP_COMMAND = "ai_stop"
AI_CLEAR_COMMAND = "ai_clear"
AI_ERROR_MESSAGE = "Не удалось обработать запрос. Попробуйте еще раз."


class AiChatMessageFilter(BaseFilter):
    async def __call__(self, message: Message) -> bool:
        if not message.from_user or not message.text:
            return False
        if message.text.startswith("/"):
            return False
        return is_ai_mode_enabled(message.from_user.id)


def get_command_argument(message: Message) -> str:
    if not message.text:
        return ""
    parts = message.text.split(maxsplit=1)
    return parts[1].strip() if len(parts) > 1 else ""


def build_ai_intro_text() -> str:
    return (
        "AI-режим включён.\n\n"
        "Можешь спрашивать про тренировки, питание, восстановление и функции ProgressCheck.\n"
        "Остановить диалог: /ai_stop\n"
        "Сбросить контекст: /ai_clear"
    )


def split_telegram_text(text: str, chunk_size: int = 3500) -> list[str]:
    normalized = text.strip()
    if not normalized:
        return []

    chunks: list[str] = []
    while len(normalized) > chunk_size:
        split_at = normalized.rfind("\n", 0, chunk_size)
        if split_at <= 0:
            split_at = chunk_size
        chunks.append(normalized[:split_at].strip())
        normalized = normalized[split_at:].strip()
    if normalized:
        chunks.append(normalized)
    return chunks


def build_user_profile_context(user_id: int) -> dict[str, str] | None:
    user = get_user(user_id)
    if not user:
        return None

    return {
        "name": user["name"],
        "weight": f"{float(user['weight']):.1f} кг" if user["weight"] is not None else "",
        "height": f"{float(user['height']):.1f} см" if user["height"] is not None else "",
        "experience": str(user["experience"] or "").strip(),
    }


async def send_ai_answer(message: Message, prompt_text: str) -> None:
    if not message.from_user:
        return

    user_id = message.from_user.id
    prompt_text = prompt_text.strip()
    if not prompt_text:
        await message.answer("Напиши вопрос после /ai или следующим сообщением.")
        return

    history = get_ai_history(user_id)
    conversation = [*history, {"role": "user", "content": prompt_text}]

    try:
        async with ChatActionSender.typing(
            bot=message.bot,
            chat_id=message.chat.id,
        ):
            reply_text = await generate_openrouter_reply(
                conversation=conversation,
                user_profile=build_user_profile_context(user_id),
            )
    except AiServiceError:
        await message.answer(AI_ERROR_MESSAGE)
        return
    except Exception:
        await message.answer(AI_ERROR_MESSAGE)
        return

    set_ai_history(
        user_id,
        [*conversation, {"role": "assistant", "content": reply_text}],
    )
    for chunk in split_telegram_text(reply_text):
        await message.answer(chunk)


@router.message(Command(AI_COMMAND))
async def handle_ai_command(message: Message) -> None:
    if not message.from_user:
        return

    if not is_ai_enabled():
        await message.answer(
            "AI пока не настроен на сервере. Нужен OPENROUTER_API_KEY в .env."
        )
        return

    set_ai_mode(message.from_user.id, True)

    inline_prompt = get_command_argument(message)
    if inline_prompt:
        await send_ai_answer(message, inline_prompt)
        return

    await message.answer(build_ai_intro_text())


@router.message(Command(AI_STOP_COMMAND))
async def handle_ai_stop_command(message: Message) -> None:
    if not message.from_user:
        return

    set_ai_mode(message.from_user.id, False)
    await message.answer("AI-режим выключен. Вернуться можно командой /ai.")


@router.message(Command(AI_CLEAR_COMMAND))
async def handle_ai_clear_command(message: Message) -> None:
    if not message.from_user:
        return

    was_enabled = is_ai_mode_enabled(message.from_user.id)
    clear_ai_history(message.from_user.id)
    if was_enabled:
        set_ai_mode(message.from_user.id, True)
    await message.answer("Контекст AI-диалога очищен.")


@router.message(StateFilter(None), F.text, AiChatMessageFilter())
async def handle_ai_dialog_message(message: Message) -> None:
    await send_ai_answer(message, message.text or "")
