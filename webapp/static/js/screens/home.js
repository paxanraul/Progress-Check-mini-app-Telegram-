/*
 * Экран Home после рефактора навигации.
 * Здесь живут быстрые действия, цитаты и перенесённая история тренировок со всей прежней логикой:
 * edit-mode, массовое удаление, long-press для названия/комментария и открытие редактирования тренировки.
 */
import {
  attachLongPress,
  emptyCard,
  escapeHtml,
  escapeSelectorValue,
  formatDate,
  preserveElementScroll,
  trainingDayTitle,
} from "../shared/utils.js";

export function createHomeScreen({
  state,
  dom,
  api,
  quoteFeature,
  showToast,
  triggerHaptic,
  animateCollection,
  animateExerciseRows,
  openWorkoutFlow,
  openQuoteOverlay,
  openEditWorkoutFlow,
  refreshAppDataStable,
  preventTapFocusShift,
}) {
  let wellbeingNoteSaving = false;

  function findWorkoutEntry(sessionKey, date = "") {
    const history = state.payload?.history || [];
    if (sessionKey) {
      const bySession = history.find((entry) => (entry.session_key || "") === sessionKey);
      if (bySession) {
        return bySession;
      }
    }
    if (date) {
      return history.find((entry) => entry.date === date) || null;
    }
    return null;
  }

  function updateHistoryManageControls() {
    if (!dom.home.historyManageToggle || !dom.home.historyBulkActions) {
      return;
    }

    dom.home.historyManageToggle.classList.toggle("is-text-mode", state.historyEditMode);
    dom.home.historyManageToggle.setAttribute(
      "aria-label",
      state.historyEditMode
        ? "Завершить редактирование истории тренировок"
        : "Изменить историю тренировок"
    );
    dom.home.historyManageToggle.innerHTML = state.historyEditMode ? "Готово" : "<i class='bx bx-cog'></i>";
    dom.home.historyBulkActions.hidden = !state.historyEditMode;

    if (dom.home.historyDeleteSelectedButton) {
      dom.home.historyDeleteSelectedButton.disabled = state.selectedWorkoutSessions.size === 0;
    }
  }

  function toggleHistoryWorkoutSelection(sessionKey) {
    if (!sessionKey) {
      return;
    }

    const wasSelected = state.selectedWorkoutSessions.has(sessionKey);
    if (wasSelected) {
      state.selectedWorkoutSessions.delete(sessionKey);
    } else {
      state.selectedWorkoutSessions.add(sessionKey);
    }

    const cards = document.querySelectorAll(
      `.history-card[data-session-key="${escapeSelectorValue(sessionKey)}"]`
    );
    cards.forEach((card) => {
      card.classList.toggle("selected", !wasSelected);
      const indicator = card.querySelector(".history-select-indicator");
      if (indicator) {
        indicator.textContent = !wasSelected ? "✓" : "";
      }
    });

    updateHistoryManageControls();
  }

  function renderHistory(history = [], options = {}) {
    const { animate = true } = options;
    if (!dom.home.historyList) {
      return;
    }

    dom.home.historyList.innerHTML = "";
    updateHistoryManageControls();

    if (!history.length) {
      state.selectedWorkoutSessions.clear();
      disableHistoryManageMode(true);
      updateHistoryManageControls();
      dom.home.historyList.innerHTML = emptyCard("Пока нет тренировок.");
      return;
    }

    history.forEach((day, index) => {
      const title = day.workout_name || trainingDayTitle(index);
      const sessionKey = day.session_key || `legacy:${day.date}`;
      const isSelected = state.selectedWorkoutSessions.has(sessionKey);
      const noteBlock = day.note
        ? `<div class="history-note" data-date="${escapeHtml(day.date)}" data-session-key="${escapeHtml(sessionKey)}">${escapeHtml(day.note)}</div>`
        : "";
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

      dom.home.historyList.insertAdjacentHTML(
        "beforeend",
        `
          <article class="history-card${state.historyEditMode && isSelected ? " selected" : ""}" data-date="${escapeHtml(day.date)}" data-session-key="${escapeHtml(sessionKey)}">
            <div class="history-head">
              <div class="history-main" data-date="${escapeHtml(day.date)}" data-session-key="${escapeHtml(sessionKey)}">
                ${state.historyEditMode ? `<span class="history-select-indicator">${isSelected ? "✓" : ""}</span>` : ""}
                ${escapeHtml(title)}
              </div>
              <div class="history-head-right">
                <div class="history-date">${formatDate(day.date)}</div>
                <button class="history-edit-btn" data-date="${escapeHtml(day.date)}" data-session-key="${escapeHtml(sessionKey)}" type="button" aria-label="Изменить тренировку"${state.historyEditMode ? " hidden" : ""}>
                  <i class='bx bx-cog'></i>
                </button>
              </div>
            </div>
            <div class="exercise-list">${rows}</div>
            ${noteBlock}
          </article>
        `
      );
    });

    dom.home.historyList.querySelectorAll(".history-edit-btn").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        if (state.historyEditMode) {
          return;
        }
        openEditWorkoutFlow(button.dataset.sessionKey || "", button.dataset.date || "");
      });
    });

    dom.home.historyList.querySelectorAll(".history-card[data-session-key]").forEach((card) => {
      card.addEventListener("click", () => {
        if (!state.historyEditMode) {
          return;
        }
        const key = card.dataset.sessionKey || "";
        if (!key) {
          return;
        }
        toggleHistoryWorkoutSelection(key);
      });
    });

    if (!state.historyEditMode) {
      dom.home.historyList
        .querySelectorAll(".history-note[data-date][data-session-key]")
        .forEach((noteNode) => {
          attachLongPress(noteNode, 100, () => {
            void promptEditWorkoutComment(noteNode.dataset.sessionKey || "", noteNode.dataset.date || "");
          });
        });

      dom.home.historyList
        .querySelectorAll(".history-main[data-date][data-session-key]")
        .forEach((titleNode) => {
          const card = titleNode.closest(".history-card");
          attachLongPress(titleNode, 200, () => {
            triggerHaptic("selection");
            if (card) {
              card.classList.add("focus-edit");
            }
            void promptEditWorkoutTitle(titleNode.dataset.sessionKey || "", titleNode.dataset.date || "")
              .finally(() => {
                if (card) {
                  card.classList.remove("focus-edit");
                }
              });
          });
        });
    }

    if (animate) {
      animateCollection(dom.home.historyList, ".history-card");
      animateExerciseRows(dom.home.historyList);
    }
  }

  function toggleHistoryManageMode() {
    state.historyEditMode = !state.historyEditMode;
    if (!state.historyEditMode) {
      state.selectedWorkoutSessions.clear();
    }

    preserveElementScroll(dom.app.content, () => {
      renderHistory(state.payload?.history || [], { animate: false });
    });
  }

  function disableHistoryManageMode(silent = false) {
    state.historyEditMode = false;
    state.selectedWorkoutSessions.clear();
    if (silent) {
      return;
    }

    preserveElementScroll(dom.app.content, () => {
      renderHistory(state.payload?.history || [], { animate: false });
    });
  }

  async function promptEditWorkoutComment(sourceSessionKey, sourceDate = "") {
    if (wellbeingNoteSaving || !state.userId || (!sourceSessionKey && !sourceDate)) {
      return;
    }

    triggerHaptic("selection");

    const workoutDay = findWorkoutEntry(sourceSessionKey, sourceDate);
    if (!workoutDay || !Array.isArray(workoutDay.exercises) || !workoutDay.exercises.length) {
      showToast("Тренировка не найдена");
      return;
    }

    const currentNote = String(workoutDay.note || "");
    const nextNoteRaw = window.prompt("Измени комментарий:", currentNote);
    if (nextNoteRaw === null) {
      return;
    }

    const nextNote = nextNoteRaw.trim();
    if (nextNote === currentNote.trim()) {
      return;
    }

    wellbeingNoteSaving = true;
    try {
      await api.updateWorkout({
        user_id: Number(state.userId),
        source_session_key: workoutDay.session_key || sourceSessionKey || "",
        source_workout_date: workoutDay.date,
        session_key: workoutDay.session_key || sourceSessionKey || "",
        workout_date: workoutDay.date,
        workout_name: workoutDay.workout_name || "",
        wellbeing_note: nextNote,
        exercises: workoutDay.exercises.map((item) => ({
          exercise: item.exercise,
          weight: Number(item.weight),
          sets: item.sets,
          reps: item.reps,
        })),
      });

      showToast("Комментарий обновлён");
      await refreshAppDataStable();
    } catch (error) {
      console.error(error);
      showToast("Не удалось обновить комментарий");
    } finally {
      wellbeingNoteSaving = false;
    }
  }

  async function promptEditWorkoutTitle(sourceSessionKey, sourceDate = "") {
    if (wellbeingNoteSaving || !state.userId || (!sourceSessionKey && !sourceDate)) {
      return;
    }

    triggerHaptic("selection");

    const workoutDay = findWorkoutEntry(sourceSessionKey, sourceDate);
    if (!workoutDay || !Array.isArray(workoutDay.exercises) || !workoutDay.exercises.length) {
      showToast("Тренировка не найдена");
      return;
    }

    const currentName = String(workoutDay.workout_name || "");
    const nextNameRaw = window.prompt("Измени название тренировки:", currentName);
    if (nextNameRaw === null) {
      return;
    }

    const nextName = nextNameRaw.trim();
    if (nextName === currentName.trim()) {
      return;
    }

    wellbeingNoteSaving = true;
    try {
      await api.updateWorkout({
        user_id: Number(state.userId),
        source_session_key: workoutDay.session_key || sourceSessionKey || "",
        source_workout_date: workoutDay.date,
        session_key: workoutDay.session_key || sourceSessionKey || "",
        workout_date: workoutDay.date,
        workout_name: nextName,
        wellbeing_note: workoutDay.note || "",
        exercises: workoutDay.exercises.map((item) => ({
          exercise: item.exercise,
          weight: Number(item.weight),
          sets: item.sets,
          reps: item.reps,
        })),
      });

      showToast("Название обновлено");
      await refreshAppDataStable();
    } catch (error) {
      console.error(error);
      showToast("Не удалось обновить название");
    } finally {
      wellbeingNoteSaving = false;
    }
  }

  async function deleteSelectedHistoryWorkouts() {
    if (!state.historyEditMode || state.selectedWorkoutSessions.size === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Удалить выбранные тренировки: ${state.selectedWorkoutSessions.size} шт.?`
    );
    if (!confirmed) {
      return;
    }

    const keys = [...state.selectedWorkoutSessions];
    let deleted = 0;

    for (const key of keys) {
      try {
        await api.deleteWorkout({
          user_id: Number(state.userId),
          session_key: key,
        });
        deleted += 1;
      } catch (error) {
        console.error(error);
      }
    }

    await refreshAppDataStable();
    disableHistoryManageMode(true);
    renderHistory(state.payload?.history || []);
    showToast(
      deleted > 0 ? `Удалено тренировок: ${deleted}` : "Не удалось удалить выбранные тренировки"
    );
  }

  async function deleteAllHistoryWorkouts() {
    if (!state.historyEditMode) {
      return;
    }

    const count = (state.payload?.history || []).length;
    const confirmed = window.confirm(`Удалить все тренировки (${count})?`);
    if (!confirmed) {
      return;
    }

    try {
      await api.deleteAllWorkouts(state.userId);
      await refreshAppDataStable();
      disableHistoryManageMode(true);
      renderHistory(state.payload?.history || []);
      showToast("Все тренировки удалены");
    } catch (error) {
      console.error(error);
      showToast("Не удалось удалить все тренировки");
    }
  }

  function render() {
    quoteFeature.renderSection();
    renderHistory(state.payload?.history || [], { animate: false });
  }

  function bindEvents() {
    dom.home.openWorkoutFlowButton?.addEventListener("click", openWorkoutFlow);
    dom.home.quoteManageButton?.addEventListener("click", openQuoteOverlay);
    dom.home.quoteLiveCard?.addEventListener("pointerenter", quoteFeature.pauseRotation);
    dom.home.quoteLiveCard?.addEventListener("pointerleave", quoteFeature.resumeRotation);
    dom.home.historyManageToggle?.addEventListener("click", toggleHistoryManageMode);
    dom.home.historyManageCancelButton?.addEventListener("click", () => {
      disableHistoryManageMode();
    });
    dom.home.historyDeleteSelectedButton?.addEventListener("click", () => {
      void deleteSelectedHistoryWorkouts();
    });
    dom.home.historyDeleteAllButton?.addEventListener("click", () => {
      void deleteAllHistoryWorkouts();
    });
    preventTapFocusShift(dom.home.openWorkoutFlowButton);
    preventTapFocusShift(dom.app.topbarUser);
  }

  return {
    bindEvents,
    disableHistoryManageMode,
    render,
    renderHistory,
    renderQuotes: () => quoteFeature.renderSection(),
  };
}
