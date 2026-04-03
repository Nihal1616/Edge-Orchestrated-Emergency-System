import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EmergencyProvider, useEmergency } from "./context/EmergencyContext";
import { useSocket } from "./hooks/useSocket";
import MapView from "./components/Map/MapView";
import LeftPanel from "./components/Panels/LeftPanel";
import RightPanel from "./components/Panels/RightPanel";
import BottomPanel from "./components/Panels/BottomPanel";
import { playEmergencyAlert } from "./utils/sounds";

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="text-xs font-mono text-gray-600 tabular-nums">
      {time.toLocaleTimeString("en-US", { hour12: false })}
    </span>
  );
}

function AppInner() {
  const { state, handleEmergencyTriggered, setTriggering } = useEmergency();
  useSocket();

  const triggerEmergency = useCallback(async () => {
    setTriggering(true);
    playEmergencyAlert();
    try {
      const res = await fetch("/api/emergency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ severity: "critical" }),
      });
      const data = await res.json();
      if (data.success) {
        handleEmergencyTriggered(data.data);
      } else {
        setTriggering(false);
      }
    } catch (err) {
      console.error("Failed to trigger emergency:", err);
      setTriggering(false);
    }
  }, [handleEmergencyTriggered, setTriggering]);

  return (
    <div
      className="relative w-screen h-screen overflow-hidden grid-bg"
      style={{ fontFamily: "Rajdhani, sans-serif" }}
    >
      {/* Background radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 50% 40%, rgba(0,40,90,0.25) 0%, rgba(3,7,18,0) 65%)",
        }}
      />

      {/* Emergency flash overlay */}
      <AnimatePresence>
        {state.isTriggeringEmergency && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.2, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, times: [0, 0.3, 1] }}
            className="absolute inset-0 z-50 pointer-events-none"
            style={{ background: "#ff2020" }}
          />
        )}
      </AnimatePresence>

      {/* Layout */}
      <div className="absolute inset-0 flex flex-col">
        {/* ── Top Bar ── */}
        <div className="h-10 flex-shrink-0 glass-card border-b border-blue-900/30 flex items-center px-4 justify-between z-20">
          <div className="flex items-center gap-3">
            <span className="text-red-500 font-display text-sm font-black tracking-[0.2em]">
              EERS
            </span>
            <span className="text-gray-700 text-xs">│</span>
            <span className="text-blue-400/50 text-xs font-mono tracking-wider hidden sm:block">
              EDGE-ORCHESTRATED EMERGENCY RESPONSE SYSTEM
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Clock />
            <div
              className={`px-2 py-0.5 rounded text-xs font-mono transition-colors ${
                state.isConnected
                  ? "text-green-400 bg-green-900/20 border border-green-800/30"
                  : "text-red-400 bg-red-900/20 border border-red-800/30"
              }`}
            >
              {state.isConnected ? "● CONNECTED" : "○ OFFLINE"}
            </div>
          </div>
        </div>

        {/* ── Main Row ── */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Left Panel */}
          <div className="w-72 flex-shrink-0 glass-card border-r border-blue-900/20 p-4 overflow-y-auto z-10">
            <LeftPanel onTriggerEmergency={triggerEmergency} />
          </div>

          {/* Map */}
          <div className="flex-1 relative min-w-0">
            <MapView />
          </div>

          {/* Right Panel */}
          <div className="w-64 flex-shrink-0 glass-card border-l border-blue-900/20 p-4 overflow-y-auto z-10">
            <RightPanel />
          </div>
        </div>

        {/* ── Bottom Log Panel ── */}
        <div className="h-36 flex-shrink-0 glass-card border-t border-blue-900/30 px-4 py-2 z-20">
          <BottomPanel />
        </div>
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
