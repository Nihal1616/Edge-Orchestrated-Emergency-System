import { useCallback } from "react";
import { motion } from "framer-motion";
import { useEmergency } from "../context/EmergencyContext";
import { useSocket } from "../hooks/useSocket";

const trafficLabels = ["", "Light", "Moderate", "Heavy", "Severe", "Gridlock"];
const trafficColors = ["", "#22c55e", "#f59e0b", "#f97316", "#ef4444", "#7c3aed"];

export default function SimulationControl({ onTrigger, onDisaster }) {
  const { state, setMlEnabled, setTrafficIntensity, setDisasterMode } = useEmergency();
  const { emitSimControl } = useSocket();

  const handleTrafficChange = useCallback((val) => {
    setTrafficIntensity(val);
    emitSimControl({ type: "setTraffic", level: val });
  }, [setTrafficIntensity, emitSimControl]);

  const handleMlToggle = useCallback(() => {
    const next = !state.mlEnabled;
    setMlEnabled(next);
    emitSimControl({ type: "setML", enabled: next });
  }, [state.mlEnabled, setMlEnabled, emitSimControl]);

  const handleDisaster = useCallback(() => {
    setDisasterMode(true);
    onDisaster?.();
    setTimeout(() => setDisasterMode(false), 3000);
  }, [setDisasterMode, onDisaster]);

  const tColor = trafficColors[state.trafficIntensity] || "#f59e0b";
  const tLabel = trafficLabels[state.trafficIntensity] || "Moderate";

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.97) 100%)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      padding: "16px",
      fontFamily: "Inter, system-ui, sans-serif",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 16 }}>🎮</span>
        <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em" }}>SIMULATION CONTROL</span>
      </div>

      {/* Traffic Intensity */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600 }}>TRAFFIC INTENSITY</span>
          <span style={{ color: tColor, fontSize: 11, fontWeight: 700 }}>{tLabel}</span>
        </div>
        <input
          type="range" min={1} max={5} value={state.trafficIntensity}
          onChange={e => handleTrafficChange(Number(e.target.value))}
          style={{ width: "100%", accentColor: tColor, cursor: "pointer" }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
          <span style={{ color: "#22c55e", fontSize: 9 }}>Light</span>
          <span style={{ color: "#7c3aed", fontSize: 9 }}>Gridlock</span>
        </div>
      </div>

      {/* ML Toggle */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "10px 12px",
        marginBottom: 10, border: "1px solid rgba(255,255,255,0.08)"
      }}>
        <div>
          <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>ML Engine</div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>
            {state.mlAvailable ? "FastAPI connected" : "Fallback mode"}
          </div>
        </div>
        <button
          onClick={handleMlToggle}
          style={{
            width: 42, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
            background: state.mlEnabled ? "#6366f1" : "rgba(255,255,255,0.15)",
            position: "relative", transition: "background 0.2s",
          }}
        >
          <motion.div
            animate={{ x: state.mlEnabled ? 20 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", position: "absolute", top: 3 }}
          />
        </button>
      </div>

      {/* Action buttons */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <button
          onClick={onTrigger}
          disabled={state.isTriggeringEmergency}
          style={{
            padding: "10px", borderRadius: 10, border: "1px solid rgba(239,68,68,0.3)",
            background: "rgba(239,68,68,0.15)", color: "#fca5a5", fontSize: 12,
            fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
          }}
        >
          🚨 Trigger
        </button>
        <button
          onClick={handleDisaster}
          disabled={state.disasterMode}
          style={{
            padding: "10px", borderRadius: 10, border: "1px solid rgba(245,158,11,0.3)",
            background: state.disasterMode ? "rgba(245,158,11,0.3)" : "rgba(245,158,11,0.12)",
            color: "#fcd34d", fontSize: 12, fontWeight: 700, cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          {state.disasterMode ? "⚡ ACTIVE" : "⚠️ Disaster"}
        </button>
      </div>
    </div>
  );
}
