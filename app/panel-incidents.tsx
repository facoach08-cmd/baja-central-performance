"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Summary = {
  client_id: string;
  client_name: string;
  incident_count: number;
  incidents_30d: number;
  open_incidents: number;
  downtime_seconds_30d: number;
  last_incident_at: string | null;
};

type Incident = {
  id: string;
  client_id: string;
  incident_type: "offline" | "attention";
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  opening_status: string | null;
  closing_status: string | null;
  last_http_status: number | null;
  last_latency_ms: number | null;
  last_monitor: string | null;
};

function fmt(value: string | null) {
  if (!value) return "Em aberto";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function duration(seconds: number | null) {
  if (seconds === null) return "Em andamento";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

export default function PanelIncidents() {
  const [allowed, setAllowed] = useState(false);
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<Summary[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>("all");
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
    const timer = window.setInterval(() => { if (mounted) void load(); }, 5 * 60 * 1000);
    return () => { mounted = false; window.clearInterval(timer); };
  }, []);

  async function load() {
    setLoading(true);
    const [summaryResult, incidentResult] = await Promise.all([
      supabase.from("baja_central_panel_incident_summary").select("*").order("client_name"),
      supabase.from("baja_central_panel_incidents").select("id,client_id,incident_type,started_at,ended_at,duration_seconds,opening_status,closing_status,last_http_status,last_latency_ms,last_monitor").order("started_at", { ascending: false }).limit(100),
    ]);
    if (!summaryResult.error) setSummary((summaryResult.data || []) as Summary[]);
    if (!incidentResult.error) setIncidents((incidentResult.data || []) as Incident[]);
    setLoading(false);
  }

  const openCount = useMemo(() => summary.reduce((sum, item) => sum + Number(item.open_incidents || 0), 0), [summary]);
  const incidents30d = useMemo(() => summary.reduce((sum, item) => sum + Number(item.incidents_30d || 0), 0), [summary]);
  const downtime30d = useMemo(() => summary.reduce((sum, item) => sum + Number(item.downtime_seconds_30d || 0), 0), [summary]);
  const filtered = selectedClientId === "all" ? incidents : incidents.filter(i => i.client_id === selectedClientId);
  const clientName = new Map(summary.map(s => [s.client_id, s.client_name]));

  if (!allowed) return null;

  return <>
    <button type="button" onClick={() => setOpen(true)} className={`fixed bottom-52 right-5 z-[60] flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-xl transition ${openCount > 0 ? "bg-red-700 hover:bg-red-800" : "bg-[#0b3977] hover:bg-[#10519a]"}`}>
      <span aria-hidden="true">⏱</span><span>Incidentes</span><span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{openCount}</span>
    </button>

    {open && <div className="fixed inset-0 z-[95] bg-slate-950/45" onClick={() => setOpen(false)}>
      <aside className="ml-auto h-full w-full max-w-4xl overflow-y-auto bg-[#f4f7fb] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div><div className="text-xs font-semibold uppercase tracking-[.16em] text-blue-600">Monitoramento técnico</div><h2 className="mt-1 text-2xl font-bold text-[#0b3977]">Histórico de Incidentes</h2><p className="mt-1 text-sm text-slate-500">Acompanhe quedas, atenção técnica e tempo acumulado de indisponibilidade por cliente.</p></div>
          <button onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">Fechar</button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className={`rounded-2xl border p-4 ${openCount > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}><div className="text-xs text-slate-500">Incidentes em aberto</div><div className={`mt-1 text-2xl font-bold ${openCount > 0 ? "text-red-700" : "text-emerald-700"}`}>{openCount}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Incidentes em 30 dias</div><div className="mt-1 text-2xl font-bold text-[#0b3977]">{incidents30d}</div></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Indisponibilidade 30 dias</div><div className="mt-1 text-2xl font-bold text-[#0b3977]">{duration(downtime30d)}</div></div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold text-[#0b3977]">Resumo por cliente</h3><p className="mt-1 text-sm text-slate-500">Ocorrências e tempo de indisponibilidade dos últimos 30 dias.</p></div><button disabled={loading} onClick={() => void load()} className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700">{loading ? "Atualizando..." : "Atualizar"}</button></div>
          <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="p-3">Cliente</th><th className="p-3">Incidentes 30d</th><th className="p-3">Em aberto</th><th className="p-3">Indisponibilidade</th><th className="p-3">Último incidente</th></tr></thead><tbody>{summary.map(row => <tr key={row.client_id} className="border-b border-slate-100"><td className="p-3 font-semibold">{row.client_name}</td><td className="p-3">{row.incidents_30d}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${Number(row.open_incidents) > 0 ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{row.open_incidents}</span></td><td className="p-3">{duration(Number(row.downtime_seconds_30d || 0))}</td><td className="p-3 text-slate-500">{row.last_incident_at ? fmt(row.last_incident_at) : "Nenhum"}</td></tr>)}</tbody></table></div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 className="font-bold text-[#0b3977]">Linha do tempo</h3><p className="mt-1 text-sm text-slate-500">Últimos 100 incidentes registrados.</p></div><label className="text-xs font-semibold text-slate-500">Cliente<select value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} className="mt-1 block rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700"><option value="all">Todos</option>{summary.map(s => <option key={s.client_id} value={s.client_id}>{s.client_name}</option>)}</select></label></div>
          <div className="mt-4 grid gap-3">{filtered.map(item => { const isOpen = !item.ended_at; return <div key={item.id} className={`rounded-xl border p-4 ${isOpen ? "border-red-200 bg-red-50/40" : "border-slate-200 bg-slate-50"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{clientName.get(item.client_id) || "Cliente"}</div><div className={`mt-1 font-bold ${item.incident_type === "offline" ? "text-red-700" : "text-amber-700"}`}>{item.incident_type === "offline" ? "Painel offline" : "Painel em atenção"}</div><div className="mt-1 text-sm text-slate-500">Início: {fmt(item.started_at)} · Fim: {fmt(item.ended_at)} · Duração: {duration(item.duration_seconds)}</div></div><div className="text-right"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${isOpen ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{isOpen ? "Em aberto" : "Resolvido"}</span>{item.last_http_status && <div className="mt-2 text-xs text-slate-400">HTTP {item.last_http_status}{item.last_latency_ms !== null ? ` · ${item.last_latency_ms} ms` : ""}</div>}</div></div>{item.last_monitor && <div className="mt-3 rounded-lg bg-white/70 px-3 py-2 text-xs text-slate-500">{item.last_monitor}</div>}</div>; })}{filtered.length === 0 && <div className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">Nenhum incidente registrado para o filtro selecionado.</div>}</div>
        </div>
      </aside>
    </div>}
  </>;
}
