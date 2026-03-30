import asyncio
import os
from pathlib import Path

from aiohttp import web
from aiogram import Bot, Dispatcher
from aiogram.types import BotCommand, MenuButtonCommands
from dotenv import load_dotenv

from bot.db import init_db
from bot.handlers import FEEDBACK_COMMAND, router
from webapp.server import create_web_app


async def configure_bot_menu(bot: Bot) -> None:
    await bot.set_my_commands(
        [
            BotCommand(command="start", description="Открыть главное меню"),
            BotCommand(command=FEEDBACK_COMMAND, description="Открыть ссылку на опрос"),
        ]
    )
    await bot.set_chat_menu_button(menu_button=MenuButtonCommands())


async def main():
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

    web_app = create_web_app()
    web_runner = web.AppRunner(web_app)
    await web_runner.setup()

    host = os.getenv("WEBAPP_HOST", "127.0.0.1")
    port = int(os.getenv("WEBAPP_PORT", "8080"))
    web_site = web.TCPSite(web_runner, host=host, port=port)
    await web_site.start()

    try:
        await dp.start_polling(bot)
    finally:
        await web_runner.cleanup()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Бот остановлен")
