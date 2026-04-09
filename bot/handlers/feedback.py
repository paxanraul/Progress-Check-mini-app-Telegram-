"""Команды обратной связи и видео-инструкции."""

import os

from aiogram import F
from aiogram.filters import Command, StateFilter
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message

from .common import (
    DEFAULT_SURVEY_URL,
    FEEDBACK_COMMAND,
    FEEDBACK_MENU_TEXT,
    VIDEO_COMMAND,
    VIDEO_INSTRUCTION_FILE,
    router,
)


def get_feedback_survey_url() -> str:
    return os.getenv("FEEDBACK_FORM_URL", DEFAULT_SURVEY_URL).strip() or DEFAULT_SURVEY_URL


def build_feedback_text() -> str:
    return "\n\n".join(
        [
            "Помоги улучшить приложение за минуту",
            "Пройди короткий опрос по ссылке 👇",
            get_feedback_survey_url(),
        ]
    )


def build_feedback_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Пройти опрос",
                    url=get_feedback_survey_url(),
                )
            ]
        ]
    )


async def handle_feedback_request(message: Message) -> None:
    await message.answer(
        build_feedback_text(),
        reply_markup=build_feedback_keyboard(),
        disable_web_page_preview=True,
    )


router.message.register(handle_feedback_request, Command(FEEDBACK_COMMAND))
router.message.register(
    handle_feedback_request,
    StateFilter(None),
    F.text == FEEDBACK_MENU_TEXT,
)


@router.message(Command(VIDEO_COMMAND))
async def handle_video_instruction_request(message: Message) -> None:
    await message.answer_document(
        document=VIDEO_INSTRUCTION_FILE,
        caption="Видео-инструкция по боту.",
        parse_mode="Markdown",
    )
