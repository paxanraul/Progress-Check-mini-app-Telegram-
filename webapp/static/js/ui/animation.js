/*
 * Обёртки над библиотекой Motion.
 * Модуль задаёт типовые анимации для экранов, карточек и шагов модалок,
 * чтобы визуальное поведение было единообразным по всему приложению.
 */
const motionApi = window.Motion;
const motionAnimate = typeof motionApi?.animate === "function" ? motionApi.animate : null;
const motionStagger = typeof motionApi?.stagger === "function" ? motionApi.stagger : null;

export function runMotion(target, keyframes, options) {
  if (!motionAnimate || !target) {
    return null;
  }

  try {
    return motionAnimate(target, keyframes, options);
  } catch (error) {
    console.warn("motion animate failed", error);
    return null;
  }
}

export function animatePanelEnter(panel) {
  if (!panel) {
    return;
  }

  runMotion(
    panel,
    {
      opacity: [0, 1],
      transform: ["translateY(12px)", "translateY(0px)"],
    },
    {
      duration: 0.28,
      easing: [0.22, 1, 0.36, 1],
    }
  );
}

export function animateCollection(root, selector) {
  if (!root) {
    return;
  }

  const nodes = [...root.querySelectorAll(selector)];
  if (!nodes.length) {
    return;
  }

  runMotion(
    nodes,
    {
      opacity: [0, 1],
      transform: ["translateY(10px)", "translateY(0px)"],
    },
    {
      duration: 0.24,
      delay: motionStagger ? motionStagger(0.04) : 0,
      easing: [0.22, 1, 0.36, 1],
    }
  );
}

export function animateExerciseRows(root) {
  if (!root) {
    return;
  }

  const rows = [...root.querySelectorAll(".exercise-row")];
  if (!rows.length) {
    return;
  }

  runMotion(
    rows,
    {
      opacity: [0, 1],
      transform: ["translateX(-8px)", "translateX(0px)"],
    },
    {
      duration: 0.2,
      delay: motionStagger ? motionStagger(0.03) : 0,
      easing: [0.22, 1, 0.36, 1],
    }
  );
}

export function animateWorkoutStep(stepNode) {
  if (!stepNode) {
    return;
  }

  runMotion(
    stepNode,
    {
      opacity: [0, 1],
      transform: ["translateY(12px)", "translateY(0px)"],
    },
    { duration: 0.24, easing: [0.22, 1, 0.36, 1] }
  );
}

export function animateDraftItems(nodes) {
  if (!nodes?.length) {
    return;
  }

  runMotion(
    nodes,
    {
      opacity: [0, 1],
      transform: ["translateY(12px)", "translateY(0px)"],
    },
    {
      duration: 0.24,
      delay: motionStagger ? motionStagger(0.05) : 0,
      easing: [0.22, 1, 0.36, 1],
    }
  );
}
