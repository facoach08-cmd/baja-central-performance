"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type SourceForm = {
  source_name: string;
  provider: string;
  source_type: string;
  external_id: string;
  source_url: string;
  required: boolean;
  expected_frequency_hours: number;
};

const emptySource = (): SourceForm => ({
  source_name: "",
  provider: "google_drive",
  source_type: "spreadsheet",
  external_id: "",
  source_url: "",
  required: true,
  expected_frequency_hours: 24,
});

function extractGoogleDriveId(value: string) {
  const url = value.trim();
  if (!url) return "";
  const patterns = [
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/,
    /\/document\/d\/([a-zA-Z0-9_-]+)/,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/,
    /\/file\/d\/([a-zA-Z0-9_-]+)/,
    /[?&]id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

export default function NewClientPage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    segment: "",
    panel_name: "",
    panel_url: "",
    feed_url: "",
    base_url: "",
    feed_frequency_hours: 24,
  });
  const [sources, setSources] = useState<SourceForm[]>([emptySource()]);

  useEffect(() => {
    void boot();
  }, []);

  async function boot() {
    setLoading(true);
    setError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setError("Faça login na Central antes de acessar esta página.");
      setLoading(false);
      return;
    }
    const { data: profile } = await supabase
      .from("baja_central_profiles")
      .select("active,role")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.active || profile.role !== "admin") {
      setError("Esta visão é exclusiva para administradores da Central.");
      setLoading(false);
      return;
    }
    setAuthorized(true);
    setLoading(false);
  }

  function updateSource(index: number, patch: Partial<SourceForm>) {
    setSources(current => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function updateSourceUrl(index: number, source: SourceForm, value: string) {
    const autoId = source.provider === "google_drive" ? extractGoogleDriveId(value) : source.external_id;
    updateSource(index, { source_url: value, external_id: autoId });
  }

  async function save() {
    setNotice("");
    setError("");
    if (!form.name.trim() || !form.panel_name.trim() || !form.panel_url.trim()) {
      setError("Preencha cliente, nome do painel e URL oficial do painel.");
      return;
    }
    const invalidDriveSource = sources.find(s => s.source_name.trim() && s.provider === "google_drive" && s.source_url.trim() && !s.external_id.trim());
    if (invalidDriveSource) {
      setError(`Não consegui identificar o arquivo Google na URL da fonte “${invalidDriveSource.source_name}”. Cole o link completo do Google Sheets/Drive.`);
      return;
    }
    setBusy(true);

    const { data: clientId, error: clientError } = await supabase.rpc("baja_central_admin_create_client", {
      p_name: form.name.trim(),
      p_segment: form.segment.trim(),
      p_panel_name: form.panel_name.trim(),
      p_panel_url: form.panel_url.trim(),
      p_feed_url: form.feed_url.trim() || null,
      p_base_url: form.base_url.trim() || null,
      p_feed_frequency_hours: Number(form.feed_frequency_hours) || 24,
    });

    if (clientError || !clientId) {
      setError(`Não foi possível criar o cliente: ${clientError?.message || "erro desconhecido"}`);
      setBusy(false);
      return;
    }

    for (const source of sources.filter(s => s.source_name.trim())) {
      const { error: sourceError } = await supabase.rpc("baja_central_admin_add_source", {
        p_client_id: clientId,
        p_source_name: source.source_name.trim(),
        p_provider: source.provider.trim(),
        p_source_type: source.source_type.trim(),
        p_external_id: source.external_id.trim() || null,
        p_source_url: source.source_url.trim() || null,
        p_required: source.required,
        p_expected_frequency_hours: Number(source.expected_frequency_hours) || 24,
      });
      if (sourceError) {
        setError(`Cliente criado, mas uma fonte falhou: ${sourceError.message}`);
        setBusy(false);
        return;
      }
    }

    try {
      await supabase.functions.invoke("baja-panel-health", { body: { client_id: clientId } });
    } catch {
      // O monitoramento horário fará a checagem posteriormente.
    }

    setNotice(`Cliente ${form.name.trim()} cadastrado. O painel e as fontes já entram na Central.`);
    setForm({ name: "", segment: "", panel_name: "", panel_url: "", feed_url: "", base_url: "", feed_frequency_hours: 24 });
    setSources([emptySource()]);
    setBusy(false);
  }

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f4f7fb] text-[#0b3977]">Carregando...</div>;

  if (!authorized) return <div className="min-h-screen bg-[#f4f7fb] p-6"><div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold text-[#0b3977]">Novo Cliente / Painel</h1><p className="mt-3 text-slate-600">{error}</p><a href="/" className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Voltar para a Central</a></div></div>;

  return <div className="min-h-screen bg-[#f4f7fb] p-4 text-[#123563] md:p-8"><div className="mx-auto max-w-6xl">
    <div><a href="/" className="text-sm font-semibold text-blue-600">← Voltar para a Central</a><h1 className="mt-2 text-3xl font-bold text-[#0b3977]">Novo Cliente / Painel</h1><p className="mt-1 text-slate-500">Cadastre o painel oficial e as fontes de alimentação que a Central deve acompanhar.</p></div>

    {(notice || error) && <div className={`mt-5 rounded-xl border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{error || notice}</div>}

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-[#0b3977]">Dados do cliente</h2>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Nome do cliente" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/>
        <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Segmento" value={form.segment} onChange={e => setForm({ ...form, segment: e.target.value })}/>
        <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Nome do painel" value={form.panel_name} onChange={e => setForm({ ...form, panel_name: e.target.value })}/>
        <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="https://...vercel.app" value={form.panel_url} onChange={e => setForm({ ...form, panel_url: e.target.value })}/>
        <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Link da ferramenta de alimentação (opcional)" value={form.feed_url} onChange={e => setForm({ ...form, feed_url: e.target.value })}/>
        <input className="rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Link da base principal (opcional)" value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })}/>
      </div>
    </section>

    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold text-[#0b3977]">Fontes monitoradas</h2><p className="mt-1 text-sm text-slate-500">Para Google Sheets/Drive, basta colar a URL completa. A Central identifica o ID automaticamente.</p></div><button onClick={() => setSources([...sources, emptySource()])} className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700">+ Adicionar fonte</button></div>
      <div className="mt-4 space-y-4">{sources.map((source, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        <input className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" placeholder="Nome da fonte" value={source.source_name} onChange={e => updateSource(index,{source_name:e.target.value})}/>
        <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" value={source.provider} onChange={e => { const provider=e.target.value; updateSource(index,{provider,external_id:provider==='google_drive'?extractGoogleDriveId(source.source_url):source.external_id}); }}><option value="google_drive">Google Drive</option><option value="supabase">Supabase</option><option value="api">API</option><option value="other">Outra</option></select>
        <select className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" value={source.source_type} onChange={e => updateSource(index,{source_type:e.target.value})}><option value="spreadsheet">Planilha</option><option value="database">Banco de dados</option><option value="api">API</option><option value="other">Outra</option></select>
        <input className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm lg:col-span-2" placeholder="Cole aqui a URL completa da fonte" value={source.source_url} onChange={e => updateSourceUrl(index,source,e.target.value)}/>
        <div className="flex gap-3"><input type="number" min={1} max={720} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm" value={source.expected_frequency_hours} onChange={e => updateSource(index,{expected_frequency_hours:Number(e.target.value)})}/><label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"><input type="checkbox" checked={source.required} onChange={e => updateSource(index,{required:e.target.checked})}/>Obrigatória</label></div>
      </div>{source.provider==='google_drive'&&source.source_url&&<div className="mt-2 text-xs text-slate-500">{source.external_id?`Arquivo identificado automaticamente: ${source.external_id}`:"Não consegui identificar o arquivo nessa URL."}</div>}{sources.length>1&&<button onClick={()=>setSources(sources.filter((_,i)=>i!==index))} className="mt-3 text-xs font-semibold text-red-600">Remover fonte</button>}</div>)}</div>
    </section>

    <div className="mt-6 flex justify-end"><button disabled={busy} onClick={()=>void save()} className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy?"Cadastrando...":"Cadastrar cliente e painel"}</button></div>
  </div></div>;
}
