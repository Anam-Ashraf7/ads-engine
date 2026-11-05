// PROTOTYPE: made-up data for the mockups. Seeded, so every reload shows the same numbers.
// Nothing here talks to Google Ads, AdSense or any real system.

export type SiteKind = 'Local' | 'Region' | 'Topic' | 'Person' | 'Institution' | 'Event';
export type DomainType = 'Voices name' | 'Exact-match' | 'Brand' | 'Country ending';
export type SiteState = 'Building' | 'Live' | 'Paused' | 'Retired';
export type Country = 'Portugal' | 'Spain' | 'Italy' | 'UK' | 'US';
export type CampaignType = 'Search' | 'Performance Max' | 'Display' | 'Demand Gen';
export type Risk = 'Low' | 'Medium' | 'High';
export type SpotKind = 'Homepage banner' | 'Featured listing' | 'Sidebar spot' | 'Newsletter mention';
export type Stage = 'Prospect' | 'Contacted' | 'Offer sent' | 'Negotiating' | 'Signed' | 'Active' | 'Up for renewal';
export type AlertType =
  | 'Spend over cap'
  | 'Cost per click jumped'
  | 'Traffic dropped'
  | 'SEO problem'
  | 'Tracking broken'
  | 'Invoice overdue'
  | 'Google Ads issue'
  | 'Meta issue'
  | 'Learning limited'
  | 'Ad wearing out';

export interface Day {
  date: string;
  spend: number;
  visits: number; // qualified visits
  paid: number;
  organic: number;
  direct: number;
  referral: number;
  social: number;
  pageViews: number;
  adsense: number;
  clicks: number;
  conversions: number;
  metaSpend: number; // included in spend
  metaClicks: number; // included in clicks
  metaPaid: number; // Meta visits, included in visits
}

export interface Site {
  id: string;
  name: string;
  domain: string;
  kind: SiteKind;
  size: 'Town' | 'City' | null; // Local sites only
  group: string | null; // Topic, Person, Institution and Event sites
  domainType: DomainType;
  country: Country;
  region: string | null; // state, county or region; null for national sites
  city: string | null; // the town or city of a Local site
  launchCohort: string;
  launchDate: string;
  state: SiteState;
  owner: string;
  monthlyCap: number;
  days: Day[];
  seo: { score: number; indexed: number; indexedChange: number; avgPosition: number; cwvPass: boolean; issues: string[] };
  spots: SpotKind[];
}

export interface Creative {
  id: string;
  kind: 'Ad text' | 'Image' | 'Video';
  name: string;
  landingPage: string;
  impressions: number;
  ctr: number;
  convRate: number;
  status: 'Active' | 'Retired';
}

export interface Campaign {
  id: string;
  siteId: string;
  name: string;
  type: CampaignType;
  status: 'Enabled' | 'Paused';
  platformStatus: 'Eligible' | 'Limited by budget' | 'Learning' | 'Ad disapproved' | 'Account issue';
  dailyBudget: number;
  monthlyCap: number;
  share: number; // share of the site's paid spend
  cpcFactor: number;
  convFactor: number;
  quality: string; // Search: quality score; others: ad strength
  lift: { est: number; low: number; high: number };
  frequency: number | null;
  creatives: Creative[];
}

export interface Deal {
  id: string;
  sponsor: string;
  siteId: string;
  spot: SpotKind;
  fee: number; // per month, EUR
  stage: Stage;
  start: string | null;
  end: string | null;
  invoice: { status: 'Paid' | 'Due' | 'Overdue'; amount: number; due: string; number: string } | null;
  renewalRisk: Risk | null;
  owner: string;
  lastContact: string;
  discountAsk: number | null; // % asked by the sponsor
  outreach: { sequence: string; step: number; steps: number; running: boolean } | null;
}

export interface BudgetMove {
  id: string;
  siteId: string;
  from: string;
  to: string;
  amount: number; // EUR per day
  gain: number; // extra conversions per week
  confidence: number;
  reason: string;
}

export interface Test {
  id: string;
  siteId: string;
  kind: 'Budget' | 'Landing page' | 'Ad text';
  title: string;
  start: string;
  end: string;
  status: 'Planned' | 'Running' | 'Finished';
  result: string | null;
  owner: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: 'Critical' | 'Warning';
  siteId: string;
  campaignId?: string;
  message: string;
  detected: string;
  owner: string | null;
  resolved?: string; // "Ana R. · 08:40" when someone handled it today
}

// ---------- seeded random ----------
let seed = 20261022;
function rnd() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + rnd() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;
function weighted<T>(pairs: [T, number][]): T {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rnd() * total;
  for (const [v, w] of pairs) if ((r -= w) <= 0) return v;
  return pairs[0][0];
}
const r2 = (n: number) => Math.round(n * 100) / 100;

// ---------- dates ----------
export const TODAY = '2026-10-22';
export const LAST_DAY = '2026-10-21';
const DAYS = 180;
const dayMs = 86400000;
const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * dayMs).toISOString().slice(0, 10);
export const dateOf = addDays;
const dates = Array.from({ length: DAYS }, (_, i) => addDays(LAST_DAY, i - DAYS + 1));

// ---------- reference data ----------
export const COUNTRIES: Country[] = ['Portugal', 'Spain', 'Italy', 'UK', 'US'];
const C = {
  Portugal: { lang: 'pt', tld: 'pt', cpc: 0.45, rpm: 4, fee: 0.8, cities: [['Lisbon', 'lisboa'], ['Porto', 'porto'], ['Braga', 'braga'], ['Coimbra', 'coimbra'], ['Faro', 'faro']] },
  Spain: { lang: 'es', tld: 'es', cpc: 0.6, rpm: 5, fee: 0.9, cities: [['Madrid', 'madrid'], ['Barcelona', 'barcelona'], ['Valencia', 'valencia'], ['Seville', 'sevilla'], ['Bilbao', 'bilbao']] },
  Italy: { lang: 'it', tld: 'it', cpc: 0.7, rpm: 6, fee: 1, cities: [['Milan', 'milano'], ['Rome', 'roma'], ['Turin', 'torino'], ['Naples', 'napoli'], ['Bologna', 'bologna']] },
  UK: { lang: 'en', tld: 'co.uk', cpc: 1.2, rpm: 10, fee: 1.3, cities: [['London', 'london'], ['Manchester', 'manchester'], ['Birmingham', 'birmingham'], ['Leeds', 'leeds'], ['Bristol', 'bristol']] },
  US: { lang: 'en', tld: 'com', cpc: 1.6, rpm: 14, fee: 1.5, cities: [['Austin', 'austin'], ['Denver', 'denver'], ['Miami', 'miami'], ['Seattle', 'seattle'], ['Boston', 'boston']] },
} as const;
type Lang = 'pt' | 'es' | 'it' | 'en';

