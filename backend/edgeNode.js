const { v4: uuidv4 } = require("uuid");

function clampTrafficLevel(level) {
  return Math.max(1, Math.min(5, Math.round(level)));
}

function haversine(coordA, coordB) {
  const R = 6371;
  const dLat = toRad(coordB[1] - coordA[1]);
  const dLon = toRad(coordB[0] - coordA[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coordA[1])) *
      Math.cos(toRad(coordB[1])) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(value) {
  return (value * Math.PI) / 180;
}

function scoreHospital(
  candidate,
  patientCoords,
  ambulanceCoords,
  trafficLevel,
  severity,
) {
  const distanceAmbToPatient = haversine(ambulanceCoords, patientCoords);
  const distancePatientToHospital = haversine(
    patientCoords,
    candidate.coordinates,
  );
  const effectiveDistance = distanceAmbToPatient + distancePatientToHospital;
  const capacityPct =
    candidate.capacity > 0 ? candidate.available / candidate.capacity : 0;
  const congestionCost = trafficLevel * 3;
  const severityPenalty =
    severity === "critical" ? 1.2 : severity === "high" ? 1.1 : 1.0;
  const hospitalPressure =
    candidate.available < 3
      ? 30
      : candidate.available < candidate.capacity * 0.25
        ? 15
        : 0;
  const score =
    effectiveDistance * 2.5 +
    congestionCost * 4 +
    hospitalPressure * 1.5 +
    (1 - capacityPct) * 30;

  const reason = `Distance ${effectiveDistance.toFixed(1)}km, ${candidate.available}/${candidate.capacity} beds, traffic ${trafficLevel}/5`;
  return {
    ...candidate,
    score,
    reason,
    distanceAmbToPatient: distanceAmbToPatient.toFixed(2),
    distancePatientToHospital: distancePatientToHospital.toFixed(2),
    estimatedTime: Math.round(
      (effectiveDistance * 2 + congestionCost) * severityPenalty,
    ),
  };
}

function buildSelection(task) {
  const {
    ambulances,
    hospitals,
    patientCoords,
    trafficLevel = 3,
    severity = "critical",
  } = task;
  const availableAmbulances = ambulances.filter(
    (amb) => amb.status === "available",
  );
  const baselineAmbulance = availableAmbulances.reduce((best, amb) => {
    const dist = haversine(amb.coordinates, patientCoords);
    return !best || dist < best.distance
      ? { ambulance: amb, distance: dist }
      : best;
  }, null);

  const hospitalScores = hospitals.map((hospital) =>
    scoreHospital(
      hospital,
      patientCoords,
      baselineAmbulance?.ambulance.coordinates || patientCoords,
      trafficLevel,
      severity,
    ),
  );

  hospitalScores.sort((a, b) => a.score - b.score);

  const selection = {
    requestId: task.requestId,
    type: "scoreResult",
    selectedAmbulance: baselineAmbulance ? baselineAmbulance.ambulance : null,
    selectedHospital: hospitalScores[0] || null,
    baselineHospital: hospitalScores[0] || null,
    alternateHospitals: hospitalScores.slice(1, 4),
    trafficLevel,
    severity,
    explanation: `Selected ${hospitalScores[0]?.name || "none"} based on expected time, capacity, and traffic.`,
    availableAmbulances: availableAmbulances.length,
  };

  return selection;
}

process.on("message", (message) => {
  if (!message || message.type !== "scoreEmergency") return;
  const response = buildSelection(message.task);
  process.send(response);
});

process.on("uncaughtException", (error) => {
  console.error("Edge node error:", error);
});
