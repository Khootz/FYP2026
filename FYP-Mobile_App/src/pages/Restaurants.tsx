import { useState, useEffect, useCallback, useMemo } from "react";
import {
  MapPin,
  Star,
  Clock,
  Heart,
  Navigation,
  Loader2,
  Map as MapIcon,
  List,
  ChevronDown,
  Phone,
  Globe,
  Leaf,
  Filter,
  RefreshCw,
  AlertCircle,
  Compass,
  X,
  ExternalLink,
  Search,
  MapPinned,
  Utensils,
  Bike,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { useToast } from "@/hooks/use-toast";
import { useGeolocation } from "@/hooks/use-geolocation";
import { logger } from "@/lib/logger";
import {
  Restaurant,
  CuisineFilter,
  CUISINE_OPTIONS,
  searchRestaurants,
  reverseGeocode,
  geocodeAddress,
  getHealthScoreColor,
  getHealthScoreBg,
  getHealthScoreLabel,
  getCuisineEmoji,
  formatDistance,
  Region,
  REGIONS,
  POPULAR_LOCATIONS,
  getDeliveryLinks,
  getAvailableServices,
  fetchOpenRiceImages,
} from "@/lib/restaurants";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Custom marker icons
const createCustomIcon = (color: string, emoji?: string) => {
  return L.divIcon({
    className: "custom-marker",
    html: `
      <div style="
        background: linear-gradient(135deg, ${color}, ${color}dd);
        width: 36px;
        height: 36px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        border: 3px solid white;
      ">
        <span style="transform: rotate(45deg); font-size: 14px;">${emoji || "🍽️"}</span>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

const userLocationIcon = L.divIcon({
  className: "user-location-marker",
  html: `
    <div style="
      width: 20px;
      height: 20px;
      background: linear-gradient(135deg, #3b82f6, #1d4ed8);
      border-radius: 50%;
      border: 4px solid white;
      box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(0,0,0,0.3);
      animation: pulse 2s infinite;
    "></div>
    <style>
      @keyframes pulse {
        0%, 100% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 4px 12px rgba(0,0,0,0.3); }
        50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.1), 0 4px 12px rgba(0,0,0,0.3); }
      }
    </style>
  `,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -10],
});

// Map component that handles bounds
function MapBounds({
  userPosition,
  restaurants,
}: {
  userPosition: [number, number];
  restaurants: Restaurant[];
}) {
  const map = useMap();

  useEffect(() => {
    if (restaurants.length > 0) {
      const bounds = L.latLngBounds([userPosition]);
      restaurants.forEach((r) => {
        bounds.extend([r.location.latitude, r.location.longitude]);
      });
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
      map.setView(userPosition, 14);
    }
  }, [map, userPosition, restaurants]);

  return null;
}

const Restaurants = () => {
  const { toast } = useToast();
  const {
    position,
    loading: locationLoading,
    error: locationError,
    permissionStatus,
    getCurrentPosition,
    requestPermission,
  } = useGeolocation();

  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [cuisineFilter, setCuisineFilter] = useState<CuisineFilter>("all");
  const [searchRadius, setSearchRadius] = useState(2000);
  const [locationAddress, setLocationAddress] = useState<string | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // NEW: Region and manual location state
  const [region, setRegion] = useState<Region>("hk"); // Default to Hong Kong for testing
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [manualLocationInput, setManualLocationInput] = useState("");
  const [manualLocation, setManualLocation] = useState<{
    lat: number;
    lng: number;
    address: string;
  } | null>(null);
  const [geocoding, setGeocoding] = useState(false);

  // OpenRice images state (Selenium-scraped)
  const [openriceImages, setOpenriceImages] = useState<string[]>([]);
  const [loadingOpenRice, setLoadingOpenRice] = useState(false);
  const [openriceName, setOpenriceName] = useState<string | null>(null);


  // Effective position - either from GPS or manual input
  const effectivePosition = useMemo(() => {
    if (manualLocation) {
      return {
        coords: {
          latitude: manualLocation.lat,
          longitude: manualLocation.lng,
        },
      };
    }
    return position;
  }, [manualLocation, position]);

  // Load favorites from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("restaurant_favorites");
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
  }, []);

  // Save favorites to localStorage
  useEffect(() => {
    localStorage.setItem("restaurant_favorites", JSON.stringify(favorites));
  }, [favorites]);

  // Check location permission on mount
  useEffect(() => {
    if (permissionStatus === "denied") {
      setShowPermissionDialog(true);
    } else if (permissionStatus === "prompt" && isInitialLoad) {
      setShowPermissionDialog(true);
    }
  }, [permissionStatus, isInitialLoad]);

  // Fetch restaurants when position changes
  const fetchRestaurants = useCallback(async () => {
    if (!effectivePosition) {
      logger.warn('RestaurantsPage', 'fetchRestaurants called but no position available');
      return;
    }

    logger.info('RestaurantsPage', '🔄 Fetching restaurants...', {
      latitude: effectivePosition.coords.latitude,
      longitude: effectivePosition.coords.longitude,
      radius: searchRadius,
      cuisine: cuisineFilter,
      source: manualLocation ? 'manual' : 'gps',
    });

    setLoading(true);
    setError(null);

    try {
      const result = await searchRestaurants(
        effectivePosition.coords.latitude,
        effectivePosition.coords.longitude,
        searchRadius,
        30,
        cuisineFilter
      );

      if (result.success) {
        setRestaurants(result.restaurants);
        logger.info('RestaurantsPage', `✅ Successfully loaded ${result.restaurants.length} restaurants`);
        toast({
          title: `Found ${result.restaurants.length} restaurants`,
          description: `Within ${searchRadius / 1000}km ${manualLocation ? "of " + manualLocation.address : "of your location"}`,
        });
      } else {
        logger.error('RestaurantsPage', 'Search failed', result.error_message);
        setError(result.error_message || "Failed to fetch restaurants");
      }
    } catch (err: any) {
      logger.error('RestaurantsPage', 'Search exception', err);
      setError(err.message || "Failed to search restaurants");
    } finally {
      setLoading(false);
    }
  }, [effectivePosition, searchRadius, cuisineFilter, toast, manualLocation]);

  // Fetch address when position changes
  useEffect(() => {
    if (position && !manualLocation) {
      reverseGeocode(position.coords.latitude, position.coords.longitude)
        .then((result) => {
          if (result.success && result.address) {
            setLocationAddress(result.address);
          }
        })
        .catch(() => {
          // Silently fail for address lookup
        });
    }
  }, [position, manualLocation]);

  // Auto-fetch restaurants when position is available
  useEffect(() => {
    if (effectivePosition && isInitialLoad) {
      fetchRestaurants();
      setIsInitialLoad(false);
    }
  }, [effectivePosition, fetchRestaurants, isInitialLoad]);

  // Handle manual location search
  const handleManualLocationSearch = async () => {
    if (!manualLocationInput.trim()) return;

    setGeocoding(true);
    try {
      const result = await geocodeAddress(manualLocationInput);
      if (result.success && result.latitude && result.longitude) {
        setManualLocation({
          lat: result.latitude,
          lng: result.longitude,
          address: result.formatted_address || manualLocationInput,
        });
        setLocationAddress(result.formatted_address || manualLocationInput);
        setShowLocationDialog(false);
        setIsInitialLoad(true); // Trigger search
        toast({
          title: "Location set!",
          description: result.formatted_address,
        });
      } else {
        toast({
          title: "Location not found",
          description: result.error_message || "Try a more specific address",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to find location",
        variant: "destructive",
      });
    } finally {
      setGeocoding(false);
    }
  };

  // Handle quick location selection
  const handleQuickLocation = (loc: { name: string; lat: number; lng: number }) => {
    setManualLocation({
      lat: loc.lat,
      lng: loc.lng,
      address: `${loc.name}, ${region === "hk" ? "Hong Kong" : "Malaysia"}`,
    });
    setLocationAddress(`${loc.name}, ${region === "hk" ? "Hong Kong" : "Malaysia"}`);
    setShowLocationDialog(false);
    setIsInitialLoad(true);
    toast({
      title: "Location set!",
      description: `${loc.name}`,
    });
  };

  // Clear manual location and use GPS
  const handleUseGPS = async () => {
    setManualLocation(null);
    setShowLocationDialog(false);
    const pos = await getCurrentPosition();
    if (pos) {
      setIsInitialLoad(true);
    }
  };

  // Handle location request
  const handleGetLocation = async () => {
    setShowPermissionDialog(false);
    setManualLocation(null); // Clear manual location
    const pos = await getCurrentPosition();
    if (pos) {
      toast({
        title: "Location found!",
        description: "Searching for nearby restaurants...",
      });
      setIsInitialLoad(true);
    }
  };

  // Get current region config
  const regionConfig = region !== "auto" ? REGIONS[region] : REGIONS.hk;
  const popularLocations = POPULAR_LOCATIONS[region !== "auto" ? region : "hk"];

  // Fetch OpenRice images when a restaurant is selected (HK only)
  // Uses Selenium scraper - only first 3 restaurants per session
  useEffect(() => {
    if (selectedRestaurant && region === "hk") {
      logger.info('RestaurantsPage', '🖼️ Initiating OpenRice image fetch', {
        restaurant: selectedRestaurant.name,
        region,
      });
      
      setLoadingOpenRice(true);
      setOpenriceImages([]);
      setOpenriceName(null);
      
      fetchOpenRiceImages(selectedRestaurant.name)
        .then((result) => {
          if (result.success && result.images && result.images.length > 0) {
            logger.info('RestaurantsPage', `✅ OpenRice images loaded: ${result.images.length} images`);
            setOpenriceImages(result.images);
            setOpenriceName(result.name || null);
            toast({
              title: "OpenRice photos loaded",
              description: `Found ${result.images.length} photos`,
            });
          } else if (result.error) {
            logger.warn('RestaurantsPage', 'OpenRice fetch unsuccessful', { error: result.error });
          }
        })
        .catch((error) => {
          logger.error('RestaurantsPage', 'OpenRice fetch failed', error);
        })
        .finally(() => {
          setLoadingOpenRice(false);
        });
    } else {
      if (selectedRestaurant && region !== "hk") {
        logger.debug('RestaurantsPage', 'OpenRice skipped - not HK region', { region });
      }
      setOpenriceImages([]);
      setOpenriceName(null);
    }
  }, [selectedRestaurant, region, toast]);

  // Toggle favorite
  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((fav) => fav !== id) : [...prev, id]
    );
    toast({
      title: favorites.includes(id) ? "Removed from favorites" : "Added to favorites",
      duration: 2000,
    });
  };

  // Get marker color based on health score
  const getMarkerColor = (score: number) => {
    if (score >= 75) return "#22c55e";
    if (score >= 50) return "#f59e0b";
    return "#ef4444";
  };

  // Price display
  const getPriceDisplay = (level: string | undefined) => {
    if (!level) return "N/A";
    return level;
  };

  // User position for map
  const userPosition: [number, number] | null = effectivePosition
    ? [effectivePosition.coords.latitude, effectivePosition.coords.longitude]
    : null;

  // Filter restaurants by favorites
  const favoriteRestaurants = useMemo(
    () => restaurants.filter((r) => favorites.includes(r.id)),
    [restaurants, favorites]
  );

  // Selected cuisine option
  const selectedCuisine = CUISINE_OPTIONS.find((c) => c.value === cuisineFilter);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 page-content">
      {/* Header with glassmorphism effect */}
      <header className="relative overflow-hidden">
        {/* Animated background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 via-rose-600/10 to-purple-600/20" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/20 via-transparent to-transparent" />
        
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-rose-500/10 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2" />
        
        <div className="relative px-5 pt-8 pb-6">
          <div className="w-full">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-orange-100 to-orange-200 bg-clip-text text-transparent">
                  Discover
                </h1>
                <p className="text-slate-400 text-sm mt-1">Find healthy restaurants near you</p>
              </div>
              <div className="flex items-center gap-2">
                {/* Region selector */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-10 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                    >
                      <span className="text-lg mr-1">{regionConfig.flag}</span>
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="bg-slate-900 border-slate-700" align="end">
                    <DropdownMenuItem
                      onClick={() => setRegion("hk")}
                      className={`cursor-pointer ${region === "hk" ? "bg-orange-500/20 text-orange-400" : "text-slate-300"}`}
                    >
                      🇭🇰 Hong Kong
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setRegion("my")}
                      className={`cursor-pointer ${region === "my" ? "bg-orange-500/20 text-orange-400" : "text-slate-300"}`}
                    >
                      🇲🇾 Malaysia
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10"
                  onClick={fetchRestaurants}
                  disabled={loading || !effectivePosition}
                >
                  <RefreshCw className={`w-5 h-5 text-slate-300 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>

            {/* Location display */}
            <div 
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm cursor-pointer hover:bg-white/10 transition-colors"
              onClick={() => setShowLocationDialog(true)}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${
                manualLocation 
                  ? "bg-gradient-to-br from-orange-500 to-rose-500 shadow-orange-500/20" 
                  : "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20"
              }`}>
                {manualLocation ? <MapPinned className="w-5 h-5 text-white" /> : <MapPin className="w-5 h-5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                {locationLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    <span className="text-sm text-slate-400">Getting your location...</span>
                  </div>
                ) : effectivePosition ? (
                  <>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {manualLocation ? manualLocation.address : (locationAddress || "Current Location")}
                      </p>
                      {manualLocation && (
                        <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] px-1.5 py-0">
                          Manual
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {effectivePosition.coords.latitude.toFixed(4)}, {effectivePosition.coords.longitude.toFixed(4)}
                    </p>
                  </>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowLocationDialog(true);
                    }}
                    className="text-sm text-orange-400 hover:text-orange-300 flex items-center gap-1"
                  >
                    <Compass className="w-4 h-4" />
                    Tap to set location
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Search className="w-4 h-4 text-slate-500" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-3 py-4 space-y-3 overflow-x-hidden">
        {/* View toggle and filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View mode toggle */}
          <div className="flex bg-slate-800/50 rounded-xl p-1 border border-slate-700/50 flex-shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "list"
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode("map")}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                viewMode === "map"
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              Map
            </button>
          </div>

          {/* Cuisine filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 min-w-0 justify-between bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-xl h-9 px-2"
              >
                <span className="flex items-center gap-1.5 truncate">
                  <Filter className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{selectedCuisine?.emoji} {selectedCuisine?.label}</span>
                </span>
                <ChevronDown className="w-3.5 h-3.5 ml-1 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-56 max-h-80 overflow-y-auto bg-slate-900 border-slate-700"
              align="end"
            >
              {CUISINE_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => {
                    setCuisineFilter(option.value);
                    if (position) fetchRestaurants();
                  }}
                  className={`cursor-pointer ${
                    cuisineFilter === option.value ? "bg-orange-500/20 text-orange-400" : "text-slate-300"
                  }`}
                >
                  <span className="mr-2">{option.emoji}</span>
                  {option.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Radius filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="bg-slate-800/50 border-slate-700/50 text-slate-300 hover:bg-slate-700/50 hover:text-white rounded-xl h-9 px-2 flex-shrink-0"
              >
                {searchRadius / 1000}km
                <ChevronDown className="w-3.5 h-3.5 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="bg-slate-900 border-slate-700" align="end">
              {[1000, 2000, 3000, 5000].map((radius) => (
                <DropdownMenuItem
                  key={radius}
                  onClick={() => {
                    setSearchRadius(radius);
                    if (position) fetchRestaurants();
                  }}
                  className={`cursor-pointer ${
                    searchRadius === radius ? "bg-orange-500/20 text-orange-400" : "text-slate-300"
                  }`}
                >
                  {radius / 1000}km radius
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Error display */}
        {(error || locationError) && (
          <Card className="p-4 bg-red-500/10 border-red-500/30">
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error || locationError}</span>
            </div>
          </Card>
        )}

        {/* Loading state */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-gradient-to-r from-orange-500 to-rose-500 flex items-center justify-center mb-4 animate-pulse">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <p className="text-slate-400">Searching for restaurants...</p>
          </div>
        )}

        {/* No location state */}
        {!effectivePosition && !loading && !locationLoading && (
          <Card className="p-8 bg-slate-800/50 border-slate-700/50 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-10 h-10 text-blue-400" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">Set Your Location</h3>
            <p className="text-slate-400 mb-6">
              Use GPS or enter a location manually to discover amazing restaurants
            </p>
            <div className="flex flex-col gap-3">
              <Button
                onClick={handleGetLocation}
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg shadow-blue-500/25"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Use GPS Location
              </Button>
              <Button
                onClick={() => setShowLocationDialog(true)}
                variant="outline"
                className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
              >
                <Search className="w-4 h-4 mr-2" />
                Enter Location Manually
              </Button>
            </div>
          </Card>
        )}

        {/* Map View */}
        {viewMode === "map" && effectivePosition && !loading && (
          <div className="rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl" style={{ height: "400px" }}>
            <MapContainer
              center={userPosition!}
              zoom={14}
              style={{ height: "100%", width: "100%" }}
              zoomControl={false}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              />
              
              {/* Search radius circle */}
              <Circle
                center={userPosition!}
                radius={searchRadius}
                pathOptions={{
                  color: "#f97316",
                  fillColor: "#f97316",
                  fillOpacity: 0.1,
                  weight: 2,
                  dashArray: "5, 10",
                }}
              />

              {/* User location marker */}
              <Marker position={userPosition!} icon={userLocationIcon}>
                <Popup className="custom-popup">
                  <div className="text-center">
                    <strong>📍 You are here</strong>
                    <p className="text-xs text-gray-500 mt-1">{locationAddress}</p>
                  </div>
                </Popup>
              </Marker>

              {/* Restaurant markers */}
              {restaurants.map((restaurant) => (
                <Marker
                  key={restaurant.id}
                  position={[restaurant.location.latitude, restaurant.location.longitude]}
                  icon={createCustomIcon(
                    getMarkerColor(restaurant.health_tags.cuisine_health_score),
                    getCuisineEmoji(restaurant.cuisine_types[0] || "general")
                  )}
                  eventHandlers={{
                    click: () => setSelectedRestaurant(restaurant),
                  }}
                >
                  <Popup className="custom-popup">
                    <div className="min-w-48">
                      <h4 className="font-semibold text-sm">{restaurant.name}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistance(restaurant.distance_meters)} away
                      </p>
                      <p className="text-xs text-gray-500">{restaurant.location.address_line1}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`text-xs font-medium ${getHealthScoreColor(
                            restaurant.health_tags.cuisine_health_score
                          )}`}
                        >
                          {getHealthScoreLabel(restaurant.health_tags.cuisine_health_score)} (
                          {restaurant.health_tags.cuisine_health_score}/100)
                        </span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

              <MapBounds userPosition={userPosition!} restaurants={restaurants} />
            </MapContainer>
          </div>
        )}

        {/* Restaurant List */}
        {viewMode === "list" && !loading && restaurants.length > 0 && (
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full bg-slate-800/50 border border-slate-700/50 p-1 rounded-xl">
              <TabsTrigger
                value="all"
                className="flex-1 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-rose-500 data-[state=active]:text-white"
              >
                All ({restaurants.length})
              </TabsTrigger>
              <TabsTrigger
                value="favorites"
                className="flex-1 rounded-lg data-[state=active]:bg-gradient-to-r data-[state=active]:from-orange-500 data-[state=active]:to-rose-500 data-[state=active]:text-white"
              >
                <Heart className="w-4 h-4 mr-1" />
                Favorites ({favoriteRestaurants.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4 space-y-3">
              {restaurants.map((restaurant, index) => (
                <RestaurantCard
                  key={restaurant.id}
                  restaurant={restaurant}
                  index={index + 1}
                  isFavorite={favorites.includes(restaurant.id)}
                  onToggleFavorite={() => toggleFavorite(restaurant.id)}
                  onSelect={() => setSelectedRestaurant(restaurant)}
                />
              ))}
            </TabsContent>

            <TabsContent value="favorites" className="mt-4 space-y-3">
              {favoriteRestaurants.length === 0 ? (
                <Card className="p-8 bg-slate-800/50 border-slate-700/50 text-center">
                  <Heart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No favorites yet</p>
                  <p className="text-slate-500 text-sm mt-1">
                    Tap the heart icon on restaurants to save them here
                  </p>
                </Card>
              ) : (
                favoriteRestaurants.map((restaurant, index) => (
                  <RestaurantCard
                    key={restaurant.id}
                    restaurant={restaurant}
                    index={index + 1}
                    isFavorite={true}
                    onToggleFavorite={() => toggleFavorite(restaurant.id)}
                    onSelect={() => setSelectedRestaurant(restaurant)}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Empty state */}
        {!loading && restaurants.length === 0 && effectivePosition && (
          <Card className="p-8 bg-slate-800/50 border-slate-700/50 text-center">
            <div className="w-20 h-20 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-10 h-10 text-slate-500" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">No restaurants found</h3>
            <p className="text-slate-400 mb-4">
              Try expanding your search radius or changing the cuisine filter
            </p>
            <Button
              onClick={fetchRestaurants}
              variant="outline"
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </Card>
        )}
      </main>

      {/* Restaurant Detail Dialog */}
      <Dialog open={!!selectedRestaurant} onOpenChange={() => setSelectedRestaurant(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md mx-4 max-h-[85vh] overflow-y-auto">
          {selectedRestaurant && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/20 to-rose-500/20 border border-orange-500/30 flex items-center justify-center text-2xl">
                      {getCuisineEmoji(selectedRestaurant.cuisine_types[0] || "general")}
                    </div>
                    <div>
                      <DialogTitle className="text-lg">{selectedRestaurant.name}</DialogTitle>
                      <DialogDescription className="text-slate-400">
                        {selectedRestaurant.cuisine_types.join(", ")}
                      </DialogDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => toggleFavorite(selectedRestaurant.id)}
                    className="h-8 w-8"
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        favorites.includes(selectedRestaurant.id)
                          ? "fill-red-500 text-red-500"
                          : "text-slate-400"
                      }`}
                    />
                  </Button>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* OpenRice Photos - Hong Kong only (Selenium Scraped) */}
                {region === "hk" && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        🍽️ OpenRice Photos
                        {loadingOpenRice && (
                          <Loader2 className="w-3 h-3 animate-spin text-orange-400" />
                        )}
                      </label>
                      {openriceImages.length > 0 && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] px-1.5 py-0">
                          {openriceImages.length} photos
                        </Badge>
                      )}
                    </div>
                    
                    {loadingOpenRice && (
                      <div className="flex items-center justify-center py-8 bg-slate-800/50 rounded-xl">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-orange-400 mx-auto mb-2" />
                          <p className="text-xs text-slate-400">Scraping OpenRice...</p>
                          <p className="text-xs text-slate-500 mt-1">This may take 10-15 seconds</p>
                        </div>
                      </div>
                    )}
                    
                    {!loadingOpenRice && openriceImages.length === 0 && (
                      <div className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20">
                        <p className="text-xs text-slate-400">
                          📸 Photos will be scraped for the first 3 restaurants (testing mode)
                        </p>
                      </div>
                    )}
                    
                    {openriceImages.length > 0 && (
                      <div className="space-y-2">
                        {openriceName && openriceName !== selectedRestaurant.name && (
                          <p className="text-xs text-slate-400">
                            Matched: <span className="text-orange-400">{openriceName}</span>
                          </p>
                        )}
                        <div className="grid grid-cols-3 gap-2">
                          {openriceImages.map((imageUrl, idx) => (
                            <div
                              key={idx}
                              className="relative aspect-square rounded-lg overflow-hidden bg-slate-800 border border-slate-700 hover:border-orange-500 transition-colors group cursor-pointer"
                              onClick={() => window.open(imageUrl, "_blank")}
                            >
                              <img
                                src={imageUrl}
                                alt={`Photo ${idx + 1}`}
                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                                loading="lazy"
                                onError={(e) => {
                                  // Hide broken images
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                              {idx === 0 && (
                                <div className="absolute top-1 right-1">
                                  <Badge className="bg-orange-500 text-white text-[10px] px-1.5 py-0">
                                    Main
                                  </Badge>
                                </div>
                              )}
                              {/* Click indicator */}
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                                <ExternalLink className="w-5 h-5 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 text-center">
                          Tap images to view full size
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-3 rounded-xl bg-slate-800/50 text-center">
                    <div className="text-lg font-bold text-white">
                      {formatDistance(selectedRestaurant.distance_meters)}
                    </div>
                    <div className="text-xs text-slate-400">Distance</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/50 text-center">
                    <div
                      className={`text-lg font-bold ${getHealthScoreColor(
                        selectedRestaurant.health_tags.cuisine_health_score
                      )}`}
                    >
                      {selectedRestaurant.health_tags.cuisine_health_score}
                    </div>
                    <div className="text-xs text-slate-400">Health Score</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/50 text-center">
                    <div className="text-lg font-bold text-white">
                      {selectedRestaurant.price_level || "N/A"}
                    </div>
                    <div className="text-xs text-slate-400">Price</div>
                  </div>
                </div>

                {/* Health indicator */}
                <div
                  className={`p-3 rounded-xl border ${getHealthScoreBg(
                    selectedRestaurant.health_tags.cuisine_health_score
                  )}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Leaf
                        className={`w-4 h-4 ${getHealthScoreColor(
                          selectedRestaurant.health_tags.cuisine_health_score
                        )}`}
                      />
                      <span className="text-sm font-medium text-white">
                        {getHealthScoreLabel(selectedRestaurant.health_tags.cuisine_health_score)}
                      </span>
                    </div>
                    <span
                      className={`text-sm font-bold ${getHealthScoreColor(
                        selectedRestaurant.health_tags.cuisine_health_score
                      )}`}
                    >
                      {selectedRestaurant.health_tags.cuisine_health_score}/100
                    </span>
                  </div>
                  <Progress
                    value={selectedRestaurant.health_tags.cuisine_health_score}
                    className="h-2 bg-slate-700"
                  />
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-2">
                  {selectedRestaurant.cuisine_types.map((cuisine) => (
                    <Badge
                      key={cuisine}
                      variant="secondary"
                      className="bg-slate-800 text-slate-300 border-slate-700"
                    >
                      {getCuisineEmoji(cuisine)} {cuisine}
                    </Badge>
                  ))}
                  {selectedRestaurant.health_tags.has_vegetarian && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      🥬 Vegetarian
                    </Badge>
                  )}
                  {selectedRestaurant.health_tags.has_vegan && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      🌱 Vegan
                    </Badge>
                  )}
                  {selectedRestaurant.health_tags.has_healthy_options && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      💪 Healthy Options
                    </Badge>
                  )}
                </div>

                {/* Address */}
                <div className="p-3 rounded-xl bg-slate-800/50">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                    <div>
                      <p className="text-sm text-white">{selectedRestaurant.location.address_line1}</p>
                      {selectedRestaurant.location.address_line2 && (
                        <p className="text-sm text-slate-400">
                          {selectedRestaurant.location.address_line2}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Contact */}
                <div className="space-y-2">
                  {selectedRestaurant.contact.phone && (
                    <a
                      href={`tel:${selectedRestaurant.contact.phone}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
                    >
                      <Phone className="w-5 h-5 text-blue-400" />
                      <span className="text-sm text-white">{selectedRestaurant.contact.phone}</span>
                      <ExternalLink className="w-4 h-4 text-slate-500 ml-auto" />
                    </a>
                  )}
                  {selectedRestaurant.contact.website && (
                    <a
                      href={selectedRestaurant.contact.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 transition-colors"
                    >
                      <Globe className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-white truncate">
                        {selectedRestaurant.contact.website}
                      </span>
                      <ExternalLink className="w-4 h-4 text-slate-500 ml-auto flex-shrink-0" />
                    </a>
                  )}
                </div>

                {/* Delivery & External Links */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Order & Explore</p>
                  
                  {/* OpenRice - Hong Kong only */}
                  {region === "hk" && (
                    <a
                      href={getDeliveryLinks(selectedRestaurant, region).openrice}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-lg">
                        🍽️
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white">OpenRice</span>
                        <p className="text-xs text-slate-400">Reviews & Photos</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-orange-400" />
                    </a>
                  )}
                  
                  {/* Keeta - Hong Kong only */}
                  {region === "hk" && (
                    <a
                      href={getDeliveryLinks(selectedRestaurant, region).keeta}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                        <Bike className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white">Keeta</span>
                        <p className="text-xs text-slate-400">Food Delivery</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-green-400" />
                    </a>
                  )}
                  
                  {/* GrabFood - Malaysia only */}
                  {region === "my" && (
                    <a
                      href={getDeliveryLinks(selectedRestaurant, region).grab}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
                        <Bike className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex-1">
                        <span className="text-sm font-medium text-white">GrabFood</span>
                        <p className="text-xs text-slate-400">Food Delivery</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-green-400" />
                    </a>
                  )}
                  
                  {/* Foodpanda - Both regions */}
                  <a
                    href={getDeliveryLinks(selectedRestaurant, region).foodpanda}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 border border-pink-500/20 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-pink-500 flex items-center justify-center text-lg">
                      🐼
                    </div>
                    <div className="flex-1">
                      <span className="text-sm font-medium text-white">Foodpanda</span>
                      <p className="text-xs text-slate-400">Food Delivery</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-pink-400" />
                  </a>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600"
                    onClick={() => {
                      window.open(
                        `https://www.google.com/maps/dir/?api=1&destination=${selectedRestaurant.location.latitude},${selectedRestaurant.location.longitude}`,
                        "_blank"
                      );
                    }}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Get Directions
                  </Button>
                  <Button
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                    onClick={() => setSelectedRestaurant(null)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Location Permission Dialog */}
      <Dialog open={showPermissionDialog} onOpenChange={setShowPermissionDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm mx-4">
          <DialogHeader>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-blue-400" />
            </div>
            <DialogTitle className="text-center">Enable Location</DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              We need your location to find nearby restaurants and show you the best healthy dining
              options in your area.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button
              onClick={handleGetLocation}
              className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-600 hover:to-rose-600"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Enable Location
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowPermissionDialog(false);
                setShowLocationDialog(true);
              }}
              className="text-slate-400 hover:text-white"
            >
              Enter Location Manually
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Location Input Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md mx-4 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500/20 to-rose-500/20 border border-orange-500/30 flex items-center justify-center mx-auto mb-4">
              <MapPinned className="w-8 h-8 text-orange-400" />
            </div>
            <DialogTitle className="text-center">Set Location</DialogTitle>
            <DialogDescription className="text-center text-slate-400">
              Enter an address or select a popular location in {regionConfig.flag} {regionConfig.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* Region Selector */}
            <div className="flex gap-2">
              <Button
                variant={region === "hk" ? "default" : "outline"}
                className={`flex-1 ${region === "hk" ? "bg-gradient-to-r from-orange-500 to-rose-500" : "border-slate-600 text-slate-300"}`}
                onClick={() => setRegion("hk")}
              >
                🇭🇰 Hong Kong
              </Button>
              <Button
                variant={region === "my" ? "default" : "outline"}
                className={`flex-1 ${region === "my" ? "bg-gradient-to-r from-orange-500 to-rose-500" : "border-slate-600 text-slate-300"}`}
                onClick={() => setRegion("my")}
              >
                🇲🇾 Malaysia
              </Button>
            </div>

            {/* Manual Address Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Enter Address</label>
              <div className="flex gap-2">
                <Input
                  placeholder={`e.g. ${region === "hk" ? "Kwun Tong, Hong Kong" : "Bukit Bintang, KL"}`}
                  value={manualLocationInput}
                  onChange={(e) => setManualLocationInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleManualLocationSearch()}
                  className="flex-1 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
                <Button
                  onClick={handleManualLocationSearch}
                  disabled={geocoding || !manualLocationInput.trim()}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {geocoding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Popular Locations */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-400">Popular Locations</label>
              <div className="grid grid-cols-2 gap-2">
                {popularLocations.map((loc) => (
                  <Button
                    key={loc.name}
                    variant="outline"
                    size="sm"
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white justify-start"
                    onClick={() => handleQuickLocation(loc)}
                  >
                    <MapPin className="w-3 h-3 mr-1.5 text-orange-400" />
                    {loc.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Use GPS Button */}
            <div className="pt-2 border-t border-slate-700">
              <Button
                variant="outline"
                className="w-full border-blue-500/50 text-blue-400 hover:bg-blue-500/10"
                onClick={handleUseGPS}
              >
                <Navigation className="w-4 h-4 mr-2" />
                Use GPS Location Instead
              </Button>
            </div>

            {/* Available Services Info */}
            <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Available in {regionConfig.name}
              </p>
              <div className="flex flex-wrap gap-2">
                {getAvailableServices(region).map((service) => (
                  <Badge
                    key={service.key}
                    className={`${service.color} text-white text-xs`}
                  >
                    {service.icon} {service.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNav />
    </div>
  );
};

// Restaurant Card Component
function RestaurantCard({
  restaurant,
  index,
  isFavorite,
  onToggleFavorite,
  onSelect,
}: {
  restaurant: Restaurant;
  index: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onSelect: () => void;
}) {
  const healthScore = restaurant.health_tags.cuisine_health_score;

  return (
    <Card
      className="p-4 bg-slate-800/50 border-slate-700/50 hover:bg-slate-800/70 transition-all cursor-pointer group"
      onClick={onSelect}
    >
      <div className="flex gap-3">
        {/* Rank & Emoji */}
        <div className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-rose-500/20 border border-orange-500/30 flex items-center justify-center text-xl">
            {getCuisineEmoji(restaurant.cuisine_types[0] || "general")}
          </div>
          <span className="text-xs text-slate-500 font-medium">#{index}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-white truncate group-hover:text-orange-400 transition-colors">
                {restaurant.name}
              </h3>
              <p className="text-sm text-slate-400 truncate">
                {restaurant.cuisine_types.slice(0, 2).join(", ")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite();
              }}
            >
              <Heart
                className={`w-5 h-5 transition-colors ${
                  isFavorite ? "fill-red-500 text-red-500" : "text-slate-500 hover:text-red-400"
                }`}
              />
            </Button>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2 text-sm">
            <span className="flex items-center gap-1 text-slate-400">
              <MapPin className="w-3 h-3" />
              {formatDistance(restaurant.distance_meters)}
            </span>
            {restaurant.rating && (
              <span className="flex items-center gap-1 text-amber-400">
                <Star className="w-3 h-3 fill-amber-400" />
                {restaurant.rating}
              </span>
            )}
            {restaurant.price_level && (
              <span className="text-slate-400">{restaurant.price_level}</span>
            )}
          </div>

          {/* Health score bar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  healthScore >= 75
                    ? "bg-gradient-to-r from-green-500 to-emerald-500"
                    : healthScore >= 50
                    ? "bg-gradient-to-r from-amber-500 to-orange-500"
                    : "bg-gradient-to-r from-red-500 to-rose-500"
                }`}
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <span
              className={`text-xs font-medium ${getHealthScoreColor(healthScore)}`}
            >
              {healthScore}
            </span>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {restaurant.health_tags.has_vegetarian && (
              <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs px-2 py-0">
                🥬 Vegetarian
              </Badge>
            )}
            {restaurant.health_tags.has_vegan && (
              <Badge className="bg-green-500/10 text-green-400 border-green-500/20 text-xs px-2 py-0">
                🌱 Vegan
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export default Restaurants;
