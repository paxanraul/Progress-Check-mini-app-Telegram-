from pathlib import Path
from datetime import date
from uuid import uuid4

from aiohttp import web

from bot.db import (
    add_workout,
    get_connection,
    get_records,
    get_started_user,
    get_total_workout_days,
    get_user,
    get_workout_days,
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


async def index(request: web.Request) -> web.Response:
    return web.FileResponse(STATIC_DIR / "index.html")


async def app_data(request: web.Request) -> web.Response:
    try:
        user_id = parse_user_id(request)
        if user_id is None:
            return web.json_response({"error": "user_id is required"}, status=400)

        profile = get_user(user_id)
        started_user = get_started_user(user_id)
        if not profile and not started_user:
            return web.json_response(
                {
                    "ready": False,
                    "message": "Пользователь не найден. Сначала открой бота и нажми /start.",
                }
            )

        history_payload = []
        for row in get_workout_days(user_id, limit=8):
            row_keys = set(row.keys()) if hasattr(row, "keys") else set()

            raw = (row["exercises"] if "exercises" in row_keys else "") or ""
            workout_date = (row["workout_date"] if "workout_date" in row_keys else "") or ""
            workout_name = (row["workout_name"] if "workout_name" in row_keys else "") or ""
            wellbeing_note = (
                row["wellbeing_note"]
                if "wellbeing_note" in row_keys
                else (row["note"] if "note" in row_keys else "")
            ) or ""

            exercises = []
            if isinstance(raw, list):
                for item in raw:
                    if not isinstance(item, dict):
                        continue
                    try:
                        exercises.append(
                            {
                                "exercise": str(item.get("exercise", "")).strip(),
                                "weight": f"{float(item.get('weight', 0)):.1f}",
                                "sets": int(item.get("sets", 1)),
                                "reps": int(item.get("reps", 1)),
                            }
                        )
                    except (TypeError, ValueError):
                        continue
            else:
                raw_text = str(raw)
                for chunk in raw_text.split("||"):
                    if not chunk:
                        continue
                    parts = chunk.split("|")
                    if len(parts) != 4:
                        continue
                    exercise, weight, sets, reps = parts
                    try:
                        exercises.append(
                            {
                                "exercise": exercise,
                                "weight": f"{float(weight):.1f}",
                                "sets": int(sets),
                                "reps": int(reps),
                            }
                        )
                    except (TypeError, ValueError):
                        continue

            history_payload.append(
                {
                    "session_key": (row["session_key"] if "session_key" in row_keys else "") or "",
                    "date": workout_date,
                    "workout_name": workout_name,
                    "note": wellbeing_note,
                    "exercises": exercises,
                }
            )

        records_payload = []
        for row in get_records(user_id):
            try:
                records_payload.append(
                    {
                        "exercise": row["exercise"],
                        "best_weight": f"{float(row['best_weight']):.1f}",
                    }
                )
            except (KeyError, TypeError, ValueError):
                continue

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
            "faq": FAQ_DATA,
        }
        return web.json_response(payload)
    except Exception as error:
        return web.json_response({"error": f"app_data failed: {error}"}, status=500)


async def faq_data(request: web.Request) -> web.Response:
    return web.json_response({"faq": FAQ_DATA})


async def save_workout(request: web.Request) -> web.Response:
    try:
        payload = await request.json()
    except Exception:
        return web.json_response({"error": "invalid json"}, status=400)

    user_id = payload.get("user_id")
    workout_date = str(payload.get("workout_date", "")).strip()
    workout_name = str(payload.get("workout_name", "")).strip()
    wellbeing_note = str(payload.get("wellbeing_note", "")).strip()
    exercises = payload.get("exercises", [])

    if not isinstance(user_id, int):
        return web.json_response({"error": "user_id must be int"}, status=400)
    if not workout_date:
        return web.json_response({"error": "workout_date is required"}, status=400)
    if not isinstance(exercises, list) or not exercises:
        return web.json_response({"error": "exercises must be a non-empty list"}, status=400)

    if not get_started_user(user_id):
        return web.json_response({"error": "user not found"}, status=404)

    session_key = uuid4().hex
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
        saved += 1

    if saved == 0:
        return web.json_response({"error": "no valid exercises to save"}, status=400)

    return web.json_response({"ok": True, "saved": saved})


