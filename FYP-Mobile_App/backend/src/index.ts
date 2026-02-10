import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import multer from "multer";
import openriceRouter from "./openrice";

dotenv.config();

const app = express();
const port = Number(process.env.PORT ?? 4000);

const allowedOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  }),
);

app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Geoapify API configuration
const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY ?? "11f91b14a1334d20884423912f415aac";
const GEOAPIFY_BASE_URL = "https://api.geoapify.com";

// Cuisine type mappings for filtering
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

// Cuisine health scores
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
  chinese: ['chinese', 'cantonese', 'sichuan', 'dim sum', 'noodle', 'dumpling', 'wok'],
  japanese: ['japanese', 'sushi', 'ramen', 'izakaya', 'tempura', 'udon', 'yakitori'],
  korean: ['korean', 'bbq', 'kimchi', 'bibimbap', 'korean_bbq'],
  thai: ['thai', 'pad thai', 'curry', 'tom yum'],
  vietnamese: ['vietnamese', 'pho', 'banh mi', 'spring roll'],
  indian: ['indian', 'curry', 'tandoori', 'masala', 'biryani', 'naan'],
  italian: ['italian', 'pizza', 'pasta', 'risotto', 'trattoria'],
  french: ['french', 'bistro', 'brasserie', 'patisserie'],
  american: ['american', 'burger', 'bbq', 'grill', 'diner'],
  mexican: ['mexican', 'taco', 'burrito', 'tex-mex', 'quesadilla'],
  mediterranean: ['mediterranean', 'greek', 'turkish', 'lebanese', 'falafel', 'hummus'],
  vegetarian: ['vegetarian', 'veggie'],
  vegan: ['vegan', 'plant-based', 'plant based'],
  seafood: ['seafood', 'fish', 'oyster', 'lobster', 'crab'],
  steakhouse: ['steakhouse', 'steak', 'chophouse'],
  fast_food: ['fast food', 'quick service', 'takeaway', 'take-away'],
  healthy: ['healthy', 'salad', 'bowl', 'organic', 'fresh', 'light'],
};

// Detect cuisine types from categories and name
function detectCuisines(categories: string[], name: string): string[] {
  const detected: string[] = [];
  const searchText = [...categories, name].join(' ').toLowerCase();
  
  for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    if (keywords.some(keyword => searchText.includes(keyword))) {
      detected.push(cuisine);
    }
  }
  
  return detected.length > 0 ? detected : ['general'];
}

// Calculate health score based on cuisine
function calculateHealthScore(cuisines: string[], categories: string[]): number {
  const scores: number[] = [];
  
  for (const cuisine of cuisines) {
    if (CUISINE_HEALTH_SCORES[cuisine]) {
      scores.push(CUISINE_HEALTH_SCORES[cuisine]);
    }
  }
  
  const categoriesText = categories.join(' ').toLowerCase();
  if (['healthy', 'organic', 'vegan', 'vegetarian'].some(word => categoriesText.includes(word))) {
    scores.push(80);
  }
  
  return scores.length > 0 ? Math.max(...scores) : 50;
}

