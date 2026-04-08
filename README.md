# Edge-Orchestrated Emergency Response System

Realtime emergency dispatch simulation with a simplified frontend, Socket.IO live updates, city/location switching, road-based routing, and optional FastAPI ML assistance.

## Project Structure

```text
Edge-Orchestrated-Emergency-System/
├── backend/                     # Express + Socket.IO orchestrator
│   ├── server.js
│   ├── routes/api.js
│   ├── services/emergencyService.js
│   └── utils/
├── frontend/                    # React + Vite + Leaflet UI
│   ├── src/
│   └── index.html
└── model/                       # Optional FastAPI ML service
    ├── app.py
    ├── train_model.py
    ├── quick_train.py
    ├── traffic_model.pkl
    └── requirements.txt
```

## Prerequisites

- Node.js 18+
- npm 9+
- Python 3.10+ (only if using `model/` service)

## Run The App

1. Start backend:

```bash
cd backend
npm install
npm run dev
```

Backend URL: http://localhost:3001

2. Start frontend in a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend URL: http://localhost:5173

3. Optional: start FastAPI ML service in a third terminal:

```bash
cd model
pip install -r requirements.txt
python app.py
```

ML service URL: http://localhost:8000

## Core Features

- Realtime ambulance movement and ETA updates
- City switch API with dynamic map recentering
- Road-following route generation with fallback handling
- OSM hospital discovery for supported regions
- Simplified UI with emergency-first controls

## Main API Endpoints

- `GET /health` - backend health check
- `POST /api/emergency` - trigger emergency workflow
- `GET /api/state` - current system snapshot
- `GET /api/ambulances` - ambulance fleet
- `GET /api/hospitals` - hospitals currently loaded
- `POST /api/location` - recenter simulation to coordinates
- `POST /api/city` - switch simulation city

## Notes

- If port `3001` is already in use, stop the conflicting process before starting backend.
- `backend/node_modules` and `frontend/node_modules` are intentionally not kept in repo state and should be reinstalled with `npm install` when needed.
