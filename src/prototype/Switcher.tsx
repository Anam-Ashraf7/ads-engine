// PROTOTYPE: switch between the network layouts via ?variant= (also the ← → keys). Kept for the manager to compare.
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useVariant(keys: string[]) {
  const [params] = useSearchParams();
  const v = params.get('variant') ?? keys[0];
  return keys.includes(v) ? v : keys[0];
}

export function PrototypeSwitcher({ variants }: { variants: { key: string; name: string; short: string }[] }) {
  const [params, setParams] = useSearchParams();
  const keys = variants.map((v) => v.key);
  const current = keys.includes(params.get('variant') ?? '') ? params.get('variant')! : keys[0];
  const go = (key: string) => {
    const next = new URLSearchParams(params);
    next.set('variant', key);
    setParams(next, { replace: true });
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable]')) return;
      const i = keys.indexOf(current);
      if (e.key === 'ArrowLeft') go(keys[(i - 1 + keys.length) % keys.length]);
      if (e.key === 'ArrowRight') go(keys[(i + 1) % keys.length]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="layout-switch">
      <span className="small muted">Layout</span>
      <div className="seg" role="group" aria-label="Layout to compare">
        {variants.map((v) => (
          <button key={v.key} className={current === v.key ? 'on' : ''} aria-pressed={current === v.key} title={v.name} onClick={() => go(v.key)}>
            <span className="lbl-long">{v.key} · {v.name}</span>
            <span className="lbl-short">{v.short}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
