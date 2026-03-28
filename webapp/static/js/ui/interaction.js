/*
 * Контроллер низкоуровневых пользовательских взаимодействий.
 * Он следит за клавиатурой на мобильных устройствах, enter-submit у полей,
 * блокировкой скролла под модалками, стабилизацией viewport и безопасным фокусом.
 * По сути это инфраструктурный слой, на который опираются модалки и экраны.
 */
export function createInteractionController() {
  const enterFieldBehaviors = new WeakMap();
  let stableViewportHeight = 0;
  let viewportFreezeUntil = 0;

  function freezeViewportFor(ms = 240) {
    viewportFreezeUntil = Math.max(viewportFreezeUntil, Date.now() + ms);
  }

  function focusWithoutScroll(node) {
    if (!node || typeof node.focus !== "function") {
      return;
    }

    try {
      node.focus({ preventScroll: true });
    } catch (error) {
      node.focus();
    }
  }

  function blurSubmittedField(node) {
    if (node instanceof HTMLElement && typeof node.blur === "function") {
      node.blur();
    }
    freezeViewportFor(220);
  }

  function blurActiveField() {
    const active = document.activeElement;
    if (!active || !(active instanceof HTMLElement)) {
      return;
    }

    const isEditable =
      active.tagName === "INPUT" ||
      active.tagName === "TEXTAREA" ||
      active.tagName === "SELECT" ||
      active.isContentEditable;

    if (!isEditable || typeof active.blur !== "function") {
      return;
    }

    active.blur();
    freezeViewportFor(220);
  }

  function registerEnterFieldBehavior(node, behavior = {}) {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    enterFieldBehaviors.set(node, behavior);
  }

  // Централизованно определяем поля, где Enter должен работать как подтверждение ввода.
  function isEnterManagedField(node) {
    return (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement
    );
  }

  async function handleEnterFieldKeydown(event) {
    if (
      event.key !== "Enter" ||
      event.defaultPrevented ||
      event.isComposing ||
      event.repeat ||
      !isEnterManagedField(event.target) ||
      event.target.disabled ||
      event.target.readOnly ||
      event.target.type === "hidden"
    ) {
      return;
    }

    event.preventDefault();

    const field = event.target;
    const behavior = enterFieldBehaviors.get(field);

    try {
      const result =
        typeof behavior?.submit === "function" ? await behavior.submit(field, event) : true;
      if (result === false) {
        return;
      }
    } catch (error) {
      console.error("enter field submission failed", error);
      return;
    }

    blurSubmittedField(field);
  }

  function shouldDismissKeyboard(target) {
    if (!(target instanceof Element)) {
      return false;
    }

    return !target.closest(
      "input, textarea, select, button, label, .counter-btn, .draft-action-btn, .action-card, .icon-btn, [role='button']"
    );
  }

  function setBodyScrollLock(locked) {
    document.documentElement.classList.toggle("modal-open", locked);
    document.body.classList.toggle("modal-open", locked);
  }

  function syncViewportHeight(force = false) {
    if (!force && Date.now() < viewportFreezeUntil) {
      return;
    }

    const nextHeight = Math.round(
      window.visualViewport?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight ||
        0
    );

    if (!nextHeight) {
      return;
    }

    const active = document.activeElement;
    const keyboardLikelyOpen =
      !!active &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable);

    if (!force && stableViewportHeight) {
      if (keyboardLikelyOpen) {
        freezeViewportFor(320);
        return;
      }

      if (nextHeight < stableViewportHeight) {
        return;
      }

      const delta = nextHeight - stableViewportHeight;
      if (delta < 32) {
        return;
      }
    }

    stableViewportHeight = nextHeight;
    document.documentElement.style.setProperty("--app-vh", `${stableViewportHeight}px`);
  }

  function preventTapFocusShift(node) {
    if (!node) {
      return;
    }

    node.addEventListener("pointerdown", (event) => {
      event.preventDefault();
    });
  }

  function bindViewportListeners(onLayoutChange) {
    syncViewportHeight(true);

    window.addEventListener(
      "orientationchange",
      () => {
        window.setTimeout(() => {
          syncViewportHeight(true);
          onLayoutChange?.();
        }, 120);
      },
      { passive: true }
    );

    window.addEventListener(
      "resize",
      () => {
        syncViewportHeight(false);
        onLayoutChange?.();
      },
      { passive: true }
    );

    window.visualViewport?.addEventListener(
      "resize",
      () => {
        syncViewportHeight(false);
        onLayoutChange?.();
      },
      { passive: true }
    );
  }

  function bindGlobalEnterHandler() {
    document.addEventListener(
      "keydown",
      (event) => {
        void handleEnterFieldKeydown(event);
      },
      true
    );
  }

  function bindKeyboardDismissSurface(node) {
    node?.addEventListener(
      "pointerdown",
      (event) => {
        if (shouldDismissKeyboard(event.target)) {
          blurActiveField();
        }
      },
      { passive: true }
    );
  }

  return {
    blurActiveField,
    bindGlobalEnterHandler,
    bindKeyboardDismissSurface,
    bindViewportListeners,
    focusWithoutScroll,
    freezeViewportFor,
    preventTapFocusShift,
    registerEnterFieldBehavior,
    setBodyScrollLock,
    shouldDismissKeyboard,
    syncViewportHeight,
  };
}
