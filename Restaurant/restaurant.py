"""
Restaurant Finder API - Production Ready
=========================================
A comprehensive restaurant discovery system using Geoapify API.
Designed for integration with React Native mobile applications.

Features:
- GPS coordinate input (latitude, longitude from phone)
- 30 closest restaurants sorted by distance
- OpenStreetMap visualization
- Cuisine type filtering
- Operating hours detection
- Health-conscious restaurant tagging
- Caching for performance
- JSON API response format for React Native

GPS Data Format:
---------------
Mobile phones provide GPS coordinates as decimal degrees:
- Latitude: -90 to 90 (positive = North, negative = South)
- Longitude: -180 to 180 (positive = East, negative = West)
- Example: Hong Kong Central = (22.2819, 114.1577)

React Native Integration:
------------------------
Use expo-location or react-native-geolocation-service to get coordinates:
```javascript
import * as Location from 'expo-location';
const location = await Location.getCurrentPositionAsync({});
const { latitude, longitude } = location.coords;
```
"""

import requests
import json
import folium
from folium.plugins import MarkerCluster
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import hashlib
import os
import webbrowser
from pathlib import Path


# =============================================================================
# CONFIGURATION
# =============================================================================

class Config:
    """Application configuration"""
    API_KEY = "11f91b14a1334d20884423912f415aac"
    DEFAULT_RADIUS = 2000  # meters
    DEFAULT_LIMIT = 30
    MAX_LIMIT = 50
    CACHE_DURATION_MINUTES = 15
    CACHE_DIR = Path("./cache")
    OUTPUT_DIR = Path("./output")


# =============================================================================
# DATA MODELS
# =============================================================================

class CuisineType(Enum):
    """Supported cuisine types for filtering"""
    ALL = "all"
    CHINESE = "chinese"
    JAPANESE = "japanese"
    KOREAN = "korean"
    THAI = "thai"
    VIETNAMESE = "vietnamese"
    INDIAN = "indian"
    ITALIAN = "italian"
    FRENCH = "french"
    AMERICAN = "american"
    MEXICAN = "mexican"
    MEDITERRANEAN = "mediterranean"
    VEGETARIAN = "vegetarian"
    VEGAN = "vegan"
    SEAFOOD = "seafood"
    STEAKHOUSE = "steakhouse"
    FAST_FOOD = "fast_food"
    HEALTHY = "healthy"
    ORGANIC = "organic"


@dataclass
class RestaurantContact:
    """Restaurant contact information"""
    phone: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None


@dataclass
class RestaurantLocation:
    """Restaurant location data"""
    latitude: float
    longitude: float
    address_line1: str
    address_line2: str
    city: Optional[str] = None
    district: Optional[str] = None
    postcode: Optional[str] = None
    country: Optional[str] = None


@dataclass
class OperatingHours:
    """Restaurant operating hours"""
    is_open_now: bool = False
    hours_today: Optional[str] = None
    weekly_hours: Optional[Dict[str, str]] = None


@dataclass
class HealthTags:
    """Health-related tags for the restaurant"""
    has_healthy_options: bool = False
    has_vegetarian: bool = False
    has_vegan: bool = False
    has_gluten_free: bool = False
    has_organic: bool = False
    cuisine_health_score: int = 50  # 0-100 scale


