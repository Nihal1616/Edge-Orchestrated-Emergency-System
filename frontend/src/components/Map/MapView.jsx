import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEmergency } from "../../context/EmergencyContext";

// ─── Leaflet default icon fix (Vite asset path issue) ───────────────────────
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

const TRAFFIC_COLORS = {
  light:    "#00ff88",
  moderate: "#ffaa00",
  heavy:    "#ff6600",
  severe:   "#ff2020",
};

const HOSPITAL_COLORS = {
  available: "#00cc6a",
  limited:   "#ffaa00",
  critical:  "#ff2020",
};

// CartoDB Dark Matter — free, no API key needed
const DARK_TILE_URL =
  "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';

function divIcon(html, size = [36, 36]) {
  return L.divIcon({
    html,
    className: "",
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2],
    popupAnchor: [0, -(size[1] / 2 + 4)],
  });
}

function ambulanceIcon(dispatched, heading) {
  const shadow = dispatched
    ? "0 0 18px rgba(255,32,32,0.9)"
    : "0 0 14px rgba(0,136,255,0.7)";
  const border = dispatched ? "#ff2020" : "#0088ff";
  const bg     = dispatched ? "rgba(255,32,32,0.15)" : "rgba(0,136,255,0.15)";
  const anim   = dispatched ? "ambulance-emergency" : "ambulance-pulse";
  return divIcon(
    `<div style="width:34px;height:34px;border-radius:50%;background:${bg};border:2px solid ${border};
      display:flex;align-items:center;justify-content:center;box-shadow:${shadow};
      animation:${anim} ${dispatched ? "0.8s" : "1.5s"} ease-in-out infinite;
      transform:rotate(${heading || 0}deg);font-size:17px;">🚑</div>`,
    [34, 34]
  );
}

function hospitalIcon(color) {
  return divIcon(
    `<div style="width:32px;height:32px;border-radius:6px;background:${color}22;border:2px solid ${color};
      display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px ${color}88;font-size:16px;">🏥</div>`,
    [32, 32]
  );
}

function patientIcon() {
  return divIcon(
    `<div style="width:22px;height:22px;border-radius:50%;background:rgba(255,170,0,0.2);
      border:2px solid #ffaa00;box-shadow:0 0 18px rgba(255,170,0,0.9);
      animation:patient-pulse 0.8s ease-in-out infinite;"></div>`,
    [22, 22]
  );
}

function ambulancePopup(amb) {
  return `<div style="font-family:Rajdhani,sans-serif;padding:8px;">
    <div style="color:#0088ff;font-weight:700;font-size:14px">${amb.id}</div>
    <div style="color:#00ff88;font-size:12px">${amb.type} Unit</div>
    <div style="color:#aaa;font-size:11px">${amb.crew.join(" · ")}</div>
  </div>`;
}

function hospitalPopup(h, color) {
  return `<div style="font-family:Rajdhani,sans-serif;padding:8px;min-width:160px;">
    <div style="color:${color};font-weight:700;font-size:13px">${h.name}</div>
    <div style="color:#aaa;font-size:11px;margin-top:4px">${h.level}</div>
    <div style="color:#e0eeff;font-size:12px;margin-top:4px">
      Beds: <span style="color:${color}">${h.available}</span> / ${h.capacity}
    </div>
    <div style="color:#aaa;font-size:11px">${h.specialties.join(", ")}</div>
  </div>`;
}

