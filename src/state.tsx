// PROTOTYPE: shared app state (role, date range, in-memory changes, toasts). Nothing is saved.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { SiteState } from './data/mock';

export type Role = 'Viewer' | 'Operator' | 'Manager' | 'Admin';
export const ROLES: Role[] = ['Viewer', 'Operator', 'Manager', 'Admin'];

export type Action =
  | 'pauseCampaign'
  | 'retireCreative'
  | 'salesTask'
  | 'assignOwner'
  | 'setCap'
  | 'startTest'
  | 'approveMove'
  | 'siteState'
  | 'outreach'
  | 'reserveSpot'
  | 'globalPause';

const MIN_ROLE: Record<Action, Role> = {
  pauseCampaign: 'Operator',
  retireCreative: 'Operator',
  salesTask: 'Operator',
  assignOwner: 'Operator',
  siteState: 'Manager',
  setCap: 'Manager',
  startTest: 'Manager',
  approveMove: 'Manager',
  outreach: 'Manager',
  reserveSpot: 'Operator',
  globalPause: 'Admin',
};
export const DISCOUNT_LIMIT: Record<Role, number> = { Viewer: 0, Operator: 10, Manager: 25, Admin: 100 };

/** A change made in this session, shown at the top of the site's activity log. */
export interface SessionChange {
  key: string;
  text: string;
  at: number;
}

interface Toast {
  id: number;
  text: string;
}

interface AppState {
  role: Role;
  setRole: (r: Role) => void;
  can: (a: Action) => boolean;
  needs: (a: Action) => string;
  range: number;
  setRange: (n: number) => void;
  globalPause: boolean;
  setGlobalPause: (b: boolean) => void;
  overrides: Record<string, string>;
  override: (key: string, value: string, msg: string) => void;
  changes: SessionChange[];
  siteState: (id: string, base: SiteState) => SiteState;
  toast: (text: string) => void;
}

const Ctx = createContext<AppState>(null!);
export const useApp = () => useContext(Ctx);

function savedRole(): Role {
  try {
    const r = localStorage.getItem('ae.role') as Role | null;
    return r && ROLES.includes(r) ? r : 'Manager';
  } catch {
    return 'Manager';
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(savedRole);
  useEffect(() => {
    document.documentElement.dataset.skin = 'standard';
  }, []);
  const [range, setRange] = useState(30);
  const [globalPause, setGlobalPause] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [changes, setChanges] = useState<SessionChange[]>([]);

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      role,
      setRole: (r) => {
        setRole(r);
        try {
          localStorage.setItem('ae.role', r);
        } catch {}
      },
      can: (a) => ROLES.indexOf(role) >= ROLES.indexOf(MIN_ROLE[a]),
      needs: (a) => `Needs the ${MIN_ROLE[a]} role`,
      range,
      setRange,
      globalPause,
      setGlobalPause,
      overrides,
      changes,
      override: (key, v, msg) => {
        setOverrides((o) => ({ ...o, [key]: v }));
        setChanges((c) => [{ key, text: msg.replace(/ \(mockup[^)]*\)$/i, ''), at: Date.now() }, ...c]);
        toast(msg);
      },
      siteState: (id, base) => (overrides[`site:${id}`] as SiteState) ?? base,
      toast,
    }),
    [role, range, globalPause, overrides, changes, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
