import { useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import { useEmergency } from "../context/EmergencyContext";

const SOCKET_URL = "http://localhost:3001";

export function useSocket() {
  const socketRef = useRef(null);
  const {
    setConnected,
    setInitialState,
    handleAmbulanceMove,
    handleEtaUpdate,
    handleTrafficUpdate,
    addLog,
    handleEmergencyComplete,
  } = useEmergency();

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      console.log("✅ Connected to EERS backend");
    });

    socket.on("disconnect", () => {
      setConnected(false);
      console.log("❌ Disconnected from EERS backend");
    });

    socket.on("connect_error", (err) => {
      console.warn("Socket reconnecting:", err.message);
    });

    socket.on("initialState", (data) => {
      setInitialState(data);
    });

    socket.on("ambulanceMove", (data) => {
      handleAmbulanceMove(data);
    });

    socket.on("etaUpdate", (data) => {
      handleEtaUpdate(data);
    });

    socket.on("trafficUpdate", (data) => {
      handleTrafficUpdate(data);
    });

    socket.on("systemLog", (log) => {
      addLog(log);
    });

    socket.on("emergencyComplete", () => {
      handleEmergencyComplete();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const requestState = useCallback(() => {
    socketRef.current?.emit("requestState");
  }, []);

  return { socket: socketRef.current, requestState };
}
