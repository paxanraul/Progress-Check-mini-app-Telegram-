import {
  decodeHtml,
  emptyCard,
  escapeHtml,
  escapeSelectorValue,
  formatDate,
  preserveElementScroll,
} from "../shared/utils.js";

export function createRecordsScreen({
  state,
  dom,
  api,
  showToast,
  animateCollection,
  openRecordFlow,
}) {
  function updateControls() {
    dom.records.manageButton?.classList.toggle("active-tool", state.recordsEditMode);
    if (dom.records.manageButton) {
      dom.records.manageButton.textContent = state.recordsEditMode ? "Готово" : "Изменить";
    }
    if (dom.records.bulkActions) {
      dom.records.bulkActions.hidden = !state.recordsEditMode;
    }
    if (dom.records.deleteSelectedButton) {
      dom.records.deleteSelectedButton.disabled = state.selectedRecordExercises.size === 0;
    }
  }

  function toggleRecordSelection(exercise) {
    if (!exercise) {
      return;
    }

    const wasSelected = state.selectedRecordExercises.has(exercise);
    if (wasSelected) {
      state.selectedRecordExercises.delete(exercise);
    } else {
      state.selectedRecordExercises.add(exercise);
    }

    const cards = document.querySelectorAll(
      `.record-card[data-exercise="${escapeSelectorValue(exercise)}"]`
    );
    cards.forEach((card) => {
      card.classList.toggle("selected", !wasSelected);
      const indicator = card.querySelector(".history-select-indicator");
      if (indicator) {
        indicator.textContent = !wasSelected ? "✓" : "";
      }
    });

    updateControls();
  }

  function render(records = [], options = {}) {
    const { animate = true } = options;
    if (!dom.records.list) {
      return;
    }

    updateControls();
    dom.records.list.innerHTML = "";

    if (!records.length) {
      state.recordsEditMode = false;
      state.selectedRecordExercises.clear();
      updateControls();
      dom.records.list.innerHTML = emptyCard("Рекордов пока нет.");
      return;
    }

    records.forEach((record, index) => {
      const exerciseKey = String(record.exercise || "");
      const isSelected = state.selectedRecordExercises.has(exerciseKey);
      dom.records.list.insertAdjacentHTML(
        "beforeend",
        `
          <article class="record-card${index === 0 ? " highlight" : ""}${state.recordsEditMode && isSelected ? " selected" : ""}" data-exercise="${escapeHtml(exerciseKey)}">
            <div class="record-main">
              <div>
                <div class="record-title-row">
                  ${state.recordsEditMode ? `<span class="history-select-indicator">${isSelected ? "✓" : ""}</span>` : ""}
                  <div class="record-title">${escapeHtml(record.exercise)}</div>
                </div>
                <div class="record-date">${record.date ? formatDate(record.date) : "последний лучший результат"}</div>
              </div>
              <div class="record-weight">${record.best_weight} кг</div>
            </div>
          </article>
        `
      );
    });

    dom.records.list.querySelectorAll(".record-card").forEach((card) => {
      card.addEventListener("click", () => {
        if (!state.recordsEditMode) {
          return;
        }
        const exercise = decodeHtml(card.dataset.exercise || "");
        if (!exercise) {
          return;
        }
        toggleRecordSelection(exercise);
      });
    });

    if (animate) {
      animateCollection(dom.records.list, ".record-card");
    }
  }

  function toggleManageMode() {
    state.recordsEditMode = !state.recordsEditMode;
    if (!state.recordsEditMode) {
      state.selectedRecordExercises.clear();
    }

    preserveElementScroll(dom.app.content, () => {
      render(state.payload?.records || [], { animate: false });
    });
  }

  function disableManageMode(silent = false) {
    state.recordsEditMode = false;
    state.selectedRecordExercises.clear();
    if (silent) {
      return;
    }

    preserveElementScroll(dom.app.content, () => {
      render(state.payload?.records || [], { animate: false });
    });
  }

  async function deleteSelectedRecords(refreshAppDataStable) {
    if (!state.recordsEditMode || state.selectedRecordExercises.size === 0) {
      return;
    }

    const confirmed = window.confirm(
      `Удалить выбранные рекорды: ${state.selectedRecordExercises.size} шт.?`
    );
    if (!confirmed) {
      return;
    }

    let deleted = 0;
    for (const exercise of state.selectedRecordExercises) {
      try {
        const ok = await api.deleteRecord({
          user_id: Number(state.userId),
          exercise,
        });
        if (ok) {
          deleted += 1;
        }
      } catch (error) {
        console.error(error);
      }
    }

    await refreshAppDataStable();
    state.recordsEditMode = false;
    state.selectedRecordExercises.clear();
    render(state.payload?.records || []);
    showToast(deleted > 0 ? `Удалено рекордов: ${deleted}` : "Не удалось удалить выбранные рекорды");
  }

  async function deleteAllRecords(refreshAppDataStable) {
    if (!state.userId) {
      showToast("Сначала открой профиль в боте");
      return;
    }
    if (!state.recordsEditMode) {
      return;
    }

    const records = state.payload?.records || [];
    if (!records.length) {
      return;
    }

    const confirmed = window.confirm(`Удалить все рекорды (${records.length})?`);
    if (!confirmed) {
      return;
    }

    let deleted = 0;
    try {
      for (const record of records) {
        const exercise = String(record.exercise || "").trim();
        if (!exercise) {
          continue;
        }
        const ok = await api.deleteRecord({
          user_id: Number(state.userId),
          exercise,
        });
        if (ok) {
          deleted += 1;
        }
      }

      await refreshAppDataStable();
      state.recordsEditMode = false;
      state.selectedRecordExercises.clear();
      render(state.payload?.records || []);
      showToast(deleted > 0 ? "Все рекорды удалены" : "Не удалось удалить рекорды");
    } catch (error) {
      console.error(error);
      showToast(`Не удалось удалить рекорды: ${error.message || "unknown error"}`);
    }
  }

  function bindEvents({ refreshAppDataStable }) {
    dom.records.addButton?.addEventListener("click", openRecordFlow);
    dom.records.manageButton?.addEventListener("click", toggleManageMode);
    dom.records.manageCancelButton?.addEventListener("click", () => disableManageMode());
    dom.records.deleteSelectedButton?.addEventListener("click", () => {
      void deleteSelectedRecords(refreshAppDataStable);
    });
    dom.records.deleteAllButton?.addEventListener("click", () => {
      void deleteAllRecords(refreshAppDataStable);
    });
  }

  return {
    bindEvents,
    disableManageMode,
    render,
  };
}
