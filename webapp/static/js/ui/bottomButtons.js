/*
 * Координатор нижних кнопок действий.
 * Модуль умеет синхронизировать два слоя интерфейса:
 * 1) inline-кнопки внутри модалок,
 * 2) системные MainButton/SecondaryButton Telegram Web App.
 * Он решает, какой набор кнопок сейчас должен быть виден, какой текст на них нужен,
 * когда показывать loading и как не перевешивать одни и те же обработчики повторно.
 */
import { TELEGRAM_BUTTON_ICON_ID } from "../core/constants.js";
import { telegramMainButton, telegramSecondaryButton } from "./telegram.js";

export function createBottomButtonsController({
  state,
  dom,
  getRecordFlowSaving,
  onWorkoutPrimary,
  onWorkoutSecondary,
  onRecordPrimary,
  onRecordSecondary,
}) {
  // WeakMap хранит runtime-состояние Telegram-кнопок между вызовами sync,
  // чтобы не дёргать Telegram API лишний раз.
  const telegramButtonState = new WeakMap();

  function getTelegramButtonState(button) {
    let runtime = telegramButtonState.get(button);
    if (!runtime) {
      runtime = {
        paramsKey: null,
        clickHandler: null,
        visible: null,
        enabled: null,
        progressVisible: null,
      };
      telegramButtonState.set(button, runtime);
    }
    return runtime;
  }

  function setBottomButtonParams(button, params) {
    if (!button || typeof button.setParams !== "function") {
      return;
    }

    const nextParams = { ...params };
    const runtime = getTelegramButtonState(button);
    const nextKey = JSON.stringify(
      Object.keys(nextParams)
        .sort()
        .reduce((accumulator, key) => {
          accumulator[key] = nextParams[key];
          return accumulator;
        }, {})
    );

    if (runtime.paramsKey === nextKey) {
      return;
    }

    button.setParams(nextParams);
    runtime.paramsKey = nextKey;
  }

  function setBottomButtonClickHandler(button, handler) {
    if (!button) {
      return;
    }

    const runtime = getTelegramButtonState(button);
    if (runtime.clickHandler === handler) {
      return;
    }

    if (runtime.clickHandler && typeof button.offClick === "function") {
      button.offClick(runtime.clickHandler);
    }
    if (handler && typeof button.onClick === "function") {
      button.onClick(handler);
    }

    runtime.clickHandler = handler || null;
  }

  function setBottomButtonProgressVisibility(button, visible) {
    if (!button) {
      return;
    }

    const runtime = getTelegramButtonState(button);
    if (runtime.progressVisible === visible) {
      return;
    }

    if (visible) {
      button.showProgress?.();
    } else {
      button.hideProgress?.();
    }

    runtime.progressVisible = visible;
  }

  function setBottomButtonEnabled(button, enabled) {
    if (!button) {
      return;
    }

    const runtime = getTelegramButtonState(button);
    if (runtime.enabled === enabled) {
      return;
    }

    if (enabled) {
      button.enable();
    } else {
      button.disable();
    }

    runtime.enabled = enabled;
  }

  function setBottomButtonVisibility(button, visible) {
    if (!button) {
      return;
    }

    const runtime = getTelegramButtonState(button);
    if (runtime.visible === visible) {
      return;
    }

    if (visible) {
      button.show();
    } else {
      button.hide();
      runtime.enabled = null;
      runtime.progressVisible = false;
    }

    runtime.visible = visible;
  }

  function applyBottomButtonState(button, config) {
    if (!button) {
      return;
    }

    if (!config || config.visible === false) {
      setBottomButtonClickHandler(button, null);
      setBottomButtonProgressVisibility(button, false);
      setBottomButtonVisibility(button, false);
      return;
    }

    setBottomButtonParams(button, config.params || {});
    setBottomButtonClickHandler(button, config.onClick || null);
    setBottomButtonEnabled(button, Boolean(config.enabled));
    setBottomButtonVisibility(button, true);
    setBottomButtonProgressVisibility(button, Boolean(config.progressVisible));
  }

  function hideTelegramBottomButtons() {
    applyBottomButtonState(telegramMainButton, { visible: false });
    applyBottomButtonState(telegramSecondaryButton, { visible: false });
  }

  function setInlineButtonLoading(button, loading) {
    if (!button) {
      return;
    }
    button.classList.toggle("is-loading", Boolean(loading));
    button.setAttribute("aria-busy", loading ? "true" : "false");
  }

  // Если модалка умеет показывать свои кнопки внутри себя, приоритет отдаём ей.
  function syncInlineBottomButtons() {
    const workoutVisible = Boolean(state.workoutFlow.open && dom.modals.workout.overlay && !dom.modals.workout.overlay.hidden);
    if (
      dom.modals.workout.flowActions &&
      dom.modals.workout.primaryActionButton &&
      dom.modals.workout.secondaryActionButton
    ) {
      dom.modals.workout.flowActions.hidden = !workoutVisible;
      if (workoutVisible) {
        const buttonText =
          state.workoutFlow.step === "form"
            ? "Сохранить упр."
            : state.workoutFlow.step === "date"
              ? "Сохранить"
              : state.workoutFlow.step === "done"
                ? "Готово"
                : "Далее";

        const buttonDisabled =
          state.workoutFlow.saving ||
          (state.workoutFlow.step === "list" && !state.workoutFlow.items.length);

        dom.modals.workout.secondaryActionButton.textContent = "Назад";
        dom.modals.workout.secondaryActionButton.disabled = state.workoutFlow.saving;
        dom.modals.workout.primaryActionButton.textContent = buttonText;
        dom.modals.workout.primaryActionButton.disabled = buttonDisabled;
        setInlineButtonLoading(dom.modals.workout.primaryActionButton, state.workoutFlow.saving);
        setInlineButtonLoading(dom.modals.workout.secondaryActionButton, false);
      }
    }

    const recordVisible = Boolean(dom.modals.record.overlay && !dom.modals.record.overlay.hidden);
    if (
      dom.modals.record.flowActions &&
      dom.modals.record.primaryActionButton &&
      dom.modals.record.secondaryActionButton
    ) {
      dom.modals.record.flowActions.hidden = !recordVisible;
      if (recordVisible) {
        const saving = Boolean(getRecordFlowSaving());
        dom.modals.record.secondaryActionButton.textContent = "Отмена";
        dom.modals.record.secondaryActionButton.disabled = saving;
        dom.modals.record.primaryActionButton.textContent = "Сохранить";
        dom.modals.record.primaryActionButton.disabled = saving;
        setInlineButtonLoading(dom.modals.record.primaryActionButton, saving);
        setInlineButtonLoading(dom.modals.record.secondaryActionButton, false);
      }
    }
  }

  function sync() {
    syncInlineBottomButtons();

    const workoutHandledInline = Boolean(
      state.workoutFlow.open &&
        dom.modals.workout.overlay &&
        !dom.modals.workout.overlay.hidden &&
        dom.modals.workout.flowActions &&
        dom.modals.workout.primaryActionButton &&
        dom.modals.workout.secondaryActionButton
    );

    const recordHandledInline = Boolean(
      dom.modals.record.overlay &&
        !dom.modals.record.overlay.hidden &&
        dom.modals.record.flowActions &&
        dom.modals.record.primaryActionButton &&
        dom.modals.record.secondaryActionButton
    );

    if (workoutHandledInline || recordHandledInline) {
      hideTelegramBottomButtons();
      return;
    }

    if (!telegramMainButton || !telegramSecondaryButton) {
      return;
    }

    if (state.workoutFlow.open) {
      const buttonText =
        state.workoutFlow.step === "form"
          ? "Сохранить упр."
          : state.workoutFlow.step === "date"
            ? "Сохранить"
            : state.workoutFlow.step === "done"
              ? "Готово"
              : "Далее";

      const buttonDisabled =
        state.workoutFlow.saving ||
        (state.workoutFlow.step === "list" && !state.workoutFlow.items.length);

      applyBottomButtonState(telegramMainButton, {
        visible: true,
        params: {
          text: buttonText,
          has_shine_effect: !buttonDisabled,
          icon_custom_emoji_id: TELEGRAM_BUTTON_ICON_ID,
        },
        onClick: onWorkoutPrimary,
        enabled: !buttonDisabled && !state.workoutFlow.saving,
        progressVisible: state.workoutFlow.saving,
      });

      applyBottomButtonState(telegramSecondaryButton, {
        visible: true,
        params: {
          text: "Назад",
          position: "left",
        },
        onClick: onWorkoutSecondary,
        enabled: true,
        progressVisible: false,
      });
      return;
    }

    if (dom.modals.record.overlay && !dom.modals.record.overlay.hidden) {
      const saving = Boolean(getRecordFlowSaving());

      applyBottomButtonState(telegramMainButton, {
        visible: true,
        params: {
          text: "Сохранить",
          has_shine_effect: !saving,
          icon_custom_emoji_id: TELEGRAM_BUTTON_ICON_ID,
        },
        onClick: onRecordPrimary,
        enabled: !saving,
        progressVisible: saving,
      });

      applyBottomButtonState(telegramSecondaryButton, {
        visible: true,
        params: {
          text: "Отмена",
          position: "left",
        },
        onClick: onRecordSecondary,
        enabled: !saving,
        progressVisible: false,
      });
      return;
    }

    hideTelegramBottomButtons();
  }

  return {
    hideAll: hideTelegramBottomButtons,
    sync,
  };
}
