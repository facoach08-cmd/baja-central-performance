"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LiveDashboardRefresh() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => window.location.reload(), 1200);
    };

    const channel = supabase
      .channel("baja-central-dashboard-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "baja_central_clients" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "baja_central_data_sources" },
        scheduleRefresh,
      )
      .subscribe();

    const fallbackInterval = setInterval(() => {
      if (document.visibilityState === "visible") window.location.reload();
    }, 5 * 60 * 1000);

    const onFocus = () => {
      if (document.visibilityState === "visible") window.location.reload();
    };
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      if (timer) clearTimeout(timer);
      clearInterval(fallbackInterval);
      document.removeEventListener("visibilitychange", onFocus);
      void supabase.removeChannel(channel);
    };
  }, [pathname]);

  return null;
}
