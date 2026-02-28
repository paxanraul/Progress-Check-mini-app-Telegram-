import json
from pathlib import Path

from aiohttp import web

from bot.db import (
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
        exercises = []
        raw = row["exercises"] or ""
        for chunk in raw.split("||"):
            if not chunk:
                continue
            exercise, weight, reps = chunk.split("|")
            exercises.append(
                {
                    "exercise": exercise,
                    "weight": f"{float(weight):.1f}",
                    "reps": int(reps),
                }
            )
        history_payload.append({"date": row["workout_date"], "exercises": exercises})

    records_payload = [
        {"exercise": row["exercise"], "best_weight": f"{float(row['best_weight']):.1f}"}
        for row in get_records(user_id)
    ]

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


async def faq_data(request: web.Request) -> web.Response:
    return web.json_response({"faq": FAQ_DATA})


def create_web_app() -> web.Application:
    app = web.Application()
    app.router.add_get("/", index)
    app.router.add_get("/app", index)
    app.router.add_get("/api/app-data", app_data)
    app.router.add_get("/api/faq", faq_data)
    app.router.add_static("/static/", STATIC_DIR, show_index=False)
    return app


def parse_user_id(request: web.Request) -> int | None:
    raw_value = request.query.get("user_id", "").strip()
    if not raw_value.isdigit():
        return None
    return int(raw_value)
