"use client";
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
          ? "E-mail ou mot de passe incorrect."
          : `Connexion impossible : ${error.message}`,
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
                <path d="M5 22l7-7 5 5 10-11" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="brand-name">Yassni Trading Hub</div>
              <div className="brand-sub">Espace privé</div>
            </div>
          </div>
          <label className="field">
            <span>E-mail</span>
            <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="field">
            <span>Mot de passe</span>
            <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="notice err">{error}</div>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Connexion…" : "Se connecter"}
          </button>
        </div>
      </form>
    </main>
  );
}
