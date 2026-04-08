import { useState } from "react";
import { motion } from "framer-motion";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useEmergency } from "../context/EmergencyContext";

const StatCard = ({ icon, label, value, sub, color = "#60a5fa", pulse = false }) => (
  <div style={{
    background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: "12px 14px",
    border: "1px solid rgba(255,255,255,0.07)", position: "relative", overflow: "hidden"
  }}>
    {pulse && (
      <motion.div
        animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
        transition={{ repeat: Infinity, duration: 2 }}
        style={{
          position: "absolute", top: 10, right: 10, width: 10, height: 10,
          borderRadius: "50%", background: color,
        }}
      />
    )}
    <div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div>
    <div style={{ color, fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{value}</div>
    <div style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600, marginTop: 2 }}>{label}</div>
    {sub && <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, marginTop: 2 }}>{sub}</div>}
  </div>
);

export default function CommandDashboard() {
  const { state } = useEmergency();
  const [open, setOpen] = useState(false);

  const available = state.ambulances.filter(a => a.status === "available").length;
  const dispatched = state.ambulances.length - available;
  const avgOccupancy = state.hospitals.length
    ? Math.round(state.hospitals.reduce((s, h) => s + ((h.capacity - h.available) / h.capacity) * 100, 0) / state.hospitals.length)
    : 0;

  const rtData = state.dashboardStats.totalResponseTime.map((v, i) => ({ i: i + 1, min: v }));
  const hospData = state.hospitals.slice(0, 6).map(h => ({
    name: h.name.slice(0, 12),
    pct: Math.round(((h.capacity - h.available) / h.capacity) * 100),
  }));

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
          width: "100%", padding: "13px 16px", background: "none", border: "none", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📊</span>
          <span style={{ color: "#e2e8f0", fontWeight: 700, fontSize: 13, letterSpacing: "0.05em" }}>LIVE COMMAND DASHBOARD</span>
        </div>
        <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
            <StatCard icon="🚨" label="Active Emergencies" value={state.activeEmergencies.length} color="#f87171" pulse={state.activeEmergencies.length > 0} />
            <StatCard icon="🚑" label="Available Ambulances" value={`${available}/${state.ambulances.length}`} sub={`${dispatched} dispatched`} color="#60a5fa" />
            <StatCard icon="🏥" label="Avg Occupancy" value={`${avgOccupancy}%`} sub={`${state.hospitals.length} hospitals`} color="#34d399" />
            <StatCard icon="⏱" label="Avg Response" value={state.dashboardStats.avgResponseTime ? `${state.dashboardStats.avgResponseTime}m` : "--"} sub={`${state.dashboardStats.totalResolved} resolved`} color="#a78bfa" />
          </div>

          {rtData.length > 1 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600, marginBottom: 6 }}>RESPONSE TIME TREND (min)</div>
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={rtData}>
                  <XAxis dataKey="i" hide />
                  <YAxis hide />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, fontSize: 11, color: "#e2e8f0" }} />
                  <Line type="monotone" dataKey="min" stroke="#a78bfa" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {hospData.length > 0 && (
            <div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, fontWeight: 600, marginBottom: 6 }}>HOSPITAL OCCUPANCY %</div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={hospData} barSize={16}>
                  <XAxis dataKey="name" tick={{ fontSize: 8, fill: "rgba(255,255,255,0.4)" }} />
                  <YAxis hide domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: 8, fontSize: 11, color: "#e2e8f0" }} />
                  <Bar dataKey="pct" radius={[4,4,0,0]}>
                    {hospData.map((entry, index) => (
                      <Cell key={index} fill={entry.pct > 80 ? "#ef4444" : entry.pct > 60 ? "#f97316" : "#34d399"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
