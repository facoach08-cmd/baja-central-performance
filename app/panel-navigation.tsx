"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export default function PanelNavigation() {
  const router = useRouter();
  const [navTarget, setNavTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    function resolveNav() {
      const nav = document.querySelector("aside nav") as HTMLElement | null;
      setNavTarget(nav);
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = (button.textContent || "").trim();

      if (label === "Usuários" || label.includes("Usuários e Acessos")) {
        event.preventDefault();
        event.stopPropagation();
        router.push("/usuarios/uso");
        return;
      }

      if (label === "Fontes") {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent("baja:open-source-health"));
        return;
      }

      if (label === "Alertas") {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent("baja:open-alerts"));
      }
    }

    resolveNav();
    const observer = new MutationObserver(resolveNav);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleClick, true);

    return () => {
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, [router]);

  if (!navTarget) return null;

  return createPortal(
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        window.dispatchEvent(new CustomEvent("baja:open-incidents"));
      }}
      className="rounded-xl px-4 py-3 text-left text-sm text-blue-100 hover:bg-white/10"
    >
      Incidentes
    </button>,
    navTarget,
  );
}
