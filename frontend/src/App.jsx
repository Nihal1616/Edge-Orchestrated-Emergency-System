import { useEffect, useCallback, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { EmergencyProvider, useEmergency } from "./context/EmergencyContext";
import { useSocket } from "./hooks/useSocket";
import MapView from "./components/Map/MapView";
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
  const { requestState } = useSocket();
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!navigator.geolocation) return;
    if (typeof window !== "undefined" && window.sessionStorage.getItem("eers-location-init") === "1") {
      return;
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("eers-location-init", "1");
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await fetch("/api/location", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });
          requestState();
        } catch (error) {
          console.error("Failed to set user location:", error);
        }
      },
      () => {
        // Keep fallback center if permission is denied.
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
    );
  }, [requestState]);

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

  const switchCity = useCallback(async (city) => {
    try {
      await fetch("/api/city", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city }),
      });
      requestState();
    } catch (err) {
      console.error("Failed to switch city:", err);
    }
  }, [requestState]);

  useEffect(() => {
    if (!state.activeEmergency) return undefined;
    const id = setInterval(() => requestState(), 3000);
    return () => clearInterval(id);
  }, [state.activeEmergency, requestState]);

  useEffect(() => {
    if (!state.activeEmergency || typeof window === "undefined" || !window.speechSynthesis) return;
    const msg = new SpeechSynthesisUtterance("Ambulance is on the way.");
    msg.rate = 1;
    msg.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(msg);
  }, [state.activeEmergency?.emergencyId]);

  const availableAmbulances = state.ambulances.filter((a) => a.status === "available").length;
  const step = state.isTriggeringEmergency
    ? 1
    : state.activeEmergency && state.routePhase === "toPatient"
    ? 2
    : state.activeEmergency && state.routePhase === "toHospital"
    ? 3
    : 0;

  const statusText =
    step === 1
      ? "Finding nearest ambulance..."
      : step === 2
      ? "Ambulance assigned"
      : step === 3
      ? "Routing to hospital"
      : "Ready to request help";

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-50 text-slate-900">
      <AnimatePresence>
        {state.isTriggeringEmergency && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.18, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7, times: [0, 0.3, 1] }}
            className="absolute inset-0 z-50 pointer-events-none"
            style={{ background: "#ef4444" }}
          />
        )}
      </AnimatePresence>

      <div className="absolute inset-0 grid" style={{ gridTemplateRows: "56px 1fr auto" }}>
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between z-20">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-slate-800">Emergency Response</h1>
            <p className="text-xs text-slate-500">Get help quickly and track ambulance live</p>
          </div>
          <div className="flex items-center gap-3">
            <Clock />
            <span className={`text-xs px-2 py-1 rounded-full border ${state.isConnected ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {state.isConnected ? "Connected" : "Offline"}
            </span>
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="text-xs px-3 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
            >
              {showAdvanced ? "Hide Advanced" : "Advanced Details"}
            </button>
          </div>
        </header>

        <main className="relative min-h-0">
          <MapView />
        </main>

        <section className="bg-white border-t border-slate-200 p-4 sm:p-5 z-20">
          <div className="max-w-6xl mx-auto space-y-4">
            <button
              onClick={triggerEmergency}
              disabled={state.isTriggeringEmergency || !!state.activeEmergency}
              className={`w-full sm:w-auto text-white text-base sm:text-lg font-semibold px-6 py-3 rounded-xl transition ${
                state.activeEmergency ? "bg-slate-400 cursor-not-allowed" : state.isTriggeringEmergency ? "bg-red-500 cursor-wait" : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {state.isTriggeringEmergency ? "Requesting..." : state.activeEmergency ? "Emergency Active" : "🚨 Request Emergency Help"}
            </button>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Assigned Hospital</p>
                  <p className="text-sm sm:text-base font-semibold text-slate-800 mt-1">
                    {state.activeEmergency?.hospital?.name || "Waiting for assignment"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">ETA</p>
                  <motion.p
                    key={state.eta}
                    initial={{ scale: 0.95, opacity: 0.7 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-xl font-bold text-blue-600 mt-1"
                  >
                    {state.eta ? `${Math.round(state.eta)} min` : "--"}
                  </motion.p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Distance Remaining</p>
                  <p className="text-sm sm:text-base font-semibold text-slate-800 mt-1">
                    {state.remainingDistance ? `${Number(state.remainingDistance).toFixed(2)} km` : "--"}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="text-sm sm:text-base font-semibold text-green-700 mt-1">{statusText}</p>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                  <span className={`h-2 w-2 rounded-full ${step >= 1 ? "bg-green-500" : "bg-slate-300"}`} />
                  <span>Finding nearest ambulance</span>
                  <span className="mx-1">›</span>
                  <span className={`h-2 w-2 rounded-full ${step >= 2 ? "bg-green-500" : "bg-slate-300"}`} />
                  <span>Ambulance assigned</span>
                  <span className="mx-1">›</span>
                  <span className={`h-2 w-2 rounded-full ${step >= 3 ? "bg-green-500" : "bg-slate-300"}`} />
                  <span>Routing to hospital</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                  <motion.div
                    className="h-full bg-blue-500"
                    animate={{ width: `${Math.max(0, Math.min(100, state.etaProgress * 100))}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-slate-600">Quick City:</span>
                    {["Hyderabad", "Kurnool", "Bangalore", "Nandyal"].map((city) => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => switchCity(city)}
                        className="text-xs px-2 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-100"
                      >
                        {city}
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-700">
                    <div className="rounded-lg bg-white border border-slate-200 p-3">
                      <p className="text-slate-500">City</p>
                      <p className="font-semibold mt-1">{state.cityName || "My Location"}</p>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 p-3">
                      <p className="text-slate-500">Ambulances Available</p>
                      <p className="font-semibold mt-1">{availableAmbulances} / {state.ambulances.length}</p>
                    </div>
                    <div className="rounded-lg bg-white border border-slate-200 p-3">
                      <p className="text-slate-500">Traffic</p>
                      <p className="font-semibold mt-1 capitalize">{state.trafficCondition}</p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-white border border-slate-200 p-3 max-h-28 overflow-auto">
                    <p className="text-xs text-slate-500 mb-2">Recent Activity</p>
                    <ul className="space-y-1 text-xs text-slate-700">
                      {state.logs.slice(0, 6).map((log) => (
                        <li key={log.id}>• {log.message}</li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
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
