"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Status = "Online" | "Atenção" | "Offline";
type Client = {
  id: string;
  name: string;
  segment: string;
  panel_name: string;
  status: Status;
  monitor: string;
  panel_url: string;
  feed_url: string;
  base_url: string;
  sort_order: number;
  last_health_check: string | null;
  last_http_status: number | null;
  last_latency_ms: number | null;
  last_feed_at: string | null;
  feed_frequency_hours: number;
  feed_notes: string;
};
type DataSource = {
  id: string;
  client_id: string;
  source_name: string;
  provider: string;
  source_type: string;
  external_id: string;
  source_url: string;
  last_provider_modified_at: string | null;
  active: boolean;
};
type Profile = { user_id: string; email: string; full_name: string | null; role: "admin" | "viewer"; active: boolean };

const nav = ["Início", "Clientes", "Painéis", "Fontes", "Alertas", "Usuários", "Configurações"];

function Badge({ status }: { status: Status }) {
  const cls = status === "Online" ? "bg-emerald-50 text-emerald-700" : status === "Atenção" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}><span className="h-2 w-2 rounded-full bg-current" />{status}</span>;
}

function FeedBadge({ client }: { client: Client }) {
  const state = feedState(client);
  const cls = state.kind === "ok" ? "bg-emerald-50 text-emerald-700" : state.kind === "late" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700";
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{state.label}</span>;
}

