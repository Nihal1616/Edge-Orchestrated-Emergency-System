import { createContext, useContext, useReducer, useCallback } from "react";

const EmergencyContext = createContext(null);

const initialState = {
  mapCenter: { lat: 40.7128, lng: -74.006 },
  cityName: "My Location",
  hospitalSource: "template",
  ambulances: [],
  hospitals: [],
  activeEmergency: null,
  logs: [],
  trafficCondition: "moderate",
  eta: null,
  etaProgress: 0,
  routePhase: null,
  remainingDistance: null,
  isConnected: false,
  isTriggeringEmergency: false,
  lastUpdate: null,
};

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
        ambulances: action.payload.ambulances,
        hospitals: action.payload.hospitals,
        trafficCondition: action.payload.trafficCondition,
        logs: action.payload.logs || [],
        lastUpdate: Date.now(),
      };

    case "AMBULANCE_MOVE":
      return {
        ...state,
        ambulances: state.ambulances.map((a) =>
          a.id === action.payload.id
            ? { ...a, coordinates: action.payload.coordinates, heading: action.payload.heading, status: action.payload.status }
            : a
        ),
        lastUpdate: Date.now(),
      };

    case "EMERGENCY_TRIGGERED":
      return {
        ...state,
        activeEmergency: action.payload,
        isTriggeringEmergency: false,
        eta: action.payload.eta,
        etaProgress: 0,
        routePhase: "toPatient",
        remainingDistance: action.payload.totalDistance,
      };

    case "ETA_UPDATE":
      return {
        ...state,
        eta: action.payload.eta,
        etaProgress: action.payload.progress || state.etaProgress,
        routePhase: action.payload.phase || state.routePhase,
        remainingDistance: action.payload.remainingDistance,
        trafficCondition: action.payload.trafficCondition || state.trafficCondition,
      };

    case "TRAFFIC_UPDATE":
      return { ...state, trafficCondition: action.payload.condition };

    case "ADD_LOG":
      return {
        ...state,
        logs: [action.payload, ...state.logs].slice(0, 50),
      };

    case "EMERGENCY_COMPLETE":
      return {
        ...state,
        activeEmergency: null,
        eta: null,
        etaProgress: 0,
        routePhase: null,
        remainingDistance: null,
      };

    case "SET_TRIGGERING":
      return { ...state, isTriggeringEmergency: action.payload };

    case "UPDATE_HOSPITAL":
      return {
        ...state,
        hospitals: state.hospitals.map((h) =>
          h.id === action.payload.id ? { ...h, ...action.payload } : h
        ),
      };

    default:
      return state;
  }
}

export function EmergencyProvider({ children }) {
  const [state, dispatch] = useReducer(emergencyReducer, initialState);

  const setConnected = useCallback((connected) => {
    dispatch({ type: "SET_CONNECTED", payload: connected });
  }, []);

  const setInitialState = useCallback((data) => {
    dispatch({ type: "SET_INITIAL_STATE", payload: data });
  }, []);

  const handleAmbulanceMove = useCallback((data) => {
    dispatch({ type: "AMBULANCE_MOVE", payload: data });
  }, []);

  const handleEmergencyTriggered = useCallback((data) => {
    dispatch({ type: "EMERGENCY_TRIGGERED", payload: data });
  }, []);

  const handleEtaUpdate = useCallback((data) => {
    dispatch({ type: "ETA_UPDATE", payload: data });
  }, []);

  const handleTrafficUpdate = useCallback((data) => {
    dispatch({ type: "TRAFFIC_UPDATE", payload: data });
  }, []);

  const addLog = useCallback((log) => {
    dispatch({ type: "ADD_LOG", payload: log });
  }, []);

  const handleEmergencyComplete = useCallback(() => {
    dispatch({ type: "EMERGENCY_COMPLETE" });
  }, []);

  const setTriggering = useCallback((val) => {
    dispatch({ type: "SET_TRIGGERING", payload: val });
  }, []);

  return (
    <EmergencyContext.Provider
      value={{
        state,
        setConnected,
        setInitialState,
        handleAmbulanceMove,
        handleEmergencyTriggered,
        handleEtaUpdate,
        handleTrafficUpdate,
        addLog,
        handleEmergencyComplete,
        setTriggering,
      }}
    >
      {children}
    </EmergencyContext.Provider>
  );
}

export function useEmergency() {
  const context = useContext(EmergencyContext);
  if (!context) throw new Error("useEmergency must be used within EmergencyProvider");
  return context;
}
