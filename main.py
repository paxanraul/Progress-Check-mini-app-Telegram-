"""Точка входа backend-части проекта.

Файл поднимает сразу два процесса в одном event loop:
1) Telegram-бота на aiogram.
2) HTTP-сервер mini-app на FastAPI.
"""

import asyncio
import os
from pathlib import Path

import uvicorn
from aiogram import Bot, Dispatcher
from aiogram.types import BotCommand, MenuButtonWebApp, WebAppInfo
from dotenv import load_dotenv

from bot.db import init_db
from bot.handlers import FEEDBACK_COMMAND, VIDEO_COMMAND, router
from bot.keyboards import build_mini_app_url
from webapp.server import create_web_app


async def configure_bot_menu(bot: Bot) -> None:
    # Команды нужны для slash-меню бота, а menu button открывает mini app рядом с чатом.
    await bot.set_my_commands(
        [
            BotCommand(command="start", description="Открыть главное меню"),
            BotCommand(command=FEEDBACK_COMMAND, description="Открыть ссылку на опрос"),
            BotCommand(command=VIDEO_COMMAND, description="Открыть видео-инструкцию"),
        ]
    )
    mini_app_url = build_mini_app_url()
    if mini_app_url:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="Mini App",
                web_app=WebAppInfo(url=mini_app_url),
            )
        )


async def main():
    # Загружаем конфиг, инициализируем БД и стартуем bot + FastAPI параллельно в одном процессе.
    env_path = Path(__file__).resolve().with_name(".env")
    load_dotenv(env_path)
    token = os.getenv("BOT_TOKEN")
    if not token:
        raise RuntimeError("Неверный токен.")

    init_db()
    bot = Bot(token=token)
    dp = Dispatcher()
    dp.include_router(router)
    await bot.delete_webhook(drop_pending_updates=False)
    await configure_bot_menu(bot)

    host = os.getenv("WEBAPP_HOST", "127.0.0.1")
    port = int(os.getenv("WEBAPP_PORT", "8080"))
    web_app = create_web_app()
    web_server = uvicorn.Server(
        uvicorn.Config(
            app=web_app,
            host=host,
            port=port,
            loop="asyncio",
            lifespan="on",
            log_level="warning",
        )
    )

    server_task = asyncio.create_task(web_server.serve(), name="fastapi-server")
    polling_task = asyncio.create_task(dp.start_polling(bot), name="telegram-polling")

    try:
        done, pending = await asyncio.wait(
            {server_task, polling_task},
            return_when=asyncio.FIRST_EXCEPTION,
        )

        for task in done:
            exception = task.exception()
            if exception is not None:
                raise exception

        for task in pending:
            task.cancel()
    finally:
        web_server.should_exit = True
        await asyncio.gather(server_task, polling_task, return_exceptions=True)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Бот остановлен")
