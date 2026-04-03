// Utility functions for distance and route calculations

function haversineDistance(coord1, coord2) {
  const R = 6371; // Earth radius in km
  const dLat = toRad(coord2[1] - coord1[1]);
  const dLon = toRad(coord2[0] - coord1[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1[1])) *
      Math.cos(toRad(coord2[1])) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function findNearestAmbulance(patientCoords, ambulances) {
  let nearest = null;
  let minDist = Infinity;

  for (const amb of ambulances) {
    if (amb.status !== "available") continue;
    const dist = haversineDistance(patientCoords, amb.coordinates);
    if (dist < minDist) {
      minDist = dist;
      nearest = amb;
    }
  }
  return { ambulance: nearest, distance: minDist };
}

function findBestHospital(patientCoords, hospitals, ambulanceCoords) {
  let best = null;
  let bestScore = Infinity;

  for (const hospital of hospitals) {
    if (hospital.status === "critical" && hospital.available < 2) continue;

    const distFromPatient = haversineDistance(patientCoords, hospital.coordinates);
    const availabilityScore = 100 - (hospital.available / hospital.capacity) * 100;
    const levelBonus = hospital.level.includes("Level I") ? 0 : hospital.level.includes("Level II") ? 5 : 10;

    const score = distFromPatient * 0.6 + availabilityScore * 0.3 + levelBonus;

    if (score < bestScore) {
      bestScore = score;
      best = hospital;
    }
  }
  return best;
}

function generateRoute(startCoord, endCoord, waypoints = 8) {
  const route = [startCoord];

  for (let i = 1; i < waypoints; i++) {
    const t = i / waypoints;
    const jitter = 0.003;
    const lng = startCoord[0] + (endCoord[0] - startCoord[0]) * t + (Math.random() - 0.5) * jitter;
    const lat = startCoord[1] + (endCoord[1] - startCoord[1]) * t + (Math.random() - 0.5) * jitter;
    route.push([lng, lat]);
  }

  route.push(endCoord);
  return route;
}

function generateFullRoute(ambulanceCoords, patientCoords, hospitalCoords) {
  const toPatient = generateRoute(ambulanceCoords, patientCoords, 6);
  const toHospital = generateRoute(patientCoords, hospitalCoords, 10);
  return { toPatient, toHospital, full: [...toPatient, ...toHospital.slice(1)] };
}

function interpolatePosition(start, end, progress) {
  return [
    start[0] + (end[0] - start[0]) * progress,
    start[1] + (end[1] - start[1]) * progress,
  ];
}

function generateTrafficData() {
  const conditions = ["light", "moderate", "heavy", "severe"];
  const weights = [0.35, 0.35, 0.2, 0.1];
  let r = Math.random();
  let cumulative = 0;
  for (let i = 0; i < conditions.length; i++) {
    cumulative += weights[i];
    if (r < cumulative) return conditions[i];
  }
  return "moderate";
}

function trafficMultiplier(condition) {
  const map = { light: 1.0, moderate: 1.3, heavy: 1.7, severe: 2.2 };
  return map[condition] || 1.0;
}

function calculateETA(distanceKm, trafficCondition) {
  const baseSpeedKmh = 60;
  const effectiveSpeed = baseSpeedKmh / trafficMultiplier(trafficCondition);
  const hours = distanceKm / effectiveSpeed;
  return Math.round(hours * 60); // in minutes
}

module.exports = {
  haversineDistance,
  findNearestAmbulance,
  findBestHospital,
  generateRoute,
  generateFullRoute,
  interpolatePosition,
  generateTrafficData,
  trafficMultiplier,
  calculateETA,
};
