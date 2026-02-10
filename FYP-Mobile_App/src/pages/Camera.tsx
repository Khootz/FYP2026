import { Camera as CameraIcon, Upload, Info, Loader2, X, Download, BellRing } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Camera as CapacitorCamera, CameraResultType, CameraSource } from "@capacitor/camera";
import { LocalNotifications } from "@capacitor/local-notifications";
import { MealsStore } from "@/lib/meals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { BottomNav } from "@/components/BottomNav";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useLocation, useNavigate } from "react-router-dom";

type CapturedPhoto = {
  url: string;
  fileName: string;
  blob: Blob;
  source: "camera" | "upload";
  capturedAt: number;
  title?: string;
};

type NotificationStatus =
  | NotificationPermission
  | "native-granted"
  | "native-denied"
  | "native-prompt"
  | "unsupported"
  | "checking";

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes)) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not render preview"));
    reader.readAsDataURL(blob);
  });

const Camera = () => {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<CapturedPhoto | null>(null);
  const [notificationStatus, setNotificationStatus] = useState<NotificationStatus>("checking");
  const [pendingMeal, setPendingMeal] = useState<{ file: Blob | File; source: "camera" | "upload"; fileName: string } | null>(null);
  const [mealTitle, setMealTitle] = useState("");
  const [isNamingDialogOpen, setIsNamingDialogOpen] = useState(false);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const photoUrlRef = useRef<string | null>(null);
  const autoCaptureHandledRef = useRef<number | null>(null);
  const handleCaptureRef = useRef<() => Promise<void>>();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const autoCaptureToken =
    ((location.state as { autoCaptureToken?: number } | null)?.autoCaptureToken ?? null);
  const canUseCamera =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function";
  const isNativePlatform = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return Capacitor.isNativePlatform?.() ?? false;
  }, []);
  const browserNotificationSupported =
    typeof window !== "undefined" && "Notification" in window;
  const cameraSupported = isNativePlatform || canUseCamera;
  const notificationsAvailable = isNativePlatform || browserNotificationSupported;
  const preferredConstraints = useMemo<MediaStreamConstraints>(
    () => ({
      video: {
        facingMode: { ideal: "environment" },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    }),
    [],
  );

  useEffect(() => {
    return () => {
      if (photoUrlRef.current) {
        URL.revokeObjectURL(photoUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateStatus = async () => {
      if (isNativePlatform) {
        try {
          const { display } = await LocalNotifications.checkPermissions();
          if (cancelled) return;
          if (display === "granted") {
            setNotificationStatus("native-granted");
          } else if (display === "denied") {
            setNotificationStatus("native-denied");
          } else {
            setNotificationStatus("native-prompt");
          }
        } catch {
          if (!cancelled) {
            setNotificationStatus("native-denied");
          }
        }
        return;
      }

      if (browserNotificationSupported) {
        setNotificationStatus(Notification.permission);
      } else {
        setNotificationStatus("unsupported");
      }
    };

    void hydrateStatus();

    return () => {
      cancelled = true;
    };
  }, [browserNotificationSupported, isNativePlatform]);

  const updateCapturedPhoto = useCallback((nextPhoto: CapturedPhoto | null) => {
    if (photoUrlRef.current && photoUrlRef.current !== nextPhoto?.url) {
      URL.revokeObjectURL(photoUrlRef.current);
    }
    photoUrlRef.current = nextPhoto?.url ?? null;
    setCapturedPhoto(nextPhoto);
  }, []);

  const requestCameraStream = useCallback(async () => {
    try {
      return await navigator.mediaDevices.getUserMedia(preferredConstraints);
    } catch (error) {
      if (error instanceof DOMException && error.name === "OverconstrainedError") {
        console.warn("Preferred camera constraints not available, falling back to default camera.");
        return navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      throw error;
    }
  }, [preferredConstraints]);

  const waitForVideoReady = useCallback(async (video: HTMLVideoElement) => {
    if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      let settled = false;

      const cleanup = () => {
        settled = true;
        window.clearTimeout(timeoutId);
        video.removeEventListener("loadedmetadata", onReady);
        video.removeEventListener("loadeddata", onReady);
        video.removeEventListener("error", onError);
      };

      const onReady = () => {
        if (!settled) {
          cleanup();
          resolve();
        }
      };

      const onError = () => {
        if (!settled) {
          cleanup();
          reject(new Error("Camera feed error"));
        }
      };

      const timeoutId = window.setTimeout(() => {
        if (!settled) {
          cleanup();
          reject(new Error("Camera feed timeout"));
        }
      }, 5000);

      video.addEventListener("loadedmetadata", onReady);
      video.addEventListener("loadeddata", onReady);
      video.addEventListener("error", onError);
    });
  }, []);

  const canvasToFile = useCallback((canvas: HTMLCanvasElement) => {
    return new Promise<File>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error("Camera capture failed"));
            return;
          }
          const file = new File([blob], `capture-${Date.now()}.jpg`, {
            type: blob.type || "image/jpeg",
          });
          resolve(file);
        },
        "image/jpeg",
        0.9,
      );
    });
  }, []);