function SourceBadge({ source, frequencyHours }: { source: DataSource; frequencyHours: number }) {
  if (!source.last_provider_modified_at) return <span className="inline-flex rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Sem leitura</span>;
  const ageHours = (Date.now() - new Date(source.last_provider_modified_at).getTime()) / 3600000;
  const late = ageHours > frequencyHours;
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${late ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{late ? `Atrasada ${Math.floor(ageHours)}h` : "Atualizada"}</span>;
}

function Card({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-bold text-[#0b3977]">{value}</div><div className="mt-2 text-xs text-slate-400">{note}</div></div>;
}

function formatDate(value: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function feedState(client: Client) {
  if (!client.last_feed_at) return { kind: "missing", label: "Sem registro", overdue: true };
  const ageHours = (Date.now() - new Date(client.last_feed_at).getTime()) / 3600000;
  if (ageHours > client.feed_frequency_hours) return { kind: "late", label: `Atrasada ${Math.floor(ageHours)}h`, overdue: true };
  return { kind: "ok", label: "Em dia", overdue: false };
}

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [view, setView] = useState("Início");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Client> | null>(null);
  const [email, setEmail] = useState("felipe@bajaeaguiar.com");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [healthBusy, setHealthBusy] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);
  const [feedBusy, setFeedBusy] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      if (data.session?.user) await loadUser(data.session.user.id, data.session.user.email || "");
      setAuthReady(true);
    }
    boot();
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) await loadUser(session.user.id, session.user.email || "");
      else { setProfile(null); setSessionEmail(""); setClients([]); setSources([]); }
      setAuthReady(true);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  async function loadUser(userId: string, userEmail: string) {
    setSessionEmail(userEmail);
    const { data: p } = await supabase.from("baja_central_profiles").select("user_id,email,full_name,role,active").eq("user_id", userId).maybeSingle();
    if (!p || !p.active) { setProfile(null); return; }
    setProfile(p as Profile);
    await Promise.all([loadClients(), loadSources()]);
  }

  async function loadClients() {
    const { data, error } = await supabase.from("baja_central_clients").select("id,name,segment,panel_name,status,monitor,panel_url,feed_url,base_url,sort_order,last_health_check,last_http_status,last_latency_ms,last_feed_at,feed_frequency_hours,feed_notes").order("sort_order", { ascending: true });
    if (!error && data) setClients(data as Client[]);
  }

  async function loadSources() {
    const { data, error } = await supabase.from("baja_central_data_sources").select("id,client_id,source_name,provider,source_type,external_id,source_url,last_provider_modified_at,active").eq("active", true).order("source_name", { ascending: true });
    if (!error && data) setSources(data as DataSource[]);
  }

  async function handleAuth() {
    setBusy(true); setMessage("");
    if (!email || !password) { setMessage("Informe e-mail e senha."); setBusy(false); return; }
    if (authMode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setMessage(error ? error.message : "Login realizado.");
    } else {
      const { data: allowed } = await supabase.from("baja_central_allowed_emails").select("email").eq("email", email.toLowerCase()).maybeSingle();
      if (!allowed) setMessage("Este e-mail não está autorizado para a Central.");
      else {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: email.split("@")[0] } } });
        setMessage(error ? error.message : "Primeiro acesso criado. Se o Supabase solicitar confirmação, confirme o e-mail e depois entre.");
      }
    }
    setBusy(false);
  }

  async function logout() { await supabase.auth.signOut(); }

  const filtered = useMemo(() => clients.filter(c => `${c.name} ${c.segment} ${c.panel_name}`.toLowerCase().includes(query.toLowerCase())), [clients, query]);
  const online = clients.filter(c => c.status === "Online").length;
  const overdueFeeds = clients.filter(c => feedState(c).overdue).length;
  const isAdmin = profile?.role === "admin";

  function startEdit(client?: Client) {
    if (!isAdmin) return;
    if (client) { setEditingId(client.id); setDraft({ ...client }); }
    else { setEditingId(null); setDraft({ name: "", segment: "", panel_name: "", status: "Online", monitor: "Cadastro manual", panel_url: "", feed_url: "", base_url: "", sort_order: clients.length + 1, feed_frequency_hours: 24, feed_notes: "" }); }
  }

  async function saveClient() {
    if (!draft?.name?.trim() || !isAdmin) return;
    setBusy(true);
    const payload = {
      name: draft.name.trim(), segment: draft.segment || "", panel_name: draft.panel_name || "", status: draft.status || "Online", monitor: draft.monitor || "Cadastro manual",
      panel_url: draft.panel_url || "", feed_url: draft.feed_url || "", base_url: draft.base_url || "", sort_order: draft.sort_order || clients.length + 1,
      feed_frequency_hours: Math.max(1, Number(draft.feed_frequency_hours || 24)), feed_notes: draft.feed_notes || "", updated_at: new Date().toISOString(),
    };
    const result = editingId ? await supabase.from("baja_central_clients").update(payload).eq("id", editingId) : await supabase.from("baja_central_clients").insert(payload);
    if (result.error) alert(result.error.message); else { setDraft(null); setEditingId(null); await loadClients(); }
    setBusy(false);
  }

  async function checkHealth(clientId: string, silent = false) {
    if (!silent) setHealthBusy(clientId);
    const { error } = await supabase.functions.invoke("baja-panel-health", { body: { client_id: clientId } });
    if (error && !silent) alert(`Não foi possível verificar o painel: ${error.message}`);
    if (!silent) setHealthBusy(null);
  }

  async function checkAll() { setCheckingAll(true); for (const client of clients) await checkHealth(client.id, true); await loadClients(); setCheckingAll(false); }
  async function checkOne(clientId: string) { await checkHealth(clientId); await loadClients(); }

  async function markFeed(client: Client) {
    if (!isAdmin) return;
    setFeedBusy(client.id);
    const notes = window.prompt("Observação opcional sobre esta alimentação:", client.feed_notes || "") ?? "";
    const { error } = await supabase.rpc("baja_central_mark_feed", { p_client_id: client.id, p_notes: notes });
    if (error) alert(`Não foi possível registrar a alimentação: ${error.message}`); else await loadClients();
    setFeedBusy(null);
  }

  function open(url: string, label: string) { if (!url) return alert(`O link de ${label} ainda não foi cadastrado.`); window.open(url, "_blank", "noopener,noreferrer"); }
  function clientSources(clientId: string) { return sources.filter(s => s.client_id === clientId); }
  function sourceIsLate(source: DataSource, frequencyHours: number) {
    if (!source.last_provider_modified_at) return true;
    return (Date.now() - new Date(source.last_provider_modified_at).getTime()) / 3600000 > frequencyHours;
  }
  function operationalSummary(client: Client) {
    const rows = clientSources(client.id);
    const lateSources = rows.filter(s => sourceIsLate(s, client.feed_frequency_hours)).length;
    const missingSource = rows.length === 0;
    const alerts = (client.status === "Online" ? 0 : 1) + lateSources + (missingSource ? 1 : 0);
    const level = client.status === "Offline" || lateSources > 0 ? "Crítico" : client.status === "Atenção" || missingSource ? "Atenção" : "Saudável";
    return { sourceCount: rows.length, lateSources, alerts, level };
  }

  if (!authReady) return <div className="grid min-h-screen place-items-center bg-[#0b3977] text-white">Carregando Central de Performance...</div>;

  if (!profile) return <div className="min-h-screen bg-gradient-to-br from-[#062b59] via-[#0b3977] to-[#2e78c6] p-6 text-white"><div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_.9fr]"><div className="max-w-xl"><div className="text-3xl font-black tracking-wide">BAJA & AGUIAR</div><div className="mt-2 text-xs tracking-[.28em] text-blue-100">CONSULTORIA EMPRESARIAL</div><h1 className="mt-10 text-5xl font-bold leading-tight">Central de Performance</h1><p className="mt-5 text-lg leading-8 text-blue-100">Método antes de opinião. Um único ambiente para acompanhar clientes, painéis, ferramentas, bases e alertas.</p></div><div className="rounded-3xl bg-white p-7 text-[#123563] shadow-2xl"><div className="text-xs font-semibold uppercase tracking-[.18em] text-blue-600">Acesso interno</div><h2 className="mt-2 text-2xl font-bold">{authMode === "login" ? "Entrar na Central" : "Criar primeiro acesso"}</h2><label className="mt-6 block text-xs font-semibold text-slate-500">E-mail</label><input value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/><label className="mt-4 block text-xs font-semibold text-slate-500">Senha</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"/>{message && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</div>}<button disabled={busy} onClick={handleAuth} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">{busy?"Processando...":authMode==="login"?"Entrar":"Criar acesso"}</button><button onClick={()=>{setAuthMode(authMode==="login"?"signup":"login");setMessage("")}} className="mt-4 w-full text-sm font-semibold text-blue-600">{authMode==="login"?"Primeiro acesso":"Já tenho acesso"}</button>{sessionEmail&&!profile&&<div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">O usuário {sessionEmail} existe, mas ainda não tem perfil ativo nesta Central.</div>}</div></div></div>;

  return <div className="min-h-screen bg-[#f4f7fb] text-[#123563]"><div className="grid min-h-screen md:grid-cols-[240px_1fr]"><aside className="bg-gradient-to-b from-[#0b3977] to-[#062b59] px-4 py-7 text-white md:sticky md:top-0 md:h-screen"><div className="px-3 pb-8"><div className="text-[22px] font-extrabold tracking-wide">BAJA & AGUIAR</div><div className="mt-1 text-[10px] tracking-[.22em] text-blue-100">CONSULTORIA EMPRESARIAL</div><div className="mt-5 border-t border-white/20 pt-4 text-sm font-semibold">Central de Performance</div></div><nav className="grid grid-cols-3 gap-2 md:grid-cols-1">{nav.map(item=><button key={item} onClick={()=>setView(item)} className={`rounded-xl px-4 py-3 text-left text-sm ${view===item?"bg-[#1f69bd]":"text-blue-100 hover:bg-white/10"}`}>{item}</button>)}</nav></aside><main className="min-w-0 px-4 pb-10 md:px-7"><header className="flex h-20 items-center gap-4"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente, painel ou ferramenta..." className="hidden w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm sm:block"/><div className="ml-auto flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#0b3977] font-bold text-white">{(profile.full_name||profile.email).slice(0,2).toUpperCase()}</div><button onClick={logout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">Sair</button></div></header>

  {view==="Início"&&<><section className="rounded-2xl bg-gradient-to-r from-[#0b3977] via-[#10519a] to-[#2e78c6] p-8 text-white shadow-sm"><h1 className="text-3xl font-bold md:text-4xl">Método antes de opinião.</h1><p className="mt-3 text-blue-100">Centralize clientes, painéis, fontes e alertas em um ambiente interno.</p></section><section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card label="Clientes monitorados" value={clients.length} note="Carteira cadastrada"/><Card label="Painéis online" value={`${online}/${clients.length}`} note="Status da última checagem"/><Card label="Fontes cadastradas" value={sources.length} note="Planilhas e bases monitoradas"/><Card label="Bases atrasadas" value={overdueFeeds} note="Conforme frequência definida"/></section><section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-bold text-[#0b3977]">Resumo operacional por cliente</h2><p className="mt-1 text-sm text-slate-500">Painel, fontes e alertas consolidados em uma única leitura.</p></div><button onClick={()=>setView("Alertas")} className="text-sm font-semibold text-blue-600">Ver alertas →</button></div><div className="grid gap-3 xl:grid-cols-2">{clients.map(c=>{const s=operationalSummary(c);const cls=s.level==="Saudável"?"border-emerald-200 bg-emerald-50/30":s.level==="Crítico"?"border-red-200 bg-red-50/30":"border-amber-200 bg-amber-50/30";return <div key={c.id} className={`rounded-2xl border p-4 ${cls}`}><div className="flex items-start justify-between gap-3"><div><div className="font-bold text-[#0b3977]">{c.name}</div><div className="mt-1 text-xs text-slate-500">{c.panel_name}</div></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.level==="Saudável"?"bg-emerald-100 text-emerald-700":s.level==="Crítico"?"bg-red-100 text-red-700":"bg-amber-100 text-amber-700"}`}>{s.level}</span></div><div className="mt-4 grid grid-cols-4 gap-2 text-center"><div className="rounded-xl bg-white p-3"><div className="text-xs text-slate-400">Painel</div><div className="mt-1 text-sm font-bold">{c.status}</div></div><div className="rounded-xl bg-white p-3"><div className="text-xs text-slate-400">Fontes</div><div className="mt-1 text-sm font-bold">{s.sourceCount}</div></div><div className="rounded-xl bg-white p-3"><div className="text-xs text-slate-400">Atrasadas</div><div className="mt-1 text-sm font-bold">{s.lateSources}</div></div><div className="rounded-xl bg-white p-3"><div className="text-xs text-slate-400">Alertas</div><div className="mt-1 text-sm font-bold">{s.alerts}</div></div></div><div className="mt-3 flex flex-wrap gap-3 text-xs"><button onClick={()=>open(c.panel_url,"painel")} className="font-semibold text-blue-600">Abrir painel</button><button onClick={()=>setView("Fontes")} className="font-semibold text-[#0b3977]">Ver fontes</button></div></div>})}</div></section><div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><ClientTable data={clients} canEdit={isAdmin} onEdit={startEdit} onOpen={open}/></div></>}

  {view==="Clientes"&&<><PageTitle title="Clientes" subtitle="Cadastros e regras de atualização." action={isAdmin?<button onClick={()=>startEdit()} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">+ Novo cliente</button>:undefined}/><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><ClientTable data={filtered} canEdit={isAdmin} onEdit={startEdit} onOpen={open}/></div></>}

  {view==="Painéis"&&<><PageTitle title="Painéis e Ferramentas" subtitle="Disponibilidade técnica e atualização consolidada." action={<button disabled={checkingAll} onClick={checkAll} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">{checkingAll?"Verificando...":"Atualizar todos os status"}</button>}/><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><table className="w-full min-w-[1200px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="p-3">Cliente</th><th className="p-3">Status</th><th className="p-3">Última checagem</th><th className="p-3">Resposta</th><th className="p-3">Última alimentação</th><th className="p-3">Fontes</th><th className="p-3">Ações</th></tr></thead><tbody>{clients.map(c=><tr key={c.id} className="border-b border-slate-100"><td className="p-3 font-semibold">{c.name}</td><td className="p-3"><Badge status={c.status}/></td><td className="p-3 text-slate-500">{formatDate(c.last_health_check)}</td><td className="p-3 text-slate-500">{c.last_http_status?`HTTP ${c.last_http_status}`:"—"}<span className="block text-xs">{c.last_latency_ms!==null?`${c.last_latency_ms} ms`:""}</span></td><td className="p-3"><FeedBadge client={c}/><div className="mt-1 text-xs text-slate-400">{formatDate(c.last_feed_at)}</div></td><td className="p-3"><button onClick={()=>setView("Fontes")} className="font-semibold text-blue-600">{clientSources(c.id).length} fonte(s)</button></td><td className="p-3"><button disabled={healthBusy===c.id} onClick={()=>checkOne(c.id)} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-700">{healthBusy===c.id?"Checando...":"Checar painel"}</button></td></tr>)}</tbody></table></div></>}

  {view==="Fontes"&&<><PageTitle title="Fontes de Dados" subtitle="Acompanhe cada planilha individualmente e identifique exatamente qual fonte está desatualizada."/><div className="grid gap-4">{clients.map(c=><section key={c.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-[#0b3977]">{c.name}</h2><p className="text-sm text-slate-500">{clientSources(c.id).length} fonte(s) · expectativa a cada {c.feed_frequency_hours}h</p></div><FeedBadge client={c}/></div><div className="grid gap-3">{clientSources(c.id).map(s=><div key={s.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1.5fr_.8fr_.5fr_auto] md:items-center"><div><div className="font-semibold">{s.source_name}</div><div className="mt-1 text-xs text-slate-400">Google Sheets</div></div><div><div className="text-xs font-semibold text-slate-400">Última modificação</div><div className="mt-1 text-sm text-slate-600">{formatDate(s.last_provider_modified_at)}</div></div><div><SourceBadge source={s} frequencyHours={c.feed_frequency_hours}/></div><div><button onClick={()=>open(s.source_url,"fonte")} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Abrir planilha</button></div></div>)}{clientSources(c.id).length===0&&<div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">Nenhuma fonte cadastrada para este cliente.</div>}</div></section>)}</div></>}

  {view==="Alertas"&&<><PageTitle title="Alertas" subtitle="Painéis indisponíveis, bases atrasadas e fontes específicas com atraso."/><div className="grid gap-3">{clients.filter(c=>c.status!=="Online"||feedState(c).overdue||clientSources(c.id).some(s=>sourceIsLate(s,c.feed_frequency_hours))).map(c=><div key={c.id} className={`rounded-2xl border bg-white p-5 shadow-sm ${c.status==="Offline"||feedState(c).kind==="late"?"border-red-200":"border-amber-200"}`}><div className="flex flex-wrap items-center gap-3"><div className="font-bold">{c.name}</div><Badge status={c.status}/><FeedBadge client={c}/></div><div className="mt-3 grid gap-2">{clientSources(c.id).map(s=><div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-sm"><span>{s.source_name}</span><div className="flex items-center gap-3"><span className="text-xs text-slate-400">{formatDate(s.last_provider_modified_at)}</span><SourceBadge source={s} frequencyHours={c.feed_frequency_hours}/></div></div>)}</div></div>)}</div></>}

  {view==="Usuários"&&<><PageTitle title="Usuários e Acessos" subtitle="Autenticação interna via Supabase."/><div className="grid gap-3 sm:grid-cols-2"><Card label="Seu perfil" value={profile.role==="admin"?"Admin":"Viewer"} note={profile.email}/><Card label="Acesso" value={profile.active?"Ativo":"Inativo"} note="Controlado por perfil interno"/></div></>}

  {view==="Configurações"&&<><PageTitle title="Configurações" subtitle="Estrutura técnica atual."/><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Aplicação</h2><p className="mt-4 text-sm text-slate-500">Next.js + Vercel + GitHub + Supabase</p></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Monitoramento</h2><p className="mt-4 text-sm leading-6 text-slate-500">Fontes e painéis são monitorados automaticamente. A tela inicial consolida a saúde operacional por cliente.</p></div></div></>}

  </main></div>
  {draft&&isAdmin&&<div className="fixed inset-0 z-50 grid place-items-center bg-[#061d3c]/60 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-2xl font-bold">{editingId?"Editar cliente":"Novo cliente"}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Cliente" value={draft.name||""} onChange={v=>setDraft({...draft,name:v})}/><Field label="Segmento" value={draft.segment||""} onChange={v=>setDraft({...draft,segment:v})}/><Field label="Nome do painel" value={draft.panel_name||""} onChange={v=>setDraft({...draft,panel_name:v})}/><label><span className="text-xs font-semibold text-slate-500">Status</span><select value={draft.status||"Online"} onChange={e=>setDraft({...draft,status:e.target.value as Status})} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3"><option>Online</option><option>Atenção</option><option>Offline</option></select></label><Field wide label="URL do painel" value={draft.panel_url||""} onChange={v=>setDraft({...draft,panel_url:v})}/><Field wide label="URL da alimentação" value={draft.feed_url||""} onChange={v=>setDraft({...draft,feed_url:v})}/><Field wide label="URL da base" value={draft.base_url||""} onChange={v=>setDraft({...draft,base_url:v})}/><label><span className="text-xs font-semibold text-slate-500">Frequência esperada (horas)</span><input type="number" min="1" value={draft.feed_frequency_hours||24} onChange={e=>setDraft({...draft,feed_frequency_hours:Number(e.target.value)})} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3"/></label></div><div className="mt-6 flex justify-end gap-3"><button onClick={()=>{setDraft(null);setEditingId(null)}} className="rounded-xl border border-slate-200 px-4 py-3 font-semibold">Cancelar</button><button disabled={busy} onClick={saveClient} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">Salvar</button></div></div></div>}
  </div>;
}

function PageTitle({title,subtitle,action}:{title:string;subtitle:string;action?:React.ReactNode}){return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-bold text-[#0b3977]">{title}</h1><p className="mt-1 text-slate-500">{subtitle}</p></div>{action}</div>}
function Field({label,value,onChange,wide=false}:{label:string;value:string;onChange:(v:string)=>void;wide?:boolean}){return <label className={wide?"sm:col-span-2":""}><span className="text-xs font-semibold text-slate-500">{label}</span><input value={value} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>}
function ClientTable({data,canEdit,onEdit,onOpen}:{data:Client[];canEdit:boolean;onEdit:(c?:Client)=>void;onOpen:(u:string,l:string)=>void}){return <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="p-3">Cliente</th><th className="p-3">Status</th><th className="p-3">Base</th><th className="p-3">Última checagem</th><th className="p-3">Ações</th></tr></thead><tbody>{data.map(c=><tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="p-3"><div className="font-bold">{c.name}</div><div className="text-xs text-slate-400">{c.panel_name}</div></td><td className="p-3"><Badge status={c.status}/></td><td className="p-3"><FeedBadge client={c}/><div className="mt-1 text-xs text-slate-400">{formatDate(c.last_feed_at)}</div></td><td className="p-3 text-slate-500">{formatDate(c.last_health_check)}</td><td className="p-3"><div className="flex gap-3"><button onClick={()=>onOpen(c.panel_url,"painel")} className="font-semibold text-blue-600">Abrir painel</button>{canEdit&&<button onClick={()=>onEdit(c)} className="font-semibold text-[#0b3977]">Editar</button>}</div></td></tr>)}</tbody></table></div>}
