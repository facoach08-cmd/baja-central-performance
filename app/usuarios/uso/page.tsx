"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type UsageRow = {
  user_id: string;
  email: string;
  full_name: string | null;
  role: string;
  active: boolean;
  last_access_at: string | null;
  accesses_7d: number;
  accesses_30d: number;
  clients_accessed_30d: number;
};

type AllowedEmail = {
  email: string;
  role: string;
};

function fmt(value: string | null) {
  if (!value) return "Nunca";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function UserUsagePage() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<UsageRow[]>([]);
  const [allowed, setAllowed] = useState<AllowedEmail[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("viewer");
  const [busyKey, setBusyKey] = useState<string | null>(null);

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
      .select("role,active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.active || profile.role !== "admin") {
      setError("Esta visão é exclusiva para administradores da Central.");
      setLoading(false);
      return;
    }

    setAuthorized(true);
    await refresh();
    setLoading(false);
  }

  async function refresh() {
    setError("");
    const [usageResult, allowedResult] = await Promise.all([
      supabase.rpc("baja_central_get_user_usage"),
      supabase.from("baja_central_allowed_emails").select("email,role").order("email"),
    ]);

    if (usageResult.error) setError(usageResult.error.message);
    else setRows((usageResult.data || []) as UsageRow[]);

    if (allowedResult.error) setError(prev => prev || allowedResult.error.message);
    else setAllowed((allowedResult.data || []) as AllowedEmail[]);
  }

  async function addAllowedEmail() {
    const email = newEmail.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setNotice("Informe um e-mail válido.");
      return;
    }
    setBusyKey("add"); setNotice("");
    const { error } = await supabase.rpc("baja_central_admin_upsert_allowed_email", { p_email: email, p_role: newRole });
    if (error) setNotice(`Não foi possível liberar o acesso: ${error.message}`);
    else {
      setNotice("E-mail autorizado. A pessoa já pode usar a opção de primeiro acesso.");
      setNewEmail(""); setNewRole("viewer");
      await refresh();
    }
    setBusyKey(null);
  }

  async function setRole(row: UsageRow, role: string) {
    setBusyKey(`role:${row.user_id}`); setNotice("");
    const { error } = await supabase.rpc("baja_central_admin_set_user_role", { p_user_id: row.user_id, p_role: role });
    if (error) setNotice(`Não foi possível alterar o perfil: ${error.message}`);
    else { setNotice(`Perfil de ${row.email} atualizado para ${role === "admin" ? "Admin" : "Viewer"}.`); await refresh(); }
    setBusyKey(null);
  }

  async function setActive(row: UsageRow, active: boolean) {
    setBusyKey(`active:${row.user_id}`); setNotice("");
    const { error } = await supabase.rpc("baja_central_admin_set_user_active", { p_user_id: row.user_id, p_active: active });
    if (error) setNotice(`Não foi possível alterar o acesso: ${error.message}`);
    else { setNotice(`${row.email} foi ${active ? "ativado" : "desativado"}.`); await refresh(); }
    setBusyKey(null);
  }

  async function removeAuthorization(email: string) {
    const linked = rows.find(r => r.email.toLowerCase() === email.toLowerCase());
    const ok = window.confirm(linked ? `Remover ${email} da lista de autorizados? O perfil atual continuará existindo até você desativá-lo.` : `Remover ${email} da lista de autorizados?`);
    if (!ok) return;
    setBusyKey(`remove:${email}`); setNotice("");
    const { error } = await supabase.rpc("baja_central_admin_remove_allowed_email", { p_email: email });
    if (error) setNotice(`Não foi possível remover a autorização: ${error.message}`);
    else { setNotice(`${email} removido da lista de primeiro acesso.`); await refresh(); }
    setBusyKey(null);
  }

  const totals = useMemo(() => ({
    users: rows.length,
    active: rows.filter(r => r.active).length,
    accesses7d: rows.reduce((sum, r) => sum + (r.accesses_7d || 0), 0),
    accesses30d: rows.reduce((sum, r) => sum + (r.accesses_30d || 0), 0),
  }), [rows]);

  if (loading) return <div className="grid min-h-screen place-items-center bg-[#f4f7fb] text-[#0b3977]">Carregando uso da Central...</div>;

  if (!authorized) return <div className="min-h-screen bg-[#f4f7fb] p-6"><div className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-bold text-[#0b3977]">Usuários e Acessos</h1><p className="mt-3 text-slate-600">{error}</p><a href="/" className="mt-5 inline-block rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Voltar para a Central</a></div></div>;

  return <div className="min-h-screen bg-[#f4f7fb] p-4 text-[#123563] md:p-8">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <a href="/" className="text-sm font-semibold text-blue-600">← Voltar para a Central</a>
          <h1 className="mt-2 text-3xl font-bold text-[#0b3977]">Usuários e Acessos</h1>
          <p className="mt-1 text-slate-500">Governança de acesso, perfil e adoção da equipe interna.</p>
        </div>
        <button onClick={() => void refresh()} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold">Atualizar dados</button>
      </div>

      {(notice || error) && <div className={`mt-5 rounded-xl border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-blue-200 bg-blue-50 text-blue-700"}`}>{error || notice}</div>}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Usuários cadastrados", totals.users, "Perfis internos"],
          ["Usuários ativos", totals.active, "Com acesso liberado"],
          ["Acessos em 7 dias", totals.accesses7d, "Painéis, fontes e bases"],
          ["Acessos em 30 dias", totals.accesses30d, "Uso acumulado recente"],
        ].map(([label, value, note]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-bold text-[#0b3977]">{value}</div><div className="mt-2 text-xs text-slate-400">{note}</div></div>)}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#0b3977]">Liberar novo acesso</h2>
            <p className="mt-1 text-sm text-slate-500">Cadastre o e-mail primeiro. Depois a pessoa usa “Primeiro acesso” na tela de login.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[280px_150px_auto]">
            <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="nome@empresa.com" className="rounded-xl border border-slate-200 px-4 py-3 text-sm" />
            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="rounded-xl border border-slate-200 px-4 py-3 text-sm"><option value="viewer">Viewer</option><option value="admin">Admin</option></select>
            <button disabled={busyKey === "add"} onClick={() => void addAllowedEmail()} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busyKey === "add" ? "Salvando..." : "Autorizar e-mail"}</button>
          </div>
        </div>
      </section>

      <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4"><h2 className="text-lg font-bold text-[#0b3977]">Usuários cadastrados</h2><p className="mt-1 text-sm text-slate-500">Altere perfil, ative ou desative o acesso sem entrar no Supabase.</p></div>
        <table className="w-full min-w-[1100px] text-sm">
          <thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="p-3">Usuário</th><th className="p-3">Perfil</th><th className="p-3">Status</th><th className="p-3">Último acesso</th><th className="p-3">Acessos 7d</th><th className="p-3">Acessos 30d</th><th className="p-3">Clientes 30d</th><th className="p-3">Ações</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.user_id} className="border-b border-slate-100"><td className="p-3"><div className="font-semibold">{row.full_name || row.email}</div><div className="text-xs text-slate-400">{row.email}</div></td><td className="p-3"><select disabled={busyKey === `role:${row.user_id}`} value={row.role} onChange={e => void setRole(row, e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold"><option value="viewer">Viewer</option><option value="admin">Admin</option></select></td><td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{row.active ? "Ativo" : "Inativo"}</span></td><td className="p-3 text-slate-500">{fmt(row.last_access_at)}</td><td className="p-3 font-semibold">{row.accesses_7d}</td><td className="p-3 font-semibold">{row.accesses_30d}</td><td className="p-3 font-semibold">{row.clients_accessed_30d}</td><td className="p-3"><button disabled={busyKey === `active:${row.user_id}`} onClick={() => void setActive(row, !row.active)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${row.active ? "border border-red-200 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{row.active ? "Desativar" : "Ativar"}</button></td></tr>)}</tbody>
        </table>
        {rows.length === 0 && <div className="p-6 text-center text-sm text-slate-500">Ainda não há usuários cadastrados.</div>}
      </section>

      <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4"><h2 className="text-lg font-bold text-[#0b3977]">E-mails autorizados</h2><p className="mt-1 text-sm text-slate-500">Lista que permite criar o primeiro acesso.</p></div>
        <table className="w-full min-w-[700px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="p-3">E-mail</th><th className="p-3">Perfil inicial</th><th className="p-3">Situação</th><th className="p-3">Ação</th></tr></thead><tbody>{allowed.map(item => { const linked = rows.find(r => r.email.toLowerCase() === item.email.toLowerCase()); return <tr key={item.email} className="border-b border-slate-100"><td className="p-3 font-semibold">{item.email}</td><td className="p-3 capitalize">{item.role}</td><td className="p-3 text-slate-500">{linked ? "Usuário já criado" : "Aguardando primeiro acesso"}</td><td className="p-3"><button disabled={busyKey === `remove:${item.email}`} onClick={() => void removeAuthorization(item.email)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600">Remover autorização</button></td></tr>; })}</tbody></table>
      </section>
    </div>
  </div>;
}
