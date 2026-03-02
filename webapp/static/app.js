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
  userId: "",
  workoutFlow: {
    open: false,
    step: "list",
    items: [],
    draft: { sets: 1, reps: 8 },
    date: todayValue(),
    saving: false,
  },
};

const navButtons = [...document.querySelectorAll(".nav-btn")];
const panels = [...document.querySelectorAll(".panel")];
const faqTabs = document.getElementById("faq-tabs");
const faqList = document.getElementById("faq-list");
const faqSearch = document.getElementById("faq-search");
const overlay = document.getElementById("workout-overlay");
const modalSteps = [...document.querySelectorAll(".modal-step")];
const modalTitle = document.getElementById("modal-title");
const dateInput = document.getElementById("workout-date-input");

document.getElementById("back-btn").addEventListener("click", handleBackButton);
document.getElementById("forward-btn").addEventListener("click", handleForwardButton);
document.getElementById("profile-records-link").addEventListener("click", () => switchTab("records"));
document.getElementById("open-workout-flow").addEventListener("click", openWorkoutFlow);
document.getElementById("close-workout-flow").addEventListener("click", closeWorkoutFlow);
document.getElementById("add-draft-item").addEventListener("click", () => setWorkoutStep("form"));
document.getElementById("confirm-draft-item").addEventListener("click", saveDraftItem);
document.getElementById("save-workout-flow").addEventListener("click", handleSaveFlowButton);

dateInput.addEventListener("input", (event) => {
  if (!event.target.value) {
    return;
  }
  state.workoutFlow.date = event.target.value;
  renderWorkoutFlow();
});