@dataclass
class Restaurant:
    """Complete restaurant data model for React Native integration"""
    # Core identifiers
    id: str
    name: str
    
    # Location data
    location: RestaurantLocation
    distance_meters: float
    distance_km: float
    
    # Categories and cuisine
    categories: List[str]
    cuisine_types: List[str]
    
    # Contact information
    contact: RestaurantContact
    
    # Operating information
    operating_hours: OperatingHours
    
    # Health tags for nutrition matching
    health_tags: HealthTags
    
    # Ratings and reviews
    rating: Optional[float] = None
    review_count: Optional[int] = None
    
    # Additional metadata
    place_id: Optional[str] = None
    osm_id: Optional[str] = None
    image_url: Optional[str] = None
    price_level: Optional[str] = None  # $, $$, $$$, $$$$
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization"""
        return asdict(self)
    
    def to_menu_extraction_format(self) -> Dict[str, str]:
        """Format for menu extraction pipeline (Feature 2)"""
        return {
            "restaurant_name": self.name,
            "restaurant_id": self.id,
            "address": f"{self.location.address_line1}, {self.location.address_line2}",
            "website": self.contact.website or "",
            "cuisine_types": self.cuisine_types,
            "latitude": self.location.latitude,
            "longitude": self.location.longitude
        }


@dataclass
class SearchResult:
    """API response format for React Native"""
    success: bool
    user_location: Dict[str, float]
    search_radius_meters: int
    total_results: int
    restaurants: List[Dict[str, Any]]
    generated_at: str
    map_url: Optional[str] = None
    error_message: Optional[str] = None
    
    def to_json(self) -> str:
        """Convert to JSON string"""
        return json.dumps(asdict(self), indent=2, ensure_ascii=False)
    
    def save_to_file(self, filename: str = "restaurant_results.json"):
        """Save results to JSON file"""
        Config.OUTPUT_DIR.mkdir(exist_ok=True)
        filepath = Config.OUTPUT_DIR / filename
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(self.to_json())
        return str(filepath)


# =============================================================================
# CACHING SYSTEM
# =============================================================================

class CacheManager:
    """Simple file-based caching for API responses"""
    
    def __init__(self):
        Config.CACHE_DIR.mkdir(exist_ok=True)
    
    def _get_cache_key(self, lat: float, lon: float, radius: int, limit: int, cuisine: str) -> str:
        """Generate cache key from search parameters"""
        key_string = f"{lat:.4f}_{lon:.4f}_{radius}_{limit}_{cuisine}"
        return hashlib.md5(key_string.encode()).hexdigest()
    
    def get(self, lat: float, lon: float, radius: int, limit: int, cuisine: str) -> Optional[List[Dict]]:
        """Retrieve cached results if valid"""
        cache_key = self._get_cache_key(lat, lon, radius, limit, cuisine)
        cache_file = Config.CACHE_DIR / f"{cache_key}.json"
        
        if cache_file.exists():
            with open(cache_file, 'r', encoding='utf-8') as f:
                cached = json.load(f)
            
            cached_time = datetime.fromisoformat(cached['timestamp'])
            if datetime.now() - cached_time < timedelta(minutes=Config.CACHE_DURATION_MINUTES):
                return cached['data']
        
        return None
    
    def set(self, lat: float, lon: float, radius: int, limit: int, cuisine: str, data: List[Dict]):
        """Cache the results"""
        cache_key = self._get_cache_key(lat, lon, radius, limit, cuisine)
        cache_file = Config.CACHE_DIR / f"{cache_key}.json"
        
        cache_data = {
            'timestamp': datetime.now().isoformat(),
            'data': data
        }
        
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False)
    
    def clear(self):
        """Clear all cached data"""
        for cache_file in Config.CACHE_DIR.glob("*.json"):
            cache_file.unlink()


# =============================================================================
# CUISINE DETECTION
# =============================================================================

class CuisineDetector:
    """Detect and categorize cuisine types from restaurant data"""
    
    CUISINE_KEYWORDS = {
        CuisineType.CHINESE: ['chinese', 'cantonese', 'sichuan', 'dim sum', 'noodle', 'dumpling', 'wok'],
        CuisineType.JAPANESE: ['japanese', 'sushi', 'ramen', 'izakaya', 'tempura', 'udon', 'yakitori'],
        CuisineType.KOREAN: ['korean', 'bbq', 'kimchi', 'bibimbap', 'korean_bbq'],
        CuisineType.THAI: ['thai', 'pad thai', 'curry', 'tom yum'],
        CuisineType.VIETNAMESE: ['vietnamese', 'pho', 'banh mi', 'spring roll'],
        CuisineType.INDIAN: ['indian', 'curry', 'tandoori', 'masala', 'biryani', 'naan'],
        CuisineType.ITALIAN: ['italian', 'pizza', 'pasta', 'risotto', 'trattoria'],
        CuisineType.FRENCH: ['french', 'bistro', 'brasserie', 'patisserie'],
        CuisineType.AMERICAN: ['american', 'burger', 'bbq', 'grill', 'diner'],
        CuisineType.MEXICAN: ['mexican', 'taco', 'burrito', 'tex-mex', 'quesadilla'],
        CuisineType.MEDITERRANEAN: ['mediterranean', 'greek', 'turkish', 'lebanese', 'falafel', 'hummus'],
        CuisineType.VEGETARIAN: ['vegetarian', 'veggie'],
        CuisineType.VEGAN: ['vegan', 'plant-based', 'plant based'],
        CuisineType.SEAFOOD: ['seafood', 'fish', 'oyster', 'lobster', 'crab'],
        CuisineType.STEAKHOUSE: ['steakhouse', 'steak', 'grill', 'chophouse'],
        CuisineType.FAST_FOOD: ['fast food', 'quick service', 'takeaway', 'take-away'],
        CuisineType.HEALTHY: ['healthy', 'salad', 'bowl', 'organic', 'fresh', 'light'],
        CuisineType.ORGANIC: ['organic', 'bio', 'natural', 'farm-to-table'],
    }
    
    # Health scores by cuisine type (0-100)
    CUISINE_HEALTH_SCORES = {
        CuisineType.VEGAN: 85,
        CuisineType.VEGETARIAN: 80,
        CuisineType.HEALTHY: 85,
        CuisineType.ORGANIC: 80,
        CuisineType.JAPANESE: 75,
        CuisineType.MEDITERRANEAN: 75,
        CuisineType.VIETNAMESE: 70,
        CuisineType.THAI: 65,
        CuisineType.KOREAN: 65,
        CuisineType.INDIAN: 60,
        CuisineType.CHINESE: 60,
        CuisineType.SEAFOOD: 70,
        CuisineType.ITALIAN: 55,
        CuisineType.FRENCH: 55,
        CuisineType.MEXICAN: 50,
        CuisineType.AMERICAN: 45,
        CuisineType.STEAKHOUSE: 45,
        CuisineType.FAST_FOOD: 25,
    }
    
    @classmethod
    def detect_cuisines(cls, categories: List[str], name: str) -> List[str]:
        """Detect cuisine types from categories and restaurant name"""
        detected = []
        search_text = ' '.join(categories + [name]).lower()
        
        for cuisine_type, keywords in cls.CUISINE_KEYWORDS.items():
            if any(keyword in search_text for keyword in keywords):
                detected.append(cuisine_type.value)
        
        return detected if detected else ['general']
    
    @classmethod
    def calculate_health_score(cls, cuisines: List[str], categories: List[str]) -> int:
        """Calculate health score based on cuisine types"""
        scores = []
        
        for cuisine in cuisines:
            try:
                cuisine_enum = CuisineType(cuisine)
                if cuisine_enum in cls.CUISINE_HEALTH_SCORES:
                    scores.append(cls.CUISINE_HEALTH_SCORES[cuisine_enum])
            except ValueError:
                pass
        
        # Check for health-related keywords in categories
        categories_text = ' '.join(categories).lower()
        if any(word in categories_text for word in ['healthy', 'organic', 'vegan', 'vegetarian']):
            scores.append(80)
        
        return max(scores) if scores else 50
    
    @classmethod
    def detect_health_tags(cls, categories: List[str], name: str) -> HealthTags:
        """Detect health-related tags for a restaurant"""
        search_text = ' '.join(categories + [name]).lower()
        cuisines = cls.detect_cuisines(categories, name)
        
        return HealthTags(
            has_healthy_options='healthy' in search_text or 'salad' in search_text,
            has_vegetarian='vegetarian' in search_text or 'veggie' in search_text,
            has_vegan='vegan' in search_text or 'plant-based' in search_text,
            has_gluten_free='gluten-free' in search_text or 'gluten free' in search_text,
            has_organic='organic' in search_text or 'bio' in search_text,
            cuisine_health_score=cls.calculate_health_score(cuisines, categories)
        )


# =============================================================================
# GEOAPIFY API CLIENT
# =============================================================================

class GeoapifyClient:
    """Client for Geoapify API interactions"""
    
    BASE_URL = "https://api.geoapify.com"
    
    def __init__(self, api_key: str = Config.API_KEY):
        self.api_key = api_key
        self.cache = CacheManager()
    
    def geocode_address(self, address: str) -> Tuple[Optional[float], Optional[float]]:
        """
        Convert address text to GPS coordinates.
        
        Args:
            address: Address string to geocode
            
        Returns:
            Tuple of (latitude, longitude) or (None, None) if not found
        """
        url = f"{self.BASE_URL}/v1/geocode/search"
        params = {
            "text": address,
            "apiKey": self.api_key,
            "limit": 1
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get('features'):
                coords = data['features'][0]['geometry']['coordinates']
                return coords[1], coords[0]  # Return as (lat, lon)
            return None, None
            
        except requests.exceptions.RequestException as e:
            print(f"Geocoding error: {e}")
            return None, None
    
    def reverse_geocode(self, lat: float, lon: float) -> Optional[str]:
        """
        Convert GPS coordinates to address.
        
        Args:
            lat: Latitude
            lon: Longitude
            
        Returns:
            Address string or None
        """
        url = f"{self.BASE_URL}/v1/geocode/reverse"
        params = {
            "lat": lat,
            "lon": lon,
            "apiKey": self.api_key
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get('features'):
                props = data['features'][0]['properties']
                return props.get('formatted', 'Unknown location')
            return None
            
        except requests.exceptions.RequestException as e:
            print(f"Reverse geocoding error: {e}")
            return None
    
    def _build_category_filter(self, cuisine_filter: CuisineType) -> str:
        """Build category filter for Geoapify API"""
        base_category = "catering.restaurant"
        
        # Geoapify subcategories mapping
        cuisine_subcategories = {
            CuisineType.ITALIAN: "catering.restaurant.italian",
            CuisineType.JAPANESE: "catering.restaurant.japanese",
            CuisineType.CHINESE: "catering.restaurant.chinese",
            CuisineType.INDIAN: "catering.restaurant.indian",
            CuisineType.THAI: "catering.restaurant.thai",
            CuisineType.MEXICAN: "catering.restaurant.mexican",
            CuisineType.FRENCH: "catering.restaurant.french",
            CuisineType.AMERICAN: "catering.restaurant.american",
            CuisineType.SEAFOOD: "catering.restaurant.seafood",
            CuisineType.STEAKHOUSE: "catering.restaurant.steak_house",
            CuisineType.VEGETARIAN: "catering.restaurant.vegetarian",
            CuisineType.VEGAN: "catering.restaurant.vegan",
            CuisineType.FAST_FOOD: "catering.fast_food",
        }
        
        return cuisine_subcategories.get(cuisine_filter, base_category)
    
    def find_restaurants(
        self,
        lat: float,
        lon: float,
        radius: int = Config.DEFAULT_RADIUS,
        limit: int = Config.DEFAULT_LIMIT,
        cuisine_filter: CuisineType = CuisineType.ALL,
        use_cache: bool = True
    ) -> List[Dict]:
        """
        Find restaurants near GPS coordinates.
        
        Args:
            lat: Latitude from phone GPS (-90 to 90)
            lon: Longitude from phone GPS (-180 to 180)
            radius: Search radius in meters
            limit: Maximum number of results (max 50)
            cuisine_filter: Filter by cuisine type
            use_cache: Whether to use cached results
            
        Returns:
            List of restaurant data from Geoapify
        """
        # Validate coordinates
        if not (-90 <= lat <= 90):
            raise ValueError(f"Invalid latitude: {lat}. Must be between -90 and 90.")
        if not (-180 <= lon <= 180):
            raise ValueError(f"Invalid longitude: {lon}. Must be between -180 and 180.")
        
        limit = min(limit, Config.MAX_LIMIT)
        
        # Check cache
        if use_cache:
            cached = self.cache.get(lat, lon, radius, limit, cuisine_filter.value)
            if cached:
                print(f"[Cache] Using cached results ({len(cached)} restaurants)")
                return cached
        
        # Build API request
        category = self._build_category_filter(cuisine_filter)
        url = f"{self.BASE_URL}/v2/places"
        params = {
            "categories": category,
            "filter": f"circle:{lon},{lat},{radius}",
            "bias": f"proximity:{lon},{lat}",  # Sort by distance
            "limit": limit,
            "apiKey": self.api_key
        }
        
        try:
            response = requests.get(url, params=params, timeout=15)
            response.raise_for_status()
            data = response.json()
            features = data.get('features', [])
            
            # Sort by distance (should already be sorted, but ensure it)
            features.sort(key=lambda x: x['properties'].get('distance', float('inf')))
            
            # Cache results
            if use_cache:
                self.cache.set(lat, lon, radius, limit, cuisine_filter.value, features)
            
            return features
            
        except requests.exceptions.RequestException as e:
            print(f"API error: {e}")
            return []


# =============================================================================
# RESTAURANT DATA PROCESSOR
# =============================================================================

class RestaurantProcessor:
    """Process raw API data into Restaurant objects"""
    
    @staticmethod
    def _extract_contact(props: Dict) -> RestaurantContact:
        """Extract contact information from properties"""
        raw = props.get('datasource', {}).get('raw', {})
        return RestaurantContact(
            phone=raw.get('phone') or props.get('contact', {}).get('phone'),
            website=raw.get('website') or props.get('website'),
            email=raw.get('email') or props.get('contact', {}).get('email')
        )
    
    @staticmethod
    def _extract_location(feature: Dict) -> RestaurantLocation:
        """Extract location data from feature"""
        props = feature['properties']
        coords = feature['geometry']['coordinates']
        
        return RestaurantLocation(
            latitude=coords[1],
            longitude=coords[0],
            address_line1=props.get('address_line1', 'Unknown'),
            address_line2=props.get('address_line2', ''),
            city=props.get('city'),
            district=props.get('district'),
            postcode=props.get('postcode'),
            country=props.get('country')
        )
    
    @staticmethod
    def _extract_operating_hours(props: Dict) -> OperatingHours:
        """Extract operating hours from properties"""
        raw = props.get('datasource', {}).get('raw', {})
        opening_hours = raw.get('opening_hours')
        
        return OperatingHours(
            is_open_now=False,  # Would need real-time check
            hours_today=opening_hours,
            weekly_hours=None  # Could parse opening_hours string
        )
    
    @staticmethod
    def _extract_rating(props: Dict) -> Tuple[Optional[float], Optional[int]]:
        """Extract rating information"""
        raw = props.get('datasource', {}).get('raw', {})
        
        # Try different rating sources
        rating = raw.get('stars') or raw.get('rating')
        if rating:
            try:
                rating = float(rating)
            except (ValueError, TypeError):
                rating = None
        
        review_count = raw.get('review_count')
        if review_count:
            try:
                review_count = int(review_count)
            except (ValueError, TypeError):
                review_count = None
        
        return rating, review_count
    
    @staticmethod
    def _extract_price_level(props: Dict) -> Optional[str]:
        """Extract price level"""
        raw = props.get('datasource', {}).get('raw', {})
        price = raw.get('price_level') or raw.get('price')
        
        if price:
            # Convert numeric to $ symbols
            if isinstance(price, (int, float)):
                return '$' * int(price)
            return price
        return None
    
    @classmethod
    def process_restaurant(cls, feature: Dict) -> Restaurant:
        """Process a single restaurant feature into Restaurant object"""
        props = feature['properties']
        
        # Generate unique ID
        place_id = props.get('place_id', '')
        osm_id = str(props.get('osm_id', ''))
        restaurant_id = place_id or osm_id or hashlib.md5(
            f"{props.get('name', '')}_{props.get('lat', '')}_{props.get('lon', '')}".encode()
        ).hexdigest()[:12]
        
        # Extract categories and detect cuisines
        categories = props.get('categories', [])
        name = props.get('name', 'Unknown Restaurant')
        cuisines = CuisineDetector.detect_cuisines(categories, name)
        health_tags = CuisineDetector.detect_health_tags(categories, name)
        
        # Extract distance
        distance_m = props.get('distance', 0)
        
        # Get rating
        rating, review_count = cls._extract_rating(props)
        
        return Restaurant(
            id=restaurant_id,
            name=name,
            location=cls._extract_location(feature),
            distance_meters=distance_m,
            distance_km=round(distance_m / 1000, 2),
            categories=categories,
            cuisine_types=cuisines,
            contact=cls._extract_contact(props),
            operating_hours=cls._extract_operating_hours(props),
            health_tags=health_tags,
            rating=rating,
            review_count=review_count,
            place_id=place_id,
            osm_id=osm_id,
            image_url=props.get('datasource', {}).get('raw', {}).get('image'),
            price_level=cls._extract_price_level(props)
        )
    
    @classmethod
    def process_all(cls, features: List[Dict]) -> List[Restaurant]:
        """Process all restaurant features"""
        return [cls.process_restaurant(f) for f in features]


# =============================================================================
# MAP GENERATOR
# =============================================================================

class MapGenerator:
    """Generate interactive OpenStreetMap visualization"""
    
    # Color scheme for different cuisine types
    CUISINE_COLORS = {
        'chinese': 'red',
        'japanese': 'pink',
        'korean': 'orange',
        'thai': 'green',
        'vietnamese': 'lightgreen',
        'indian': 'purple',
        'italian': 'blue',
        'french': 'darkblue',
        'american': 'darkred',
        'mexican': 'cadetblue',
        'mediterranean': 'lightblue',
        'vegetarian': 'lightgreen',
        'vegan': 'green',
        'seafood': 'blue',
        'healthy': 'lightgreen',
        'general': 'gray'
    }
    
    @classmethod
    def create_map(
        cls,
        user_lat: float,
        user_lon: float,
        restaurants: List[Restaurant],
        filename: str = "restaurant_map.html"
    ) -> str:
        """
        Create an interactive OpenStreetMap with restaurant markers.
        
        Args:
            user_lat: User's latitude
            user_lon: User's longitude
            restaurants: List of Restaurant objects
            filename: Output HTML filename
            
        Returns:
            Path to generated HTML file
        """
        # Create map centered on user location
        m = folium.Map(
            location=[user_lat, user_lon],
            zoom_start=15,
            tiles='OpenStreetMap'
        )
        
        # Add user location marker
        folium.Marker(
            location=[user_lat, user_lon],
            popup="📍 Your Location",
            icon=folium.Icon(color='black', icon='user', prefix='fa'),
            tooltip="You are here"
        ).add_to(m)
        
        # Add search radius circle
        folium.Circle(
            location=[user_lat, user_lon],
            radius=Config.DEFAULT_RADIUS,
            color='blue',
            fill=True,
            fill_opacity=0.1,
            popup=f"Search radius: {Config.DEFAULT_RADIUS}m"
        ).add_to(m)
        
        # Create marker cluster for restaurants
        marker_cluster = MarkerCluster(name="Restaurants").add_to(m)
        
        # Add restaurant markers
        for i, restaurant in enumerate(restaurants, 1):
            # Determine marker color based on cuisine
            primary_cuisine = restaurant.cuisine_types[0] if restaurant.cuisine_types else 'general'
            color = cls.CUISINE_COLORS.get(primary_cuisine, 'gray')
            
            # Create popup content
            popup_html = f"""
            <div style="width: 250px;">
                <h4 style="margin: 0 0 10px 0;">{i}. {restaurant.name}</h4>
                <p><b>Distance:</b> {restaurant.distance_meters:.0f}m ({restaurant.distance_km} km)</p>
                <p><b>Address:</b> {restaurant.location.address_line1}</p>
                <p><b>Cuisine:</b> {', '.join(restaurant.cuisine_types)}</p>
                <p><b>Health Score:</b> {restaurant.health_tags.cuisine_health_score}/100</p>
                {f'<p><b>Phone:</b> {restaurant.contact.phone}</p>' if restaurant.contact.phone else ''}
                {f'<p><b>Website:</b> <a href="{restaurant.contact.website}" target="_blank">Visit</a></p>' if restaurant.contact.website else ''}
                {f'<p><b>Rating:</b> {"⭐" * int(restaurant.rating)} ({restaurant.rating})</p>' if restaurant.rating else ''}
            </div>
            """
            
            # Health indicator icon
            health_score = restaurant.health_tags.cuisine_health_score
            if health_score >= 75:
                icon_name = 'leaf'
                icon_color = 'green'
            elif health_score >= 50:
                icon_name = 'utensils'
                icon_color = 'orange'
            else:
                icon_name = 'hamburger'
                icon_color = 'red'
            
            folium.Marker(
                location=[restaurant.location.latitude, restaurant.location.longitude],
                popup=folium.Popup(popup_html, max_width=300),
                icon=folium.Icon(color=color, icon=icon_name, prefix='fa'),
                tooltip=f"{i}. {restaurant.name} ({restaurant.distance_meters:.0f}m)"
            ).add_to(marker_cluster)
        
        # Add layer control
        folium.LayerControl().add_to(m)
        
        # Add legend
        legend_html = '''
        <div style="position: fixed; bottom: 50px; left: 50px; z-index: 1000; 
                    background-color: white; padding: 10px; border-radius: 5px;
                    border: 2px solid gray; font-size: 12px;">
            <h4 style="margin: 0 0 10px 0;">Health Score Legend</h4>
            <p>🟢 <b>Healthy</b> (75-100)</p>
            <p>🟠 <b>Moderate</b> (50-74)</p>
            <p>🔴 <b>Indulgent</b> (0-49)</p>
        </div>
        '''
        m.get_root().html.add_child(folium.Element(legend_html))
        
        # Save map
        Config.OUTPUT_DIR.mkdir(exist_ok=True)
        filepath = Config.OUTPUT_DIR / filename
        m.save(str(filepath))
        
        return str(filepath)


# =============================================================================
# MAIN RESTAURANT FINDER CLASS
# =============================================================================

class RestaurantFinder:
    """
    Main class for finding restaurants - designed for React Native integration.
    
    Usage in React Native (via API endpoint):
    -----------------------------------------
    ```javascript
    // Get user's GPS coordinates
    const { latitude, longitude } = await Location.getCurrentPositionAsync({}).coords;
    
    // Call the API
    const response = await fetch('YOUR_API_ENDPOINT/restaurants', {
        method: 'POST',
        body: JSON.stringify({
            latitude: latitude,      // e.g., 22.2819
            longitude: longitude,    // e.g., 114.1577
            radius: 2000,           // meters
            limit: 30,
            cuisine_filter: 'all'
        })
    });
    
    const data = await response.json();
    // data.restaurants contains array of restaurant objects
    ```
    """
    
    def __init__(self, api_key: str = Config.API_KEY):
        self.client = GeoapifyClient(api_key)
        self.processor = RestaurantProcessor()
    
    def find_restaurants(
        self,
        latitude: float,
        longitude: float,
        radius: int = Config.DEFAULT_RADIUS,
        limit: int = Config.DEFAULT_LIMIT,
        cuisine_filter: str = "all",
        generate_map: bool = True,
        open_map_in_browser: bool = False
    ) -> SearchResult:
        """
        Find restaurants near GPS coordinates.
        
        This is the main method to call from your React Native app backend.
        
        Args:
            latitude: User's GPS latitude (from phone, e.g., 22.2819)
            longitude: User's GPS longitude (from phone, e.g., 114.1577)
            radius: Search radius in meters (default 2000m = 2km)
            limit: Number of restaurants to return (default 30, max 50)
            cuisine_filter: Filter by cuisine type (see CuisineType enum)
            generate_map: Whether to generate OpenStreetMap HTML
            open_map_in_browser: Automatically open map in browser
            
        Returns:
            SearchResult object with restaurants and metadata
        """
        try:
            # Parse cuisine filter
            try:
                cuisine = CuisineType(cuisine_filter.lower())
            except ValueError:
                cuisine = CuisineType.ALL
            
            print(f"\n{'='*60}")
            print("🍽️  RESTAURANT FINDER - Production API")
            print(f"{'='*60}")
            print(f"📍 Location: ({latitude:.6f}, {longitude:.6f})")
            print(f"📏 Radius: {radius}m | Limit: {limit}")
            print(f"🍜 Cuisine Filter: {cuisine.value}")
            print(f"{'='*60}\n")
            
            # Get location name
            location_name = self.client.reverse_geocode(latitude, longitude)
            print(f"📌 Address: {location_name}\n")
            
            # Find restaurants
            print("🔍 Searching for restaurants...")
            raw_restaurants = self.client.find_restaurants(
                lat=latitude,
                lon=longitude,
                radius=radius,
                limit=limit,
                cuisine_filter=cuisine
            )
            
            if not raw_restaurants:
                return SearchResult(
                    success=False,
                    user_location={"latitude": latitude, "longitude": longitude},
                    search_radius_meters=radius,
                    total_results=0,
                    restaurants=[],
                    generated_at=datetime.now().isoformat(),
                    error_message="No restaurants found in the specified area"
                )
            
            # Process restaurants
            print(f"✅ Found {len(raw_restaurants)} restaurants")
            restaurants = self.processor.process_all(raw_restaurants)
            
            # Generate map
            map_url = None
            if generate_map:
                print("\n🗺️  Generating OpenStreetMap...")
                map_path = MapGenerator.create_map(
                    user_lat=latitude,
                    user_lon=longitude,
                    restaurants=restaurants
                )
                map_url = str(Path(map_path).absolute())
                print(f"✅ Map saved: {map_url}")
                
                if open_map_in_browser:
                    webbrowser.open(f"file://{map_url}")
            
            # Create result
            result = SearchResult(
                success=True,
                user_location={"latitude": latitude, "longitude": longitude},
                search_radius_meters=radius,
                total_results=len(restaurants),
                restaurants=[r.to_dict() for r in restaurants],
                generated_at=datetime.now().isoformat(),
                map_url=map_url
            )
            
            return result
            
        except Exception as e:
            return SearchResult(
                success=False,
                user_location={"latitude": latitude, "longitude": longitude},
                search_radius_meters=radius,
                total_results=0,
                restaurants=[],
                generated_at=datetime.now().isoformat(),
                error_message=str(e)
            )
    
    def get_restaurant_for_menu_extraction(
        self,
        latitude: float,
        longitude: float,
        limit: int = 30
    ) -> List[Dict[str, str]]:
        """
        Get restaurant data formatted for menu extraction pipeline (Feature 2).
        
        Returns simplified data needed for menu scraping:
        - restaurant_name
        - restaurant_id
        - address
        - website
        - cuisine_types
        - latitude/longitude
        
        Args:
            latitude: User's GPS latitude
            longitude: User's GPS longitude
            limit: Number of restaurants
            
        Returns:
            List of dictionaries ready for menu extraction
        """
        result = self.find_restaurants(latitude, longitude, limit=limit, generate_map=False)
        
        if not result.success:
            return []
        
        # Convert to menu extraction format
        extraction_data = []
        for r_dict in result.restaurants:
            extraction_data.append({
                "restaurant_name": r_dict['name'],
                "restaurant_id": r_dict['id'],
                "address": f"{r_dict['location']['address_line1']}, {r_dict['location']['address_line2']}",
                "website": r_dict['contact']['website'] or "",
                "cuisine_types": r_dict['cuisine_types'],
                "latitude": r_dict['location']['latitude'],
                "longitude": r_dict['location']['longitude']
            })
        
        return extraction_data


# =============================================================================
# DISPLAY UTILITIES
# =============================================================================

def display_restaurants(restaurants: List[Dict], detailed: bool = False):
    """Display restaurant results in terminal"""
    if not restaurants:
        print("No restaurants found.")
        return
    
    print(f"\n{'='*70}")
    print(f"🍽️  FOUND {len(restaurants)} RESTAURANTS")
    print(f"{'='*70}\n")
    
    for i, r in enumerate(restaurants, 1):
        health_score = r['health_tags']['cuisine_health_score']
        health_emoji = "🟢" if health_score >= 75 else ("🟠" if health_score >= 50 else "🔴")
        
        print(f"{i:2}. {r['name']}")
        print(f"    📍 {r['distance_meters']:.0f}m | {r['location']['address_line1']}")
        print(f"    🍜 {', '.join(r['cuisine_types'])} | {health_emoji} Health: {health_score}/100")
        
        if detailed:
            if r['contact']['phone']:
                print(f"    📞 {r['contact']['phone']}")
            if r['contact']['website']:
                print(f"    🌐 {r['contact']['website']}")
            if r['rating']:
                print(f"    ⭐ {r['rating']}")
        print()


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def main():
    """
    Main function demonstrating the Restaurant Finder.
    
    GPS Coordinates Info:
    --------------------
    Phone GPS provides coordinates in decimal degrees format:
    - Latitude: -90 to 90 (positive = North, negative = South)
    - Longitude: -180 to 180 (positive = East, negative = West)
    
    Example locations:
    - Hong Kong Central: (22.2819, 114.1577)
    - Tokyo Shibuya: (35.6580, 139.7016)
    - New York Times Square: (40.7580, -73.9855)
    - London Big Ben: (51.5007, -0.1246)
    - Sydney Opera House: (-33.8568, 151.2153)
    """
    
    print("\n" + "="*70)
    print("🍽️  RESTAURANT FINDER - Production Demo")
    print("="*70)
    print("\nThis system accepts GPS coordinates from mobile phones.")
    print("Format: Decimal degrees (latitude, longitude)")
    print("Example: Hong Kong Central = (22.2819, 114.1577)\n")
    
    # Initialize finder
    finder = RestaurantFinder()
    
    # Get input mode
    print("Select input mode:")
    print("1. Enter GPS coordinates manually")
    print("2. Enter address/location name")
    print("3. Use demo location (Hong Kong Central)")
    
    choice = input("\nChoice (1/2/3): ").strip()
    
    if choice == "1":
        try:
            lat = float(input("Enter latitude (e.g., 22.2819): "))
            lon = float(input("Enter longitude (e.g., 114.1577): "))
        except ValueError:
            print("Invalid coordinates. Using demo location.")
            lat, lon = 22.2819, 114.1577
    
    elif choice == "2":
        address = input("Enter address/location: ").strip()
        if not address:
            print("No address provided. Using demo location.")
            lat, lon = 22.2819, 114.1577
        else:
            lat, lon = finder.client.geocode_address(address)
            if lat is None:
                print("Could not geocode address. Using demo location.")
                lat, lon = 22.2819, 114.1577
    
    else:
        lat, lon = 22.2819, 114.1577
        print("Using demo location: Hong Kong Central")
    
    # Get search parameters
    try:
        radius = int(input("\nSearch radius in meters (default 2000): ") or "2000")
        limit = int(input("Number of restaurants (default 30, max 50): ") or "30")
    except ValueError:
        radius, limit = 2000, 30
    
    # Cuisine filter
    print("\nCuisine filter options:")
    print("all, chinese, japanese, korean, thai, vietnamese, indian,")
    print("italian, french, american, mexican, mediterranean, vegetarian, vegan")
    cuisine = input("Cuisine filter (default: all): ").strip() or "all"
    
    # Find restaurants
    result = finder.find_restaurants(
        latitude=lat,
        longitude=lon,
        radius=radius,
        limit=limit,
        cuisine_filter=cuisine,
        generate_map=True,
        open_map_in_browser=True
    )
    
    # Display results
    if result.success:
        display_restaurants(result.restaurants, detailed=True)
        
        # Save to JSON
        json_path = result.save_to_file()
        print(f"\n📄 Results saved to: {json_path}")
        print(f"🗺️  Map saved to: {result.map_url}")
        
        # Show menu extraction format
        print("\n" + "="*70)
        print("📋 RESTAURANT DATA FOR MENU EXTRACTION (Feature 2)")
        print("="*70)
        extraction_data = finder.get_restaurant_for_menu_extraction(lat, lon, limit=5)
        print(json.dumps(extraction_data[:3], indent=2, ensure_ascii=False))
        
    else:
        print(f"\n❌ Error: {result.error_message}")
    
    print("\n" + "="*70)
    print("✅ Demo complete!")
    print("="*70)


if __name__ == "__main__":
    main()
