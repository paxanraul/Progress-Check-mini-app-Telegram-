import asyncio
import os
from pathlib import Path
from aiogram import Bot, Dispatcher
from aiogram.types import MenuButtonWebApp, WebAppInfo
from dotenv import load_dotenv
from aiohttp import web

from bot.db import init_db
from bot.handlers import router
from bot.keyboards import build_mini_app_url
from webapp.server import create_web_app


async def main():
    env_path = Path(__file__).resolve().with_name(".env")
    load_dotenv(env_path)
    token = os.getenv("BOT_TOKEN")
    if not token:
        raise RuntimeError("Set BOT_TOKEN environment variable before running the bot.")

    init_db()
    bot = Bot(token=token)
    dp = Dispatcher()
    dp.include_router(router)
    await bot.delete_webhook(drop_pending_updates=False)
    mini_app_url = build_mini_app_url()
    if mini_app_url:
        try:
            await bot.set_chat_menu_button(
                menu_button=MenuButtonWebApp(
                    text="Открыть Mini App",
                    web_app=WebAppInfo(url=mini_app_url),
                )
            )
        except Exception as error:
            print(f"Failed to configure Mini App menu button: {error}")
    else:
        print("Mini App menu button skipped: set MINI_APP_URL to a public HTTPS URL.")

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
