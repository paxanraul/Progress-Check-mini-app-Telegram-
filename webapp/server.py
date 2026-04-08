"""HTTP backend для Telegram Mini App.

Файл раздаёт статику mini-app и предоставляет JSON API для:
профиля, тренировок, рекордов, FAQ и кастомных цитат.
"""

import json
from pathlib import Path
from datetime import date, datetime
from uuid import uuid4

from aiohttp import web

from bot.db import (
    add_workout,
    get_custom_quotes,
    get_connection,
    get_records,
    get_started_user,
    get_total_workout_days,
    get_user,
    get_workout_days,
    upsert_user,
    upsert_custom_quotes,
)


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"

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


@web.middleware
async def no_cache_static_middleware(request: web.Request, handler):
    # HTML всегда отдаем свежим, а тяжелую статику разрешаем кэшировать.
    # Это заметно ускоряет повторные открытия mini-app в Telegram WebView.
    response = await handler(request)
    if request.path in {"/", "/app"}:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    elif request.path.startswith("/static/"):
        response.headers["Cache-Control"] = "public, max-age=604800, immutable"
        response.headers.pop("Pragma", None)
        response.headers.pop("Expires", None)
    return response


def json_error(message: str, status: int = 400) -> web.Response:
    return web.json_response({"error": message}, status=status)


async def read_json_payload(request: web.Request) -> dict | None:
    # Все mutating-роуты ждут JSON-объект; helper даёт единый fallback на invalid body.
    try:
        payload = await request.json()
    except Exception:
        return None
    return payload if isinstance(payload, dict) else None


def normalize_custom_quotes(items: object) -> list[dict[str, str]]:
    # Сервер валидирует цитаты теми же ограничениями, что и фронт, чтобы не хранить мусор в БД.
    if isinstance(items, str):
        return normalize_custom_quotes([{"text": items}])
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
    # Единая валидация exercise-item используется и для сохранения, и для сериализации истории.
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
    # Приводим DB-строку к формату, который фронт уже умеет рендерить без дополнительной обработки.
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
    # Удаление поддерживает и новые session_key, и старые legacy-записи только по workout_date.
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


async def index(request: web.Request) -> web.Response:
    return web.FileResponse(STATIC_DIR / "index.html")


