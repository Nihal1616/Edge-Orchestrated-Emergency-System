import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEmergency } from "../context/EmergencyContext";

const STEPS = [
  { id: "assigned", label: "Assigned", icon: "🎯" },
  { id: "toPatient", label: "En Route", icon: "🚑" },
  { id: "toHospital", label: "To Hospital", icon: "⚡" },
  { id: "complete", label: "Arrived", icon: "✅" },
];

function ETACountdown({ seconds }) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return (
    <div style={{ textAlign: "center" }}>
      <motion.div
        key={seconds}
        initial={{ scale: 1.15, opacity: 0.7 }}
        animate={{ scale: 1, opacity: 1 }}
        style={{ fontFamily: "monospace", fontSize: 36, fontWeight: 900, color: "#60a5fa", lineHeight: 1 }}
      >
        {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
      </motion.div>
      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginTop: 2 }}>ETA COUNTDOWN</div>
    </div>
  );
}

export default function PatientTracker() {
  const { state } = useEmergency();
  const [countdown, setCountdown] = useState(null);

  const emergency = state.activeEmergency;
  const phase = state.routePhase;

  useEffect(() => {
    if (!emergency || !state.eta) { setCountdown(null); return; }
    setCountdown(state.eta * 60);
  }, [emergency?.emergencyId, state.eta]);

  useEffect(() => {
    if (countdown === null || !emergency) return;
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(v => Math.max(0, v - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, emergency]);

  if (!emergency) return null;

  const currentStep = STEPS.findIndex(s => s.id === phase);
  const actualStep = currentStep === -1 ? 0 : currentStep;

  const trafficColors = { light: "#22c55e", moderate: "#f59e0b", heavy: "#f97316", severe: "#ef4444" };
  const tc = trafficColors[state.trafficCondition] || "#f59e0b";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        style={{
          background: "linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.97) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(99,102,241,0.25)",
          borderRadius: 16, padding: "16px",
          fontFamily: "Inter, system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
          >
            <span style={{ fontSize: 16 }}>📱</span>
          </motion.div>
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em" }}>PATIENT TRACKER</span>
          <div style={{
            marginLeft: "auto", padding: "2px 8px", borderRadius: 20,
            background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5", fontSize: 10, fontWeight: 700,
          }}>LIVE</div>
        </div>

        {/* Countdown */}
        {countdown !== null && (
          <div style={{ marginBottom: 14, background: "rgba(59,130,246,0.1)", borderRadius: 12, padding: "12px", border: "1px solid rgba(59,130,246,0.2)" }}>
            <ETACountdown seconds={countdown} />
          </div>
        )}

        {/* Progress Steps */}
        <div style={{ position: "relative", marginBottom: 14 }}>
          <div style={{
            position: "absolute", top: 16, left: "10%", right: "10%", height: 2,
            background: "rgba(255,255,255,0.1)", borderRadius: 2,
          }}>
            <motion.div
              animate={{ width: `${(actualStep / (STEPS.length - 1)) * 100}%` }}
              transition={{ duration: 0.5 }}
              style={{ height: "100%", background: "#6366f1", borderRadius: 2 }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-around", position: "relative" }}>
            {STEPS.map((step, i) => {
              const done = i <= actualStep;
              return (
                <div key={step.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <motion.div
                    animate={{ scale: i === actualStep ? [1, 1.2, 1] : 1 }}
                    transition={{ repeat: i === actualStep ? Infinity : 0, duration: 1.5 }}
                    style={{
                      width: 32, height: 32, borderRadius: "50%", fontSize: 14,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: done ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)",
                      border: `2px solid ${done ? "#6366f1" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    {step.icon}
                  </motion.div>
                  <span style={{ color: done ? "#c7d2fe" : "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: done ? 700 : 400 }}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>Progress</span>
            <span style={{ color: "#60a5fa", fontSize: 10, fontWeight: 600 }}>
              {Math.round(state.etaProgress * 100)}%
            </span>
          </div>
          <div style={{ height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3 }}>
            <motion.div
              animate={{ width: `${state.etaProgress * 100}%` }}
              transition={{ duration: 0.4 }}
              style={{ height: "100%", borderRadius: 3, background: "linear-gradient(90deg, #6366f1, #8b5cf6)" }}
            />
          </div>
        </div>

        {/* Traffic badge */}
        <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ padding: "4px 10px", borderRadius: 20, border: `1px solid ${tc}33`, background: `${tc}18`, color: tc, fontSize: 10, fontWeight: 700 }}>
            🚦 {state.trafficCondition?.toUpperCase()}
          </div>
          {state.remainingDistance && (
            <div style={{ padding: "4px 10px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.6)", fontSize: 10 }}>
              📍 {Number(state.remainingDistance).toFixed(2)} km remaining
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
