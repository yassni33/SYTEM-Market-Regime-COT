"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { Account, Trade, Transaction } from "@/lib/journal";

const KEY = "yth-account";

export function useJournal() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txError, setTxError] = useState<string | null>(null);
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
    const [a, t, x] = await Promise.all([
      sb.from("accounts").select("*").order("created_at"),
      sb.from("trades").select("*").order("opened_at", { ascending: false }).limit(5000),
      sb.from("account_transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
    ]);
    // Erreur séparée : le reste du journal marche même si la table des mouvements n'existe pas encore.
    setTxError(
      x.error
        ? x.error.code === "42P01" || /account_transactions/.test(x.error.message)
          ? "La table des retraits et dépôts n’existe pas encore : colle le fichier supabase/2026-11-20_account_transactions.sql dans le SQL Editor de Supabase."
          : x.error.message
        : null,
    );
    setTransactions(((x.data ?? []) as Transaction[]).map((r) => ({ ...r, amount: Number(r.amount) })));
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
  const filteredTx = useMemo(
    () => (validId === "all" ? transactions : transactions.filter((t) => t.account_id === validId)),
    [transactions, validId],
  );
  const initialBalance = selected.reduce((s, a) => s + a.initial_balance, 0);
  const currency = selected[0]?.currency ?? "USD";

  return {
    accounts,
    trades,
    filtered,
    transactions,
    filteredTx,
    txError,
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
