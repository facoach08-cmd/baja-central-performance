"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function PanelNavigation() {
  const router = useRouter();

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;

      const label = (button.textContent || "").trim();
      if (label === "Usuários") {
        event.preventDefault();
        event.stopPropagation();
        router.push("/usuarios/uso");
      }
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return null;
}
