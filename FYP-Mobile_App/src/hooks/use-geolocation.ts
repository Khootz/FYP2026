import { useState, useCallback, useEffect } from "react";
import { Geolocation, Position } from "@capacitor/geolocation";

export interface GeolocationState {
  position: Position | null;
  error: string | null;
  loading: boolean;
  permissionStatus: "granted" | "denied" | "prompt" | "unknown";
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    position: null,
    error: null,
    loading: false,
    permissionStatus: "unknown",
  });

  // Check permission status
  const checkPermission = useCallback(async () => {
    try {
      const status = await Geolocation.checkPermissions();
      setState((prev) => ({
        ...prev,
        permissionStatus: status.location as GeolocationState["permissionStatus"],
      }));
      return status.location;
    } catch (err) {
      // Fallback for web browser
      if ("permissions" in navigator) {
        try {
          const result = await navigator.permissions.query({ name: "geolocation" });
          const webStatus = result.state as GeolocationState["permissionStatus"];
          setState((prev) => ({ ...prev, permissionStatus: webStatus }));
          return webStatus;
        } catch {
          return "unknown";
        }
      }
      return "unknown";
    }
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    try {
      const status = await Geolocation.requestPermissions();
      setState((prev) => ({
        ...prev,
        permissionStatus: status.location as GeolocationState["permissionStatus"],
      }));
      return status.location === "granted";
    } catch (err) {
      // For web, requesting permissions happens when we try to get position
      return true;
    }
  }, []);

  // Get current position
  const getCurrentPosition = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // First check/request permission
      let permission = await checkPermission();
      
      if (permission === "denied") {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: "Location permission denied. Please enable location access in your device settings.",
          permissionStatus: "denied",
        }));
        return null;
      }

      if (permission === "prompt" || permission === "unknown") {
        await requestPermission();
      }

      // Try Capacitor Geolocation first
      try {
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // Cache for 1 minute
        });

        setState((prev) => ({
          ...prev,
          position,
          loading: false,
          error: null,
          permissionStatus: "granted",
        }));

        return position;
      } catch (capacitorError) {
        // Fallback to browser geolocation API
        return new Promise<Position | null>((resolve) => {
          if (!navigator.geolocation) {
            setState((prev) => ({
              ...prev,
              loading: false,
              error: "Geolocation is not supported by your browser",
            }));
            resolve(null);
            return;
          }

          navigator.geolocation.getCurrentPosition(
            (geoPosition) => {
              const position: Position = {
                timestamp: geoPosition.timestamp,
                coords: {
                  latitude: geoPosition.coords.latitude,
                  longitude: geoPosition.coords.longitude,
                  accuracy: geoPosition.coords.accuracy,
                  altitude: geoPosition.coords.altitude,
                  altitudeAccuracy: geoPosition.coords.altitudeAccuracy,
                  heading: geoPosition.coords.heading,
                  speed: geoPosition.coords.speed,
                },
              };

              setState((prev) => ({
                ...prev,
                position,
                loading: false,
                error: null,
                permissionStatus: "granted",
              }));

              resolve(position);
            },
            (error) => {
              let errorMessage = "Failed to get location";
              
              switch (error.code) {
                case error.PERMISSION_DENIED:
                  errorMessage = "Location permission denied. Please enable location access.";
                  setState((prev) => ({ ...prev, permissionStatus: "denied" }));
                  break;
                case error.POSITION_UNAVAILABLE:
                  errorMessage = "Location information is unavailable.";
                  break;
                case error.TIMEOUT:
                  errorMessage = "Location request timed out. Please try again.";
                  break;
              }

              setState((prev) => ({
                ...prev,
                loading: false,
                error: errorMessage,
              }));

              resolve(null);
            },
            {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 60000,
            }
          );
        });
      }
    } catch (err: any) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: err.message || "Failed to get location",
      }));
      return null;
    }
  }, [checkPermission, requestPermission]);

  // Watch position (for live tracking if needed)
  const watchPosition = useCallback(
    (callback: (position: Position) => void) => {
      let watchId: string | null = null;

      const startWatch = async () => {
        try {
          watchId = await Geolocation.watchPosition(
            { enableHighAccuracy: true },
            (position, err) => {
              if (err) {
                setState((prev) => ({ ...prev, error: err.message }));
                return;
              }
              if (position) {
                setState((prev) => ({ ...prev, position, error: null }));
                callback(position);
              }
            }
          );
        } catch {
          // Fallback to browser API
          if (navigator.geolocation) {
            const id = navigator.geolocation.watchPosition(
              (geoPosition) => {
                const position: Position = {
                  timestamp: geoPosition.timestamp,
                  coords: {
                    latitude: geoPosition.coords.latitude,
                    longitude: geoPosition.coords.longitude,
                    accuracy: geoPosition.coords.accuracy,
                    altitude: geoPosition.coords.altitude,
                    altitudeAccuracy: geoPosition.coords.altitudeAccuracy,
                    heading: geoPosition.coords.heading,
                    speed: geoPosition.coords.speed,
                  },
                };
                setState((prev) => ({ ...prev, position, error: null }));
                callback(position);
              },
              (error) => {
                setState((prev) => ({ ...prev, error: error.message }));
              }
            );
            watchId = id.toString();
          }
        }
      };

      startWatch();

      return () => {
        if (watchId) {
          Geolocation.clearWatch({ id: watchId }).catch(() => {
            // For browser API
            navigator.geolocation?.clearWatch(parseInt(watchId!, 10));
          });
        }
      };
    },
    []
  );

  // Check permission on mount
  useEffect(() => {
    checkPermission();
  }, [checkPermission]);

  return {
    ...state,
    getCurrentPosition,
    watchPosition,
    requestPermission,
    checkPermission,
  };
}
