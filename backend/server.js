const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const { createSimulationData, DEFAULT_CITY_CENTER, DEFAULT_CITY_NAME } = require("./utils/mockData");
const EmergencyService = require("./services/emergencyService");
const apiRoutes = require("./routes/api");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());

const { mapCenter, hospitals, ambulances } = createSimulationData(DEFAULT_CITY_CENTER);

// Initialize Emergency Service
const emergencyService = new EmergencyService(io, ambulances, hospitals, mapCenter);
emergencyService.cityName = DEFAULT_CITY_NAME;

// Routes
app.use("/api", apiRoutes(emergencyService));

// Health check
app.get("/health", (req, res) => res.json({ status: "ok", timestamp: new Date().toISOString() }));

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Send initial state on connect
  socket.emit("initialState", emergencyService.getState());

  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
  });

  // Allow client to request state refresh
  socket.on("requestState", () => {
    socket.emit("initialState", emergencyService.getState());
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🚑 Edge Emergency Response System`);
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔌 WebSocket ready\n`);
});
