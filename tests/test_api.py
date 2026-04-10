"""Критические API-тесты Mini App backend."""

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from fastapi.testclient import TestClient

import bot.db as db_module
from bot.db import (
    add_workout,
    get_connection,
    set_ai_history,
    set_ai_mode,
    init_db,
    upsert_custom_quotes,
    upsert_started_user,
    upsert_user,
)
from webapp.server import create_web_app


class ProgressCheckApiTests(unittest.TestCase):
    def setUp(self):
        self.tmpdir = TemporaryDirectory()
        self.original_db_path = db_module.DB_PATH
        db_module.DB_PATH = Path(self.tmpdir.name) / "test.db"
        init_db()

        upsert_started_user(
            user_id=101,
            username="tester",
            full_name="Test User",
        )
        upsert_user(
            user_id=101,
            name="Тестер",
            age=23,
            weight=81.5,
            height=182,
            experience="2 года",
        )

        self.client = TestClient(create_web_app())

    def tearDown(self):
        self.client.close()
        db_module.DB_PATH = self.original_db_path
        self.tmpdir.cleanup()

    def test_app_data_returns_profile_history_records_and_quotes(self):
        add_workout(
            user_id=101,
            workout_date="2026-04-09",
            exercise="Жим лежа",
            weight=100,
            sets=4,
            reps=6,
            workout_name="Грудь",
            wellbeing_note="Отлично",
            session_key="session-1",
        )
        add_workout(
            user_id=101,
            workout_date="2026-04-09",
            exercise="Разводка",
            weight=18,
            sets=3,
            reps=12,
            workout_name="Грудь",
            wellbeing_note="Отлично",
            session_key="session-1",
        )
        add_workout(
            user_id=101,
            workout_date="2026-04-08",
            exercise="Жим лежа",
            weight=110,
            sets=1,
            reps=1,
            is_record=True,
        )
        upsert_custom_quotes(
            101,
            '[{"text":"Discipline wins","author":"Coach"}]',
        )

        response = self.client.get("/api/app-data", params={"user_id": 101})
        self.assertEqual(response.status_code, 200)
        payload = response.json()

        self.assertTrue(payload["ready"])
        self.assertEqual(payload["user"]["name"], "Тестер")
        self.assertEqual(payload["user"]["workout_days"], 1)
        self.assertEqual(len(payload["history"]), 1)
        self.assertEqual(payload["history"][0]["workout_name"], "Грудь")
        self.assertEqual(len(payload["history"][0]["exercises"]), 2)
        self.assertEqual(len(payload["records"]), 1)
        self.assertEqual(payload["records"][0]["exercise"], "Жим лежа")
        self.assertEqual(payload["custom_quotes"][0]["author"], "Coach")
        self.assertIn("technique", payload["faq"])

    def test_create_and_update_workout(self):
        create_response = self.client.post(
            "/api/workouts",
            json={
                "user_id": 101,
                "workout_date": "2026-04-09",
                "workout_name": "Спина",
                "wellbeing_note": "Тяжело, но хорошо",
                "exercises": [
                    {"exercise": "Тяга штанги", "weight": 80, "sets": 4, "reps": 8},
                    {"exercise": "Тяга блока", "weight": 55, "sets": 3, "reps": 10},
                ],
            },
        )
        self.assertEqual(create_response.status_code, 200)
        self.assertTrue(create_response.json()["ok"])

        initial_payload = self.client.get("/api/app-data", params={"user_id": 101}).json()
        self.assertEqual(len(initial_payload["history"]), 1)
        session_key = initial_payload["history"][0]["session_key"]
        self.assertTrue(session_key)

        update_response = self.client.put(
            "/api/workouts",
            json={
                "user_id": 101,
                "source_workout_date": "2026-04-09",
                "source_session_key": session_key,
                "session_key": session_key,
                "workout_date": "2026-04-10",
                "workout_name": "Спина v2",
                "wellbeing_note": "Стало легче",
                "exercises": [
                    {"exercise": "Тяга штанги", "weight": 85, "sets": 4, "reps": 8},
                ],
            },
        )
        self.assertEqual(update_response.status_code, 200)
        self.assertTrue(update_response.json()["ok"])

        updated_payload = self.client.get("/api/app-data", params={"user_id": 101}).json()
        self.assertEqual(len(updated_payload["history"]), 1)
        self.assertEqual(updated_payload["history"][0]["date"], "2026-04-10")
        self.assertEqual(updated_payload["history"][0]["workout_name"], "Спина v2")
        self.assertEqual(updated_payload["history"][0]["note"], "Стало легче")
        self.assertEqual(len(updated_payload["history"][0]["exercises"]), 1)
        self.assertEqual(updated_payload["history"][0]["exercises"][0]["weight"], "85.0")

    def test_delete_record(self):
        save_response = self.client.post(
            "/api/records",
            json={
                "user_id": 101,
                "exercise": "Присед",
                "best_weight": 140,
                "workout_date": "2026-04-09",
            },
        )
        self.assertEqual(save_response.status_code, 200)
        self.assertTrue(save_response.json()["ok"])

        delete_response = self.client.request(
            "DELETE",
            "/api/records",
            json={"user_id": 101, "exercise": "Присед"},
        )
        self.assertEqual(delete_response.status_code, 200)
        self.assertTrue(delete_response.json()["ok"])

        payload = self.client.get("/api/app-data", params={"user_id": 101}).json()
        self.assertEqual(payload["records"], [])

    def test_clear_profile_removes_profile_workouts_and_quotes(self):
        add_workout(
            user_id=101,
            workout_date="2026-04-09",
            exercise="Жим стоя",
            weight=60,
            sets=3,
            reps=8,
            session_key="session-clear",
        )
        upsert_custom_quotes(
            101,
            '[{"text":"Stay hard","author":"David"}]',
        )
        set_ai_mode(101, True)
        set_ai_history(
            101,
            [
                {"role": "user", "content": "Как лучше жать?"},
                {"role": "assistant", "content": "Следи за лопатками."},
            ],
        )

        response = self.client.request(
            "DELETE",
            "/api/profile",
            json={"user_id": 101},
        )
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["ok"])

        with get_connection() as connection:
            cursor = connection.cursor()
            cursor.execute("SELECT COUNT(*) AS total FROM users WHERE user_id = 101")
            self.assertEqual(int(cursor.fetchone()["total"]), 0)
            cursor.execute("SELECT COUNT(*) AS total FROM workouts WHERE user_id = 101")
            self.assertEqual(int(cursor.fetchone()["total"]), 0)
            cursor.execute("SELECT COUNT(*) AS total FROM custom_quotes WHERE user_id = 101")
            self.assertEqual(int(cursor.fetchone()["total"]), 0)
            cursor.execute("SELECT COUNT(*) AS total FROM ai_chat_sessions WHERE user_id = 101")
            self.assertEqual(int(cursor.fetchone()["total"]), 0)


if __name__ == "__main__":
    unittest.main()
