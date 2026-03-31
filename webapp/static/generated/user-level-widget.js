(function () {
  const LEVEL_THRESHOLDS = [0, 3, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50];

    function normalizeWorkoutCount(value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return 0;
    }
    return Math.floor(parsed);
  }
///здесь остановился
  function thresholdForLevel(level) {
    if (level <= 1) {
      return 0;
    }

    const thresholds = [...LEVEL_THRESHOLDS];///копируем массив 
    while (thresholds.length < level) {/// пока кол-во уровней  меньше чем сам уровень -выполнять цикл  
      const previousGap = thresholds[thresholds.length - 1] - thresholds[thresholds.length - 2];//вычитаем значение ласт уровня из предласт уровня чтобы понять сколько трен.разница
      thresholds.push(thresholds[thresholds.length - 1] + Math.max(previousGap, 2));//добавляем в массив новый уровень ,который складывается из последнего уровня + разница между уровнями 
    }
    return thresholds[level - 1];///возвращяем новый уровень 
  }

  function workoutWord(count) {
    const abs = Math.abs(count) % 100;  ////последние 2 числа  возвращается положительным в любом случае - это окончание слова 
    const last = abs % 10;// по такой же аналогии возвращается последняя цифра 
    if (abs > 10 && abs < 20) {
      return "тренировок";
    }
    if (last === 1) {
      return "тренировка";
    }
    if (last >= 2 && last <= 4) {
      return "тренировки";
    }
    return "тренировок";
  }

  function resolveLevel(workoutCount) {
    const count = normalizeWorkoutCount(workoutCount);//создаем переменную куда помещаем результат функции преобразущей кол-во  тренировок пользователя в  число 
    let level = 1; ///отсчет от 1 уровня

    while (count >= thresholdForLevel(level + 1)) {///пока кол-во тренировок больше,чем нужно для следующего  уровня прибавляем +1 к уровню
      level += 1;
    }

    return level;
  }

  function getProgress(workoutCount) {
    const count = normalizeWorkoutCount(workoutCount);//// переменная для функции,превращающей значение в число
    const level = resolveLevel(count);///переменная для функции уровня
    const currentLevelStart = thresholdForLevel(level);//возвращение нового уровня
    const nextLevelAt = thresholdForLevel(level + 1);
    const workoutsPerLevel = Math.max(nextLevelAt - currentLevelStart, 1);//разница между текущим уровнем и след.уровнем 
    const progressInLevel = Math.max(count - currentLevelStart, 0);//кол-во тренировок всего - кол-во тренировок  с которого начался уровень 
    const remainingToNextLevel = Math.max(nextLevelAt - count, 0);///сколько  тренировок будет в начале некст уровня - кол-во тренировок всего 
    const progressPercent = Number((Math.min(progressInLevel / workoutsPerLevel, 1) * 100).toFixed(1));//кол-во тренировок ,которые сделал в новом уровне /разницу между след.уровнем и  тек.,умножаем на  100 тк выйдет десятичное ,если не делится -округлить до одного знака после запятой,потом в число преобразовать

    return {
      workoutCount: count,
      level,
      nextLevel: level + 1,
      currentLevelStart,
      nextLevelAt,
      workoutsPerLevel,
      progressInLevel,
      remainingToNextLevel,
      progressPercent,
      progressLabel: `${progressInLevel} / ${workoutsPerLevel}`,
    };
  }

  function getHelperText(progress) {
    return `До следующего уровня: ${progress.remainingToNextLevel} ${workoutWord(progress.remainingToNextLevel)}`;
  }

  function getPayload(rootNode) {
    const globalPayload = window.__USER_LEVEL_WIDGET_PROFILE__ || {};
    return {
      workoutCount: normalizeWorkoutCount(globalPayload.workoutCount ?? rootNode?.dataset?.workoutCount ?? 0),
      userName: String(globalPayload.userName ?? rootNode?.dataset?.userName ?? "").trim(),
    };
  }

  function createMarkup(progress, variant) {
    const compactClass = variant === "compact" ? " user-level-widget--compact" : "";
    return `
      <section class="user-level-widget${compactClass}" aria-label="Прогресс уровня">
        <div class="user-level-widget__head">
          <div class="user-level-widget__topline">
            <p class="user-level-widget__eyebrow">Текущий прогресс</p>
            <p class="user-level-widget__value">${progress.progressLabel}</p>
          </div>
          <div class="user-level-widget__badge">Уровень ${progress.level}</div>
        </div>
        <div class="user-level-widget__track" aria-hidden="true">
          <div class="user-level-widget__fill" style="width: ${progress.progressPercent}%"></div>
        </div>
        <div class="user-level-widget__meta">
          <span class="user-level-widget__summary">${progress.workoutCount} ${workoutWord(progress.workoutCount)} всего</span>
          <span class="user-level-widget__hint">${getHelperText(progress)}</span>
        </div>
      </section>
    `;
  }

  function renderRoot(rootNode, payload) {
    if (!(rootNode instanceof HTMLElement)) {
      return;
    }

    const variant = rootNode.dataset.variant === "compact" ? "compact" : "full";
    const progress = getProgress(payload.workoutCount);

    rootNode.dataset.workoutCount = String(payload.workoutCount);
    rootNode.dataset.userName = payload.userName;
    rootNode.innerHTML = createMarkup(progress, variant);
  }

  function renderAll(detail = {}) {
    const roots = document.querySelectorAll("[data-user-level-widget]");
    roots.forEach((rootNode) => {
      const payload = {
        ...getPayload(rootNode),
        workoutCount: normalizeWorkoutCount(detail.workoutCount ?? rootNode.dataset.workoutCount ?? 0),
        userName: String(detail.userName ?? rootNode.dataset.userName ?? "").trim(),
      };
      renderRoot(rootNode, payload);
    });
  }

  renderAll();
  window.addEventListener("user-level:sync", (event) => {
    renderAll(event?.detail || {});
  });
})();
