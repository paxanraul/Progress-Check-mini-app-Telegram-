"""Низкоуровневый слой работы с SQLite.

Здесь живут таблицы и CRUD-хелперы для профилей, тренировок, рекордов,
пользовательских цитат и данных админки.
"""

import json
import sqlite3
from contextlib import closing
from pathlib import Path


DB_PATH = Path("gym_bot.db")
# Эти колонки добавляются миграционно, чтобы старая БД продолжала работать после обновлений.
WORKOUT_OPTIONAL_COLUMNS = (
    ("sets", "INTEGER NOT NULL DEFAULT 1"),
    ("is_record", "INTEGER NOT NULL DEFAULT 0"),
    ("workout_name", "TEXT"),
    ("wellbeing_note", "TEXT"),
    ("session_key", "TEXT"),
)


def get_connection() -> sqlite3.Connection:
    # sqlite3.Row позволяет читать колонки по имени и делает код обработчиков понятнее.
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    # Инициализируем схему БД при каждом старте приложения.
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS started_users (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                full_name TEXT,
                started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                last_start_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                starts_count INTEGER NOT NULL DEFAULT 1
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                age INTEGER NOT NULL,
                weight REAL NOT NULL,
                height REAL NOT NULL,
                experience TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS workouts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                workout_date TEXT NOT NULL,
                exercise TEXT NOT NULL,
                weight REAL NOT NULL,
                sets INTEGER NOT NULL DEFAULT 1,
                is_record INTEGER NOT NULL DEFAULT 0,
                reps INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(user_id)
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS custom_quotes (
                user_id INTEGER PRIMARY KEY,
                quotes_json TEXT NOT NULL DEFAULT '[]',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        for column_name, definition in WORKOUT_OPTIONAL_COLUMNS:
            ensure_column(
                cursor=cursor,
                table_name="workouts",
                column_name=column_name,
                definition=definition,
            )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workouts_user_record
            ON workouts(user_id, is_record)
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workouts_user_date
            ON workouts(user_id, workout_date DESC)
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_workouts_user_session
            ON workouts(user_id, session_key)
            """
        )
        connection.commit()


def upsert_started_user(user_id: int, username: str | None, full_name: str) -> None:
    # started_users нужен для аналитики, статистики и массовых рассылок.
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO started_users (user_id, username, full_name)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                username=excluded.username,
                full_name=excluded.full_name,
                last_start_at=CURRENT_TIMESTAMP,
                starts_count=started_users.starts_count + 1
            """,
            (user_id, username, full_name),
        )
        connection.commit()


def upsert_user_activity(user_id: int, username: str | None, full_name: str) -> None:
    # Обновляем активность пользователя на каждом сообщении, а не только на /start.
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO started_users (user_id, username, full_name)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                username=excluded.username,
                full_name=excluded.full_name,
                last_start_at=CURRENT_TIMESTAMP
            """,
            (user_id, username, full_name),
        )
        connection.commit()


def upsert_user(
    user_id: int,
    name: str,
    age: int,
    weight: float,
    height: float,
    experience: str,
) -> None:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO users (user_id, name, age, weight, height, experience)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                name=excluded.name,
                age=excluded.age,
                weight=excluded.weight,
                height=excluded.height,
                experience=excluded.experience
            """,
            (user_id, name, age, weight, height, experience),
        )
        connection.commit()


def get_user(user_id: int) -> sqlite3.Row | None:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT * FROM users WHERE user_id = ?", (user_id,))
        return cursor.fetchone()


def get_custom_quotes(user_id: int) -> list[dict]:
    # Пользовательские цитаты храним как JSON-массив в одной строке на пользователя.
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT quotes_json FROM custom_quotes WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        if not row:
            return []
        try:
            quotes = json.loads(row["quotes_json"] or "[]")
        except Exception:
            return []
        return quotes if isinstance(quotes, list) else []


def upsert_custom_quotes(user_id: int, quotes_json: str) -> None:
    # Фронт отправляет полный снимок цитат, поэтому здесь нет частичных update-операций.
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO custom_quotes (user_id, quotes_json, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id) DO UPDATE SET
                quotes_json=excluded.quotes_json,
                updated_at=CURRENT_TIMESTAMP
            """,
            (user_id, quotes_json),
        )
        connection.commit()


def add_workout(
    user_id: int,
    workout_date: str,
    exercise: str,
    weight: float,
    reps: int,
    sets: int = 1,
    is_record: bool = False,
    workout_name: str | None = None,
    wellbeing_note: str | None = None,
    session_key: str | None = None,
) -> None:
    # Профиль в таблице users обновляется как одна агрегированная запись на пользователя.
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO workouts (
                user_id, workout_date, exercise, weight, sets, reps, is_record, workout_name, wellbeing_note, session_key
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                workout_date,
                exercise,
                weight,
                sets,
                reps,
                int(is_record),
                workout_name,
                wellbeing_note,
                session_key,
            ),
        )
        connection.commit()


def get_recent_workouts(user_id: int, limit: int = 5) -> list[sqlite3.Row]:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT workout_date, exercise, weight, sets, reps
            FROM workouts
            WHERE user_id = ? AND is_record = 0
            ORDER BY workout_date DESC, id DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
        return cursor.fetchall()


def get_workouts_count(user_id: int) -> int:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) AS total FROM workouts WHERE user_id = ? AND is_record = 0", (user_id,))
        row = cursor.fetchone()
        return int(row["total"]) if row else 0


def get_records(user_id: int) -> list[sqlite3.Row]:
    # Для каждого упражнения выбираем только лучший рекорд по весу и свежести записи.
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                w.exercise,
                w.weight AS best_weight,
                w.workout_date
            FROM workouts AS w
            WHERE w.user_id = ? AND w.is_record = 1
              AND w.id = (
                SELECT w2.id
                FROM workouts AS w2
                WHERE w2.user_id = w.user_id
                  AND w2.is_record = 1
                  AND TRIM(w2.exercise) = TRIM(w.exercise) COLLATE NOCASE
                ORDER BY w2.weight DESC, w2.workout_date DESC, w2.id DESC
                LIMIT 1
              )
            ORDER BY w.weight DESC, w.exercise COLLATE NOCASE ASC
            """,
            (user_id,),
        )
        return cursor.fetchall()


