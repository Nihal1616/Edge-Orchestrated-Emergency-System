import { motion, AnimatePresence } from "framer-motion";

export default function DisasterAlert({ active }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          style={{
            position: "fixed", inset: 0, zIndex: 2000,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <motion.div
            animate={{ opacity: [0, 0.15, 0, 0.15, 0] }}
            transition={{ duration: 1.5, times: [0, 0.2, 0.5, 0.7, 1] }}
            style={{ position: "absolute", inset: 0, background: "#f59e0b" }}
          />
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{
              background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,41,59,0.98))",
              border: "2px solid rgba(245,158,11,0.6)",
              borderRadius: 20, padding: "28px 40px", textAlign: "center",
              boxShadow: "0 0 60px rgba(245,158,11,0.3)",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ repeat: 3, duration: 0.4 }}
              style={{ fontSize: 48, marginBottom: 10 }}
            >⚠️</motion.div>
            <div style={{ color: "#fcd34d", fontWeight: 900, fontSize: 22, letterSpacing: "0.1em" }}>DISASTER MODE ACTIVATED</div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 13, marginTop: 6 }}>Deploying all available units</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
