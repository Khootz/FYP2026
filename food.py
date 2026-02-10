import os
import csv
import time
import requests
import pandas as pd
import math
from urllib.parse import urlencode

API_KEY = "AIzaSyB1wtsPtU3a4zB9PwcdbhgFhgLqJlQneew"

def geocode_address(address: str) -> tuple[float, float]:
    geocode_url = (
        "https://maps.googleapis.com/maps/api/geocode/json?"
        + urlencode({"address": address, "key": API_KEY})
    )
    resp = requests.get(geocode_url, timeout=10).json()
    results = resp.get("results")
    if not results:
        raise ValueError(f"Geocode failed for '{address}': {resp.get('status')}")
    loc = results[0]["geometry"]["location"]
    return loc["lat"], loc["lng"]

def calculate_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance between two points using Haversine formula. Returns distance in km."""
    R = 6371  # Earth's radius in kilometers
    
    # Convert latitude and longitude from degrees to radians
    lat1_rad = math.radians(lat1)
    lng1_rad = math.radians(lng1)
    lat2_rad = math.radians(lat2)
    lng2_rad = math.radians(lng2)
    
    # Haversine formula
    dlat = lat2_rad - lat1_rad
    dlng = lng2_rad - lng1_rad
    a = math.sin(dlat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlng/2)**2
    c = 2 * math.asin(math.sqrt(a))
    
    return R * c

def nearby_search(lat: float, lng: float, radius: int = 1000):
    """Search for restaurants near the given coordinates."""
    base_url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
    params = {
        "key": API_KEY,
        "location": f"{lat},{lng}",
        "type": "restaurant",  # Changed to specifically search for restaurants
        "radius": radius,
        "rankby": "distance"  # Rank by distance instead of popularity
    }

    # Note: When using rankby=distance, we cannot use radius parameter
    # So we'll use radius for initial search and filter by distance later
    params = {
        "key": API_KEY,
        "location": f"{lat},{lng}",
        "type": "restaurant",
        "radius": radius,
    }

    all_places = []
    while True:
        resp = requests.get(base_url, params=params, timeout=10).json()
        places = resp.get("results", [])
        all_places.extend(places)
        
        next_token = resp.get("next_page_token")
        if not next_token:
            break
        time.sleep(2)
        params = {"key": API_KEY, "pagetoken": next_token}
    
    # Calculate distance for each place and sort by distance
    for place in all_places:
        place_lat = place["geometry"]["location"]["lat"]
        place_lng = place["geometry"]["location"]["lng"]
        distance = calculate_distance(lat, lng, place_lat, place_lng)
        place["distance_km"] = distance
    
    # Sort by distance and filter by radius
    all_places.sort(key=lambda x: x["distance_km"])
    filtered_places = [p for p in all_places if p["distance_km"] <= radius/1000]
    
    return filtered_places

def normalize_address(address: str) -> str:
    if not isinstance(address, str):
        return address
    parts = [p.strip() for p in address.split(",")]
    if parts and parts[0].lower() == "hong kong":
        parts = parts[1:] + [parts[0]]
    return ", ".join([p for p in parts if p])

def get_place_details(place_id: str) -> dict:
    details_url = "https://maps.googleapis.com/maps/api/place/details/json"
    params = {
        "key": API_KEY,
        "place_id": place_id,
        "fields": ",".join([
            "name",
            "formatted_address",
            "international_phone_number",
            "website",
            "price_level",
            "rating",
            "user_ratings_total",
            "geometry",
            "types",
            "opening_hours"
        ])
    }
    resp = requests.get(details_url, params=params, timeout=10).json()
    return resp.get("result", {})

def get_offset_positions(lat, lng, offset_level):
    if not offset_level:
        return [(lat, lng, "center")]
    
    try:
        level = int(offset_level)
        distance_m = level * 1000  
        
        delta_lat = distance_m / 111320  
        delta_lng = distance_m / (111320 * math.cos(math.radians(lat)))
        
        positions = []
        
        # Include center for offset level 1
        if level == 1:
            positions.append((lat, lng, "center"))
        
        # Add the 8 surrounding positions for any offset level
        positions.extend([
            (lat + delta_lat, lng, "N"),              
            (lat - delta_lat, lng, "S"),              
            (lat, lng + delta_lng, "E"),              
            (lat, lng - delta_lng, "W"),              
            (lat + delta_lat, lng + delta_lng, "NE"), 
            (lat + delta_lat, lng - delta_lng, "NW"), 
            (lat - delta_lat, lng + delta_lng, "SE"), 
            (lat - delta_lat, lng - delta_lng, "SW"), 
        ])
        
        return positions
    except (ValueError, TypeError):
        return [(lat, lng, "center")]

def save_csv(rows: list[dict], filename: str):
    """Write list of dicts to CSV."""
    if not rows:
        print("No data to save.")
        return
    
    file_exists = os.path.isfile(filename)

    with open(filename, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())

        if not file_exists:
            writer.writeheader()

        writer.writerows(rows)
    print(f"✅ Appended {len(rows)} rows to {filename}")

def main():
    print("🍽️  Restaurant Finder")
    print("=" * 40)
    
    # Get user input for location
    address = input("Enter your address (e.g., 'Hang Hau, Hong Kong'): ").strip()
    if not address:
        print("❌ Please enter a valid address.")
        return
    
    # Get customizable radius
    while True:
        try:
            radius_km = float(input("Enter search radius in km (1-5): "))
            if 1 <= radius_km <= 5:
                radius_m = int(radius_km * 1000)  # Convert to meters
                break
            else:
                print("❌ Please enter a radius between 1 and 5 km.")
        except ValueError:
            print("❌ Please enter a valid number.")

    print(f"\n🔍 Geocoding location: {address}...")
    try:
        lat, lng = geocode_address(address)
        print(f"   ➜ {address} → {lat:.5f}, {lng:.5f}")
    except ValueError as e:
        print(f"❌ {e}")
        return

    print(f"\n📡 Searching for restaurants within {radius_km}km...")
    
    try:
        restaurants = nearby_search(lat, lng, radius_m)
        
        if not restaurants:
            print(f"❌ No restaurants found within {radius_km}km of {address}")
            return
            
        print(f"🔎 Found {len(restaurants)} restaurants, sorted by distance.")
        
        records = []
        for i, place in enumerate(restaurants[:50], 1):  # Limit to top 50 closest
            details = get_place_details(place["place_id"])
            time.sleep(0.1)  # Reduced delay since we're doing fewer requests
            
            normalized_address = normalize_address(details.get("formatted_address"))
            distance_km = place["distance_km"]
            
            record = {
                "rank": i,
                "name": details.get("name"),
                "distance_km": round(distance_km, 2),
                "address": normalized_address,
                "phone": details.get("international_phone_number"),
                "website": details.get("website"),
                "price_level": details.get("price_level"),
                "rating": details.get("rating"),
                "user_ratings_total": details.get("user_ratings_total"),
                "is_open_now": details.get("opening_hours", {}).get("open_now") if details.get("opening_hours") else None
            }
            records.append(record)
            
            print(f"   {i:2d}. {details.get('name')} ({distance_km:.2f}km)")

        # Save to CSV
        csv_name = f"restaurants_{address.replace(' ', '_').replace(',', '')}.csv"
        save_csv(records, csv_name)
        
        print(f"\n🎉 Found {len(records)} restaurants within {radius_km}km of {address}")
        print(f"📄 Results saved to: {csv_name}")
        
    except Exception as e:
        print(f"❌ Error searching for restaurants: {e}")
        return

if __name__ == "__main__":
    if API_KEY in ("", "PASTE_YOUR_KEY_HERE", "(hidden)"):
        raise SystemExit("‼ Please set your GOOGLE_API_KEY.")
    main()