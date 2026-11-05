import { useState, type ReactNode } from 'react';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { ROLES, useApp, type Role } from './state';
import { LAST_DAY, openAlerts, sites } from './data/mock';
import { approvalsWaiting } from './data/meta';
import { longDate } from './format';
import { BrandMark, Icon } from './icons';
import { ApiCheckPage } from './pages/ApiCheckPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { NetworkPage } from './pages/network/NetworkPage';
import { SitePage } from './pages/SitePage';
import { SponsorsPage } from './pages/SponsorsPage';
import { Freshness } from './provenance';
import { LiveAlarm, LiveModeProvider } from './live/mode';
import { Modal } from './ui';
import { signOut } from './Login';

const CRITICAL = openAlerts.filter((a) => a.severity === 'Critical').length;

const NAV: { to: string; label: string; icon: ReactNode; count?: number; end?: boolean; match?: string; test?: boolean }[] = [
  { to: '/', label: 'Network', icon: Icon.network(), end: true, count: CRITICAL },
  { to: '/campaigns', label: 'Campaigns', icon: Icon.campaigns() },
  { to: '/sponsors', label: 'Sponsors & revenue', icon: Icon.sponsors() },
  { to: '/api-check', label: 'API check', icon: Icon.plug(), test: true },
];

function TopBar() {
  const { role, setRole, range, setRange, globalPause, setGlobalPause, can, needs, toast } = useApp();
  const [confirm, setConfirm] = useState(false);
  return (
    <>
      {globalPause && (
        <div className="pause-banner" role="alert">
          {Icon.pause(16)}
          Global pause is on. Every Google Ads and Meta campaign on every site is paused.
          <span className="spacer" />
          {can('globalPause') && (
            <button className="btn sm" onClick={() => (setGlobalPause(false), toast('Global pause lifted (mockup)'))}>
              Lift pause
            </button>
          )}
        </div>
      )}
      <header className="topbar">
        <span className="mock-tag">Mockup · sample data</span>
        <span className="small muted">Data to {longDate(LAST_DAY)}</span>
        <span className="spacer" />
        <div className="seg" role="group" aria-label="Date range">
          {[7, 30, 90].map((n) => (
            <button key={n} className={range === n ? 'on' : ''} aria-pressed={range === n} onClick={() => setRange(n)}>
              {n} days
            </button>
          ))}
        </div>
        <label className="filter" title="Switch role to see which buttons each role can use">
          <span>Role</span>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        {!globalPause && (
          can('globalPause') ? (
            <button className="btn danger" title="Pause every campaign on every site" onClick={() => setConfirm(true)}>
              {Icon.pause()}
              Global pause
            </button>
          ) : (
            // Not actionable for this role: quiet, and it says why instead of hiding it in a tooltip.
            <button className="btn ghost" disabled title={needs('globalPause')}>
              {Icon.lock()}
              Global pause · Admin only
            </button>
          )
        )}
        <button className="btn ghost" onClick={signOut}>Log out</button>
      </header>
      <Freshness />
      {confirm && (
        <Modal
          title="Pause the whole network?"
          danger
          confirm="Pause everything"
          onClose={() => setConfirm(false)}
          onConfirm={() => {
            setGlobalPause(true);
            setConfirm(false);
            toast('Global pause on (mockup: no ad platform call)');
          }}
        >
          Every Google Ads and Meta campaign on all {sites.length} sites stops spending. Sites stay online and sponsors keep their spots. Only Admins can do this.
        </Modal>
      )}
    </>
  );
}

export function App() {
  const { pathname } = useLocation();
  const { overrides } = useApp();
  const metaWaiting = approvalsWaiting(overrides).length;
  return (
    <LiveModeProvider>
    <div className="shell">
      <nav className="side" aria-label="Main">
        <div className="brand">
          <BrandMark />
          <span>Ads engine</span>
        </div>
        <div className="nav-list">
          {NAV.map((n) => (
            <NavLink key={n.label} to={n.to} end={n.end} className={({ isActive }) => `nav${isActive || (n.to === '/' && pathname.startsWith('/sites/')) ? ' active' : ''}`}>
              {n.icon}
              {n.label}
              {n.count ? (
                <span className="count" title={`${n.count} critical alerts`}>
                  {n.count}
                </span>
              ) : null}
              {n.to === '/campaigns' && metaWaiting > 0 && (
                <span className="count quiet" title={`${metaWaiting} Meta changes waiting for approval`}>
                  {metaWaiting}
                </span>
              )}
              {n.test && <span className="nav-tag">Test</span>}
            </NavLink>
          ))}
        </div>
        <div className="side-foot">Prototype for discussion. Sites, sponsors and numbers are made up; buttons change nothing real, except on API check and the live Google Ads card on Campaigns. Meta is sample data.</div>
      </nav>
      <div className="main">
        <LiveAlarm />
        <TopBar />
        <main className="content">
          <Routes>
            <Route path="/" element={<NetworkPage />} />
            <Route path="/sites/:id" element={<SitePage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/sponsors" element={<SponsorsPage />} />
            <Route path="/api-check" element={<ApiCheckPage />} />
            <Route path="*" element={<div className="card">Page not found.</div>} />
          </Routes>
        </main>
      </div>
    </div>
    </LiveModeProvider>
  );
}
