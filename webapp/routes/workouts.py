"""Роуты истории тренировок."""

from uuid import uuid4

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from bot.db import add_workout, get_connection
from webapp.schemas import WorkoutCreatePayload, WorkoutDeletePayload, WorkoutUpdatePayload
from webapp.services import collect_valid_exercises, delete_workout_rows, started_user_exists


router = APIRouter(tags=["workouts"])


def json_error(message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


@router.post("/api/workouts")
async def save_workout(payload: WorkoutCreatePayload):
    if not payload.workout_date:
        return json_error("workout_date is required")
    if not payload.exercises:
        return json_error("exercises must be a non-empty list")
    if not started_user_exists(payload.user_id):
        return json_error("user not found", status=404)

    session_key = uuid4().hex
    valid_exercises = collect_valid_exercises([item.model_dump() for item in payload.exercises])
    for item in valid_exercises:
        add_workout(
            user_id=payload.user_id,
            workout_date=payload.workout_date,
            exercise=str(item["exercise"]),
            weight=float(item["weight"]),
            sets=int(item["sets"]),
            reps=int(item["reps"]),
            is_record=False,
            workout_name=payload.workout_name or None,
            wellbeing_note=payload.wellbeing_note or None,
            session_key=session_key,
        )

    if not valid_exercises:
        return json_error("no valid exercises to save")

    return {"ok": True, "saved": len(valid_exercises)}


@router.put("/api/workouts")
async def update_workout(payload: WorkoutUpdatePayload):
    if not payload.source_workout_date and not payload.source_session_key:
        return json_error("source_workout_date or source_session_key is required")
    if not payload.workout_date:
        return json_error("workout_date is required")
    if not payload.exercises:
        return json_error("exercises must be a non-empty list")
    if not started_user_exists(payload.user_id):
        return json_error("user not found", status=404)

    valid_exercises = collect_valid_exercises([item.model_dump() for item in payload.exercises])
    if not valid_exercises:
        return json_error("no valid exercises to save")

    target_session_key = payload.session_key or payload.source_session_key or uuid4().hex

    with get_connection() as connection:
        cursor = connection.cursor()
        deleted = delete_workout_rows(
            cursor,
            user_id=payload.user_id,
            workout_date=payload.source_workout_date,
            session_key=payload.source_session_key,
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
                    payload.user_id,
                    payload.workout_date,
                    item["exercise"],
                    float(item["weight"]),
                    int(item["sets"]),
                    int(item["reps"]),
                    payload.workout_name or None,
                    payload.wellbeing_note or None,
                    target_session_key,
                ),
            )
        connection.commit()

    return {"ok": True, "saved": len(valid_exercises)}


@router.delete("/api/workouts")
async def delete_workout(payload: WorkoutDeletePayload):
    if not payload.workout_date and not payload.session_key:
        return json_error("workout_date or session_key is required")
    if not started_user_exists(payload.user_id):
        return json_error("user not found", status=404)

    with get_connection() as connection:
        cursor = connection.cursor()
        deleted = delete_workout_rows(
            cursor,
            user_id=payload.user_id,
            workout_date=payload.workout_date,
            session_key=payload.session_key,
        )
        connection.commit()

    if deleted == 0:
        return json_error("workout not found", status=404)

    return {"ok": True, "deleted": int(deleted)}


@router.delete("/api/workouts/all")
async def delete_all_workouts(payload: WorkoutDeletePayload):
    if not started_user_exists(payload.user_id):
        return json_error("user not found", status=404)

    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.execute(
            """
            DELETE FROM workouts
            WHERE user_id = ? AND is_record = 0
            """,
            (payload.user_id,),
        )
        deleted = cursor.rowcount
        connection.commit()

    return {"ok": True, "deleted": int(deleted)}
