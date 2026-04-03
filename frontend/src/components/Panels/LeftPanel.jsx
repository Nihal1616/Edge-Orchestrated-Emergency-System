import { motion, AnimatePresence } from "framer-motion";
import { useEmergency } from "../../context/EmergencyContext";

const SEVERITY_CONFIG = {
  critical: { color: "#ff2020", label: "CRITICAL", icon: "🔴" },
  high: { color: "#ff6600", label: "HIGH", icon: "🟠" },
  moderate: { color: "#ffaa00", label: "MODERATE", icon: "🟡" },
  low: { color: "#00cc6a", label: "LOW", icon: "🟢" },
};

function InfoRow({ label, value, color }) {
  return (
    <div className="flex items-start justify-between py-1.5 border-b border-blue-900/20">
      <span className="text-xs font-mono text-blue-400/60 uppercase tracking-wider">{label}</span>
      <span className="text-sm font-body font-semibold text-right" style={{ color: color || "#e0eeff", maxWidth: "60%" }}>
        {value}
      </span>
    </div>
  );
}

function GlassPanel({ children, className = "", emergency = false }) {
  return (
    <div className={`rounded-lg p-4 relative ${emergency ? "glass-card-emergency" : "glass-card"} ${className}`}>
      <div className="corner-tl corner-br relative">{children}</div>
    </div>
  );
}

