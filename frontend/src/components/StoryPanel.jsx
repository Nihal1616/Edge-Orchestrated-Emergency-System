import { motion } from "framer-motion";
import { useEmergency } from "../context/EmergencyContext";

const STEPS = [
  { id: "trigger", label: "Emergency triggered" },
  { id: "ai", label: "AI classifies severity" },
  { id: "assign", label: "Ambulance assigned" },
  { id: "route", label: "Route optimized" },
  { id: "hospital", label: "Hospital selected" },
  { id: "adapt", label: "System adapts to failure" },
];

export default function StoryPanel() {
  const { state } = useEmergency();
  const activePhase = state.activeEmergency?.phase || null;
  const stepIndex = STEPS.findIndex(
    (step) =>
      step.id ===
      (activePhase === "toPatient"
        ? "route"
        : activePhase === "toHospital"
          ? "hospital"
          : null),
  );
  const activeStep = stepIndex >= 0 ? stepIndex : state.activeEmergency ? 1 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: "rgba(15,23,42,0.95)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 18,
        padding: 16,
        width: 280,
        color: "#e2e8f0",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 18 }}>🧭</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>DEMO STORY MODE</div>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}>
            Follow the system decision flow
          </div>
        </div>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {STEPS.map((step, index) => {
          const completed = index <= activeStep;
          return (
            <div
              key={step.id}
              style={{ display: "flex", gap: 10, alignItems: "center" }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 999,
                  background: completed ? "#6366f1" : "rgba(255,255,255,0.08)",
                  color: completed ? "#fff" : "rgba(255,255,255,0.5)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {index + 1}
              </div>
              <div
                style={{
                  color: completed ? "#f8fafc" : "rgba(255,255,255,0.45)",
                  fontSize: 12,
                }}
              >
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
