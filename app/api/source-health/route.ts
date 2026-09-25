import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://iuyyvpotkgsuuipyfisw.supabase.co";

async function runSync() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clientId || !clientSecret || !refreshToken || !serviceRole) {
    return NextResponse.json({ ok: false, error: "Missing server configuration" }, { status: 500 });
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });

  const tokenData = await tokenResponse.json();
  if (!tokenResponse.ok || !tokenData.access_token) {
    return NextResponse.json({
      ok: false,
      error: "Google token refresh failed",
      google_error: tokenData?.error || null,
      google_error_description: tokenData?.error_description || null,
    }, { status: 502 });
  }

  const supabase = createClient(SUPABASE_URL, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sources, error: sourceError } = await supabase
    .from("baja_central_data_sources")
    .select("id,client_id,source_name,provider,external_id,active")
    .eq("active", true);

  if (sourceError) {
    return NextResponse.json({ ok: false, error: sourceError.message }, { status: 500 });
  }

  const checkedAt = new Date().toISOString();
  const results: Array<Record<string, unknown>> = [];

  for (const source of sources || []) {
    const provider = String(source.provider || "").toLowerCase();
    if (!provider.includes("google")) continue;

    const fileId = String(source.external_id || "").trim();
    if (!fileId) {
      const message = "Missing Google file ID";
      await supabase.from("baja_central_data_sources").update({
        last_checked_at: checkedAt,
        last_check_status: "error",
        last_check_error: message,
        updated_at: checkedAt,
      }).eq("id", source.id);
      results.push({ id: source.id, source_name: source.source_name, status: "error", error: message });
      continue;
    }

    try {
      const metadataResponse = await fetch(
        "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?fields=id,name,modifiedTime&supportsAllDrives=true",
        {
          headers: { authorization: "Bearer " + tokenData.access_token },
          cache: "no-store",
        },
      );

      const metadata = await metadataResponse.json();
      if (!metadataResponse.ok || !metadata.modifiedTime) {
        const googleMessage = metadata?.error?.message || "Drive metadata lookup failed";
        throw new Error("Drive API " + metadataResponse.status + ": " + googleMessage);
      }

      const { error: updateError } = await supabase
        .from("baja_central_data_sources")
        .update({
          last_provider_modified_at: metadata.modifiedTime,
          last_checked_at: checkedAt,
          last_check_status: "ok",
          last_check_error: null,
          updated_at: checkedAt,
        })
        .eq("id", source.id);

      if (updateError) throw updateError;

      results.push({
        id: source.id,
        client_id: source.client_id,
        source_name: source.source_name,
        modified_time: metadata.modifiedTime,
        status: "ok",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await supabase.from("baja_central_data_sources").update({
        last_checked_at: checkedAt,
        last_check_status: "error",
        last_check_error: message,
        updated_at: checkedAt,
      }).eq("id", source.id);
      results.push({ id: source.id, source_name: source.source_name, status: "error", error: message });
    }
  }

  const { data: refreshedSources } = await supabase
    .from("baja_central_data_sources")
    .select("client_id,last_provider_modified_at")
    .eq("active", true)
    .not("last_provider_modified_at", "is", null);

  const latest = new Map<string, string>();
  for (const row of refreshedSources || []) {
    const current = latest.get(row.client_id);
    if (!current || new Date(row.last_provider_modified_at).getTime() > new Date(current).getTime()) {
      latest.set(row.client_id, row.last_provider_modified_at);
    }
  }

  for (const [clientIdValue, lastFeedAt] of latest.entries()) {
    await supabase.from("baja_central_clients").update({
      last_feed_at: lastFeedAt,
      updated_at: checkedAt,
    }).eq("id", clientIdValue);
  }

  return NextResponse.json({
    ok: true,
    checked_at: checkedAt,
    checked: results.length,
    updated: results.filter((item) => item.status === "ok").length,
    errors: results.filter((item) => item.status === "error").length,
    results,
  });
}

export async function GET() {
  return runSync();
}

export async function POST() {
  return runSync();
}