export default function LeftPanel({ onTriggerEmergency }) {
  const { state } = useEmergency();
  const { activeEmergency, ambulances, hospitals, isTriggeringEmergency, isConnected } = state;

  const availableAmbs = ambulances.filter((a) => a.status === "available").length;
  const assignedAmb = activeEmergency
    ? ambulances.find((a) => a.id === activeEmergency.ambulanceId)
    : null;

  return (
    <div className="flex flex-col gap-3 h-full overflow-y-auto scrollbar-thin p-1">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xs tracking-[0.2em] text-blue-400/70 uppercase">
            Edge-Orchestrated
          </h1>
          <h2 className="font-display text-base font-bold text-neon-blue leading-tight">
            Emergency Response
          </h2>
        </div>
        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-mono ${
          isConnected ? "bg-green-900/30 text-green-400 border border-green-800/50" : "bg-red-900/30 text-red-400 border border-red-800/50"
        }`}>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
          {isConnected ? "LIVE" : "OFFLINE"}
        </div>
      </div>

      {/* Emergency Trigger Button */}
      <motion.button
        onClick={onTriggerEmergency}
        disabled={isTriggeringEmergency || !!activeEmergency}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        className={`relative w-full py-4 rounded-lg font-display text-sm tracking-[0.15em] font-bold transition-all overflow-hidden ${
          activeEmergency
            ? "bg-red-950/40 border border-red-800/30 text-red-700 cursor-not-allowed"
            : isTriggeringEmergency
            ? "bg-red-900/40 border border-red-600/50 text-red-300 cursor-wait"
            : "bg-gradient-to-r from-red-900/60 to-red-800/40 border border-red-500/60 text-red-200 hover:border-red-400 cursor-pointer"
        }`}
        style={!activeEmergency && !isTriggeringEmergency ? {
          boxShadow: "0 0 20px rgba(255, 32, 32, 0.3), inset 0 1px 0 rgba(255,100,100,0.1)"
        } : {}}
      >
        {/* Pulse ring */}
        {!activeEmergency && !isTriggeringEmergency && (
          <div className="absolute inset-0 rounded-lg animate-ping opacity-20"
            style={{ background: "rgba(255,32,32,0.3)" }} />
        )}
        <span className="relative flex items-center justify-center gap-2">
          {isTriggeringEmergency ? (
            <>
              <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
              DISPATCHING...
            </>
          ) : activeEmergency ? (
            <><span>🚨</span> EMERGENCY ACTIVE</>
          ) : (
            <><span>⚡</span> TRIGGER EMERGENCY</>
          )}
        </span>
      </motion.button>

      {/* System Stats */}
      <GlassPanel>
        <div className="text-xs font-display tracking-widest text-blue-400/50 uppercase mb-3">
          System Status
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "AMBS", value: availableAmbs, total: ambulances.length, color: "#0088ff" },
            { label: "HOSP", value: hospitals.filter(h => h.status === "available").length, total: hospitals.length, color: "#00cc6a" },
            { label: "ACTIVE", value: activeEmergency ? 1 : 0, total: 1, color: "#ff2020" },
          ].map(({ label, value, total, color }) => (
            <div key={label} className="text-center p-2 rounded-md bg-blue-950/20 border border-blue-900/20">
              <div className="font-display text-lg font-bold" style={{ color }}>{value}</div>
              <div className="text-xs font-mono text-gray-500">/{total}</div>
              <div className="text-xs font-mono text-gray-600 tracking-wider">{label}</div>
            </div>
          ))}
        </div>
      </GlassPanel>

      {/* Active Emergency Details */}
      <AnimatePresence>
        {activeEmergency ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <GlassPanel emergency>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-display tracking-widest text-red-400/80 uppercase">
                  Active Emergency
                </div>
                <div className="text-xs font-mono text-red-500 animate-pulse">● LIVE</div>
              </div>

              <div className="space-y-1">
                <InfoRow
                  label="ID"
                  value={`#${activeEmergency.emergencyId?.slice(0, 8).toUpperCase()}`}
                  color="#ff6666"
                />
                <InfoRow
                  label="Severity"
                  value={`${SEVERITY_CONFIG[activeEmergency.severity]?.icon} ${SEVERITY_CONFIG[activeEmergency.severity]?.label || "CRITICAL"}`}
                  color={SEVERITY_CONFIG[activeEmergency.severity]?.color}
                />
                <InfoRow
                  label="Location"
                  value={activeEmergency.patientCoords
                    ? `${activeEmergency.patientCoords[1]?.toFixed(4)}°N, ${Math.abs(activeEmergency.patientCoords[0])?.toFixed(4)}°W`
                    : "Unknown"
                  }
                />
                <InfoRow
                  label="Ambulance"
                  value={activeEmergency.ambulanceId}
                  color="#0088ff"
                />
                <InfoRow
                  label="Phase"
                  value={state.routePhase === "toPatient" ? "🟡 En Route to Patient" : "🔵 Transporting to Hospital"}
                  color={state.routePhase === "toPatient" ? "#ffaa00" : "#0088ff"}
                />
              </div>
            </GlassPanel>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card rounded-lg p-4 text-center py-8"
          >
            <div className="text-3xl mb-2 opacity-30">🚑</div>
            <div className="text-xs font-mono text-gray-600 uppercase tracking-widest">
              No Active Emergency
            </div>
            <div className="text-xs text-gray-700 mt-1">System on standby</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assigned Hospital */}
      <AnimatePresence>
        {activeEmergency?.hospital && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <GlassPanel>
              <div className="text-xs font-display tracking-widest text-blue-400/50 uppercase mb-3">
                Assigned Hospital
              </div>
              <div className="flex items-start gap-3">
                <div className="text-2xl">🏥</div>
                <div className="flex-1">
                  <div className="font-body font-bold text-sm text-green-300">
                    {activeEmergency.hospital.name}
                  </div>
                  <div className="text-xs font-mono text-gray-500 mt-0.5">
                    {activeEmergency.hospital.level}
                  </div>
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {activeEmergency.hospital.specialties?.map((s) => (
                      <span key={s} className="text-xs px-1.5 py-0.5 rounded bg-green-900/30 text-green-400 border border-green-800/30">
                        {s}
                      </span>
                    ))}
                  </div>
                  <div className="text-xs font-mono text-gray-500 mt-2">
                    <span className="text-green-400">{activeEmergency.hospital.available}</span>
                    /{activeEmergency.hospital.capacity} beds available
                  </div>
                </div>
              </div>
            </GlassPanel>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
