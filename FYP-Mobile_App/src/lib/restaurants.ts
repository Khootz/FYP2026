// Restaurant types and API service for the restaurant finder feature
// Uses Geoapify API directly from frontend (no backend needed)

import { logger } from './logger';

const GEOAPIFY_API_KEY = "11f91b14a1334d20884423912f415aac";
const GEOAPIFY_BASE_URL = "https://api.geoapify.com";

// ============================================================================
// REGION CONFIGURATION
// ============================================================================

export type Region = "hk" | "my" | "auto";

export interface RegionConfig {
  code: Region;
  name: string;
  flag: string;
  defaultLocation: { lat: number; lng: number; name: string };
  features: {
    openrice: boolean;
    keeta: boolean;
    grab: boolean;
    foodpanda: boolean;
  };
}

export const REGIONS: Record<Exclude<Region, "auto">, RegionConfig> = {
  hk: {
    code: "hk",
    name: "Hong Kong",
    flag: "🇭🇰",
    defaultLocation: { lat: 22.3193, lng: 114.1694, name: "Central, Hong Kong" },
    features: {
      openrice: true,
      keeta: true,
      grab: false,
      foodpanda: true,
    },
  },
  my: {
    code: "my",
    name: "Malaysia",
    flag: "🇲🇾",
    defaultLocation: { lat: 3.139, lng: 101.6869, name: "Kuala Lumpur, Malaysia" },
    features: {
      openrice: false,
      keeta: false,
      grab: true,
      foodpanda: true,
    },
  },
};

// Popular locations for quick selection
export const POPULAR_LOCATIONS = {
  hk: [
    { name: "Central", lat: 22.2819, lng: 114.1577 },
    { name: "Causeway Bay", lat: 22.2783, lng: 114.1827 },
    { name: "Tsim Sha Tsui", lat: 22.2988, lng: 114.1722 },
    { name: "Mong Kok", lat: 22.3193, lng: 114.1694 },
    { name: "Kwun Tong", lat: 22.3105, lng: 114.2261 },
    { name: "Wan Chai", lat: 22.2776, lng: 114.1727 },
    { name: "Sha Tin", lat: 22.3873, lng: 114.1952 },
    { name: "Hang Hau", lat: 22.3157, lng: 114.2644 },
  ],
  my: [
    { name: "Kuala Lumpur", lat: 3.139, lng: 101.6869 },
    { name: "Petaling Jaya", lat: 3.1073, lng: 101.6067 },
    { name: "Subang Jaya", lat: 3.0565, lng: 101.5851 },
    { name: "Penang", lat: 5.4164, lng: 100.3327 },
    { name: "Johor Bahru", lat: 1.4927, lng: 103.7414 },
  ],
};

// ============================================================================
// DELIVERY LINKS
// ============================================================================

export interface DeliveryLinks {
  openrice?: string;
  keeta?: string;
  grab?: string;
  foodpanda?: string;
  googleMaps: string;
}

export function getDeliveryLinks(restaurant: Restaurant, region: Region): DeliveryLinks {
  const encodedName = encodeURIComponent(restaurant.name);
  const encodedAddress = encodeURIComponent(restaurant.location.address_line1);
  const { latitude, longitude } = restaurant.location;

  const links: DeliveryLinks = {
    googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
  };

  if (region === "hk" || region === "auto") {
    // Hong Kong delivery services
    links.openrice = `https://www.openrice.com/en/hongkong/restaurants?whatwhere=${encodedName}`;
    links.keeta = `https://www.keeta.com/search?q=${encodedName}`;
    links.foodpanda = `https://www.foodpanda.hk/restaurants/search?q=${encodedName}`;
  }

  if (region === "my" || region === "auto") {
    // Malaysia delivery services
    links.grab = `https://food.grab.com/my/en/restaurants?search=${encodedName}`;
    if (!links.foodpanda) {
      links.foodpanda = `https://www.foodpanda.my/restaurants/search?q=${encodedName}`;
    }
  }

  return links;
}

