import { describe, expect, it } from 'vitest';
import { companySchema, jobSchema, type Company, type Job } from '../shared/model';
import {
  defaultCompanyFilters,
  selectCompanies,
  knownSalary,
  visibleCompanyTags,
} from '../src/company-search';

const company = (input: Record<string, unknown> = {}): Company => ({
  ...companySchema.parse({ name: 'Acme', location: 'Berlin, Germany', ...input }),
  id: 'acme',
  createdAt: '',
  updatedAt: '',
});
const job = (id: string, input: Record<string, unknown> = {}): Job => ({
  ...jobSchema.parse({
    title: 'Product Analyst',
    company: 'Acme',
    location: 'Berlin, Germany',
    workMode: 'hybrid',
    seniority: 'senior',
    salaryMin: 60000,
    salaryMax: 80000,
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

describe('Company catalogue selection', () => {
  it('requires geography, work mode, level and salary to match the same vacancy', () => {
    const jobs = [
      job('berlin', { salaryMin: 45000 }),
      job('paris', { location: 'Paris, France' }),
      job('remote', { workMode: 'remote' }),
      job('junior', { seniority: 'junior' }),
    ];
    const filters = {
      ...defaultCompanyFilters,
      country: 'DE',
      mode: 'hybrid',
      level: 'middle_plus',
      salaryMin: '60000',
    };
    expect(selectCompanies([company()], jobs, filters)).toHaveLength(0);
    const rows = selectCompanies([company()], [...jobs, job('match')], filters);
    expect(rows).toHaveLength(1);
    expect(rows[0].matchingJobs.map((j) => j.id)).toEqual(['match']);
    expect(rows[0].allJobs).toHaveLength(5);
  });
  it('does not compare different currencies, periods, unknown salary or archived jobs', () => {
    const jobs = [
      job('usd', { currency: 'USD' }),
      job('month', { salaryPeriod: 'month' }),
      job('upper', { salaryMin: null }),
      job('archive', { stage: 'archived' }),
      job('match'),
    ];
    expect(
      selectCompanies([company()], jobs, {
        ...defaultCompanyFilters,
        salaryMin: '50000',
      })[0].matchingJobs.map((j) => j.id),
    ).toEqual(['match']);
    expect(
      knownSalary(job('unknown', { salaryMin: null, salaryMax: null, salaryText: 'Competitive' })),
    ).toBe(false);
    expect(
      knownSalary(job('text', { salaryMin: null, salaryMax: null, salaryText: '€50k–70k' })),
    ).toBe(true);
  });
  it('filters company metadata and leaves unknown scores out of minimum-score selections', () => {
    const c = company({
      companyType: 'fintech',
      sizeCategory: 'growth',
      dataDrivenScore: 8,
      checkedAt: '2026-09-21',
      origins: [{ label: 'Ashby', url: 'https://example.com' }],
      description: 'Bank payments',
    });
    const f = {
      ...defaultCompanyFilters,
      type: 'fintech',
      size: 'growth',
      score: 8,
      source: 'Ashby',
      after: '2026-09-20',
      query: 'payments',
    };
    expect(selectCompanies([c], [], f)).toHaveLength(1);
    expect(selectCompanies([c], [], { ...f, score: 9 })).toHaveLength(0);
    expect(selectCompanies([c], [], { ...f, after: '2026-09-22' })).toHaveLength(0);
    expect(selectCompanies([company()], [], { ...defaultCompanyFilters, score: 1 })).toHaveLength(
      0,
    );
  });
  it('allows companies on the watchlist without vacancies and hides historical date tags', () => {
    const c = company({
      workModes: ['hybrid'],
      tags: ['Подборка 21.09.2026', 'Проверено 21.09.2026', 'Product analytics'],
    });
    expect(
      selectCompanies([c], [], { ...defaultCompanyFilters, country: 'DE', mode: 'hybrid' }),
    ).toHaveLength(1);
    expect(selectCompanies([c], [], { ...defaultCompanyFilters, hasJobs: true })).toHaveLength(0);
    expect(visibleCompanyTags(c)).toEqual(['Product analytics']);
    expect(
      selectCompanies([company()], [], { ...defaultCompanyFilters, mode: 'unknown' }),
    ).toHaveLength(1);
    expect(selectCompanies([c], [], { ...defaultCompanyFilters, mode: 'unknown' })).toHaveLength(0);
  });
});
