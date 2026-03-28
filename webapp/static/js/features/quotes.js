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

  function loadForUser() {
    state.userQuotes = loadCustomQuotes(state.userId);
  }

  function persistQuotes(quotes) {
    state.userQuotes = persistCustomQuotes(state.userId, quotes);
  }

  function updateFormState() {
    const currentCount = state.userQuotes.length;
    const isEditing = state.quoteEditor?.mode === "edit" && currentEditableQuoteIndex() >= 0;
    const hasSelectedQuote = currentEditableQuoteIndex() >= 0;

    if (dom.modals.quote.formHint) {
      dom.modals.quote.formHint.textContent = isEditing
        ? "Измените текст или автора, затем сохраните обновлённую цитату."
        : currentCount >= MAX_CUSTOM_QUOTES
          ? `Лимит достигнут: можно хранить максимум ${MAX_CUSTOM_QUOTES} цитат.`
          : currentCount > 0
            ? "Выберите цитату из списка, чтобы изменить ее, или добавьте новую."
            : `Можно добавить до ${MAX_CUSTOM_QUOTES} цитат.`;
    }

    if (dom.modals.quote.saveButton) {
      dom.modals.quote.saveButton.disabled =
        !String(dom.modals.quote.input?.value || "").trim() ||
        (!isEditing && currentCount >= MAX_CUSTOM_QUOTES);
    }

    if (dom.modals.quote.addButton) {
      dom.modals.quote.addButton.disabled = currentCount >= MAX_CUSTOM_QUOTES && !isEditing;
    }

    if (dom.modals.quote.deleteButton) {
      dom.modals.quote.deleteButton.disabled = !hasSelectedQuote;
    }

    if (dom.modals.quote.title) {
      dom.modals.quote.title.textContent = isEditing ? "Редактировать цитату" : "Новая цитата";
    }

    if (dom.home.quoteManageButton) {
      const hasQuote = currentCustomQuoteIndex() >= 0;
      dom.home.quoteManageButton.setAttribute(
        "aria-label",
        hasQuote ? "Редактировать цитату" : "Добавить цитату"
      );
    }
  }

  function renderQuoteLibrary() {
    if (!dom.modals.quote.libraryList) {
      return;
    }

    const quotes = Array.isArray(state.userQuotes) ? state.userQuotes : [];
    if (!quotes.length) {
      dom.modals.quote.libraryList.innerHTML =
        '<div class="quote-library-empty">Сохраненных цитат пока нет</div>';
      return;
    }

    dom.modals.quote.libraryList.innerHTML = quotes
      .map(
        (quote, index) => `
          <article
            class="quote-library-item ${currentEditableQuoteIndex() === index ? "is-selected" : ""}"
            data-quote-index="${index}"
            tabindex="0"
            role="button"
            aria-pressed="${currentEditableQuoteIndex() === index ? "true" : "false"}"
          >
            <div class="quote-library-copy">
              <p class="quote-library-text">${escapeHtml(quote.text)}</p>
              ${quote.author ? `<p class="quote-library-author">${escapeHtml(quote.author)}</p>` : ""}
            </div>
          </article>
        `
      )
      .join("");

    dom.modals.quote.libraryList.querySelectorAll(".quote-library-item").forEach((item) => {
      const openSelectedQuote = () => {
        const index = Number(item.dataset.quoteIndex);
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

  function syncQuoteEditorAfterDelete(deletedIndex) {
    if (!state.userQuotes.length) {
      setEditorMode("create");
      fillOverlayForm();
      return;
    }

    const nextIndex = Math.min(deletedIndex, state.userQuotes.length - 1);
    setEditorMode("edit", nextIndex);
    fillOverlayForm();
  }

  async function saveCustomQuote() {
    if (!state.userId) {
      showToast("Сначала открой профиль в боте");
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
    resetQuoteForm();
    showToast(isEditing ? "Цитата обновлена" : "Цитата добавлена");
    return true;
  }

  function deleteCustomQuote(index) {
    if (!Number.isInteger(index) || !state.userQuotes[index]) {
      return;
    }

    const nextQuotes = state.userQuotes.filter((_, quoteIndexValue) => quoteIndexValue !== index);
    persistQuotes(nextQuotes);
    syncQuoteEditorAfterDelete(index);
    renderSection({ resetLoop: true });
    updateFormState();
    triggerHaptic("selection");
    showToast("Цитата удалена");
  }

  async function deleteQuoteFromOverlay() {
    const index = currentEditableQuoteIndex();
    if (index < 0 || !state.userQuotes[index]) {
      return false;
    }

    const quote = state.userQuotes[index];
    const text = String(quote?.text || "").trim();
    const preview = text.length > 60 ? `${text.slice(0, 60)}...` : text;
    const confirmed = window.confirm(
      preview ? `Удалить цитату?\n\n"${preview}"` : "Удалить текущую пользовательскую цитату?"
    );
    if (!confirmed) {
      return false;
    }

    deleteCustomQuote(index);
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
    fillOverlayForm,
    loadForUser,
    pauseRotation,
    renderSection,
    resumeRotation,
    saveCustomQuote,
    setEditorMode,
    startCreateCustomQuote,
    startEditCustomQuote,
    syncLoop,
    updateFormState,
  };
}
