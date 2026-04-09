const { v4: uuidv4 } = require("uuid");
const {
  findNearestAmbulance,
  findBestHospital,
  generateFullRoute,
  generateRoute,
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
  constructor(
    io,
    ambulances,
    hospitals,
    mapCenter = { lng: -74.006, lat: 40.7128 },
    edgeService = null,
  ) {
    this.io = io;
    this.ambulances = ambulances;
    this.hospitals = hospitals;
    this.mapCenter = mapCenter;
    this.cityName = "Hyderabad";
    this.hospitalSource = "template";
    this.activeEmergencies = new Map();
    this.pendingEmergencies = [];
    this.ambulanceIntervals = new Map();
    this.trafficInterval = null;
    this.currentTraffic = "moderate";
    this.etaCache = new Map();
    this.logs = [];
    this.mlAvailable = true;
    this.mlEnabled = true;
    this.edgeService = edgeService;

    this.startAmbulanceMovement();
    this.startTrafficVariation();
    this.startHospitalLoadVariation();
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

  async chooseEmergencyPlan(patientCoords, severity) {
    const availableAmbulances = this.ambulances.filter(
      (amb) => amb.status === "available",
    );
    const baselineAmb = findNearestAmbulance(
      patientCoords,
      availableAmbulances,
    ).ambulance;
    const baselineHospital = findBestHospital(
      patientCoords,
      this.hospitals,
      baselineAmb?.coordinates || patientCoords,
    );

    const task = {
      ambulances: availableAmbulances,
      hospitals: this.hospitals,
      patientCoords,
      trafficLevel: conditionToTrafficLevel(this.currentTraffic),
      severity,
    };

    let edgeSelection = null;
    if (this.edgeService && this.mlEnabled) {
      try {
        edgeSelection = await this.edgeService.scoreEmergency(task);
        this.mlAvailable = true;
      } catch (error) {
        this.mlAvailable = false;
        this.addLog(
          "⚠️ Edge decision failed, falling back to heuristic",
          "warning",
        );
      }
    }

    const selectedAmbulance = edgeSelection?.selectedAmbulance || baselineAmb;
    const selectedHospital =
      edgeSelection?.selectedHospital || baselineHospital;
    const mlDecision = {
      selectedHospital: selectedHospital?.name || "Unknown",
      selectedAmbulance: selectedAmbulance?.id || "Unknown",
      explanation:
        edgeSelection?.explanation ||
        "Selected using local dispatch heuristic.",
      trafficLevel: this.currentTraffic,
      baselineHospital: baselineHospital?.name || "Unknown",
      baselineAmbulance: baselineAmb?.id || "Unknown",
      improvedByML: Boolean(edgeSelection?.selectedHospital),
      alternateHospitals: edgeSelection?.alternateHospitals || [],
    };

    return { selectedAmbulance, selectedHospital, mlDecision };
  }

  applyTrafficSpike() {
    this.currentTraffic = "severe";
    this.addLog(
      "🚦 Traffic spike in effect — rerouting emergency vehicles",
      "traffic",
    );
    this.activeEmergencies.forEach((emergency) => {
      if (emergency.phase === "toHospital") {
        this.rerouteEmergency(emergency);
      }
    });
  }

  startHospitalLoadVariation() {
    setInterval(() => {
      const candidate =
        this.hospitals[Math.floor(Math.random() * this.hospitals.length)];
      if (!candidate) return;

      // Ensure at least one hospital always has capacity
      const totalAvailable = this.hospitals.reduce(
        (sum, h) => sum + h.available,
        0,
      );
      if (totalAvailable <= 1 && candidate.available === 0) {
        // Don't reduce capacity if this would make all hospitals full
        return;
      }

      const change = Math.round((Math.random() - 0.4) * 2);
      candidate.available = Math.max(
        0,
        Math.min(candidate.capacity, candidate.available + change),
      );
      if (candidate.available <= 5) {
        candidate.status = "critical";
      } else if (candidate.available <= Math.ceil(candidate.capacity * 0.2)) {
        candidate.status = "limited";
      } else {
        candidate.status = "available";
      }
      this.io.emit("hospitalUpdate", candidate);

      if (candidate.available === 0) {
        this.addLog(
          `🏥 ${candidate.name} is now full, rerouting nearby patients`,
          "hospital",
        );
        this.activeEmergencies.forEach((emergency) => {
          if (
            emergency.hospitalId === candidate.id &&
            emergency.phase !== "complete"
          ) {
            this.reassignHospital(emergency);
          }
        });
      }
    }, 17000);
  }

  async rerouteEmergency(emergency) {
    const ambulance = this.ambulances.find(
      (amb) => amb.id === emergency.ambulanceId,
    );
    if (!ambulance) return;

    this.addLog(
      `🔁 Rerouting ${ambulance.id} for emergency ${emergency.id} due to traffic or capacity changes`,
      "reroute",
    );

    const routes = await generateFullRoute(
      ambulance.coordinates,
      emergency.patientCoords,
      emergency.hospital.coordinates,
    );

    emergency.routes = routes;
    emergency.totalDistance =
      haversineDistance(
        routes.toPatient[0],
        routes.toPatient[routes.toPatient.length - 1],
      ) +
      haversineDistance(
        routes.toHospital[0],
        routes.toHospital[routes.toHospital.length - 1],
      );
    emergency.remainingDistance =
      emergency.totalDistance * (1 - emergency.progress);
    emergency.eta = calculateETA(
      emergency.remainingDistance,
      this.currentTraffic,
    );

    this.io.emit("routeUpdate", {
      emergencyId: emergency.id,
      ambulanceId: ambulance.id,
      newETA: emergency.eta,
      trafficCondition: this.currentTraffic,
      routes: emergency.routes,
      message: `Rerouted to ${emergency.hospital.name}`,
    });
  }

  reassignHospital(emergency) {
    const alternate = this.hospitals.find(
      (h) =>
        h.id !== emergency.hospitalId &&
        h.status !== "critical" &&
        h.available > 0,
    );
    if (!alternate) {
      this.addLog(
        `⚠️ No alternate hospital available for emergency ${emergency.id}. Waiting...`,
        "hospital",
      );
      return;
    }

    emergency.hospital = alternate;
    emergency.hospitalId = alternate.id;
    alternate.available = Math.max(0, alternate.available - 1);
    emergency.routes = {
      ...emergency.routes,
      toHospital: generateRoute(
        emergency.patientCoords,
        alternate.coordinates,
        10,
      ),
      full: [
        ...emergency.routes.toPatient,
        ...generateRoute(
          emergency.patientCoords,
          alternate.coordinates,
          10,
        ).slice(1),
      ],
    };
    emergency.totalDistance =
      haversineDistance(
        emergency.routes.toPatient[0],
        emergency.routes.toPatient[emergency.routes.toPatient.length - 1],
      ) +
      haversineDistance(
        emergency.routes.toHospital[0],
        emergency.routes.toHospital[emergency.routes.toHospital.length - 1],
      );
    emergency.remainingDistance =
      emergency.totalDistance * (1 - emergency.progress);
    emergency.eta = calculateETA(
      emergency.remainingDistance,
      this.currentTraffic,
    );

    this.addLog(
      `🏥 Rerouted emergency ${emergency.id} to ${alternate.name} due to full hospital`,
      "hospital",
    );
    this.io.emit("routeUpdate", {
      emergencyId: emergency.id,
      ambulanceId: emergency.ambulanceId,
      newETA: emergency.eta,
      trafficCondition: this.currentTraffic,
      message: `Hospital full; rerouted to ${alternate.name}`,
    });
  }

  async predictTrafficCondition(distanceKm = 5) {
    if (!this.mlEnabled) {
      return generateTrafficData();
    }

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

  async predictEmergencyETA(
    ambulanceCoords,
    patientCoords,
    hospitalCoords,
    trafficCondition,
  ) {
    if (!this.mlEnabled) {
      return null;
    }

    // Create cache key from coordinates and traffic
    const cacheKey = `${ambulanceCoords.join(",")}-${patientCoords.join(",")}-${hospitalCoords.join(",")}-${trafficCondition}`;

    // Check cache first
    if (this.etaCache.has(cacheKey)) {
      return this.etaCache.get(cacheKey);
    }

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

      if (
        data &&
        data.status === "success" &&
        Number.isFinite(Number(data.total_eta_minutes))
      ) {
        this.mlAvailable = true;
        const eta = Math.max(1, Math.round(Number(data.total_eta_minutes)));
        // Cache the result
        this.etaCache.set(cacheKey, eta);
        return eta;
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
        // Clear ETA cache when traffic changes
        this.etaCache.clear();
        this.addLog(
          `Traffic condition changed: ${prev.toUpperCase()} → ${this.currentTraffic.toUpperCase()}`,
          "traffic",
        );
        this.io.emit("trafficUpdate", { condition: this.currentTraffic });

        // Reroute active emergencies
        this.activeEmergencies.forEach((emergency) => {
          if (emergency.phase === "toHospital") {
            const newETA = calculateETA(
              emergency.remainingDistance,
              this.currentTraffic,
            );
            emergency.eta = newETA;
            this.addLog(
              `AMB ${emergency.ambulanceId} rerouted due to ${this.currentTraffic} traffic. New ETA: ${newETA} min`,
              "reroute",
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

  recenterSimulation({
    mapCenter,
    ambulances,
    hospitals,
    cityName = "My Location",
    hospitalSource = "template",
  }) {
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
      "info",
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

    const plan = await this.chooseEmergencyPlan(patientCoords, severity);
    const ambulance = plan.selectedAmbulance;
    const hospital = plan.selectedHospital;
    const mlDecision = plan.mlDecision;

    if (!ambulance) {
      this.addLog("⚠ No ambulances available!", "error");
      return null;
    }

    if (!hospital) {
      this.addLog("⚠ No hospital could be selected!", "error");
      return null;
    }

    const ambDistance = haversineDistance(ambulance.coordinates, patientCoords);

    // Generate route
    let routes;
    try {
      routes = await generateFullRoute(
        ambulance.coordinates,
        patientCoords,
        hospital.coordinates,
      );
    } catch (error) {
      console.error("Route generation failed:", error);
      this.addLog("⚠ Route generation failed, using fallback", "warning");
      // Create fallback routes
      routes = {
        toPatient: generateRoute(ambulance.coordinates, patientCoords, 8),
        toHospital: generateRoute(patientCoords, hospital.coordinates, 12),
        full: [],
        snapped: {
          ambulance: ambulance.coordinates,
          patient: patientCoords,
          hospital: hospital.coordinates,
        },
      };
    }

    // Keep entities aligned with snapped drivable points.
    if (routes?.snapped?.ambulance) {
      ambulance.coordinates = [
        routes.snapped.ambulance[0],
        routes.snapped.ambulance[1],
      ];
    }

    if (routes?.snapped?.patient) {
      patientCoords[0] = routes.snapped.patient[0];
      patientCoords[1] = routes.snapped.patient[1];
    }

    if (routes?.snapped?.hospital) {
      hospital.coordinates = [
        routes.snapped.hospital[0],
        routes.snapped.hospital[1],
      ];
    }

    // Calculate initial ETA
    const totalDistance =
      haversineDistance(
        routes.toPatient[0],
        routes.toPatient[routes.toPatient.length - 1],
      ) +
      haversineDistance(
        routes.toHospital[0],
        routes.toHospital[routes.toHospital.length - 1],
      );
    let eta = await this.predictEmergencyETA(
      ambulance.coordinates,
      patientCoords,
      hospital.coordinates,
      this.currentTraffic,
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

    this.addLog(
      `🚨 EMERGENCY TRIGGERED — ID: ${emergencyId.slice(0, 8)}`,
      "emergency",
    );
    this.addLog(
      `📍 Patient located at [${patientCoords.map((c) => c.toFixed(4)).join(", ")}]`,
      "info",
    );
    this.addLog(
      `🚑 Dispatching ${ambulance.id} (${ambDistance.toFixed(2)}km away)`,
      "dispatch",
    );
    this.addLog(
      `🏥 Assigned to ${hospital.name} (${hospital.available} beds available)`,
      "hospital",
    );
    this.addLog(
      `⏱ ETA: ${eta} minutes — Traffic: ${this.currentTraffic}`,
      "eta",
    );

    if (mlDecision.improvedByML) {
      this.addLog(
        `🤖 ML prioritized ${mlDecision.selectedHospital} over ${mlDecision.baselineHospital}`,
        "ml",
      );
    }

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
      aiDecision: mlDecision,
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

        // Restore hospital capacity
        emergency.hospital.available = Math.min(
          emergency.hospital.capacity,
          emergency.hospital.available + 1,
        );

        this.addLog(
          `✅ ${ambulance.id} delivered patient to ${emergency.hospital.name}`,
          "complete",
        );
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
        ambulance.heading =
          Math.atan2(next[0] - newCoords[0], next[1] - newCoords[1]) *
          (180 / Math.PI);
      }

      // Update remaining distance and ETA
      const remainingPoints = totalPoints - currentIndex;
      emergency.remainingDistance =
        emergency.totalDistance * (remainingPoints / totalPoints);
      // Keep per-tick updates deterministic and non-blocking.
      const newETA = calculateETA(
        emergency.remainingDistance,
        this.currentTraffic,
      );
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
    }, 1000);

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
      mlEnabled: this.mlEnabled,
      logs: this.logs.slice(0, 20),
    };
  }
}

module.exports = EmergencyService;
