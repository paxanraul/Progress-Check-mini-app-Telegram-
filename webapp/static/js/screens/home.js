import { readFireState, writeFireState } from "../services/storage.js";
import { countBackConsecutiveDays, shiftIsoDate, todayValue } from "../shared/utils.js";

export function createHomeScreen({
  state,
  dom,
  quoteFeature,
  openWorkoutFlow,
  openQuoteOverlay,
  preventTapFocusShift,
}) {
  function computeFireStreak(history) {
    const dates = new Set();
    if (Array.isArray(history)) {
      history.forEach((day) => {
        if (day?.date && typeof day.date === "string") {
          dates.add(day.date);
        }
      });
    }

    if (!dates.size) {
      return { value: 0, active: false };
    }

    const today = todayValue();
    if (dates.has(today)) {
      return { value: countBackConsecutiveDays(dates, today), active: true };
    }

    const yesterday = shiftIsoDate(today, -1);
    if (dates.has(yesterday)) {
      return { value: countBackConsecutiveDays(dates, yesterday), active: false };
    }

    return { value: 0, active: false };
  }

  function computeFireStreakStableForDay(history) {
    const raw = computeFireStreak(history);
    const today = todayValue();
    const cached = readFireState(state.userId);

    if (!cached || cached.day !== today) {
      writeFireState(state.userId, { day: today, value: raw.value, active: raw.active });
      return raw;
    }

    const cachedValue = Number(cached.value || 0);
    const cachedActive = Boolean(cached.active);

    if ((cachedActive && !raw.active) || raw.value < cachedValue) {
      return { value: cachedValue, active: cachedActive };
    }

    writeFireState(state.userId, { day: today, value: raw.value, active: raw.active });
    return raw;
  }

  function renderDailyFireState(history) {
    if (!dom.home.fire || !dom.home.streakBadge || !dom.home.streakValue) {
      return;
    }

    const { value, active } = computeFireStreakStableForDay(history);
    dom.home.streakValue.textContent = String(value);
    dom.home.fire.classList.toggle("fire-inactive", !active);
    dom.home.streakBadge.classList.toggle("streak-inactive", !active);
  }

  function render(history = []) {
    renderDailyFireState(history);
    quoteFeature.renderSection();
  }

  function bindEvents() {
    dom.home.openWorkoutFlowButton?.addEventListener("click", openWorkoutFlow);
    dom.home.quoteManageButton?.addEventListener("click", openQuoteOverlay);
    dom.home.quoteLiveCard?.addEventListener("pointerenter", quoteFeature.pauseRotation);
    dom.home.quoteLiveCard?.addEventListener("pointerleave", quoteFeature.resumeRotation);
    preventTapFocusShift(dom.home.openWorkoutFlowButton);
  }

  return {
    bindEvents,
    render,
    renderQuotes: () => quoteFeature.renderSection(),
  };
}