def get_all_started_user_ids() -> list[int]:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT user_id FROM started_users")
        rows = cursor.fetchall()
        return [int(row["user_id"]) for row in rows]


def get_started_users_count() -> int:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) AS total FROM started_users")
        row = cursor.fetchone()
        return int(row["total"]) if row else 0


def get_profiles_count() -> int:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) AS total FROM users")
        row = cursor.fetchone()
        return int(row["total"]) if row else 0


def get_started_users(limit: int = 100) -> list[sqlite3.Row]:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT user_id, username, full_name, last_start_at
            FROM started_users
            ORDER BY last_start_at DESC
            LIMIT ?
            """,
            (limit,),
        )
        return cursor.fetchall()


def get_started_user(user_id: int) -> sqlite3.Row | None:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT user_id, username, full_name, last_start_at
            FROM started_users
            WHERE user_id = ?
            """,
            (user_id,),
        )
        return cursor.fetchone()


def get_active_started_users_since(days: int) -> int:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT COUNT(*) AS total
            FROM started_users
            WHERE datetime(last_start_at) >= datetime('now', ?)
            """,
            (f"-{max(days, 0)} days",),
        )
        row = cursor.fetchone()
        return int(row["total"]) if row else 0


def get_total_workout_entries_count() -> int:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) AS total FROM workouts WHERE is_record = 0")
        row = cursor.fetchone()
        return int(row["total"]) if row else 0


def get_total_records_count() -> int:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) AS total FROM workouts WHERE is_record = 1")
        row = cursor.fetchone()
        return int(row["total"]) if row else 0


def get_recent_global_workouts(limit: int = 8) -> list[sqlite3.Row]:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                user_id,
                workout_date,
                exercise,
                weight,
                sets,
                reps,
                workout_name
            FROM workouts
            WHERE is_record = 0
            ORDER BY workout_date DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        )
        return cursor.fetchall()


def get_recent_global_records(limit: int = 8) -> list[sqlite3.Row]:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                user_id,
                workout_date,
                exercise,
                weight AS best_weight
            FROM workouts
            WHERE is_record = 1
            ORDER BY workout_date DESC, id DESC
            LIMIT ?
            """,
            (limit,),
        )
        return cursor.fetchall()


def get_workout_days(user_id: int, limit: int = 10) -> list[sqlite3.Row]:
    # История mini-app агрегируется по session_key, чтобы одна тренировка содержала много упражнений.
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                COALESCE(NULLIF(TRIM(session_key), ''), 'legacy:' || workout_date) AS session_key,
                workout_date,
                MAX(id) AS last_id,
                MAX(NULLIF(TRIM(workout_name), '')) AS workout_name,
                MAX(NULLIF(TRIM(wellbeing_note), '')) AS wellbeing_note,
                GROUP_CONCAT(
                    exercise || '|' || printf('%.1f', weight) || '|' || sets || '|' || reps,
                    '||'
                ) AS exercises
            FROM workouts
            WHERE user_id = ? AND is_record = 0
            GROUP BY COALESCE(NULLIF(TRIM(session_key), ''), 'legacy:' || workout_date), workout_date
            ORDER BY workout_date DESC, last_id DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
        return cursor.fetchall()


def get_total_workout_days(user_id: int) -> int:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT COUNT(
                DISTINCT COALESCE(NULLIF(TRIM(session_key), ''), 'legacy:' || workout_date)
            ) AS total
            FROM workouts
            WHERE user_id = ? AND is_record = 0
            """,
            (user_id,),
        )
        row = cursor.fetchone()
        return int(row["total"]) if row else 0


def ensure_column(cursor: sqlite3.Cursor, table_name: str, column_name: str, definition: str) -> None:
    # Простейшая runtime-миграция: добавляем колонку, если приложение обновилось, а БД ещё старая.
    cursor.execute(f"PRAGMA table_info({table_name})")
    existing_columns = {row[1] for row in cursor.fetchall()}
    if column_name not in existing_columns:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")
