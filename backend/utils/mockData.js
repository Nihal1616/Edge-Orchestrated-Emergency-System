// Mock data for the simulation
const CITY_CENTER = { lng: -74.006, lat: 40.7128 }; // New York City

const hospitals = [
  {
    id: "h1",
    name: "Manhattan General Hospital",
    coordinates: [-74.0059, 40.7282],
    capacity: 120,
    available: 45,
    level: "Level I Trauma",
    specialties: ["Trauma", "Cardiac", "Neuro"],
    status: "available",
  },
  {
    id: "h2",
    name: "St. Luke's Medical Center",
    coordinates: [-73.9857, 40.7489],
    capacity: 80,
    available: 12,
    level: "Level II Trauma",
    specialties: ["Orthopedic", "General"],
    status: "limited",
  },
  {
    id: "h3",
    name: "Brooklyn Trauma Center",
    coordinates: [-73.9442, 40.6782],
    capacity: 95,
    available: 67,
    level: "Level I Trauma",
    specialties: ["Trauma", "Burns", "Pediatric"],
    status: "available",
  },
  {
    id: "h4",
    name: "Queens Medical Hub",
    coordinates: [-73.8648, 40.7282],
    capacity: 110,
    available: 3,
    level: "Level III",
    specialties: ["General", "Cardiac"],
    status: "critical",
  },
  {
    id: "h5",
    name: "Bronx Emergency Center",
    coordinates: [-73.8648, 40.8448],
    capacity: 75,
    available: 38,
    level: "Level II Trauma",
    specialties: ["Trauma", "Neuro"],
    status: "available",
  },
];

const ambulances = [
  {
    id: "AMB-001",
    coordinates: [-74.012, 40.705],
    status: "available",
    crew: ["Dr. Martinez", "EMT Chen"],
    type: "ALS",
    heading: 45,
  },
  {
    id: "AMB-002",
    coordinates: [-73.998, 40.725],
    status: "available",
    crew: ["Dr. Patel", "EMT Williams"],
    type: "ALS",
    heading: 120,
  },
  {
    id: "AMB-003",
    coordinates: [-73.965, 40.715],
    status: "available",
    crew: ["EMT Johnson", "EMT Davis"],
    type: "BLS",
    heading: 200,
  },
  {
    id: "AMB-004",
    coordinates: [-74.025, 40.738],
    status: "available",
    crew: ["Dr. Thompson", "EMT Garcia"],
    type: "ALS",
    heading: 320,
  },
  {
    id: "AMB-005",
    coordinates: [-73.978, 40.752],
    status: "available",
    crew: ["EMT Brown", "EMT Wilson"],
    type: "BLS",
    heading: 90,
  },
];

module.exports = { hospitals, ambulances, CITY_CENTER };
