// Simulation data is generated around a center so the map can follow the user's location.
const DEFAULT_CITY_CENTER = { lng: 78.4867, lat: 17.385 }; // Hyderabad fallback
const DEFAULT_CITY_NAME = "Hyderabad";

const HOSPITAL_TEMPLATES = [
  {
    id: "h1",
    name: "Regional Medical Center A",
    offset: [0.0001, 0.0154],
    capacity: 120,
    available: 45,
    level: "Level I Trauma",
    specialties: ["Trauma", "Cardiac", "Neuro"],
    status: "available",
  },
  {
    id: "h2",
    name: "Regional Medical Center B",
    offset: [0.0203, 0.0361],
    capacity: 80,
    available: 12,
    level: "Level II Trauma",
    specialties: ["Orthopedic", "General"],
    status: "limited",
  },
  {
    id: "h3",
    name: "Regional Trauma Center",
    offset: [0.0618, -0.0346],
    capacity: 95,
    available: 67,
    level: "Level I Trauma",
    specialties: ["Trauma", "Burns", "Pediatric"],
    status: "available",
  },
  {
    id: "h4",
    name: "City Emergency Hospital",
    offset: [0.1412, 0.0154],
    capacity: 110,
    available: 3,
    level: "Level III",
    specialties: ["General", "Cardiac"],
    status: "critical",
  },
  {
    id: "h5",
    name: "North District Hospital",
    offset: [0.1412, 0.132],
    capacity: 75,
    available: 38,
    level: "Level II Trauma",
    specialties: ["Trauma", "Neuro"],
    status: "available",
  },
];

const AMBULANCE_TEMPLATES = [
  {
    id: "AMB-001",
    offset: [-0.006, -0.0078],
    crew: ["Dr. Martinez", "EMT Chen"],
    type: "ALS",
    heading: 45,
  },
  {
    id: "AMB-002",
    offset: [0.008, 0.0122],
    crew: ["Dr. Patel", "EMT Williams"],
    type: "ALS",
    heading: 120,
  },
  {
    id: "AMB-003",
    offset: [0.041, 0.0022],
    crew: ["EMT Johnson", "EMT Davis"],
    type: "BLS",
    heading: 200,
  },
  {
    id: "AMB-004",
    offset: [-0.019, 0.0252],
    crew: ["Dr. Thompson", "EMT Garcia"],
    type: "ALS",
    heading: 320,
  },
  {
    id: "AMB-005",
    offset: [0.028, 0.0392],
    crew: ["EMT Brown", "EMT Wilson"],
    type: "BLS",
    heading: 90,
  },
  {
    id: "AMB-006",
    offset: [-0.032, -0.018],
    crew: ["Dr. Lee", "EMT Park"],
    type: "ALS",
    heading: 180,
  },
  {
    id: "AMB-007",
    offset: [0.055, 0.028],
    crew: ["EMT Taylor", "EMT Anderson"],
    type: "BLS",
    heading: 270,
  },
];

function createSimulationData(center = DEFAULT_CITY_CENTER) {
  const mapCenter = {
    lng: Number(center.lng),
    lat: Number(center.lat),
  };

  const hospitals = HOSPITAL_TEMPLATES.map((h) => ({
    ...h,
    coordinates: [mapCenter.lng + h.offset[0], mapCenter.lat + h.offset[1]],
  }));

  const ambulances = AMBULANCE_TEMPLATES.map((a) => ({
    ...a,
    status: "available",
    coordinates: [mapCenter.lng + a.offset[0], mapCenter.lat + a.offset[1]],
  }));

  return { mapCenter, hospitals, ambulances };
}

function computeHospitalStatus(available, capacity) {
  if (available <= 5) return "critical";
  if (available <= Math.ceil(capacity * 0.2)) return "limited";
  return "available";
}

