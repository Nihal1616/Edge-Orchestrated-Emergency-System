import { createContext, useContext, useReducer, useCallback } from "react";

const EmergencyContext = createContext(null);

const initialState = {
  mapCenter: { lat: 40.7128, lng: -74.006 },
  cityName: "My Location",
  hospitalSource: "template",
  ambulances: [],
  hospitals: [],
  activeEmergency: null,
  activeEmergencies: [],
  logs: [],
  trafficCondition: "moderate",
  eta: null,
  etaProgress: 0,
  routePhase: null,
  remainingDistance: null,
  isConnected: false,
  isTriggeringEmergency: false,
  lastUpdate: null,
  mlAvailable: true,
  mlEnabled: true,
  trafficIntensity: 3,
  disasterMode: false,
  completedEmergencies: [],
  aiDecision: null,
  dashboardStats: {
    totalResponseTime: [],
    avgResponseTime: 0,
    totalResolved: 0,
    peakLoad: 0,
  },
  liveMode: false,
  storyStep: "waiting",
  mlDecision: null,
  systemAlert: null,
};

function generateAIDecision(emergency, ambulances, hospitals) {
  if (!emergency) return null;
  const { ambulance, hospital, totalDistance, trafficCondition } = emergency;
  const trafficFactor =
    { light: 1.0, moderate: 1.3, heavy: 1.7, severe: 2.2 }[trafficCondition] ||
    1.3;
  const confidence = Math.max(
    60,
    Math.min(99, Math.round(91 - (trafficFactor - 1) * 20)),
  );

  const otherAmbulances = (ambulances || [])
    .filter((a) => a.id !== ambulance?.id)
    .slice(0, 3)
    .map((a) => ({
      id: a.id,
      type: a.type,
      reason:
        a.status !== "available" ? "Already dispatched" : "Further distance",
    }));

  const otherHospitals = (hospitals || [])
    .filter((h) => h.id !== hospital?.id)
    .slice(0, 3)
    .map((h) => ({
      name: h.name,
      reason:
        h.status === "critical"
          ? "Critically low capacity"
          : h.available < 5
            ? "Near capacity"
            : "Lower trauma level or further",
    }));

  return {
    ambulanceReason: ambulance
      ? `${ambulance.id} selected as nearest ${ambulance.type} unit (${((totalDistance || 5) * 0.4).toFixed(2)}km).`
      : "No ambulance data",
    hospitalReason: hospital
      ? `${hospital.name} scored best: distance (60%), availability (30%), trauma level (10%).`
      : "No hospital data",
    distanceKm: (totalDistance || 0).toFixed(2),
    trafficFactor: trafficFactor.toFixed(2),
    capacityScore: hospital
      ? Math.round((hospital.available / hospital.capacity) * 100)
      : 0,
    confidence,
    trafficCondition,
    otherAmbulances,
    otherHospitals,
    timestamp: new Date().toISOString(),
  };
}

