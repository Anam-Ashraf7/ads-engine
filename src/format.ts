export const eur = (n: number, digits = 0) =>
  (n < 0 ? '−€' : '€') + Math.abs(n).toLocaleString('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const eurK = (n: number) => {
  const a = Math.abs(n);
  const s = a >= 1e6 ? (a / 1e6).toFixed(2) + 'M' : a >= 1e3 ? (a / 1e3).toFixed(1) + 'k' : a.toFixed(0);
  return (n < 0 ? '−€' : '€') + s;
};

export const num = (n: number) => Math.round(n).toLocaleString('en-GB');

export const compact = (n: number) => {
  const a = Math.abs(n);
  return a >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : a >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : num(n);
};

export const pct = (n: number, digits = 0) => `${(n * 100).toFixed(digits)}%`;

/** Change between two values as "+12%" / "−8%", or "new" when there's no base. */
export const delta = (now: number, before: number) => {
  if (!before) return now ? 'new' : '—';
  // A percentage across a loss/profit flip means nothing, so say what happened instead.
  if (before < 0 && now > 0) return '+ from a loss';
  if (before > 0 && now < 0) return '− now a loss';
  const d = (now - before) / Math.abs(before);
  if (Math.round(Math.abs(d * 100)) === 0) return '0%';
  return `${d >= 0 ? '+' : '−'}${Math.abs(d * 100).toFixed(0)}%`;
};
export const deltaValue = (now: number, before: number) => (before ? (now - before) / Math.abs(before) : 0);

export const shortDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export const longDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

/** "11 Dec 25": compact date with a two-digit year for dense table cells. */
export const medDate = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'UTC' });
