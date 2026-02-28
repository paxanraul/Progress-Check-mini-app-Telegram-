import os

from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
    WebAppInfo,
)


def main_menu_keyboard(user_id: int) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Главная"), KeyboardButton(text="Рекорды")],
            [KeyboardButton(text="Добавить тренировку"), KeyboardButton(text="Вопросы")],
            [
                KeyboardButton(
                    text="Открыть Mini App",
                    web_app=WebAppInfo(url=build_mini_app_url(user_id)),
                )
            ],
        ],
        resize_keyboard=True,
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
            [InlineKeyboardButton(text="Отмена", callback_data="workout_cancel"), InlineKeyboardButton(text="Сегодня", callback_data="workout_date_today"),],
        ],
    )


def workout_next_step_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text="Добавить еще упражнение", callback_data="workout_add_more"),
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


def build_mini_app_url(user_id: int) -> str:
    base_url = os.getenv("MINI_APP_URL", "http://127.0.0.1:8080/app").rstrip("/")
    if base_url.endswith("/app"):
        return f"{base_url}?user_id={user_id}"
    return f"{base_url}/app?user_id={user_id}"
