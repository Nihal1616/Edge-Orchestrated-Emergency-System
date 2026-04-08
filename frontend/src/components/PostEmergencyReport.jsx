import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useEmergency } from "../context/EmergencyContext";

function ReportCard({ report, index }) {
  const [open, setOpen] = useState(false);
  const date = new Date(report.completedAt).toLocaleTimeString("en-US", { hour12: false });
  const mins = Math.round(report.responseTimeSec / 60);
  const dist = report.totalDistance ? Number(report.totalDistance).toFixed(2) : "N/A";

  const tc = { light: "#22c55e", moderate: "#f59e0b", heavy: "#f97316", severe: "#ef4444" }[report.trafficCondition] || "#f59e0b";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      style={{
        background: "rgba(255,255,255,0.04)", borderRadius: 12,
        border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden", marginBottom: 8,
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", padding: "10px 14px", background: "none", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 28, height: 28, borderRadius: 8, background: "rgba(52,211,153,0.15)",
            border: "1px solid rgba(52,211,153,0.3)", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 13, flexShrink: 0,
          }}>✅</span>
          <div style={{ textAlign: "left" }}>
            <div style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600 }}>
              {report.hospital?.name || "Unknown Hospital"}
            </div>
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10 }}>{date}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#60a5fa", fontSize: 13, fontWeight: 700 }}>{mins}m</span>
          <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Response Time", value: `${mins} min`, color: "#60a5fa" },
                { label: "Distance", value: `${dist} km`, color: "#a78bfa" },
                { label: "Traffic Delay", value: report.trafficDelay || "< 1 min", color: tc },
                { label: "Outcome", value: report.outcome || "Delivered", color: "#34d399" },
                { label: "Ambulance", value: report.ambulance?.id || "N/A", color: "#f9a8d4" },
                { label: "Traffic", value: (report.trafficCondition || "moderate").toUpperCase(), color: tc },
              ].map(item => (
                <div key={item.label} style={{
                  background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 10px",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, marginBottom: 2 }}>{item.label}</div>
                  <div style={{ color: item.color, fontWeight: 700, fontSize: 13 }}>{item.value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PostEmergencyReport() {
  const { state } = useEmergency();
  const [open, setOpen] = useState(false);
  const reports = [...state.completedEmergencies].reverse();

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(15,23,42,0.97) 0%, rgba(30,41,59,0.97) 100%)",
      backdropFilter: "blur(20px)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16,
      fontFamily: "Inter, system-ui, sans-serif",
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%", padding: "13px 16px", background: "none", border: "none",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🧾</span>
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em" }}>POST-EMERGENCY REPORTS</span>
          {reports.length > 0 && (
            <span style={{
              padding: "1px 7px", borderRadius: 10,
              background: "rgba(99,102,241,0.25)", color: "#c7d2fe", fontSize: 10, fontWeight: 700,
            }}>{reports.length}</span>
          )}
        </div>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            style={{ overflow: "hidden" }}
          >
            <div style={{ padding: "0 14px 14px" }}>
              {reports.length === 0 ? (
                <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, textAlign: "center", padding: "20px 0" }}>
                  No completed emergencies yet
                </div>
              ) : (
                reports.map((r, i) => <ReportCard key={r.emergencyId || i} report={r} index={i} />)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