function normalizeHospitalFromOSM(element, index) {
  const tags = element.tags || {};
  const lat = Number(element.lat ?? (element.center && element.center.lat));
  const lng = Number(element.lon ?? (element.center && element.center.lon));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const capacity = 50 + ((index * 17) % 140);
  const available = Math.max(
    3,
    Math.floor(capacity * (0.2 + ((index * 13) % 60) / 100)),
  );
  const status = computeHospitalStatus(available, capacity);

  const specialties = [
    tags.emergency === "yes" ? "Emergency" : null,
    tags.healthcare ? "General" : null,
    tags["healthcare:speciality"] ? "Specialist" : null,
  ].filter(Boolean);

  return {
    id: `osm-${element.type}-${element.id}`,
    name: tags.name || `Hospital ${index + 1}`,
    coordinates: [lng, lat],
    capacity,
    available,
    level: available > capacity * 0.5 ? "Level II" : "Level I Trauma",
    specialties: specialties.length ? specialties : ["General"],
    status,
    source: "osm",
  };
}

async function fetchHospitalsFromOSM(center, radiusKm = 30, limit = 18) {
  const radiusM = Math.round(radiusKm * 1000);
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="hospital"](around:${radiusM},${center.lat},${center.lng});
      way["amenity"="hospital"](around:${radiusM},${center.lat},${center.lng});
      relation["amenity"="hospital"](around:${radiusM},${center.lat},${center.lng});
      node["healthcare"="hospital"](around:${radiusM},${center.lat},${center.lng});
      way["healthcare"="hospital"](around:${radiusM},${center.lat},${center.lng});
      relation["healthcare"="hospital"](around:${radiusM},${center.lat},${center.lng});
      node["amenity"="clinic"](around:${radiusM},${center.lat},${center.lng});
      way["amenity"="clinic"](around:${radiusM},${center.lat},${center.lng});
      relation["amenity"="clinic"](around:${radiusM},${center.lat},${center.lng});
    );
    out center tags;
  `;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "User-Agent": "EERS/1.0 (hospital-discovery)",
        },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!res.ok) continue;

      const data = await res.json();
      const elements = Array.isArray(data.elements) ? data.elements : [];
      const hospitals = elements
        .map((el, idx) => normalizeHospitalFromOSM(el, idx))
        .filter(Boolean)
        .slice(0, limit);

      if (hospitals.length > 0) return hospitals;
    } catch (_) {
      // Try next endpoint.
    }
  }

  throw new Error("No hospitals found from OSM endpoints");
}

async function geocodeCity(cityName) {
  const q = encodeURIComponent(`${cityName}, India`);
  const url = `https://nominatim.openstreetmap.org/search?q=${q}&format=json&limit=1`;

  const res = await fetch(url, {
    headers: {
      "User-Agent": "EERS/1.0 (city-geocode)",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Nominatim failed: ${res.status}`);
  }

  const rows = await res.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("City not found");
  }

  return {
    lat: Number(rows[0].lat),
    lng: Number(rows[0].lon),
    cityName,
  };
}

async function createRealtimeSimulationData(center, cityName = "My Location") {
  const base = createSimulationData(center);

  try {
    const osmHospitals = await fetchHospitalsFromOSM(base.mapCenter);
    if (osmHospitals.length >= 3) {
      return {
        mapCenter: base.mapCenter,
        hospitals: osmHospitals,
        ambulances: base.ambulances,
        cityName,
        hospitalSource: "osm",
      };
    }
  } catch (_) {
    // Fallback to template hospitals when OSM lookup fails.
  }

  return {
    ...base,
    cityName,
    hospitalSource: "template",
  };
}

async function createCitySimulationData(cityName) {
  const center = await geocodeCity(cityName);
  return createRealtimeSimulationData(center, cityName);
}

module.exports = {
  DEFAULT_CITY_CENTER,
  DEFAULT_CITY_NAME,
  createSimulationData,
  createRealtimeSimulationData,
  createCitySimulationData,
};
