import os
from urllib.parse import urlencode

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)


def get_mini_app_base_url() -> str:
    return os.getenv("MINI_APP_URL", "").strip()


def build_mini_app_url(user_id: int | None = None) -> str | None:
    base_url = get_mini_app_base_url().rstrip("/")
    if not base_url:
        return None

    if not base_url.endswith("/app"):
        base_url = f"{base_url}/app"

    if not base_url.startswith("https://"):
        return None

    if user_id is None:
        return base_url

    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}{urlencode({'user_id': user_id})}"


def main_menu_keyboard(user_id: int) -> ReplyKeyboardMarkup:
    keyboard = [
        [KeyboardButton(text="Главная"), KeyboardButton(text="Мини-гайд")],
    ]

    mini_app_url = build_mini_app_url(user_id)
    if mini_app_url:
        keyboard.append(
            [KeyboardButton(text="Mini App", web_app=WebAppInfo(url=mini_app_url))]
        )

    return ReplyKeyboardMarkup(
        keyboard=keyboard,
        resize_keyboard=True,
        is_persistent=True,
        input_field_placeholder="Выбери действие",
    )


def workout_action_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Очистить результат", callback_data="workout_reset"),
                InlineKeyboardButton(text="Отмена", callback_data="workout_cancel"),
            ]
        ],
    )


def workout_date_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Отмена", callback_data="workout_cancel"),
                InlineKeyboardButton(text="Сегодня", callback_data="workout_date_today"),
            ],
        ],
    )


def workout_next_step_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Добавить еще упражнение", callback_data="workout_add_more"
                ),
            ],
            [
                InlineKeyboardButton(text="Сохранить тренировку", callback_data="workout_finish"),
            ],
            [
                InlineKeyboardButton(text="Очистить результат", callback_data="workout_reset"),
                InlineKeyboardButton(text="Отмена", callback_data="workout_cancel"),
            ],
        ],
    )


def faq_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Техника", callback_data="faq_technique"),
                InlineKeyboardButton(text="Питание", callback_data="faq_nutrition"),
            ],
            [
                InlineKeyboardButton(text="Программы", callback_data="faq_programs"),
                InlineKeyboardButton(text="Восстановление", callback_data="faq_recovery"),
            ],
        ]
    )
