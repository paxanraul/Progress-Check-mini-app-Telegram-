"""Общие константы, состояния и router для обработчиков бота."""

import os
from pathlib import Path

from aiogram import BaseMiddleware, Router
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, FSInputFile, Message

from bot.db import upsert_user_activity


router = Router()

ASSETS_DIR = Path(__file__).resolve().parents[1] / "assets"
START_NAME_PHOTO = FSInputFile(ASSETS_DIR / "start_name_photo.jpeg")
VIDEO_INSTRUCTION_FILE = FSInputFile(ASSETS_DIR / "video_instruction_placeholder.mp4")

FEEDBACK_COMMAND = "feedback"
VIDEO_COMMAND = "video"
FEEDBACK_MENU_TEXT = "Отзыв"
DEFAULT_SURVEY_URL = "https://docs.google.com/forms/d/e/1FAIpQLSfngSJ-HYbBNVLxYxc5BOGzraJrnlXt8k9hTMSX8-t4wOZUlQ/viewform?usp=publish-editor"


class TrackUserActivityMiddleware(BaseMiddleware):
    async def __call__(self, handler, event: Message, data):
        state: FSMContext | None = data.get("state")
        if (
            isinstance(event, Message)
            and state is not None
            and isinstance(event.text, str)
            and event.text.startswith("/")
        ):
            current_state = await state.get_state()
            if current_state == BroadcastForm.announcement.state and not event.text.startswith("/broadcast"):
                await state.clear()

        if isinstance(event, Message) and event.from_user:
            upsert_user_activity(
                user_id=event.from_user.id,
                username=event.from_user.username,
                full_name=event.from_user.full_name,
            )
        return await handler(event, data)


router.message.outer_middleware(TrackUserActivityMiddleware())


class ProfileForm(StatesGroup):
    name = State()
    age = State()
    weight = State()
    height = State()
    experience = State()


class WorkoutForm(StatesGroup):
    workout_date = State()
    exercise = State()
    weight = State()
    reps = State()
    decision = State()


class BroadcastForm(StatesGroup):
    announcement = State()


async def ensure_active_workout_state(event: CallbackQuery, state: FSMContext) -> bool:
    current_state = await state.get_state()
    if current_state and current_state.startswith("WorkoutForm:"):
        return True

    await event.answer("Нет активной записи тренировки.", show_alert=False)
    return False


def parse_float(value: str) -> float | None:
    text = value.strip().replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def get_admin_ids() -> set[int]:
    admin_ids: set[int] = set()

    raw_single = os.getenv("ADMIN_ID", "").strip()
    if raw_single:
        for item in raw_single.split(","):
            candidate = item.strip()
            if candidate.isdigit():
                admin_ids.add(int(candidate))

    raw_many = os.getenv("ADMIN_IDS", "").strip()
    if raw_many:
        for item in raw_many.split(","):
            candidate = item.strip()
            if candidate.isdigit():
                admin_ids.add(int(candidate))

    return admin_ids


def is_admin(user_id: int) -> bool:
    return user_id in get_admin_ids()
