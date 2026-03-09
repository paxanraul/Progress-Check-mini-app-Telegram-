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
                reps INTEGER NOT NULL,
                FOREIGN KEY(user_id) REFERENCES users(user_id)
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS workout_meta (
                user_id INTEGER NOT NULL,
                workout_date TEXT NOT NULL,
                workout_name TEXT NOT NULL DEFAULT '',
                note TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, workout_date)
            )
            """
        )
        ensure_column(
            cursor=cursor,
            table_name="workouts",
            column_name="sets",
            definition="INTEGER NOT NULL DEFAULT 1",
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
) -> None:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            INSERT INTO workouts (user_id, workout_date, exercise, weight, sets, reps)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user_id, workout_date, exercise, weight, sets, reps),
        )
        connection.commit()


def replace_workout_day(
    user_id: int,
    workout_date: str,
    exercises: list[dict],
    workout_name: str = "",
    note: str = "",
    source_workout_date: str | None = None,
) -> int:
    source_date = source_workout_date or workout_date
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            "DELETE FROM workouts WHERE user_id = ? AND workout_date = ?",
            (user_id, source_date),
        )

        saved = 0
        for item in exercises:
            exercise_name = str(item.get("exercise", "")).strip()
            if not exercise_name:
                continue
            try:
                weight = float(item.get("weight", 0))
                sets = max(1, int(item.get("sets", 1)))
                reps = max(1, int(item.get("reps", 1)))
            except (TypeError, ValueError):
                continue

            cursor.execute(
                """
                INSERT INTO workouts (user_id, workout_date, exercise, weight, sets, reps)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (user_id, workout_date, exercise_name, weight, sets, reps),
            )
            saved += 1

        if source_date != workout_date:
            cursor.execute(
                "DELETE FROM workout_meta WHERE user_id = ? AND workout_date = ?",
                (user_id, source_date),
            )

        if saved > 0:
            cursor.execute(
                """
                INSERT INTO workout_meta (user_id, workout_date, workout_name, note, updated_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, workout_date) DO UPDATE SET
                    workout_name = excluded.workout_name,
                    note = excluded.note,
                    updated_at = CURRENT_TIMESTAMP
                """,
                (user_id, workout_date, workout_name.strip(), note.strip()),
            )
        else:
            cursor.execute(
                "DELETE FROM workout_meta WHERE user_id = ? AND workout_date = ?",
                (user_id, workout_date),
            )

        connection.commit()
        return saved


def update_workout_meta(
    user_id: int,
    workout_date: str,
    workout_name: str | None = None,
    note: str | None = None,
) -> bool:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()

        cursor.execute(
            "SELECT 1 FROM workouts WHERE user_id = ? AND workout_date = ? LIMIT 1",
            (user_id, workout_date),
        )
        if cursor.fetchone() is None:
            return False

        cursor.execute(
            "SELECT workout_name, note FROM workout_meta WHERE user_id = ? AND workout_date = ?",
            (user_id, workout_date),
        )
        current = cursor.fetchone()

        current_name = current["workout_name"] if current else ""
        current_note = current["note"] if current else ""

        next_name = current_name if workout_name is None else workout_name.strip()
        next_note = current_note if note is None else note.strip()

        cursor.execute(
            """
            INSERT INTO workout_meta (user_id, workout_date, workout_name, note, updated_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, workout_date) DO UPDATE SET
                workout_name = excluded.workout_name,
                note = excluded.note,
                updated_at = CURRENT_TIMESTAMP
            """,
            (user_id, workout_date, next_name, next_note),
        )
        connection.commit()
        return True


def delete_workout_day(user_id: int, workout_date: str) -> bool:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            "DELETE FROM workouts WHERE user_id = ? AND workout_date = ?",
            (user_id, workout_date),
        )
        deleted = cursor.rowcount > 0
        cursor.execute(
            "DELETE FROM workout_meta WHERE user_id = ? AND workout_date = ?",
            (user_id, workout_date),
        )
        connection.commit()
        return deleted


def get_recent_workouts(user_id: int, limit: int = 5) -> list[sqlite3.Row]:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT workout_date, exercise, weight, sets, reps
            FROM workouts
            WHERE user_id = ?
            ORDER BY workout_date DESC, id DESC
            LIMIT ?
            """,
            (user_id, limit),
        )
        return cursor.fetchall()


def get_workouts_count(user_id: int) -> int:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute("SELECT COUNT(*) AS total FROM workouts WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        return int(row["total"]) if row else 0


def get_records(user_id: int) -> list[sqlite3.Row]:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT exercise, MAX(weight) AS best_weight
            FROM workouts
            WHERE user_id = ?
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


def get_workout_days(user_id: int, limit: int = 10) -> list[dict]:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT
                w.id,
                w.workout_date,
                w.exercise,
                w.weight,
                w.sets,
                w.reps,
                COALESCE(m.workout_name, '') AS workout_name,
                COALESCE(m.note, '') AS note
            FROM workouts w
            LEFT JOIN workout_meta m
                ON m.user_id = w.user_id AND m.workout_date = w.workout_date
            WHERE w.user_id = ?
            ORDER BY w.workout_date DESC, w.id DESC
            """,
            (user_id,),
        )
        rows = cursor.fetchall()

    grouped: dict[str, dict] = {}
    ordered_dates: list[str] = []

    for row in rows:
        date = row["workout_date"]
        if date not in grouped:
            grouped[date] = {
                "date": date,
                "workout_name": row["workout_name"] or "",
                "note": row["note"] or "",
                "exercises": [],
            }
            ordered_dates.append(date)

        grouped[date]["exercises"].append(
            {
                "id": int(row["id"]),
                "exercise": row["exercise"],
                "weight": f"{float(row['weight']):.1f}",
                "sets": int(row["sets"]),
                "reps": int(row["reps"]),
            }
        )

    result = [grouped[date] for date in ordered_dates]
    return result[:limit]


def get_total_workout_days(user_id: int) -> int:
    with closing(get_connection()) as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            SELECT COUNT(DISTINCT workout_date) AS total
            FROM workouts
            WHERE user_id = ?
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
