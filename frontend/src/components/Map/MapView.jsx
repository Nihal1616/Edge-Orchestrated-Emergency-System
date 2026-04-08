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
  light: "#00ff88",
  moderate: "#ffaa00",
  heavy: "#ff6600",
  severe: "#ff2020",
};

const HOSPITAL_COLORS = {
  available: "#00cc6a",
  limited: "#ffaa00",
  critical: "#ff2020",
};

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function divIcon(html, size = [36, 36]) {
  return L.divIcon({
    html,
    className: "",
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1] / 2],
    popupAnchor: [0, -(size[1] / 2 + 4)],
  });
}

function ambulanceIcon(dispatched, heading, isAssigned = false) {
  const border = isAssigned ? "#60a5fa" : dispatched ? "#dc2626" : "#2563eb";
  const bg = isAssigned
    ? "rgba(96,165,250,0.15)"
    : dispatched
      ? "#fee2e2"
      : "#dbeafe";
  const ring = isAssigned
    ? "0 0 0 6px rgba(96,165,250,0.25),0 0 0 2px rgba(96,165,250,0.35)"
    : "0 2px 8px rgba(0,0,0,0.2)";
  return divIcon(
    `<div style="width:42px;height:42px;border-radius:50%;background:${bg};border:2px solid ${border};
      display:flex;align-items:center;justify-content:center;
      box-shadow:${ring};
      transform:rotate(${heading || 0}deg);font-size:18px;">🚑</div>`,
    [42, 42],
  );
}

function hospitalIcon(color) {
  return divIcon(
    `<div style="width:32px;height:32px;border-radius:8px;background:#ffffff;border:2px solid ${color};
      display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);font-size:16px;">🏥</div>`,
    [32, 32],
  );
}

function patientIcon() {
  return divIcon(
    `<div style="width:22px;height:22px;border-radius:50%;background:#fef3c7;
      border:2px solid #d97706;box-shadow:0 2px 8px rgba(0,0,0,0.2);"></div>`,
    [22, 22],
  );
}

function ambulancePopup(amb) {
  return `<div style="font-family:Inter,system-ui,sans-serif;padding:8px;min-width:150px;">
    <div style="color:#1e293b;font-weight:700;font-size:13px">Ambulance ${amb.id}</div>
    <div style="color:#334155;font-size:12px">${amb.type} Unit</div>
  </div>`;
}

function hospitalPopup(h, color) {
  return `<div style="font-family:Inter,system-ui,sans-serif;padding:8px;min-width:160px;">
    <div style="color:${color};font-weight:700;font-size:13px">${h.name}</div>
    <div style="color:#64748b;font-size:11px;margin-top:4px">${h.level}</div>
    <div style="color:#334155;font-size:12px;margin-top:4px">
      Beds: <span style="color:${color}">${h.available}</span> / ${h.capacity}
    </div>
    <div style="color:#64748b;font-size:11px">${h.specialties.join(", ")}</div>
  </div>`;
}

