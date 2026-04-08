# 🚨 EERS Demo Guide — Win a Hackathon in 2 Minutes

## What This Is
**Edge-Orchestrated Emergency Response System** — an AI-powered command center that dispatches ambulances, predicts ETAs with ML, explains every decision in real-time, and handles mass-casualty events.

---

## ⚡ 2-Minute Demo Script

### 0:00 — Hook (15 sec)
> *"Every second in an emergency costs lives. Current dispatch systems take 3–5 minutes and can't explain their decisions. EERS does it in seconds — and shows you exactly why."*

Open the dashboard. Point out the **dark glassmorphic command center** — ambulances moving on the live map.

---

### 0:15 — Live Map (20 sec)
- Show ambulances drifting on the real street map
- Point to color-coded hospitals: 🟢 Available · 🟡 Limited · 🔴 Critical
- Show the traffic badge in the header updating live

---

### 0:35 — Trigger Emergency (25 sec)
Click **🚨 EMERGENCY** button.

Watch in real time:
1. Nearest ambulance instantly dispatched (blue pulse ring)
2. Route drawn on map — ambulance to patient → patient to hospital
3. **AI Decision Panel** slides in on the right →
   - Confidence score
   - *"Why this ambulance?"* — distance + type
   - *"Why this hospital?"* — capacity score + trauma level
   - Expand **"Why not others?"** section

> *"The system doesn't just act — it explains its reasoning like a senior paramedic would."*

---

### 1:00 — Patient Tracker + ETA (15 sec)
Left panel shows **📱 Patient Tracker**:
- Live countdown timer (MM:SS)
- Phase stepper: Assigned → En Route → To Hospital → Arrived
- Traffic badge updates dynamically

---

### 1:15 — Disaster Mode (20 sec)
Click **⚡ DISASTER** button.

- Flash overlay + alarm
- 3 emergencies spawn simultaneously
- Smart allocation: system distributes across available ambulances
- Dashboard shows **Active: 3** with occupancy graphs

> *"This is the mass-casualty scenario — EERS allocates intelligently even under load."*

---

### 1:35 — Simulation Panel (15 sec)
Show the **Simulation Control**:
- Drag traffic slider to "Severe" → watch routes reroute, ETAs update
- Toggle ML engine off → system falls back gracefully
- Show **Live Dashboard** bar charts updating

---

### 1:50 — Post-Emergency Report (10 sec)
After an emergency resolves, open **🧾 Reports**:
- Response time, distance, traffic delay, outcome
- All logged automatically

> *"Everything is auditable. Perfect for operations review."*

---

## 🏆 Key Talking Points

| Feature | Why it Wins |
|---------|-------------|
| AI Explanation Panel | Judges love explainability — "black box" AI doesn't win |
| Real road routing (OSRM) | Not fake straight lines — actual drivable paths |
| ML ETA with fallback | Shows production thinking — graceful degradation |
| Disaster Mode | Real-world scenario that most teams skip |
| Live charts (Recharts) | Visual proof of system intelligence |
| Dark glassmorphic UI | Premium feel — looks deployed, not hackathon |

---

## 🛠 Quick Start

```bash
# Terminal 1 — Backend
cd backend && npm install && npm run dev

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev

# Optional: Terminal 3 — ML Model
cd model && pip install -r requirements.txt && python app.py
```

Frontend: http://localhost:5173  
Backend: http://localhost:3001  
ML API: http://localhost:8000  

---

## Architecture in One Line
> React + Leaflet map → Socket.IO real-time bridge → Node.js orchestrator → OSRM road routing + FastAPI ML → Live AI decisions
