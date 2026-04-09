"""Роуты bootstrap-данных Mini App."""

from fastapi import APIRouter

from webapp.schemas import AppDataResponse
from webapp.services import FAQ_DATA, build_app_data_payload


router = APIRouter(tags=["app"])


@router.get("/api/app-data", response_model=AppDataResponse)
async def app_data(user_id: int):
    return build_app_data_payload(user_id)


@router.get("/api/faq")
async def faq_data():
    return {"faq": FAQ_DATA}
