"""
User Location Detection Module

This module detects user's actual location using various methods:
1. IP-based geolocation
2. Browser/Device geolocation
3. Manual location input
"""

import requests
import json
from typing import Dict, Tuple, Optional
from datetime import datetime

class LocationDetector:
    """
    Detects user location with multiple fallback methods.
    """
    
    def __init__(self):
        self.location_cache = None
        self.last_update = None
    
    # ========================================================================
    # METHOD 1: IP GEOLOCATION (No user permission needed)
    # ========================================================================
    def get_location_from_ip(self) -> Dict:
        """
        Get user's location from IP address using free geolocation API.
        
        Returns:
            {
                'latitude': float,
                'longitude': float,
                'city': str,
                'country': str,
                'isp': str,
                'method': 'IP'
            }
        """
        try:
            print("📍 [METHOD 1] Attempting IP-based geolocation...")
            
            # Using ipapi.co (free, no API key needed)
            response = requests.get('https://ipapi.co/json/', timeout=5)
            response.raise_for_status()
            data = response.json()
            
            if 'latitude' in data and 'longitude' in data:
                location = {
                    'latitude': float(data['latitude']),
                    'longitude': float(data['longitude']),
                    'city': data.get('city', 'Unknown'),
                    'country': data.get('country_name', 'Unknown'),
                    'isp': data.get('org', 'Unknown'),
                    'method': 'IP',
                    'timestamp': datetime.now().isoformat()
                }
                print(f"✓ Found location: {location['city']}, {location['country']}")
                return location
        except Exception as e:
            print(f"✗ IP geolocation failed: {str(e)}")
        
        return None
    
    # ========================================================================
    # METHOD 2: HARDCODED LOCATION BY NEAREST CITY
    # ========================================================================
    def get_predefined_location(self, city_name: str = "New York") -> Dict:
        """
        Get predefined coordinates for major cities.
        Useful for testing and when real geolocation is not available.
        """
        
        cities_database = {
            "New York": {"latitude": 40.7128, "longitude": -74.0060},
            "Los Angeles": {"latitude": 34.0522, "longitude": -118.2437},
            "Chicago": {"latitude": 41.8781, "longitude": -87.6298},
            "Houston": {"latitude": 29.7604, "longitude": -95.3698},
            "Phoenix": {"latitude": 33.4484, "longitude": -112.0742},
            "Philadelphia": {"latitude": 39.9526, "longitude": -75.1652},
            "San Antonio": {"latitude": 29.4241, "longitude": -98.4936},
            "San Diego": {"latitude": 32.7157, "longitude": -117.1611},
            "Dallas": {"latitude": 32.7767, "longitude": -96.7970},
            "San Jose": {"latitude": 37.3382, "longitude": -121.8863},
            "London": {"latitude": 51.5074, "longitude": -0.1278},
            "Paris": {"latitude": 48.8566, "longitude": 2.3522},
            "Tokyo": {"latitude": 35.6762, "longitude": 139.6503},
            "Dubai": {"latitude": 25.2048, "longitude": 55.2708},
            "Mumbai": {"latitude": 19.0760, "longitude": 72.8777},
            "Singapore": {"latitude": 1.3521, "longitude": 103.8198},
            "Sydney": {"latitude": -33.8688, "longitude": 151.2093},
            "Toronto": {"latitude": 43.6629, "longitude": -79.3957},
            "Mexico City": {"latitude": 19.4326, "longitude": -99.1332},
            "São Paulo": {"latitude": -23.5505, "longitude": -46.6333},
        }
        
        if city_name in cities_database:
            city_data = cities_database[city_name]
            print(f"📍 [METHOD 2] Using predefined location: {city_name}")
            return {
                **city_data,
                'city': city_name,
                'country': 'Predefined',
                'method': 'Database',
                'timestamp': datetime.now().isoformat()
            }
        else:
            print(f"✗ City '{city_name}' not found in database")
            return None
    
    # ========================================================================
    # METHOD 3: MANUAL INPUT
    # ========================================================================
    def set_manual_location(self, latitude: float, longitude: float, 
                           name: str = "Custom Location") -> Dict:
        """
        Set location manually by user input.
        """
        location = {
            'latitude': float(latitude),
            'longitude': float(longitude),
            'city': name,
            'country': 'Manual',
            'method': 'Manual',
            'timestamp': datetime.now().isoformat()
        }
        print(f"📍 [METHOD 3] Manual location set: {name}")
        print(f"   Coordinates: {latitude}, {longitude}")
        return location
    
    # ========================================================================
    # MAIN METHOD: AUTO-DETECT WITH FALLBACKS
    # ========================================================================
    def detect_location(self, prefer_method: str = "auto") -> Dict:
        """
        Auto-detect location using best available method.
        
        Args:
            prefer_method: 'ip' | 'database' | 'auto'
                - 'ip': Use IP-based geolocation
                - 'database': Use predefined cities
                - 'auto': Try IP first, fallback to database
        
        Returns:
            Location dictionary with latitude, longitude, etc.
        """
        print("\n" + "="*60)
        print("🚑 LOCATION DETECTION SYSTEM")
        print("="*60)
        
        if prefer_method == "ip" or prefer_method == "auto":
            location = self.get_location_from_ip()
            if location:
                self.location_cache = location
                self.last_update = datetime.now()
                return location
        
        # Fallback to database (predefined cities)
        if prefer_method == "database" or prefer_method == "auto":
            print("\n⚠️ IP geolocation unavailable, using fallback...")
            location = self.get_predefined_location("New York")
            self.location_cache = location
            self.last_update = datetime.now()
            return location
        
        return None
    
    # ========================================================================
    # UTILITY METHODS
    # ========================================================================
    def get_cached_location(self) -> Optional[Dict]:
        """Retrieve cached location if available."""
        return self.location_cache
    
    def is_location_fresh(self, max_age_minutes: int = 60) -> bool:
        """
        Check if cached location is fresh (not older than max_age_minutes).
        """
        if not self.last_update:
            return False
        
        age = (datetime.now() - self.last_update).total_seconds() / 60
        return age < max_age_minutes
    
    def format_coordinates(self) -> str:
        """Format location as readable string."""
        if not self.location_cache:
            return "No location detected"
        
        loc = self.location_cache
        return f"{loc['city']}, {loc['country']} ({loc['latitude']:.4f}, {loc['longitude']:.4f})"
    
    def get_location_json(self) -> str:
        """Get location as JSON string."""
        if not self.location_cache:
            return json.dumps({"error": "No location detected"})
        
        return json.dumps(self.location_cache, indent=2)
    
    def to_dict(self) -> Dict:
        """Export location as dictionary."""
        return self.location_cache if self.location_cache else {}


# ============================================================================
# EXAMPLE USAGE
# ============================================================================
if __name__ == "__main__":
    
    detector = LocationDetector()
    
    # AUTO-DETECT WITH FALLBACK
    location = detector.detect_location(prefer_method="auto")
    
    if location:
        print("\n✅ LOCATION DETECTED:")
        print("-" * 60)
        print(f"City: {location['city']}")
        print(f"Country: {location['country']}")
        print(f"Latitude: {location['latitude']}")
        print(f"Longitude: {location['longitude']}")
        print(f"Method: {location['method']}")
        print(f"Timestamp: {location['timestamp']}")
        
        print("\n📍 Formatted Location:")
        print(f"   {detector.format_coordinates()}")
        
        print("\n📄 JSON Format:")
        print(detector.get_location_json())
    
    else:
        print("✗ Location detection failed")
    
    print("="*60 + "\n")
