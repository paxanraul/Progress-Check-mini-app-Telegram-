# ProgressCheck

Telegram-бот с Mini App для учёта тренировок, рекордов, профиля и цитат. Теперь проект работает только с `PostgreSQL`.

## Быстрый обзор

- Telegram-бот Mini App в одном репозитории
- backend на Python: `aiogram` + `FastAPI`
- хранение данных в `PostgreSQL`
- тренировки, рекорды, профиль, цитаты, AI-чат
- запуск `python main.py`

## Скриншоты

<table>
  <tr>
    <td align="center"><strong>Главный экран</strong><br><img src="screenshots/home-main.jpeg" alt="Главный экран" width="260"></td>
    <td align="center"><strong>История тренировок</strong><br><img src="screenshots/home-history.jpeg" alt="История тренировок" width="260"></td>
  </tr>
  <tr>
    <td align="center"><strong>Добавление тренировки</strong><br><img src="screenshots/workout-flow.jpeg" alt="Добавление тренировки" width="260"></td>
    <td align="center"><strong>Рекорды</strong><br><img src="screenshots/records.jpeg" alt="Экран рекордов" width="260"></td>
  </tr>
</table>

## Что делает

- регистрирует пользователя через `/start`;
- собирает и обновляет профиль;
- сохраняет тренировки и историю;
- хранит личные рекорды;
- поддерживает `/ai` через OpenRouter для вопросов про тренировки, зал, питание и сам бот;
- открывает Mini App для основной работы с данными;
- поддерживает FAQ, видео-инструкцию и админ-команды.

## Стек

- Python 3
- `aiogram 3`
- `FastAPI`
- `uvicorn`
- `httpx`
- `PostgreSQL`
- HTML / CSS / JavaScript
- Telegram Web App API

## Как работает

```text
Пользователь -> Telegram Bot -> handlers -> PostgreSQL
                      \
                       -> Mini App -> FastAPI -> PostgreSQL
```

- бот отвечает за команды и onboarding;
- Mini App отвечает за интерфейс;
- backend и бот работают в одном процессе.

## Структура проекта

- `main.py` — запуск бота и FastAPI-сервера Mini App.
- `bot/handlers/` — команды, FSM-анкета, FAQ и админка по отдельным модулям.
- `bot/keyboards.py` — Telegram-клавиатуры и URL Mini App.
- `bot/db.py` — схема PostgreSQL и работа с данными.
- `webapp/server.py` — сборка FastAPI-приложения и раздача Mini App.
- `webapp/routes/` — API по доменам: профиль, тренировки, рекорды, цитаты.
- `webapp/schemas.py` — Pydantic-схемы запросов и ответов.
- `webapp/services.py` — общие сервисные функции backend.
- `webapp/static/js/` — модульный runtime Mini App.
- `frontend/user-level/` — исходники виджета уровня.
- `docker-compose.yml` — локальный PostgreSQL через Docker.
- `scripts/migrate_sqlite_to_postgres.py` — одноразовый перенос данных из `gym_bot.db`.

## Установка

```bash
git clone https://github.com/paxanraul/Progress-Check-mini-app-Telegram-
cd progresscheck
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Создайте `.env`:

```env
BOT_TOKEN=your_telegram_bot_token
MINI_APP_URL=https://your-domain.example
WEBAPP_HOST=127.0.0.1
WEBAPP_PORT=8080
FEEDBACK_FORM_URL=https://your-form-url.example
ADMIN_ID=123456789
ADMIN_IDS=123456789,987654321
OPENROUTER_API_KEY=your_openrouter_api_key
OPENROUTER_MODEL=openrouter/free
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/progresscheck
```

`DATABASE_URL` обязателен. Без него приложение не запустится.

## Локальный PostgreSQL через Docker

Если Docker уже установлен, база поднимается одной командой:

```bash
docker compose up -d postgres
```

Что это делает:

- скачивает образ PostgreSQL, если его ещё нет;
- запускает контейнер `progresscheck-postgres`;
- создаёт базу `progresscheck`;
- сохраняет данные в Docker volume `postgres_data`

Проверить, что база поднялась:

```bash
docker compose ps
```

Остановить базу:

```bash
docker compose stop postgres
```

Запустить снова:

```bash
docker compose up -d postgres
```

Если нужно пересобирать виджет уровня:

```bash
npm install
```

## Запуск

```bash
python main.py
```

Если меняли `frontend/user-level`:

```bash
npm run build:user-level
```



## Тесты

Тесты теперь работают только с PostgreSQL. Для них нужен отдельный DSN:

```bash
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/progresscheck_test
python -m unittest tests.test_api
```

## Автодеплой

В репозитории есть GitHub Actions workflow для деплоя по `push` в `main`.

Нужные GitHub Secrets:

- `SERVER_HOST` — IP или домен сервера
- `SERVER_USER` — пользователь на сервере
- `SERVER_SSH_KEY` — приватный SSH-ключ для входа на сервер
- `SERVER_PORT` — порт SSH, если не `22`
- `PROJECT_PATH` — путь до проекта на сервере
- `PM2_APP_NAME` — имя процесса в PM2, по умолчанию `miniapp`

`git pull` переносит на сервер только файлы проекта из репозитория. Он не переносит данные из старого `gym_bot.db` в PostgreSQL и не создаёт Docker volume автоматически с вашими старыми данными.

Если вы закоммитите эти изменения и сделаете `git pull` на сервере, на сервере всё равно нужно отдельно:

1. Установить Docker и Docker Compose, если их ещё нет.
2. Запустить PostgreSQL:

```bash
docker compose up -d postgres
```

3. Прописать `DATABASE_URL` в серверный `.env`.
4. Если на сервере уже есть старый `gym_bot.db`, выполнить миграцию:

```bash
python scripts/migrate_sqlite_to_postgres.py --sqlite-path gym_bot.db
```

То есть код после `git pull` обновится сам, а данные нужно перенести отдельной командой один раз.

## Пример использования

Команды:

```text
Обычные:
/start
/ai
/ai_stop
/ai_clear
/feedback
/video

Админские:
/admin
/stats
/broadcast
```

Сценарий:

1. Пользователь отправляет `/start`.
2. Бот собирает профиль.
3. Пользователь открывает Mini App.
4. В Mini App добавляет тренировки и рекорды.
5. При желании использует `/ai` для вопросов по тренировкам и восстановлению.