async def app_data(request: web.Request) -> web.Response:
    # Главный bootstrap-endpoint mini-app: возвращает весь базовый снимок экрана одним запросом.
    try:
        user_id = parse_user_id(request)
        if user_id is None:
            return json_error("user_id is required")

        profile = get_user(user_id)
        started_user = get_started_user(user_id)
        if not profile and not started_user:
            return web.json_response(
                {
                    "ready": False,
                    "message": "Пользователь не найден. Сначала открой бота и нажми /start.",
                }
            )

        history_payload = [serialize_history_row(row) for row in get_workout_days(user_id, limit=8)]
        records_payload = [item for row in get_records(user_id) if (item := serialize_record_row(row))]
        custom_quotes_payload = normalize_custom_quotes(get_custom_quotes(user_id))

        payload = {
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
        return web.json_response(payload)
    except Exception as error:
        return web.json_response({"error": f"app_data failed: {error}"}, status=500)


async def faq_data(request: web.Request) -> web.Response:
    return web.json_response({"faq": FAQ_DATA})


async def update_profile(request: web.Request) -> web.Response:
    # Профиль обновляется отдельно от истории тренировок, но остаётся привязанным к тому же user_id.
    payload = await read_json_payload(request)
    if payload is None:
        return json_error("invalid json")

    user_id = payload.get("user_id")
    name = str(payload.get("name", "")).strip()
    experience = str(payload.get("experience", "")).strip()

    try:
        weight = float(payload.get("weight", 0))
        height = float(payload.get("height", 0))
    except (TypeError, ValueError):
        return json_error("weight and height must be numbers")

    if not isinstance(user_id, int):
        return json_error("user_id must be int")
    if not name:
        return json_error("name is required")
    if weight <= 0 or height <= 0:
        return json_error("weight and height must be > 0")

    started_user = get_started_user(user_id)
    if not started_user:
        return json_error("user not found", status=404)

    current_profile = get_user(user_id)
    age = int(current_profile["age"]) if current_profile and current_profile["age"] is not None else 0

    upsert_user(
        user_id=user_id,
        name=name,
        age=age,
        weight=weight,
        height=height,
        experience=experience or "Не заполнено",
    )
    return web.json_response({"ok": True})


async def update_custom_quotes(request: web.Request) -> web.Response:
    # Цитаты синхронизируются между устройствами полным массивом, а не отдельными patch-запросами.
    payload = await read_json_payload(request)
    if payload is None:
        return json_error("invalid json")

    user_id = payload.get("user_id")
    if not isinstance(user_id, int):
        return json_error("user_id must be int")
    if not started_user_exists(user_id):
        return json_error("user not found", status=404)

    quotes = normalize_custom_quotes(payload.get("quotes", []))
    upsert_custom_quotes(user_id, json.dumps(quotes, ensure_ascii=False))
    return web.json_response({"ok": True, "quotes": quotes})


async def clear_profile_data(request: web.Request) -> web.Response:
    # Полная очистка удаляет и профиль, и все пользовательские записи, связанные с ним.
    payload = await read_json_payload(request)
    if payload is None:
        return json_error("invalid json")

    user_id = payload.get("user_id")
    if not isinstance(user_id, int):
        return json_error("user_id must be int")
    if not started_user_exists(user_id):
        return json_error("user not found", status=404)

    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM workouts WHERE user_id = ?", (user_id,))
        cursor.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
        connection.commit()

    return web.json_response({"ok": True})


async def save_workout(request: web.Request) -> web.Response:
    # Новая тренировка может содержать несколько упражнений, поэтому сервер раскладывает её в несколько строк.
    payload = await read_json_payload(request)
    if payload is None:
        return json_error("invalid json")

    user_id = payload.get("user_id")
    workout_date = str(payload.get("workout_date", "")).strip()
    workout_name = str(payload.get("workout_name", "")).strip()
    wellbeing_note = str(payload.get("wellbeing_note", "")).strip()
    exercises = payload.get("exercises", [])

    if not isinstance(user_id, int):
        return json_error("user_id must be int")
    if not workout_date:
        return json_error("workout_date is required")
    if not isinstance(exercises, list) or not exercises:
        return json_error("exercises must be a non-empty list")
    if not started_user_exists(user_id):
        return json_error("user not found", status=404)

    session_key = uuid4().hex
    valid_exercises = collect_valid_exercises(exercises)
    for item in valid_exercises:
        exercise_name = str(item["exercise"])
        weight = float(item["weight"])
        sets = int(item["sets"])
        reps = int(item["reps"])

        add_workout(
            user_id=user_id,
            workout_date=workout_date,
            exercise=exercise_name,
            weight=weight,
            sets=sets,
            reps=reps,
            is_record=False,
            workout_name=workout_name or None,
            wellbeing_note=wellbeing_note or None,
            session_key=session_key,
        )

    if not valid_exercises:
        return json_error("no valid exercises to save")

    return web.json_response({"ok": True, "saved": len(valid_exercises)})


async def update_workout(request: web.Request) -> web.Response:
    # Редактирование тренировки работает как replace набора упражнений внутри одной session_key.
    payload = await read_json_payload(request)
    if payload is None:
        return json_error("invalid json")

    user_id = payload.get("user_id")
    source_workout_date = str(payload.get("source_workout_date", "")).strip()
    source_session_key = str(payload.get("source_session_key", "")).strip()
    workout_date = str(payload.get("workout_date", "")).strip()
    session_key = str(payload.get("session_key", "")).strip()
    workout_name = str(payload.get("workout_name", "")).strip()
    wellbeing_note = str(payload.get("wellbeing_note", "")).strip()
    exercises = payload.get("exercises", [])

    if not isinstance(user_id, int):
        return json_error("user_id must be int")
    if not source_workout_date and not source_session_key:
        return json_error("source_workout_date or source_session_key is required")
    if not workout_date:
        return json_error("workout_date is required")
    if not isinstance(exercises, list) or not exercises:
        return json_error("exercises must be a non-empty list")
    if not started_user_exists(user_id):
        return json_error("user not found", status=404)

    valid_exercises = collect_valid_exercises(exercises)

    if not valid_exercises:
        return json_error("no valid exercises to save")

    target_session_key = session_key or source_session_key or uuid4().hex

    with get_connection() as connection:
        cursor = connection.cursor()
        deleted = delete_workout_rows(
            cursor,
            user_id=user_id,
            workout_date=source_workout_date,
            session_key=source_session_key,
        )
        if deleted == 0:
            connection.rollback()
            return json_error("source workout not found", status=404)

        for item in valid_exercises:
            cursor.execute(
                """
                INSERT INTO workouts (
                    user_id, workout_date, exercise, weight, sets, reps, is_record, workout_name, wellbeing_note, session_key
                )
                VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
                """,
                (
                    user_id,
                    workout_date,
                    item["exercise"],
                    float(item["weight"]),
                    int(item["sets"]),
                    int(item["reps"]),
                    workout_name or None,
                    wellbeing_note or None,
                    target_session_key,
                ),
            )
        connection.commit()

    return web.json_response({"ok": True, "saved": len(valid_exercises)})


async def delete_workout(request: web.Request) -> web.Response:
    payload = await read_json_payload(request)
    if payload is None:
        return json_error("invalid json")

    user_id = payload.get("user_id")
    workout_date = str(payload.get("workout_date", "")).strip()
    session_key = str(payload.get("session_key", "")).strip()

    if not isinstance(user_id, int):
        return json_error("user_id must be int")
    if not workout_date and not session_key:
        return json_error("workout_date or session_key is required")
    if not started_user_exists(user_id):
        return json_error("user not found", status=404)

    with get_connection() as connection:
        cursor = connection.cursor()
        deleted = delete_workout_rows(
            cursor,
            user_id=user_id,
            workout_date=workout_date,
            session_key=session_key,
        )
        connection.commit()

    if deleted == 0:
        return json_error("workout not found", status=404)

    return web.json_response({"ok": True, "deleted": int(deleted)})


async def delete_all_workouts(request: web.Request) -> web.Response:
    payload = await read_json_payload(request)
    if payload is None:
        return json_error("invalid json")

    user_id = payload.get("user_id")
    if not isinstance(user_id, int):
        return json_error("user_id must be int")
    if not started_user_exists(user_id):
        return json_error("user not found", status=404)

    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            DELETE FROM workouts
            WHERE user_id = ? AND is_record = 0
            """,
            (user_id,),
        )
        deleted = cursor.rowcount
        connection.commit()

    return web.json_response({"ok": True, "deleted": int(deleted)})


async def save_record(request: web.Request) -> web.Response:
    # Рекорд сохраняется отдельной строкой в workouts с флагом is_record=1.
    payload = await read_json_payload(request)
    if payload is None:
        return json_error("invalid json")

    user_id = payload.get("user_id")
    exercise = str(payload.get("exercise", "")).strip()
    best_weight = payload.get("best_weight")
    raw_workout_date = payload.get("workout_date", payload.get("date", ""))

    if not isinstance(user_id, int):
        return json_error("user_id must be int")
    if not exercise:
        return json_error("exercise is required")
    try:
        weight = float(best_weight)
    except (TypeError, ValueError):
        return json_error("best_weight must be number")
    if weight <= 0:
        return json_error("best_weight must be > 0")
    try:
        workout_date = parse_record_date(raw_workout_date) or date.today().isoformat()
    except ValueError:
        return json_error("workout_date must be YYYY-MM-DD or DD.MM.YYYY")
    if not started_user_exists(user_id):
        return json_error("user not found", status=404)

    # Save records as dedicated rows so regular workouts do not appear in the Records screen.
    add_workout(
        user_id=user_id,
        workout_date=workout_date,
        exercise=exercise,
        weight=weight,
        sets=1,
        reps=1,
        is_record=True,
    )
    return web.json_response(
        {
            "ok": True,
            "record": {
                "exercise": exercise,
                "best_weight": f"{weight:.1f}",
                "date": workout_date,
            },
        }
    )


async def update_record(request: web.Request) -> web.Response:
    # Обновление рекорда реализовано как delete старой записи + insert новой.
    payload = await read_json_payload(request)
    if payload is None:
        return json_error("invalid json")

    user_id = payload.get("user_id")
    source_exercise = str(payload.get("source_exercise", payload.get("exercise", ""))).strip()
    exercise = str(payload.get("exercise", source_exercise)).strip()
    best_weight = payload.get("best_weight")
    raw_source_workout_date = payload.get("source_workout_date", payload.get("source_date", ""))
    raw_workout_date = payload.get("workout_date", payload.get("date", ""))

    if not isinstance(user_id, int):
        return json_error("user_id must be int")
    if not source_exercise:
        return json_error("source_exercise is required")
    if not exercise:
        return json_error("exercise is required")
    try:
        weight = float(best_weight)
    except (TypeError, ValueError):
        return json_error("best_weight must be number")
    if weight <= 0:
        return json_error("best_weight must be > 0")
    try:
        source_workout_date = parse_record_date(raw_source_workout_date)
        workout_date = parse_record_date(raw_workout_date) or source_workout_date or date.today().isoformat()
    except ValueError:
        return json_error("workout_date must be YYYY-MM-DD or DD.MM.YYYY")
    if not started_user_exists(user_id):
        return json_error("user not found", status=404)

    with get_connection() as connection:
        cursor = connection.cursor()
        if source_workout_date:
            cursor.execute(
                """
                DELETE FROM workouts
                WHERE user_id = ?
                  AND is_record = 1
                  AND TRIM(exercise) = TRIM(?) COLLATE NOCASE
                  AND workout_date = ?
                """,
                (user_id, source_exercise, source_workout_date),
            )
        else:
            cursor.execute(
                """
                DELETE FROM workouts
                WHERE user_id = ?
                  AND is_record = 1
                  AND TRIM(exercise) = TRIM(?) COLLATE NOCASE
                """,
                (user_id, source_exercise),
            )

        deleted = cursor.rowcount
        if deleted == 0:
            connection.rollback()
            return json_error("record not found", status=404)

        cursor.execute(
            """
            INSERT INTO workouts (
                user_id, workout_date, exercise, weight, sets, reps, is_record, workout_name, wellbeing_note, session_key
            )
            VALUES (?, ?, ?, ?, 1, 1, 1, NULL, NULL, NULL)
            """,
            (user_id, workout_date, exercise, weight),
        )
        connection.commit()

    return web.json_response(
        {
            "ok": True,
            "record": {
                "exercise": exercise,
                "best_weight": f"{weight:.1f}",
                "date": workout_date,
            },
        }
    )


async def delete_record(request: web.Request) -> web.Response:
    # Для совместимости удаление рекорда поддерживает и query-параметры, и JSON-body.
    payload = await read_json_payload(request) or {}

    user_id = payload.get("user_id")
    if user_id is None:
        query_user_id = request.query.get("user_id", "").strip()
        if query_user_id.isdigit():
            user_id = int(query_user_id)

    exercise = str(payload.get("exercise", "")).strip()
    if not exercise:
        exercise = request.query.get("exercise", "").strip()

    if not isinstance(user_id, int):
        return json_error("user_id must be int")
    if not exercise:
        return json_error("exercise is required")
    if not started_user_exists(user_id):
        return json_error("user not found", status=404)

    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            DELETE FROM workouts
            WHERE user_id = ? AND TRIM(exercise) = TRIM(?) COLLATE NOCASE AND is_record = 1
            """,
            (user_id, exercise),
        )
        deleted = cursor.rowcount
        connection.commit()

    if deleted == 0:
        return json_error("record not found", status=404)

    return web.json_response({"ok": True, "deleted": int(deleted)})


def create_web_app() -> web.Application:
    # Здесь собирается весь aiohttp-app: middleware, lifecycle hooks и публичные роуты mini-app.
    app = web.Application(middlewares=[no_cache_static_middleware])
    app.router.add_get("/", index)
    app.router.add_get("/app", index)
    app.router.add_get("/api/app-data", app_data)
    app.router.add_get("/api/faq", faq_data)
    app.router.add_put("/api/profile", update_profile)
    app.router.add_delete("/api/profile", clear_profile_data)
    app.router.add_put("/api/custom-quotes", update_custom_quotes)
    app.router.add_post("/api/workouts", save_workout)
    app.router.add_put("/api/workouts", update_workout)
    app.router.add_delete("/api/workouts", delete_workout)
    app.router.add_delete("/api/workouts/all", delete_all_workouts)
    app.router.add_post("/api/records", save_record)
    app.router.add_put("/api/records", update_record)
    app.router.add_delete("/api/records", delete_record)
    app.router.add_static("/static/", STATIC_DIR, show_index=False)
    return app


def parse_user_id(request: web.Request) -> int | None:
    raw_value = request.query.get("user_id", "").strip()
    if not raw_value.isdigit():
        return None
    return int(raw_value)


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
