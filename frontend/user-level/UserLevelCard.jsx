import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { getUserLevelMetrics } from "./levelMetrics.js";

function formatRemainingLabel(metrics) {
  if (metrics.level === 0) {
    return "1 workout left until Level 1";
  }

  if (metrics.remainingToNextLevel === 1) {
    return `1 workout left until Level ${metrics.nextLevel}`;
  }

  return `${metrics.remainingToNextLevel} тренировок до уровня ${metrics.nextLevel}`;
}

function getCardPadding(variant) {
  return variant === "compact" ? "ul-p-3.5" : "ul-p-4";
}

export function UserLevelCard({ workoutCount = 0, variant = "full" }) {
  const metrics = getUserLevelMetrics(workoutCount);
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={shouldReduceMotion ? undefined : { y: -1, scale: 1.005 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.995 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className={`ul-relative ul-isolate ul-overflow-hidden ul-rounded-[24px] ul-border ${getCardPadding(variant)} ul-backdrop-blur-xl`}
      style={{
        borderColor: "rgba(255,255,255,0.09)",
        background:
          "radial-gradient(circle at 100% 100%, rgba(208,165,40,0.14), transparent 24%), linear-gradient(180deg, rgba(34,35,42,0.96), rgba(21,22,28,0.98))",
        boxShadow:
          "0 18px 40px rgba(0,0,0,0.34), inset 0 1px 0 rgba(255,255,255,0.03)",
      }}
    >
      <div
        aria-hidden="true"
        className="ul-pointer-events-none ul-absolute ul-bottom-[-24px] ul-right-[-14px] ul-h-24 ul-w-24 ul-rounded-full ul-blur-2xl"
        style={{ background: "rgba(208,165,40,0.18)" }}
      />

      <div className="ul-relative ul-flex ul-flex-col ul-gap-3">
        <div className="ul-flex ul-items-start ul-justify-between ul-gap-3">
          <div className="ul-max-w-[240px] ul-text-[12px] ul-font-semibold ul-leading-5 ul-text-white/92">
        Текущий прогресс
          </div>
          <div className="ul-text-right ul-text-[13px] ul-font-semibold ul-leading-5 ul-text-white">
            {metrics.progressLabel.replace(" / ", " / ")}
          </div>
        </div>

        <div
          className="ul-relative ul-h-4 ul-overflow-hidden ul-rounded-full ul-border"
          style={{
            borderColor: "rgba(0,0,0,0.28)",
            background: "linear-gradient(180deg, rgba(10,11,15,0.78), rgba(18,19,24,0.88))",
            boxShadow: "inset 0 2px 6px rgba(0,0,0,0.4)",
          }}
        >
          <div
            aria-hidden="true"
            className="ul-absolute ul-inset-y-[2px] ul-left-2 ul-right-2 ul-rounded-full"
            style={{
              background:
                "linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.14), rgba(255,255,255,0.03))",
            }}
          />

          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${metrics.progressPercent}%` }}
            transition={{
              duration: shouldReduceMotion ? 0.12 : 0.9,
              ease: [0.16, 1, 0.3, 1],
            }}
            className="ul-relative ul-h-full ul-rounded-full"
            style={{
              background:
                "linear-gradient(90deg, rgba(63,162,255,0.96) 0%, rgba(105,180,255,0.98) 62%, rgba(208,165,40,0.9) 100%)",
              boxShadow:
                "0 0 14px rgba(63,162,255,0.22), 0 0 24px rgba(208,165,40,0.12)",
            }}
          >
            <motion.div
              aria-hidden="true"
              className="ul-absolute ul-inset-y-0 ul-w-12 ul-rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.34), rgba(255,255,255,0.05))",
                filter: "blur(8px)",
              }}
              animate={shouldReduceMotion ? undefined : { x: ["-120%", "220%"] }}
              transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.1, ease: "easeInOut" }}
            />
          </motion.div>
        </div>

        <div className="ul-flex ul-flex-wrap ul-items-center ul-justify-between ul-gap-3 ul-text-[12px] ul-font-medium">
          <span className="ul-text-white/92">Уровень {metrics.level}</span>
          <span className="ul-text-right ul-text-white/92">{formatRemainingLabel(metrics)}</span>
        </div>
      </div>
    </motion.section>
  );
}
