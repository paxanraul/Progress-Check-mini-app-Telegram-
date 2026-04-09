"""Роуты профиля пользователя."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from bot.db import get_connection, get_started_user, get_user, upsert_user
from webapp.schemas import ApiOkResponse, ProfileUpdatePayload, UserIdPayload
from webapp.services import started_user_exists


router = APIRouter(tags=["profile"])


def json_error(message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


@router.put("/api/profile", response_model=ApiOkResponse)
async def update_profile(payload: ProfileUpdatePayload):
    if not payload.name:
        return json_error("name is required")
    if payload.weight <= 0 or payload.height <= 0:
        return json_error("weight and height must be > 0")

    started_user = get_started_user(payload.user_id)
    if not started_user:
        return json_error("user not found", status=404)

    current_profile = get_user(payload.user_id)
    age = int(current_profile["age"]) if current_profile and current_profile["age"] is not None else 0

    upsert_user(
        user_id=payload.user_id,
        name=payload.name,
        age=age,
        weight=payload.weight,
        height=payload.height,
        experience=payload.experience or "Не заполнено",
    )
    return {"ok": True}


@router.delete("/api/profile", response_model=ApiOkResponse)
async def clear_profile_data(payload: UserIdPayload):
    if not started_user_exists(payload.user_id):
        return json_error("user not found", status=404)

    with get_connection() as connection:
        cursor = connection.cursor()
        cursor.execute("DELETE FROM workouts WHERE user_id = ?", (payload.user_id,))
        cursor.execute("DELETE FROM users WHERE user_id = ?", (payload.user_id,))
        cursor.execute("DELETE FROM custom_quotes WHERE user_id = ?", (payload.user_id,))
        connection.commit()

    return {"ok": True}
