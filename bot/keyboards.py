from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    KeyboardButton,
    ReplyKeyboardMarkup,
)


def main_menu_keyboard(user_id: int) -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="Главная"), KeyboardButton(text="Мини-гайд"),KeyboardButton(text="Главная")],
        ],
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
