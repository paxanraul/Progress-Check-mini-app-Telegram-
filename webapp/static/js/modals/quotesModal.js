/*
 * UI-обвязка для модального окна управления цитатами.
 * Сам бизнес-процесс хранения, ротации и валидации цитат живёт в `features/quotes`,
 * а этот модуль отвечает именно за lifecycle окна: открыть, закрыть, связать кнопки и поля.
 */
import { closeOverlay, openOverlay } from "../ui/modalBase.js";

export function createQuotesModal({
  state,
  dom,
  interaction,
  quoteFeature,
  showToast,
  getBlockingOverlays,
}) {
  function open() {
    if (!state.userId) {
      showToast("Сначала открой профиль в боте");
      return;
    }

    const currentIndex = quoteFeature.currentCustomQuoteIndex();
    if (currentIndex >= 0) {
      quoteFeature.setEditorMode("edit", currentIndex);
    } else {
      quoteFeature.setEditorMode("create");
    }

    state.quoteOverlayOpen = true;
    quoteFeature.fillOverlayForm();

    openOverlay({
      overlay: dom.modals.quote.overlay,
      modal: dom.modals.quote.modal,
      freezeViewportFor: interaction.freezeViewportFor,
      setBodyScrollLock: interaction.setBodyScrollLock,
      focusTarget: dom.modals.quote.input,
    });
  }

  function close() {
    if (!dom.modals.quote.overlay || dom.modals.quote.overlay.hidden) {
      return Promise.resolve(false);
    }

    state.quoteOverlayOpen = false;
    quoteFeature.setEditorMode("create");

    return closeOverlay({
      overlay: dom.modals.quote.overlay,
      modal: dom.modals.quote.modal,
      freezeViewportFor: interaction.freezeViewportFor,
      setBodyScrollLock: interaction.setBodyScrollLock,
      getBlockingOverlays,
    });
  }

  function bindEvents() {
    dom.modals.quote.closeButton?.addEventListener("click", () => {
      void close();
    });
    dom.modals.quote.cancelButton?.addEventListener("click", () => {
      void close();
    });
    dom.modals.quote.addButton?.addEventListener("click", quoteFeature.startCreateCustomQuote);
    dom.modals.quote.deleteButton?.addEventListener("click", async () => {
      const deleted = await quoteFeature.deleteQuoteFromOverlay();
      if (deleted) {
        void close();
      }
    });
    dom.modals.quote.saveButton?.addEventListener("click", async () => {
      interaction.blurActiveField();
      const saved = await quoteFeature.saveCustomQuote();
      if (saved) {
        void close();
      }
    });
    dom.modals.quote.overlay?.addEventListener("click", (event) => {
      if (event.target === dom.modals.quote.overlay) {
        void close();
      }
    });
    dom.modals.quote.input?.addEventListener("input", () => {
      dom.modals.quote.input.classList.remove("is-invalid");
      quoteFeature.updateFormState();
    });
    dom.modals.quote.authorInput?.addEventListener("input", () => {
      quoteFeature.updateFormState();
    });
  }

  return {
    bindEvents,
    close,
    open,
  };
}
