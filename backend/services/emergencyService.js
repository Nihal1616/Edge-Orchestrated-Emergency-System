const { v4: uuidv4 } = require("uuid");
const {
  findNearestAmbulance,
  findBestHospital,
  generateFullRoute,
  generateTrafficData,
  calculateETA,
  haversineDistance,
} = require("../utils/routeUtils");

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

function clampTrafficLevel(level) {
  const val = Number(level);
  if (!Number.isFinite(val)) return 3;
  return Math.max(1, Math.min(5, Math.round(val)));
}

function conditionToTrafficLevel(condition) {
  const map = { light: 1, moderate: 3, heavy: 4, severe: 5 };
  return map[condition] || 3;
}

function trafficLevelToCondition(level) {
  if (level <= 1) return "light";
  if (level <= 3) return "moderate";
  if (level === 4) return "heavy";
  return "severe";
}

class EmergencyService {
  constructor(io, ambulances, hospitals, mapCenter = { lng: -74.006, lat: 40.7128 }) {
    this.io = io;
    this.ambulances = ambulances;
    this.hospitals = hospitals;
    this.mapCenter = mapCenter;
    this.cityName = "Hyderabad";
    this.hospitalSource = "template";
    this.activeEmergencies = new Map();
    this.ambulanceIntervals = new Map();
    this.trafficInterval = null;
    this.currentTraffic = "moderate";
    this.logs = [];
    this.mlAvailable = true;

    this.startAmbulanceMovement();
    this.startTrafficVariation();
  }

  async postToML(path, payload) {
    const res = await fetch(`${ML_SERVICE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`ML ${path} failed: ${res.status}`);
    }

    return res.json();
  }

  async predictTrafficCondition(distanceKm = 5) {
    try {
      const data = await this.postToML("/get-traffic-prediction", {
        distance: Number(distanceKm.toFixed(2)),
      });

      if (data && data.status === "success") {
        this.mlAvailable = true;
        const level = clampTrafficLevel(data.traffic_level);
        return trafficLevelToCondition(level);
      }
    } catch (e) {
      this.mlAvailable = false;
    }

    return generateTrafficData();
  }

  async predictEmergencyETA(ambulanceCoords, patientCoords, hospitalCoords, trafficCondition) {
    try {
      const trafficLevel = conditionToTrafficLevel(trafficCondition);
      const data = await this.postToML("/quick-emergency-response", {
        ambulance_lat: ambulanceCoords[1],
        ambulance_lon: ambulanceCoords[0],
        patient_lat: patientCoords[1],
        patient_lon: patientCoords[0],
        hospital_lat: hospitalCoords[1],
        hospital_lon: hospitalCoords[0],
        traffic_level: trafficLevel,
      });

      if (data && data.status === "success" && Number.isFinite(Number(data.total_eta_minutes))) {
        this.mlAvailable = true;
        return Math.max(1, Math.round(Number(data.total_eta_minutes)));
      }
    } catch (e) {
      this.mlAvailable = false;
    }

    return null;
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
    this.trafficInterval = setInterval(async () => {
      const prev = this.currentTraffic;
      this.currentTraffic = await this.predictTrafficCondition(6);

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

  recenterSimulation({ mapCenter, ambulances, hospitals, cityName = "My Location", hospitalSource = "template" }) {
    // Reset active emergency movement loops before applying new coordinates.
    this.ambulanceIntervals.forEach((intervalId) => clearInterval(intervalId));
    this.ambulanceIntervals.clear();
    this.activeEmergencies.clear();

    this.mapCenter = mapCenter;
    this.ambulances = ambulances;
    this.hospitals = hospitals;
    this.cityName = cityName;
    this.hospitalSource = hospitalSource;

    this.addLog(
      `Simulation centered at ${cityName} (${mapCenter.lat.toFixed(4)}, ${mapCenter.lng.toFixed(4)})`,
      "info"
    );

    this.io.emit("initialState", this.getState());
  }

  hasActiveEmergency() {
    return this.activeEmergencies.size > 0;
  }

  async triggerEmergency(severity = "critical", location = null) {
    const emergencyId = uuidv4();

    // Generate random patient location near city center
    const patientCoords = location || [
      this.mapCenter.lng + (Math.random() - 0.5) * 0.08,
      this.mapCenter.lat + (Math.random() - 0.5) * 0.08,
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
    const routes = await generateFullRoute(
      ambulance.coordinates,
      patientCoords,
      hospital.coordinates
    );

    // Keep entities aligned with snapped drivable points.
    if (routes?.snapped?.ambulance) {
      ambulance.coordinates = [routes.snapped.ambulance[0], routes.snapped.ambulance[1]];
    }

    if (routes?.snapped?.patient) {
      patientCoords[0] = routes.snapped.patient[0];
      patientCoords[1] = routes.snapped.patient[1];
    }

    if (routes?.snapped?.hospital) {
      hospital.coordinates = [routes.snapped.hospital[0], routes.snapped.hospital[1]];
    }

    // Calculate initial ETA
    const totalDistance =
      haversineDistance(routes.toPatient[0], routes.toPatient[routes.toPatient.length - 1]) +
      haversineDistance(routes.toHospital[0], routes.toHospital[routes.toHospital.length - 1]);
    let eta = await this.predictEmergencyETA(
      ambulance.coordinates,
      patientCoords,
      hospital.coordinates,
      this.currentTraffic
    );

    if (!eta) {
      eta = calculateETA(totalDistance, this.currentTraffic);
    }

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
      severity,
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
      // Keep per-tick updates deterministic and non-blocking.
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
      mapCenter: this.mapCenter,
      cityName: this.cityName,
      hospitalSource: this.hospitalSource,
      ambulances: this.ambulances,
      hospitals: this.hospitals,
      activeEmergencies: Array.from(this.activeEmergencies.values()),
      trafficCondition: this.currentTraffic,
      mlAvailable: this.mlAvailable,
      logs: this.logs.slice(0, 20),
    };
  }
}

module.exports = EmergencyService;
