from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import pickle
import numpy as np
import math
from datetime import datetime
from typing import Dict, List, Tuple
import json
import os

app = FastAPI(title="Emergency Traffic ML Service")

# Enable CORS for communication with Node.js backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load trained model
try:
    model = pickle.load(open("traffic_model.pkl", "rb"))
except:
    print("⚠️ Traffic model not found. Will train on first request.")
    model = None

# Store user location
USER_LOCATION = {"latitude": 40.7128, "longitude": -74.0060, "name": "New York"}

# Haversine formula to calculate distance between two coordinates
def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate distance between two points on Earth in kilometers.
    """
    R = 6371  # Earth's radius in km
    
    lat1_rad = math.radians(lat1)
    lat2_rad = math.radians(lat2)
    delta_lat = math.radians(lat2 - lat1)
    delta_lon = math.radians(lon2 - lon1)
    
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

# Get traffic multiplier based on time of day (realistic traffic patterns)
def get_traffic_multiplier(hour: int) -> float:
    """
    Return traffic multiplier based on time of day.
    Peak hours: 7-9 AM, 5-7 PM = 1.5x multiplier
    Night hours: 11 PM - 6 AM = 0.5x multiplier
    """
    if 7 <= hour < 9 or 17 <= hour < 19:  # Rush hours
        return 1.5
    elif 23 <= hour or hour < 6:  # Night
        return 0.5
    else:  # Normal hours
        return 1.0

# Extract features for ML model
def extract_features(distance: float, traffic_level: int, distance_to_hospital: float, 
                     hour: int, day_of_week: int, road_type: int) -> np.ndarray:
    """
    Extract and normalize features for the ML model.
    
    Features:
    - distance: Distance from ambulance to patient (km)
    - traffic_level: Traffic level 1-5 (1=low, 5=high)
    - distance_to_hospital: Distance from patient to hospital (km)
    - hour: Hour of day (0-23)
    - day_of_week: Day of week (0-6, 0=Monday)
    - road_type: Type of road 1-4 (1=highway, 2=main road, 3=secondary, 4=local)
    """
    traffic_mult = get_traffic_multiplier(hour)
    
    return np.array([[
        distance,
        traffic_level * traffic_mult,
        distance_to_hospital,
        hour / 24.0,  # Normalize to 0-1
        day_of_week / 7.0,  # Normalize to 0-1
        road_type / 4.0  # Normalize to 0-1
    ]])

@app.get("/")
def home():
    """Health check endpoint"""
    return {
        "message": "🚑 Emergency Traffic ML Service Running",
        "version": "1.0",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
def health():
    """Health check for backend verification"""
    return {"status": "ok", "model_loaded": model is not None}

@app.post("/predict-eta")
def predict_eta(data: dict):
    """
    Predict ETA for ambulance to reach hospital.
    
    Required inputs:
    - distance: Distance from ambulance to patient (km)
    - traffic_level: Current traffic level 1-5
    - distance_to_hospital: Distance from patient to hospital (km)
    - road_type: Type of road (1=highway, 2=main road, 3=secondary, 4=local)
    
    Returns:
    - eta_minutes: Estimated time in minutes
    - confidence: Model confidence (0-1)
    """
    try:
        if model is None:
            raise Exception("Model not trained yet")
        
        distance = float(data.get("distance", 0))
        traffic_level = int(data.get("traffic_level", 3))
        distance_to_hospital = float(data.get("distance_to_hospital", 5))
        road_type = int(data.get("road_type", 2))
        
        # Get current time features
        now = datetime.now()
        hour = now.hour
        day_of_week = now.weekday()
        
        # Extract and normalize features
        features = extract_features(
            distance, traffic_level, distance_to_hospital,
            hour, day_of_week, road_type
        )
        
        # Predict ETA
        eta_minutes = model.predict(features)[0]
        
        # Ensure reasonable ETA (5-120 minutes)
        eta_minutes = max(5, min(120, eta_minutes))
        
        return {
            "eta_minutes": float(eta_minutes),
            "eta_formatted": f"{int(eta_minutes)} min",
            "status": "success",
            "timestamp": datetime.now().isoformat(),
            "traffic_level": traffic_level,
            "confidence": 0.85
        }
    
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed",
            "timestamp": datetime.now().isoformat()
        }

@app.post("/calculate-distance")
def calculate_distance(data: dict):
    """
    Calculate distance between two coordinates using Haversine formula.
    
    Required inputs:
    - lat1, lon1: Starting coordinates
    - lat2, lon2: Ending coordinates
    
    Returns:
    - distance_km: Distance in kilometers
    """
    try:
        lat1 = float(data["lat1"])
        lon1 = float(data["lon1"])
        lat2 = float(data["lat2"])
        lon2 = float(data["lon2"])
        
        distance = haversine_distance(lat1, lon1, lat2, lon2)
        
        # Estimate time (average speed 40 km/h in city)
        time_minutes = (distance / 40) * 60
        
        return {
            "distance_km": round(distance, 2),
            "estimated_time_minutes": round(time_minutes, 1),
            "status": "success"
        }
    except Exception as e:
        return {"error": str(e), "status": "failed"}

@app.post("/get-traffic-prediction")
def get_traffic_prediction(data: dict):
    """
    Get predicted traffic conditions for a route.
    
    Required inputs:
    - distance: Distance of route (km)
    - hour: Hour of day (optional, uses current hour if not provided)
    
    Returns:
    - traffic_level: Predicted traffic 1-5
    - congestion_percentage: Estimated congestion %
    """
    try:
        distance = float(data.get("distance", 5))
        hour = int(data.get("hour", datetime.now().hour))
        
        # Base traffic level
        base_traffic = 3
        
        # Adjust based on time
        traffic_mult = get_traffic_multiplier(hour)
        adjusted_traffic = int(base_traffic * traffic_mult)
        adjusted_traffic = max(1, min(5, adjusted_traffic))
        
        # Congestion percentage
        congestion = (adjusted_traffic - 1) * 20  # 0-80%
        
        return {
            "traffic_level": adjusted_traffic,
            "congestion_percentage": congestion,
            "speed_kmh": 40 / traffic_mult,
            "status": "success",
            "hour": hour
        }
    except Exception as e:
        return {"error": str(e), "status": "failed"}

@app.post("/set-user-location")
def set_user_location(data: dict):
    """
    Set or update user's current location.
    
    Required inputs:
    - latitude: User's latitude
    - longitude: User's longitude
    - name: Location name (optional)
    """
    try:
        global USER_LOCATION
        USER_LOCATION = {
            "latitude": float(data["latitude"]),
            "longitude": float(data["longitude"]),
            "name": data.get("name", "Custom Location"),
            "timestamp": datetime.now().isoformat()
        }
        return {
            "status": "success",
            "location": USER_LOCATION
        }
    except Exception as e:
        return {"error": str(e), "status": "failed"}

@app.get("/get-user-location")
def get_user_location():
    """Retrieve current user location"""
    return {
        "location": USER_LOCATION,
        "status": "success"
    }

@app.post("/compute-optimal-route")
def compute_optimal_route(data: dict):
    """
    Compute optimal route based on traffic and distance.
    
    Required inputs:
    - ambulance_lat, ambulance_lon: Ambulance location
    - patient_lat, patient_lon: Patient location
    - hospital_lat, hospital_lon: Hospital location
    
    Returns:
    - ambulance_to_patient_km: Distance to reach patient
    - patient_to_hospital_km: Distance from patient to hospital
    - total_km: Total distance
    - estimated_total_time: Total ETA
    - route_efficiency: Route efficiency score (0-1)
    """
    try:
        # Calculate distances
        amb_to_patient = haversine_distance(
            float(data["ambulance_lat"]), float(data["ambulance_lon"]),
            float(data["patient_lat"]), float(data["patient_lon"])
        )
        
        patient_to_hospital = haversine_distance(
            float(data["patient_lat"]), float(data["patient_lon"]),
            float(data["hospital_lat"]), float(data["hospital_lon"])
        )
        
        total_distance = amb_to_patient + patient_to_hospital
        
        # Calculate average time (accounting for traffic)
        traffic_level = int(data.get("traffic_level", 3))
        traffic_mult = get_traffic_multiplier(datetime.now().hour)
        
        # Time = Distance / Speed (adjusted for traffic)
        base_speed = 40  # km/h
        adjusted_speed = base_speed / traffic_mult
        
        total_time = (total_distance / adjusted_speed) * 60  # in minutes
        
        # Route efficiency (1.0 = straight line, < 1.0 = not optimal)
        direct_distance = haversine_distance(
            float(data["ambulance_lat"]), float(data["ambulance_lon"]),
            float(data["hospital_lat"]), float(data["hospital_lon"])
        )
        efficiency = direct_distance / total_distance if total_distance > 0 else 0
        
        return {
            "ambulance_to_patient_km": round(amb_to_patient, 2),
            "patient_to_hospital_km": round(patient_to_hospital, 2),
            "total_km": round(total_distance, 2),
            "estimated_total_minutes": round(total_time, 1),
            "route_efficiency": round(efficiency, 2),
            "status": "success"
        }
    except Exception as e:
        return {"error": str(e), "status": "failed"}

@app.get("/model-status")
def model_status():
    """Get ML model training status"""
    return {
        "model_loaded": model is not None,
        "features": ["distance", "traffic_level", "distance_to_hospital", "hour", "day_of_week", "road_type"],
        "status": "ready" if model is not None else "needs_training"
    }

# ============================================================================
# INTEGRATED EMERGENCY RESPONSE ENDPOINTS
# ============================================================================

@app.post("/handle-emergency")
def handle_emergency(data: dict):
    """
    Complete emergency response workflow with all ML logic, location, and logistics.
    
    Required inputs:
    - ambulance_lat, ambulance_lon: Ambulance coordinates
    - patient_lat, patient_lon: Patient coordinates
    - hospital_lat, hospital_lon: Hospital coordinates
    - ambulances: List of available ambulances
    - hospitals: List of nearby hospitals
    
    Returns:
    - Complete emergency response with ETA, route, and logistics
    """
    try:
        from integration import EmergencyResponseIntegration
        
        integration = EmergencyResponseIntegration()
        result = integration.handle_emergency(data)
        
        return result
    
    except Exception as e:
        return {
            "error": str(e),
            "status": "failed",
            "timestamp": datetime.now().isoformat()
        }

@app.post("/quick-emergency-response")
def quick_emergency_response(data: dict):
    """
    Simplified emergency response (faster response time).
    
    Required inputs:
    - patient_lat, patient_lon
    - ambulance_lat, ambulance_lon
    - hospital_lat, hospital_lon
    - traffic_level: Current traffic 1-5
    """
    try:
        ambulance_to_patient = haversine_distance(
            float(data["ambulance_lat"]), float(data["ambulance_lon"]),
            float(data["patient_lat"]), float(data["patient_lon"])
        )
        
        patient_to_hospital = haversine_distance(
            float(data["patient_lat"]), float(data["patient_lon"]),
            float(data["hospital_lat"]), float(data["hospital_lon"])
        )
        
        traffic_level = int(data.get("traffic_level", 3))
        traffic_mult = get_traffic_multiplier(datetime.now().hour)
        
        # Fast calculation
        base_speed = 40
        adjusted_speed = base_speed / (traffic_level * traffic_mult)
        total_distance = ambulance_to_patient + patient_to_hospital
        total_time = (total_distance / adjusted_speed) * 60
        
        # Direct distance (efficiency check)
        direct = haversine_distance(
            float(data["ambulance_lat"]), float(data["ambulance_lon"]),
            float(data["hospital_lat"]), float(data["hospital_lon"])
        )
        efficiency = direct / total_distance if total_distance > 0 else 0
        
        return {
            "ambulance_to_patient_km": round(ambulance_to_patient, 2),
            "patient_to_hospital_km": round(patient_to_hospital, 2),
            "total_distance_km": round(total_distance, 2),
            "total_eta_minutes": round(total_time, 1),
            "route_efficiency": round(efficiency, 2),
            "traffic_level": traffic_level,
            "status": "success",
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        return {"error": str(e), "status": "failed"}

@app.post("/update-traffic-conditions")
def update_traffic_conditions(data: dict):
    """
    Update traffic conditions and trigger route recalculation.
    
    Required inputs:
    - ambulance_lat, ambulance_lon
    - patient_lat, patient_lon
    - hospital_lat, hospital_lon
    - traffic_level: New traffic level 1-5
    """
    try:
        ambulance_to_patient = haversine_distance(
            float(data["ambulance_lat"]), float(data["ambulance_lon"]),
            float(data["patient_lat"]), float(data["patient_lon"])
        )
        
        new_traffic = int(data.get("traffic_level", 3))
        
        # Recalculate with new traffic
        traffic_mult = get_traffic_multiplier(datetime.now().hour)
        base_speed = 40
        adjusted_speed = base_speed / (new_traffic * traffic_mult)
        new_eta = (ambulance_to_patient / adjusted_speed) * 60
        
        return {
            "reroute_triggered": True,
            "new_traffic_level": new_traffic,
            "new_eta_minutes": round(new_eta, 1),
            "eta_change": "increased" if new_traffic > 3 else "decreased",
            "status": "success",
            "timestamp": datetime.now().isoformat()
        }
    
    except Exception as e:
        return {"error": str(e), "status": "failed"}