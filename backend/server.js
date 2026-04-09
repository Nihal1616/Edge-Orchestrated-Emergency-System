const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const {
  createSimulationData,
  DEFAULT_CITY_CENTER,
  DEFAULT_CITY_NAME,
} = require("./utils/mockData");
const EmergencyService = require("./services/emergencyService");
const EdgeDecisionService = require("./services/edgeDecisionService");
const apiRoutes = require("./routes/api");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

app.use(cors());
app.use(express.json());

const { mapCenter, hospitals, ambulances } =
  createSimulationData(DEFAULT_CITY_CENTER);
const edgeDecisionService = new EdgeDecisionService();
const emergencyService = new EmergencyService(
  io,
  ambulances,
  hospitals,
  mapCenter,
  edgeDecisionService,
);
emergencyService.cityName = DEFAULT_CITY_NAME;

app.use("/api", apiRoutes(emergencyService));
app.get("/health", (req, res) =>
  res.json({ status: "ok", timestamp: new Date().toISOString() }),
);

io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);
  socket.emit("initialState", emergencyService.getState());

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  socket.on("requestState", () => {
    socket.emit("initialState", emergencyService.getState());
  });

  // Simulation control from frontend
  socket.on("simControl", (data) => {
    if (!data || !data.type) return;

    if (data.type === "setTraffic") {
      const levelMap = {
        1: "light",
        2: "light",
        3: "moderate",
        4: "heavy",
        5: "severe",
      };
      const condition = levelMap[data.level] || "moderate";
      emergencyService.currentTraffic = condition;
      io.emit("trafficUpdate", { condition });
      emergencyService.addLog(
        `🎮 Sim: Traffic manually set to ${condition.toUpperCase()}`,
        "traffic",
      );
    }

    if (data.type === "trafficSpike") {
      emergencyService.applyTrafficSpike();
      io.emit("trafficUpdate", { condition: emergencyService.currentTraffic });
      emergencyService.addLog(
        `⚠️ Traffic spike injected: ${emergencyService.currentTraffic.toUpperCase()}`,
        "traffic",
      );
    }

    if (data.type === "setML") {
      emergencyService.mlEnabled = data.enabled;
      emergencyService.addLog(
        `🎮 Sim: ML Engine ${data.enabled ? "ENABLED" : "DISABLED"}`,
        "info",
      );
      io.emit("mlStatus", {
        enabled: data.enabled,
        available: emergencyService.mlAvailable,
      });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚑 EERS Command Center`);
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket ready\n`);
});
