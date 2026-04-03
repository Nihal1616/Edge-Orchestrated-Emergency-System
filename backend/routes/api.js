const express = require("express");
const router = express.Router();

module.exports = (emergencyService) => {
  // POST /emergency - Trigger a new emergency
  router.post("/emergency", (req, res) => {
    try {
      const { severity = "critical", location = null } = req.body;
      const result = emergencyService.triggerEmergency(severity, location);

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