async def update_workout(request: web.Request) -> web.Response:
    try:
        payload = await request.json()
    except Exception:
        return web.json_response({"error": "invalid json"}, status=400)

    user_id = payload.get("user_id")
    source_workout_date = str(payload.get("source_workout_date", "")).strip()
    source_session_key = str(payload.get("source_session_key", "")).strip()
    workout_date = str(payload.get("workout_date", "")).strip()
    session_key = str(payload.get("session_key", "")).strip()
    workout_name = str(payload.get("workout_name", "")).strip()
    wellbeing_note = str(payload.get("wellbeing_note", "")).strip()
    exercises = payload.get("exercises", [])

    if not isinstance(user_id, int):
        return web.json_response({"error": "user_id must be int"}, status=400)
    if not source_workout_date and not source_session_key:
        return web.json_response({"error": "source_workout_date or source_session_key is required"}, status=400)
    if not workout_date:
        return web.json_response({"error": "workout_date is required"}, status=400)
    if not isinstance(exercises, list) or not exercises:
        return web.json_response({"error": "exercises must be a non-empty list"}, status=400)

    if not get_started_user(user_id):
        return web.json_response({"error": "user not found"}, status=404)

    valid_exercises: list[dict[str, float | int | str]] = []
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
        valid_exercises.append(
            {
                "exercise": exercise_name,
                "weight": weight,
                "sets": sets,
                "reps": reps,
            }
        )

    if not valid_exercises:
        return web.json_response({"error": "no valid exercises to save"}, status=400)

    target_session_key = session_key or source_session_key or uuid4().hex

    with get_connection() as connection:
        cursor = connection.cursor()
        if source_session_key:
            cursor.execute(
                """
                DELETE FROM workouts
                WHERE user_id = ? AND session_key = ? AND is_record = 0
                """,
                (user_id, source_session_key),
            )
            if cursor.rowcount == 0 and source_workout_date:
                cursor.execute(
                    """
                    DELETE FROM workouts
                    WHERE user_id = ? AND workout_date = ? AND is_record = 0
                    """,
                    (user_id, source_workout_date),
                )
        else:
            cursor.execute(
                """
                DELETE FROM workouts
                WHERE user_id = ? AND workout_date = ? AND is_record = 0
                """,
                (user_id, source_workout_date),
            )
        deleted = cursor.rowcount
        if deleted == 0:
            connection.rollback()
            return web.json_response({"error": "source workout not found"}, status=404)

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
    try:
        payload = await request.json()
    except Exception:
        return web.json_response({"error": "invalid json"}, status=400)

    user_id = payload.get("user_id")
    workout_date = str(payload.get("workout_date", "")).strip()
    session_key = str(payload.get("session_key", "")).strip()

    if not isinstance(user_id, int):
        return web.json_response({"error": "user_id must be int"}, status=400)
    if not workout_date and not session_key:
        return web.json_response({"error": "workout_date or session_key is required"}, status=400)

    if not get_started_user(user_id):
        return web.json_response({"error": "user not found"}, status=404)

    with get_connection() as connection:
        cursor = connection.cursor()
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
        else:
            cursor.execute(
                """
                DELETE FROM workouts
                WHERE user_id = ? AND workout_date = ? AND is_record = 0
                """,
                (user_id, workout_date),
            )
        deleted = cursor.rowcount
        connection.commit()

    if deleted == 0:
        return web.json_response({"error": "workout not found"}, status=404)

    return web.json_response({"ok": True, "deleted": int(deleted)})


async def save_record(request: web.Request) -> web.Response:
    try:
        payload = await request.json()
    except Exception:
        return web.json_response({"error": "invalid json"}, status=400)

    user_id = payload.get("user_id")
    exercise = str(payload.get("exercise", "")).strip()
    best_weight = payload.get("best_weight")

    if not isinstance(user_id, int):
        return web.json_response({"error": "user_id must be int"}, status=400)
    if not exercise:
        return web.json_response({"error": "exercise is required"}, status=400)
    try:
        weight = float(best_weight)
    except (TypeError, ValueError):
        return web.json_response({"error": "best_weight must be number"}, status=400)
    if weight <= 0:
        return web.json_response({"error": "best_weight must be > 0"}, status=400)

    if not get_started_user(user_id):
        return web.json_response({"error": "user not found"}, status=404)

    # Save records as dedicated rows so regular workouts do not appear in the Records screen.
    add_workout(
        user_id=user_id,
        workout_date=date.today().isoformat(),
        exercise=exercise,
        weight=weight,
        sets=1,
        reps=1,
        is_record=True,
    )
    return web.json_response({"ok": True})


async def delete_record(request: web.Request) -> web.Response:
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    user_id = payload.get("user_id")
    if user_id is None:
        query_user_id = request.query.get("user_id", "").strip()
        if query_user_id.isdigit():
            user_id = int(query_user_id)

    exercise = str(payload.get("exercise", "")).strip()
    if not exercise:
        exercise = request.query.get("exercise", "").strip()

    if not isinstance(user_id, int):
        return web.json_response({"error": "user_id must be int"}, status=400)
    if not exercise:
        return web.json_response({"error": "exercise is required"}, status=400)

    if not get_started_user(user_id):
        return web.json_response({"error": "user not found"}, status=404)

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
        return web.json_response({"error": "record not found"}, status=404)

    return web.json_response({"ok": True, "deleted": int(deleted)})


def create_web_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/", index)
    app.router.add_get("/app", index)
    app.router.add_get("/api/app-data", app_data)
    app.router.add_get("/api/faq", faq_data)
    app.router.add_post("/api/workouts", save_workout)
    app.router.add_put("/api/workouts", update_workout)
    app.router.add_delete("/api/workouts", delete_workout)
    app.router.add_post("/api/records", save_record)
    app.router.add_delete("/api/records", delete_record)
    app.router.add_static("/static/", STATIC_DIR, show_index=False)
    return app


def parse_user_id(request: web.Request) -> int | None:
    raw_value = request.query.get("user_id", "").strip()
    if not raw_value.isdigit():
        return None
    return int(raw_value)
