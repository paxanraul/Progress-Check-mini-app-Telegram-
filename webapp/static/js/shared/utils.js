/*
 * Общие утилиты, которые переиспользуются несколькими экранами и модалками.
 * Здесь собраны маленькие функции без привязки к конкретному сценарию:
 * форматирование дат, экранирование HTML, сохранение scroll-позиции
 * и обработка long-press для мобильных жестов.
 */
export function todayValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(value) {
  if (!value) {
    return "сегодня";
  }

  const parts = String(value).split("-");
  if (parts.length !== 3) {
    return String(value);
  }

  return `${parts[2]}.${parts[1]}.${parts[0].slice(-2)}`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function decodeHtml(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

// HTML-заглушка для пустых состояний списков.
export function emptyCard(text) {
  return `<div class="history-card empty-card"><div class="history-main empty-card-text">${escapeHtml(text)}</div></div>`;
}

export function escapeSelectorValue(value) {
  if (window.CSS?.escape) {
    return window.CSS.escape(String(value));
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

export function preserveElementScroll(element, callback) {
  const previousScrollTop = element ? element.scrollTop : 0;
  callback();
  if (element) {
    requestAnimationFrame(() => {
      element.scrollTop = previousScrollTop;
    });
  }
}

export function trainingDayTitle(index) {
  const names = ["День груди", "День спины", "День ног", "День плеч"];
  return names[index % names.length];
}

export function faqTitle(key) {
  if (key === "nutrition") {
    return "Питание";
  }
  if (key === "programs") {
    return "Программы";
  }
  if (key === "recovery") {
    return "Восстановление";
  }
  return "Техника";
}

// Универсальный long-press нужен для быстрых мобильных действий без отдельной кнопки.
export function attachLongPress(node, durationMs, onLongPress) {
  if (!node) {
    return;
  }

  let timerId = null;
  let startX = 0;
  let startY = 0;
  let longPressed = false;

  const clearTimer = () => {
    if (timerId) {
      clearTimeout(timerId);
      timerId = null;
    }
  };

  node.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    startY = event.clientY;
    longPressed = false;
    clearTimer();
    timerId = setTimeout(() => {
      longPressed = true;
      onLongPress();
    }, durationMs);
  });

  node.addEventListener("pointermove", (event) => {
    const deltaX = Math.abs(event.clientX - startX);
    const deltaY = Math.abs(event.clientY - startY);
    if (deltaX > 8 || deltaY > 8) {
      clearTimer();
    }
  });

  node.addEventListener("pointerup", clearTimer);
  node.addEventListener("pointercancel", clearTimer);
  node.addEventListener("pointerleave", clearTimer);

  node.addEventListener("click", (event) => {
    if (!longPressed) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    longPressed = false;
  });
}
