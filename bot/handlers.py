import os
from datetime import date, datetime

from aiogram import F, Router
from aiogram import BaseMiddleware
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import CallbackQuery, Message


from bot.db import (
    add_workout,
    get_all_started_user_ids,
    get_recent_workouts,
    get_records,
    get_started_users_count,
    get_started_users,
    get_user,
    get_workouts_count,
    upsert_started_user,
    upsert_user,
    upsert_user_activity
)
from bot.keyboards import faq_keyboard, main_menu_keyboard, workout_action_keyboard
from bot.keyboards import workout_date_keyboard, workout_next_step_keyboard


router = Router()


class TrackUserActivityMiddleware(BaseMiddleware):
    async def __call__(self, handler, event: Message, data):
        if isinstance(event, Message) and event.from_user:
            upsert_user_activity(
                user_id=event.from_user.id,
                username=event.from_user.username,
                full_name=event.from_user.full_name,
            )
        return await handler(event, data)


router.message.outer_middleware(TrackUserActivityMiddleware())


FAQ_TEXTS = {
    "technique": (
        "Техника:\n"
        "1. Жим лежа: лопатки сведены, ноги упираются в пол, штанга идет по контролируемой траектории.\n"
        "2. Присед: спина нейтральна, колени смотрят в сторону носков, глубина без потери контроля.\n"
        "3. Становая: штанга близко к ногам, корпус жесткий, движение начинается ногами."
    ),
    "nutrition": (
        "Питание:\n"
        "1. Белок: 1.6-2.2 г на кг массы тела в сутки.\n"
        "2. Вода: ориентир 30-40 мл на кг.\n"
        "3. Для набора: небольшой профицит калорий.\n"
        "4. Для сушки: умеренный дефицит без резких ограничений."
    ),
    "programs": (
        "Программы:\n"
        "1. Новичок: 3 тренировки в неделю full-body.\n"
        "2. Средний уровень: upper/lower 4 раза в неделю.\n"
        "3. Прогрессия: повышай вес или повторы постепенно, фиксируй результат."
    ),
    "recovery": (
        "Восстановление:\n"
        "1. Сон 7-9 часов.\n"
        "2. 1-2 дня отдыха в неделю.\n"
        "3. Разминка перед тренировкой и заминка после.\n"
        "4. Если боль острая и не проходит, снизь нагрузку и обратись к специалисту."
    ),
}


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
    await message.answer(
        "Добро пожаловать в ProgressCheck <tg-emoji emoji-id=\"5282869697463740318\">✨</tg-emoji>\n"
        "Для полного использования бота открой mini app через кнопку Menu рядом с полем ввода.\n\n"
        "Сначала заполним профиль для старта.\n"
        "Введи имя:",
        parse_mode="HTML",
    )


