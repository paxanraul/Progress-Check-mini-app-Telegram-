"""Стартовые пользовательские сценарии."""

from aiogram import F
from aiogram.filters import CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from bot.db import get_user, upsert_started_user
from bot.keyboards import faq_keyboard

from .common import ProfileForm, START_NAME_PHOTO, router
from .main_screen import send_main_screen


@router.message(CommandStart())
async def cmd_start(message: Message, state: FSMContext) -> None:
    if message.from_user:
        upsert_started_user(
            user_id=message.from_user.id,
            username=message.from_user.username,
            full_name=message.from_user.full_name,
        )

    user = get_user(message.from_user.id)
    if user:
        await send_main_screen(message, message.from_user.id)
        return

    await state.set_state(ProfileForm.name)
    await message.answer_photo(
        photo=START_NAME_PHOTO,
        caption=(
            "Добро пожаловать в ProgressCheck🏋️‍♂️\n\n"
            "Сначала заполним профиль для старта.\n"
            "Введи имя:"
        ),
        parse_mode="HTML",
    )


@router.message(F.text == "Главная")
async def menu_home(message: Message) -> None:
    await send_main_screen(message, message.from_user.id)


@router.message(F.text == "Мини-гайд")
async def menu_mini_guide(message: Message) -> None:
    await message.answer("Выбери тему:", reply_markup=faq_keyboard())


async def start_workout_flow(message: Message, state: FSMContext, user_id: int) -> None:
    if not get_user(user_id):
        await message.answer("Сначала заполни профиль через /start.")
