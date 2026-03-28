/*
 * Локальное клиентское хранилище mini-app.
 * Сейчас здесь сохраняются только пользовательские цитаты,
 * чтобы персонализация переживала перезагрузку страницы без участия backend.
 */
import { MAX_CUSTOM_QUOTES } from "../core/constants.js";

function normalizeCustomQuotes(items) {
  if (typeof items === "string") {
    return normalizeCustomQuotes([{ text: items }]);
  }
  if (items && typeof items === "object" && !Array.isArray(items)) {
    return normalizeCustomQuotes([items]);
  }
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => {
      if (typeof item === "string") {
        const text = item.trim();
        return text ? { text: text.slice(0, 240), author: "" } : null;
      }
      if (!item || typeof item !== "object") {
        return null;
      }

      const text = String(item.text || "").trim();
      const author = String(item.author || "").trim();
      if (!text) {
        return null;
      }

      return {
        text: text.slice(0, 240),
        author: author.slice(0, 80),
      };
    })
    .filter(Boolean)
    .slice(0, MAX_CUSTOM_QUOTES);
}

function customQuotesStorageKey(userId) {
  return `custom_quotes:${userId || "unknown"}`;
}

// Чтение и запись пользовательских цитат.
export function loadCustomQuotes(userId) {
  try {
    const raw = localStorage.getItem(customQuotesStorageKey(userId));
    if (!raw) {
      return [];
    }
    return normalizeCustomQuotes(JSON.parse(raw));
  } catch (error) {
    try {
      const raw = localStorage.getItem(customQuotesStorageKey(userId));
      return raw ? normalizeCustomQuotes(raw) : [];
    } catch (nestedError) {
      return [];
    }
  }
}

export function persistCustomQuotes(userId, quotes) {
  const normalized = normalizeCustomQuotes(quotes);
  try {
    localStorage.setItem(customQuotesStorageKey(userId), JSON.stringify(normalized));
  } catch (error) {
    console.warn("custom quotes storage failed", error);
  }
  return normalized;
}