export default function MapView() {
  const mapContainer = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef({});
  const hospitalRefs = useRef({});
  const patientRef   = useRef(null);
  const routeLayersRef = useRef([]);
  const { state }    = useEmergency();
  const [mapReady, setMapReady] = useState(false);

  // 1 — Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = L.map(mapContainer.current, {
      center: [40.7128, -74.006],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(DARK_TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);

    L.control.attribution({ position: "bottomleft", prefix: false })
      .addAttribution(TILE_ATTRIBUTION)
      .addTo(map);

    L.control.zoom({ position: "topleft" }).addTo(map);

    mapRef.current = map;
    setMapReady(true);

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // 2 — Ambulance markers
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    state.ambulances.forEach((amb) => {
      const latlng = [amb.coordinates[1], amb.coordinates[0]];
      const icon   = ambulanceIcon(amb.status === "dispatched", amb.heading);
      if (!markersRef.current[amb.id]) {
        markersRef.current[amb.id] = L.marker(latlng, { icon, zIndexOffset: 500 })
          .addTo(map)
          .bindPopup(ambulancePopup(amb), { className: "eers-popup" });
      } else {
        markersRef.current[amb.id].setLatLng(latlng).setIcon(icon);
      }
    });
  }, [mapReady, state.ambulances]);

  // 3 — Hospital markers
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    state.hospitals.forEach((h) => {
      const color  = HOSPITAL_COLORS[h.status] || "#0088ff";
      const latlng = [h.coordinates[1], h.coordinates[0]];
      const icon   = hospitalIcon(color);
      if (!hospitalRefs.current[h.id]) {
        hospitalRefs.current[h.id] = L.marker(latlng, { icon })
          .addTo(map)
          .bindPopup(hospitalPopup(h, color), { className: "eers-popup" });
      } else {
        hospitalRefs.current[h.id].setIcon(icon)
          .setPopupContent(hospitalPopup(h, color));
      }
    });
  }, [mapReady, state.hospitals]);

  // 4 — Routes + patient marker
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;

    routeLayersRef.current.forEach((l) => map.removeLayer(l));
    routeLayersRef.current = [];

    if (patientRef.current) { map.removeLayer(patientRef.current); patientRef.current = null; }

    if (!state.activeEmergency) return;
    const { routes, patientCoords } = state.activeEmergency;
    if (!routes) return;

    const trafficColor = TRAFFIC_COLORS[state.trafficCondition] || "#0088ff";

    // Ambulance → Patient (dashed amber)
    if (routes.toPatient?.length > 1) {
      const coords = routes.toPatient.map(([lng, lat]) => [lat, lng]);
      const glow = L.polyline(coords, { color: "#ffaa00", weight: 10, opacity: 0.1, lineCap: "round" }).addTo(map);
      const line = L.polyline(coords, { color: "#ffaa00", weight: 4,  opacity: 0.9, dashArray: "10 6", lineCap: "round" }).addTo(map);
      routeLayersRef.current.push(glow, line);
    }

    // Patient → Hospital (solid, traffic-coloured)
    if (routes.toHospital?.length > 1) {
      const coords = routes.toHospital.map(([lng, lat]) => [lat, lng]);
      const glow = L.polyline(coords, { color: trafficColor, weight: 14, opacity: 0.1, lineCap: "round" }).addTo(map);
      const line = L.polyline(coords, { color: trafficColor, weight: 5,  opacity: 0.9, lineCap: "round" }).addTo(map);
      routeLayersRef.current.push(glow, line);
    }

    // Patient marker
    if (patientCoords) {
      patientRef.current = L.marker([patientCoords[1], patientCoords[0]], {
        icon: patientIcon(), zIndexOffset: 1000,
      }).addTo(map)
        .bindPopup(`<div style="font-family:Rajdhani,sans-serif;padding:6px;color:#ffaa00;font-weight:700">🔴 Patient Location</div>`,
          { className: "eers-popup" });

      map.flyTo([patientCoords[1], patientCoords[0]], 13, { duration: 2 });
    }
  }, [mapReady, state.activeEmergency]);

  // 5 — Re-colour hospital route on traffic change
  useEffect(() => {
    if (!mapReady || !state.activeEmergency) return;
    const color = TRAFFIC_COLORS[state.trafficCondition] || "#0088ff";
    const layers = routeLayersRef.current;
    if (layers[2]) layers[2].setStyle({ color });
    if (layers[3]) layers[3].setStyle({ color });
  }, [mapReady, state.trafficCondition]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Edge fades */}
      <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, rgba(3,7,18,0.55), transparent)" }} />
      <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
        style={{ background: "linear-gradient(to top, rgba(3,7,18,0.55), transparent)" }} />

      {/* Coord badge */}
      <div className="absolute bottom-4 right-4 glass-card px-3 py-1.5 rounded text-xs font-mono text-blue-400/60 pointer-events-none" style={{zIndex:999}}>
        40.7128°N 74.0060°W · NYC
      </div>

      {/* Traffic legend */}
      <div className="absolute top-4 right-4 glass-card px-3 py-2 rounded-lg text-xs" style={{zIndex:999}}>
        <div className="text-gray-500 font-display text-xs mb-1.5 tracking-wider">TRAFFIC</div>
        {["light","moderate","heavy","severe"].map((t) => (
          <div key={t} className="flex items-center gap-2 mb-0.5">
            <div className="w-3 h-1 rounded" style={{ background: TRAFFIC_COLORS[t] }} />
            <span className="text-gray-400 capitalize font-mono text-xs">{t}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