// Get available delivery services for a region
export function getAvailableServices(region: Region): { key: string; name: string; icon: string; color: string }[] {
  const services = [];

  if (region === "hk") {
    services.push(
      { key: "openrice", name: "OpenRice", icon: "🍽️", color: "bg-orange-500" },
      { key: "keeta", name: "Keeta", icon: "🛵", color: "bg-green-500" },
      { key: "foodpanda", name: "Foodpanda", icon: "🐼", color: "bg-pink-500" }
    );
  } else if (region === "my") {
    services.push(
      { key: "grab", name: "GrabFood", icon: "🛵", color: "bg-green-500" },
      { key: "foodpanda", name: "Foodpanda", icon: "🐼", color: "bg-pink-500" }
    );
  } else {
    // Auto - show all
    services.push(
      { key: "openrice", name: "OpenRice", icon: "🍽️", color: "bg-orange-500" },
      { key: "keeta", name: "Keeta", icon: "🛵", color: "bg-green-500" },
      { key: "grab", name: "GrabFood", icon: "🛵", color: "bg-green-600" },
      { key: "foodpanda", name: "Foodpanda", icon: "🐼", color: "bg-pink-500" }
    );
  }

  return services;
}

// ============================================================================
// GEOCODING
// ============================================================================

export interface GeocodeResult {
  success: boolean;
  latitude?: number;
  longitude?: number;
  formatted_address?: string;
  error_message?: string;
}

