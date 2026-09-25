import { describe, expect, it } from 'vitest';
import { jobSchema, type Job } from '../shared/model';
import {
  defaultFilters,
  filterAnalytics,
  groupPlaces,
  histogram,
  locateJob,
  median,
  salaryValue,
  type AnalyticsRow,
} from '../src/analytics';

const job = (id: string, input: Record<string, unknown> = {}): Job => ({
  ...jobSchema.parse({
    title: 'Product Analyst',
    company: 'Acme',
    location: 'Barcelona, Spain',
    salaryMin: 60000,
    salaryMax: 100000,
    currency: 'EUR',
    salaryPeriod: 'year',
    ...input,
  }),
  id,
  companyId: 'acme',
  sourceId: '',
  createdAt: '',
  updatedAt: '',
  lastSeenAt: '',
  history: [],
});
const row = (j: Job): AnalyticsRow => ({ job: j, places: locateJob(j.location) });

describe('Salary analytics', () => {
  it('does not invent midpoints for open-ended ranges or treat missing salary as zero', () => {
    expect(salaryValue(job('a'), 'mid')).toBe(80000);
    const open = job('b', { salaryMax: null });
    expect(salaryValue(open, 'low')).toBe(60000);
    expect(salaryValue(open, 'mid')).toBeNull();
    expect(salaryValue(open, 'high')).toBeNull();
    expect(salaryValue(job('c', { salaryMin: 0, salaryMax: 0 }), 'mid')).toBe(0);
    expect(salaryValue(job('d', { salaryMin: null, salaryMax: null }), 'mid')).toBeNull();
  });
  it('compares only the selected currency, period and boundary when filtering by salary', () => {
    const rows = [
      row(job('annual')),
      row(job('monthly', { salaryPeriod: 'month' })),
      row(job('usd', { currency: 'USD' })),
      row(job('unknown', { salaryPeriod: 'unknown' })),
      row(job('open', { salaryMax: null })),
      row(job('none', { salaryMin: null, salaryMax: null })),
    ];
    expect(filterAnalytics(rows, defaultFilters)).toHaveLength(6);
    expect(
      filterAnalytics(rows, { ...defaultFilters, salaryMin: '75000' }).map((r) => r.job.id),
    ).toEqual(['annual']);
    expect(
      filterAnalytics(rows, {
        ...defaultFilters,
        metric: 'low',
        salaryMin: '60000',
        salaryMax: '60000',
      }).map((r) => r.job.id),
    ).toEqual(['annual', 'open']);
    expect(
      filterAnalytics(rows, { ...defaultFilters, period: 'unknown', onlySalary: true }).map(
        (r) => r.job.id,
      ),
    ).toEqual(['unknown']);
  });
  it('includes each observation in exactly one histogram bin including upper edges and equal values', () => {
    for (const data of [
      [0],
      [42, 42, 42],
      [0, 10000, 20000, 30000],
      [57124, 69115, 86000],
      [0.1, 0.2, 0.3],
    ]) {
      const bins = histogram(data);
      expect(bins.reduce((n, b) => n + b.count, 0)).toBe(data.length);
      expect(bins[0].low).toBeLessThanOrEqual(Math.min(...data));
      expect(bins.at(-1)!.high).toBeGreaterThanOrEqual(Math.max(...data));
    }
    expect(histogram([])).toEqual([]);
    expect(median([])).toBeNull();
    expect(median([100, 1, 5])).toBe(5);
    expect(median([10, 20])).toBe(15);
  });
});
describe('Vacancy geography', () => {
  it('resolves multilingual city/country names and keeps country-only locations distinct', () => {
    expect(
      locateJob('Barcelona / El Prat de Llobregat, Spain').map((p) => [p.name, p.code, p.kind]),
    ).toEqual([['Barcelona', 'ES', 'city']]);
    expect(locateJob('Мадрид, Испания')[0]?.code).toBe('ES');
    expect(locateJob('Spain (Remote)')[0]?.kind).toBe('country');
    expect(
      locateJob('All France (remote); Germany (remote); Italy; Spain')
        .map((p) => p.code)
        .sort(),
    ).toEqual(['DE', 'ES', 'FR', 'IT']);
  });
  it('retains multiple locations without double counting jobs and respects country selection for markers', () => {
    const r = row(job('multi', { location: 'Barcelona, Spain; London, UK' }));
    expect(r.places.map((p) => p.code).sort()).toEqual(['ES', 'GB']);
    const selected = filterAnalytics([r], { ...defaultFilters, countries: ['ES', 'GB'] });
    expect(selected).toHaveLength(1);
    expect(groupPlaces(selected)).toHaveLength(2);
    expect(groupPlaces(selected, ['GB']).map((g) => g.place.code)).toEqual(['GB']);
  });
  it('does not turn remote regions, company names or ambiguous text into fake coordinates', () => {
    for (const location of [
      '',
      'Remote — Europe',
      'Anywhere',
      'Remote in EMEA',
      'Reading data remotely',
    ])
      expect(locateJob(location)).toEqual([]);
    const unknown = row(job('u', { location: 'Remote — Europe', company: 'Barcelona Systems' }));
    expect(filterAnalytics([unknown], { ...defaultFilters, countries: ['unknown'] })).toHaveLength(
      1,
    );
    expect(groupPlaces([unknown])).toHaveLength(0);
  });
  it('combines stage, location, seniority and work mode filters', () => {
    const rows = [
      row(job('keep', { workMode: 'hybrid', seniority: 'senior' })),
      row(job('archived', { stage: 'archived', workMode: 'hybrid', seniority: 'senior' })),
      row(job('remote', { workMode: 'remote', seniority: 'middle' })),
    ];
    expect(
      filterAnalytics(rows, {
        ...defaultFilters,
        countries: ['ES'],
        mode: 'hybrid',
        level: 'middle_plus',
      }).map((r) => r.job.id),
    ).toEqual(['keep']);
    expect(
      filterAnalytics(rows, { ...defaultFilters, stage: 'archived' }).map((r) => r.job.id),
    ).toEqual(['archived']);
  });
});
