"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Account, Trade } from "@/lib/journal";

const KEY = "yth-account";

export function useJournal() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accountId, setAccountIdState] = useState<string>("all");

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY);
      if (v) setAccountIdState(v);
    } catch {}
  }, []);
  const setAccountId = (v: string) => {
    setAccountIdState(v);
    try {
      localStorage.setItem(KEY, v);
    } catch {}
  };

  const reload = useCallback(async () => {
    const sb = supabaseBrowser();
    setLoading(true);
    const [a, t] = await Promise.all([
      sb.from("accounts").select("*").order("created_at"),
      sb.from("trades").select("*").order("opened_at", { ascending: false }).limit(5000),
    ]);
    if (a.error || t.error) setError((a.error ?? t.error)!.message);
    else setError(null);
    setAccounts(
      ((a.data ?? []) as Account[]).map((x) => ({ ...x, initial_balance: Number(x.initial_balance) })),
    );
    setTrades(
      ((t.data ?? []) as Trade[]).map((x) => ({
        ...x,
        pnl: Number(x.pnl),
        fees: Number(x.fees ?? 0),
        lot: x.lot == null ? null : Number(x.lot),
        entry: x.entry == null ? null : Number(x.entry),
        exit: x.exit == null ? null : Number(x.exit),
        sl: x.sl == null ? null : Number(x.sl),
        tp: x.tp == null ? null : Number(x.tp),
        mistakes: x.mistakes ?? [],
        screenshots: x.screenshots ?? [],
      })),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const validId = accountId === "all" || accounts.some((a) => a.id === accountId) ? accountId : "all";
  const selected = accounts.filter((a) => validId === "all" || a.id === validId);
  const filtered = useMemo(
    () => (validId === "all" ? trades : trades.filter((t) => t.account_id === validId)),
    [trades, validId],
  );
  const initialBalance = selected.reduce((s, a) => s + a.initial_balance, 0);
  const currency = selected[0]?.currency ?? "USD";

  return {
    accounts,
    trades,
    filtered,
    loading,
    error,
    reload,
    accountId: validId,
    setAccountId,
    initialBalance,
    currency,
  };
}

export type Journal = ReturnType<typeof useJournal>;
