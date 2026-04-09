"""Роуты личных рекордов."""

from datetime import date

from fastapi import APIRouter, Body, Query
from fastapi.responses import JSONResponse

from bot.db import add_workout, get_connection
from webapp.schemas import RecordCreatePayload, RecordDeletePayload, RecordUpdatePayload
from webapp.services import parse_record_date, started_user_exists


router = APIRouter(tags=["records"])


def json_error(message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


@router.post("/api/records")
async def save_record(payload: RecordCreatePayload):
    if not payload.exercise:
        return json_error("exercise is required")
    if payload.best_weight <= 0:
        return json_error("best_weight must be > 0")
    if not started_user_exists(payload.user_id):
        return json_error("user not found", status=404)

    try:
        workout_date = parse_record_date(payload.workout_date or payload.date) or date.today().isoformat()
    except ValueError:
        return json_error("workout_date must be YYYY-MM-DD or DD.MM.YYYY")

    add_workout(
        user_id=payload.user_id,
        workout_date=workout_date,
        exercise=payload.exercise,
        weight=payload.best_weight,
        sets=1,
        reps=1,
        is_record=True,
    )
    return {
        "ok": True,
        "record": {
            "exercise": payload.exercise,
            "best_weight": f"{payload.best_weight:.1f}",
            "date": workout_date,
        },
    }


@router.put("/api/records")
async def update_record(payload: RecordUpdatePayload):
    source_exercise = (payload.source_exercise or payload.exercise or "").strip()
    exercise = (payload.exercise or source_exercise).strip()

    if not source_exercise:
        return json_error("source_exercise is required")
    if not exercise:
        return json_error("exercise is required")
    if payload.best_weight <= 0:
        return json_error("best_weight must be > 0")
    if not started_user_exists(payload.user_id):
        return json_error("user not found", status=404)

    try:
        source_workout_date = parse_record_date(payload.source_workout_date or payload.source_date)
        workout_date = parse_record_date(payload.workout_date or payload.date) or source_workout_date or date.today().isoformat()
    except ValueError:
        return json_error("workout_date must be YYYY-MM-DD or DD.MM.YYYY")

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
                (payload.user_id, source_exercise, source_workout_date),
            )
        else:
            cursor.execute(
                """
                DELETE FROM workouts
                WHERE user_id = ?
                  AND is_record = 1
                  AND TRIM(exercise) = TRIM(?) COLLATE NOCASE
                """,
                (payload.user_id, source_exercise),
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
            (payload.user_id, workout_date, exercise, payload.best_weight),
        )
        connection.commit()

    return {
        "ok": True,
        "record": {
            "exercise": exercise,
            "best_weight": f"{payload.best_weight:.1f}",
            "date": workout_date,
        },
    }


@router.delete("/api/records")
async def delete_record(
    query_user_id: int | None = Query(default=None, alias="user_id"),
    query_exercise: str = Query(default="", alias="exercise"),
    payload: RecordDeletePayload | None = Body(default=None),
):
    user_id = payload.user_id if payload else query_user_id
    exercise = (payload.exercise if payload else query_exercise).strip() or query_exercise.strip()

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

    return {"ok": True, "deleted": int(deleted)}