function emergencyReducer(state, action) {
  switch (action.type) {
    case "SET_CONNECTED":
      return { ...state, isConnected: action.payload };

    case "SET_INITIAL_STATE":
      return {
        ...state,
        mapCenter: action.payload.mapCenter || state.mapCenter,
        cityName: action.payload.cityName || state.cityName,
        hospitalSource: action.payload.hospitalSource || state.hospitalSource,
        ambulances: action.payload.ambulances || state.ambulances,
        hospitals: action.payload.hospitals || state.hospitals,
        trafficCondition:
          action.payload.trafficCondition || state.trafficCondition,
        mlAvailable: action.payload.mlAvailable ?? state.mlAvailable,
        logs: action.payload.logs || [],
        lastUpdate: Date.now(),
      };

    case "AMBULANCE_MOVE":
      return {
        ...state,
        ambulances: state.ambulances.map((a) =>
          a.id === action.payload.id
            ? {
                ...a,
                coordinates: action.payload.coordinates,
                heading: action.payload.heading,
                status: action.payload.status,
              }
            : a,
        ),
        lastUpdate: Date.now(),
      };

    case "EMERGENCY_TRIGGERED": {
      const newE = action.payload;
      const exists = state.activeEmergencies.find(
        (e) => e.emergencyId === newE.emergencyId,
      );
      const updatedList = exists
        ? state.activeEmergencies
        : [...state.activeEmergencies, newE];
      const aiDecision = newE.aiDecision
        ? {
            ...generateAIDecision(newE, state.ambulances, state.hospitals),
            ...newE.aiDecision,
          }
        : generateAIDecision(newE, state.ambulances, state.hospitals);
      return {
        ...state,
        activeEmergency: newE,
        activeEmergencies: updatedList,
        isTriggeringEmergency: false,
        eta: newE.eta,
        etaProgress: 0,
        routePhase: "toPatient",
        remainingDistance: newE.totalDistance,
        aiDecision,
        storyStep: "trigger",
      };
    }

    case "ETA_UPDATE": {
      const updated = state.activeEmergencies.map((e) =>
        e.emergencyId === action.payload.emergencyId
          ? {
              ...e,
              eta: action.payload.eta,
              progress: action.payload.progress,
              phase: action.payload.phase,
            }
          : e,
      );
      return {
        ...state,
        eta: action.payload.eta,
        etaProgress: action.payload.progress || state.etaProgress,
        routePhase: action.payload.phase || state.routePhase,
        remainingDistance: action.payload.remainingDistance,
        trafficCondition:
          action.payload.trafficCondition || state.trafficCondition,
        activeEmergencies: updated,
      };
    }

    case "TRAFFIC_UPDATE":
      return { ...state, trafficCondition: action.payload.condition };

    case "ROUTE_UPDATE": {
      const updatedEmergencies = state.activeEmergencies.map((e) =>
        e.emergencyId === action.payload.emergencyId
          ? { ...e, ...action.payload }
          : e,
      );
      const isCurrent =
        state.activeEmergency?.emergencyId === action.payload.emergencyId;
      return {
        ...state,
        activeEmergencies: updatedEmergencies,
        ...(isCurrent
          ? {
              eta: action.payload.eta ?? state.eta,
              etaProgress: action.payload.progress ?? state.etaProgress,
              routePhase: action.payload.phase ?? state.routePhase,
              remainingDistance:
                action.payload.remainingDistance ?? state.remainingDistance,
              trafficCondition:
                action.payload.trafficCondition || state.trafficCondition,
            }
          : {}),
      };
    }

    case "SET_ML_STATUS":
      return {
        ...state,
        mlAvailable: action.payload.available ?? state.mlAvailable,
        mlEnabled: action.payload.enabled ?? state.mlEnabled,
      };

    case "SET_LIVE_MODE":
      return {
        ...state,
        liveMode: action.payload,
      };

    case "SET_STORY_STEP":
      return {
        ...state,
        storyStep: action.payload,
      };

    case "SET_SYSTEM_ALERT":
      return {
        ...state,
        systemAlert: action.payload,
      };

    case "ADD_LOG":
      return { ...state, logs: [action.payload, ...state.logs].slice(0, 50) };

    case "EMERGENCY_COMPLETE": {
      const cid = action.payload?.emergencyId;
      const cE = state.activeEmergencies.find((e) => e.emergencyId === cid);
      const newCompleted = cE
        ? [
            ...state.completedEmergencies,
            {
              ...cE,
              completedAt: new Date().toISOString(),
              responseTimeSec: cE.eta ? cE.eta * 60 : 300,
              outcome: "Delivered",
              trafficDelay:
                cE.trafficCondition === "heavy"
                  ? "2-4 min"
                  : cE.trafficCondition === "severe"
                    ? "5-8 min"
                    : "< 1 min",
            },
          ]
        : state.completedEmergencies;
      const remaining = state.activeEmergencies.filter(
        (e) => e.emergencyId !== cid,
      );
      const responseTimes = [
        ...state.dashboardStats.totalResponseTime,
        cE?.eta || 5,
      ].slice(-20);
      const avg =
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      return {
        ...state,
        activeEmergency:
          remaining.length > 0 ? remaining[remaining.length - 1] : null,
        activeEmergencies: remaining,
        eta: remaining.length > 0 ? remaining[remaining.length - 1]?.eta : null,
        etaProgress: 0,
        routePhase:
          remaining.length > 0 ? remaining[remaining.length - 1]?.phase : null,
        remainingDistance: null,
        completedEmergencies: newCompleted,
        dashboardStats: {
          ...state.dashboardStats,
          totalResponseTime: responseTimes,
          avgResponseTime: Math.round(avg * 10) / 10,
          totalResolved: state.dashboardStats.totalResolved + 1,
          peakLoad: Math.max(
            state.dashboardStats.peakLoad,
            state.activeEmergencies.length,
          ),
        },
      };
    }

    case "SET_TRIGGERING":
      return { ...state, isTriggeringEmergency: action.payload };

    case "UPDATE_HOSPITAL":
      return {
        ...state,
        hospitals: state.hospitals.map((h) =>
          h.id === action.payload.id ? { ...h, ...action.payload } : h,
        ),
      };

    case "SET_ML_ENABLED":
      return { ...state, mlEnabled: action.payload };

    case "SET_TRAFFIC_INTENSITY":
      return { ...state, trafficIntensity: action.payload };

    case "SET_DISASTER_MODE":
      return { ...state, disasterMode: action.payload };

    case "CLEAR_AI_DECISION":
      return { ...state, aiDecision: null };

    default:
      return state;
  }
}