const LOCAL: { name: string; cpc: number; word: Record<Lang, string>; biz: Record<Lang, string> }[] = [
  { name: 'Plumbing', cpc: 1.3, word: { en: 'plumbers', pt: 'canalizadores', es: 'fontaneros', it: 'idraulici' }, biz: { en: '{s} Plumbing', pt: 'Canalizações {s}', es: 'Fontanería {s}', it: 'Idraulica {s}' } },
  { name: 'Dentists', cpc: 1.6, word: { en: 'dentists', pt: 'dentistas', es: 'dentistas', it: 'dentisti' }, biz: { en: '{s} Dental', pt: 'Clínica Dentária {s}', es: 'Clínica Dental {s}', it: 'Studio Dentistico {s}' } },
  { name: 'Law', cpc: 2.4, word: { en: 'lawyers', pt: 'advogados', es: 'abogados', it: 'avvocati' }, biz: { en: '{s} Law', pt: '{s} Advogados', es: '{s} Abogados', it: 'Studio Legale {s}' } },
  { name: 'Electricians', cpc: 1.1, word: { en: 'electricians', pt: 'eletricistas', es: 'electricistas', it: 'elettricisti' }, biz: { en: '{s} Electric', pt: 'Eletro {s}', es: 'Electricidad {s}', it: 'Elettrica {s}' } },
  { name: 'Locksmiths', cpc: 1.4, word: { en: 'locksmiths', pt: 'serralheiros', es: 'cerrajeros', it: 'fabbri' }, biz: { en: '{s} Locks', pt: 'Serralharia {s}', es: 'Cerrajería {s}', it: 'Fabbro {s}' } },
  { name: 'Moving', cpc: 1.0, word: { en: 'movers', pt: 'mudancas', es: 'mudanzas', it: 'traslochi' }, biz: { en: '{s} Removals', pt: 'Mudanças {s}', es: 'Mudanzas {s}', it: 'Traslochi {s}' } },
  { name: 'Physiotherapy', cpc: 0.9, word: { en: 'physio', pt: 'fisioterapia', es: 'fisioterapia', it: 'fisioterapia' }, biz: { en: '{s} Physio', pt: 'Fisio {s}', es: 'Fisio {s}', it: 'Fisio {s}' } },
  { name: 'Roofing', cpc: 1.2, word: { en: 'roofers', pt: 'telhados', es: 'tejados', it: 'tetti' }, biz: { en: '{s} Roofing', pt: 'Telhados {s}', es: 'Tejados {s}', it: 'Coperture {s}' } },
];
// Real places, interests, people and institutions. Each row is one site; the site list below is built from them.
// Local: [name, region, size]
const TOWNS: Record<Country, [string, string][]> = {
  US: [
    ['Medford', 'Massachusetts'], ['Somerville', 'Massachusetts'], ['Arlington', 'Massachusetts'], ['Salem', 'Massachusetts'], ['Newton', 'Massachusetts'],
    ['Concord', 'Massachusetts'], ['Lexington', 'Massachusetts'], ['Woburn', 'Massachusetts'], ['Bend', 'Oregon'], ['Ashland', 'Oregon'],
    ['Boulder', 'Colorado'], ['Durango', 'Colorado'], ['Naperville', 'Illinois'], ['Evanston', 'Illinois'], ['Ann Arbor', 'Michigan'],
    ['Traverse City', 'Michigan'], ['Asheville', 'North Carolina'], ['Burlington', 'Vermont'], ['Princeton', 'New Jersey'], ['Hoboken', 'New Jersey'],
    ['Fredericksburg', 'Texas'], ['Round Rock', 'Texas'], ['Sarasota', 'Florida'], ['Key West', 'Florida'], ['Sedona', 'Arizona'], ['Flagstaff', 'Arizona'],
  ],
  UK: [
    ['Bath', 'Somerset'], ['Harrogate', 'North Yorkshire'], ['Whitby', 'North Yorkshire'], ['St Albans', 'Hertfordshire'], ['Guildford', 'Surrey'],
    ['Cheltenham', 'Gloucestershire'], ['Stroud', 'Gloucestershire'], ['Kendal', 'Cumbria'], ['Keswick', 'Cumbria'], ['Ludlow', 'Shropshire'],
    ['Falmouth', 'Cornwall'], ['St Ives', 'Cornwall'], ['Hebden Bridge', 'West Yorkshire'], ['Ilkley', 'West Yorkshire'], ['Totnes', 'Devon'],
    ['Rye', 'East Sussex'], ['Stamford', 'Lincolnshire'],
  ],
  Portugal: [
    ['Sintra', 'Lisbon'], ['Cascais', 'Lisbon'], ['Óbidos', 'Leiria'], ['Nazaré', 'Leiria'], ['Tavira', 'Faro'], ['Lagos', 'Faro'],
    ['Évora', 'Évora'], ['Guimarães', 'Braga'], ['Aveiro', 'Aveiro'], ['Tomar', 'Santarém'],
  ],
  Spain: [
    ['Ronda', 'Andalusia'], ['Nerja', 'Andalusia'], ['Tarifa', 'Andalusia'], ['Sitges', 'Catalonia'], ['Cadaqués', 'Catalonia'],
    ['Toledo', 'Castile-La Mancha'], ['Cuenca', 'Castile-La Mancha'], ['Segovia', 'Castile and León'], ['Sóller', 'Balearic Islands'], ['Haro', 'La Rioja'],
  ],
  Italy: [
    ['Como', 'Lombardy'], ['Bellagio', 'Lombardy'], ['Lucca', 'Tuscany'], ['Siena', 'Tuscany'], ['San Gimignano', 'Tuscany'], ['Alba', 'Piedmont'],
    ['Positano', 'Campania'], ['Sorrento', 'Campania'], ['Assisi', 'Umbria'], ['Matera', 'Basilicata'], ['Cefalù', 'Sicily'], ['Taormina', 'Sicily'],
  ],
};
const CITIES: Record<Country, [string, string][]> = {
  US: [['Boston', 'Massachusetts'], ['Austin', 'Texas'], ['Denver', 'Colorado'], ['Seattle', 'Washington'], ['Miami', 'Florida'], ['Chicago', 'Illinois'], ['Portland', 'Oregon']],
  UK: [['London', 'Greater London'], ['Manchester', 'Greater Manchester'], ['Bristol', 'Bristol'], ['Leeds', 'West Yorkshire'], ['Edinburgh', 'Scotland']],
  Portugal: [['Lisbon', 'Lisbon'], ['Porto', 'Porto'], ['Braga', 'Braga'], ['Coimbra', 'Coimbra']],
  Spain: [['Madrid', 'Community of Madrid'], ['Barcelona', 'Catalonia'], ['Valencia', 'Valencian Community'], ['Seville', 'Andalusia']],
  Italy: [['Milan', 'Lombardy'], ['Rome', 'Lazio'], ['Turin', 'Piedmont'], ['Naples', 'Campania'], ['Bologna', 'Emilia-Romagna']],
};
const REGIONS: [string, Country, string][] = [
  ['Cape Cod', 'US', 'Massachusetts'], ['Hudson Valley', 'US', 'New York'], ['Napa Valley', 'US', 'California'], ['Algarve', 'Portugal', 'Faro'],
  ['Douro Valley', 'Portugal', 'Porto'], ['Costa Brava', 'Spain', 'Catalonia'], ['Lake District', 'UK', 'Cumbria'], ['Cotswolds', 'UK', 'Gloucestershire'],
  ['Amalfi Coast', 'Italy', 'Campania'], ['Dolomites', 'Italy', 'Trentino-Alto Adige'],
];
// Topic: [subject, group]. Interests are national, so a topic site has a country but no region.
const TOPICS: [string, string][] = [
  ['Guitar', 'Music'], ['Concerts', 'Music'], ['Vinyl', 'Music'], ['Drums', 'Music'], ['Jazz', 'Music'],
  ['Fishing', 'Outdoors'], ['Hiking', 'Outdoors'], ['Camping', 'Outdoors'], ['Surfing', 'Outdoors'], ['Climbing', 'Outdoors'], ['Birdwatching', 'Outdoors'],
  ['Woodworking', 'Hobbies'], ['Knitting', 'Hobbies'], ['Photography', 'Hobbies'], ['Model Trains', 'Hobbies'], ['Chess', 'Hobbies'], ['Board Games', 'Hobbies'], ['Gardening', 'Hobbies'],
  ['Cycling', 'Sports'], ['Running', 'Sports'], ['Golf', 'Sports'], ['Tennis', 'Sports'], ['Padel', 'Sports'], ['Skiing', 'Sports'],
  ['Barbecue', 'Food & drink'], ['Sourdough', 'Food & drink'], ['Coffee', 'Food & drink'], ['Wine', 'Food & drink'], ['Craft Beer', 'Food & drink'],
  ['Dogs', 'Pets'], ['Cats', 'Pets'], ['Aquariums', 'Pets'],
  ['Classic Cars', 'Motoring'], ['Motorbikes', 'Motoring'], ['Campervans', 'Motoring'],
];
// Popular topics get a second site in another country.
const TOPIC_REPEATS = ['Fishing', 'Guitar', 'Cycling', 'Surfing', 'Wine', 'Padel', 'Hiking', 'Dogs', 'Concerts', 'Running'];
const PEOPLE: [string, Country, string][] = [
  ['Elon Musk', 'US', 'Tech'], ['Taylor Swift', 'US', 'Music'], ['Beyoncé', 'US', 'Music'], ['LeBron James', 'US', 'Sports'], ['Serena Williams', 'US', 'Sports'],
  ['Oprah Winfrey', 'US', 'Film & TV'], ['Barack Obama', 'US', 'Politics'], ['David Beckham', 'UK', 'Sports'], ['Lewis Hamilton', 'UK', 'Sports'],
  ['Adele', 'UK', 'Music'], ['Ed Sheeran', 'UK', 'Music'], ['Emma Watson', 'UK', 'Film & TV'], ['Cristiano Ronaldo', 'Portugal', 'Sports'],
  ['José Mourinho', 'Portugal', 'Sports'], ['Rafael Nadal', 'Spain', 'Sports'], ['Rosalía', 'Spain', 'Music'], ['Penélope Cruz', 'Spain', 'Film & TV'],
  ['Andrea Bocelli', 'Italy', 'Music'], ['Jannik Sinner', 'Italy', 'Sports'], ['Sophia Loren', 'Italy', 'Film & TV'],
];
// Institution: [display name, short name used in the address, country, region, group]
const INSTITUTIONS: [string, string, Country, string, string][] = [
  ['MIT', 'MIT', 'US', 'Massachusetts', 'University'], ['Harvard', 'Harvard', 'US', 'Massachusetts', 'University'], ['Boston Red Sox', 'RedSox', 'US', 'Massachusetts', 'Sports team'],
  ['Mayo Clinic', 'MayoClinic', 'US', 'Minnesota', 'Hospital'], ['The Met', 'TheMet', 'US', 'New York', 'Museum'], ['Oxford', 'Oxford', 'UK', 'Oxfordshire', 'University'],
  ['Cambridge', 'Cambridge', 'UK', 'Cambridgeshire', 'University'], ['Manchester United', 'ManUnited', 'UK', 'Greater Manchester', 'Sports team'],
  ['British Museum', 'BritishMuseum', 'UK', 'Greater London', 'Museum'], ['Benfica', 'Benfica', 'Portugal', 'Lisbon', 'Sports team'],
  ['University of Coimbra', 'UCoimbra', 'Portugal', 'Coimbra', 'University'], ['Real Madrid', 'RealMadrid', 'Spain', 'Community of Madrid', 'Sports team'],
  ['Prado Museum', 'Prado', 'Spain', 'Community of Madrid', 'Museum'], ['Uffizi', 'Uffizi', 'Italy', 'Tuscany', 'Museum'], ['Juventus', 'Juventus', 'Italy', 'Piedmont', 'Sports team'],
];
const EVENTS: [string, Country, string, string][] = [
  ['Glastonbury', 'UK', 'Somerset', 'Music festival'], ['Edinburgh Fringe', 'UK', 'Scotland', 'Arts & culture'], ['Wimbledon', 'UK', 'Greater London', 'Sports event'],
  ['Boston Marathon', 'US', 'Massachusetts', 'Sports event'], ['Coachella', 'US', 'California', 'Music festival'], ['SXSW', 'US', 'Texas', 'Arts & culture'],
  ['Rock in Rio Lisboa', 'Portugal', 'Lisbon', 'Music festival'], ['Primavera Sound', 'Spain', 'Catalonia', 'Music festival'],
  ['San Fermín', 'Spain', 'Navarre', 'Arts & culture'], ['Venice Biennale', 'Italy', 'Veneto', 'Arts & culture'],
];
export const SITE_KINDS: SiteKind[] = ['Local', 'Region', 'Topic', 'Person', 'Institution', 'Event'];
// Town and City are the two sizes of a Local site; the kind filter offers them on their own as well.
export const KIND_FILTER = ['Local', 'Town', 'City', 'Region', 'Topic', 'Person', 'Institution', 'Event'];
export const DOMAIN_TYPES: DomainType[] = ['Voices name', 'Exact-match', 'Brand', 'Country ending'];
export const GROUPS = [...new Set([...TOPICS.map((t) => t[1]), ...PEOPLE.map((p) => p[2]), ...INSTITUTIONS.map((x) => x[4]), ...EVENTS.map((e) => e[3])])].sort();

