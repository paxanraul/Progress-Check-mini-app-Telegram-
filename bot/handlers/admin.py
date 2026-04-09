"""Админские команды, статистика и inline-панель."""

import html
import os

from aiogram import F
from aiogram.exceptions import TelegramBadRequest
from aiogram.filters import Command
from aiogram.types import CallbackQuery, Message

from bot.db import (
    DB_PATH,
    get_active_started_users_since,
    get_all_started_user_ids,
    get_profiles_count,
    get_recent_global_records,
    get_recent_global_workouts,
    get_started_users,
    get_started_users_count,
    get_total_records_count,
    get_total_workout_entries_count,
)
from bot.keyboards import admin_panel_keyboard

from .common import get_admin_ids, is_admin, router


@router.message(Command("admin"))
async def cmd_admin(message: Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("Команда доступна только админу.")
        return

    section = "overview"
    await message.answer(
        build_admin_panel_text(section),
        reply_markup=admin_panel_keyboard(section),
        parse_mode="HTML",
    )


@router.message(Command("stats"))
async def cmd_stats(message: Message) -> None:
    if not is_admin(message.from_user.id):
        await message.answer("Команда доступна только админу.")
        return

    users = get_started_users(limit=100)
    started_count = get_started_users_count()
    profiles_count = get_profiles_count()
    lines = ["Статистика бота:"]
    lines.append(f"Запустили бота: {started_count}")
    lines.append(f"Заполнили профиль: {profiles_count}")
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


@router.callback_query(F.data.startswith("admin:"))
async def admin_callback(callback: CallbackQuery) -> None:
    if not is_admin(callback.from_user.id):
        await callback.answer("Доступно только админу.", show_alert=True)
        return

    parts = callback.data.split(":")
    action = parts[1] if len(parts) > 1 else "overview"

    if action == "close":
        await safe_edit_admin_message(
            callback=callback,
            text="Админ-панель закрыта.\n\nИспользуй /admin, чтобы открыть её снова.",
            section=None,
        )
        await callback.answer("Панель закрыта.")
        return

    if action == "refresh":
        section = parts[2] if len(parts) > 2 else "overview"
    else:
        section = action

    await safe_edit_admin_message(
        callback=callback,
        text=build_admin_panel_text(section),
        section=section,
    )
    await callback.answer("Обновлено.")


def build_admin_panel_text(section: str) -> str:
    builders = {
        "overview": build_admin_overview_text,
        "users": build_admin_users_text,
        "workouts": build_admin_workouts_text,
        "records": build_admin_records_text,
        "diagnostics": build_admin_diagnostics_text,
        "broadcast": build_admin_broadcast_text,
    }
    builder = builders.get(section, build_admin_overview_text)
    return builder()


def build_admin_overview_text() -> str:
    started_total = get_started_users_count()
    profiles_total = get_profiles_count()
    active_24h = get_active_started_users_since(1)
    active_7d = get_active_started_users_since(7)
    workouts_total = get_total_workout_entries_count()
    records_total = get_total_records_count()
    users = get_started_users(limit=5)

    lines = [
        "<b>Админ-панель ProgressCheck</b>",
        "",
        f"Запусков бота: <b>{started_total}</b>",
        f"Профилей заполнено: <b>{profiles_total}</b>",
        f"Без профиля: <b>{max(started_total - profiles_total, 0)}</b>",
        f"Активны за 24 часа: <b>{active_24h}</b>",
        f"Активны за 7 дней: <b>{active_7d}</b>",
        f"Тренировок в базе: <b>{workouts_total}</b>",
        f"Рекордов в базе: <b>{records_total}</b>",
    ]

    if users:
        lines.extend(["", "<b>Последние пользователи</b>"])
        for row in users:
            lines.append(f"• {format_admin_user_row(row)}")

    return "\n".join(lines)


def build_admin_users_text() -> str:
    users = get_started_users(limit=12)
    lines = [
        "<b>Пользователи</b>",
        "",
        f"Всего запусков: <b>{get_started_users_count()}</b>",
        f"Профилей заполнено: <b>{get_profiles_count()}</b>",
        f"Активны за 24 часа: <b>{get_active_started_users_since(1)}</b>",
        f"Активны за 7 дней: <b>{get_active_started_users_since(7)}</b>",
        "",
        "<b>Последние входы</b>",
    ]

    if not users:
        lines.append("Пока пусто.")
    else:
        for row in users:
            lines.append(f"• {format_admin_user_row(row)}")

    return "\n".join(lines)


def build_admin_workouts_text() -> str:
    workouts = get_recent_global_workouts(limit=10)
    lines = [
        "<b>Тренировки</b>",
        "",
        f"Всего записей тренировок: <b>{get_total_workout_entries_count()}</b>",
        "",
        "<b>Последние записи</b>",
    ]

    if not workouts:
        lines.append("Тренировок пока нет.")
    else:
        for row in workouts:
            exercise = html.escape(row["exercise"])
            lines.append(
                f"• <code>{row['user_id']}</code> · {row['workout_date']} · "
                f"{exercise} — {row['weight']:.1f} кг x {row['reps']}"
            )

    return "\n".join(lines)


def build_admin_records_text() -> str:
    records = get_recent_global_records(limit=10)
    lines = [
        "<b>Рекорды</b>",
        "",
        f"Всего записей рекордов: <b>{get_total_records_count()}</b>",
        "",
        "<b>Последние рекорды</b>",
    ]

    if not records:
        lines.append("Рекордов пока нет.")
    else:
        for row in records:
            exercise = html.escape(row["exercise"])
            lines.append(
                f"• <code>{row['user_id']}</code> · {row['workout_date']} · "
                f"{exercise} — {row['best_weight']:.1f} кг"
            )

    return "\n".join(lines)


def build_admin_diagnostics_text() -> str:
    mini_app_url = os.getenv("MINI_APP_URL", "").strip()
    admin_ids = sorted(get_admin_ids())

    lines = [
        "<b>Диагностика</b>",
        "",
        f"BOT_TOKEN задан: <b>{'да' if bool(os.getenv('BOT_TOKEN', '').strip()) else 'нет'}</b>",
        f"MINI_APP_URL задан: <b>{'да' if bool(mini_app_url) else 'нет'}</b>",
        f"База найдена: <b>{'да' if DB_PATH.exists() else 'нет'}</b>",
        f"Путь к БД: <code>{html.escape(str(DB_PATH.resolve()))}</code>",
        f"Админов настроено: <b>{len(admin_ids)}</b>",
        "",
        "<b>ADMIN_IDS</b>",
    ]

    if admin_ids:
        for admin_id in admin_ids:
            lines.append(f"• <code>{admin_id}</code>")
    else:
        lines.append("Список пуст. Проверь ADMIN_ID / ADMIN_IDS в .env")

    if mini_app_url:
        lines.extend(["", f"Mini App URL:\n<code>{html.escape(mini_app_url)}</code>"])

    return "\n".join(lines)


def build_admin_broadcast_text() -> str:
    started_total = get_started_users_count()
    profiles_total = get_profiles_count()

    return "\n".join(
        [
            "<b>Рассылка</b>",
            "",
            "Массовая отправка уже доступна через команду:",
            "<code>/broadcast текст сообщения</code>",
            "",
            f"Получателей сейчас: <b>{started_total}</b>",
            f"Из них с профилем: <b>{profiles_total}</b>",
            "",
            "<b>Пример</b>",
            "<code>/broadcast Сегодня обновил mini app, можешь протестировать новый экран рекордов.</code>",
        ]
    )


def format_admin_user_row(row) -> str:
    username = f"@{html.escape(row['username'])}" if row["username"] else "без username"
    full_name = html.escape(row["full_name"] or "без имени")
    last_start = html.escape(row["last_start_at"] or "неизвестно")
    return f"<code>{row['user_id']}</code> · {username} · {full_name} · {last_start}"


async def safe_edit_admin_message(callback: CallbackQuery, text: str, section: str | None) -> None:
    reply_markup = admin_panel_keyboard(section) if section else None
    try:
        await callback.message.edit_text(
            text,
            reply_markup=reply_markup,
            parse_mode="HTML",
        )
    except TelegramBadRequest as error:
        if "message is not modified" not in str(error).lower():
            raise
