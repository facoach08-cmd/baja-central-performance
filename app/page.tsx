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
};
type Profile = { user_id: string; email: string; full_name: string | null; role: "admin" | "viewer"; active: boolean };

const nav = ["Início", "Clientes", "Painéis", "Alertas", "Usuários", "Configurações"];

function Badge({ status }: { status: Status }) {
  const cls = status === "Online" ? "bg-emerald-50 text-emerald-700" : status === "Atenção" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}><span className="h-2 w-2 rounded-full bg-current" />{status}</span>;
}

function Card({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-bold text-[#0b3977]">{value}</div><div className="mt-2 text-xs text-slate-400">{note}</div></div>;
}

export default function Home() {
  const [authReady, setAuthReady] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [view, setView] = useState("Início");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Client> | null>(null);
  const [email, setEmail] = useState("felipe@bajaeaguiar.com");
  const [password, setPassword] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

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
      else { setProfile(null); setSessionEmail(""); setClients([]); }
      setAuthReady(true);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  async function loadUser(userId: string, userEmail: string) {
    setSessionEmail(userEmail);
    const { data: p } = await supabase.from("baja_central_profiles").select("user_id,email,full_name,role,active").eq("user_id", userId).maybeSingle();
    if (!p || !p.active) { setProfile(null); return; }
    setProfile(p as Profile);
    await loadClients();
  }

  async function loadClients() {
    const { data, error } = await supabase.from("baja_central_clients").select("id,name,segment,panel_name,status,monitor,panel_url,feed_url,base_url,sort_order").order("sort_order", { ascending: true });
    if (!error && data) setClients(data as Client[]);
  }

  async function handleAuth() {
    setBusy(true); setMessage("");
    if (!email || !password) { setMessage("Informe e-mail e senha."); setBusy(false); return; }
    if (authMode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setMessage(error ? error.message : "Login realizado.");
    } else {
      const { data: allowed } = await supabase.from("baja_central_allowed_emails").select("email").eq("email", email.toLowerCase()).maybeSingle();
      if (!allowed) {
        setMessage("Este e-mail não está autorizado para a Central.");
      } else {
        const { error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: email.split("@")[0] } } });
        setMessage(error ? error.message : "Primeiro acesso criado. Se o Supabase solicitar confirmação, confirme o e-mail e depois entre.");
      }
    }
    setBusy(false);
  }

  async function logout() { await supabase.auth.signOut(); }

  const filtered = useMemo(() => clients.filter(c => `${c.name} ${c.segment} ${c.panel_name}`.toLowerCase().includes(query.toLowerCase())), [clients, query]);
  const online = clients.filter(c => c.status === "Online").length;
  const configured = clients.filter(c => c.panel_url).length;
  const missingLinks = clients.filter(c => !c.feed_url || !c.base_url).length;
  const isAdmin = profile?.role === "admin";

  function startEdit(client?: Client) {
    if (!isAdmin) return;
    if (client) {
      setEditingId(client.id);
      setDraft({ ...client });
    } else {
      setEditingId(null);
      setDraft({ name: "", segment: "", panel_name: "", status: "Online", monitor: "Cadastro manual", panel_url: "", feed_url: "", base_url: "", sort_order: clients.length + 1 });
    }
  }

  async function saveClient() {
    if (!draft?.name?.trim() || !isAdmin) return;
    setBusy(true);
    const payload = {
      name: draft.name.trim(),
      segment: draft.segment || "",
      panel_name: draft.panel_name || "",
      status: draft.status || "Online",
      monitor: draft.monitor || "Cadastro manual",
      panel_url: draft.panel_url || "",
      feed_url: draft.feed_url || "",
      base_url: draft.base_url || "",
      sort_order: draft.sort_order || clients.length + 1,
      updated_at: new Date().toISOString(),
    };
    const result = editingId
      ? await supabase.from("baja_central_clients").update(payload).eq("id", editingId)
      : await supabase.from("baja_central_clients").insert(payload);
    if (result.error) alert(result.error.message);
    else { setDraft(null); setEditingId(null); await loadClients(); }
    setBusy(false);
  }

  function open(url: string, label: string) {
    if (!url) return alert(`O link de ${label} ainda não foi cadastrado.`);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  if (!authReady) return <div className="grid min-h-screen place-items-center bg-[#0b3977] text-white">Carregando Central de Performance...</div>;

  if (!profile) {
    return <div className="min-h-screen bg-gradient-to-br from-[#062b59] via-[#0b3977] to-[#2e78c6] p-6 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_.9fr]">
        <div className="max-w-xl"><div className="text-3xl font-black tracking-wide">BAJA & AGUIAR</div><div className="mt-2 text-xs tracking-[.28em] text-blue-100">CONSULTORIA EMPRESARIAL</div><h1 className="mt-10 text-5xl font-bold leading-tight">Central de Performance</h1><p className="mt-5 text-lg leading-8 text-blue-100">Método antes de opinião. Um único ambiente para acompanhar clientes, painéis, ferramentas, bases e alertas.</p><div className="mt-8 border-l border-white/30 pl-5 leading-8 text-blue-100">Diagnóstico.<br/>Estratégia.<br/>Acompanhamento.</div></div>
        <div className="rounded-3xl bg-white p-7 text-[#123563] shadow-2xl">
          <div className="text-xs font-semibold uppercase tracking-[.18em] text-blue-600">Acesso interno</div><h2 className="mt-2 text-2xl font-bold">{authMode === "login" ? "Entrar na Central" : "Criar primeiro acesso"}</h2><p className="mt-2 text-sm text-slate-500">Somente e-mails previamente autorizados conseguem criar acesso.</p>
          <label className="mt-6 block text-xs font-semibold text-slate-500">E-mail</label><input value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400" />
          <label className="mt-4 block text-xs font-semibold text-slate-500">Senha</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-blue-400" placeholder="mínimo 6 caracteres" />
          {message && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">{message}</div>}
          <button disabled={busy} onClick={handleAuth} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Processando..." : authMode === "login" ? "Entrar" : "Criar acesso"}</button>
          <button onClick={()=>{setAuthMode(authMode === "login" ? "signup" : "login"); setMessage("");}} className="mt-4 w-full text-sm font-semibold text-blue-600">{authMode === "login" ? "Primeiro acesso" : "Já tenho acesso"}</button>
          {sessionEmail && !profile && <div className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">O usuário {sessionEmail} existe, mas ainda não tem perfil ativo nesta Central.</div>}
        </div>
      </div>
    </div>;
  }

  return <div className="min-h-screen bg-[#f4f7fb] text-[#123563]">
    <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
      <aside className="bg-gradient-to-b from-[#0b3977] to-[#062b59] px-4 py-7 text-white md:sticky md:top-0 md:h-screen">
        <div className="px-3 pb-8"><div className="text-[22px] font-extrabold tracking-wide">BAJA & AGUIAR</div><div className="mt-1 text-[10px] tracking-[.22em] text-blue-100">CONSULTORIA EMPRESARIAL</div><div className="mt-5 border-t border-white/20 pt-4 text-sm font-semibold">Central de Performance</div></div>
        <nav className="grid grid-cols-3 gap-2 md:grid-cols-1">{nav.map(item => <button key={item} onClick={() => setView(item)} className={`rounded-xl px-4 py-3 text-left text-sm ${view === item ? "bg-[#1f69bd]" : "text-blue-100 hover:bg-white/10"}`}>{item}</button>)}</nav>
        <div className="mt-10 hidden border-t border-white/20 px-3 pt-6 text-blue-100 md:block"><div className="text-xl font-bold text-white">Método antes<br/>de opinião.</div><div className="mt-4 leading-7">Diagnóstico.<br/>Estratégia.<br/>Acompanhamento.</div></div>
      </aside>

      <main className="min-w-0 px-4 pb-10 md:px-7">
        <header className="flex h-20 items-center gap-4"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente, painel ou ferramenta..." className="hidden w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none sm:block"/><div className="ml-auto flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#0b3977] font-bold text-white">{(profile.full_name || profile.email).slice(0,2).toUpperCase()}</div><div className="hidden sm:block"><div className="font-semibold">{profile.full_name || profile.email}</div><div className="text-xs text-slate-500">{profile.role === "admin" ? "Administrador" : "Visualizador"}</div></div><button onClick={logout} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">Sair</button></div></header>

        {view === "Início" && <><section className="rounded-2xl bg-gradient-to-r from-[#0b3977] via-[#10519a] to-[#2e78c6] p-8 text-white shadow-sm"><h1 className="text-3xl font-bold md:text-4xl">Método antes de opinião.</h1><p className="mt-3 max-w-2xl text-blue-100">Centralize clientes, painéis, ferramentas e bases em um ambiente interno com dados persistidos no Supabase.</p></section><section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card label="Clientes monitorados" value={clients.length} note="Carteira cadastrada"/><Card label="Painéis online" value={`${online}/${clients.length}`} note="Status atual do cadastro"/><Card label="Painéis configurados" value={configured} note="Com link direto"/><Card label="Links pendentes" value={missingLinks} note="Alimentação ou base faltando"/></section><section className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Carteira monitorada</h2><button className="text-sm font-semibold text-blue-600" onClick={()=>setView("Clientes")}>Ver todos →</button></div><ClientTable data={clients} canEdit={isAdmin} onEdit={startEdit} onOpen={open}/></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold">Acessos rápidos</h2><div className="mt-4 grid gap-2">{clients.map(c=><div key={c.id} className="rounded-xl border border-slate-200 p-3"><div className="flex items-center justify-between gap-3"><div><strong>{c.name}</strong><span className="block text-xs text-slate-500">{c.panel_name}</span></div><button onClick={()=>open(c.panel_url,"painel")} className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700">Abrir</button></div>{isAdmin && <button onClick={()=>startEdit(c)} className="mt-2 text-xs font-semibold text-slate-500">Editar links</button>}</div>)}</div></div></section></>}

        {view === "Clientes" && <><PageTitle title="Clientes" subtitle="Cadastros agora ficam persistidos no Supabase." action={isAdmin ? <button onClick={()=>startEdit()} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">+ Novo cliente</button> : undefined}/><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><ClientTable data={filtered} canEdit={isAdmin} onEdit={startEdit} onOpen={open}/></div></>}

        {view === "Painéis" && <><PageTitle title="Painéis e Ferramentas" subtitle="Acesse os ambientes reais e mantenha os links centralizados."/><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><table className="w-full min-w-[900px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="p-3">Painel</th><th className="p-3">Cliente</th><th className="p-3">Status</th><th className="p-3">Monitoramento</th><th className="p-3">Painel</th><th className="p-3">Alimentação</th><th className="p-3">Base</th></tr></thead><tbody>{clients.map(c=><tr key={c.id} className="border-b border-slate-100"><td className="p-3 font-semibold">{c.panel_name}</td><td className="p-3">{c.name}</td><td className="p-3"><Badge status={c.status}/></td><td className="p-3 text-slate-500">{c.monitor}</td><td className="p-3"><button onClick={()=>open(c.panel_url,"painel")} className="text-blue-600 underline">Abrir</button></td><td className="p-3"><button onClick={()=>open(c.feed_url,"alimentação")} className={c.feed_url?"text-blue-600 underline":"text-slate-400"}>{c.feed_url?"Abrir":"Pendente"}</button></td><td className="p-3"><button onClick={()=>open(c.base_url,"base")} className={c.base_url?"text-blue-600 underline":"text-slate-400"}>{c.base_url?"Abrir":"Pendente"}</button></td></tr>)}</tbody></table></div></>}

        {view === "Alertas" && <><PageTitle title="Alertas" subtitle="Pendências objetivas da Central."/><div className="grid gap-3">{clients.filter(c=>!c.feed_url || !c.base_url).map(c=><div key={c.id} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm"><div className="font-bold">{c.name}</div><div className="mt-1 text-sm text-slate-500">{!c.feed_url && "Falta cadastrar a ferramenta de alimentação. "}{!c.base_url && "Falta cadastrar a base de dados."}</div></div>)}</div></>}

        {view === "Usuários" && <><PageTitle title="Usuários e Acessos" subtitle="Autenticação interna via Supabase."/><div className="grid gap-3 sm:grid-cols-2"><Card label="Seu perfil" value={profile.role === "admin" ? "Admin" : "Viewer"} note={profile.email}/><Card label="Acesso" value={profile.active ? "Ativo" : "Inativo"} note="Controlado por perfil interno"/></div><div className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-sm leading-6 text-slate-500">Para liberar novos usuários, adicione o e-mail à lista autorizada. Novos acessos só criam perfil se o e-mail tiver sido previamente permitido.</p></div></>}

        {view === "Configurações" && <><PageTitle title="Configurações" subtitle="Estrutura técnica atual."/><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Aplicação</h2><p className="mt-4 text-sm text-slate-500">Next.js + Vercel + GitHub + Supabase</p><p className="mt-2 text-sm text-slate-500">Os clientes e links agora ficam persistidos no banco.</p></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Próxima integração</h2><p className="mt-4 text-sm leading-6 text-slate-500">Automatizar última alimentação, status das integrações e contagem de acessos dos painéis.</p></div></div></>}
      </main>
    </div>

    {draft && isAdmin && <div className="fixed inset-0 z-50 grid place-items-center bg-[#061d3c]/60 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-2xl font-bold">{editingId?"Editar cliente":"Novo cliente"}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Cliente" value={draft.name || ""} onChange={v=>setDraft({...draft,name:v})}/><Field label="Segmento" value={draft.segment || ""} onChange={v=>setDraft({...draft,segment:v})}/><Field label="Nome do painel" value={draft.panel_name || ""} onChange={v=>setDraft({...draft,panel_name:v})}/><label><span className="text-xs font-semibold text-slate-500">Status</span><select value={draft.status || "Online"} onChange={e=>setDraft({...draft,status:e.target.value as Status})} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3"><option>Online</option><option>Atenção</option><option>Offline</option></select></label><Field wide label="URL do painel" value={draft.panel_url || ""} onChange={v=>setDraft({...draft,panel_url:v})}/><Field wide label="URL da alimentação" value={draft.feed_url || ""} onChange={v=>setDraft({...draft,feed_url:v})}/><Field wide label="URL da base" value={draft.base_url || ""} onChange={v=>setDraft({...draft,base_url:v})}/></div><div className="mt-6 flex justify-end gap-3"><button onClick={()=>{setDraft(null);setEditingId(null)}} className="rounded-xl border border-slate-200 px-4 py-3 font-semibold">Cancelar</button><button disabled={busy} onClick={saveClient} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white disabled:opacity-50">Salvar</button></div></div></div>}
  </div>;
}

function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-bold text-[#0b3977]">{title}</h1><p className="mt-1 text-slate-500">{subtitle}</p></div>{action}</div>; }
function Field({ label, value, onChange, wide=false }: { label:string; value:string; onChange:(v:string)=>void; wide?:boolean }) { return <label className={wide?"sm:col-span-2":""}><span className="text-xs font-semibold text-slate-500">{label}</span><input value={value} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>; }
function ClientTable({ data, canEdit, onEdit, onOpen }: { data:Client[]; canEdit:boolean; onEdit:(c?:Client)=>void; onOpen:(u:string,l:string)=>void }) { return <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="p-3">Cliente</th><th className="p-3">Status</th><th className="p-3">Monitoramento</th><th className="p-3">Ações</th></tr></thead><tbody>{data.map(c=><tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50"><td className="p-3"><div className="font-bold">{c.name}</div><div className="text-xs text-slate-400">{c.panel_name}</div></td><td className="p-3"><Badge status={c.status}/></td><td className="p-3 text-slate-500">{c.monitor}</td><td className="p-3"><div className="flex flex-wrap gap-3"><button onClick={()=>onOpen(c.panel_url,"painel")} className="font-semibold text-blue-600">Abrir painel</button>{canEdit && <button onClick={()=>onEdit(c)} className="font-semibold text-[#0b3977]">Editar links</button>}</div></td></tr>)}</tbody></table></div>; }
