import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Loader2, ShieldCheck, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const TOKEN_KEY = "mfa-session-token-v1";

type Phase = "loading" | "enroll" | "verify" | "unlocked";

async function callAuth<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("totp-auth", { body: payload });
  if (error) {
    let detail = error.message;
    const context = (error as { context?: { text?: () => Promise<string> } }).context;
    if (context?.text) {
      const raw = await context.text().catch(() => "");
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.error) detail = parsed.error;
      } catch {
        if (raw) detail = raw;
      }
    }
    throw new Error(detail);
  }
  return data as T;
}

const AuthGate = ({ children }: { children: React.ReactNode }) => {
  const [phase, setPhase] = useState<Phase>("loading");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  const startEnrollment = useCallback(async () => {
    try {
      const res = await callAuth<{ secret: string; otpauth: string }>({ action: "enroll" });
      setSecret(res.secret);
      setQr(await QRCode.toDataURL(res.otpauth, { width: 220, margin: 1 }));
      setPhase("enroll");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start setup");
      setPhase("verify");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = localStorage.getItem(TOKEN_KEY);
        const res = await callAuth<{ valid?: boolean; enrolled: boolean }>(
          token ? { action: "session", token } : { action: "status" },
        );
        if (cancelled) return;
        if (res.valid) {
          setPhase("unlocked");
          return;
        }
        localStorage.removeItem(TOKEN_KEY);
        if (res.enrolled) setPhase("verify");
        else await startEnrollment();
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not reach the security check");
          setPhase("verify");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [startEnrollment]);

  const submit = async (value: string) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await callAuth<{ token: string }>({
        action: phase === "enroll" ? "confirm" : "verify",
        code: value,
      });
      localStorage.setItem(TOKEN_KEY, res.token);
      setSecret(null);
      setQr(null);
      setPhase("unlocked");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  if (phase === "unlocked") {
    return (
      <>
        <div className="pointer-events-none fixed bottom-3 right-3 z-50">
          <Button
            size="sm"
            variant="outline"
            className="pointer-events-auto h-7 gap-1.5 text-xs"
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              setCode("");
              setPhase("verify");
            }}
          >
            <LogOut className="h-3.5 w-3.5" />
            Lock
          </Button>
        </div>
        {children}
      </>
    );
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background gradient-mesh">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background gradient-mesh px-4 py-10">
      <Card className="w-full max-w-sm space-y-5 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-foreground">
              {phase === "enroll" ? "Set up your authenticator" : "Two-step verification"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {phase === "enroll"
                ? "Scan this with Authy, Google Authenticator or similar."
                : "Enter the 6-digit code from your authenticator app."}
            </p>
          </div>
        </div>

        {phase === "enroll" && (
          <div className="space-y-2">
            {qr && (
              <img
                src={qr}
                alt="QR code to add this app to your authenticator"
                className="mx-auto h-44 w-44 rounded-lg bg-white p-2"
              />
            )}
            {secret && (
              <div className="space-y-1 text-center">
                <p className="text-xs text-muted-foreground">Or enter this key manually</p>
                <p className="break-all font-mono text-xs text-foreground">{secret}</p>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col items-center gap-3">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={(value) => {
              setCode(value);
              setError(null);
              if (value.length === 6) void submit(value);
            }}
            disabled={busy}
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>

          {error && <p className="text-center text-xs text-destructive">{error}</p>}

          <Button className="w-full" disabled={busy || code.length !== 6} onClick={() => void submit(code)}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {phase === "enroll" ? "Confirm and continue" : "Unlock"}
          </Button>
        </div>
      </Card>
    </main>
  );
};

export default AuthGate;
