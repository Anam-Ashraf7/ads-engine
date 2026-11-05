// PROTOTYPE: which mode the Google Ads server is in (test or live), its caps and the chosen account, shared by every page.
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setAccount, type Health } from './api';

interface LiveMode {
  health: Health | null;
  live: boolean;
  account: string | null;
  accounts: { id: string; name?: string; currency?: string; testAccount?: boolean }[];
  currency: string;
  chooseAccount: (id: string) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<LiveMode>(null!);
export const useLiveMode = () => useContext(Ctx);

export function LiveModeProvider({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [account, setAcc] = useState<string | null>(null);

  const refresh = useCallback(async () => setHealth(await api.health()), []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const accounts = (health?.accounts ?? []).filter((a) => a.role === 'account' || a.role === 'client').map(({ id, name, currency, testAccount }) => ({ id, name, currency, testAccount }));
  const current = account ?? health?.allowlist?.[0] ?? accounts[0]?.id ?? null;
  const chooseAccount = (id: string) => {
    setAccount(id);
    setAcc(id);
  };

  return (
    <Ctx.Provider
      value={{
        health,
        live: health?.mode === 'live',
        account: current,
        accounts,
        currency: accounts.find((a) => a.id === current)?.currency ?? 'USD',
        chooseAccount,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

/** Full-width red strip on every page while the server is pointed at real accounts. */
export function LiveAlarm() {
  const { live, account, accounts, health } = useLiveMode();
  if (!live) return null;
  const a = accounts.find((x) => x.id === account);
  return (
    <div className="live-alarm" role="alert">
      <b>LIVE ACCOUNT · real money</b>
      <span>
        Google Ads {account}
        {a?.name ? ` “${a.name}”` : ''} · daily budgets up to {health?.caps?.maxDailyBudget} · monthly cap {health?.caps?.monthlyCap} {a?.currency ?? ''}
      </span>
    </div>
  );
}
