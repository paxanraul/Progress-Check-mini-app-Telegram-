import React from "react";
import { createRoot } from "react-dom/client";
import { UserLevelCard } from "./UserLevelCard.jsx";
import { normalizeWorkoutCount } from "./levelMetrics.js";

function normalizeProfileData(nextProfile = {}) {
  return {
    workoutCount: normalizeWorkoutCount(nextProfile.workoutCount ?? nextProfile.workout_days ?? 0),
    userName: String(nextProfile.userName ?? nextProfile.name ?? "").trim(),
  };
}

function readInitialProfile(rootNode) {
  const globalProfile = typeof window !== "undefined" ? window.__USER_LEVEL_WIDGET_PROFILE__ : null;
  if (globalProfile) {
    return normalizeProfileData(globalProfile);
  }

  return normalizeProfileData({
    workoutCount: rootNode?.dataset?.workoutCount ?? 0,
    userName: rootNode?.dataset?.userName ?? "",
  });
}

function readVariant(rootNode) {
  return rootNode?.dataset?.variant === "compact" ? "compact" : "full";
}

function UserLevelWidgetApp({ rootNode, variant }) {
  const [profile, setProfile] = React.useState(() => readInitialProfile(rootNode));

  React.useEffect(() => {
    function sync(nextProfile = {}) {
      const normalized = normalizeProfileData(nextProfile);
      if (rootNode) {
        rootNode.dataset.workoutCount = String(normalized.workoutCount);
        rootNode.dataset.userName = normalized.userName;
      }
      if (typeof window !== "undefined") {
        window.__USER_LEVEL_WIDGET_PROFILE__ = normalized;
      }
      setProfile(normalized);
    }

    function handleSync(event) {
      sync(event?.detail || {});
    }

    window.addEventListener("user-level:sync", handleSync);
    return () => {
      window.removeEventListener("user-level:sync", handleSync);
    };
  }, [rootNode]);

  return (
    <UserLevelCard
      workoutCount={profile.workoutCount}
      userName={profile.userName}
      variant={variant}
    />
  );
}

document.querySelectorAll("[data-user-level-widget]").forEach((rootNode) => {
  const root = createRoot(rootNode);
  root.render(<UserLevelWidgetApp rootNode={rootNode} variant={readVariant(rootNode)} />);
});