// Forward geocode - convert address to coordinates
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const endTimer = logger.startTimer('Geocode', `Address: "${address}"`);
  
  try {
    const url = new URL(`${GEOAPIFY_BASE_URL}/v1/geocode/search`);
    url.searchParams.set("text", address);
    url.searchParams.set("apiKey", GEOAPIFY_API_KEY);
    url.searchParams.set("limit", "1");

    logger.api('Geocode', 'GET', url.toString().replace(GEOAPIFY_API_KEY, 'API_KEY'));

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Geoapify API error: ${response.status}`);
    }

    const data = await response.json();
    logger.debug('Geocode', 'Response received', { features_count: data.features?.length });
    
    const feature = data.features?.[0];

    if (!feature) {
      logger.warn('Geocode', 'No results found for address', { address });
      return {
        success: false,
        error_message: "Location not found. Try a more specific address.",
      };
    }

    const result = {
      success: true,
      latitude: feature.geometry.coordinates[1],
      longitude: feature.geometry.coordinates[0],
      formatted_address: feature.properties.formatted,
    };
    
    logger.info('Geocode', 'Successfully geocoded', result);
    endTimer();
    return result;
  } catch (error: any) {
    logger.error('Geocode', 'Geocoding failed', error);
    endTimer();
    return {
      success: false,
      error_message: error.message || "Failed to geocode address",
    };
  }
}

export interface RestaurantLocation {
  latitude: number;
  longitude: number;
  address_line1: string;
  address_line2: string;
  city?: string;
  district?: string;
  postcode?: string;
  country?: string;
}

export interface RestaurantContact {
  phone?: string;
  website?: string;
  email?: string;
}

export interface OperatingHours {
  is_open_now: boolean;
  hours_today?: string;
}

export interface HealthTags {
  has_healthy_options: boolean;
  has_vegetarian: boolean;
  has_vegan: boolean;
  cuisine_health_score: number;
}

export interface Restaurant {
  id: string;
  name: string;
  location: RestaurantLocation;
  distance_meters: number;
  distance_km: string;
  categories: string[];
  cuisine_types: string[];
  contact: RestaurantContact;
  operating_hours: OperatingHours;
  health_tags: HealthTags;
  rating?: number;
  review_count?: number;
  place_id?: string;
  osm_id?: string;
  price_level?: string;
}

export interface SearchResult {
  success: boolean;
  user_location: { latitude: number; longitude: number };
  search_radius_meters: number;
  total_results: number;
  restaurants: Restaurant[];
  generated_at: string;
  error_message?: string;
}

export interface ReverseGeocodeResult {
  success: boolean;
  address?: string;
  details?: {
    city?: string;
    district?: string;
    country?: string;
  };
  error_message?: string;
}

export type CuisineFilter =
  | "all"
  | "chinese"
  | "japanese"
  | "korean"
  | "thai"
  | "indian"
  | "italian"
  | "french"
  | "american"
  | "mexican"
  | "seafood"
  | "steakhouse"
  | "vegetarian"
  | "vegan"
  | "fast_food";

export const CUISINE_OPTIONS: { value: CuisineFilter; label: string; emoji: string }[] = [
  { value: "all", label: "All Cuisines", emoji: "🍽️" },
  { value: "chinese", label: "Chinese", emoji: "🥡" },
  { value: "japanese", label: "Japanese", emoji: "🍱" },
  { value: "korean", label: "Korean", emoji: "🍜" },
  { value: "thai", label: "Thai", emoji: "🍛" },
  { value: "indian", label: "Indian", emoji: "🍲" },
  { value: "italian", label: "Italian", emoji: "🍝" },
  { value: "french", label: "French", emoji: "🥐" },
  { value: "american", label: "American", emoji: "🍔" },
  { value: "mexican", label: "Mexican", emoji: "🌮" },
  { value: "seafood", label: "Seafood", emoji: "🦐" },
  { value: "steakhouse", label: "Steakhouse", emoji: "🥩" },
  { value: "vegetarian", label: "Vegetarian", emoji: "🥗" },
  { value: "vegan", label: "Vegan", emoji: "🌱" },
  { value: "fast_food", label: "Fast Food", emoji: "🍟" },
];

// Cuisine category mappings for Geoapify API
const CUISINE_CATEGORIES: Record<string, string> = {
  all: "catering.restaurant",
  chinese: "catering.restaurant.chinese",
  japanese: "catering.restaurant.japanese",
  korean: "catering.restaurant.korean",
  thai: "catering.restaurant.thai",
  indian: "catering.restaurant.indian",
  italian: "catering.restaurant.italian",
  french: "catering.restaurant.french",
  american: "catering.restaurant.american",
  mexican: "catering.restaurant.mexican",
  seafood: "catering.restaurant.seafood",
  steakhouse: "catering.restaurant.steak_house",
  vegetarian: "catering.restaurant.vegetarian",
  vegan: "catering.restaurant.vegan",
  fast_food: "catering.fast_food",
};

// Cuisine health scores (0-100)
const CUISINE_HEALTH_SCORES: Record<string, number> = {
  vegan: 85,
  vegetarian: 80,
  healthy: 85,
  organic: 80,
  japanese: 75,
  mediterranean: 75,
  vietnamese: 70,
  thai: 65,
  korean: 65,
  indian: 60,
  chinese: 60,
  seafood: 70,
  italian: 55,
  french: 55,
  mexican: 50,
  american: 45,
  steakhouse: 45,
  fast_food: 25,
  general: 50,
};

// Cuisine keywords for detection
const CUISINE_KEYWORDS: Record<string, string[]> = {
  chinese: ["chinese", "cantonese", "sichuan", "dim sum", "noodle", "dumpling", "wok"],
  japanese: ["japanese", "sushi", "ramen", "izakaya", "tempura", "udon", "yakitori"],
  korean: ["korean", "bbq", "kimchi", "bibimbap", "korean_bbq"],
  thai: ["thai", "pad thai", "curry", "tom yum"],
  vietnamese: ["vietnamese", "pho", "banh mi", "spring roll"],
  indian: ["indian", "curry", "tandoori", "masala", "biryani", "naan"],
  italian: ["italian", "pizza", "pasta", "risotto", "trattoria"],
  french: ["french", "bistro", "brasserie", "patisserie"],
  american: ["american", "burger", "bbq", "grill", "diner"],
  mexican: ["mexican", "taco", "burrito", "tex-mex", "quesadilla"],
  mediterranean: ["mediterranean", "greek", "turkish", "lebanese", "falafel", "hummus"],
  vegetarian: ["vegetarian", "veggie"],
  vegan: ["vegan", "plant-based", "plant based"],
  seafood: ["seafood", "fish", "oyster", "lobster", "crab"],
  steakhouse: ["steakhouse", "steak", "chophouse"],
  fast_food: ["fast food", "quick service", "takeaway", "take-away"],
  healthy: ["healthy", "salad", "bowl", "organic", "fresh", "light"],
};

// Detect cuisine types from categories and name
function detectCuisines(categories: string[], name: string): string[] {
  const detected: string[] = [];
  const searchText = [...categories, name].join(" ").toLowerCase();

  for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    if (keywords.some((keyword) => searchText.includes(keyword))) {
      detected.push(cuisine);
    }
  }

  return detected.length > 0 ? detected : ["general"];
}

// Calculate health score based on cuisine
function calculateHealthScore(cuisines: string[], categories: string[]): number {
  const scores: number[] = [];

  for (const cuisine of cuisines) {
    if (CUISINE_HEALTH_SCORES[cuisine]) {
      scores.push(CUISINE_HEALTH_SCORES[cuisine]);
    }
  }

  const categoriesText = categories.join(" ").toLowerCase();
  if (["healthy", "organic", "vegan", "vegetarian"].some((word) => categoriesText.includes(word))) {
    scores.push(80);
  }

  return scores.length > 0 ? Math.max(...scores) : 50;
}

// Process a single restaurant from Geoapify response
function processRestaurant(feature: any): Restaurant {
  const props = feature.properties;
  const coords = feature.geometry.coordinates;
  const categories = props.categories || [];
  const name = props.name || "Unknown Restaurant";
  const cuisines = detectCuisines(categories, name);
  const healthScore = calculateHealthScore(cuisines, categories);
  const raw = props.datasource?.raw || {};

  return {
    id: props.place_id || props.osm_id?.toString() || `${coords[0]}-${coords[1]}`,
    name,
    location: {
      latitude: coords[1],
      longitude: coords[0],
      address_line1: props.address_line1 || "Unknown",
      address_line2: props.address_line2 || "",
      city: props.city,
      district: props.district,
      postcode: props.postcode,
      country: props.country,
    },
    distance_meters: props.distance || 0,
    distance_km: ((props.distance || 0) / 1000).toFixed(2),
    categories,
    cuisine_types: cuisines,
    contact: {
      phone: raw.phone || props.contact?.phone,
      website: raw.website || props.website,
      email: raw.email || props.contact?.email,
    },
    operating_hours: {
      is_open_now: false,
      hours_today: raw.opening_hours,
    },
    health_tags: {
      has_healthy_options: categories.some(
        (c: string) => c.includes("healthy") || c.includes("salad")
      ),
      has_vegetarian: categories.some((c: string) => c.includes("vegetarian")),
      has_vegan: categories.some((c: string) => c.includes("vegan")),
      cuisine_health_score: healthScore,
    },
    rating: raw.stars || raw.rating || null,
    review_count: raw.review_count || null,
    place_id: props.place_id,
    osm_id: props.osm_id,
    price_level: raw.price_level ? "$".repeat(Number(raw.price_level)) : null,
  };
}

export async function searchRestaurants(
  latitude: number,
  longitude: number,
  radius: number = 2000,
  limit: number = 30,
  cuisineFilter: CuisineFilter = "all"
): Promise<SearchResult> {
  logger.group('🍽️ Restaurant Search');
  const endTimer = logger.startTimer('Restaurant', 'Search operation');
  
  try {
    const category = CUISINE_CATEGORIES[cuisineFilter] || CUISINE_CATEGORIES.all;
    const apiLimit = Math.min(limit, 50);

    logger.info('Restaurant', 'Search parameters', {
      latitude,
      longitude,
      radius_meters: radius,
      cuisine: cuisineFilter,
      category,
      limit: apiLimit,
    });

    const url = new URL(`${GEOAPIFY_BASE_URL}/v2/places`);
    url.searchParams.set("categories", category);
    url.searchParams.set("filter", `circle:${longitude},${latitude},${radius}`);
    url.searchParams.set("bias", `proximity:${longitude},${latitude}`);
    url.searchParams.set("limit", apiLimit.toString());
    url.searchParams.set("apiKey", GEOAPIFY_API_KEY);

    logger.api('Restaurant', 'GET', url.toString().replace(GEOAPIFY_API_KEY, 'API_KEY'));

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Geoapify API error: ${response.status}`);
    }

    const data = await response.json();
    const features = data.features || [];
    
    logger.info('Restaurant', `Received ${features.length} raw results from Geoapify`);

    // Sort by distance
    features.sort(
      (a: any, b: any) => (a.properties.distance || 0) - (b.properties.distance || 0)
    );

    logger.debug('Restaurant', 'Processing restaurants...');
    const restaurants = features.map((feature: any, index: number) => {
      const restaurant = processRestaurant(feature);
      if (index < 3) {
        logger.debug('Restaurant', `#${index + 1}: ${restaurant.name}`, {
          distance: restaurant.distance_meters + 'm',
          cuisines: restaurant.cuisine_types,
          health_score: restaurant.health_tags.cuisine_health_score,
        });
      }
      return restaurant;
    });

    const result = {
      success: true,
      user_location: { latitude, longitude },
      search_radius_meters: radius,
      total_results: restaurants.length,
      restaurants,
      generated_at: new Date().toISOString(),
    };

    logger.info('Restaurant', `✅ Search completed: ${restaurants.length} restaurants found`);
    endTimer();
    logger.groupEnd();
    
    return result;
  } catch (error: any) {
    logger.error('Restaurant', 'Search failed', error);
    endTimer();
    logger.groupEnd();
    
    return {
      success: false,
      user_location: { latitude, longitude },
      search_radius_meters: radius,
      total_results: 0,
      restaurants: [],
      generated_at: new Date().toISOString(),
      error_message: error.message || "Failed to search restaurants",
    };
  }
}

