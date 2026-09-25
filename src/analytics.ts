import geography from './data/geography.json';
import { matchJob, type Job, type Profile } from '../shared/model';

export type SalaryMetric = 'mid' | 'low' | 'high';
export const metricLabels: Record<SalaryMetric, string> = {
  mid: 'Центры вилок',
  low: 'Нижние границы',
  high: 'Верхние границы',
};
export const periodLabels = {
  year: 'в год',
  month: 'в месяц',
  hour: 'в час',
  unknown: 'период не указан',
};
export type Place = {
  id: string;
  name: string;
  code: string;
  point: number[];
  kind: 'city' | 'country';
};
export type AnalyticsRow = { job: Job; places: Place[] };
export const countries = geography.countries;
const normalize = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const aliasPattern = (alias: string) =>
  new RegExp(
    `(^|[^\\p{L}\\p{N}])${normalize(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}\\p{N}])`,
    'u',
  );
const countryMatchers = countries.map((c) => ({
  ...c,
  patterns: c.aliases.filter((alias) => alias.length > 2).map(aliasPattern),
  codes: c.aliases
    .filter((alias) => /^[A-Z]{2}$/.test(alias))
    .map((code) => new RegExp(`(^|[^\\p{L}\\p{N}])${code}(?=$|[^\\p{L}\\p{N}])`, 'u')),
}));
const cityMatchers = geography.cities.map((c) => ({ ...c, patterns: c.aliases.map(aliasPattern) }));

// Parse only the vacancy's location, never company HQ, description or relocation notes.
export function locateJob(location: string): Place[] {
  const text = normalize(location);
  if (!text.trim()) return [];
  const explicit = countryMatchers.filter(
    (c) => c.patterns.some((p) => p.test(text)) || c.codes.some((p) => p.test(location)),
  );
  const foundCities = cityMatchers.filter((c) => c.patterns.some((p) => p.test(text)));
  const cities = foundCities.filter((c) => {
    const homonyms = foundCities.filter((other) => normalize(other.name) === normalize(c.name));
    if (homonyms.length === 1) return true;
    return explicit.some((country) => country.code === c.code);
  });
  const result: Place[] = cities.map((c) => ({
    id: `city:${c.id}`,
    name: c.name,
    code: c.code,
    point: c.point,
    kind: 'city',
  }));
  for (const c of explicit)
    if (!cities.some((city) => city.code === c.code))
      result.push({
        id: `country:${c.code}`,
        name: c.name,
        code: c.code,
        point: c.point,
        kind: 'country',
      });
  return result;
}

export function salaryValue(job: Job, metric: SalaryMetric): number | null {
  const valid = (n: number | null) => n !== null && Number.isFinite(n) && n >= 0;
  const low = valid(job.salaryMin) ? job.salaryMin : null;
  const high = valid(job.salaryMax) ? job.salaryMax : null;
  if (low !== null && high !== null && low > high) return null;
  return metric === 'low'
    ? low
    : metric === 'high'
      ? high
      : low !== null && high !== null
        ? (low + high) / 2
        : null;
}
export function sameSalaryGroup(job: Job, currency: string, period: string) {
  return (
    !!currency &&
    job.currency.toUpperCase() === currency.toUpperCase() &&
    job.salaryPeriod === period
  );
}
export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b),
    mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
export function histogram(values: number[]) {
  if (!values.length) return [];
  const min = Math.min(...values),
    max = Math.max(...values);
  const rough =
    (max - min || Math.max(max * 0.1, 1)) / Math.min(8, Math.ceil(Math.sqrt(values.length)));
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = ([1, 2, 5, 10].find((n) => n * power >= rough) || 10) * power;
  const start = Math.floor(min / step) * step;
  const count = Math.max(1, Math.ceil((max - start) / step));
  const bins = Array.from({ length: count }, (_, i) => ({
    low: start + i * step,
    high: start + (i + 1) * step,
    count: 0,
  }));
  for (const value of values) bins[Math.min(count - 1, Math.floor((value - start) / step))].count++;
  return bins;
}
export type AnalyticsFilters = {
  query: string;
  countries: string[];
  mode: string;
  level: string;
  stage: string;
  minMatch: number;
  currency: string;
  period: string;
  metric: SalaryMetric;
  salaryMin: string;
  salaryMax: string;
  onlySalary: boolean;
};
export const defaultFilters: AnalyticsFilters = {
  query: '',
  countries: [],
  mode: 'all',
  level: 'all',
  stage: 'active',
  minMatch: 0,
  currency: 'EUR',
  period: 'year',
  metric: 'mid',
  salaryMin: '',
  salaryMax: '',
  onlySalary: false,
};
export function filterAnalytics(rows: AnalyticsRow[], f: AnalyticsFilters, profile?: Profile) {
  return rows.filter(({ job, places }) => {
    if (
      f.stage === 'active' ? job.stage === 'archived' : f.stage !== 'all' && job.stage !== f.stage
    )
      return false;
    if (
      f.query &&
      !normalize([job.title, job.company, job.location, ...job.tags].join(' ')).includes(
        normalize(f.query.trim()),
      )
    )
      return false;
    if (
      f.countries.length &&
      !f.countries.some((c) =>
        c === 'unknown' ? !places.length : places.some((p) => p.code === c),
      )
    )
      return false;
    if (f.mode !== 'all' && job.workMode !== f.mode) return false;
    if (
      f.level !== 'all' &&
      (f.level === 'middle_plus'
        ? !['middle', 'senior', 'lead'].includes(job.seniority)
        : job.seniority !== f.level)
    )
      return false;
    if (f.minMatch && (matchJob(job, profile).score ?? -1) < f.minMatch) return false;
    if (f.onlySalary || f.salaryMin !== '' || f.salaryMax !== '') {
      const value = salaryValue(job, f.metric);
      if (!sameSalaryGroup(job, f.currency, f.period) || value === null) return false;
      if (f.salaryMin !== '' && value < Number(f.salaryMin)) return false;
      if (f.salaryMax !== '' && value > Number(f.salaryMax)) return false;
    }
    return true;
  });
}
export function groupPlaces(rows: AnalyticsRow[], selectedCountries: string[] = []) {
  const groups = new Map<string, { place: Place; jobs: Job[] }>();
  for (const { job, places } of rows)
    for (const place of places) {
      if (selectedCountries.length && !selectedCountries.includes(place.code)) continue;
      const group = groups.get(place.id) || { place, jobs: [] };
      if (!group.jobs.some((j) => j.id === job.id)) group.jobs.push(job);
      groups.set(place.id, group);
    }
  return [...groups.values()].sort((a, b) => b.jobs.length - a.jobs.length);
}
export function project(point: number[]) {
  const [lng, latitude] = point,
    lat = Math.max(-85, Math.min(85, latitude));
  return [
    ((lng + 180) / 360) * 1000,
    ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * 1000,
  ];
}
