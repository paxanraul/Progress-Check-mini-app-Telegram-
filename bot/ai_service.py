"""Интеграция Telegram-бота с OpenRouter.

Сервис инкапсулирует:
1) чтение конфигурации модели из .env;
2) сборку system prompt под домен ProgressCheck;
3) вызов OpenRouter Chat Completions API.
"""

from __future__ import annotations

import os
from typing import Any

import httpx


OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_OPENROUTER_MODEL = "openrouter/free"
DEFAULT_MAX_COMPLETION_TOKENS = 500
DEFAULT_TEMPERATURE = 0.6
DEFAULT_TIMEOUT_SECONDS = 30.0


class AiServiceError(RuntimeError):
    """Понятная прикладная ошибка для ответа пользователю."""


def is_ai_enabled() -> bool:
    return bool(get_openrouter_api_key())


def get_openrouter_api_key() -> str:
    return os.getenv("OPENROUTER_API_KEY", "").strip()


def get_openrouter_model() -> str:
    return os.getenv("OPENROUTER_MODEL", "").strip() or DEFAULT_OPENROUTER_MODEL


def get_openrouter_title() -> str:
    return os.getenv("OPENROUTER_X_TITLE", "ProgressCheck").strip() or "ProgressCheck"


def get_openrouter_referer() -> str:
    return os.getenv("OPENROUTER_HTTP_REFERER", os.getenv("MINI_APP_URL", "")).strip()


def build_system_prompt(user_profile: dict[str, Any] | None = None) -> str:
    profile_lines: list[str] = []
    if user_profile:
        profile_lines.extend(
            [
                f"- Имя: {user_profile.get('name') or 'не указано'}",
                f"- Вес: {user_profile.get('weight') or 'не указан'}",
                f"- Рост: {user_profile.get('height') or 'не указан'}",
                f"- Стаж: {user_profile.get('experience') or 'не указан'}",
            ]
        )

    profile_block = "\n".join(profile_lines) if profile_lines else "- Профиль пока не заполнен"

    return (
        "Ты AI-помощник Telegram-бота ProgressCheck.\n"
        "Твоя зона: тренировки в зале, техника упражнений, восстановление, спортивное питание, "
        "базовые советы по прогрессу и объяснение функций самого бота.\n"
        "Отвечай на русском, кратко, практично и без воды.\n"
        "Если вопрос про тренировки или питание, давай безопасный и приземлённый совет.\n"
        "Не выдавай себя за врача и не ставь диагнозы. При травмах, сильной боли, резком ухудшении "
        "самочувствия советуй обратиться к врачу.\n"
        "Не придумывай факты о боте. Если функция в боте неизвестна, так и скажи.\n"
        "Если вопрос уходит далеко от тематики спорта и ProgressCheck, мягко возвращай диалог в тему.\n\n"
        "Текущий профиль пользователя:\n"
        f"{profile_block}"
    )


def _extract_text_content(content: Any) -> str:
    if isinstance(content, str):
        return content.strip()

    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            if isinstance(item, str):
                chunks.append(item)
                continue
            if isinstance(item, dict):
                text_value = item.get("text")
                if isinstance(text_value, str) and text_value.strip():
                    chunks.append(text_value.strip())
        return "\n".join(chunk for chunk in chunks if chunk).strip()

    return ""


async def generate_openrouter_reply(
    *,
    conversation: list[dict[str, str]],
    user_profile: dict[str, Any] | None = None,
) -> str:
    api_key = get_openrouter_api_key()
    if not api_key:
        raise AiServiceError(
            "AI пока не настроен. Добавь OPENROUTER_API_KEY в .env и перезапусти бота."
        )

    system_prompt = build_system_prompt(user_profile=user_profile)
    messages = [{"role": "system", "content": system_prompt}, *conversation]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "X-Title": get_openrouter_title(),
    }
    referer = get_openrouter_referer()
    if referer:
        headers["HTTP-Referer"] = referer

    payload = {
        "model": get_openrouter_model(),
        "messages": messages,
        "temperature": DEFAULT_TEMPERATURE,
        "max_tokens": DEFAULT_MAX_COMPLETION_TOKENS,
    }

    timeout = httpx.Timeout(DEFAULT_TIMEOUT_SECONDS)

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                OPENROUTER_API_URL,
                headers=headers,
                json=payload,
            )
    except httpx.TimeoutException as exc:
        raise AiServiceError("AI долго отвечает. Попробуй ещё раз чуть позже.") from exc
    except httpx.HTTPError as exc:
        raise AiServiceError("Не удалось связаться с OpenRouter.") from exc

    if response.status_code >= 400:
        message = "OpenRouter вернул ошибку."
        try:
            error_payload = response.json()
        except ValueError:
            error_payload = None

        if isinstance(error_payload, dict):
            error = error_payload.get("error")
            if isinstance(error, dict):
                error_message = error.get("message")
                if isinstance(error_message, str) and error_message.strip():
                    message = error_message.strip()
            elif isinstance(error, str) and error.strip():
                message = error.strip()

        raise AiServiceError(message)

    try:
        response_payload = response.json()
    except ValueError as exc:
        raise AiServiceError("OpenRouter вернул некорректный JSON.") from exc

    choices = response_payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise AiServiceError("OpenRouter не вернул ответ модели.")

    first_choice = choices[0]
    if not isinstance(first_choice, dict):
        raise AiServiceError("OpenRouter вернул неожиданный формат ответа.")

    message_payload = first_choice.get("message")
    if not isinstance(message_payload, dict):
        raise AiServiceError("OpenRouter не вернул сообщение модели.")

    content = _extract_text_content(message_payload.get("content"))
    if not content:
        raise AiServiceError("Модель вернула пустой ответ.")

    return content