document.querySelectorAll(".counter-btn").forEach((button) => {
  button.addEventListener("click", () => {
    const counter = button.dataset.counter;
    const direction = Number(button.dataset.direction);
    const key = counter === "sets" ? "sets" : "reps";
    const next = Math.max(1, Number(state.workoutFlow.draft[key] || 1) + direction);
    state.workoutFlow.draft[key] = next;
    renderWorkoutFlow();
  });
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
  state.userId = userId;

  const response = await fetch(`/api/app-data?user_id=${encodeURIComponent(userId)}`);
  const payload = await response.json();
  state.payload = payload;

  if (!payload.ready) {
    document.getElementById("profile-name").textContent = "Нет данных";
    document.getElementById("weight-value").textContent = "—";
    document.getElementById("height-value").textContent = "—";
    document.getElementById("experience-value").textContent = "—";
    document.getElementById("workouts-value").textContent = "0";
    document.getElementById("history-list").innerHTML = emptyCard(payload.message || "Сначала открой бота и заполни профиль.");
    document.getElementById("records-list").innerHTML = emptyCard("Рекорды появятся после первых тренировок.");
    switchTab("profile");
    return;
  }

  renderApp(payload);
}

function renderApp(payload) {
  renderProfile(payload.user);
  renderHistory(payload.history);
  renderRecords(payload.records);
  renderFaqTabs(payload.faq);
  renderFaq();
  state.workoutFlow.items = convertHistoryToDraft(payload.history[0]);
  renderWorkoutFlow();
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
  document.getElementById("profile-name").textContent = user.name || "Пользователь";
  document.getElementById("weight-value").textContent = user.weight ? `${user.weight} кг` : "—";
  document.getElementById("height-value").textContent = user.height ? `${user.height} см` : "—";
  document.getElementById("experience-value").textContent = user.experience || "—";
  document.getElementById("workouts-value").textContent = String(user.workout_days ?? 0);
  document.getElementById("streak-value").textContent = String(user.workout_days ?? 0);
}

function renderHistory(history) {
  const root = document.getElementById("history-list");
  root.innerHTML = "";

  if (!history.length) {
    root.innerHTML = emptyCard("Пока нет тренировок. Добавь первую через кнопку на главной.");
    return;
  }

  history.forEach((day, index) => {
    const title = trainingDayTitle(index);
    const rows = day.exercises
      .map(
        (item) => `
          <div class="exercise-row">
            <span>${escapeHtml(item.exercise)}</span>
            <span>${item.weight} кг · ${item.sets || 1}×${item.reps}</span>
          </div>
        `
      )
      .join("");

    root.insertAdjacentHTML(
      "beforeend",
      `
        <article class="history-card">
          <div class="history-head">
            <div class="history-main">${title}</div>
            <div class="history-date">${formatDate(day.date)}</div>
          </div>
          <div class="exercise-list">${rows}</div>
        </article>
      `
    );
  });
}

function renderRecords(records) {
  const root = document.getElementById("records-list");
  root.innerHTML = "";

  if (!records.length) {
    root.innerHTML = emptyCard("Рекордов пока нет.");
    return;
  }

  records.forEach((record, index) => {
    root.insertAdjacentHTML(
      "beforeend",
      `
        <article class="record-card${index === 0 ? " highlight" : ""}">
          <div class="record-main">
            <div>
              <div class="record-title">${escapeHtml(record.exercise)}</div>
              <div class="record-date">${record.date ? formatDate(record.date) : "последний лучший результат"}</div>
            </div>
            <div class="record-weight">${record.best_weight} кг</div>
          </div>
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
    button.type = "button";
    button.textContent = faqTitle(key);
    button.addEventListener("click", () => {
      state.faqCategory = key;
      renderFaqTabs(faqData);
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
    faqList.innerHTML = emptyCard("Ничего не найдено.");
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
  if (tab === "profile") return "Профиль";
  if (tab === "records") return "Рекорды";
  if (tab === "faq") return "Вопросы";
  return "Главная";
}

function handleBackButton() {
  if (state.activeTab === "records") {
    switchTab("profile");
    return;
  }
  if (state.activeTab === "profile") {
    switchTab("home");
    return;
  }
  if (state.activeTab === "faq") {
    switchTab("home");
  }
}

function handleForwardButton() {
  if (state.activeTab === "home") {
    switchTab("profile");
    return;
  }
  if (state.activeTab === "profile") {
    switchTab("records");
    return;
  }
  if (state.activeTab === "records") {
    switchTab("faq");
    return;
  }
  switchTab("home");
}

function openWorkoutFlow() {
  state.workoutFlow.open = true;
  state.workoutFlow.step = "list";
  state.workoutFlow.date = todayValue();
  state.workoutFlow.saving = false;
  if (!state.workoutFlow.items.length) {
    state.workoutFlow.items = [];
  }
  overlay.hidden = false;
  renderWorkoutFlow();
}

function closeWorkoutFlow() {
  state.workoutFlow.open = false;
  overlay.hidden = true;
}

function setWorkoutStep(step) {
  state.workoutFlow.step = step;
  renderWorkoutFlow();
}

function saveDraftItem() {
  const nameInput = document.getElementById("exercise-name-input");
  const weightInput = document.getElementById("exercise-weight-input");
  const name = nameInput.value.trim();
  const weight = Number(weightInput.value);

  if (!name) {
    showToast("Введи название упражнения");
    return;
  }

  state.workoutFlow.items.push({
    exercise: name,
    weight: Number.isFinite(weight) && weight > 0 ? weight.toFixed(1) : "0.0",
    sets: state.workoutFlow.draft.sets,
    reps: state.workoutFlow.draft.reps,
  });

  nameInput.value = "";
  weightInput.value = "";
  state.workoutFlow.draft = { sets: 1, reps: 8 };
  state.workoutFlow.step = "list";
  renderWorkoutFlow();
}

function handleSaveFlowButton() {
  if (state.workoutFlow.step === "list") {
    if (!state.workoutFlow.items.length) {
      showToast("Сначала добавь хотя бы одно упражнение");
      return;
    }
    state.workoutFlow.step = "date";
    renderWorkoutFlow();
    return;
  }

  if (state.workoutFlow.step === "date") {
    submitWorkoutFlow();
    return;
  }

  if (state.workoutFlow.step === "done") {
    closeWorkoutFlow();
  }
}

function renderWorkoutFlow() {
  if (!state.workoutFlow.open) {
    return;
  }

  const step = state.workoutFlow.step;
  modalSteps.forEach((node) => node.classList.toggle("active", node.dataset.step === step));
  modalTitle.textContent = workoutTitle(step);

  const saveButton = document.getElementById("save-workout-flow");
  saveButton.hidden = step === "form";
  saveButton.textContent = saveButtonLabel(step, state.workoutFlow.saving);
  saveButton.disabled = state.workoutFlow.saving;
  renderDraftList();
  document.getElementById("sets-value").textContent = String(state.workoutFlow.draft.sets);
  document.getElementById("reps-value").textContent = String(state.workoutFlow.draft.reps);
  dateInput.value = state.workoutFlow.date;
  document.getElementById("date-preview").textContent = formatDate(state.workoutFlow.date).replaceAll(".", " ");
  document.getElementById("saved-summary").textContent =
    `Сохранено упражнений: ${state.workoutFlow.items.length}. Дата: ${formatDate(state.workoutFlow.date)}.`;
}

function renderDraftList() {
  const root = document.getElementById("draft-list");
  root.innerHTML = "";

  if (!state.workoutFlow.items.length) {
    root.innerHTML = `<div class="draft-item empty">Черновик пуст. Добавь первое упражнение.</div>`;
    return;
  }

  state.workoutFlow.items.forEach((item) => {
    root.insertAdjacentHTML(
      "beforeend",
      `
        <div class="draft-item">
          <div>
            <div class="draft-title">${escapeHtml(item.exercise)}</div>
            <div class="draft-subtitle">${item.weight} кг • ${item.sets} подх. • ${item.reps} повт.</div>
          </div>
          <span class="plus">+</span>
        </div>
      `
    );
  });
}

function workoutTitle(step) {
  if (step === "form") return "Параметры упражнения";
  if (step === "date") return "Дата";
  if (step === "done") return "Сохранено";
  return "Добавить упражнения";
}

function convertHistoryToDraft(day) {
  if (!day) {
    return [];
  }
  return day.exercises.map((item) => ({
    exercise: item.exercise,
    weight: item.weight,
    sets: item.sets || 1,
    reps: item.reps,
  }));
}

function saveButtonLabel(step, saving) {
  if (saving) {
    return "Сохраняю...";
  }
  if (step === "list") {
    return "Далее";
  }
  if (step === "date") {
    return "Сохранить";
  }
  return "Готово";
}

async function submitWorkoutFlow() {
  if (state.workoutFlow.saving) {
    return;
  }

  state.workoutFlow.saving = true;
  renderWorkoutFlow();

  try {
    const response = await fetch("/api/workouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: Number(state.userId),
        workout_date: state.workoutFlow.date,
        exercises: state.workoutFlow.items.map((item) => ({
          exercise: item.exercise,
          weight: Number(item.weight),
          sets: item.sets,
          reps: item.reps,
        })),
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "save failed");
    }

    state.workoutFlow.step = "done";
    await refreshAppData();
    renderWorkoutFlow();
  } catch (error) {
    console.error(error);
    showToast("Не удалось сохранить тренировку");
  } finally {
    state.workoutFlow.saving = false;
    renderWorkoutFlow();
  }
}

async function refreshAppData() {
  if (!state.userId) {
    return;
  }
  const response = await fetch(`/api/app-data?user_id=${encodeURIComponent(state.userId)}`);
  const payload = await response.json();
  if (!payload.ready) {
    return;
  }
  state.payload = payload;
  renderApp(payload);
}

function trainingDayTitle(index) {
  const names = ["День груди", "День спины", "День ног", "День плеч"];
  return names[index % names.length];
}

function faqTitle(key) {
  if (key === "nutrition") return "Питание";
  if (key === "programs") return "Программы";
  if (key === "recovery") return "Восстановление";
  return "Техника";
}

function formatDate(value) {
  if (!value) {
    return "сегодня";
  }
  const parts = value.split("-");
  if (parts.length !== 3) {
    return value;
  }
  return `${parts[2]}.${parts[1]}.${parts[0].slice(-2)}`;
}

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function emptyCard(text) {
  return `<div class="history-card"><div class="history-main">${escapeHtml(text)}</div></div>`;
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
