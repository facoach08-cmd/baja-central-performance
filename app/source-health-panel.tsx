"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type SourceHealth = {
  id: string;
  client_id: string;
  source_name: string;
  source_url: string;
  active: boolean;
  required: boolean;
  expected_frequency_hours: number;
  last_provider_modified_at: string | null;
  freshness_status: "ok" | "late" | "missing" | "optional" | "inactive";
  age_hours: number | null;
  last_checked_at: string | null;
  last_check_status: string | null;
  last_check_error: string | null;
};

type ClientHealth = {
  client_id: string;
  client_name: string;
  active_sources: number;
  required_sources: number;
  late_required_sources: number;
  missing_required_sources: number;
  source_health_status: "ok" | "critical" | "attention";
};

function fmt(value: string | null) {
  if (!value) return "Sem leitura";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default function SourceHealthPanel() {
  const [open, setOpen] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [clients, setClients] = useState<ClientHealth[]>([]);
  const [sources, setSources] = useState<SourceHealth[]>([]);
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
    const [clientResult, sourceResult] = await Promise.all([
      supabase.from("baja_central_client_source_health").select("*").order("client_name"),
      supabase.from("baja_central_source_health").select("*").eq("active", true).order("source_name"),
    ]);
    if (!clientResult.error) setClients((clientResult.data || []) as ClientHealth[]);
    if (!sourceResult.error) setSources((sourceResult.data || []) as SourceHealth[]);
    setLoading(false);
  }

  const lateCount = useMemo(() => sources.filter(s => s.required && (s.freshness_status === "late" || s.freshness_status === "missing")).length, [sources]);
  if (!allowed) return null;

  return <>
    <button type="button" onClick={() => setOpen(true)} className={`fixed bottom-20 right-5 z-[60] flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-xl transition ${lateCount > 0 ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"}`}>
      <span aria-hidden="true">●</span><span>Saúde das Fontes</span><span className="rounded-full bg-white/20 px-2 py-0.5 text-xs">{lateCount}</span>
    </button>

    {open && <div className="fixed inset-0 z-[80] bg-slate-950/45" onClick={() => setOpen(false)}>
      <aside className="ml-auto h-full w-full max-w-2xl overflow-y-auto bg-[#f4f7fb] p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-semibold uppercase tracking-[.16em] text-blue-600">Monitoramento operacional</div><h2 className="mt-1 text-2xl font-bold text-[#0b3977]">Saúde das Fontes</h2><p className="mt-1 text-sm text-slate-500">Um cliente fica crítico se qualquer fonte obrigatória estiver atrasada ou sem leitura.</p></div><button onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold">Fechar</button></div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Clientes</div><div className="mt-1 text-2xl font-bold text-[#0b3977]">{clients.length}</div></div><div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">Fontes obrigatórias</div><div className="mt-1 text-2xl font-bold text-[#0b3977]">{sources.filter(s => s.required).length}</div></div><div className={`rounded-2xl border p-4 ${lateCount > 0 ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50"}`}><div className="text-xs text-slate-500">Atrasadas / sem leitura</div><div className={`mt-1 text-2xl font-bold ${lateCount > 0 ? "text-red-700" : "text-emerald-700"}`}>{lateCount}</div></div></div>

        <div className="mt-5 grid gap-4">{clients.map(client => { const clientSources = sources.filter(s => s.client_id === client.client_id); const problemCount = client.late_required_sources + client.missing_required_sources; const critical = client.source_health_status === "critical"; return <section key={client.client_id} className={`rounded-2xl border bg-white p-5 shadow-sm ${critical ? "border-red-200" : "border-slate-200"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-[#0b3977]">{client.client_name}</h3><p className="mt-1 text-sm text-slate-500">{problemCount > 0 ? `${problemCount} de ${client.required_sources} fonte(s) obrigatória(s) com problema` : `${client.required_sources} fonte(s) obrigatória(s) em dia`}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${critical ? "bg-red-100 text-red-700" : client.source_health_status === "attention" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>{critical ? "Crítico" : client.source_health_status === "attention" ? "Atenção" : "Saudável"}</span></div><div className="mt-4 grid gap-2">{clientSources.map(source => { const problem = source.required && (source.freshness_status === "late" || source.freshness_status === "missing"); return <div key={source.id} className={`rounded-xl border p-3 ${problem ? "border-red-100 bg-red-50/50" : "border-slate-100 bg-slate-50"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold">{source.source_name}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${source.required ? "bg-blue-50 text-blue-700" : "bg-slate-200 text-slate-600"}`}>{source.required ? "Obrigatória" : "Opcional"}</span></div><div className="mt-1 text-xs text-slate-400">Última modificação: {fmt(source.last_provider_modified_at)} · esperado a cada {source.expected_frequency_hours}h</div></div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${problem ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>{source.freshness_status === "missing" ? "Sem leitura" : source.freshness_status === "late" ? `Atrasada ${source.age_hours ?? ""}h` : source.freshness_status === "optional" ? "Opcional" : "Em dia"}</span><a href={source.source_url} target="_blank" rel="noreferrer" className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">Abrir</a></div></div></div>; })}</div></section>; })}</div>

        <div className="mt-5 flex justify-end"><button disabled={loading} onClick={() => void load()} className="rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-700">{loading ? "Atualizando..." : "Atualizar agora"}</button></div>
      </aside>
    </div>}
  </>;
}
