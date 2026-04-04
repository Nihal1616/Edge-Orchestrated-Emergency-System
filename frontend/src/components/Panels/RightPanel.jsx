import { motion, AnimatePresence } from "framer-motion";
import { useEmergency } from "../../context/EmergencyContext";

const TRAFFIC_CONFIG = {
  light: { color: "#00ff88", label: "LIGHT", icon: "🟢", bg: "bg-green-900/20 border-green-800/30" },
  moderate: { color: "#ffaa00", label: "MODERATE", icon: "🟡", bg: "bg-yellow-900/20 border-yellow-800/30" },
  heavy: { color: "#ff6600", label: "HEAVY", icon: "🟠", bg: "bg-orange-900/20 border-orange-800/30" },
  severe: { color: "#ff2020", label: "SEVERE", icon: "🔴", bg: "bg-red-900/20 border-red-800/30" },
};

function ETADisplay({ eta }) {
  if (!eta) return null;
  const mins = Math.floor(eta);
  const secs = 0;

  return (
    <div className="text-center">
      <div className="font-display text-5xl font-black text-neon-blue leading-none">
        {String(mins).padStart(2, "0")}
        <span className="text-2xl text-blue-600 animate-pulse">:</span>
        <span className="text-3xl">{String(secs).padStart(2, "0")}</span>
      </div>
      <div className="text-xs font-mono text-blue-400/50 tracking-widest mt-1">MIN : SEC</div>
    </div>
  );
}

function ProgressBar({ value = 0, color = "#0088ff", label }) {
  return (
    <div>
      {label && <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-1">{label}</div>}
      <div className="h-1.5 bg-blue-950/50 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, value * 100)}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
    </div>
  );
}

export default function RightPanel() {
  const { state } = useEmergency();
  const { activeEmergency, eta, etaProgress, routePhase, remainingDistance, trafficCondition } = state;

  const traffic = TRAFFIC_CONFIG[trafficCondition] || TRAFFIC_CONFIG.moderate;

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto p-1">
      {/* Header */}
      <div>
        <h2 className="font-display text-xs tracking-[0.2em] text-blue-400/70 uppercase">
          Response
        </h2>
        <h3 className="font-display text-base font-bold text-neon-blue leading-tight">
          Overview
        </h3>
      </div>

      {/* ETA Panel */}
      <div className={`glass-card rounded-lg p-4 ${activeEmergency ? "glass-card-emergency" : ""}`}>
        <div className="text-xs font-display tracking-widest text-blue-400/50 uppercase mb-4">
          ETA
        </div>

        <AnimatePresence mode="wait">
          {activeEmergency ? (
            <motion.div
              key="eta-active"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <ETADisplay eta={eta} />
              <div className="mt-4">
                <ProgressBar
                  value={etaProgress}
                  color={routePhase === "toPatient" ? "#ffaa00" : "#0088ff"}
                  label="Progress"
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="eta-idle"
              className="text-center py-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="font-display text-4xl font-black text-blue-900/50 leading-none">
                --:--
              </div>
              <div className="text-xs font-mono text-gray-700 tracking-widest mt-1">IDLE</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mission Summary */}
      <div className="glass-card rounded-lg p-4">
        <div className="text-xs font-display tracking-widest text-blue-400/50 uppercase mb-3">
          Mission
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-gray-500">Distance</span>
            <span className="font-display text-sm font-bold text-blue-300">
              {activeEmergency?.totalDistance
                ? `${activeEmergency.totalDistance.toFixed(2)} km`
                : "— km"}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-gray-500">Remaining</span>
            <motion.span
              className="font-display text-sm font-bold text-yellow-400"
              key={remainingDistance}
              animate={{ opacity: [0.5, 1] }}
              transition={{ duration: 0.3 }}
            >
              {remainingDistance ? `${parseFloat(remainingDistance).toFixed(2)} km` : "— km"}
            </motion.span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs font-mono text-gray-500">Phase</span>
            <span className={`text-xs font-display font-bold px-2 py-0.5 rounded ${
              routePhase === "toPatient"
                ? "bg-yellow-900/30 text-yellow-400 border border-yellow-800/30"
                : routePhase === "toHospital"
                ? "bg-blue-900/30 text-blue-400 border border-blue-800/30"
                : "bg-gray-900/30 text-gray-500 border border-gray-800/30"
            }`}>
              {routePhase === "toPatient" ? "To Patient"
                : routePhase === "toHospital" ? "To Hospital"
                : "Idle"}
            </span>
          </div>
        </div>
      </div>

      {/* Traffic Condition */}
      <div className={`glass-card rounded-lg p-4 border ${traffic.bg}`}>
        <div className="text-xs font-display tracking-widest text-blue-400/50 uppercase mb-3">
          Traffic
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{traffic.icon}</span>
            <div>
              <div className="font-display text-base font-bold" style={{ color: traffic.color }}>
                {traffic.label}
              </div>
              <div className="text-xs font-mono text-gray-500">Live</div>
            </div>
          </div>
          <div className="w-12 h-12 relative flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
              <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(0,136,255,0.1)" strokeWidth="3" />
              <circle
                cx="20" cy="20" r="16"
                fill="none"
                stroke={traffic.color}
                strokeWidth="3"
                strokeDasharray={`${100.5}`}
                strokeDashoffset={`${100.5 * (1 - (trafficCondition === "light" ? 0.25 : trafficCondition === "moderate" ? 0.5 : trafficCondition === "heavy" ? 0.75 : 1))}`}
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>

        {/* Traffic history bar */}
        <div className="mt-3 flex gap-1">
          {["light", "moderate", "heavy", "severe"].map((t) => (
            <div
              key={t}
              className="flex-1 h-1 rounded-full transition-all duration-500"
              style={{
                background: t === trafficCondition ? TRAFFIC_CONFIG[t].color : "rgba(255,255,255,0.05)",
                boxShadow: t === trafficCondition ? `0 0 6px ${TRAFFIC_CONFIG[t].color}` : "none",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
