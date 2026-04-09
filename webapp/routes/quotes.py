"""Роуты пользовательских цитат."""

import json

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from bot.db import upsert_custom_quotes
from webapp.schemas import QuotesUpdatePayload
from webapp.services import normalize_custom_quotes, started_user_exists


router = APIRouter(tags=["quotes"])


def json_error(message: str, status: int = 400) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status)


@router.put("/api/custom-quotes")
async def update_custom_quotes(payload: QuotesUpdatePayload):
    if not started_user_exists(payload.user_id):
        return json_error("user not found", status=404)

    quotes = normalize_custom_quotes([item.model_dump() for item in payload.quotes])
    upsert_custom_quotes(payload.user_id, json.dumps(quotes, ensure_ascii=False))
    return {"ok": True, "quotes": quotes}
