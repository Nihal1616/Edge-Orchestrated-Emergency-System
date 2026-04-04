const express = require("express");
const router = express.Router();
const { createRealtimeSimulationData, createCitySimulationData } = require("../utils/mockData");

module.exports = (emergencyService) => {
  // POST /location - Set map center and regenerate simulation around user location
  router.post("/location", async (req, res) => {
    try {
      if (emergencyService.hasActiveEmergency()) {
        return res.status(409).json({
          success: false,
          message: "Cannot change location during an active emergency",
        });
      }

      const { latitude, longitude } = req.body || {};
      const lat = Number(latitude);
      const lng = Number(longitude);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return res.status(400).json({
          success: false,
          message: "latitude and longitude are required numbers",
        });
      }

      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return res.status(400).json({
          success: false,
          message: "latitude/longitude out of range",
        });
      }

      const result = await createRealtimeSimulationData({ lat, lng }, "My Location");
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

  // POST /city - Recenter simulation to selected city and fetch real hospitals
  router.post("/city", async (req, res) => {
    try {
      if (emergencyService.hasActiveEmergency()) {
        return res.status(409).json({
          success: false,
          message: "Cannot switch city during an active emergency",
        });
      }

      const city = String(req.body?.city || "").trim();
      if (!city) {
        return res.status(400).json({ success: false, message: "city is required" });
      }

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

  // POST /emergency - Trigger a new emergency
  router.post("/emergency", async (req, res) => {
    try {
      const { severity = "critical", location = null } = req.body;
      const result = await emergencyService.triggerEmergency(severity, location);

      if (!result) {
        return res.status(503).json({
          success: false,
          message: "No resources available",
        });
      }

      res.json({ success: true, data: result });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /hospitals - Get all hospital data
  router.get("/hospitals", (req, res) => {
    res.json({
      success: true,
      data: emergencyService.hospitals,
    });
  });

  // GET /ambulances - Get all ambulance data
  router.get("/ambulances", (req, res) => {
    res.json({
      success: true,
      data: emergencyService.ambulances,
    });
  });

  // GET /state - Get full system state
  router.get("/state", (req, res) => {
    res.json({
      success: true,
      data: emergencyService.getState(),
    });
  });

  return router;
};
