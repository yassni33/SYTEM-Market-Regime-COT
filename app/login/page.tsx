"use client";
import BrandName from "@/components/BrandName";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password });
    if (error) {
      setError(
        error.message.includes("Invalid login")
          ? "Wrong email or password."
          : `Sign-in failed: ${error.message}`,
      );
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <form onSubmit={submit} className="card" style={{ width: "min(380px, 100%)" }}>
        <div className="card-b stack">
          <div className="brand" style={{ padding: 0 }}>
            <div className="brand-mark">
              <svg width="18" height="18" viewBox="0 0 32 32" aria-hidden="true">
                <path d="M5 22l7-7 5 5 10-11" fill="none" stroke="var(--on-accent)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <BrandName />
              <div className="brand-sub">Private space</div>
            </div>
          </div>
          <label className="field">
            <span>Email</span>
            <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Password</span>
            <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="notice err">{error}</div>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </div>
      </form>
    </main>
  );
}
