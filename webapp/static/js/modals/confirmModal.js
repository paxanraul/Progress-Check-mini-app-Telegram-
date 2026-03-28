/*
 * Простая модалка подтверждения.
 * Используется как переиспользуемый yes/no-диалог: показывает текст,
 * ждёт действие пользователя и возвращает результат через Promise,
 * чтобы вызывающий код мог писать линейные сценарии удаления или очистки данных.
 */
import { closeOverlay, openOverlay } from "../ui/modalBase.js";

export function createConfirmModal({ state, dom, interaction, getBlockingOverlays }) {
  let confirmResolver = null;

  function closeWithResult(confirmed) {
    if (!dom.modals.confirm.overlay || dom.modals.confirm.overlay.hidden) {
      if (confirmResolver) {
        const resolver = confirmResolver;
        confirmResolver = null;
        resolver(Boolean(confirmed));
      }
      return Promise.resolve(Boolean(confirmed));
    }

    state.confirmOverlayOpen = false;
    const resolver = confirmResolver;
    confirmResolver = null;

    return closeOverlay({
      overlay: dom.modals.confirm.overlay,
      modal: dom.modals.confirm.modal,
      freezeViewportFor: interaction.freezeViewportFor,
      setBodyScrollLock: interaction.setBodyScrollLock,
      getBlockingOverlays,
    }).then(() => {
      resolver?.(Boolean(confirmed));
      return Boolean(confirmed);
    });
  }

  function cancel() {
    void closeWithResult(false);
  }

  function approve() {
    void closeWithResult(true);
  }

  function open({ text = "Вы уверены, что хотите удалить?", subtext = "" } = {}) {
    if (dom.modals.confirm.text) {
      dom.modals.confirm.text.textContent = text;
    }
    if (dom.modals.confirm.subtext) {
      dom.modals.confirm.subtext.textContent = subtext;
    }

    state.confirmOverlayOpen = true;
    openOverlay({
      overlay: dom.modals.confirm.overlay,
      modal: dom.modals.confirm.modal,
      freezeViewportFor: interaction.freezeViewportFor,
      setBodyScrollLock: interaction.setBodyScrollLock,
    });

    return new Promise((resolve) => {
      confirmResolver = resolve;
    });
  }

  function bindEvents() {
    dom.modals.confirm.closeButton?.addEventListener("click", cancel);
    dom.modals.confirm.cancelButton?.addEventListener("click", cancel);
    dom.modals.confirm.approveButton?.addEventListener("click", approve);
    dom.modals.confirm.overlay?.addEventListener("click", (event) => {
      if (event.target === dom.modals.confirm.overlay) {
        cancel();
      }
    });
  }

  return {
    bindEvents,
    closeWithResult,
    open,
  };
}
