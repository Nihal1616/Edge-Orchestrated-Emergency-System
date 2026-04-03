import { motion, AnimatePresence } from "framer-motion";
import { useEmergency } from "../../context/EmergencyContext";

const LOG_TYPES = {
  emergency: { color: "#ff2020", icon: "🚨" },
  dispatch:  { color: "#0088ff", icon: "🚑" },
  hospital:  { color: "#00cc6a", icon: "🏥" },
  traffic:   { color: "#ffaa00", icon: "🚦" },
  reroute:   { color: "#ff6600", icon: "↺" },
  eta:       { color: "#00aaff", icon: "⏱" },
  complete:  { color: "#00ff88", icon: "✅" },
  error:     { color: "#ff4444", icon: "⚠" },
  info:      { color: "#5a7fa0", icon: "ℹ" },
};

function formatTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "--:--:--";
  }
}

export default function BottomPanel() {
  const { state } = useEmergency();
  const { logs } = state;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="font-display text-xs tracking-widest text-blue-400/60 uppercase">
            System Event Log
          </span>
        </div>
        <span className="text-xs font-mono text-gray-600">{logs.length} events</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-0.5 pr-1">
        <AnimatePresence initial={false}>
          {logs.length === 0 ? (
            <div className="text-center py-3 text-gray-700 text-xs font-mono">
              Awaiting system events...
            </div>
          ) : (
            logs.map((log) => {
              const config = LOG_TYPES[log.type] || LOG_TYPES.info;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex items-start gap-2 py-0.5 px-2 rounded hover:bg-blue-950/20 transition-colors"
                >
                  <span className="text-xs mt-0.5 flex-shrink-0">{config.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-body" style={{ color: config.color }}>
                      {log.message}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-gray-700 whitespace-nowrap ml-2 flex-shrink-0">
                    {formatTime(log.timestamp)}
                  </span>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
