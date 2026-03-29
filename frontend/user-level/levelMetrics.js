export const WORKOUTS_PER_LEVEL = 10;

export function normalizeWorkoutCount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }
  return Math.floor(parsed);
}

export function getLevelFromWorkoutCount(workoutCount, workoutsPerLevel = WORKOUTS_PER_LEVEL) {
  const safeCount = normalizeWorkoutCount(workoutCount);
  if (safeCount === 0) {
    return 0;
  }
  return Math.floor(safeCount / workoutsPerLevel) + 1;
}

export function getProgressInCurrentLevel(workoutCount, workoutsPerLevel = WORKOUTS_PER_LEVEL) {
  const safeCount = normalizeWorkoutCount(workoutCount);
  if (safeCount === 0) {
    return 0;
  }
  return safeCount % workoutsPerLevel;
}

export function getUserLevelMetrics(workoutCount, workoutsPerLevel = WORKOUTS_PER_LEVEL) {
  const safeCount = normalizeWorkoutCount(workoutCount);
  const level = getLevelFromWorkoutCount(safeCount, workoutsPerLevel);
  const progressInLevel = getProgressInCurrentLevel(safeCount, workoutsPerLevel);

  if (safeCount === 0) {
    return {
      workoutCount: 0,
      workoutsPerLevel,
      level: 0,
      nextLevel: 1,
      currentLevelStart: 0,
      nextLevelAt: 1,
      progressInLevel: 0,
      progressPercent: 0,
      remainingToNextLevel: 1,
      progressLabel: `0 / ${workoutsPerLevel}`,
    };
  }

  const currentLevelStart = Math.floor(safeCount / workoutsPerLevel) * workoutsPerLevel;
  const nextLevelAt = currentLevelStart + workoutsPerLevel;
  const remainingToNextLevel = Math.max(nextLevelAt - safeCount, 0);
  const progressPercent = Number(((progressInLevel / workoutsPerLevel) * 100).toFixed(2));

  return {
    workoutCount: safeCount,
    workoutsPerLevel,
    level,
    nextLevel: level + 1,
    currentLevelStart,
    nextLevelAt,
    progressInLevel,
    progressPercent,
    remainingToNextLevel,
    progressLabel: `${progressInLevel} / ${workoutsPerLevel}`,
  };
}
