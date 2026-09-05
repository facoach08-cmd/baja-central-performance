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
      if (label === "Usuários" || label.includes("Usuários e Acessos")) {
        event.preventDefault();
        event.stopPropagation();
        router.push("/usuarios/uso");
      }
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [router]);

  return (
    <button
      type="button"
      onClick={() => router.push("/usuarios/uso")}
      className="fixed bottom-5 right-5 z-[60] flex items-center gap-2 rounded-2xl bg-[#0b3977] px-5 py-3 text-sm font-semibold text-white shadow-xl transition hover:bg-[#10519a]"
      aria-label="Abrir Usuários e Acessos"
    >
      <span aria-hidden="true">👥</span>
      <span>Usuários e Acessos</span>
    </button>
  );
}