const SURNAMES: Record<Lang, string[]> = {
  pt: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Costa', 'Rodrigues', 'Martins', 'Sousa', 'Almeida', 'Lopes'],
  es: ['García', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Romero', 'Navarro', 'Torres', 'Ruiz', 'Molina'],
  it: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco'],
  en: ['Harper', 'Collins', 'Reed', 'Walsh', 'Turner', 'Hughes', 'Price', 'Bennett', 'Foster', 'Shaw'],
};
const BRAND_A = ['Casa', 'Pronto', 'Clara', 'Nova', 'Vero', 'Bright', 'Swift', 'True', 'Prime', 'Solid'];
const BRAND_B = ['fix', 'care', 'point', 'hub', 'lane', 'works', 'nest', 'path', 'mark', 'line'];
export const OWNERS = ['Ana R.', 'Marco B.', 'Sofia L.', 'Tom H.', 'Inês C.', 'Diego M.'];
export const SPOT_KINDS: SpotKind[] = ['Homepage banner', 'Featured listing', 'Sidebar spot', 'Newsletter mention'];
const SPOT_FEE: Record<SpotKind, [number, number]> = {
  'Homepage banner': [300, 900],
  'Featured listing': [150, 500],
  'Sidebar spot': [80, 250],
  'Newsletter mention': [60, 200],
};
export const COHORTS = ['2024 Q3', '2024 Q4', '2025 Q1', '2025 Q2', '2025 Q3', '2025 Q4', '2026 Q1', '2026 Q2', '2026 Q3', '2026 Q4'];
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const slugOf = (s: string) => s.normalize('NFD').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
const pascal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map(cap).join('');
/** The line under a site's name: "Town · Massachusetts", "Topic · Music", "Person · Sports". */
export const kindLine = (s: Pick<Site, 'kind' | 'size' | 'group' | 'region'>) => (s.kind === 'Local' ? `${s.size} · ${s.region}` : s.kind === 'Region' ? `Region · ${s.region}` : `${s.kind} · ${s.group}`);

// ---------- sites ----------
interface Spec {
  kind: SiteKind;
  subject: string; // what the site is about: "Medford", "Guitar", "Elon Musk"
  short?: string; // used in the address when the subject is long
  country: Country;
  region: string | null;
  size: 'Town' | 'City' | null;
  group: string | null;
}
function siteSpecs(): Spec[] {
  const out: Spec[] = [];
  for (const country of COUNTRIES) for (const [subject, region] of TOWNS[country]) out.push({ kind: 'Local', subject, country, region, size: 'Town', group: null });
  for (const country of COUNTRIES) for (const [subject, region] of CITIES[country]) out.push({ kind: 'Local', subject, country, region, size: 'City', group: null });
  for (const [subject, country, region] of REGIONS) out.push({ kind: 'Region', subject, country, region, size: null, group: null });
  const topicCountry = () => weighted<Country>([['US', 40], ['UK', 25], ['Portugal', 10], ['Spain', 12], ['Italy', 13]]);
  for (const [subject, group] of TOPICS) out.push({ kind: 'Topic', subject, country: topicCountry(), region: null, size: null, group });
  for (const subject of TOPIC_REPEATS) {
    const first = out.find((x) => x.kind === 'Topic' && x.subject === subject)!;
    let country = topicCountry();
    while (country === first.country) country = topicCountry();
    out.push({ ...first, country });
  }
  for (const [subject, country, group] of PEOPLE) out.push({ kind: 'Person', subject, country, region: null, size: null, group });
  for (const [subject, short, country, region, group] of INSTITUTIONS) out.push({ kind: 'Institution', subject, short, country, region, size: null, group });
  for (const [subject, country, region, group] of EVENTS) out.push({ kind: 'Event', subject, country, region, size: null, group });
  // Seeded shuffle so site numbers don't follow the kind.
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const EXACT: Record<SiteKind, [string, string]> = {
  // [address pattern, name pattern]; {s} = subject slug, {S} = subject
  Local: ['whatson{s}.com', "What's On {S}"],
  Region: ['visit{s}.com', 'Visit {S}'],
  Topic: ['{s}tips.com', '{S} Tips'],
  Person: ['{s}news.com', '{S} News'],
  Institution: ['{s}students.com', '{S} Students'],
  Event: ['{s}guide.com', '{S} Guide'],
};
const LOCAL_WORD: Record<Lang, string> = { en: 'local', pt: 'hoje', es: 'hoy', it: 'oggi' };

const usedDomains = new Set<string>();
function makeSite(spec: Spec, i: number): Site {
  const { kind, subject, country, region, size, group } = spec;
  const cc = C[country];
  const lang = cc.lang as Lang;
  const tld = country === 'US' ? 'com' : cc.tld;
  const slug = slugOf(spec.short ?? subject);
  // People and institutions only ever use a Voices name or an exact-match address.
  const domainType: DomainType =
    subject === 'Medford' ? 'Voices name' : kind === 'Person' || kind === 'Institution'
      ? weighted<DomainType>([['Voices name', 75], ['Exact-match', 25]])
      : weighted<DomainType>([['Voices name', 52], ['Exact-match', 20], ['Brand', 12], ['Country ending', 16]]);
  let name: string, domain: string;
  if (domainType === 'Voices name') {
    name = `${pascal(spec.short ?? subject)}Voices`;
    domain = `${name.toLowerCase()}.${tld}`;
  } else if (domainType === 'Exact-match') {
    domain = EXACT[kind][0].replace('{s}', slug);
    name = EXACT[kind][1].replace('{S}', subject);
  } else if (domainType === 'Brand') {
    const b = pick(BRAND_A) + pick(BRAND_B);
    name = `${cap(b)} ${subject}`;
    domain = `${b.toLowerCase()}${slug}.${tld}`;
  } else {
    name = `${subject} ${cap(LOCAL_WORD[lang])}`;
    domain = `${slug}-${LOCAL_WORD[lang]}.${country === 'US' ? 'us' : cc.tld}`;
  }
  let d = domain;
  for (const suffix of ['hub', 'now', 'hq', 'online', 'daily', 'pro']) if (usedDomains.has(d)) d = domain.replace('.', `${suffix}.`);
  usedDomains.add(d);

  const cohortIdx = chance(0.06) ? COHORTS.length - 1 : int(0, COHORTS.length - 2);
  const launchCohort = COHORTS[cohortIdx];
  const [y, q] = launchCohort.split(' Q').map(Number);
  const launchDate = `${y}-${String((q - 1) * 3 + 1 + int(0, 2)).padStart(2, '0')}-${String(int(1, 28)).padStart(2, '0')}`;
  let state: SiteState =
    launchDate > LAST_DAY || launchCohort === '2026 Q4'
      ? 'Building'
      : weighted<SiteState>([['Live', 80], ['Paused', 11], ['Retired', 7], ['Building', 2]]);
  if (state === 'Retired' && cohortIdx > 6) state = 'Paused';

  // daily numbers: ads buy readers cheaply; money comes back from AdSense and sponsors
  const P = {
    Local: { cpc: size === 'City' ? 0.55 : 0.4, spend: size === 'City' ? [14, 40] : [4, 18], organic: size === 'City' ? [400, 1600] : [120, 700], rpm: 0.9 },
    Region: { cpc: 0.55, spend: [8, 26], organic: [300, 1200], rpm: 1.1 },
    Topic: { cpc: 0.6, spend: [6, 30], organic: [200, 1300], rpm: 1.2 },
    Person: { cpc: 0.3, spend: [5, 22], organic: [600, 2600], rpm: 0.8 },
    Institution: { cpc: 0.35, spend: [3, 14], organic: [250, 1100], rpm: 0.9 },
    Event: { cpc: 0.45, spend: [6, 24], organic: [300, 1500], rpm: 1 },
  }[kind];
  const cpc = cc.cpc * P.cpc * between(0.8, 1.25);
  const baseSpend = between(P.spend[0], P.spend[1]) * 1.5;
  const organicBase = between(P.organic[0], P.organic[1]);
  const growth = between(-0.002, 0.006);
  const rpm = cc.rpm * between(0.45, 1.3) * P.rpm * 0.75;
  const cvr = between(0.01, 0.05);
  const launchIdx = dates.findIndex((x) => x >= launchDate);
  const pausedAt = state === 'Paused' ? DAYS - int(5, 40) : DAYS;
  const retiredAt = state === 'Retired' ? DAYS - int(60, 150) : DAYS;
  const days: Day[] = dates.map((date, i) => {
    const live = (launchIdx === -1 ? false : i >= launchIdx) && i < retiredAt && state !== 'Building';
    const age = launchIdx === -1 ? 0 : Math.max(0, i - launchIdx);
    const ramp = Math.min(1, age / 60);
    const dow = new Date(date + 'T00:00:00Z').getUTCDay();
    const week = dow === 0 || dow === 6 ? 0.78 : 1;
    const noise = between(0.85, 1.15);
    const spend = live && i < pausedAt ? r2(baseSpend * week * noise * (1 + growth * (i - DAYS / 2))) : 0;
    const clicks = Math.round(spend / (cpc * between(0.9, 1.1)));
    const paid = Math.round(clicks * between(0.5, 0.65));
    const organic = live || state === 'Paused' ? Math.round(organicBase * ramp * week * noise * (1 + growth * 1.5 * (i - DAYS / 2))) : 0;
    const direct = Math.round(organic * between(0.12, 0.22));
    const referral = Math.round(organic * between(0.04, 0.1));
    const social = Math.round(organic * between(0.02, 0.12));
    const visits = paid + organic + direct + referral + social;
    const pageViews = Math.round(visits * between(1.5, 2.3));
    return {
      date,
      spend,
      visits,
      paid,
      organic,
      direct,
      referral,
      social,
      pageViews,
      adsense: r2((pageViews / 1000) * rpm),
      clicks,
      conversions: Math.round(clicks * cvr * between(0.6, 1.4)),
      metaSpend: 0,
      metaClicks: 0,
      metaPaid: 0,
    };
  });
  const avgSpend = days.slice(-30).reduce((s, x) => s + x.spend, 0) / 30 || baseSpend;
  const score = Math.round(between(48, 97));
  const issues: string[] = [];
  if (score < 75) issues.push(pick(['Slow mobile pages (LCP 3.8s)', 'Missing meta descriptions on 14 pages', 'Thin content on 6 pages']));
  if (score < 62) issues.push(pick(['12 pages return 404', 'Duplicate titles on 9 pages', 'Sitemap not updated in 30 days']));
  const spotCount = kind === 'Local' ? int(3, 4) : int(2, 3);
  return {
    id: `site-${String(i + 1).padStart(3, '0')}`,
    name,
    domain: d,
    kind,
    size,
    group,
    domainType,
    country,
    region,
    city: kind === 'Local' ? subject : null,
    launchCohort,
    launchDate,
    state,
    owner: pick(OWNERS),
    monthlyCap: Math.round((avgSpend * 30 * between(1.0, 1.4)) / 50) * 50,
    days,
    seo: {
      score,
      indexed: int(25, 420),
      indexedChange: int(-6, 14),
      avgPosition: r2(between(3.2, 24)),
      cwvPass: score > 70 ? chance(0.85) : chance(0.35),
      issues,
    },
    spots: SPOT_KINDS.slice(0, spotCount),
  };
}

export const sites: Site[] = siteSpecs().map(makeSite);
export const siteById = new Map(sites.map((s) => [s.id, s]));
const langOf = (s: Site) => C[s.country].lang as Lang;

// ---------- campaigns ----------
const QS = ['4/10', '5/10', '6/10', '7/10', '8/10', '9/10'];
const STRENGTH = ['Poor', 'Average', 'Good', 'Excellent'];
const COUNTRY_CODE: Record<Country, string> = { Portugal: 'PT', Spain: 'ES', Italy: 'IT', UK: 'UK', US: 'US' };
export const campaigns: Campaign[] = [];
for (const s of sites) {
  if (s.state === 'Building' || s.state === 'Retired') continue;
  const types: CampaignType[] =
    s.kind === 'Local'
      ? ['Search', pick<CampaignType>(['Performance Max', 'Display']), 'Demand Gen']
      : s.kind === 'Topic' || s.kind === 'Region' || s.kind === 'Event'
        ? [pick<CampaignType>(['Search', 'Display']), 'Demand Gen', 'Performance Max']
        : ['Display', 'Search', 'Demand Gen'];
  const n = s.kind === 'Local' && s.size === 'City' ? int(2, 3) : int(1, 2);
  const shares = Array.from({ length: n }, () => between(0.3, 1));
  const tot = shares.reduce((a, b) => a + b, 0);
  const avgSpend = s.days.slice(-30).reduce((a, x) => a + x.spend, 0) / 30;
  for (let k = 0; k < n; k++) {
    const type = types[k];
    const share = shares[k] / tot;
    const daily = Math.max(3, Math.round(avgSpend * share * (chance(0.06) ? between(0.7, 0.85) : between(0.95, 1.35))));
    const lp = `/${type === 'Search' ? 'news' : type === 'Display' ? 'guides' : 'events'}`;
    const ps = s.state === 'Paused' ? 'Eligible' : weighted<Campaign['platformStatus']>([['Eligible', 74], ['Limited by budget', 12], ['Learning', 8], ['Ad disapproved', 2], ['Account issue', 1]]);
    const creatives: Creative[] = Array.from({ length: int(2, 4) }, (_, j) => {
      const kind: Creative['kind'] = type === 'Search' ? 'Ad text' : type === 'Demand Gen' ? pick(['Image', 'Video'] as const) : pick(['Image', 'Ad text'] as const);
      return {
        id: `cr-${campaigns.length}-${j}`,
        kind,
        name: kind === 'Ad text' ? pick(['News and events near you', 'What people are talking about', 'Free daily updates', 'Tips from people who love it', 'Join 12,000 readers']) : `${kind} ${pick(['A', 'B', 'C', 'D'])}${j + 1} · ${pick(['1:1', '16:9', '4:5'])}`,
        landingPage: s.domain + (j % 2 ? lp + '-b' : lp),
        impressions: int(800, 42000),
        ctr: r2(between(type === 'Search' ? 2.5 : 0.3, type === 'Search' ? 9 : 1.8)),
        convRate: r2(between(0.5, 8)),
        status: chance(0.12) ? 'Retired' : 'Active',
      };
    });
    campaigns.push({
      id: `cmp-${String(campaigns.length + 1).padStart(3, '0')}`,
      siteId: s.id,
      name: `${COUNTRY_CODE[s.country]}-${s.name.replace(/Voices$/, '').replace(/[^A-Za-z]/g, '')}-${type.replace(/\s/g, '')}${k === 0 ? '-Core' : ''}`,
      type,
      status: s.state === 'Paused' || chance(0.06) ? 'Paused' : 'Enabled',
      platformStatus: ps,
      dailyBudget: daily,
      monthlyCap: Math.round((daily * 31) / 10) * 10,
      share,
      cpcFactor: between(0.8, 1.25),
      convFactor: between(0.4, 1.6),
      quality: type === 'Search' ? pick(QS) : pick(STRENGTH),
      lift: (() => {
        const est = Math.round(between(-4, 38));
        const w = Math.round(between(5, 16));
        return { est, low: est - w, high: est + w };
      })(),
      frequency: type === 'Display' || type === 'Demand Gen' ? r2(between(1.3, 6.2)) : null,
      creatives,
    });
  }
}
export const campaignById = new Map(campaigns.map((c) => [c.id, c]));
export const campaignsBySite = new Map<string, Campaign[]>();
for (const c of campaigns) campaignsBySite.set(c.siteId, [...(campaignsBySite.get(c.siteId) ?? []), c]);

// ---------- sponsors ----------
// Sponsors fit the site: local businesses on Local sites, shops for the hobby on Topic sites, and so on.
const SPONSOR_BY_GROUP: Record<string, string[]> = {
  Music: ['{b} Guitars', '{b} Music Store', '{b} Strings', '{b} Records'],
  Outdoors: ['{b} Tackle', '{b} Outdoor', '{b} Camping Co', '{b} Boards'],
  Hobbies: ['{b} Crafts', '{b} Hobby Shop', '{b} Camera Store'],
  Sports: ['{b} Sports', '{b} Bikes', '{b} Pro Shop'],
  'Food & drink': ['{b} Coffee Roasters', '{b} Wines', '{b} Brewing'],
  Pets: ['{b} Pet Supplies', '{b} Vets'],
  Motoring: ['{b} Parts', '{b} Garage', '{b} Campers'],
};
const FAN_SPONSORS = ['{b} Tickets', '{b} Merch', '{b} Books', '{b} Travel'];
function sponsorName(s: Site, surname: string, lang: Lang) {
  const b = chance(0.5) ? surname : cap(pick(BRAND_A) + pick(BRAND_B));
  if (s.kind === 'Local') return pick(LOCAL).biz[lang].replace('{s}', surname);
  if (s.kind === 'Region') return `${b} ${pick(['Boat Tours', 'Cottages', 'Wine Tours', 'Bike Hire', 'Guesthouse'])}`;
  if (s.kind === 'Topic') return pick(SPONSOR_BY_GROUP[s.group!]).replace('{b}', b);
  if (s.kind === 'Institution') return pick(['{b} Student Living', '{b} Books', '{b} Sportswear', '{b} Coaches']).replace('{b}', b);
  return pick(FAN_SPONSORS).replace('{b}', b);
}
const SEQUENCES = ['New sponsor', 'Renewal', 'Win-back'];
export const deals: Deal[] = [];
for (const s of sites) {
  if (s.state === 'Building' || s.state === 'Retired') continue;
  const lang = langOf(s);
  for (const spot of s.spots) {
    const r = rnd();
    const isLocal = s.kind === 'Local';
    const pActive = isLocal ? 0.5 : 0.28;
    const pPipe = isLocal ? 0.25 : 0.2;
    if (r > pActive + pPipe) continue;
    const surname = pick(SURNAMES[lang]);
    const sponsor = sponsorName(s, surname, lang);
    const [lo, hi] = SPOT_FEE[spot];
    const fee = Math.round((between(lo, hi) * C[s.country].fee) / 10) * 10;
    const owner = pick(OWNERS);
    const lastContact = addDays(TODAY, -int(0, 25));
    if (r < pActive) {
      const early = addDays(TODAY, -int(20, 330));
      const start = early < s.launchDate ? s.launchDate : early; // no deals before the site exists
      const end = addDays(start, 365);
      const daysLeft = (Date.parse(end) - Date.parse(TODAY)) / dayMs;
      const stage: Stage = daysLeft < 60 ? 'Up for renewal' : 'Active';
      const inv = weighted<'Paid' | 'Due' | 'Overdue'>([['Paid', 76], ['Due', 14], ['Overdue', 10]]);
      deals.push({
        id: `deal-${deals.length + 1}`,
        sponsor,
        siteId: s.id,
        spot,
        fee,
        stage,
        start,
        end,
        invoice: {
          status: inv,
          amount: fee,
          due: inv === 'Overdue' ? addDays(TODAY, -int(5, 40)) : inv === 'Due' ? addDays(TODAY, int(1, 14)) : addDays(TODAY, -int(1, 20)),
          number: `INV-26${String(1000 + deals.length)}`,
        },
        renewalRisk: stage === 'Up for renewal' ? weighted<Risk>([['Low', 40], ['Medium', 35], ['High', 25]]) : inv === 'Overdue' ? 'High' : weighted<Risk>([['Low', 75], ['Medium', 20], ['High', 5]]),
        owner,
        lastContact,
        discountAsk: stage === 'Up for renewal' && chance(0.4) ? pick([5, 10, 15, 20, 30]) : null,
        outreach: stage === 'Up for renewal' ? { sequence: SEQUENCES[1], step: int(1, 3), steps: 3, running: chance(0.7) } : null,
      });
    } else {
      const stage = weighted<Stage>([['Prospect', 30], ['Contacted', 28], ['Offer sent', 20], ['Negotiating', 14], ['Signed', 8]]);
      deals.push({
        id: `deal-${deals.length + 1}`,
        sponsor,
        siteId: s.id,
        spot,
        fee,
        stage,
        start: stage === 'Signed' ? addDays(TODAY, int(3, 20)) : null,
        end: null,
        invoice: null,
        renewalRisk: null,
        owner,
        lastContact,
        discountAsk: stage === 'Negotiating' || stage === 'Offer sent' ? pick([5, 8, 10, 15, 20, 25, 30]) : null,
        outreach: stage === 'Prospect' || stage === 'Contacted' ? { sequence: pick([SEQUENCES[0], SEQUENCES[2]]), step: int(1, 4), steps: 5, running: chance(0.75) } : null,
      });
    }
  }
}
export const STAGES: Stage[] = ['Prospect', 'Contacted', 'Offer sent', 'Negotiating', 'Signed', 'Active', 'Up for renewal'];
const isLiveDeal = (d: Deal) => d.stage === 'Active' || d.stage === 'Up for renewal';
export const dealsBySite = new Map<string, Deal[]>();
for (const d of deals) dealsBySite.set(d.siteId, [...(dealsBySite.get(d.siteId) ?? []), d]);

// ---------- placement delivery, lead evidence, holds ----------
// Delivery and leads are month to date (1 October to the last full day), compared with the same days of September.
export const MONTH_START = '2026-10-01';
export type DeliveryStatus = 'Delivered' | 'Under-delivered' | 'Not checked';
export interface Delivery {
  dealId: string;
  daysBooked: number; // days of the month the placement should have run so far
  daysLive: number; // days it actually ran
  unit: 'impressions' | 'sends' | 'days listed';
  promised: number; // to date
  delivered: number;
  proof: 'Screenshot' | 'Ad server log' | 'Send report' | 'Listing check' | null;
  lastCheck: string | null;
  status: DeliveryStatus;
}
export interface LeadEvidence {
  dealId: string;
  clicks: number; // clicks on the sponsor's tracked link
  calls: number; // calls to the sponsor's tracking number
  forms: number; // enquiry forms passed to the sponsor
  prev: { clicks: number; calls: number; forms: number };
  source: string;
  lastReport: string | null; // when we last sent the sponsor a lead report
}
export interface Hold {
  siteId: string;
  spot: SpotKind;
  sponsor: string;
  until: string;
  by: string;
}
const UNIT: Record<SpotKind, Delivery['unit']> = { 'Homepage banner': 'impressions', 'Sidebar spot': 'impressions', 'Newsletter mention': 'sends', 'Featured listing': 'days listed' };
const PROOF: Record<SpotKind, NonNullable<Delivery['proof']>> = { 'Homepage banner': 'Ad server log', 'Sidebar spot': 'Ad server log', 'Newsletter mention': 'Send report', 'Featured listing': 'Listing check' };
export const deliveries = new Map<string, Delivery>();
export const leads = new Map<string, LeadEvidence>();
const monthDays = (Date.parse(LAST_DAY) - Date.parse(MONTH_START)) / dayMs + 1;
for (const d of deals.filter(isLiveDeal)) {
  const site = siteById.get(d.siteId)!;
  const from = d.start! > MONTH_START ? d.start! : MONTH_START;
  const daysBooked = Math.max(0, Math.round((Date.parse(LAST_DAY) - Date.parse(from)) / dayMs) + 1);
  const outage = site.state === 'Paused' ? 0 : chance(0.12) ? int(1, 6) : 0;
  const daysLive = Math.max(0, daysBooked - outage);
  const unit = UNIT[d.spot];
  const perDay = unit === 'impressions' ? Math.round((d.spot === 'Homepage banner' ? 900 : 350) * between(0.6, 1.6)) : 0;
  const promised = unit === 'impressions' ? perDay * daysBooked : unit === 'sends' ? Math.max(1, Math.round((daysBooked / monthDays) * 4)) : daysBooked;
  const shortfall = outage ? daysLive / Math.max(1, daysBooked) : chance(0.1) ? between(0.7, 0.92) : between(0.97, 1.12);
  const delivered = unit === 'sends' ? Math.min(promised, Math.round(promised * shortfall)) : unit === 'days listed' ? daysLive : Math.round(promised * shortfall);
  const checked = !chance(0.14);
  deliveries.set(d.id, {
    dealId: d.id,
    daysBooked,
    daysLive,
    unit,
    promised,
    delivered,
    proof: checked ? (chance(0.25) ? 'Screenshot' : PROOF[d.spot]) : null,
    lastCheck: checked ? addDays(LAST_DAY, -int(0, 9)) : null,
    status: !checked ? 'Not checked' : delivered / Math.max(1, promised) < 0.95 ? 'Under-delivered' : 'Delivered',
  });
  const local = site.kind === 'Local' || site.kind === 'Region';
  const scale = (unit === 'impressions' ? promised / 1000 : unit === 'sends' ? promised * 6 : daysBooked * 1.5) * between(0.4, 1.6);
  const mk = () => ({ clicks: Math.round(scale * between(2, 6)), calls: local ? Math.round(scale * between(0.1, 0.5)) : 0, forms: Math.round(scale * between(0.05, local ? 0.35 : 0.15)) });
  const now = mk();
  leads.set(d.id, {
    dealId: d.id,
    ...now,
    prev: d.start! >= MONTH_START ? { clicks: 0, calls: 0, forms: 0 } : mk(),
    source: local ? 'Tracked link + call number' : 'Tracked link',
    lastReport: chance(0.7) ? addDays(MONTH_START, -int(0, 3)) : null,
  });
}
// Spots held for sponsors still in the funnel, so nobody sells them twice.
export const holds: Hold[] = deals
  .filter((d) => (d.stage === 'Offer sent' || d.stage === 'Negotiating') && chance(0.55))
  .map((d) => ({ siteId: d.siteId, spot: d.spot, sponsor: d.sponsor, until: addDays(TODAY, int(-2, 21)), by: d.owner }));

// ---------- budget moves ----------
export const budgetMoves: BudgetMove[] = [];
for (const [siteId, cs] of campaignsBySite) {
  const on = cs.filter((c) => c.status === 'Enabled');
  if (on.length < 2 || budgetMoves.length >= 22 || !chance(0.45)) continue;
  const sorted = [...on].sort((a, b) => a.convFactor / a.cpcFactor - b.convFactor / b.cpcFactor);
  const from = sorted[0], to = sorted[sorted.length - 1];
  const amount = Math.max(2, Math.round(from.dailyBudget * between(0.15, 0.35)));
  budgetMoves.push({
    id: `move-${budgetMoves.length + 1}`,
    siteId,
    from: from.id,
    to: to.id,
    amount,
    gain: r2(between(0.8, 6)),
    confidence: Math.round(between(62, 94)),
    reason: `${to.type} costs ${Math.round(between(25, 60))}% less per conversion than ${from.type} over the last 14 days.`,
  });
}

// ---------- tests ----------
const TEST_TITLES: Record<Test['kind'], string[]> = {
  Budget: ['Raise Search budget +20%', 'Cut Display budget -30%', 'Weekend-only budget boost'],
  'Landing page': ['Short quote form vs long form', 'Add reviews above the fold', 'Phone number in header'],
  'Ad text': ['Price in headline', '"Same-day" vs "Fast" wording', 'Local city name in headline'],
};
export const tests: Test[] = [];
for (const s of sites) {
  if (s.state !== 'Live' || !chance(0.2)) continue;
  const kind = pick<Test['kind']>(['Budget', 'Landing page', 'Ad text']);
  const status = weighted<Test['status']>([['Running', 55], ['Finished', 35], ['Planned', 10]]);
  const start = status === 'Planned' ? addDays(TODAY, int(2, 10)) : addDays(TODAY, -int(5, 50));
  tests.push({
    id: `test-${tests.length + 1}`,
    siteId: s.id,
    kind,
    title: pick(TEST_TITLES[kind]),
    start,
    end: addDays(start, 21),
    status,
    result: status === 'Finished' ? pick(['+14% conversions (likely real)', '+6% conversions (not sure yet)', 'No clear difference', '-9% conversions, rolled back']) : status === 'Running' ? `${int(30, 90)}% of sample collected` : null,
    owner: s.owner,
  });
}

// ---------- alerts (and the data quirks behind them) ----------
export const alerts: Alert[] = [];
const ago = (h: number) => {
  const t = new Date(Date.parse(TODAY + 'T09:30:00Z') - h * 3600000);
  return t.toISOString().slice(0, 16).replace('T', ' ');
};
const live = sites.filter((s) => s.state === 'Live');
const addAlert = (a: Omit<Alert, 'id' | 'detected' | 'owner'>, owner?: string | null) =>
  alerts.push({ ...a, id: `al-${alerts.length + 1}`, detected: ago(int(1, 70)), owner: owner === undefined ? (chance(0.55) ? pick(OWNERS) : null) : owner });

for (const s of live.filter(() => chance(0.05))) {
  for (const d of s.days.slice(-6)) {
    d.organic = Math.round(d.organic * 0.45);
    d.visits = d.paid + d.organic + d.direct + d.referral + d.social;
  }
  addAlert({ type: 'Traffic dropped', severity: 'Critical', siteId: s.id, message: 'Qualified visits down 41% vs the previous 7 days, mostly organic.' });
}
for (const s of live.filter(() => chance(0.04))) {
  for (const d of s.days.slice(-3)) d.conversions = 0;
  addAlert({ type: 'Tracking broken', severity: 'Critical', siteId: s.id, message: 'No conversions recorded for 3 days while clicks are normal.' });
}
for (const s of live.filter(() => chance(0.05))) {
  s.seo.indexedChange = -int(15, 60);
  s.seo.issues.unshift(`${-s.seo.indexedChange} pages dropped out of Google's index`);
  addAlert({ type: 'SEO problem', severity: 'Warning', siteId: s.id, message: `${-s.seo.indexedChange} pages dropped out of Google's index this week.` });
}
for (const c of campaigns.filter(() => chance(0.03))) {
  const s = siteById.get(c.siteId)!;
  if (s.state !== 'Live') continue;
  for (const d of s.days.slice(-5)) d.clicks = Math.round(d.clicks * 0.62);
  addAlert({ type: 'Cost per click jumped', severity: 'Warning', siteId: s.id, campaignId: c.id, message: `Cost per click up 58% in 5 days on ${c.name}.` });
}
for (const c of campaigns) {
  if (c.platformStatus === 'Ad disapproved' || c.platformStatus === 'Account issue')
    addAlert({ type: 'Google Ads issue', severity: c.platformStatus === 'Account issue' ? 'Critical' : 'Warning', siteId: c.siteId, campaignId: c.id, message: c.platformStatus === 'Ad disapproved' ? `Google disapproved 1 ad in ${c.name} (policy: misleading claims).` : `${c.name} can't serve: billing problem on the Google Ads account.` });
}
for (const d of deals) {
  if (d.invoice?.status === 'Overdue')
    addAlert({ type: 'Invoice overdue', severity: (Date.parse(TODAY) - Date.parse(d.invoice.due)) / dayMs > 20 ? 'Critical' : 'Warning', siteId: d.siteId, message: `${d.sponsor}: invoice ${d.invoice.number} (€${d.fee.toLocaleString('en-GB')}) is ${Math.round((Date.parse(TODAY) - Date.parse(d.invoice.due)) / dayMs)} days overdue.` }, d.owner);
}
// "Spend over cap" alerts are added after metrics exist (below).

// ---------- metrics ----------
export interface Metrics {
  spend: number;
  visits: number;
  paid: number;
  organic: number;
  direct: number;
  referral: number;
  social: number;
  pageViews: number;
  adsense: number;
  sponsor: number;
  revenue: number;
  contribution: number;
  clicks: number;
  conversions: number;
  metaSpend: number;
  metaClicks: number;
  metaPaid: number;
}
const ZERO: Metrics = { spend: 0, visits: 0, paid: 0, organic: 0, direct: 0, referral: 0, social: 0, pageViews: 0, adsense: 0, sponsor: 0, revenue: 0, contribution: 0, clicks: 0, conversions: 0, metaSpend: 0, metaClicks: 0, metaPaid: 0 };

export function sponsorIncome(siteId: string, from: string, to: string) {
  let total = 0;
  for (const d of dealsBySite.get(siteId) ?? []) {
    if (!isLiveDeal(d) || !d.start || !d.end) continue;
    const a = Math.max(Date.parse(from), Date.parse(d.start));
    const b = Math.min(Date.parse(to), Date.parse(d.end));
    if (b >= a) total += (d.fee / 30) * ((b - a) / dayMs + 1);
  }
  return total;
}

/** Totals for one site over the last `n` days, `offset` periods back (offset 1 = the period before). */
export function siteMetrics(s: Site, n: number, offset = 0): Metrics {
  const end = s.days.length - n * offset;
  const slice = s.days.slice(Math.max(0, end - n), end);
  if (!slice.length) return { ...ZERO };
  const m = { ...ZERO };
  for (const d of slice) {
    m.spend += d.spend;
    m.visits += d.visits;
    m.paid += d.paid;
    m.organic += d.organic;
    m.direct += d.direct;
    m.referral += d.referral;
    m.social += d.social;
    m.pageViews += d.pageViews;
    m.adsense += d.adsense;
    m.clicks += d.clicks;
    m.conversions += d.conversions;
    m.metaSpend += d.metaSpend;
    m.metaClicks += d.metaClicks;
    m.metaPaid += d.metaPaid;
  }
  m.sponsor = sponsorIncome(s.id, slice[0].date, slice[slice.length - 1].date);
  m.revenue = m.adsense + m.sponsor;
  m.contribution = m.revenue - m.spend;
  return m;
}

export function sumMetrics(list: Metrics[]): Metrics {
  const m = { ...ZERO };
  for (const x of list) for (const k of Object.keys(m) as (keyof Metrics)[]) m[k] += x[k];
  return m;
}

/** Spend this month so far (1–21 Oct). */
export function monthToDate(s: Site) {
  return s.days.filter((d) => d.date >= LAST_DAY.slice(0, 8) + '01').reduce((a, d) => a + d.spend, 0);
}
const googleMonthToDate = (s: Site) => s.days.filter((d) => d.date >= LAST_DAY.slice(0, 8) + '01').reduce((a, d) => a + d.spend - d.metaSpend, 0);
export const DAYS_INTO_MONTH = Number(LAST_DAY.slice(8));
export const DAYS_IN_MONTH = 31;

/** A campaign's share of its site's numbers, nudged by its own cost and conversion factors. */
export function campaignMetrics(c: Campaign, n: number, offset = 0) {
  const s = siteById.get(c.siteId)!;
  const m = siteMetrics(s, n, offset);
  const on = c.status === 'Enabled' || offset > 0 || n > 7;
  const spend = on ? (m.spend - m.metaSpend) * c.share : 0;
  const clicks = Math.round((on ? (m.clicks - m.metaClicks) * c.share : 0) / c.cpcFactor);
  const conversions = Math.round((on ? m.conversions * c.share : 0) * c.convFactor);
  const impressions = Math.round(clicks / (c.type === 'Search' ? 0.055 : 0.009));
  return { spend, clicks, conversions, impressions, cpc: clicks ? spend / clicks : 0, cpa: conversions ? spend / conversions : 0 };
}
export function campaignMtd(c: Campaign) {
  return googleMonthToDate(siteById.get(c.siteId)!) * c.share * (c.status === 'Enabled' ? 1 : 0.4);
}

for (const c of campaigns) {
  const pacing = campaignMtd(c) / (c.dailyBudget * DAYS_INTO_MONTH);
  if (pacing > 1.15 && c.status === 'Enabled')
    addAlert({ type: 'Spend over cap', severity: pacing > 1.3 ? 'Critical' : 'Warning', siteId: c.siteId, campaignId: c.id, message: `${c.name} is spending ${Math.round((pacing - 1) * 100)}% faster than its budget this month.` });
}
// ---------- Meta sample ----------
// A small pilot, added last so the Google sample numbers stay as they were. Its spend counts in every site total.
export const META_DELIVERY = 0.92; // sample: how much of its daily budget an ad set spends
export const META_VISIT_RATE = 0.74; // sample: clicks that become landing page views
const META_PLAN: { budgets: number[]; cpc: number; edit: number; freq: number }[] = [
  { budgets: [2.5], cpc: 0.34, edit: 14, freq: 2.6 },
  { budgets: [6, 4], cpc: 0.26, edit: 20, freq: 1.8 },
  { budgets: [5], cpc: 0.29, edit: 18, freq: 2.1 },
  { budgets: [3, 2.5], cpc: 0.33, edit: 16, freq: 2.4 },
  { budgets: [7], cpc: 0.22, edit: 2, freq: 1.3 },
  { budgets: [5], cpc: 0.24, edit: 21, freq: 1.9 },
  { budgets: [4], cpc: 0.2, edit: 9, freq: 1.6 },
  { budgets: [8], cpc: 0.19, edit: 1, freq: 1.2 },
  { budgets: [3], cpc: 0.36, edit: 25, freq: 3.1 },
  { budgets: [5], cpc: 0.28, edit: 11, freq: 2 },
  { budgets: [6], cpc: 0.3, edit: 30, freq: 3.4 },
  { budgets: [2.5], cpc: 0.41, edit: 10, freq: 2.2 },
];
const metaSites = SITE_KINDS.flatMap((k) => {
  const ofKind = sites.filter((s) => s.state === 'Live' && s.kind === k);
  return k === 'Local' ? [ofKind.find((s) => s.size === 'Town'), ofKind.find((s) => s.size === 'City')] : ofKind.slice(0, 2);
}).filter((s): s is Site => !!s);
export const metaPilot = metaSites.map((site, i) => ({ site, plan: META_PLAN[i % META_PLAN.length] }));
/** The part of a site's monthly cap set aside for Meta. Google Ads can use the rest. */
export const metaLimits = new Map<string, number>();
metaPilot.forEach(({ site, plan }, i) => {
  const daily = plan.budgets.reduce((a, b) => a + b, 0) * META_DELIVERY;
  const clicks = daily / plan.cpc;
  for (const d of site.days) {
    if (d.spend <= 0) continue;
    const visits = Math.round(clicks * META_VISIT_RATE);
    const views = Math.round(visits * 1.6);
    const earned = d.pageViews ? (d.adsense / d.pageViews) * views : 0;
    d.spend = r2(d.spend + daily);
    d.clicks += Math.round(clicks);
    d.visits += visits;
    d.pageViews += views;
    d.adsense = r2(d.adsense + earned);
    d.metaSpend = daily;
    d.metaClicks = clicks;
    d.metaPaid = visits;
  }
  const limit = Math.ceil((daily * DAYS_IN_MONTH * 1.1) / 50) * 50;
  metaLimits.set(site.id, limit);
  site.monthlyCap += limit;
  const week = plan.budgets.map((b) => Math.round((b * META_DELIVERY * 7 * META_VISIT_RATE) / plan.cpc));
  if (week.every((w) => w < 50)) addAlert({ type: 'Learning limited', severity: 'Warning', siteId: site.id, message: `Meta ad sets get about ${Math.max(...week)} results a week, short of the 50 needed to finish learning.` }, null);
  if (i === 10) addAlert({ type: 'Ad wearing out', severity: 'Warning', siteId: site.id, message: `The average person has seen a Meta ad ${(plan.freq + 1).toFixed(1)} times, so it may be wearing out.` }, null);
  if (i === 8) addAlert({ type: 'Meta issue', severity: 'Warning', siteId: site.id, message: 'Meta rejected one ad. Check it and edit it before it can run again.' }, null);
});

alerts.sort((a, b) => (a.severity === b.severity ? b.detected.localeCompare(a.detected) : a.severity === 'Critical' ? -1 : 1));
// Three warnings were already handled this morning, so the queue shows what "done" looks like.
for (const [i, a] of alerts.filter((x) => x.severity === 'Warning').slice(2, 5).entries()) a.resolved = `${a.owner ?? OWNERS[i]} · ${String(8 + i).padStart(2, "0")}:${i ? "1" : "4"}5`;
export const openAlerts = alerts.filter((a) => !a.resolved);
export const alertsBySite = new Map<string, Alert[]>();
for (const a of openAlerts) alertsBySite.set(a.siteId, [...(alertsBySite.get(a.siteId) ?? []), a]);

export function siteRisk(s: Site): Risk {
  const as = alertsBySite.get(s.id) ?? [];
  if (as.some((a) => a.severity === 'Critical')) return 'High';
  if (as.length) return 'Medium';
  return 'Low';
}

