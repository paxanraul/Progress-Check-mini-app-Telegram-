"""Сборка главного текстового экрана бота."""

from aiogram.types import Message

from bot.db import get_recent_workouts, get_records, get_user, get_workouts_count
from bot.keyboards import main_menu_keyboard


async def send_main_screen(message: Message, user_id: int) -> None:
    user = get_user(user_id)
    if not user:
        await message.answer("Профиль не найден. Запусти /start.")
        return

    workouts_count = get_workouts_count(user_id)
    workouts = get_recent_workouts(user_id, limit=5)
    records = get_records(user_id)

    summary = (
        "Для полного использования бота открой Mini App кнопкой Mini App под сообщением<tg-emoji emoji-id=\"5282869697463740318\">✨</tg-emoji>\n"
        "Так же есть видео-инструкция по команде /video\n\n"
        "AI-режим по команде /ai\n\n"
        "Мой прогресс: <tg-emoji emoji-id=\"5334882760735598374\">📝</tg-emoji>\n"
        f"Имя: {user['name']}\n"
        f"Возраст: {user['age']}\n"
        f"Вес: {user['weight']:.1f} кг\n"
        f"Рост: {user['height']:.1f} см\n"
        f"Стаж: {user['experience']}\n"
        f"Тренировок: {workouts_count}"
    )

    if not workouts:
        history = "\n\nИстория тренировок пока пустая."
    else:
        items = [
            f"{row['workout_date']}: {row['exercise']} - {row['weight']:.1f} кг x {row['reps']}"
            for row in workouts
        ]
        history = "\n\nПоследние тренировки:\n" + "\n".join(items)

    if not records:
        records_block = ""
    else:
        record_items = [
            f"{index}. {row['exercise']}: {row['best_weight']:.1f} кг"
            for index, row in enumerate(records[:5], start=1)
        ]
        records_block = "\n\nРекорды:\n" + "\n".join(record_items)

    await message.answer(
        summary + history + records_block,
        reply_markup=main_menu_keyboard(user_id),
        parse_mode="HTML",
    )
