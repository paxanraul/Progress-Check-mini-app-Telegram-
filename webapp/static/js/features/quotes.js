/*
 * Фича пользовательских цитат на главном экране.
 * Модуль объединяет несколько задач:
 * 1) выбор источника цитат (дефолтные или пользовательские),
 * 2) ротацию и анимацию текста с эффектом печати,
 * 3) редактирование/удаление цитат через overlay,
 * 4) сохранение пользовательских цитат в localStorage.
 */
import {
  HOME_QUOTES,
  MAX_CUSTOM_QUOTES,
  QUOTE_DISPLAY_DURATION_MS,
  QUOTE_FADE_DURATION_MS,
  QUOTE_TYPING_MAX_STEP_MS,
  QUOTE_TYPING_MIN_STEP_MS,
  QUOTE_TYPING_TARGET_DURATION_MS,
} from "../core/constants.js";
import { updateCustomQuotes } from "../services/api.js";
import { loadCustomQuotes, persistCustomQuotes } from "../services/storage.js";
import { escapeHtml } from "../shared/utils.js";

export function createQuoteFeature({
  state,
  dom,
  focusWithoutScroll,
  showToast,
  triggerHaptic,
}) {
  let quoteLoopTimer = 0;
  let quoteTransitionTimer = 0;
  let quoteIndex = 0;
  let quoteTypingRunId = 0;
  let quoteRotationPaused = false;
  let quoteDragState = createQuoteDragState();

  function createQuoteDragState() {
    return {
      active: false,
      pointerId: null,
      handle: null,
      draggedItem: null,
      sourceIndex: -1,
      selectedIndex: -1,
      startY: 0,
      didMove: false,
      ignoreClicksUntil: 0,
    };
  }

  // Таймеры ротации и печати держим отдельно, чтобы можно было независимо
  // останавливать цикл показа и текущую анимацию текста.
  function clearQuoteLoopTimer() {
    if (!quoteLoopTimer) {
      return;
    }
    window.clearTimeout(quoteLoopTimer);
    quoteLoopTimer = 0;
  }

  function clearQuoteTransitionTimer() {
    if (!quoteTransitionTimer) {
      return;
    }
    window.clearTimeout(quoteTransitionTimer);
    quoteTransitionTimer = 0;
  }

  function scheduleQuoteTick(delay) {
    clearQuoteLoopTimer();
    quoteLoopTimer = window.setTimeout(runQuoteTick, delay);
  }

  // Нормализуем цитаты в единый вид до рендера, чтобы UI не зависел от исходного формата хранения.
  function normalizeQuoteText(quote) {
    const text = String(quote?.text || "").trim();
    const author = String(quote?.author || "").trim();
    if (!text) {
      return "";
    }
    return author ? `${text} - ${author}` : text;
  }

  function currentQuotePool() {
    const customQuotes = Array.isArray(state.userQuotes)
      ? state.userQuotes.map(normalizeQuoteText).filter(Boolean)
      : [];
    return customQuotes.length ? customQuotes : HOME_QUOTES;
  }

  function syncQuoteIndexWithPool(quotePool) {
    if (!quotePool.length) {
      quoteIndex = 0;
      return;
    }

    if (!Number.isInteger(quoteIndex) || quoteIndex < 0) {
      quoteIndex = 0;
      return;
    }

    quoteIndex %= quotePool.length;
  }

  function currentCustomQuoteIndex() {
    if (!Array.isArray(state.userQuotes) || !state.userQuotes.length) {
      return -1;
    }
    return Math.min(quoteIndex, state.userQuotes.length - 1);
  }

  function currentEditableQuoteIndex() {
    const editingIndex = Number(state.quoteEditor?.editingIndex);
    if (Number.isInteger(editingIndex) && editingIndex >= 0 && state.userQuotes[editingIndex]) {
      return editingIndex;
    }
    return -1;
  }

  function canAnimateQuotes() {
    return Boolean(
      dom.home.quoteText &&
        dom.home.quoteLiveCard &&
        !dom.home.quoteLiveCard.hidden &&
        currentQuotePool().length &&
        !document.hidden &&
        state.activeTab === "home"
    );
  }

  function getQuoteTypingStepMs(text) {
    const length = Math.max(String(text || "").length, 1);
    const candidate = Math.round(QUOTE_TYPING_TARGET_DURATION_MS / length);
    return Math.max(QUOTE_TYPING_MIN_STEP_MS, Math.min(QUOTE_TYPING_MAX_STEP_MS, candidate));
  }

  function getQuoteTypingDurationMs(text) {
    const nextText = String(text || "");
    if (!nextText) {
      return 0;
    }

    const stepDelay = getQuoteTypingStepMs(nextText);
    return Math.min(90, stepDelay) + Math.max(nextText.length - 1, 0) * stepDelay;
  }

  function getQuoteTransitionDurationMs(text, { immediate = false } = {}) {
    if (immediate) {
      return 0;
    }
    return QUOTE_FADE_DURATION_MS + getQuoteTypingDurationMs(text);
  }

  function scheduleNextQuote(text, options = {}) {
    clearQuoteLoopTimer();
    if (quoteRotationPaused || !canAnimateQuotes()) {
      return;
    }

    const quotePool = currentQuotePool();
    if (quotePool.length <= 1) {
      return;
    }

    const delay = getQuoteTransitionDurationMs(text, options) + QUOTE_DISPLAY_DURATION_MS;
    scheduleQuoteTick(delay);
  }

  function renderQuoteText(text) {
    if (!dom.home.quoteText) {
      return;
    }

    quoteTypingRunId += 1;
    clearQuoteTransitionTimer();
    dom.home.quoteText.classList.remove("is-transitioning", "is-typing");
    dom.home.quoteText.textContent = String(text || "");
  }

  function transitionQuoteText(text, { immediate = false, restart = false } = {}) {
    if (!dom.home.quoteText) {
      return;
    }

    const nextText = String(text || "");
    const currentText = String(dom.home.quoteText.textContent || "");

    if (immediate) {
      renderQuoteText(nextText);
      return;
    }

    if (!restart && currentText === nextText && !dom.home.quoteText.classList.contains("is-typing")) {
      return;
    }

    quoteTypingRunId += 1;
    const typingRunId = quoteTypingRunId;
    clearQuoteTransitionTimer();
    dom.home.quoteText.classList.remove("is-typing");
    dom.home.quoteText.classList.add("is-transitioning");

    const startTyping = () => {
      if (typingRunId !== quoteTypingRunId || !dom.home.quoteText) {
        return;
      }

      dom.home.quoteText.classList.remove("is-transitioning");
      dom.home.quoteText.classList.add("is-typing");
      dom.home.quoteText.textContent = "";

      if (!nextText) {
        dom.home.quoteText.classList.remove("is-typing");
        quoteTransitionTimer = 0;
        return;
      }

      const stepDelay = getQuoteTypingStepMs(nextText);
      let visibleLength = 0;

      const typeNextCharacter = () => {
        if (typingRunId !== quoteTypingRunId || !dom.home.quoteText) {
          return;
        }

        visibleLength += 1;
        dom.home.quoteText.textContent = nextText.slice(0, visibleLength);

        if (visibleLength >= nextText.length) {
          dom.home.quoteText.classList.remove("is-typing");
          quoteTransitionTimer = 0;
          return;
        }

        quoteTransitionTimer = window.setTimeout(typeNextCharacter, stepDelay);
      };

      quoteTransitionTimer = window.setTimeout(typeNextCharacter, Math.min(90, stepDelay));
    };

    quoteTransitionTimer = window.setTimeout(startTyping, QUOTE_FADE_DURATION_MS);
  }

  function showCurrentQuote(options = {}) {
    const { restart = false, immediate = false } = options;
    const quotePool = currentQuotePool();
    syncQuoteIndexWithPool(quotePool);
    const nextText = quotePool[quoteIndex] || quotePool[0] || "";
    transitionQuoteText(nextText, { restart, immediate });
    scheduleNextQuote(nextText, { immediate });
  }

  function loadForUser(serverQuotes = null) {
    if (Array.isArray(serverQuotes) && serverQuotes.length) {
      state.userQuotes = persistCustomQuotes(state.userId, serverQuotes);
      return;
    }

    state.userQuotes = loadCustomQuotes(state.userId);
  }

  function persistQuotes(quotes) {
    const normalized = persistCustomQuotes(state.userId, quotes);
    state.userQuotes = normalized;
    if (state.userId) {
      void updateCustomQuotes({
        user_id: Number(state.userId),
        quotes: normalized,
      }).catch((error) => {
        console.warn("custom quotes sync failed", error);
      });
    }
  }

  function updateFormState() {
    const currentCount = state.userQuotes.length;
    const isManaging = Boolean(state.quoteManageMode);
    const isEditing = state.quoteEditor?.mode === "edit" && currentEditableQuoteIndex() >= 0;
    const selectedCount = state.selectedQuoteIndexes.size;

    if (dom.modals.quote.formHint) {
      dom.modals.quote.formHint.textContent = isManaging
        ? "Выберите одну или несколько цитат, затем удалите их."
        : isEditing
          ? "Измените текст или автора, затем сохраните. Порядок можно менять перетаскиванием."
          : currentCount >= MAX_CUSTOM_QUOTES
            ? `Лимит достигнут: можно хранить максимум ${MAX_CUSTOM_QUOTES} цитат.`
            : currentCount > 0
              ? "Введите новую цитату или выберите сохраненную ниже. Порядок меняется перетаскиванием."
              : `Можно добавить до ${MAX_CUSTOM_QUOTES} цитат.`;
    }

    if (dom.modals.quote.saveButton) {
      dom.modals.quote.saveButton.disabled =
        isManaging || !String(dom.modals.quote.input?.value || "").trim() || (!isEditing && currentCount >= MAX_CUSTOM_QUOTES);
    }

    if (dom.modals.quote.addButton) {
      dom.modals.quote.addButton.disabled = isManaging || (currentCount >= MAX_CUSTOM_QUOTES && !isEditing);
    }

    if (dom.modals.quote.deleteButton) {
      dom.modals.quote.deleteButton.textContent = isManaging ? "Готово" : "Изменить";
      dom.modals.quote.deleteButton.setAttribute(
        "aria-label",
        isManaging ? "Завершить выбор цитат" : "Выбрать цитаты для удаления"
      );
      dom.modals.quote.deleteButton.disabled = currentCount === 0 && !isManaging;
    }

    if (dom.modals.quote.bulkActions) {
      dom.modals.quote.bulkActions.hidden = !isManaging;
    }

    if (dom.modals.quote.deleteSelectedButton) {
      dom.modals.quote.deleteSelectedButton.disabled = selectedCount === 0;
    }

    if (dom.modals.quote.deleteAllButton) {
      dom.modals.quote.deleteAllButton.disabled = currentCount === 0;
    }

    if (dom.modals.quote.manageCancelButton) {
      dom.modals.quote.manageCancelButton.disabled = false;
    }

    if (dom.modals.quote.title) {
      dom.modals.quote.title.textContent = isManaging
        ? "Выбор цитат"
        : isEditing
          ? "Редактировать цитату"
          : "Новая цитата";
    }

    if (dom.home.quoteManageButton) {
      dom.home.quoteManageButton.setAttribute("aria-label", "Управление цитатами");
    }
  }

  function renderQuoteLibrary() {
    if (!dom.modals.quote.libraryList) {
      return;
    }

    const quotes = Array.isArray(state.userQuotes) ? state.userQuotes : [];
    const isManaging = Boolean(state.quoteManageMode);
    dom.modals.quote.libraryList.classList.toggle("is-managing", isManaging);
    if (!quotes.length) {
      dom.modals.quote.libraryList.innerHTML =
        '<div class="quote-library-empty">Сохраненных цитат пока нет</div>';
      return;
    }

    dom.modals.quote.libraryList.innerHTML = quotes
      .map(
        (quote, index) => `
          <article
            class="quote-library-item ${isManaging ? (state.selectedQuoteIndexes.has(index) ? "is-selected is-manage-selected" : "") : currentEditableQuoteIndex() === index ? "is-selected" : ""}"
            data-quote-index="${index}"
            tabindex="0"
            role="button"
            aria-pressed="${isManaging ? (state.selectedQuoteIndexes.has(index) ? "true" : "false") : currentEditableQuoteIndex() === index ? "true" : "false"}"
          >
            <div class="quote-library-copy">
              <p class="quote-library-text">${escapeHtml(quote.text)}</p>
              ${quote.author ? `<p class="quote-library-author">${escapeHtml(quote.author)}</p>` : ""}
            </div>
            <button
              class="quote-library-handle"
              type="button"
              data-quote-handle
              aria-label="Переместить цитату"
              title="Перетащите, чтобы изменить порядок"
              ${isManaging ? "hidden" : ""}
            ></button>
          </article>
        `
      )
      .join("");

    dom.modals.quote.libraryList.querySelectorAll(".quote-library-item").forEach((item) => {
      const openSelectedQuote = () => {
        if (Date.now() < quoteDragState.ignoreClicksUntil) {
          return;
        }
        const index = Number(item.dataset.quoteIndex);
        if (state.quoteManageMode) {
          toggleQuoteSelection(index);
          return;
        }
        startEditCustomQuote(index);
      };

      item.addEventListener("click", openSelectedQuote);
      item.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        openSelectedQuote();
      });
    });

    dom.modals.quote.libraryList.querySelectorAll("[data-quote-handle]").forEach((handle) => {
      handle.addEventListener("click", (event) => {
        event.stopPropagation();
      });
      handle.addEventListener("pointerdown", (event) => {
        if (state.quoteManageMode) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        startQuoteReorder(event);
      });
    });
  }

  function resetQuoteDragState() {
    const ignoreClicksUntil = quoteDragState.ignoreClicksUntil;
    document.removeEventListener("pointermove", handleQuoteReorderMove);
    document.removeEventListener("pointerup", finishQuoteReorder);
    document.removeEventListener("pointercancel", finishQuoteReorder);

    if (quoteDragState.handle && quoteDragState.pointerId !== null) {
      try {
        quoteDragState.handle.releasePointerCapture?.(quoteDragState.pointerId);
      } catch (error) {
        // noop
      }
    }

    if (quoteDragState.draggedItem) {
      quoteDragState.draggedItem.classList.remove("is-dragging");
      quoteDragState.draggedItem.style.removeProperty("transform");
      quoteDragState.draggedItem.style.removeProperty("z-index");
    }

    dom.modals.quote.libraryList?.classList.remove("is-reordering");
    quoteDragState = createQuoteDragState();
    quoteDragState.ignoreClicksUntil = ignoreClicksUntil;
  }

  function collectQuoteLibraryOrder() {
    if (!dom.modals.quote.libraryList) {
      return [];
    }
    return [...dom.modals.quote.libraryList.querySelectorAll(".quote-library-item")]
      .map((item) => Number(item.dataset.quoteIndex))
      .filter((index) => Number.isInteger(index) && index >= 0 && state.userQuotes[index]);
  }

  function applyQuoteLibraryOrder(order, selectedOriginalIndex = -1) {
    if (!Array.isArray(order) || order.length !== state.userQuotes.length) {
      return false;
    }

    const currentDraft = {
      text: String(dom.modals.quote.input?.value || ""),
      author: String(dom.modals.quote.authorInput?.value || ""),
    };

    const nextQuotes = order.map((index) => state.userQuotes[index]).filter(Boolean);
    if (nextQuotes.length !== state.userQuotes.length) {
      return false;
    }

    persistQuotes(nextQuotes);

    const nextEditingIndex = selectedOriginalIndex >= 0 ? order.indexOf(selectedOriginalIndex) : -1;
    if (nextEditingIndex >= 0) {
      setEditorMode("edit", nextEditingIndex);
    } else {
      setEditorMode("create");
    }

    renderSection({ resetLoop: true });

    if (dom.modals.quote.input) {
      dom.modals.quote.input.value = currentDraft.text;
      dom.modals.quote.input.classList.remove("is-invalid");
    }
    if (dom.modals.quote.authorInput) {
      dom.modals.quote.authorInput.value = currentDraft.author;
    }
    updateFormState();
    triggerHaptic("selection");
    return true;
  }

  function handleQuoteReorderMove(event) {
    if (
      !quoteDragState.active ||
      event.pointerId !== quoteDragState.pointerId ||
      !dom.modals.quote.libraryList ||
      !quoteDragState.draggedItem
    ) {
      return;
    }

    event.preventDefault();
    const deltaY = event.clientY - quoteDragState.startY;
    if (Math.abs(deltaY) > 4) {
      quoteDragState.didMove = true;
    }

    quoteDragState.draggedItem.style.transform = `translateY(${deltaY}px) scale(1.01)`;

    const hoveredItem = document.elementFromPoint(event.clientX, event.clientY)?.closest(".quote-library-item");
    const otherItems = [
      ...dom.modals.quote.libraryList.querySelectorAll(".quote-library-item:not(.is-dragging)"),
    ];

    if (
      hoveredItem &&
      hoveredItem !== quoteDragState.draggedItem &&
      dom.modals.quote.libraryList.contains(hoveredItem)
    ) {
      const hoveredRect = hoveredItem.getBoundingClientRect();
      const insertBeforeNode =
        event.clientY > hoveredRect.top + hoveredRect.height / 2 ? hoveredItem.nextElementSibling : hoveredItem;
      if (insertBeforeNode !== quoteDragState.draggedItem) {
        dom.modals.quote.libraryList.insertBefore(quoteDragState.draggedItem, insertBeforeNode);
      }
      return;
    }

    if (!otherItems.length) {
      return;
    }

    const firstRect = otherItems[0].getBoundingClientRect();
    if (event.clientY <= firstRect.top) {
      dom.modals.quote.libraryList.insertBefore(quoteDragState.draggedItem, otherItems[0]);
      return;
    }

    const lastItem = otherItems[otherItems.length - 1];
    const lastRect = lastItem.getBoundingClientRect();
    if (event.clientY >= lastRect.bottom) {
      dom.modals.quote.libraryList.append(quoteDragState.draggedItem);
    }
  }

  function finishQuoteReorder(event) {
    if (!quoteDragState.active) {
      return;
    }
    if (event?.pointerId != null && quoteDragState.pointerId != null && event.pointerId !== quoteDragState.pointerId) {
      return;
    }

    const { didMove, selectedIndex } = quoteDragState;
    const nextOrder = collectQuoteLibraryOrder();
    const orderChanged = nextOrder.some((index, position) => index !== position);
    quoteDragState.ignoreClicksUntil = didMove ? Date.now() + 260 : quoteDragState.ignoreClicksUntil;

    resetQuoteDragState();

    if (didMove && orderChanged) {
      applyQuoteLibraryOrder(nextOrder, selectedIndex);
      return;
    }

    renderQuoteLibrary();
    updateFormState();
  }

  function startQuoteReorder(event) {
    const handle = event.target.closest("[data-quote-handle]");
    const item = handle?.closest(".quote-library-item");
    if (!handle || !item || !dom.modals.quote.libraryList) {
      return;
    }
    if (state.quoteManageMode) {
      return;
    }
    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const sourceIndex = Number(item.dataset.quoteIndex);
    if (!Number.isInteger(sourceIndex) || !state.userQuotes[sourceIndex]) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    resetQuoteDragState();

    quoteDragState.active = true;
    quoteDragState.pointerId = event.pointerId;
    quoteDragState.handle = handle;
    quoteDragState.draggedItem = item;
    quoteDragState.sourceIndex = sourceIndex;
    quoteDragState.selectedIndex = currentEditableQuoteIndex();
    quoteDragState.startY = event.clientY;

    handle.setPointerCapture?.(event.pointerId);
    item.classList.add("is-dragging");
    item.style.zIndex = "3";
    dom.modals.quote.libraryList.classList.add("is-reordering");

    document.addEventListener("pointermove", handleQuoteReorderMove);
    document.addEventListener("pointerup", finishQuoteReorder);
    document.addEventListener("pointercancel", finishQuoteReorder);
  }

  function renderSection(options = {}) {
    if (!dom.home.quoteLiveCard) {
      return;
    }

    const { resetLoop = false } = options;
    const quotePool = currentQuotePool();

    dom.home.quoteLiveCard.hidden = false;
    updateFormState();
    renderQuoteLibrary();

    if (resetLoop) {
      clearQuoteLoopTimer();
      clearQuoteTransitionTimer();
      quoteIndex = 0;
      showCurrentQuote({ restart: true });
      return;
    }

    syncQuoteIndexWithPool(quotePool);
    const activeQuoteText = quotePool[quoteIndex] || quotePool[0] || "";

    if (dom.home.quoteText?.classList.contains("is-typing")) {
      if (!quoteLoopTimer) {
        scheduleNextQuote(activeQuoteText);
      }
      return;
    }

    const currentText = String(dom.home.quoteText?.textContent || "");
    if (!currentText || !quotePool.includes(currentText)) {
      showCurrentQuote({ restart: true });
      return;
    }

    if (!quoteLoopTimer) {
      scheduleNextQuote(currentText);
    }

    syncLoop();
  }

  function resetQuoteForm() {
    if (dom.modals.quote.input) {
      dom.modals.quote.input.value = "";
      dom.modals.quote.input.classList.remove("is-invalid");
    }
    if (dom.modals.quote.authorInput) {
      dom.modals.quote.authorInput.value = "";
    }
    updateFormState();
  }

  function setEditorMode(mode, editingIndex = -1) {
    const hasValidIndex =
      Number.isInteger(editingIndex) && editingIndex >= 0 && state.userQuotes[editingIndex];
    const isEditMode = mode === "edit" && hasValidIndex;

    state.quoteEditor = {
      mode: isEditMode ? "edit" : "create",
      editingIndex: hasValidIndex ? editingIndex : -1,
    };

    updateFormState();
  }

  function getSelectedQuoteIndexes() {
    return [...state.selectedQuoteIndexes]
      .filter((index) => Number.isInteger(index) && index >= 0 && state.userQuotes[index])
      .sort((a, b) => a - b);
  }

  function clearQuoteSelection() {
    state.selectedQuoteIndexes.clear();
  }

  function setQuoteManageMode(active) {
    state.quoteManageMode = Boolean(active);
    if (!state.quoteManageMode) {
      clearQuoteSelection();
    }
    updateFormState();
    renderQuoteLibrary();
  }

  function toggleQuoteSelection(index) {
    if (!state.quoteManageMode || !Number.isInteger(index) || index < 0 || !state.userQuotes[index]) {
      return;
    }

    if (state.selectedQuoteIndexes.has(index)) {
      state.selectedQuoteIndexes.delete(index);
    } else {
      state.selectedQuoteIndexes.add(index);
    }

    updateFormState();
    renderQuoteLibrary();
  }

  function fillOverlayForm() {
    const editingIndex = currentEditableQuoteIndex();
    const editingQuote =
      state.quoteEditor?.mode === "edit" && editingIndex >= 0
        ? state.userQuotes[editingIndex]
        : null;

    if (dom.modals.quote.input) {
      dom.modals.quote.input.value = editingQuote?.text || "";
      dom.modals.quote.input.classList.remove("is-invalid");
    }
    if (dom.modals.quote.authorInput) {
      dom.modals.quote.authorInput.value = editingQuote?.author || "";
    }

    updateFormState();
  }

  function startCreateCustomQuote() {
    if (state.quoteManageMode) {
      setQuoteManageMode(false);
    }
    if (state.userQuotes.length >= MAX_CUSTOM_QUOTES) {
      updateFormState();
      showToast(`Можно сохранить максимум ${MAX_CUSTOM_QUOTES} цитат`);
      return;
    }

    setEditorMode("create");
    fillOverlayForm();
    renderQuoteLibrary();
    focusWithoutScroll(dom.modals.quote.input);
  }

  function startEditCustomQuote(index = currentEditableQuoteIndex()) {
    if (state.quoteManageMode) {
      setQuoteManageMode(false);
    }
    if (!Number.isInteger(index) || index < 0 || !state.userQuotes[index]) {
      updateFormState();
      showToast("Выберите цитату из списка");
      return;
    }

    setEditorMode("edit", index);
    fillOverlayForm();
    renderQuoteLibrary();
    focusWithoutScroll(dom.modals.quote.input);
  }

  function syncQuoteEditorAfterDelete() {
    setEditorMode("create");
    fillOverlayForm();
  }

  function removeQuotesByIndexes(indexes, successMessage = "Цитата удалена") {
    const validIndexes = [...new Set(indexes)]
      .filter((index) => Number.isInteger(index) && index >= 0 && state.userQuotes[index])
      .sort((a, b) => b - a);
    if (!validIndexes.length) {
      return false;
    }

    const nextQuotes = state.userQuotes.filter((_, quoteIndex) => !validIndexes.includes(quoteIndex));
    persistQuotes(nextQuotes);
    clearQuoteSelection();
    setQuoteManageMode(false);
    syncQuoteEditorAfterDelete();
    renderSection({ resetLoop: true });
    updateFormState();
    triggerHaptic("selection");
    showToast(successMessage);
    return true;
  }

  function toggleQuoteManageMode() {
    if (state.quoteManageMode) {
      setQuoteManageMode(false);
      return;
    }
    if (!state.userQuotes.length) {
      showToast("Сохраненных цитат пока нет");
      return;
    }
    setQuoteManageMode(true);
    showToast("Выберите цитаты для удаления");
  }

  function deleteSelectedQuotes() {
    const selectedIndexes = getSelectedQuoteIndexes();
    if (!selectedIndexes.length) {
      showToast("Выберите хотя бы одну цитату");
      return;
    }
    removeQuotesByIndexes(selectedIndexes, selectedIndexes.length > 1 ? "Цитаты удалены" : "Цитата удалена");
  }

  function deleteAllQuotes() {
    if (!state.userQuotes.length) {
      showToast("Сохраненных цитат пока нет");
      return;
    }

    const confirmed = window.confirm("Удалить все сохраненные цитаты?");
    if (!confirmed) {
      return;
    }

    persistQuotes([]);
    clearQuoteSelection();
    setQuoteManageMode(false);
    syncQuoteEditorAfterDelete();
    renderSection({ resetLoop: true });
    updateFormState();
    triggerHaptic("warning");
    showToast("Все цитаты удалены");
  }

  async function saveCustomQuote() {
    if (!state.userId) {
      showToast("Сначала открой профиль в боте");
      return false;
    }
    if (state.quoteManageMode) {
      setQuoteManageMode(false);
      return false;
    }

    const text = String(dom.modals.quote.input?.value || "").trim();
    const author = String(dom.modals.quote.authorInput?.value || "").trim();
    const isEditing = state.quoteEditor?.mode === "edit";
    const editingIndex = currentEditableQuoteIndex();

    if (!text) {
      if (dom.modals.quote.input) {
        dom.modals.quote.input.classList.add("is-invalid");
        focusWithoutScroll(dom.modals.quote.input);
      }
      updateFormState();
      showToast("Введите текст цитаты");
      return false;
    }

    if (!isEditing && state.userQuotes.length >= MAX_CUSTOM_QUOTES) {
      showToast(`Можно сохранить максимум ${MAX_CUSTOM_QUOTES} цитат`);
      updateFormState();
      return false;
    }

    if (isEditing && editingIndex >= 0 && state.userQuotes[editingIndex]) {
      const nextQuotes = [...state.userQuotes];
      nextQuotes[editingIndex] = { text, author };
      persistQuotes(nextQuotes);
    } else {
      persistQuotes([...state.userQuotes, { text, author }]);
    }

    renderSection({ resetLoop: true });
    triggerHaptic("success");
    setEditorMode("create");
    resetQuoteForm();
    renderQuoteLibrary();
    focusWithoutScroll(dom.modals.quote.input);
    showToast(isEditing ? "Цитата обновлена" : "Цитата добавлена");
    return true;
  }

  function deleteCustomQuote(index) {
    removeQuotesByIndexes([index], "Цитата удалена");
  }

  async function deleteQuoteFromOverlay() {
    deleteSelectedQuotes();
    return true;
  }

  function runQuoteTick() {
    quoteLoopTimer = 0;
    if (!canAnimateQuotes() || quoteRotationPaused) {
      return;
    }

    const quotePool = currentQuotePool();
    syncQuoteIndexWithPool(quotePool);
    if (quotePool.length <= 1) {
      renderQuoteText(quotePool[0] || "");
      return;
    }

    quoteIndex = (quoteIndex + 1) % quotePool.length;
    showCurrentQuote();
  }

  function syncLoop() {
    if (!canAnimateQuotes()) {
      dom.home.quoteLiveCard?.classList.remove("is-breathing");
      clearQuoteLoopTimer();
      clearQuoteTransitionTimer();
      return;
    }

    const quotePool = currentQuotePool();
    syncQuoteIndexWithPool(quotePool);
    if (!quotePool.length) {
      dom.home.quoteLiveCard?.classList.remove("is-breathing");
      clearQuoteLoopTimer();
      renderQuoteText("");
      return;
    }

    dom.home.quoteLiveCard?.classList.add("is-breathing");

    if (quoteRotationPaused) {
      clearQuoteLoopTimer();
      return;
    }

    const activeQuoteText = quotePool[quoteIndex] || quotePool[0] || "";
    if (dom.home.quoteText?.classList.contains("is-typing")) {
      if (!quoteLoopTimer) {
        scheduleNextQuote(activeQuoteText);
      }
      return;
    }

    const currentText = String(dom.home.quoteText?.textContent || "");
    if (!currentText || !quotePool.includes(currentText)) {
      showCurrentQuote({ restart: true });
      return;
    }

    if (quotePool.length === 1) {
      clearQuoteLoopTimer();
      return;
    }

    if (!quoteLoopTimer) {
      scheduleNextQuote(currentText);
    }
  }

  function pauseRotation() {
    quoteRotationPaused = true;
    clearQuoteLoopTimer();
  }

  function resumeRotation() {
    quoteRotationPaused = false;
    syncLoop();
  }

  return {
    currentCustomQuoteIndex,
    deleteQuoteFromOverlay,
    deleteSelectedQuotes,
    deleteAllQuotes,
    finishQuoteReorder,
    fillOverlayForm,
    loadForUser,
    pauseRotation,
    renderSection,
    resumeRotation,
    saveCustomQuote,
    setEditorMode,
    startCreateCustomQuote,
    startEditCustomQuote,
    setQuoteManageMode,
    toggleQuoteManageMode,
    syncLoop,
    updateFormState,
  };
}
