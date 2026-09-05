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
  const [error, setError] = useState("");

  useEffect(() => {
    async function boot() {
      setLoading(true);
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
      const { data, error: rpcError } = await supabase.rpc("baja_central_get_user_usage");
      if (rpcError) setError(rpcError.message);
      else setRows((data || []) as UsageRow[]);
      setLoading(false);
    }
    boot();
  }, []);

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
          <p className="mt-1 text-slate-500">Acompanhe adoção, recorrência de uso e clientes acessados pela equipe interna.</p>
        </div>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Usuários cadastrados", totals.users, "Perfis internos"],
          ["Usuários ativos", totals.active, "Com acesso liberado"],
          ["Acessos em 7 dias", totals.accesses7d, "Painéis, fontes e bases"],
          ["Acessos em 30 dias", totals.accesses30d, "Uso acumulado recente"],
        ].map(([label, value, note]) => <div key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-bold text-[#0b3977]">{value}</div><div className="mt-2 text-xs text-slate-400">{note}</div></div>)}
      </section>

      <section className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="p-3">Usuário</th><th className="p-3">Perfil</th><th className="p-3">Status</th><th className="p-3">Último acesso</th><th className="p-3">Acessos 7d</th><th className="p-3">Acessos 30d</th><th className="p-3">Clientes 30d</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.user_id} className="border-b border-slate-100"><td className="p-3"><div className="font-semibold">{row.full_name || row.email}</div><div className="text-xs text-slate-400">{row.email}</div></td><td className="p-3 capitalize">{row.role}</td><td className="p-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${row.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{row.active ? "Ativo" : "Inativo"}</span></td><td className="p-3 text-slate-500">{fmt(row.last_access_at)}</td><td className="p-3 font-semibold">{row.accesses_7d}</td><td className="p-3 font-semibold">{row.accesses_30d}</td><td className="p-3 font-semibold">{row.clients_accessed_30d}</td></tr>)}</tbody>
        </table>
        {rows.length === 0 && <div className="p-6 text-center text-sm text-slate-500">Ainda não há usuários com métricas disponíveis.</div>}
      </section>
    </div>
  </div>;
}
