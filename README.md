# 🚑 Edge-Orchestrated Emergency Response System (EERS)

A production-level, real-time emergency dispatch simulation with live maps, WebSocket updates, and a dark cyber-style UI.

**Maps**: Leaflet + OpenStreetMap (CartoDB Dark Matter tiles) — **no API key required.**

---

## 🗂 Project Structure

```
edge-emergency/
├── backend/               # Node.js + Express + Socket.IO
│   ├── server.js
│   ├── routes/api.js
│   ├── services/emergencyService.js
│   └── utils/
│       ├── mockData.js
│       └── routeUtils.js
│
└── frontend/              # React + Vite + Tailwind + Leaflet
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── index.css
        ├── context/EmergencyContext.jsx
        ├── hooks/useSocket.js
        ├── utils/sounds.js
        └── components/
            ├── Map/MapView.jsx        ← Leaflet + OSM
            └── Panels/
                ├── LeftPanel.jsx
                ├── RightPanel.jsx
                └── BottomPanel.jsx
```

---

## ⚙️ Prerequisites

- Node.js v18+
- npm v9+
- No map API key needed — uses free OpenStreetMap tiles

---

## 🚀 Step 1 — Start the Backend

```bash
cd backend
npm install
npm run dev
```

Backend runs on **http://localhost:3001**

---

## 🖥 Step 2 — Start the Frontend

In a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on **http://localhost:5173**

---

## 🎮 Usage

1. Open **http://localhost:5173**
2. Watch ambulances drift on the live dark map
3. Click **⚡ TRIGGER EMERGENCY** in the left panel
4. The system will:
   - Play a siren alert sound
   - Locate a simulated patient
   - Dispatch the nearest ambulance
   - Calculate the optimal hospital
   - Draw live routes on the map
   - Show real-time ETA countdown
   - Log all events in the bottom panel
5. Traffic changes every ~12 seconds → triggers automatic rerouting

---

## 🌐 API Endpoints

| Method | Endpoint        | Description                        |
|--------|-----------------|------------------------------------|
| POST   | /api/emergency  | Trigger a new emergency            |
| GET    | /api/hospitals  | List all hospitals + availability  |
| GET    | /api/ambulances | List all ambulance units           |
| GET    | /api/state      | Full system state snapshot         |
| GET    | /health         | Health check                       |

## 🔌 WebSocket Events

| Event             | Direction       | Description                      |
|-------------------|-----------------|----------------------------------|
| initialState      | Server → Client | Full state on connect            |
| ambulanceMove     | Server → Client | Ambulance position update        |
| etaUpdate         | Server → Client | ETA + progress update            |
| routeUpdate       | Server → Client | Reroute notification             |
| trafficUpdate     | Server → Client | Traffic condition change         |
| systemLog         | Server → Client | Log entry                        |
| emergencyComplete | Server → Client | Mission finished                 |

---

## 🎨 Tech Stack

- **Frontend**: React 18, Vite, Tailwind CSS, Framer Motion, **Leaflet + OpenStreetMap**
- **Backend**: Node.js, Express, Socket.IO
- **State**: React Context API + useReducer
- **Realtime**: WebSockets via Socket.IO
- **Map tiles**: CartoDB Dark Matter (free, no key)
