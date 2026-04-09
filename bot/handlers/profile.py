"""FSM-анкета профиля пользователя."""

from aiogram.fsm.context import FSMContext
from aiogram.types import Message

from bot.db import upsert_user

from .common import ProfileForm, parse_float, router
from .main_screen import send_main_screen


@router.message(ProfileForm.name)
async def profile_name(message: Message, state: FSMContext) -> None:
    await state.update_data(name=message.text.strip())
    await state.set_state(ProfileForm.age)
    await message.answer("Возраст (полных лет):")


@router.message(ProfileForm.age)
async def profile_age(message: Message, state: FSMContext) -> None:
    if not message.text.isdigit():
        await message.answer("Возраст должен быть числом. Попробуй еще раз:")
        return

    await state.update_data(age=int(message.text))
    await state.set_state(ProfileForm.weight)
    await message.answer("Вес (кг), например 72.5:")


@router.message(ProfileForm.weight)
async def profile_weight(message: Message, state: FSMContext) -> None:
    value = parse_float(message.text)
    if value is None:
        await message.answer("Вес должен быть числом. Пример: 72.5")
        return

    await state.update_data(weight=value)
    await state.set_state(ProfileForm.height)
    await message.answer("Рост (см), например 180:")


@router.message(ProfileForm.height)
async def profile_height(message: Message, state: FSMContext) -> None:
    value = parse_float(message.text)
    if value is None:
        await message.answer("Рост должен быть числом. Пример: 180")
        return

    await state.update_data(height=value)
    await state.set_state(ProfileForm.experience)
    await message.answer("Стаж тренировок (например: 1 год или 3 месяца):")


@router.message(ProfileForm.experience)
async def profile_experience(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    upsert_user(
        user_id=message.from_user.id,
        name=data["name"],
        age=data["age"],
        weight=data["weight"],
        height=data["height"],
        experience=message.text.strip(),
    )
    await state.clear()
    await message.answer("Профиль сохранен.")
    await send_main_screen(message, message.from_user.id)
