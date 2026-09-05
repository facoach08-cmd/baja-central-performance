"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ClientRow = {
  id: string;
  name: string;
  status: "Online" | "Atenção" | "Offline";
  last_health_check: string | null;
  last_http_status: number | null;
  monitor: string | null;
};

type SourceRow = {
  id: string;
  client_id: string;
  source_name: string;
  source_url: string;
  required: boolean;
  freshness_status: "ok" | "late" | "missing" | "optional" | "inactive";
  age_hours: number | null;
  last_provider_modified_at: string | null;
  last_check_status: string | null;
  last_check_error: string | null;
};

type AlertItem = {
  key: string;
  type: "panel_offline" | "panel_attention" | "source_late" | "source_missing" | "monitor_error";
  client: string;
  title: string;
  detail: string;
  href?: string;
  severity: "critical" | "attention";
};

function fmt(value: string | null) {
  if (!value) return "Sem registro";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function OperationalAlerts() {
  const [open, setOpen] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user || !mounted) return;
      const { data: profile } = await supabase.from("baja_central_profiles").select("active").eq("user_id", user.id).maybeSingle();
      if (!mounted || !profile?.active) return;
      setAllowed(true);
      await load();
    }
    void boot();

    function intercept(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");
      if (!button) return;
      const label = (button.textContent || "").trim();
      if (label === "Alertas") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
      }
    }
    document.addEventListener("click", intercept, true);
    const timer = window.setInterval(() => { if (mounted) void load(); }, 5 * 60 * 1000);
    return () => { mounted = false; document.removeEventListener("click", intercept, true); window.clearInterval(timer); };
  }, []);

  async function load() {
    setLoading(true);
    const [clientResult, sourceResult] = await Promise.all([
      supabase.from("baja_central_clients").select("id,name,status,last_health_check,last_http_status,monitor").order("sort_order"),
      supabase.from("baja_central_source_health").select("id,client_id,source_name,source_url,required,freshness_status,age_hours,last_provider_modified_at,last_check_status,last_check_error").eq("active", true),
    ]);
    if (!clientResult.error) setClients((clientResult.data || []) as ClientRow[]);
    if (!sourceResult.error) setSources((sourceResult.data || []) as SourceRow[]);
    setLoading(false);
  }

  const alerts = useMemo<AlertItem[]>(() => {
    const clientName = new Map(clients.map(c => [c.id, c.name]));
    const items: AlertItem[] = [];

    clients.forEach(c => {
      if (c.status === "Offline") items.push({ key: `panel-offline-${c.id}`, type: "panel_offline", client: c.name, title: "Painel offline", detail: `Última checagem: ${fmt(c.last_health_check)}${c.last_http_status ? ` · HTTP ${c.last_http_status}` : ""}`, severity: "critical" });
      else if (c.status === "Atenção") items.push({ key: `panel-attention-${c.id}`, type: "panel_attention", client: c.name, title: "Painel em atenção", detail: `Última checagem: ${fmt(c.last_health_check)}${c.last_http_status ? ` · HTTP ${c.last_http_status}` : ""}`, severity: "attention" });
    });

    sources.forEach(s => {
      const name = clientName.get(s.client_id) || "Cliente";
      if (s.required && s.freshness_status === "late") items.push({ key: `source-late-${s.id}`, type: "source_late", client: name, title: "Fonte atrasada", detail: `${s.source_name} · ${s.age_hours ?? 0}h sem atualização`, href: s.source_url, severity: "critical" });
      if (s.required && s.freshness_status === "missing") items.push({ key: `source-missing-${s.id}`, type: "source_missing", client: name, title: "Fonte sem leitura", detail: `${s.source_name} · nenhuma modificação identificada`, href: s.source_url, severity: "critical" });
      if (s.last_check_error || (s.last_check_status && !["ok", "success"].includes(s.last_check_status.toLowerCase()))) items.push({ key: `monitor-${s.id}`, type: "monitor_error", client: name, title: "Problema de monitoramento", detail: `${s.source_name}${s.last_check_error ? ` · ${s.last_check_error}` : ` · status ${s.last_check_status}`}`, href: s.source_url, severity: "attention" });
    });

    return items.sort((a, b) => a.severity === b.severity ? a.client.localeCompare(b.client) : a.severity === "critical" ? -1 : 1);
  }, [clients, sources]);

  const counts = useMemo(() => ({
    total: alerts.length,
    offline: alerts.filter(a => a.type === "panel_offline").length,
    late: alerts.filter(a => a.type === "source_late").length,
    missing: alerts.filter(a => a.type === "source_missing").length,
    monitor: alerts.filter(a => a.type === "monitor_error").length,
  }), [alerts]);

  if (!allowed) return null;

  return <>
    <button type="button" onClick={() => setOpen(true)} className={`fixed bottom-36 right-5 z-[60] flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-xl transition ${counts.total > 0 ? "bg-amber-600 hover:bg-amber-700" : "bg-slate-600 hover:bg-slate-700"}`}>
      <span aria-hidden="true">⚠</span><span>Alertas Operacionais</span><span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{counts.total}</span>
    </button>

    {open && <div className="fixed inset-0 z-[90] bg-slate-950/45" onClick={() => setOpen(false)}>
      <aside className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-[#f4f7fb] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[.16em] text-blue-600">Central de Performance</div><h2 className="mt-1 text-2xl font-bold text-[#0b3977]">Alertas Operacionais</h2><p className="mt-1 text-sm text-slate-500">Separação por tipo para facilitar a ação da equipe.</p></div><button onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">Fechar</button></div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[['Painéis offline', counts.offline], ['Fontes atrasadas', counts.late], ['Sem leitura', counts.missing], ['Monitoramento', counts.monitor]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold text-[#0b3977]">{value}</div></div>)}
        </div>

        <div className="mt-5 grid gap-3">
          {alerts.map(alert => <div key={alert.key} className={`rounded-2xl border bg-white p-4 shadow-sm ${alert.severity === 'critical' ? 'border-red-200' : 'border-amber-200'}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{alert.client}</div><div className={`mt-1 font-bold ${alert.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>{alert.title}</div><div className="mt-1 text-sm text-slate-500">{alert.detail}</div></div>{alert.href && <a href={alert.href} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Abrir fonte</a>}</div></div>)}
          {alerts.length === 0 && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-700"><div className="font-bold">Nenhum alerta operacional ativo</div><div className="mt-1 text-sm">Painéis e fontes estão dentro das regras atuais de monitoramento.</div></div>}
        </div>

        <div className="mt-5 flex justify-end"><button disabled={loading} onClick={() => void load()} className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700">{loading ? "Atualizando..." : "Atualizar alertas"}</button></div>
      </aside>
    </div>}
  </>;
}
