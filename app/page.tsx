"use client";

import { useMemo, useState } from "react";

type Status = "Ativo" | "Atenção" | "Crítico";
type Client = {
  name: string;
  segment: string;
  panel: string;
  status: Status;
  updated: string;
  accesses: number;
  panelUrl: string;
  feedUrl: string;
  baseUrl: string;
};

const seed: Client[] = [
  { name: "Múltipla", segment: "Comercial", panel: "Painel de Vendedores", status: "Ativo", updated: "Hoje, 08:12", accesses: 482, panelUrl: "", feedUrl: "", baseUrl: "" },
  { name: "Água Viva", segment: "Comercial", panel: "Painel Comercial", status: "Ativo", updated: "Hoje, 07:45", accesses: 396, panelUrl: "", feedUrl: "", baseUrl: "" },
  { name: "Casa da Borracha", segment: "Expedição", panel: "Painel de Expedição", status: "Atenção", updated: "Há 2 dias", accesses: 210, panelUrl: "", feedUrl: "", baseUrl: "" },
  { name: "Montes", segment: "Financeiro", panel: "Painel Financeiro", status: "Crítico", updated: "Há 6 dias", accesses: 377, panelUrl: "", feedUrl: "", baseUrl: "" },
];

const nav = ["Início", "Clientes", "Painéis", "Alertas", "Usuários", "Configurações"];

function Badge({ status }: { status: Status }) {
  const cls = status === "Ativo" ? "bg-emerald-50 text-emerald-700" : status === "Atenção" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700";
  return <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}><span className="h-2 w-2 rounded-full bg-current" />{status}</span>;
}

