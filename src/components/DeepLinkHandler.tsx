import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/**
 * DeepLinkHandler
 *
 * Routes incoming links to the correct screen when the app is opened from:
 *  1. A tapped push notification (payload.data.route)
 *  2. A Universal Link / App Link / custom scheme (Capacitor App.appUrlOpen)
 *
 * Payload convention (set by the edge function that sends pushes):
 *   {
 *     notification: { title, body },
 *     data: { route: "/submissions/<paperId>", kind: "approval" | "rejection" | "deadline" | "unlock" }
 *   }
 *
 * Universal link convention:
 *   https://confidential-exam.lovable.app/submissions/<id>  -> /submissions/<id>
 *   app.lovable.6fa5125c...://review/<id>                   -> /review/<id>
 */
export function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    let appCleanup: (() => void) | undefined;
    let pushCleanup: (() => void) | undefined;

    const isNative =
      typeof window !== "undefined" &&
      // @ts-ignore - injected by Capacitor at runtime
      !!window.Capacitor?.isNativePlatform?.();

    if (!isNative) return;

    (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appUrlOpen", (event) => {
          try {
            const url = new URL(event.url);
            // For both https://host/path and scheme://path, use pathname (+ search/hash)
            const path = `${url.pathname || "/"}${url.search || ""}${url.hash || ""}`;
            if (path && path !== window.location.pathname) {
              navigate(path);
            }
          } catch {
            // Ignore malformed URLs
          }
        });
        appCleanup = () => handle.remove();
      } catch (e) {
        console.warn("[DeepLink] @capacitor/app unavailable:", e);
      }

      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const handle = await PushNotifications.addListener(
          "pushNotificationActionPerformed",
          (action) => {
            const route = (action.notification?.data as Record<string, string> | undefined)?.route;
            if (route && route.startsWith("/")) {
              navigate(route);
            }
          },
        );
        pushCleanup = () => handle.remove();
      } catch (e) {
        console.warn("[DeepLink] @capacitor/push-notifications unavailable:", e);
      }
    })();

    return () => {
      appCleanup?.();
      pushCleanup?.();
    };
  }, [navigate]);

  return null;
}
