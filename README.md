# Progress Check

Telegram bot + Mini App для фиксации тренировок, профиля, рекордов и мотивационных цитат.

## Структура

- `main.py` — запуск бота и webapp
- `bot/handlers.py` — Telegram bot handlers и FSM-сценарии
- `bot/keyboards.py` — bot keyboards
- `bot/db.py` — SQLite-слой и SQL-запросы
- `webapp/server.py` — HTTP API и раздача mini app
- `webapp/static/index.html` — разметка mini app
- `webapp/static/app.js` — логика mini app
- `webapp/static/styles.css` — UI и responsive-стили

## Запуск

1. Создай `.env` с `BOT_TOKEN`
2. Установи зависимости:

```bash
pip install -r requirements.txt
```

3. Запусти проект:

```bash
python main.py
```

## Что хранится в базе

- `started_users` — пользователи, которые нажали `/start`
- `users` — профиль пользователя
- `workouts` — тренировки и рекорды

## Примечания по архитектуре

- Рекорды хранятся в `workouts` как записи с `is_record = 1`
- История тренировок и рекорды отдаются через `webapp/server.py`
- Quote manager в mini app хранит цитаты client-side в `localStorage`
