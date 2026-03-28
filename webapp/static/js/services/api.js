/*
 * Тонкий слой общения с backend API.
 * Модуль прячет детали fetch, JSON-парсинга и единообразной обработки ошибок,
 * а наружу отдаёт именованные операции предметной области:
 * загрузить app-data, сохранить тренировку, удалить рекорд, обновить профиль.
 */
async function parseJsonSafely(response) {
  return response.json().catch(() => ({}));
}

// Внутренние хелперы для унифицированной работы с JSON-ответами backend.
async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await parseJsonSafely(response);
  return { response, payload };
}

async function expectOkJson(url, options = {}, fallbackMessage = "request failed") {
  const { response, payload } = await requestJson(url, options);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || fallbackMessage);
  }
  return payload;
}

export async function fetchAppData(userId) {
  const response = await fetch(`/api/app-data?user_id=${encodeURIComponent(userId)}`);
  if (!response.ok) {
    let message = "";
    try {
      const errorPayload = await response.json();
      message = errorPayload?.error ? `: ${errorPayload.error}` : "";
    } catch (error) {
      message = "";
    }
    throw new Error(`api/app-data ${response.status}${message}`);
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error("invalid app-data json");
  }
}

// Сценарии работы с историей тренировок.
export function saveWorkout(payload, { editMode = false } = {}) {
  return expectOkJson(
    "/api/workouts",
    {
      method: editMode ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "save failed"
  );
}

export function updateWorkout(payload) {
  return expectOkJson(
    "/api/workouts",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "update failed"
  );
}

export function deleteWorkout(payload) {
  return expectOkJson(
    "/api/workouts",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "delete failed"
  );
}

// Полная очистка истории тренировок пользователя.
export function deleteAllWorkouts(userId) {
  return expectOkJson(
    "/api/workouts/all",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: Number(userId) }),
    },
    "failed to delete all workouts"
  );
}

// Работа с рекордами.
export function createRecord(payload) {
  return expectOkJson(
    "/api/records",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "failed to save record"
  );
}

export async function deleteRecord(payload) {
  const { response, payload: result } = await requestJson("/api/records", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return Boolean(response.ok && result?.ok);
}

// Работа с профилем пользователя.
export function updateProfile(payload) {
  return expectOkJson(
    "/api/profile",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "failed to update profile"
  );
}

export function clearProfile(userId) {
  return expectOkJson(
    "/api/profile",
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: Number(userId) }),
    },
    "failed to clear profile"
  );
}
