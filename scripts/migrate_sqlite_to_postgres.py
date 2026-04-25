"""Одноразовая миграция данных из SQLite в PostgreSQL."""

import argparse
import os
import sqlite3

from bot.db import get_connection, init_db


TABLES = (
    "started_users",
    "users",
    "workouts",
    "custom_quotes",
    "ai_chat_sessions",
)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Переносит данные из SQLite-файла gym_bot.db в PostgreSQL."
    )
    parser.add_argument(
        "--sqlite-path",
        default="gym_bot.db",
        help="Путь к исходному SQLite-файлу. По умолчанию gym_bot.db",
    )
    parser.add_argument(
        "--database-url",
        default=os.getenv("DATABASE_URL", "").strip(),
        help="PostgreSQL DSN. Если не передан, берётся из DATABASE_URL",
    )
    return parser.parse_args()


def fetch_sqlite_rows(sqlite_path: str, table_name: str) -> list[sqlite3.Row]:
    connection = sqlite3.connect(sqlite_path)
    connection.row_factory = sqlite3.Row
    try:
        cursor = connection.cursor()
        cursor.execute(f"SELECT * FROM {table_name}")
        return cursor.fetchall()
    finally:
        connection.close()


def migrate_started_users() -> int:
    rows = fetch_sqlite_rows(SQLITE_PATH, "started_users")
    if not rows:
        return 0

    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.executemany(
            """
            INSERT INTO started_users (
                user_id, username, full_name, started_at, last_start_at, starts_count
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET
                username = excluded.username,
                full_name = excluded.full_name,
                started_at = excluded.started_at,
                last_start_at = excluded.last_start_at,
                starts_count = excluded.starts_count
            """,
            [
                (
                    int(row["user_id"]),
                    row["username"],
                    row["full_name"],
                    row["started_at"],
                    row["last_start_at"],
                    int(row["starts_count"] or 1),
                )
                for row in rows
            ],
        )
        connection.commit()
    return len(rows)


def migrate_users() -> int:
    rows = fetch_sqlite_rows(SQLITE_PATH, "users")
    if not rows:
        return 0

    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.executemany(
            """
            INSERT INTO users (
                user_id, name, age, weight, height, experience, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET
                name = excluded.name,
                age = excluded.age,
                weight = excluded.weight,
                height = excluded.height,
                experience = excluded.experience,
                created_at = excluded.created_at
            """,
            [
                (
                    int(row["user_id"]),
                    row["name"],
                    int(row["age"] or 0),
                    float(row["weight"] or 0),
                    float(row["height"] or 0),
                    row["experience"],
                    row["created_at"],
                )
                for row in rows
            ],
        )
        connection.commit()
    return len(rows)


def migrate_workouts() -> int:
    rows = fetch_sqlite_rows(SQLITE_PATH, "workouts")
    if not rows:
        return 0

    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.executemany(
            """
            INSERT INTO workouts (
                id, user_id, workout_date, exercise, weight, sets, is_record, reps, workout_name, wellbeing_note, session_key
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                user_id = excluded.user_id,
                workout_date = excluded.workout_date,
                exercise = excluded.exercise,
                weight = excluded.weight,
                sets = excluded.sets,
                is_record = excluded.is_record,
                reps = excluded.reps,
                workout_name = excluded.workout_name,
                wellbeing_note = excluded.wellbeing_note,
                session_key = excluded.session_key
            """,
            [
                (
                    int(row["id"]),
                    int(row["user_id"]),
                    row["workout_date"],
                    row["exercise"],
                    float(row["weight"] or 0),
                    int(row["sets"] or 1),
                    int(row["is_record"] or 0),
                    int(row["reps"] or 1),
                    row["workout_name"],
                    row["wellbeing_note"],
                    row["session_key"],
                )
                for row in rows
            ],
        )
        cursor.execute(
            """
            SELECT setval(
                pg_get_serial_sequence('workouts', 'id'),
                COALESCE((SELECT MAX(id) FROM workouts), 1),
                true
            )
            """
        )
        connection.commit()
    return len(rows)


def migrate_custom_quotes() -> int:
    rows = fetch_sqlite_rows(SQLITE_PATH, "custom_quotes")
    if not rows:
        return 0

    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.executemany(
            """
            INSERT INTO custom_quotes (user_id, quotes_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET
                quotes_json = excluded.quotes_json,
                updated_at = excluded.updated_at
            """,
            [
                (
                    int(row["user_id"]),
                    row["quotes_json"],
                    row["updated_at"],
                )
                for row in rows
            ],
        )
        connection.commit()
    return len(rows)


def migrate_ai_chat_sessions() -> int:
    rows = fetch_sqlite_rows(SQLITE_PATH, "ai_chat_sessions")
    if not rows:
        return 0

    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.executemany(
            """
            INSERT INTO ai_chat_sessions (user_id, enabled, history_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT (user_id) DO UPDATE SET
                enabled = excluded.enabled,
                history_json = excluded.history_json,
                updated_at = excluded.updated_at
            """,
            [
                (
                    int(row["user_id"]),
                    int(row["enabled"] or 0),
                    row["history_json"],
                    row["updated_at"],
                )
                for row in rows
            ],
        )
        connection.commit()
    return len(rows)


def main():
    args = parse_args()
    if not args.database_url:
        raise SystemExit("Передайте --database-url или задайте DATABASE_URL")

    if not os.path.exists(args.sqlite_path):
        raise SystemExit(f"SQLite-файл не найден: {args.sqlite_path}")

    os.environ["DATABASE_URL"] = args.database_url

    global SQLITE_PATH
    SQLITE_PATH = args.sqlite_path

    init_db()

    migrated_counts = {
        "started_users": migrate_started_users(),
        "users": migrate_users(),
        "workouts": migrate_workouts(),
        "custom_quotes": migrate_custom_quotes(),
        "ai_chat_sessions": migrate_ai_chat_sessions(),
    }

    print("Миграция завершена.")
    for table_name in TABLES:
        print(f"{table_name}: {migrated_counts[table_name]}")


if __name__ == "__main__":
    main()
