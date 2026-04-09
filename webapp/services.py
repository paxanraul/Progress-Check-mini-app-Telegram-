"""Сервисные хелперы FastAPI backend."""

import json
from datetime import date, datetime

from bot.db import (
    get_custom_quotes,
    get_records,
    get_started_user,
    get_total_workout_days,
    get_user,
    get_workout_days,
)


FAQ_DATA = {
    "technique": [
        {
            "question": "Как правильно жать лежа?",
            "answer": "Сведи лопатки, упрись ногами в пол и опускай штангу подконтрольно к нижней части груди.",
        },
        {
            "question": "Как делать становую тягу?",
            "answer": "Держи штангу близко к ногам, сохраняй нейтральную спину и начинай движение ногами.",
        },
    ],
    "nutrition": [
        {
            "question": "Сколько белка есть?",
            "answer": "Ориентир для прогресса в зале: 1.6-2.2 грамма белка на килограмм веса.",
        },
        {
            "question": "Нужен ли профицит?",
            "answer": "Для набора мышц обычно нужен умеренный профицит калорий без резкого переедания.",
        },
    ],
    "programs": [
        {
            "question": "Что выбрать новичку?",
            "answer": "Начни с 3 тренировок full-body в неделю и фиксируй постепенный рост нагрузки.",
        },
        {
            "question": "Когда менять программу?",
            "answer": "Когда прогресс в весах и повторах останавливается на 3-4 недели подряд.",
        },
    ],
    "recovery": [
        {
            "question": "Сколько спать?",
            "answer": "Стабильные 7-9 часов сна заметно влияют на восстановление и рост результатов.",
        },
        {
            "question": "Нужны ли дни отдыха?",
            "answer": "Да. Минимум 1-2 полноценных дня отдыха в неделю снижают риск перегруза.",
        },
    ],
}

MAX_CUSTOM_QUOTES = 5


def normalize_custom_quotes(items: object) -> list[dict[str, str]]:
    if isinstance(items, str):
        try:
            parsed = json.loads(items)
        except Exception:
            return normalize_custom_quotes([{"text": items}])
        return normalize_custom_quotes(parsed)
    if isinstance(items, dict):
        return normalize_custom_quotes([items])
    if not isinstance(items, list):
        return []

    normalized: list[dict[str, str]] = []
    for item in items:
        if isinstance(item, str):
            text = item.strip()
            if text:
                normalized.append({"text": text[:240], "author": ""})
            continue
        if not isinstance(item, dict):
            continue

        text = str(item.get("text", "")).strip()
        author = str(item.get("author", "")).strip()
        if not text:
            continue

        normalized.append({"text": text[:240], "author": author[:80]})

    return normalized[:MAX_CUSTOM_QUOTES]


def started_user_exists(user_id: int) -> bool:
    return bool(get_started_user(user_id))


def parse_exercise_payload(item: object) -> dict[str, float | int | str] | None:
    if not isinstance(item, dict):
        return None

    exercise_name = str(item.get("exercise", "")).strip()
    if not exercise_name:
        return None

    try:
        weight = float(item.get("weight", 0))
        sets = max(1, int(item.get("sets", 1)))
        reps = max(1, int(item.get("reps", 1)))
    except (TypeError, ValueError):
        return None

    return {
        "exercise": exercise_name,
        "weight": weight,
        "sets": sets,
        "reps": reps,
    }


def collect_valid_exercises(items: object) -> list[dict[str, float | int | str]]:
    if not isinstance(items, list):
        return []

    valid_items: list[dict[str, float | int | str]] = []
    for item in items:
        parsed = parse_exercise_payload(item)
        if parsed:
            valid_items.append(parsed)
    return valid_items


def parse_history_exercises(raw: object) -> list[dict[str, int | str]]:
    exercises: list[dict[str, int | str]] = []

    if isinstance(raw, list):
        for item in raw:
            parsed = parse_exercise_payload(item)
            if not parsed:
                continue
            exercises.append(
                {
                    "exercise": str(parsed["exercise"]),
                    "weight": f"{float(parsed['weight']):.1f}",
                    "sets": int(parsed["sets"]),
                    "reps": int(parsed["reps"]),
                }
            )
        return exercises

    for chunk in str(raw or "").split("||"):
        if not chunk:
            continue
        parts = chunk.split("|")
        if len(parts) != 4:
            continue
        exercise, weight, sets, reps = parts
        parsed = parse_exercise_payload(
            {
                "exercise": exercise,
                "weight": weight,
                "sets": sets,
                "reps": reps,
            }
        )
        if not parsed:
            continue
        exercises.append(
            {
                "exercise": str(parsed["exercise"]),
                "weight": f"{float(parsed['weight']):.1f}",
                "sets": int(parsed["sets"]),
                "reps": int(parsed["reps"]),
            }
        )

    return exercises


