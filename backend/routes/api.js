const express = require("express");
const router = express.Router();
const {
  createRealtimeSimulationData,
  createCitySimulationData,
} = require("../utils/mockData");

module.exports = (emergencyService) => {
  // POST /location
  router.post("/location", async (req, res) => {
    try {
      if (emergencyService.hasActiveEmergency()) {
        return res
          .status(409)
          .json({
            success: false,
            message: "Cannot change location during an active emergency",
          });
      }
      const { latitude, longitude } = req.body || {};
      const lat = Number(latitude);
      const lng = Number(longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res
          .status(400)
          .json({
            success: false,
            message: "latitude and longitude are required numbers",
          });
      }
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res
          .status(400)
          .json({ success: false, message: "latitude/longitude out of range" });
      }
      const result = await createRealtimeSimulationData(
        { lat, lng },
        "My Location",
      );
      emergencyService.recenterSimulation(result);
      res.json({
        success: true,
        data: {
          mapCenter: result.mapCenter,
          cityName: result.cityName,
          hospitalSource: result.hospitalSource,
          hospitalsCount: result.hospitals.length,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /city
  router.post("/city", async (req, res) => {
    try {
      if (emergencyService.hasActiveEmergency()) {
        return res
          .status(409)
          .json({
            success: false,
            message: "Cannot switch city during an active emergency",
          });
      }
      const city = String(req.body?.city || "").trim();
      if (!city)
        return res
          .status(400)
          .json({ success: false, message: "city is required" });
      const result = await createCitySimulationData(city);
      emergencyService.recenterSimulation(result);
      res.json({
        success: true,
        data: {
          mapCenter: result.mapCenter,
          cityName: result.cityName,
          hospitalSource: result.hospitalSource,
          hospitalsCount: result.hospitals.length,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /emergency
  router.post("/emergency", async (req, res) => {
    try {
      const { severity = "critical", location = null } = req.body;

      // Convert location object to array format if needed
      let locationArray = null;
      if (location) {
        if (Array.isArray(location)) {
          locationArray = location;
        } else if (location.lat !== undefined && location.lng !== undefined) {
          locationArray = [location.lng, location.lat];
        }
      }

      const result = await emergencyService.triggerEmergency(
        severity,
        locationArray,
      );
      if (!result)
        return res
          .status(503)
          .json({ success: false, message: "No resources available" });
      res.json({ success: true, data: result });
    } catch (err) {
      console.error(err);
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // POST /disaster - trigger multiple emergencies at once
  router.post("/disaster", async (req, res) => {
    try {
      const { count = 3 } = req.body || {};
      const maxCount = Math.min(Number(count) || 3, 5);
      emergencyService.addLog(
        `⚡ DISASTER MODE: Spawning ${maxCount} emergencies`,
        "emergency",
      );

      const results = [];
      for (let i = 0; i < maxCount; i++) {
        await new Promise((r) => setTimeout(r, 200 * i));
        const severity = i === 0 ? "critical" : i === 1 ? "critical" : "high";
        const result = await emergencyService.triggerEmergency(severity);
        if (result) results.push(result);
      }

      res.json({
        success: true,
        data: { triggered: results.length, emergencies: results },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /hospitals
  router.get("/hospitals", (req, res) => {
    res.json({ success: true, data: emergencyService.hospitals });
  });

  // GET /ambulances
  router.get("/ambulances", (req, res) => {
    res.json({ success: true, data: emergencyService.ambulances });
  });

  // GET /state
  router.get("/state", (req, res) => {
    res.json({ success: true, data: emergencyService.getState() });
  });

  // GET /reports - completed emergency reports
  router.get("/reports", (req, res) => {
    res.json({ success: true, data: emergencyService.completedReports || [] });
  });

  return router;
};
