"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function PanelNavigation() {
  const router = useRouter();
  const [navTarget, setNavTarget] = useState<HTMLElement | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function resolveRole() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user || !mounted) return;
      const { data: profile } = await supabase.from("baja_central_profiles").select("active,role").eq("user_id", user.id).maybeSingle();
      if (!mounted || !profile?.active) return;
      setIsAdmin(profile.role === "admin");
    }

    function resolveUi() {
      const nav = document.querySelector("aside nav") as HTMLElement | null;
      setNavTarget(nav);

      const navButtons = Array.from(document.querySelectorAll("aside nav button")) as HTMLButtonElement[];
      const usersButton = navButtons.find(button => (button.textContent || "").trim() === "Usuários");
      if (usersButton) usersButton.style.display = isAdmin ? "" : "none";

      const allButtons = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[];
      allButtons.forEach(button => {
        const label = (button.textContent || "").trim();
        if (label === "Primeiro acesso" || label === "Criar acesso") {
          button.style.display = "none";
          button.setAttribute("aria-hidden", "true");
          button.tabIndex = -1;
        }
      });
    }

    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = (button.textContent || "").trim();

      if (label === "Primeiro acesso" || label === "Criar acesso") {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (label === "Usuários" || label.includes("Usuários e Acessos")) {
        if (!isAdmin) return;
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

    void resolveRole();
    resolveUi();
    const observer = new MutationObserver(resolveUi);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", handleClick, true);

    return () => {
      mounted = false;
      observer.disconnect();
      document.removeEventListener("click", handleClick, true);
    };
  }, [router, isAdmin]);

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