function Card({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-bold text-[#0b3977]">{value}</div><div className="mt-2 text-xs text-slate-400">{note}</div></div>;
}

export default function Home() {
  const [view, setView] = useState("Início");
  const [clients, setClients] = useState(seed);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState<Client | null>(null);

  const filtered = useMemo(() => clients.filter(c => `${c.name} ${c.segment} ${c.panel}`.toLowerCase().includes(query.toLowerCase())), [clients, query]);
  const active = clients.filter(c => c.status === "Ativo").length;
  const issues = clients.length - active;

  function edit(index?: number) {
    if (typeof index === "number") {
      setEditing(index);
      setDraft({ ...clients[index] });
    } else {
      setEditing(-1);
      setDraft({ name: "", segment: "", panel: "", status: "Ativo", updated: "Agora", accesses: 0, panelUrl: "", feedUrl: "", baseUrl: "" });
    }
  }

  function save() {
    if (!draft?.name) return;
    if (editing === -1) setClients([...clients, draft]);
    if (editing !== null && editing >= 0) setClients(clients.map((c, i) => i === editing ? draft : c));
    setDraft(null); setEditing(null);
  }

  function open(url: string, label: string) {
    if (!url) return alert(`Cadastre primeiro o link de ${label}.`);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return <div className="min-h-screen bg-[#f4f7fb] text-[#123563]">
    <div className="grid min-h-screen md:grid-cols-[240px_1fr]">
      <aside className="bg-gradient-to-b from-[#0b3977] to-[#062b59] px-4 py-7 text-white">
        <div className="px-3 pb-8">
          <div className="text-[22px] font-extrabold tracking-wide">BAJA & AGUIAR</div>
          <div className="mt-1 text-[10px] tracking-[.22em] text-blue-100">CONSULTORIA EMPRESARIAL</div>
          <div className="mt-5 border-t border-white/20 pt-4 text-sm font-semibold">Central de Performance</div>
        </div>
        <nav className="grid gap-2">{nav.map(item => <button key={item} onClick={() => setView(item)} className={`rounded-xl px-4 py-3 text-left text-sm ${view === item ? "bg-[#1f69bd]" : "text-blue-100 hover:bg-white/10"}`}>{item}</button>)}</nav>
        <div className="mt-10 border-t border-white/20 px-3 pt-6 text-blue-100"><div className="text-xl font-bold text-white">Método antes<br/>de opinião.</div><div className="mt-4 leading-7">Diagnóstico.<br/>Estratégia.<br/>Acompanhamento.</div></div>
      </aside>

      <main className="min-w-0 px-4 pb-10 md:px-7">
        <header className="flex h-20 items-center gap-4"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar cliente, painel ou ferramenta..." className="hidden w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none sm:block"/><div className="ml-auto flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-full bg-[#0b3977] font-bold text-white">FA</div><div className="hidden sm:block"><div className="font-semibold">Felipe Aguiar</div><div className="text-xs text-slate-500">Administrador</div></div></div></header>

        {view === "Início" && <>
          <section className="rounded-2xl bg-gradient-to-r from-[#0b3977] via-[#10519a] to-[#2e78c6] p-8 text-white shadow-sm"><h1 className="text-3xl font-bold md:text-4xl">Mais clareza para melhores decisões.</h1><p className="mt-3 max-w-2xl text-blue-100">Acompanhe em um só lugar os painéis, ferramentas, bases e sinais de atenção da sua carteira.</p></section>
          <section className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card label="Clientes monitorados" value={clients.length} note="Carteira cadastrada"/><Card label="Painéis ativos" value={active} note="Operando normalmente"/><Card label="Acessos informados" value={clients.reduce((s,c)=>s+c.accesses,0).toLocaleString("pt-BR")} note="Últimos 30 dias"/><Card label="Atenções" value={issues} note="Requer acompanhamento"/></section>
          <section className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]"><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="mb-4 flex items-center justify-between"><h2 className="font-bold">Saúde dos projetos</h2><button className="text-sm font-semibold text-blue-600" onClick={()=>setView("Clientes")}>Ver todos →</button></div><ClientTable data={clients} onEdit={edit} onOpen={open}/></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h2 className="font-bold">Acessos rápidos</h2><div className="mt-4 grid gap-2">{clients.map((c,i)=><button key={c.name} onClick={()=>edit(i)} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-left hover:bg-blue-50"><span><strong>{c.name}</strong><span className="block text-xs text-slate-500">{c.panel}</span></span><span className="text-blue-600">→</span></button>)}</div></div></section>
        </>}

        {view === "Clientes" && <><PageTitle title="Clientes" subtitle="Gerencie clientes, painéis e links de acesso." action={<button onClick={()=>edit()} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">+ Novo cliente</button>}/><div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card label="Total" value={clients.length} note="Clientes cadastrados"/><Card label="Ativos" value={active} note="Sem pendências"/><Card label="Atenção" value={clients.filter(c=>c.status==="Atenção").length} note="Acompanhar"/><Card label="Críticos" value={clients.filter(c=>c.status==="Crítico").length} note="Ação imediata"/></div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><ClientTable data={filtered} onEdit={i=>edit(clients.indexOf(filtered[i]))} onOpen={open}/></div></>}

        {view === "Painéis" && <><PageTitle title="Painéis e Ferramentas" subtitle="Abra qualquer ambiente sem procurar links em mensagens." action={<button onClick={()=>edit()} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">+ Novo painel</button>}/><div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><table className="w-full min-w-[900px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="p-3">Painel</th><th className="p-3">Cliente</th><th className="p-3">Status</th><th className="p-3">Atualização</th><th className="p-3">Painel</th><th className="p-3">Alimentação</th><th className="p-3">Base</th></tr></thead><tbody>{clients.map(c=><tr key={c.name} className="border-b border-slate-100"><td className="p-3 font-semibold">{c.panel}</td><td className="p-3">{c.name}</td><td className="p-3"><Badge status={c.status}/></td><td className="p-3">{c.updated}</td><td className="p-3"><button onClick={()=>open(c.panelUrl,"painel")} className="text-blue-600 underline">Abrir</button></td><td className="p-3"><button onClick={()=>open(c.feedUrl,"alimentação")} className="text-blue-600 underline">Abrir</button></td><td className="p-3"><button onClick={()=>open(c.baseUrl,"base")} className="text-blue-600 underline">Abrir</button></td></tr>)}</tbody></table></div></>}

        {view === "Alertas" && <><PageTitle title="Alertas" subtitle="Pendências e projetos que merecem atenção."/><div className="grid gap-3">{clients.filter(c=>c.status!=="Ativo").map(c=><div key={c.name} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`grid h-11 w-11 place-items-center rounded-xl font-bold ${c.status==="Crítico"?"bg-red-50 text-red-600":"bg-amber-50 text-amber-600"}`}>!</div><div className="flex-1"><div className="font-bold">{c.name} — {c.status}</div><div className="mt-1 text-sm text-slate-500">Última atualização: {c.updated}. Validar alimentação, painel e integração.</div></div></div>)}</div></>}

        {view === "Usuários" && <><PageTitle title="Usuários e Acessos" subtitle="Acesso restrito para você, seu sócio e equipe autorizada."/><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Card label="Usuários ativos" value="3" note="Equipe interna"/><Card label="Administradores" value="2" note="Acesso total"/><Card label="Visualizadores" value="1" note="Leitura"/><Card label="Último acesso" value="Agora" note="Felipe Aguiar"/></div></>}

        {view === "Configurações" && <><PageTitle title="Configurações" subtitle="Preferências da Central de Performance."/><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Identidade</h2><p className="mt-4 text-sm text-slate-500">Baja & Aguiar | Central de Performance</p><p className="mt-2 text-sm text-slate-500">bajaeaguiar.com</p></div><div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="font-bold">Próxima integração</h2><p className="mt-4 text-sm leading-6 text-slate-500">Conectar Supabase e APIs para registrar automaticamente última alimentação, acessos e status de integração.</p></div></div></>}
      </main>
    </div>

    {draft && <div className="fixed inset-0 z-50 grid place-items-center bg-[#061d3c]/60 p-4"><div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-2xl font-bold">{editing===-1?"Novo cliente":"Editar cliente"}</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="Cliente" value={draft.name} onChange={v=>setDraft({...draft,name:v})}/><Field label="Segmento" value={draft.segment} onChange={v=>setDraft({...draft,segment:v})}/><Field label="Nome do painel" value={draft.panel} onChange={v=>setDraft({...draft,panel:v})}/><label><span className="text-xs font-semibold text-slate-500">Status</span><select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Status})} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3"><option>Ativo</option><option>Atenção</option><option>Crítico</option></select></label><Field wide label="URL do painel" value={draft.panelUrl} onChange={v=>setDraft({...draft,panelUrl:v})}/><Field wide label="URL da alimentação" value={draft.feedUrl} onChange={v=>setDraft({...draft,feedUrl:v})}/><Field wide label="URL da base" value={draft.baseUrl} onChange={v=>setDraft({...draft,baseUrl:v})}/></div><div className="mt-6 flex justify-end gap-3"><button onClick={()=>{setDraft(null);setEditing(null)}} className="rounded-xl border border-slate-200 px-4 py-3 font-semibold">Cancelar</button><button onClick={save} className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white">Salvar</button></div></div></div>}
  </div>;
}

function PageTitle({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) {
  return <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-bold text-[#0b3977]">{title}</h1><p className="mt-1 text-slate-500">{subtitle}</p></div>{action}</div>;
}

function Field({ label, value, onChange, wide=false }: { label:string; value:string; onChange:(v:string)=>void; wide?:boolean }) {
  return <label className={wide?"sm:col-span-2":""}><span className="text-xs font-semibold text-slate-500">{label}</span><input value={value} onChange={e=>onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-4 py-3"/></label>;
}

function ClientTable({ data, onEdit, onOpen }: { data: Client[]; onEdit:(i:number)=>void; onOpen:(url:string,label:string)=>void }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="p-3">Cliente</th><th className="p-3">Status</th><th className="p-3">Última alimentação</th><th className="p-3">Acessos</th><th className="p-3">Ações</th></tr></thead><tbody>{data.map((c,i)=><tr key={c.name} className="border-b border-slate-100"><td className="p-3"><div className="font-bold">{c.name}</div><div className="text-xs text-slate-400">{c.segment}</div></td><td className="p-3"><Badge status={c.status}/></td><td className="p-3">{c.updated}</td><td className="p-3 font-semibold">{c.accesses}</td><td className="p-3"><div className="flex gap-3"><button onClick={()=>onOpen(c.panelUrl,"painel")} className="text-blue-600 underline">Painel</button><button onClick={()=>onOpen(c.feedUrl,"alimentação")} className="text-blue-600 underline">Alimentação</button><button onClick={()=>onEdit(i)} className="font-semibold text-[#0b3977]">Editar</button></div></td></tr>)}</tbody></table></div>;
}
