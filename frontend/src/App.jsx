import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EmergencyProvider, useEmergency } from "./context/EmergencyContext";
import { useSocket } from "./hooks/useSocket";
import MapView from "./components/Map/MapView";
import AIDecisionPanel from "./components/AIDecisionPanel";
import SimulationControl from "./components/SimulationControl";
import CommandDashboard from "./components/CommandDashboard";
import PatientTracker from "./components/PatientTracker";
import PostEmergencyReport from "./components/PostEmergencyReport";
import DisasterAlert from "./components/DisasterAlert";
import StoryPanel from "./components/StoryPanel";
import { playEmergencyAlert } from "./utils/sounds";

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span
      style={{
        fontFamily: "monospace",
        fontSize: 13,
        color: "rgba(255,255,255,0.5)",
        letterSpacing: "0.05em",
      }}
    >
      {time.toLocaleTimeString("en-US", { hour12: false })}
    </span>
  );
}

function AppInner() {
  const {
    state,
    handleEmergencyTriggered,
    setTriggering,
    setDisasterMode,
    setLiveMode,
    setStoryStep,
  } = useEmergency();
  const { requestState, emitSimControl } = useSocket();
  const [disasterActive, setDisasterActive] = useState(false);
  const [leftOpen, setLeftOpen] = useState(true);
  const [liveSimulationActive, setLiveSimulationActive] = useState(false);

  // Auto-center on user location once
  useEffect(() => {
    if (!navigator.geolocation) return;
    if (window.sessionStorage.getItem("eers-location-init") === "1") return;
    window.sessionStorage.setItem("eers-location-init", "1");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await fetch("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            }),
          });
          requestState();
        } catch (e) {
          console.error(e);
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 },
    );
  }, [requestState]);

  const triggerEmergency = useCallback(
    async (severity = "critical") => {
      if (severity && typeof severity === "object" && "target" in severity) {
        severity = "critical";
      }
      setTriggering(true);
      setStoryStep("trigger");
      playEmergencyAlert();
      try {
        const res = await fetch("/api/emergency", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ severity }),
        });
        const data = await res.json();
        if (data.success) {
          handleEmergencyTriggered(data.data);
          setStoryStep("ai");
        } else {
          setTriggering(false);
        }
      } catch (err) {
        console.error(err);
        setTriggering(false);
      }
    },
    [handleEmergencyTriggered, setStoryStep, setTriggering],
  );

  useEffect(() => {
    let interval;
    if (liveSimulationActive) {
      setLiveMode(true);
      interval = setInterval(() => {
        const severity = Math.random() < 0.5 ? "critical" : "high";
        triggerEmergency(severity);
      }, 10000);
    } else {
      setLiveMode(false);
    }
    return () => clearInterval(interval);
  }, [liveSimulationActive, setLiveMode, triggerEmergency]);

  const triggerDisaster = useCallback(async () => {
    setDisasterActive(true);
    setTimeout(() => setDisasterActive(false), 2500);
    // Trigger 3 emergencies in quick succession
    const severities = ["critical", "critical", "high"];
    for (const sev of severities) {
      await new Promise((r) => setTimeout(r, 400));
      triggerEmergency(sev);
    }
  }, [triggerEmergency]);

  const switchCity = useCallback(
    async (city) => {
      try {
        await fetch("/api/city", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city }),
        });
        requestState();
      } catch (err) {
        console.error(err);
      }
    },
    [requestState],
  );

  const trafficColors = {
    light: "#22c55e",
    moderate: "#f59e0b",
    heavy: "#f97316",
    severe: "#ef4444",
  };
  const tc = trafficColors[state.trafficCondition] || "#f59e0b";
  const availableAmbs = state.ambulances.filter(
    (a) => a.status === "available",
  ).length;

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: "#0f172a",
        fontFamily: "Inter, system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* DISASTER OVERLAY */}
      <DisasterAlert active={disasterActive} />

      {/* TOP HEADER */}
      <header
        style={{
          height: 52,
          flexShrink: 0,
          zIndex: 100,
          background:
            "linear-gradient(90deg, rgba(15,23,42,0.98), rgba(30,41,59,0.98))",
          borderBottom: "1px solid rgba(255,255,255,0.07)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 16px",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <motion.div
            animate={
              state.activeEmergencies.length > 0 ? { scale: [1, 1.2, 1] } : {}
            }
            transition={{ repeat: Infinity, duration: 1.2 }}
            style={{ fontSize: 20 }}
          >
            🚨
          </motion.div>
          <div>
            <div
              style={{
                color: "#e2e8f0",
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: "0.02em",
              }}
            >
              EERS <span style={{ color: "#6366f1" }}>Command</span>
            </div>
            <div
              style={{
                color: "rgba(255,255,255,0.35)",
                fontSize: 9,
                letterSpacing: "0.08em",
              }}
            >
              EDGE-ORCHESTRATED EMERGENCY RESPONSE
            </div>
          </div>
        </div>

        {/* Status pills */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Clock />

          {/* Connection status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "4px 10px",
              borderRadius: 20,
              background: state.isConnected
                ? "rgba(34,197,94,0.12)"
                : "rgba(239,68,68,0.12)",
              border: `1px solid ${state.isConnected ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
            }}
          >
            <motion.div
              animate={state.isConnected ? { scale: [1, 1.4, 1] } : {}}
              transition={{ repeat: Infinity, duration: 2 }}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: state.isConnected ? "#22c55e" : "#ef4444",
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: state.isConnected ? "#4ade80" : "#f87171",
              }}
            >
              {state.isConnected ? "LIVE" : "OFFLINE"}
            </span>
          </div>

          {/* Traffic */}
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 700,
              background: `${tc}18`,
              border: `1px solid ${tc}33`,
              color: tc,
            }}
          >
            🚦 {state.trafficCondition?.toUpperCase()}
          </div>

          {/* ML status */}
          <div
            style={{
              padding: "4px 10px",
              borderRadius: 20,
              fontSize: 10,
              fontWeight: 700,
              background: state.mlAvailable
                ? "rgba(99,102,241,0.12)"
                : "rgba(255,255,255,0.05)",
              border: `1px solid ${state.mlAvailable ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.1)"}`,
              color: state.mlAvailable ? "#a5b4fc" : "rgba(255,255,255,0.3)",
            }}
          >
            🧠 ML {state.mlAvailable ? "ON" : "OFF"}
          </div>

          {/* Ambulances */}
          <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
            🚑 {availableAmbs}/{state.ambulances.length}
          </div>

          {/* Panel toggle */}
          <button
            onClick={() => setLeftOpen((v) => !v)}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.05)",
              color: "rgba(255,255,255,0.5)",
              fontSize: 10,
              cursor: "pointer",
            }}
          >
            {leftOpen ? "◀ Hide" : "▶ Panels"}
          </button>
        </div>
      </header>

      {/* MAIN BODY */}
      <div
        style={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* LEFT PANEL */}
        <AnimatePresence>
          {leftOpen && (
            <motion.aside
              initial={{ x: -320, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -320, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{
                width: 300,
                flexShrink: 0,
                overflowY: "auto",
                zIndex: 50,
                background: "rgba(10,15,30,0.95)",
                borderRight: "1px solid rgba(255,255,255,0.06)",
                padding: "12px 10px 20px",
                display: "flex",
                flexDirection: "column",
                gap: 14,
                minHeight: 0,
                maxHeight: "calc(100vh - 62px)",
              }}
            >
              {/* City switcher */}
              <div
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 12,
                  padding: "12px",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                <div
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 10,
                    fontWeight: 600,
                    marginBottom: 8,
                    letterSpacing: "0.08em",
                  }}
                >
                  📍 CITY · {state.cityName}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {["Hyderabad", "Bangalore", "Kurnool", "Nandyal"].map(
                    (city) => (
                      <button
                        key={city}
                        onClick={() => switchCity(city)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.1)",
                          background:
                            state.cityName === city
                              ? "rgba(99,102,241,0.2)"
                              : "rgba(255,255,255,0.04)",
                          color:
                            state.cityName === city
                              ? "#c7d2fe"
                              : "rgba(255,255,255,0.5)",
                          fontSize: 11,
                          cursor: "pointer",
                          transition: "all 0.15s",
                        }}
                      >
                        {city}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <SimulationControl
                onTrigger={triggerEmergency}
                onDisaster={triggerDisaster}
                liveMode={liveSimulationActive}
                onLiveModeToggle={() => setLiveSimulationActive((v) => !v)}
                onTrafficSpike={() => emitSimControl({ type: "trafficSpike" })}
              />
              <StoryPanel />
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <CommandDashboard />
                <PostEmergencyReport />
              </div>

              {/* Activity log */}
              <div
                style={{
                  background: "rgba(255,255,255,0.03)",
                  borderRadius: 12,
                  padding: "12px",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div
                  style={{
                    color: "rgba(255,255,255,0.4)",
                    fontSize: 10,
                    fontWeight: 600,
                    marginBottom: 8,
                    letterSpacing: "0.08em",
                  }}
                >
                  📋 ACTIVITY LOG
                </div>
                <div style={{ maxHeight: 160, overflowY: "auto" }}>
                  {state.logs.slice(0, 12).map((log, index) => (
                    <div
                      key={`${log.id}-${index}`}
                      style={{
                        fontSize: 10,
                        color: "rgba(255,255,255,0.5)",
                        padding: "3px 0",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        lineHeight: 1.4,
                      }}
                    >
                      {log.message}
                    </div>
                  ))}
                  {state.logs.length === 0 && (
                    <div
                      style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}
                    >
                      No activity yet
                    </div>
                  )}
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* MAP */}
        <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
          <MapView />

          {/* FLOATING TRIGGER BUTTON */}
          <div
            style={{
              position: "absolute",
              bottom: 20,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 200,
              display: "flex",
              gap: 10,
            }}
          >
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => triggerEmergency("critical")}
              disabled={state.isTriggeringEmergency}
              style={{
                padding: "12px 28px",
                borderRadius: 50,
                background: state.isTriggeringEmergency
                  ? "rgba(239,68,68,0.4)"
                  : "linear-gradient(135deg, #ef4444, #dc2626)",
                border: "none",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor: state.isTriggeringEmergency ? "wait" : "pointer",
                boxShadow: "0 8px 30px rgba(239,68,68,0.4)",
                letterSpacing: "0.05em",
              }}
            >
              {state.isTriggeringEmergency
                ? "⏳ Dispatching..."
                : "🚨 EMERGENCY"}
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              onClick={triggerDisaster}
              style={{
                padding: "12px 20px",
                borderRadius: 50,
                background:
                  "linear-gradient(135deg, rgba(245,158,11,0.9), rgba(217,119,6,0.9))",
                border: "none",
                color: "#fff",
                fontWeight: 800,
                fontSize: 14,
                cursor: "pointer",
                boxShadow: "0 8px 30px rgba(245,158,11,0.3)",
              }}
            >
              ⚡ DISASTER
            </motion.button>
          </div>

          {/* Active emergencies badge */}
          {state.activeEmergencies.length > 0 && (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{
                position: "absolute",
                top: 12,
                right: 12,
                zIndex: 200,
                background: "rgba(239,68,68,0.92)",
                backdropFilter: "blur(10px)",
                borderRadius: 20,
                padding: "6px 14px",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                fontWeight: 800,
                fontSize: 13,
                boxShadow: "0 4px 20px rgba(239,68,68,0.4)",
              }}
            >
              🚨 {state.activeEmergencies.length} ACTIVE
            </motion.div>
          )}
        </div>

        {/* AI PANEL (right floating) */}
        <AIDecisionPanel />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <EmergencyProvider>
      <AppInner />
    </EmergencyProvider>
  );
}
