"""Сборка FastAPI backend для Telegram Mini App."""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from webapp.routes.app_data import router as app_router
from webapp.routes.profile import router as profile_router
from webapp.routes.quotes import router as quotes_router
from webapp.routes.records import router as records_router
from webapp.routes.workouts import router as workouts_router


BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"


def create_web_app() -> FastAPI:
    app = FastAPI(title="ProgressCheck API")

    @app.middleware("http")
    async def cache_control_middleware(request: Request, call_next):
        response = await call_next(request)
        if request.url.path in {"/", "/app"}:
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        elif request.url.path.startswith("/static/"):
            response.headers["Cache-Control"] = "public, max-age=604800, immutable"
            if "Pragma" in response.headers:
                del response.headers["Pragma"]
            if "Expires" in response.headers:
                del response.headers["Expires"]
        return response

    @app.get("/", include_in_schema=False)
    async def index():
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/app", include_in_schema=False)
    async def app_index():
        return FileResponse(STATIC_DIR / "index.html")

    app.include_router(app_router)
    app.include_router(profile_router)
    app.include_router(quotes_router)
    app.include_router(records_router)
    app.include_router(workouts_router)
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
    return app
