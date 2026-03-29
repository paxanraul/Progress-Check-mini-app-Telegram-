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


def admin_panel_keyboard(current_section: str = "overview") -> InlineKeyboardMarkup:
    def label(section: str, text: str) -> str:
        return f"• {text}" if current_section == section else text

    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text=label("overview", "Обзор"), callback_data="admin:overview"),
                InlineKeyboardButton(text=label("users", "Пользователи"), callback_data="admin:users"),
            ],
            [
                InlineKeyboardButton(text=label("workouts", "Тренировки"), callback_data="admin:workouts"),
                InlineKeyboardButton(text=label("records", "Рекорды"), callback_data="admin:records"),
            ],
            [
                InlineKeyboardButton(text=label("diagnostics", "Диагностика"), callback_data="admin:diagnostics"),
                InlineKeyboardButton(text=label("broadcast", "Рассылка"), callback_data="admin:broadcast"),
            ],
            [
                InlineKeyboardButton(text="Обновить", callback_data=f"admin:refresh:{current_section}"),
                InlineKeyboardButton(text="Закрыть", callback_data="admin:close"),
            ],
        ]
    )