@router.message(Command("stats"))
async def cmd_stats(message: Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("Команда доступна только админу.")
        return

    users = get_started_users(limit=100)
    lines = ["Статистика бота:"]
    lines.append(f"Заполнили профиль: {get_started_users_count()}")
    lines.append("")
    lines.append("Пользователи:")

    if not users:
        lines.append("Список пуст.")
    else:
        for row in users:
            username = f"@{row['username']}" if row["username"] else "без username"
            full_name = row["full_name"] or "без имени"
            lines.append(f"{row['user_id']} | {username} | {full_name}")

    await message.answer("\n".join(lines))


@router.message(Command("broadcast"))
async def cmd_broadcast(message: Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("Команда доступна только админу.")
        return

    parts = message.text.split(maxsplit=1)
    if len(parts) < 2 or not parts[1].strip():
        await message.answer("Использование: /broadcast (текст объявления)")
        return

    text = parts[1].strip()
    user_ids = get_all_started_user_ids()
    if not user_ids:
        await message.answer("Некому отправлять: в базе пока нет пользователей.")
        return

    sent = 0
    failed = 0
    for user_id in user_ids:
        try:
            await message.bot.send_message(user_id, f"{text}")
            sent += 1
        except Exception:
            failed += 1

    await message.answer(f"Рассылка завершена. Отправлено: {sent}, ошибок: {failed}.")


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
    await message.answer("Стаж тренировок (например: 1 год):")


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


@router.message(F.text == "Главная")
async def menu_home(message: Message) -> None:
    await send_main_screen(message, message.from_user.id)


@router.message(F.text == "Рекорды")
async def menu_records(message: Message) -> None:
    await message.answer(
        "Рекорды уже отображаются на главном экране и внутри mini app.",
        reply_markup=main_menu_keyboard(message.from_user.id),
    )


@router.message(F.text == "Вопросы")
async def menu_questions(message: Message) -> None:
    await message.answer("Выбери тему:", reply_markup=faq_keyboard())


async def start_workout_flow(message: Message, state: FSMContext, user_id: int) -> None:
    if not get_user(user_id):
        await message.answer("Сначала заполни профиль через /start.")
        return

    await state.set_state(WorkoutForm.workout_date)
    await state.set_data({})
    await message.answer(
        "Введите дату тренировки.\n"
        "Форматы: YYYY-MM-DD или DD.MM.YYYY\n"
        "Можно выбрать: Сегодня",
        reply_markup=workout_date_keyboard(),
    )


@router.callback_query(F.data == "workout_cancel")
async def workout_cancel(callback: CallbackQuery, state: FSMContext) -> None:
    current_state = await state.get_state()
    if not current_state or not current_state.startswith("WorkoutForm:"):
        await callback.answer("Нет активной записи тренировки.", show_alert=False)
        return

    await state.clear()
    await callback.message.answer("Запись тренировки отменена.")
    await send_main_screen(callback.message, callback.from_user.id)
    await callback.answer()


@router.callback_query(F.data == "workout_reset")
async def workout_reset(callback: CallbackQuery, state: FSMContext) -> None:
    current_state = await state.get_state()
    if not current_state or not current_state.startswith("WorkoutForm:"):
        await callback.answer("Нет активной записи тренировки.", show_alert=False)
        return

    await state.set_state(WorkoutForm.workout_date)
    await state.set_data({})
    await callback.message.answer(
        "Введенные данные очищены. Начнем заново.\n"
        "Введите дату тренировки (YYYY-MM-DD / DD.MM.YYYY или сегодня):",
        reply_markup=workout_date_keyboard(),
    )
    await callback.answer()


@router.callback_query(F.data == "workout_add_more")
async def workout_add_more(callback: CallbackQuery, state: FSMContext) -> None:
    current_state = await state.get_state()
    if not current_state or not current_state.startswith("WorkoutForm:"):
        await callback.answer("Нет активной записи тренировки.", show_alert=False)
        return

    await state.set_state(WorkoutForm.exercise)
    await callback.message.answer("Введите упражнение (например: Жим лежа):", reply_markup=workout_action_keyboard())
    await callback.answer()


@router.callback_query(F.data == "workout_date_today")
async def workout_date_today(callback: CallbackQuery, state: FSMContext) -> None:
    current_state = await state.get_state()
    if current_state != "WorkoutForm:workout_date":
        await callback.answer("Кнопка доступна только на шаге выбора даты.", show_alert=False)
        return

    today = date.today().isoformat()
    await state.update_data(workout_date=today, entries=[])
    await state.set_state(WorkoutForm.exercise)
    await callback.message.answer(
        f"Дата тренировки: {today}\nВведите упражнение (например: Жим лежа):",
        reply_markup=workout_action_keyboard(),
    )
    await callback.answer()


@router.callback_query(F.data == "workout_finish")
async def workout_finish(callback: CallbackQuery, state: FSMContext) -> None:
    current_state = await state.get_state()
    if not current_state or not current_state.startswith("WorkoutForm:"):
        await callback.answer("Нет активной записи тренировки.", show_alert=False)
        return

    data = await state.get_data()
    workout_date = data.get("workout_date")
    entries = data.get("entries", [])
    if not workout_date or not entries:
        await callback.answer("Нет данных для сохранения.", show_alert=False)
        return

    for entry in entries:
        add_workout(
            user_id=callback.from_user.id,
            workout_date=workout_date,
            exercise=entry["exercise"],
            weight=entry["weight"],
            reps=entry["reps"],
        )

    await state.clear()
    await callback.message.answer(
        f"Тренировка за {workout_date} сохранена. Упражнений: {len(entries)}."
    )
    await send_main_screen(callback.message, callback.from_user.id)
    await callback.answer()


@router.message(WorkoutForm.workout_date)
async def workout_date(message: Message, state: FSMContext) -> None:
    parsed = parse_workout_date(message.text)
    if not parsed:
        await message.answer(
            "Не понял дату. Используй YYYY-MM-DD или DD.MM.YYYY (или выбери: сегодня).",
            reply_markup=workout_date_keyboard(),
        )
        return

    await state.update_data(workout_date=parsed, entries=[])
    await state.set_state(WorkoutForm.exercise)
    await message.answer("Введите упражнение (например: Жим лежа):", reply_markup=workout_action_keyboard())


@router.message(WorkoutForm.exercise)
async def workout_exercise(message: Message, state: FSMContext) -> None:
    exercise = message.text.strip()
    if not exercise:
        await message.answer("Название упражнения не может быть пустым.", reply_markup=workout_action_keyboard())
        return

    await state.update_data(exercise=exercise)
    await state.set_state(WorkoutForm.weight)
    await message.answer("Введите рабочий вес (кг), например 80:", reply_markup=workout_action_keyboard())


@router.message(WorkoutForm.weight)
async def workout_weight(message: Message, state: FSMContext) -> None:
    value = parse_float(message.text)
    if value is None:
        await message.answer("Вес должен быть числом. Пример: 80", reply_markup=workout_action_keyboard())
        return

    await state.update_data(weight=value)
    await state.set_state(WorkoutForm.reps)
    await message.answer("Введите количество повторов, например 8:", reply_markup=workout_action_keyboard())


@router.message(WorkoutForm.reps)
async def workout_reps(message: Message, state: FSMContext) -> None:
    if not message.text.isdigit():
        await message.answer("Повторы должны быть целым числом. Пример: 8", reply_markup=workout_action_keyboard())
        return

    data = await state.get_data()
    entries = list(data.get("entries", []))
    entries.append(
        {
            "exercise": data["exercise"],
            "weight": data["weight"],
            "reps": int(message.text),
        }
    )
    await state.update_data(entries=entries)
    await state.set_state(WorkoutForm.decision)

    workout_date = data.get("workout_date", "дата не задана")
    await message.answer(
        build_workout_draft_text(workout_date, entries),
        reply_markup=workout_next_step_keyboard(),
    )


@router.message(WorkoutForm.decision)
async def workout_decision_text(message: Message) -> None:
    await message.answer(
        "Используй кнопки: 'Добавить еще упражнение' или 'Сохранить тренировку'.",
        reply_markup=workout_next_step_keyboard(),
    )


@router.callback_query(F.data.startswith("faq_"))
async def faq_callback(callback: CallbackQuery) -> None:
    category = callback.data.split("_", 1)[1]
    text = FAQ_TEXTS.get(category, "Тема не найдена.")
    await callback.message.answer(text)
    await callback.answer()


@router.message(Command("cancel"))
async def cmd_cancel(message: Message, state: FSMContext) -> None:
    current_state = await state.get_state()
    if not current_state:
        await message.answer("Нет активного действия.")
        return

    await state.clear()
    await message.answer("Действие отменено.")
    await send_main_screen(message, message.from_user.id)


@router.message()
async def fallback(message: Message) -> None:
    await message.answer(
        "Не понял сообщение. Используй /start, /cancel или кнопки на сообщении.",
    )


async def send_main_screen(message: Message, user_id: int) -> None:
    user = get_user(user_id)
    if not user:
        await message.answer("Профиль не найден. Запусти /start.")
        return

    workouts_count = get_workouts_count(user_id)
    workouts = get_recent_workouts(user_id, limit=5)
    records = get_records(user_id)

    summary = (
        "Мой прогресс: <tg-emoji emoji-id=\"5334882760735598374\">📝</tg-emoji>\n"
        "Для полного использования бота открой Mini app через кнопку Menu рядом с полем ввода.\n\n"
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


async def send_records_screen(message: Message, user_id: int) -> None:
    if not get_user(user_id):
        await message.answer("Сначала заполни профиль через /start.")
        return

    records = get_records(user_id)
    if not records:
        await message.answer(
            "Пока нет записей тренировок. Добавь первую через кнопку 'Добавить тренировку'.",
            reply_markup=main_menu_keyboard(user_id),
        )
        return

    lines = ["Твои рекорды:"]
    for index, row in enumerate(records, start=1):
        lines.append(f"{index}. {row['exercise']}: {row['best_weight']:.1f} кг")
    await message.answer("\n".join(lines), reply_markup=main_menu_keyboard(user_id))


def parse_float(value: str) -> float | None:
    text = value.strip().replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return None


def parse_workout_date(value: str) -> str | None:
    text = value.strip().lower()
    if text == "сегодня":
        return date.today().isoformat()

    for pattern in ("%Y-%m-%d", "%d.%m.%Y", "%d.%m.%y"):
        try:
            return datetime.strptime(text, pattern).date().isoformat()
        except ValueError:
            continue
    return None


def build_workout_draft_text(workout_date: str, entries: list[dict[str, int | float | str]]) -> str:
    lines = [f"Черновик тренировки за {workout_date}:"]
    for index, entry in enumerate(entries, start=1):
        lines.append(f"{index}. {entry['exercise']} - {entry['weight']:.1f} кг x {entry['reps']}")
    return "\n".join(lines)


def get_admin_ids() -> set[int]:
    admin_ids: set[int] = set()

    raw_single = os.getenv("ADMIN_ID", "").strip()
    if raw_single and raw_single.isdigit():
        admin_ids.add(int(raw_single))

    raw_many = os.getenv("ADMIN_IDS", "").strip()
    if raw_many:
        for item in raw_many.split(","):
            candidate = item.strip()
            if candidate.isdigit():
                admin_ids.add(int(candidate))

    return admin_ids


def is_admin(user_id: int) -> bool:
    return user_id in get_admin_ids()