export function EmergencyProvider({ children }) {
  const [state, dispatch] = useReducer(emergencyReducer, initialState);

  const setConnected = useCallback(
    (v) => dispatch({ type: "SET_CONNECTED", payload: v }),
    [],
  );
  const setInitialState = useCallback(
    (v) => dispatch({ type: "SET_INITIAL_STATE", payload: v }),
    [],
  );
  const handleAmbulanceMove = useCallback(
    (v) => dispatch({ type: "AMBULANCE_MOVE", payload: v }),
    [],
  );
  const handleEmergencyTriggered = useCallback(
    (v) => dispatch({ type: "EMERGENCY_TRIGGERED", payload: v }),
    [],
  );
  const handleEtaUpdate = useCallback(
    (v) => dispatch({ type: "ETA_UPDATE", payload: v }),
    [],
  );
  const handleTrafficUpdate = useCallback(
    (v) => dispatch({ type: "TRAFFIC_UPDATE", payload: v }),
    [],
  );
  const addLog = useCallback(
    (v) => dispatch({ type: "ADD_LOG", payload: v }),
    [],
  );
  const handleEmergencyComplete = useCallback(
    (v) => dispatch({ type: "EMERGENCY_COMPLETE", payload: v }),
    [],
  );
  const handleRouteUpdate = useCallback(
    (v) => dispatch({ type: "ROUTE_UPDATE", payload: v }),
    [],
  );
  const handleMlStatus = useCallback(
    (v) => dispatch({ type: "SET_ML_STATUS", payload: v }),
    [],
  );
  const setLiveMode = useCallback(
    (v) => dispatch({ type: "SET_LIVE_MODE", payload: v }),
    [],
  );
  const setStoryStep = useCallback(
    (v) => dispatch({ type: "SET_STORY_STEP", payload: v }),
    [],
  );
  const setTriggering = useCallback(
    (v) => dispatch({ type: "SET_TRIGGERING", payload: v }),
    [],
  );
  const setMlEnabled = useCallback(
    (v) => dispatch({ type: "SET_ML_ENABLED", payload: v }),
    [],
  );
  const setTrafficIntensity = useCallback(
    (v) => dispatch({ type: "SET_TRAFFIC_INTENSITY", payload: v }),
    [],
  );
  const setDisasterMode = useCallback(
    (v) => dispatch({ type: "SET_DISASTER_MODE", payload: v }),
    [],
  );
  const clearAiDecision = useCallback(
    () => dispatch({ type: "CLEAR_AI_DECISION" }),
    [],
  );

  return (
    <EmergencyContext.Provider
      value={{
        state,
        setConnected,
        setInitialState,
        handleAmbulanceMove,
        handleEmergencyTriggered,
        handleEtaUpdate,
        handleRouteUpdate,
        handleTrafficUpdate,
        addLog,
        handleEmergencyComplete,
        setTriggering,
        handleMlStatus,
        setLiveMode,
        setStoryStep,
        setMlEnabled,
        setTrafficIntensity,
        setDisasterMode,
        clearAiDecision,
      }}
    >
      {children}
    </EmergencyContext.Provider>
  );
}

export function useEmergency() {
  const ctx = useContext(EmergencyContext);
  if (!ctx)
    throw new Error("useEmergency must be used within EmergencyProvider");
  return ctx;
}
