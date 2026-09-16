import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours
const ISSUER = "Stock Market Prediction";
const ACCOUNT = "owner";
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function randomBase32(bytes = 20): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function base32Decode(input: string): Uint8Array {
  const clean = input.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = B32.indexOf(char);
    if (idx < 0) throw new Error("Invalid base32 character in secret");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

async function hmac(algo: "SHA-1" | "SHA-256", key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: algo }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, data);
  return new Uint8Array(sig);
}

async function totpAt(secret: string, step: number): Promise<string> {
  const key = base32Decode(secret);
  const counter = new Uint8Array(8);
  let value = step;
  for (let i = 7; i >= 0; i--) {
    counter[i] = value & 0xff;
    value = Math.floor(value / 256);
  }
  const digest = await hmac("SHA-1", key, counter);
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) |
    (digest[offset + 2] << 8) |
    digest[offset + 3];
  return (binary % 1_000_000).toString().padStart(6, "0");
}

// Returns the matching time step, or null when the code is invalid.
async function verifyTotp(secret: string, code: string, lastUsedStep: number | null): Promise<number | null> {
  const normalized = code.replace(/\D/g, "");
  if (normalized.length !== 6) return null;
  const current = Math.floor(Date.now() / 1000 / 30);
  for (const drift of [0, -1, 1]) {
    const step = current + drift;
    // Replay protection: never accept a step already spent.
    if (lastUsedStep !== null && step <= lastUsedStep) continue;
    const expected = await totpAt(secret, step);
    let diff = 0;
    for (let i = 0; i < 6; i++) diff |= expected.charCodeAt(i) ^ normalized.charCodeAt(i);
    if (diff === 0) return step;
  }
  return null;
}

const enc = new TextEncoder();

function toB64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(input: string): Uint8Array {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(input.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
}

async function issueToken(sessionSecret: string): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const payload = toB64Url(enc.encode(JSON.stringify({ sub: ACCOUNT, exp: expiresAt })));
  const sig = toB64Url(await hmac("SHA-256", enc.encode(sessionSecret), enc.encode(payload)));
  return { token: `${payload}.${sig}`, expiresAt };
}

async function validateToken(sessionSecret: string, token: string): Promise<boolean> {
  const [payload, sig] = String(token ?? "").split(".");
  if (!payload || !sig) return false;
  const expected = toB64Url(await hmac("SHA-256", enc.encode(sessionSecret), enc.encode(payload)));
  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  if (diff !== 0) return false;
  try {
    const decoded = JSON.parse(new TextDecoder().decode(fromB64Url(payload)));
    return typeof decoded.exp === "number" && decoded.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const sessionSecret = Deno.env.get("MFA_SESSION_SECRET");
    if (!sessionSecret) return json({ error: "MFA is not configured" }, 500);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = String(body.action ?? new URL(req.url).searchParams.get("action") ?? "status");

    const { data: record, error: readError } = await supabase
      .from("app_totp")
      .select("id, secret, confirmed, last_used_step")
      .eq("id", "owner")
      .maybeSingle();
    if (readError) return json({ error: "Could not read MFA state" }, 500);

    const enrolled = Boolean(record?.confirmed);

    if (action === "status") return json({ enrolled });

    if (action === "session") {
      const valid = enrolled && (await validateToken(sessionSecret, String(body.token ?? "")));
      return json({ valid, enrolled });
    }

    if (action === "enroll") {
      if (enrolled) return json({ error: "An authenticator is already enrolled" }, 409);
      const secret = record?.secret && !record.confirmed ? record.secret : randomBase32();
      const { error } = await supabase
        .from("app_totp")
        .upsert({ id: "owner", secret, confirmed: false, updated_at: new Date().toISOString() });
      if (error) return json({ error: "Could not start enrollment" }, 500);
      const otpauth = `otpauth://totp/${encodeURIComponent(ISSUER)}:${encodeURIComponent(ACCOUNT)}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`;
      return json({ secret, otpauth });
    }

    if (action === "confirm" || action === "verify") {
      if (!record?.secret) return json({ error: "No authenticator set up yet" }, 400);
      if (action === "confirm" && enrolled) return json({ error: "Already enrolled" }, 409);
      if (action === "verify" && !enrolled) return json({ error: "No authenticator set up yet" }, 400);

      const step = await verifyTotp(record.secret, String(body.code ?? ""), record.last_used_step ?? null);
      if (step === null) return json({ error: "That code is not valid. Try the current one." }, 401);

      const { error } = await supabase
        .from("app_totp")
        .update({ confirmed: true, last_used_step: step, updated_at: new Date().toISOString() })
        .eq("id", "owner");
      if (error) return json({ error: "Could not complete verification" }, 500);

      const { token, expiresAt } = await issueToken(sessionSecret);
      return json({ token, expiresAt });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    console.error("totp-auth failed:", err);
    return json({ error: err instanceof Error ? err.message : "Unexpected error" }, 500);
  }
});
