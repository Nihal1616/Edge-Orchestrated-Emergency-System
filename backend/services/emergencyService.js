const { v4: uuidv4 } = require("uuid");
const {
  findNearestAmbulance,
  findBestHospital,
  generateFullRoute,
  interpolatePosition,
  generateTrafficData,
  calculateETA,
  haversineDistance,
} = require("../utils/routeUtils");

class EmergencyService {
  constructor(io, ambulances, hospitals) {
    this.io = io;
    this.ambulances = ambulances;
    this.hospitals = hospitals;
    this.activeEmergencies = new Map();
    this.ambulanceIntervals = new Map();
    this.trafficInterval = null;
    this.currentTraffic = "moderate";
    this.logs = [];

    this.startAmbulanceMovement();
    this.startTrafficVariation();
  }

  addLog(message, type = "info") {
    const log = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      message,
      type,
    };
    this.logs.unshift(log);
    if (this.logs.length > 50) this.logs.pop();
    this.io.emit("systemLog", log);
    return log;
  }

  startAmbulanceMovement() {
    // Idle drift for available ambulances
    setInterval(() => {
      this.ambulances.forEach((amb) => {
        if (amb.status === "available") {
          amb.coordinates = [
            amb.coordinates[0] + (Math.random() - 0.5) * 0.001,
            amb.coordinates[1] + (Math.random() - 0.5) * 0.001,
          ];
          amb.heading = (amb.heading + (Math.random() - 0.5) * 20 + 360) % 360;
          this.io.emit("ambulanceMove", {
            id: amb.id,
            coordinates: amb.coordinates,
            heading: amb.heading,
            status: amb.status,
          });
        }
      });
    }, 2000);
  }

  startTrafficVariation() {
    this.trafficInterval = setInterval(() => {
      const prev = this.currentTraffic;
      this.currentTraffic = generateTrafficData();

      if (prev !== this.currentTraffic) {
        this.addLog(
          `Traffic condition changed: ${prev.toUpperCase()} → ${this.currentTraffic.toUpperCase()}`,
          "traffic"
        );
        this.io.emit("trafficUpdate", { condition: this.currentTraffic });

        // Reroute active emergencies
        this.activeEmergencies.forEach((emergency) => {
          if (emergency.phase === "toHospital") {
            const newETA = calculateETA(emergency.remainingDistance, this.currentTraffic);
            emergency.eta = newETA;
            this.addLog(
              `AMB ${emergency.ambulanceId} rerouted due to ${this.currentTraffic} traffic. New ETA: ${newETA} min`,
              "reroute"
            );
            this.io.emit("routeUpdate", {
              emergencyId: emergency.id,
              ambulanceId: emergency.ambulanceId,
              newETA,
              trafficCondition: this.currentTraffic,
              message: `Rerouted due to ${this.currentTraffic} traffic`,
            });
            this.io.emit("etaUpdate", {
              emergencyId: emergency.id,
              eta: newETA,
              trafficCondition: this.currentTraffic,
            });
          }
        });
      }
    }, 12000);
  }

  triggerEmergency(severity = "critical", location = null) {
    const emergencyId = uuidv4();

    // Generate random patient location near city center
    const patientCoords = location || [
      -74.006 + (Math.random() - 0.5) * 0.08,
      40.7128 + (Math.random() - 0.5) * 0.08,
    ];

    // Find nearest available ambulance
    const { ambulance, distance: ambDistance } = findNearestAmbulance(
      patientCoords,
      this.ambulances
    );

    if (!ambulance) {
      this.addLog("⚠ No ambulances available!", "error");
      return null;
    }

    // Find best hospital
    const hospital = findBestHospital(patientCoords, this.hospitals, ambulance.coordinates);

    if (!hospital) {
      this.addLog("⚠ No hospitals available!", "error");
      return null;
    }

    // Generate route
    const routes = generateFullRoute(
      ambulance.coordinates,
      patientCoords,
      hospital.coordinates
    );

    // Calculate initial ETA
    const totalDistance =
      haversineDistance(ambulance.coordinates, patientCoords) +
      haversineDistance(patientCoords, hospital.coordinates);
    const eta = calculateETA(totalDistance, this.currentTraffic);

    // Mark ambulance as dispatched
    ambulance.status = "dispatched";

    const emergency = {
      id: emergencyId,
      severity,
      patientCoords,
      ambulanceId: ambulance.id,
      hospitalId: hospital.id,
      hospital,
      routes,
      eta,
      totalDistance,
      remainingDistance: totalDistance,
      phase: "toPatient",
      progress: 0,
      trafficCondition: this.currentTraffic,
      createdAt: new Date().toISOString(),
    };

    this.activeEmergencies.set(emergencyId, emergency);

    // Reduce hospital availability
    hospital.available = Math.max(0, hospital.available - 1);

    this.addLog(`🚨 EMERGENCY TRIGGERED — ID: ${emergencyId.slice(0, 8)}`, "emergency");
    this.addLog(`📍 Patient located at [${patientCoords.map((c) => c.toFixed(4)).join(", ")}]`, "info");
    this.addLog(`🚑 Dispatching ${ambulance.id} (${ambDistance.toFixed(2)}km away)`, "dispatch");
    this.addLog(`🏥 Assigned to ${hospital.name} (${hospital.available} beds available)`, "hospital");
    this.addLog(`⏱ ETA: ${eta} minutes — Traffic: ${this.currentTraffic}`, "eta");

    // Start ambulance movement simulation
    this.simulateAmbulanceMovement(emergency, ambulance);

    return {
      emergencyId,
      ambulance,
      hospital,
      patientCoords,
      routes,
      eta,
      totalDistance,
      trafficCondition: this.currentTraffic,
    };
  }

  simulateAmbulanceMovement(emergency, ambulance) {
    const routePoints = emergency.routes.full;
    let currentIndex = 0;
    const totalPoints = routePoints.length;

    const interval = setInterval(() => {
      if (currentIndex >= totalPoints - 1) {
        clearInterval(interval);
        this.ambulanceIntervals.delete(emergency.id);
        ambulance.status = "available";
        emergency.phase = "complete";

        this.addLog(`✅ ${ambulance.id} delivered patient to ${emergency.hospital.name}`, "complete");
        this.io.emit("emergencyComplete", { emergencyId: emergency.id });
        this.activeEmergencies.delete(emergency.id);
        return;
      }

      currentIndex = Math.min(currentIndex + 1, totalPoints - 1);
      const progress = currentIndex / (totalPoints - 1);
      emergency.progress = progress;

      // Determine phase
      const patientProgress = emergency.routes.toPatient.length / totalPoints;
      if (progress < patientProgress) {
        emergency.phase = "toPatient";
      } else {
        emergency.phase = "toHospital";
      }

      const newCoords = routePoints[currentIndex];
      ambulance.coordinates = newCoords;

      // Calculate heading
      if (currentIndex < totalPoints - 1) {
        const next = routePoints[Math.min(currentIndex + 1, totalPoints - 1)];
        ambulance.heading = Math.atan2(next[0] - newCoords[0], next[1] - newCoords[1]) * (180 / Math.PI);
      }

      // Update remaining distance and ETA
      const remainingPoints = totalPoints - currentIndex;
      emergency.remainingDistance = emergency.totalDistance * (remainingPoints / totalPoints);
      const newETA = calculateETA(emergency.remainingDistance, this.currentTraffic);
      emergency.eta = newETA;

      this.io.emit("ambulanceMove", {
        id: ambulance.id,
        coordinates: newCoords,
        heading: ambulance.heading,
        status: ambulance.status,
        emergencyId: emergency.id,
        phase: emergency.phase,
        progress,
      });

      this.io.emit("etaUpdate", {
        emergencyId: emergency.id,
        eta: newETA,
        progress,
        phase: emergency.phase,
        remainingDistance: emergency.remainingDistance.toFixed(2),
        trafficCondition: this.currentTraffic,
      });
    }, 1500);

    this.ambulanceIntervals.set(emergency.id, interval);
  }

  getState() {
    return {
      ambulances: this.ambulances,
      hospitals: this.hospitals,
      activeEmergencies: Array.from(this.activeEmergencies.values()),
      trafficCondition: this.currentTraffic,
      logs: this.logs.slice(0, 20),
    };
  }
}

module.exports = EmergencyService;
