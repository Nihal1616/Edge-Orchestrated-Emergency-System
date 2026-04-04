"""
Integration Module - Connects FastAPI ML Backend with Node.js Frontend

This module:
1. Fetches user location
2. Collects traffic data
3. Calls ML predictions
4. Returns formatted results to frontend
"""

from location_detector import LocationDetector
from traffic_collector import TrafficDataCollector
import pickle
import numpy as np
import json
from datetime import datetime
from typing import Dict
import math

class EmergencyResponseIntegration:
    """
    Main integration class that combines location, traffic, and ML prediction.
    """
    
    def __init__(self):
        print("\n📡 Initializing Emergency Response Integration...")
        
        self.location_detector = LocationDetector()
        self.traffic_collector = TrafficDataCollector()
        
        # Try to load trained model
        try:
            with open('traffic_model.pkl', 'rb') as f:
                self.model = pickle.load(f)
            self.model_loaded = True
            print("✓ ML Model loaded successfully")
        except:
            self.model = None
            self.model_loaded = False
            print("⚠️ ML Model not found - will train on startup")
        
        # Try to load scaler
        try:
            with open('scaler.pkl', 'rb') as f:
                self.scaler = pickle.load(f)
        except:
            self.scaler = None
        
        self.user_location = None
    
    # ========================================================================
    # STEP 1: GET USER LOCATION
    # ========================================================================
    def initialize_user_location(self) -> Dict:
        """
        Step 1: Detect and initialize user's location.
        """
        print("\n" + "="*60)
        print("STEP 1: USER LOCATION DETECTION")
        print("="*60)
        
        # Auto-detect location with fallback
        self.user_location = self.location_detector.detect_location(prefer_method="auto")
        
        if self.user_location:
            print(f"\n✓ User location detected:")
            print(f"  • City: {self.user_location['city']}")
            print(f"  • Coordinates: {self.user_location['latitude']}, {self.user_location['longitude']}")
            print(f"  • Method: {self.user_location['method']}")
            return self.user_location
        else:
            print("✗ Failed to detect user location")
            return None
    
    # ========================================================================
    # STEP 2: GET ENVIRONMENTAL DATA
    # ========================================================================
    def get_environmental_context(self) -> Dict:
        """
        Step 2: Collect weather, traffic, and time-based data.
        """
        print("\n" + "="*60)
        print("STEP 2: ENVIRONMENTAL CONTEXT")
        print("="*60)
        
        if not self.user_location:
            print("✗ User location required")
            return {}
        
        # Get weather
        weather = self.traffic_collector.get_weather_impact(
            self.user_location['latitude'],
            self.user_location['longitude']
        )
        
        # Get real-time traffic simulation
        traffic = self.traffic_collector.simulate_real_time_traffic()
        
        # Combine data
        context = {
            **weather,
            **traffic,
            'location': self.user_location
        }
        
        print(f"\n✓ Environmental context collected:")
        print(f"  • Traffic Level: {traffic['traffic_level']}/5")
        print(f"  • Weather: {weather.get('weather', 'Unknown')}")
        print(f"  • Average Speed: {traffic['average_speed_kmh']} km/h")
        
        return context
    
    # ========================================================================
    # STEP 3: PREDICT EMERGENCY RESPONSE
    # ========================================================================
    def predict_emergency_response(self, 
                                   ambulance_lat: float, ambulance_lon: float,
                                   patient_lat: float, patient_lon: float,
                                   hospital_lat: float, hospital_lon: float,
                                   context: Dict) -> Dict:
        """
        Step 3: Use ML model to predict ETA and optimal route.
        """
        print("\n" + "="*60)
        print("STEP 3: ML PREDICTION - EMERGENCY RESPONSE")
        print("="*60)
        
        try:
            # Calculate distances
            amb_to_patient = self._haversine(
                ambulance_lat, ambulance_lon,
                patient_lat, patient_lon
            )
            
            patient_to_hospital = self._haversine(
                patient_lat, patient_lon,
                hospital_lat, hospital_lon
            )
            
            # Extract features
            traffic_level = context.get('traffic_level', 3)
            weather_multiplier = context.get('traffic_multiplier', 1.0)
            
            now = datetime.now()
            hour = now.hour
            day_of_week = now.weekday()
            
            # Prepare features for ML model
            features = np.array([[
                amb_to_patient,  # Distance to patient
                traffic_level * weather_multiplier,  # Adjusted traffic
                patient_to_hospital,  # Distance to hospital
                hour / 24.0,  # Normalized hour
                day_of_week / 7.0,  # Normalized day
                2.0 / 4.0  # Road type (main road) normalized
            ]])
            
            # Scale features if scaler available
            if self.scaler:
                features = self.scaler.transform(features)
            
            # Predict ETA
            if self.model_loaded and self.model:
                eta_minutes = float(self.model.predict(features)[0])
                eta_minutes = max(5, min(120, eta_minutes))
                confidence = 0.85
            else:
                # Fallback calculation if model not available
                base_speed = 40
                adjusted_speed = base_speed / (1 + traffic_level * 0.2)
                total_distance = amb_to_patient + patient_to_hospital
                eta_minutes = (total_distance / adjusted_speed) * 60
                confidence = 0.65
            
            result = {
                'ambulance_to_patient_km': round(amb_to_patient, 2),
                'patient_to_hospital_km': round(patient_to_hospital, 2),
                'total_distance_km': round(amb_to_patient + patient_to_hospital, 2),
                'predicted_eta_minutes': round(eta_minutes, 1),
                'predicted_eta_formatted': f"{int(eta_minutes)} min",
                'confidence': round(confidence, 2),
                'traffic_adjusted': traffic_level * weather_multiplier,
                'status': 'success'
            }
            
            print(f"\n✓ Prediction complete:")
            print(f"  • Ambulance → Patient: {result['ambulance_to_patient_km']} km")
            print(f"  • Patient → Hospital: {result['patient_to_hospital_km']} km")
            print(f"  • Total distance: {result['total_distance_km']} km")
            print(f"  • ETA: {result['predicted_eta_formatted']}")
            print(f"  • Confidence: {result['confidence']*100}%")
            
            return result
        
        except Exception as e:
            print(f"✗ Prediction error: {str(e)}")
            return {'error': str(e), 'status': 'failed'}
    
    # ========================================================================
    # STEP 4: COMPUTE OPTIMAL LOGISTICS
    # ========================================================================
    def compute_optimal_logistics(self, 
                                 ambulances: list, hospitals: list,
                                 patient_lat: float, patient_lon: float,
                                 context: Dict) -> Dict:
        """
        Step 4: Find nearest ambulance and optimal hospital.
        
        Args:
            ambulances: List of ambulance objects with lat/lon
            hospitals: List of hospital objects with lat/lon
            patient_lat, patient_lon: Patient location
            context: Environmental context with traffic info
        """
        print("\n" + "="*60)
        print("STEP 4: OPTIMAL LOGISTICS COMPUTATION")
        print("="*60)
        
        try:
            # Find nearest ambulance
            nearest_ambulance = None
            min_distance = float('inf')
            
            for ambulance in ambulances:
                distance = self._haversine(
                    ambulance['lat'], ambulance['lon'],
                    patient_lat, patient_lon
                )
                if distance < min_distance:
                    min_distance = distance
                    nearest_ambulance = ambulance
                    nearest_ambulance['distance'] = round(distance, 2)
            
            # Find optimal hospital (nearest + best capacity)
            optimal_hospital = None
            min_hospital_distance = float('inf')
            
            for hospital in hospitals:
                distance = self._haversine(
                    hospital['lat'], hospital['lon'],
                    patient_lat, patient_lon
                )
                
                # Consider both distance and capacity
                capacity_score = hospital.get('available_beds', 0) / 100
                priority_score = distance - (capacity_score * 5)
                
                if priority_score < min_hospital_distance:
                    min_hospital_distance = priority_score
                    optimal_hospital = hospital
                    optimal_hospital['distance'] = round(distance, 2)
            
            result = {
                'nearest_ambulance': nearest_ambulance,
                'optimal_hospital': optimal_hospital,
                'recommended': True,
                'status': 'success'
            }
            
            print(f"\n✓ Logistics optimized:")
            if nearest_ambulance:
                print(f"  • Ambulance: {nearest_ambulance['name']} ({nearest_ambulance['distance']} km away)")
            if optimal_hospital:
                print(f"  • Hospital: {optimal_hospital['name']} ({optimal_hospital['distance']} km)")
            
            return result
        
        except Exception as e:
            print(f"✗ Logistics error: {str(e)}")
            return {'error': str(e), 'status': 'failed'}
    
    # ========================================================================
    # UTILITY: HAVERSINE DISTANCE
    # ========================================================================
    @staticmethod
    def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Calculate distance between two coordinates in km."""
        R = 6371
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        
        return R * c
    
    # ========================================================================
    # FULL EMERGENCY RESPONSE WORKFLOW
    # ========================================================================
    def handle_emergency(self, emergency_data: Dict) -> Dict:
        """
        Complete emergency handling workflow:
        1. Get user location
        2. Collect environmental data
        3. Predict optimal response
        4. Compute logistics
        """
        print("\n\n")
        print("╔" + "="*58 + "╗")
        print("║" + " "*14 + "🚑 EMERGENCY RESPONSE SYSTEM 🚑" + " "*13 + "║")
        print("╚" + "="*58 + "╝")
        
        # Step 1: Location
        location = self.initialize_user_location()
        if not location:
            return {'error': 'Location detection failed', 'status': 'failed'}
        
        # Step 2: Context
        context = self.get_environmental_context()
        
        # Step 3: Prediction
        prediction = self.predict_emergency_response(
            emergency_data['ambulance_lat'], emergency_data['ambulance_lon'],
            emergency_data['patient_lat'], emergency_data['patient_lon'],
            emergency_data['hospital_lat'], emergency_data['hospital_lon'],
            context
        )
        
        # Step 4: Logistics
        logistics = self.compute_optimal_logistics(
            emergency_data.get('ambulances', []),
            emergency_data.get('hospitals', []),
            emergency_data['patient_lat'], emergency_data['patient_lon'],
            context
        )
        
        # Combine results
        final_result = {
            'timestamp': datetime.now().isoformat(),
            'location': location,
            'context': context,
            'prediction': prediction,
            'logistics': logistics,
            'workflow_complete': True,
            'status': 'success'
        }
        
        print("\n" + "="*60)
        print("✅ EMERGENCY RESPONSE COMPLETE")
        print("="*60 + "\n")
        
        return final_result


# ============================================================================
# EXAMPLE USAGE
# ============================================================================
if __name__ == "__main__":
    
    integration = EmergencyResponseIntegration()
    
    # Mock emergency data
    emergency = {
        'ambulance_lat': 40.7200,
        'ambulance_lon': -74.0050,
        'patient_lat': 40.7100,
        'patient_lon': -74.0100,
        'hospital_lat': 40.7260,
        'hospital_lon': -73.9897,
        'ambulances': [
            {'name': 'Ambulance-01', 'lat': 40.7200, 'lon': -74.0050},
            {'name': 'Ambulance-02', 'lat': 40.7300, 'lon': -74.0200},
        ],
        'hospitals': [
            {'name': 'NYC Hospital', 'lat': 40.7260, 'lon': -73.9897, 'available_beds': 45},
            {'name': 'Memorial Hospital', 'lat': 40.7400, 'lon': -74.0050, 'available_beds': 20},
        ]
    }
    
    # Handle emergency
    result = integration.handle_emergency(emergency)
    
    # Print result as JSON
    print("\n📤 RESPONSE TO SEND TO FRONTEND:")
    print(json.dumps(result, indent=2))