const saveMealRecord = useCallback(
  async (file: Blob | File, source: "camera" | "upload", fileName: string, title: string) => {
      try {
        const previewDataUrl = await blobToDataUrl(file);
        MealsStore.add({
          previewDataUrl,
          capturedAt: Date.now(),
          source,
          fileName,
        fileSize: file.size ?? 0,
        title: title || fileName,
        });
      } catch (error) {
        console.error("Failed to save meal entry:", error);
      }
    },
    [],
  );

  const openNamingDialog = useCallback(
    (file: Blob | File, source: "camera" | "upload", suggestedName?: string) => {
      const fileName =
        suggestedName ??
        (file instanceof File && file.name ? file.name : `photo-${Date.now()}.jpg`);
      const url = URL.createObjectURL(file);
      const now = new Date();
      updateCapturedPhoto({
        url,
        fileName,
        blob: file,
        source,
        capturedAt: now.getTime(),
      });
      setPendingMeal({ file, source, fileName });
      setMealTitle(`Meal at ${now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`);
      setIsNamingDialogOpen(true);
    },
    [updateCapturedPhoto],
  );

  const captureWithNativeCamera = useCallback(async () => {
    try {
      const existingPermissions = await CapacitorCamera.checkPermissions();
      let cameraPermission = existingPermissions.camera;
      if (cameraPermission !== "granted") {
        const requested = await CapacitorCamera.requestPermissions({ permissions: ["camera", "photos"] });
        cameraPermission = requested.camera;
      }

      if (cameraPermission !== "granted") {
        toast({
          variant: "destructive",
          title: "Camera permission blocked",
          description: "Enable camera access in Settings to capture meals.",
        });
        return;
      }

      const photo = await CapacitorCamera.getPhoto({
        source: CameraSource.Camera,
        resultType: CameraResultType.Uri,
        quality: 85,
        allowEditing: false,
        saveToGallery: false,
      });

      let blob: Blob | null = null;
      if (photo.webPath) {
        const response = await fetch(photo.webPath);
        blob = await response.blob();
      } else if (photo.base64String) {
        const byteCharacters = atob(photo.base64String);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i += 1) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        blob = new Blob([new Uint8Array(byteNumbers)], {
          type: photo.format ? `image/${photo.format}` : "image/jpeg",
        });
      }

      if (!blob) {
        throw new Error("No image data returned");
      }

      openNamingDialog(blob, "camera");
      toast({
        title: "Photo captured",
        description: "Give it a name before saving.",
      });
    } catch (error) {
      console.error("Native capture error:", error);
      toast({
        variant: "destructive",
        title: "Camera unavailable",
        description:
          error instanceof Error
            ? error.message
            : "We could not open the native camera. Please try again.",
      });
    }
  }, [openNamingDialog, toast]);

  const requestNotificationPermission = useCallback(async (): Promise<NotificationStatus> => {
    if (isNativePlatform) {
      try {
        let { display } = await LocalNotifications.checkPermissions();
        if (display === "prompt") {
          ({ display } = await LocalNotifications.requestPermissions());
        }

        const status: NotificationStatus =
          display === "granted"
            ? "native-granted"
            : display === "denied"
              ? "native-denied"
              : "native-prompt";

        setNotificationStatus(status);
        return status;
      } catch (error) {
        console.error("Notification permission error:", error);
        setNotificationStatus("native-denied");
        toast({
          variant: "destructive",
          title: "Notification request failed",
          description: "Please enable notifications from iOS settings.",
        });
        return "native-denied";
      }
    }

    if (!browserNotificationSupported) {
      toast({
        variant: "destructive",
        title: "Notifications unsupported",
        description: "This browser does not expose the Notification API.",
      });
      setNotificationStatus("unsupported");
      return "unsupported";
    }

    if (Notification.permission !== "default") {
      setNotificationStatus(Notification.permission);
      return Notification.permission;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationStatus(permission);
      return permission;
    } catch (error) {
      console.error("Notification permission error:", error);
      toast({
        variant: "destructive",
        title: "Notification request failed",
        description: "Please enable notifications from your browser settings.",
      });
      setNotificationStatus("denied");
      return "denied";
    }
  }, [browserNotificationSupported, isNativePlatform, toast]);

  const triggerTestNotification = useCallback(async () => {
    const permission = await requestNotificationPermission();
    const granted =
      (isNativePlatform && permission === "native-granted") ||
      (!isNativePlatform && permission === "granted");

    if (!granted) {
      toast({
        variant: "destructive",
        title: "Notifications blocked",
        description: "Allow notifications to receive automatic meal reminders.",
      });
      return;
    }

    const title = "Eating motion detected";
    const body = "Open NutriTrack now to snap your meal.";
    try {
      if (isNativePlatform) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: Date.now(),
              title,
              body,
              schedule: { allowWhileIdle: true },
              extra: { source: "simulated-eating-gesture" },
            },
          ],
        });
      } else if ("serviceWorker" in navigator) {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          await registration.showNotification(title, {
            body,
            icon: "/icons/icon-192.png",
            tag: "meal-reminder",
          });
        } else {
          new Notification(title, { body });
        }
      } else {
        new Notification(title, { body });
      }

      if (!isNativePlatform && typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("meal-reminder", { detail: "simulated-eating-gesture" }),
        );
      }

      toast({
        title: "Reminder sent",
        description: "Check your notification tray.",
      });
    } catch (error) {
      console.error("Notification trigger error:", error);
      toast({
        variant: "destructive",
        title: "Unable to send notification",
        description: "Your device blocked the reminder.",
      });
    }
  }, [browserNotificationSupported, isNativePlatform, requestNotificationPermission, toast]);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    if (!canUseCamera) {
      toast({
        variant: "destructive",
        title: "Camera not supported",
        description: "Your browser does not expose a camera API. Use the upload option instead.",
      });
      return;
    }

    let mediaStream: MediaStream | null = null;

    try {
      setIsCameraLoading(true);
      mediaStream = await requestCameraStream();
      let videoElement = videoRef.current;

      if (!videoElement) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        videoElement = videoRef.current;
      }

      if (!videoElement) {
        mediaStream.getTracks().forEach((track) => track.stop());
        throw new Error("Camera preview missing");
      }

      videoElement.srcObject = mediaStream;
      await waitForVideoReady(videoElement);
      await videoElement.play().catch(() => null);

      streamRef.current = mediaStream;
      mediaStream = null;
      setIsCameraActive(true);
      toast({
        title: "Camera ready",
        description: "Adjust your frame, then tap capture when ready.",
      });
    } catch (error) {
      console.error("Camera permission error:", error);
      mediaStream?.getTracks().forEach((track) => track.stop());
      let description = "We could not access your camera. Please allow camera permissions.";
      if (error instanceof DOMException) {
        if (error.name === "NotAllowedError") {
          description = "Camera permission was denied. Enable it in your browser settings.";
        } else if (error.name === "NotFoundError") {
          description = "No camera was detected. Try another device or use the upload option.";
        }
      } else if (error instanceof Error) {
        if (error.message === "Camera preview missing") {
          description = "We could not attach the stream to the preview element.";
        } else if (error.message === "Camera feed timeout") {
          description = "The feed took too long to start. Close other apps using the webcam and try again.";
        } else if (error.message === "Camera feed error") {
          description = "Another application may already be using the camera.";
        }
      }

      toast({
        variant: "destructive",
        title: "Camera unavailable",
        description,
      });
    } finally {
      setIsCameraLoading(false);
    }
  };

  const handleCapture = async () => {
    if (isNativePlatform) {
      await captureWithNativeCamera();
      return;
    }

    if (!isCameraActive) {
      await startCamera();
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      toast({
        variant: "destructive",
        title: "Camera not ready",
        description: "Give the camera a moment to initialize before capturing.",
      });
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const context = canvas.getContext("2d");
    if (!context) {
      toast({
        variant: "destructive",
        title: "Capture failed",
        description: "Your browser blocked the canvas context needed for capturing.",
      });
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const file = await canvasToFile(canvas);
      openNamingDialog(file, "camera", file.name);
      stopCamera();
      toast({
        title: "Photo captured",
        description: "Give it a name before saving.",
      });
    } catch (error) {
      console.error("Photo capture error:", error);
      toast({
        variant: "destructive",
        title: "Capture failed",
        description:
          error instanceof Error ? error.message : "We could not save the captured image.",
      });
    }
  };

  const notificationStatusLabel = useMemo(() => {
    switch (notificationStatus) {
      case "native-granted":
      case "granted":
        return "granted";
      case "native-denied":
      case "denied":
        return "denied";
      case "native-prompt":
      case "default":
        return "needs permission";
      case "unsupported":
        return "not supported";
      case "checking":
      default:
        return "checking...";
    }
  }, [notificationStatus]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    stopCamera();
    openNamingDialog(file, "upload", file.name);
    toast({
      title: "Image selected",
      description: "Name it to store in your history.",
    });
    e.target.value = "";
  };

  const handleRetake = async () => {
    updateCapturedPhoto(null);
    if (isNativePlatform) {
      await captureWithNativeCamera();
      return;
    }
    await startCamera();
  };

  const handleSavePhoto = () => {
    if (!capturedPhoto) {
      toast({
        title: "No photo available",
        description: "Capture or upload a photo before saving.",
      });
      return;
    }

    const link = document.createElement("a");
    link.href = capturedPhoto.url;
    link.download = capturedPhoto.fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({
      title: "Photo saved",
      description: `Saved as ${capturedPhoto.fileName}`,
    });
  };

  const finalizeMealSave = async () => {
    if (!pendingMeal) {
      setIsNamingDialogOpen(false);
      return;
    }
    try {
      setIsSavingMeal(true);
      await saveMealRecord(
        pendingMeal.file,
        pendingMeal.source,
        pendingMeal.fileName,
        mealTitle.trim() || pendingMeal.fileName,
      );
      toast({
        title: "Meal saved",
        description: "You can review it anytime from the Dashboard.",
      });
      setPendingMeal(null);
      setIsNamingDialogOpen(false);
    } catch (error) {
      console.error("Failed to save meal:", error);
      toast({
        variant: "destructive",
        title: "Save failed",
        description: "We could not store this meal. Please try again.",
      });
    } finally {
      setIsSavingMeal(false);
    }
  };

  const cancelMealSave = () => {
    setIsNamingDialogOpen(false);
    setPendingMeal(null);
  };

  useEffect(() => {
    handleCaptureRef.current = () => handleCapture();
  });

  useEffect(() => {
    if (!autoCaptureToken) {
      return;
    }
    if (autoCaptureHandledRef.current === autoCaptureToken) {
      return;
    }
    autoCaptureHandledRef.current = autoCaptureToken;
    navigate(".", { replace: true, state: {} });
    if (handleCaptureRef.current) {
      void handleCaptureRef.current();
    }
  }, [autoCaptureToken, navigate]);

  return (
    <div className="min-h-screen bg-background page-content">
      <header className="bg-gradient-to-br from-primary to-primary-dark text-primary-foreground p-6">
        <div className="max-w-lg mx-auto">
          <h1 className="text-2xl font-bold">Scan Your Meal</h1>
          <p className="text-sm opacity-90">Capture or upload food images</p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Info Card */}
        <Card className="p-4 bg-gradient-to-br from-secondary/10 to-primary/10 border-secondary/20">
          <div className="flex gap-3">
            <Info className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold mb-1 text-secondary">How it works</h3>
              <p className="text-sm text-muted-foreground">
                Capture or upload a meal, preview it instantly, then save it locally or retake it. Photos stay
                on your device for full privacy.
              </p>
            </div>
          </div>
        </Card>

        {/* Notification Tester */}
        <Card className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <BellRing className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold mb-1">Simulate wearable detection</h3>
              <p className="text-sm text-muted-foreground">
                Trigger the same notification your smartwatch will send once the eating-motion classifier fires.
                Use this to demo the “BeReal”-style prompt workflow.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-muted-foreground">
              Status:{" "}
              <span className="font-medium">{notificationStatusLabel}</span>
            </p>
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={triggerTestNotification}
              disabled={!notificationsAvailable}
            >
              <BellRing className="w-4 h-4 mr-2" />
              Simulate eating gesture
            </Button>
          </div>
          {!notificationsAvailable && (
            <p className="text-xs text-muted-foreground">
              Notifications require a browser with Notification API support (Chrome, Edge, Safari 16+).
            </p>
          )}
        </Card>

        {/* Camera Preview Area */}
        <Card className="p-6">
          <div className="aspect-square bg-muted rounded-xl flex items-center justify-center mb-4 overflow-hidden relative">
            <video
              ref={videoRef}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
                isCameraActive ? "opacity-100" : "opacity-0"
              }`}
              autoPlay
              playsInline
              muted
            />
            {capturedPhoto && (
              <img
                src={capturedPhoto.url}
                alt="Preview"
                className={`w-full h-full object-cover transition-opacity duration-200 ${
                  isCameraActive ? "opacity-0" : "opacity-100"
                }`}
              />
            )}
            {!capturedPhoto && !isCameraActive && (
              <div className="text-center">
                <CameraIcon className="w-16 h-16 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">
                  No image selected
                </p>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" aria-hidden />
          </div>

          <div className="space-y-3">
            {(!capturedPhoto || isCameraActive) && (
              <Button
                className="w-full h-12"
                size="lg"
                onClick={handleCapture}
                disabled={isCameraLoading || !cameraSupported}
              >
                {isCameraLoading ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <CameraIcon className="w-5 h-5 mr-2" />
                )}
                {isCameraActive ? "Capture Photo" : isCameraLoading ? "Opening Camera..." : "Take Photo"}
              </Button>
            )}
            {isCameraActive && (
              <Button
                className="w-full h-12"
                size="lg"
                variant="secondary"
                onClick={stopCamera}
              >
                <X className="w-5 h-5 mr-2" />
                Close Camera
              </Button>
            )}

            {capturedPhoto && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Button
                  className="h-12"
                  variant="outline"
                  onClick={() => {
                    void handleRetake();
                  }}
                  disabled={isCameraLoading || !cameraSupported}
                >
                  Retake Photo
                </Button>
                <Button className="h-12" onClick={handleSavePhoto}>
                  <Download className="w-5 h-5 mr-2" />
                  Save Photo
                </Button>
              </div>
            )}

            <label htmlFor="upload-input">
              <Button
                className="w-full h-12"
                size="lg"
                variant="outline"
                asChild
              >
                <span>
                  <Upload className="w-5 h-5 mr-2" />
                  Upload from Gallery
                </span>
              </Button>
            </label>
            <input
              id="upload-input"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleUpload}
            />
            {!cameraSupported && !isNativePlatform && (
              <p className="text-xs text-muted-foreground">
                This browser does not support direct camera access. Please use the upload option above.
              </p>
            )}
          </div>
        </Card>

        {/* Tips */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4 text-center">
            <div className="text-3xl mb-2">🔁</div>
            <h3 className="font-medium text-sm mb-1">Retake anytime</h3>
            <p className="text-xs text-muted-foreground">Tap retake to reopen the camera instantly.</p>
          </Card>
          <Card className="p-4 text-center">
            <div className="text-3xl mb-2">💾</div>
            <h3 className="font-medium text-sm mb-1">Save offline</h3>
            <p className="text-xs text-muted-foreground">Downloads stay local to your device.</p>
          </Card>
        </div>

        {/* Photo details */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Photo details</h3>
          {capturedPhoto ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">File name</span>
                <span className="font-medium truncate max-w-[55%] text-right">{capturedPhoto.fileName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size</span>
                <span className="font-medium">{formatBytes(capturedPhoto.blob.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="font-medium capitalize">{capturedPhoto.source}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Captured</span>
                <span className="font-medium">
                  {new Date(capturedPhoto.capturedAt).toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Take or upload a picture to see file details and enable local saving.
            </p>
          )}
        </Card>
      </main>

      <BottomNav />
      <Dialog open={isNamingDialogOpen} onOpenChange={(open) => (!open ? cancelMealSave() : null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Name your meal</DialogTitle>
            <DialogDescription>
              Give this capture a short label to make it easier to find later.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={mealTitle}
            onChange={(e) => setMealTitle(e.target.value)}
            placeholder="e.g. Lunch with pasta"
          />
          <DialogFooter className="flex flex-col sm:flex-row sm:justify-end gap-2">
            <Button variant="outline" onClick={cancelMealSave} type="button">
              Cancel
            </Button>
            <Button onClick={finalizeMealSave} disabled={isSavingMeal}>
              {isSavingMeal ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save meal"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Camera;
