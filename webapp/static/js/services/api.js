/*
 * Тонкий слой общения с backend API.
 * Модуль прячет детали fetch, JSON-парсинга и единообразной обработки ошибок,
 * а наружу отдаёт именованные операции предметной области:
 * загрузить app-data, сохранить тренировку, удалить рекорд, обновить профиль.
 */
async function parseJsonSafely(response) {
  return response.json().catch(() => ({}));
}

const APP_DATA_REQUEST_TIMEOUT_MS = 4500;
const APP_DATA_RETRY_ATTEMPTS = 2;
const APP_DATA_RETRY_DELAY_MS = 350;

// Внутренние хелперы для унифицированной работы с JSON-ответами backend.
async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await parseJsonSafely(response);
  return { response, payload };
}

async function fetchWithTimeout(url, options = {}, timeoutMs = APP_DATA_REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("request timeout");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function delay(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

async function expectOkJson(url, options = {}, fallbackMessage = "request failed") {
  const { response, payload } = await requestJson(url, options);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || fallbackMessage);
  }
  return payload;
}

export async function fetchAppData(userId) {
  let lastError = null;

  for (let attempt = 1; attempt <= APP_DATA_RETRY_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetchWithTimeout(
        `/api/app-data?user_id=${encodeURIComponent(userId)}`,
        {},
        APP_DATA_REQUEST_TIMEOUT_MS
      );

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
    } catch (error) {
      lastError = error;
      if (attempt >= APP_DATA_RETRY_ATTEMPTS) {
        break;
      }
      await delay(APP_DATA_RETRY_DELAY_MS * attempt);
    }
  }

  throw lastError || new Error("app-data request failed");
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

export function updateCustomQuotes(payload) {
  return expectOkJson(
    "/api/custom-quotes",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "failed to save custom quotes"
  );
}