def serialize_history_row(row) -> dict[str, object]:
    row_keys = set(row.keys()) if hasattr(row, "keys") else set()
    wellbeing_note = (
        row["wellbeing_note"]
        if "wellbeing_note" in row_keys
        else (row["note"] if "note" in row_keys else "")
    ) or ""

    return {
        "session_key": (row["session_key"] if "session_key" in row_keys else "") or "",
        "date": (row["workout_date"] if "workout_date" in row_keys else "") or "",
        "workout_name": (row["workout_name"] if "workout_name" in row_keys else "") or "",
        "note": wellbeing_note,
        "exercises": parse_history_exercises(row["exercises"] if "exercises" in row_keys else ""),
    }


def parse_record_date(raw_value) -> str | None:
    text = str(raw_value or "").strip()
    if not text:
        return None

    for pattern in ("%Y-%m-%d", "%d.%m.%Y", "%d.%m.%y"):
        try:
            return datetime.strptime(text, pattern).date().isoformat()
        except ValueError:
            continue

    raise ValueError("invalid record date")


def normalize_record_date_output(raw_value) -> str:
    try:
        return parse_record_date(raw_value) or ""
    except ValueError:
        return ""


def serialize_record_row(row) -> dict[str, str] | None:
    try:
        return {
            "exercise": row["exercise"],
            "best_weight": f"{float(row['best_weight']):.1f}",
            "date": normalize_record_date_output(row["workout_date"] if "workout_date" in row.keys() else ""),
        }
    except (KeyError, TypeError, ValueError):
        return None


def delete_workout_rows(
    cursor,
    *,
    user_id: int,
    workout_date: str = "",
    session_key: str = "",
) -> int:
    if session_key:
        cursor.execute(
            """
            DELETE FROM workouts
            WHERE user_id = ? AND session_key = ? AND is_record = 0
            """,
            (user_id, session_key),
        )
        if cursor.rowcount == 0 and workout_date:
            cursor.execute(
                """
                DELETE FROM workouts
                WHERE user_id = ? AND workout_date = ? AND is_record = 0
                """,
                (user_id, workout_date),
            )
        return cursor.rowcount

    cursor.execute(
        """
        DELETE FROM workouts
        WHERE user_id = ? AND workout_date = ? AND is_record = 0
        """,
        (user_id, workout_date),
    )
    return cursor.rowcount


def build_app_data_payload(user_id: int) -> dict[str, object]:
    profile = get_user(user_id)
    started_user = get_started_user(user_id)
    if not profile and not started_user:
        return {
            "ready": False,
            "message": "Пользователь не найден. Сначала открой бота и нажми /start.",
            "history": [],
            "records": [],
            "custom_quotes": [],
            "faq": FAQ_DATA,
        }

    history_payload = [serialize_history_row(row) for row in get_workout_days(user_id, limit=8)]
    records_payload = [item for row in get_records(user_id) if (item := serialize_record_row(row))]
    custom_quotes_payload = normalize_custom_quotes(get_custom_quotes(user_id))

    return {
        "ready": True,
        "user": {
            "name": profile["name"] if profile else (started_user["full_name"] if started_user else "Пользователь"),
            "weight": f"{float(profile['weight']):.1f}" if profile else None,
            "height": f"{float(profile['height']):.1f}" if profile else None,
            "experience": profile["experience"] if profile else "Не заполнено",
            "workout_days": get_total_workout_days(user_id),
        },
        "history": history_payload,
        "records": records_payload,
        "custom_quotes": custom_quotes_payload,
        "faq": FAQ_DATA,
    }


def record_response_payload(exercise: str, weight: float, workout_date: str | None = None) -> dict[str, object]:
    return {
        "ok": True,
        "record": {
            "exercise": exercise,
            "best_weight": f"{weight:.1f}",
            "date": workout_date or date.today().isoformat(),
        },
    }
