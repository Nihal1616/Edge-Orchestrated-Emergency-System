import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEmergency } from "../context/EmergencyContext";

const ConfidenceBar = ({ value }) => {
  const color = value >= 85 ? "#22c55e" : value >= 70 ? "#f59e0b" : "#ef4444";
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs mb-1" style={{ color: "rgba(255,255,255,0.6)" }}>
        <span>Confidence</span>
        <span style={{ color }}>{value}%</span>
      </div>
      <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 4, height: 6 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ height: "100%", borderRadius: 4, background: color }}
        />
      </div>
    </div>
  );
};

const MetricChip = ({ label, value, color = "#60a5fa" }) => (
  <div style={{
    background: "rgba(255,255,255,0.07)", borderRadius: 8, padding: "8px 12px",
    border: "1px solid rgba(255,255,255,0.1)"
  }}>
    <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 10, marginBottom: 2 }}>{label}</div>
    <div style={{ color, fontWeight: 700, fontSize: 14 }}>{value}</div>
  </div>
);

export default function AIDecisionPanel() {
  const { state, clearAiDecision } = useEmergency();
  const { aiDecision } = state;
  const [showWhyNot, setShowWhyNot] = useState(false);

  if (!aiDecision) return null;

  const trafficColors = { light: "#22c55e", moderate: "#f59e0b", heavy: "#f97316", severe: "#ef4444" };
  const tColor = trafficColors[aiDecision.trafficCondition] || "#f59e0b";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 60 }}
        style={{
          position: "fixed", top: 72, right: 12, width: 320, zIndex: 1000,
          background: "linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.97) 100%)",
          backdropFilter: "blur(20px)",
          border: "1px solid rgba(99,102,241,0.3)",
          borderRadius: 16,
          boxShadow: "0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.15)",
          fontFamily: "Inter, system-ui, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          background: "linear-gradient(90deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))",
          padding: "12px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>🧠</span>
            <span style={{ color: "#c7d2fe", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em" }}>
              AI DECISION PANEL
            </span>
          </div>
          <button
            onClick={clearAiDecision}
            style={{ color: "rgba(255,255,255,0.4)", background: "none", border: "none", cursor: "pointer", fontSize: 16, lineHeight: 1 }}
          >×</button>
        </div>

        <div style={{ padding: "14px 16px" }}>
          {/* Confidence */}
          <ConfidenceBar value={aiDecision.confidence} />

          {/* Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
            <MetricChip label="Total Distance" value={`${aiDecision.distanceKm} km`} color="#60a5fa" />
            <MetricChip label="Traffic Factor" value={`×${aiDecision.trafficFactor}`} color={tColor} />
            <MetricChip label="Hospital Capacity" value={`${aiDecision.capacityScore}%`} color="#34d399" />
            <MetricChip label="Condition" value={aiDecision.trafficCondition?.toUpperCase()} color={tColor} />
          </div>

          {/* Ambulance reason */}
          <div style={{ marginTop: 14, background: "rgba(59,130,246,0.1)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(59,130,246,0.2)" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>🚑</span>
              <div>
                <div style={{ color: "#93c5fd", fontSize: 11, fontWeight: 600, marginBottom: 3 }}>AMBULANCE SELECTION</div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 1.5 }}>{aiDecision.ambulanceReason}</div>
              </div>
            </div>
          </div>

          {/* Hospital reason */}
          <div style={{ marginTop: 8, background: "rgba(52,211,153,0.1)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(52,211,153,0.2)" }}>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>🏥</span>
              <div>
                <div style={{ color: "#6ee7b7", fontSize: 11, fontWeight: 600, marginBottom: 3 }}>HOSPITAL SELECTION</div>
                <div style={{ color: "rgba(255,255,255,0.75)", fontSize: 12, lineHeight: 1.5 }}>{aiDecision.hospitalReason}</div>
              </div>
            </div>
          </div>

          {/* Why not others */}
          <button
            onClick={() => setShowWhyNot(v => !v)}
            style={{
              marginTop: 10, width: "100%", padding: "7px 12px",
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8, color: "rgba(255,255,255,0.6)", fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between"
            }}
          >
            <span>Why not others?</span>
            <span style={{ fontSize: 10 }}>{showWhyNot ? "▲" : "▼"}</span>
          </button>

          <AnimatePresence>
            {showWhyNot && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                style={{ overflow: "hidden" }}
              >
                <div style={{ marginTop: 8 }}>
                  {aiDecision.otherAmbulances.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginBottom: 4, fontWeight: 600 }}>OTHER AMBULANCES</div>
                      {aiDecision.otherAmbulances.map(a => (
                        <div key={a.id} style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "flex-start" }}>
                          <span style={{ color: "#f87171", fontSize: 10, flexShrink: 0, marginTop: 1 }}>✗</span>
                          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}><b style={{ color: "rgba(255,255,255,0.7)" }}>{a.id}</b> — {a.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {aiDecision.otherHospitals.length > 0 && (
                    <div>
                      <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginBottom: 4, fontWeight: 600 }}>OTHER HOSPITALS</div>
                      {aiDecision.otherHospitals.map(h => (
                        <div key={h.name} style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "flex-start" }}>
                          <span style={{ color: "#f87171", fontSize: 10, flexShrink: 0, marginTop: 1 }}>✗</span>
                          <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 11 }}><b style={{ color: "rgba(255,255,255,0.7)" }}>{h.name}</b> — {h.reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
