import sqlite3
from contextlib import closing
from pathlib import Path


DB_PATH = Path("gym_bot.db")


def get_connection() -> sqlite3.Connection:
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
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
        ensure_column(
            cursor=cursor,
            table_name="workouts",
            column_name="sets",
            definition="INTEGER NOT NULL DEFAULT 1",
        )
        ensure_column(
            cursor=cursor,
            table_name="workouts",
            column_name="is_record",
            definition="INTEGER NOT NULL DEFAULT 0",
        )
        ensure_column(
            cursor=cursor,
            table_name="workouts",
            column_name="workout_name",
            definition="TEXT",
        )
        ensure_column(
            cursor=cursor,
            table_name="workouts",
            column_name="wellbeing_note",
            definition="TEXT",
        )
        ensure_column(
            cursor=cursor,
            table_name="workouts",
            column_name="session_key",
            definition="TEXT",
        )
        connection.commit()


def upsert_started_user(user_id: int, username: str | None, full_name: str) -> None:
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
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT exercise, MAX(weight) AS best_weight
            FROM workouts
            WHERE user_id = ? AND is_record = 1
            GROUP BY exercise
            ORDER BY best_weight DESC, exercise ASC
            """,
            (user_id,),
        )
        return cursor.fetchall()


def get_all_user_ids() -> list[int]:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT user_id FROM users")
        rows = cursor.fetchall()
        return [int(row["user_id"]) for row in rows]


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


def get_registered_users_count() -> int:
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


def get_workout_days(user_id: int, limit: int = 10) -> list[sqlite3.Row]:
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
    cursor.execute(f"PRAGMA table_info({table_name})")
    existing_columns = {row[1] for row in cursor.fetchall()}
    if column_name not in existing_columns:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {definition}")
