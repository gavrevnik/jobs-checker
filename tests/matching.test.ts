import { describe, expect, it } from 'vitest';
import { jobSchema, matchJob, profileSchema } from '../shared/model';
const job = jobSchema.parse({
  title: 'Senior React Engineer',
  company: 'Acme',
  description: 'TypeScript SaaS products',
  location: 'Europe',
  workMode: 'remote',
  seniority: 'senior',
  salaryMin: 80000,
  salaryMax: 100000,
  currency: 'EUR',
  salaryPeriod: 'year',
});
describe('Explainable matching', () => {
  it('counts alternatives as one criterion and does not match empty alternatives', () => {
    const p = profileSchema.parse({ name: 'Aliases', keywords: ['python | REACT', 'SQL'] });
    const result = matchJob(job, p);
    expect(result.score).toBe(50);
    expect(result.reasons).toEqual(['python / REACT']);
    expect(result.missing).toEqual(['SQL']);
    expect(profileSchema.safeParse({ name: 'Empty terms', keywords: [' | '] }).success).toBe(false);
    expect(
      matchJob(job, profileSchema.parse({ name: 'Trailing separator', keywords: ['python | '] }))
        .score,
    ).toBe(0);
  });
  it('supports middle and above without treating unknown seniority as a match', () => {
    const p = profileSchema.parse({ name: 'Middle+', seniority: 'middle_plus' });
    for (const seniority of ['middle', 'senior', 'lead'] as const)
      expect(matchJob({ ...job, seniority }, p).score).toBe(100);
    for (const seniority of ['intern', 'junior', 'unknown'] as const)
      expect(matchJob({ ...job, seniority }, p).score).toBe(0);
    expect(matchJob(job, { ...p, notes: 'Python only' }).score).toBe(100);
  });
  it('does not invent a score when no preferences exist', () => {
    expect(matchJob(job, profileSchema.parse({ name: 'Empty' })).score).toBeNull();
  });
  it('returns reasons and normalizes only configured weights', () => {
    const match = matchJob(
      job,
      profileSchema.parse({ name: 'Search', keywords: ['react', 'python'], workMode: 'remote' }),
    );
    expect(match.score).toBe(64);
    expect(match.reasons).toEqual(['react', 'Удалённо']);
    expect(match.missing).toEqual(['python']);
  });
  it('applies case-insensitive exclusions', () => {
    const match = matchJob(job, profileSchema.parse({ name: 'Search', exclude: ['REACT'] }));
    expect(match.excluded).toBe(true);
    expect(match.score).toBe(0);
  });
  it('does not compare different currencies or different salary periods', () => {
    expect(
      matchJob(job, profileSchema.parse({ name: 'Search', minSalary: 70000, currency: 'USD' }))
        .score,
    ).toBe(0);
    expect(
      matchJob(
        job,
        profileSchema.parse({
          name: 'Search',
          minSalary: 5000,
          currency: 'EUR',
          salaryPeriod: 'month',
        }),
      ).score,
    ).toBe(0);
  });
  it('requires the known lower salary bound, not the optimistic upper bound', () => {
    expect(matchJob(job, profileSchema.parse({ name: 'Search', minSalary: 90000 })).score).toBe(0);
    expect(matchJob(job, profileSchema.parse({ name: 'Search', minSalary: 75000 })).score).toBe(
      100,
    );
  });
  it('does not assume remote means eligible in every country', () => {
    const match = matchJob(job, profileSchema.parse({ name: 'Search', locations: ['Moldova'] }));
    expect(match.score).toBe(0);
    expect(match.missing).toContain('География');
  });
});
