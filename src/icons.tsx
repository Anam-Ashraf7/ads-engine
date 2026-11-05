// One stroke icon set (24px grid, 1.8 stroke) so no screen falls back to text glyphs.
import type { ReactNode } from 'react';

const Svg = ({ children, size = 16 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="icon">
    {children}
  </svg>
);

export const Icon = {
  network: (s?: number) => (
    <Svg size={s}>
      <path d="M3 3h8v7H3zM13 3h8v4h-8zM13 9h8v12h-8zM3 12h8v9H3z" />
    </Svg>
  ),
  campaigns: (s?: number) => (
    <Svg size={s}>
      <path d="M3 11l18-8-8 18-2-8-8-2z" />
    </Svg>
  ),
  sponsors: (s?: number) => (
    <Svg size={s}>
      <path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </Svg>
  ),
  chevronRight: (s = 14) => (
    <Svg size={s}>
      <path d="M9 6l6 6-6 6" />
    </Svg>
  ),
  chevronUp: (s = 12) => (
    <Svg size={s}>
      <path d="M6 15l6-6 6 6" />
    </Svg>
  ),
  chevronDown: (s = 14) => (
    <Svg size={s}>
      <path d="M6 9l6 6 6-6" />
    </Svg>
  ),
  arrowLeft: (s = 16) => (
    <Svg size={s}>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </Svg>
  ),
  arrowRight: (s = 16) => (
    <Svg size={s}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </Svg>
  ),
  pause: (s = 14) => (
    <Svg size={s}>
      <path d="M8 5v14M16 5v14" />
    </Svg>
  ),
  play: (s = 14) => (
    <Svg size={s}>
      <path d="M7 5l12 7-12 7z" />
    </Svg>
  ),
  lock: (s = 12) => (
    <Svg size={s}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Svg>
  ),
  check: (s = 14) => (
    <Svg size={s}>
      <path d="M5 12l5 5 9-10" />
    </Svg>
  ),
  plug: (s?: number) => (
    <Svg size={s}>
      <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4" />
    </Svg>
  ),
  external: (s = 12) => (
    <Svg size={s}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </Svg>
  ),
};

/** The Ads engine mark: four parcels of unequal size, one washed. */
export const BrandMark = () => (
  <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden className="brand-mark">
    <rect x="1" y="1" width="14" height="11" className="bm-a" />
    <rect x="17" y="1" width="8" height="7" className="bm-b" />
    <rect x="17" y="10" width="8" height="15" className="bm-c" />
    <rect x="1" y="14" width="14" height="11" className="bm-d" />
  </svg>
);