// Process a single restaurant from Geoapify response
function processRestaurant(feature: any): any {
  const props = feature.properties;
  const coords = feature.geometry.coordinates;
  const categories = props.categories || [];
  const name = props.name || 'Unknown Restaurant';
  const cuisines = detectCuisines(categories, name);
  const healthScore = calculateHealthScore(cuisines, categories);
  const raw = props.datasource?.raw || {};
  
  return {
    id: props.place_id || props.osm_id?.toString() || `${coords[0]}-${coords[1]}`,
    name,
    location: {
      latitude: coords[1],
      longitude: coords[0],
      address_line1: props.address_line1 || 'Unknown',
      address_line2: props.address_line2 || '',
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
      has_healthy_options: categories.some((c: string) => c.includes('healthy') || c.includes('salad')),
      has_vegetarian: categories.some((c: string) => c.includes('vegetarian')),
      has_vegan: categories.some((c: string) => c.includes('vegan')),
      cuisine_health_score: healthScore,
    },
    rating: raw.stars || raw.rating || null,
    review_count: raw.review_count || null,
    place_id: props.place_id,
    osm_id: props.osm_id,
    price_level: raw.price_level ? '$'.repeat(Number(raw.price_level)) : null,
  };
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// OpenRice integration routes
app.use("/api/openrice", openriceRouter);

// Restaurant search endpoint
app.post("/api/restaurants/search", async (req, res) => {
  try {
    const {
      latitude,
      longitude,
      radius = 2000,
      limit = 30,
      cuisine_filter = "all",
    } = req.body;

    // Validate coordinates
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return res.status(400).json({
        success: false,
        error_message: "latitude and longitude are required as numbers",
      });
    }

    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({
        success: false,
        error_message: "Invalid latitude: must be between -90 and 90",
      });
    }

    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({
        success: false,
        error_message: "Invalid longitude: must be between -180 and 180",
      });
    }

    const category = CUISINE_CATEGORIES[cuisine_filter.toLowerCase()] || CUISINE_CATEGORIES.all;
    const apiLimit = Math.min(limit, 50);

    const url = new URL(`${GEOAPIFY_BASE_URL}/v2/places`);
    url.searchParams.set("categories", category);
    url.searchParams.set("filter", `circle:${longitude},${latitude},${radius}`);
    url.searchParams.set("bias", `proximity:${longitude},${latitude}`);
    url.searchParams.set("limit", apiLimit.toString());
    url.searchParams.set("apiKey", GEOAPIFY_API_KEY);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Geoapify API error: ${response.status}`);
    }

    const data = await response.json();
    const features = data.features || [];

    // Sort by distance
    features.sort((a: any, b: any) => 
      (a.properties.distance || 0) - (b.properties.distance || 0)
    );

    const restaurants = features.map(processRestaurant);

    return res.json({
      success: true,
      user_location: { latitude, longitude },
      search_radius_meters: radius,
      total_results: restaurants.length,
      restaurants,
      generated_at: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Restaurant search error:", error);
    return res.status(500).json({
      success: false,
      error_message: error.message || "Failed to search restaurants",
    });
  }
});

// Reverse geocode endpoint - get address from coordinates
app.get("/api/geocode/reverse", async (req, res) => {
  try {
    const { lat, lon } = req.query;

    if (!lat || !lon) {
      return res.status(400).json({
        success: false,
        error_message: "lat and lon query parameters are required",
      });
    }

    const url = new URL(`${GEOAPIFY_BASE_URL}/v1/geocode/reverse`);
    url.searchParams.set("lat", lat as string);
    url.searchParams.set("lon", lon as string);
    url.searchParams.set("apiKey", GEOAPIFY_API_KEY);

    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Geoapify API error: ${response.status}`);
    }

    const data = await response.json();
    const feature = data.features?.[0];

    if (!feature) {
      return res.json({
        success: true,
        address: null,
      });
    }

    return res.json({
      success: true,
      address: feature.properties.formatted,
      details: {
        city: feature.properties.city,
        district: feature.properties.district,
        country: feature.properties.country,
      },
    });
  } catch (error: any) {
    console.error("Reverse geocode error:", error);
    return res.status(500).json({
      success: false,
      error_message: error.message || "Failed to reverse geocode",
    });
  }
});

app.post("/api/analyze", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "Image file is required under the `file` field." });
  }

  // In a real implementation, forward the image buffer to your AI service here.
  // For now we return a mocked payload so the frontend can proceed.
  const mockPayload = {
    calories: 452,
    confidence: "high",
    detectedItems: [
      { name: "Grilled Chicken", confidence: 0.9 },
      { name: "Steamed Broccoli", confidence: 0.82 },
      { name: "Brown Rice", confidence: 0.77 },
    ],
    macronutrients: {
      protein: 38,
      carbohydrates: 45,
      fat: 12,
    },
    notes: "Sample response — connect to your AI backend to replace this.",
    receivedFileName: req.file.originalname,
    receivedFileSize: req.file.size,
  };

  return res.json(mockPayload);
});

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});

