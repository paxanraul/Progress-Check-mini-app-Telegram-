const telegram = window.Telegram?.WebApp;
if (telegram) {
  telegram.ready();
  telegram.expand();
}

const state = {
  activeTab: "home",
  faqCategory: "technique",
  faqQuery: "",
  payload: null,
};

const navButtons = [...document.querySelectorAll(".nav-btn")];
const panels = [...document.querySelectorAll(".panel")];
const quickButtons = [...document.querySelectorAll("[data-tab-target]")];
const faqTabs = document.getElementById("faq-tabs");
const faqList = document.getElementById("faq-list");
const faqSearch = document.getElementById("faq-search");

quickButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tabTarget));
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

faqSearch.addEventListener("input", (event) => {
  state.faqQuery = event.target.value.trim().toLowerCase();
  renderFaq();
});

bootstrap().catch((error) => {
  console.error(error);
  showToast("Не удалось загрузить Mini App");
});

async function bootstrap() {
  const userId = resolveUserId();
  if (!userId) {
    showToast("Не удалось определить пользователя");
    return;
  }

  const response = await fetch(`/api/app-data?user_id=${encodeURIComponent(userId)}`);
  const payload = await response.json();
  state.payload = payload;

  if (!payload.ready) {
    document.getElementById("profile-note").textContent = payload.message || "Данные пока недоступны.";
    document.getElementById("profile-name").textContent = "Нет данных";
    switchTab("more");
    return;
  }

  renderProfile(payload.user);
  renderHistory(payload.history);
  renderRecords(payload.records);
  renderFaqTabs(payload.faq);
  renderFaq();
}

function resolveUserId() {
  const params = new URLSearchParams(window.location.search);
  const queryUserId = params.get("user_id");
  if (queryUserId) {
    return queryUserId;
  }

  const tgUserId = telegram?.initDataUnsafe?.user?.id;
  return tgUserId ? String(tgUserId) : "";
}

function renderProfile(user) {
  document.getElementById("screen-title").textContent = "Мой прогресс";
  document.getElementById("avatar-badge").textContent = (user.name || "M").trim().charAt(0).toUpperCase();
  document.getElementById("profile-name").textContent = user.name || "Пользователь";
  document.getElementById("profile-note").textContent = "Панель собрана на данных из твоего бота.";
  document.getElementById("weight-value").textContent = user.weight ? `${user.weight} кг` : "—";
  document.getElementById("height-value").textContent = user.height ? `${user.height} см` : "—";
  document.getElementById("experience-value").textContent = user.experience || "—";
  document.getElementById("workouts-value").textContent = String(user.workout_days ?? 0);
}

function renderHistory(history) {
  const root = document.getElementById("history-list");
  root.innerHTML = "";

  if (!history.length) {
    root.innerHTML = `<div class="empty-card"><p>Пока нет тренировок. Добавь первую в боте.</p></div>`;
    return;
  }

  history.forEach((day) => {
    const exerciseItems = day.exercises
      .map(
        (item) => `
          <div class="exercise-line">
            <span>${escapeHtml(item.exercise)}</span>
            <span>${item.weight} кг x ${item.reps}</span>
          </div>
        `
      )
      .join("");

    root.insertAdjacentHTML(
      "beforeend",
      `
        <article class="entry-card">
          <div class="entry-date">
            <strong>${formatDate(day.date)}</strong>
            <span class="muted">${day.exercises.length} упр.</span>
          </div>
          <div class="exercise-list">${exerciseItems}</div>
        </article>
      `
    );
  });
}

function renderRecords(records) {
  const root = document.getElementById("records-list");
  root.innerHTML = "";

  if (!records.length) {
    root.innerHTML = `<div class="empty-card"><p>Рекордов пока нет. Сначала сохрани тренировки в боте.</p></div>`;
    return;
  }

  records.forEach((record) => {
    root.insertAdjacentHTML(
      "beforeend",
      `
        <article class="record-card">
          <div>
            <p class="muted">🏆 Личный рекорд</p>
            <div class="record-title">
              <strong>${escapeHtml(record.exercise)}</strong>
            </div>
            <p>${record.best_weight} кг</p>
          </div>
          <div class="record-badge"></div>
        </article>
      `
    );
  });
}

function renderFaqTabs(faqData) {
  faqTabs.innerHTML = "";
  Object.keys(faqData).forEach((key) => {
    const button = document.createElement("button");
    button.className = `chip${key === state.faqCategory ? " active" : ""}`;
    button.textContent = faqTitle(key);
    button.addEventListener("click", () => {
      state.faqCategory = key;
      [...faqTabs.children].forEach((node) => node.classList.remove("active"));
      button.classList.add("active");
      renderFaq();
    });
    faqTabs.appendChild(button);
  });
}

function renderFaq() {
  const faqData = state.payload?.faq || {};
  const items = faqData[state.faqCategory] || [];
  const filtered = items.filter((item) => {
    if (!state.faqQuery) {
      return true;
    }
    const fullText = `${item.question} ${item.answer}`.toLowerCase();
    return fullText.includes(state.faqQuery);
  });

  faqList.innerHTML = "";
  if (!filtered.length) {
    faqList.innerHTML = `<div class="empty-card"><p>Ничего не найдено.</p></div>`;
    return;
  }

  filtered.forEach((item, index) => {
    faqList.insertAdjacentHTML(
      "beforeend",
      `
        <details class="faq-card"${index === 0 ? " open" : ""}>
          <summary>${escapeHtml(item.question)}</summary>
          <p>${escapeHtml(item.answer)}</p>
        </details>
      `
    );
  });
}

function switchTab(tab) {
  state.activeTab = tab;
  navButtons.forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
  document.getElementById("screen-title").textContent = titleForTab(tab);
}

function titleForTab(tab) {
  if (tab === "records") return "Рекорды";
  if (tab === "faq") return "Вопросы";
  if (tab === "more") return "Профиль";
  return "Мой прогресс";
}

function faqTitle(key) {
  if (key === "nutrition") return "Питание";
  if (key === "programs") return "Программы";
  if (key === "recovery") return "Восстановление";
  return "Техника";
}

function formatDate(value) {
  const parts = value.split("-");
  if (parts.length !== 3) {
    return value;
  }
  return `${parts[2]}.${parts[1]}.${parts[0].slice(-2)}`;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2600);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