export default function MapView() {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});
  const hospitalRefs = useRef({});
  const patientRef = useRef(null);
  const routeLayersRef = useRef([]);
  const { state } = useEmergency();
  const [mapReady, setMapReady] = useState(false);
  const center = state.mapCenter || { lat: 40.7128, lng: -74.006 };

  // 1 — Init map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = L.map(mapContainer.current, {
      center: [center.lat, center.lng],
      zoom: 12,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer(TILE_URL, {
      attribution: TILE_ATTRIBUTION,
      maxZoom: 19,
    }).addTo(map);

    L.control
      .attribution({ position: "bottomleft", prefix: false })
      .addAttribution(TILE_ATTRIBUTION)
      .addTo(map);

    L.control.zoom({ position: "topleft" }).addTo(map);

    mapRef.current = map;
    setMapReady(true);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Keep map aligned when backend center changes (for user location updates).
  useEffect(() => {
    if (!mapReady || state.activeEmergency) return;
    mapRef.current.flyTo([center.lat, center.lng], mapRef.current.getZoom(), {
      duration: 1.1,
    });
  }, [mapReady, center.lat, center.lng, state.activeEmergency]);

  // 2 — Ambulance markers
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    state.ambulances.forEach((amb) => {
      const latlng = [amb.coordinates[1], amb.coordinates[0]];
      const isAssigned = state.activeEmergency?.ambulanceId === amb.id;
      const icon = ambulanceIcon(
        amb.status === "dispatched",
        amb.heading,
        isAssigned,
      );
      if (!markersRef.current[amb.id]) {
        markersRef.current[amb.id] = L.marker(latlng, {
          icon,
          zIndexOffset: isAssigned ? 1700 : 500,
        })
          .addTo(map)
          .bindPopup(ambulancePopup(amb), { className: "eers-popup" });
      } else {
        markersRef.current[amb.id]
          .setLatLng(latlng)
          .setIcon(icon)
          .setZIndexOffset(isAssigned ? 1700 : 500);
      }

      if (isAssigned && markersRef.current[amb.id]) {
        markersRef.current[amb.id].openPopup();
      }
    });
  }, [mapReady, state.ambulances, state.activeEmergency]);

  // 3 — Hospital markers
  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    state.hospitals.forEach((h) => {
      const color = HOSPITAL_COLORS[h.status] || "#0088ff";
      const latlng = [h.coordinates[1], h.coordinates[0]];
      const icon = hospitalIcon(color);
      if (!hospitalRefs.current[h.id]) {
        hospitalRefs.current[h.id] = L.marker(latlng, { icon })
          .addTo(map)
          .bindPopup(hospitalPopup(h, color), { className: "eers-popup" });
      } else {
        hospitalRefs.current[h.id]
          .setIcon(icon)
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

    if (patientRef.current) {
      map.removeLayer(patientRef.current);
      patientRef.current = null;
    }

    if (!state.activeEmergency) return;
    const { routes, patientCoords, ambulanceId } = state.activeEmergency;
    if (!routes) return;

    const trafficColor = TRAFFIC_COLORS[state.trafficCondition] || "#0088ff";

    // Ambulance → Patient (dashed amber)
    if (routes.toPatient?.length > 1) {
      const coords = routes.toPatient.map(([lng, lat]) => [lat, lng]);
      const glow = L.polyline(coords, {
        color: "#ffaa00",
        weight: 10,
        opacity: 0.1,
        lineCap: "round",
      }).addTo(map);
      const line = L.polyline(coords, {
        color: "#ffaa00",
        weight: 4,
        opacity: 0.9,
        dashArray: "10 6",
        lineCap: "round",
      }).addTo(map);
      routeLayersRef.current.push(glow, line);
    }

    // Patient → Hospital (solid, traffic-coloured)
    if (routes.toHospital?.length > 1) {
      const coords = routes.toHospital.map(([lng, lat]) => [lat, lng]);
      const glow = L.polyline(coords, {
        color: trafficColor,
        weight: 14,
        opacity: 0.14,
        lineCap: "round",
      }).addTo(map);
      const line = L.polyline(coords, {
        color: trafficColor,
        weight: 6,
        opacity: 1,
        lineCap: "round",
      }).addTo(map);
      routeLayersRef.current.push(glow, line);
    }

    // Full route highlight (lane effect)
    if (routes.full?.length > 1) {
      const fullCoords = routes.full.map(([lng, lat]) => [lat, lng]);
      const lane = L.polyline(fullCoords, {
        color: trafficColor,
        weight: 2,
        opacity: 0.35,
        dashArray: "8 10",
        lineCap: "round",
      }).addTo(map);
      routeLayersRef.current.push(lane);
    }

    // Patient marker
    if (patientCoords) {
      patientRef.current = L.marker([patientCoords[1], patientCoords[0]], {
        icon: patientIcon(),
        zIndexOffset: 1000,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:Rajdhani,sans-serif;padding:6px;color:#ffaa00;font-weight:700">🔴 Patient Location</div>`,
          { className: "eers-popup" },
        );
    }

    // Keep ambulance and full path visible to avoid confusion where assigned ambulance is.
    if (routes.full?.length > 1) {
      const fullCoords = routes.full.map(([lng, lat]) => [lat, lng]);
      const bounds = L.latLngBounds(fullCoords);
      map.fitBounds(bounds, {
        padding: [40, 40],
        maxZoom: 14,
        animate: true,
        duration: 1.0,
      });
    } else if (patientCoords) {
      map.flyTo([patientCoords[1], patientCoords[0]], 13, { duration: 1.2 });
    }

    // Visually prioritize assigned ambulance marker.
    if (ambulanceId && markersRef.current[ambulanceId]) {
      markersRef.current[ambulanceId].setZIndexOffset(1500);
      markersRef.current[ambulanceId].openPopup();
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

  const currentEmergency = state.activeEmergency;
  const assignedAmbulance = currentEmergency?.ambulance?.id || "--";
  const assignedHospital = currentEmergency?.hospital?.name || "--";
  const assignedDistance = currentEmergency?.totalDistance
    ? `${Number(currentEmergency.totalDistance).toFixed(2)} km`
    : "--";
  const assignedEta = state.eta ? `${state.eta} min` : "--";

  return (
    <div className="relative w-full h-full bg-slate-100">
      <div ref={mapContainer} className="w-full h-full" />

      {currentEmergency && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: 16,
            zIndex: 999,
            minWidth: 220,
            background: "rgba(15,23,42,0.92)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 16,
            padding: "12px 14px",
            boxShadow: "0 20px 45px rgba(0,0,0,0.35)",
            color: "#e2e8f0",
            fontFamily: "Inter,system-ui,sans-serif",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div
              style={{
                fontSize: 12,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(226,232,240,0.6)",
              }}
            >
              Assigned Route
            </div>
            <div style={{ fontSize: 12, color: "#60a5fa", fontWeight: 700 }}>
              LIVE
            </div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            Ambulance {assignedAmbulance}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "rgba(226,232,240,0.8)",
              marginBottom: 10,
            }}
          >
            → {assignedHospital}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 6,
              fontSize: 11,
            }}
          >
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                padding: "8px 10px",
              }}
            >
              <div style={{ color: "rgba(226,232,240,0.5)", marginBottom: 2 }}>
                Distance
              </div>
              <div style={{ color: "#c7d2fe", fontWeight: 700 }}>
                {assignedDistance}
              </div>
            </div>
            <div
              style={{
                background: "rgba(255,255,255,0.04)",
                borderRadius: 10,
                padding: "8px 10px",
              }}
            >
              <div style={{ color: "rgba(226,232,240,0.5)", marginBottom: 2 }}>
                ETA
              </div>
              <div style={{ color: "#a5b4fc", fontWeight: 700 }}>
                {assignedEta}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Coord badge */}
      <div
        className="absolute bottom-4 right-4 px-3 py-1.5 rounded-md text-xs bg-white/90 border border-slate-200 text-slate-600 pointer-events-none"
        style={{ zIndex: 999 }}
      >
        {`${Math.abs(center.lat).toFixed(4)}°${center.lat >= 0 ? "N" : "S"} ${Math.abs(center.lng).toFixed(4)}°${center.lng >= 0 ? "E" : "W"}`}
      </div>
    </div>
  );
}
