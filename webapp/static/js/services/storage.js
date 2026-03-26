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

function fireStateStorageKey(userId) {
  return `fire_state:${userId || "unknown"}`;
}

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

export function readFireState(userId) {
  try {
    const raw = localStorage.getItem(fireStateStorageKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    return null;
  }
}

export function writeFireState(userId, value) {
  try {
    localStorage.setItem(fireStateStorageKey(userId), JSON.stringify(value));
  } catch (error) {
    // ignore storage errors
  }
}