export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResult> {
  try {
    const url = new URL(`${GEOAPIFY_BASE_URL}/v1/geocode/reverse`);
    url.searchParams.set("lat", latitude.toString());
    url.searchParams.set("lon", longitude.toString());
    url.searchParams.set("apiKey", GEOAPIFY_API_KEY);

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Geoapify API error: ${response.status}`);
    }

    const data = await response.json();
    const feature = data.features?.[0];

    if (!feature) {
      return {
        success: true,
        address: undefined,
      };
    }

    return {
      success: true,
      address: feature.properties.formatted,
      details: {
        city: feature.properties.city,
        district: feature.properties.district,
        country: feature.properties.country,
      },
    };
  } catch (error: any) {
    console.error("Reverse geocode error:", error);
    return {
      success: false,
      error_message: error.message || "Failed to reverse geocode",
    };
  }
}

// Get health score color based on the score
export function getHealthScoreColor(score: number): string {
  if (score >= 75) return "text-green-500";
  if (score >= 50) return "text-amber-500";
  return "text-red-500";
}

export function getHealthScoreBg(score: number): string {
  if (score >= 75) return "bg-green-500/10 border-green-500/20";
  if (score >= 50) return "bg-amber-500/10 border-amber-500/20";
  return "bg-red-500/10 border-red-500/20";
}

export function getHealthScoreLabel(score: number): string {
  if (score >= 75) return "Healthy";
  if (score >= 50) return "Moderate";
  return "Indulgent";
}

// Get cuisine emoji
export function getCuisineEmoji(cuisineType: string): string {
  const cuisineEmojis: Record<string, string> = {
    chinese: "🥡",
    japanese: "🍱",
    korean: "🍜",
    thai: "🍛",
    vietnamese: "🍲",
    indian: "🍲",
    italian: "🍝",
    french: "🥐",
    american: "🍔",
    mexican: "🌮",
    mediterranean: "🥙",
    vegetarian: "🥗",
    vegan: "🌱",
    seafood: "🦐",
    steakhouse: "🥩",
    fast_food: "🍟",
    healthy: "🥗",
    general: "🍽️",
  };
  return cuisineEmojis[cuisineType.toLowerCase()] || "🍽️";
}

// Format distance for display
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// ============================================================================
// OPENRICE INTEGRATION (Hong Kong Only - Selenium Scraper)
// ============================================================================

export interface OpenRiceData {
  query: string;
  matched: boolean;
  confidence?: number;
  name?: string;
  url?: string;
  images?: string[]; // Array of image URLs
  reviews?: {
    rating?: number;
    review_count?: number;
  };
}

// For Android: Use your computer's IP address instead of localhost
// Your computer IP: 10.89.183.141 (found via ipconfig)
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://10.89.183.141:4000";

/**
 * Fetch OpenRice images for a Hong Kong restaurant using Selenium scraper
 * Returns up to 3 images from OpenRice /photos/all page
 * 
 * Note: Only first 3 restaurants per session will be scraped for testing
 */
export async function fetchOpenRiceImages(
  restaurantName: string
): Promise<{ success: boolean; images?: string[]; name?: string; error?: string }> {
  logger.group('🍽️ OpenRice Image Fetch');
  const endTimer = logger.startTimer('OpenRice', `Fetching images for: ${restaurantName}`);
  
  try {
    const apiUrl = `${BACKEND_URL}/api/openrice/search/${encodeURIComponent(restaurantName)}`;
    
    logger.info('OpenRice', 'Sending request to backend', {
      restaurant: restaurantName,
      backend_url: BACKEND_URL,
      endpoint: apiUrl,
    });
    
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    logger.debug('OpenRice', `Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenRice', `API error: ${response.status}`, { body: errorText });
      throw new Error(`OpenRice API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    logger.debug('OpenRice', 'Backend response received', result);

    if (result.success && result.data && result.data.matched) {
      const images = result.data.images || [];
      logger.info('OpenRice', `✅ Successfully fetched ${images.length} images`, {
        matched_name: result.data.name,
        image_urls: images,
      });
      
      endTimer();
      logger.groupEnd();
      
      return {
        success: true,
        images,
        name: result.data.name,
      };
    }

    logger.warn('OpenRice', 'Restaurant not found or not matched', result);
    endTimer();
    logger.groupEnd();
    
    return {
      success: false,
      error: result.error || "Restaurant not found on OpenRice",
    };
  } catch (error: any) {
    logger.error('OpenRice', 'Fetch failed', error);
    endTimer();
    logger.groupEnd();
    
    return {
      success: false,
      error: error.message || "Failed to fetch OpenRice data",
    };
  }
}
