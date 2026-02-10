import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const NotificationBridge = () => {
  const navigate = useNavigate();
  const isNative = typeof Capacitor !== "undefined" && (Capacitor.isNativePlatform?.() ?? false);

  useEffect(() => {
    if (!isNative) return;

    let receivedHandle: { remove: () => void } | undefined;
    let actionHandle: { remove: () => void } | undefined;

    LocalNotifications.addListener("localNotificationReceived", (notification) => {
      if (notification.extra?.source === "simulated-eating-gesture") {
        navigate("/camera", { state: { autoCaptureToken: Date.now() } });
      }
    }).then((handle) => {
      receivedHandle = handle;
    });

    LocalNotifications.addListener("localNotificationActionPerformed", (event) => {
      if (event.notification?.extra?.source === "simulated-eating-gesture") {
        navigate("/camera", { state: { autoCaptureToken: Date.now() } });
      }
    }).then((handle) => {
      actionHandle = handle;
    });

    return () => {
      receivedHandle?.remove();
      actionHandle?.remove();
    };
  }, [isNative, navigate]);

  useEffect(() => {
    if (isNative || typeof window === "undefined") return;
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      if (customEvent.detail === "simulated-eating-gesture") {
        navigate("/camera", { state: { autoCaptureToken: Date.now() } });
      }
    };
    window.addEventListener("meal-reminder", handler as EventListener);
    return () => window.removeEventListener("meal-reminder", handler as EventListener);
  }, [isNative, navigate]);

  return null;
};

export default NotificationBridge;

