import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJobs, normalize, plain, SyncService } from '../server/providers';
import { Store } from '../server/store';
import { sourceSchema, type Job, type Source } from '../shared/model';
const source = (provider: Source['provider']): Source => ({
  ...sourceSchema.parse({ provider, name: 'Acme', board: 'acme' }),
  id: 's1',
  lastSync: '',
  lastAttempt: '',
  error: '',
  count: 0,
});
const response = (body: unknown) =>
  new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const stores: Store[] = [];
afterEach(() => {
  for (const s of stores.splice(0)) s.db.close();
});
describe('Source adapters', () => {
  it('turns encoded markup into plain text and strips scripts', () => {
    expect(plain('&lt;p&gt;Hello &amp;amp; world&lt;/p&gt;<script>alert(1)</script>')).toBe(
      'Hello & world',
    );
  });
  it('keeps Remotive attribution, original link and geographic restrictions', () => {
    const job = normalize(
      'remotive',
      {
        id: 1,
        title: 'Designer',
        company_name: 'Acme',
        url: 'https://remotive.com/job/1',
        candidate_required_location: 'US only',
        salary: '$100k',
        description: '<p>Hello</p>',
      },
      source('remotive'),
    );
    expect(job).toMatchObject({
      source: 'remotive',
      url: 'https://remotive.com/job/1',
      workMode: 'remote',
      location: 'US only',
      salaryMin: null,
      salaryText: '$100k',
    });
  });
  it('does not use Greenhouse update date as publication date or guess onsite work', () => {
    const job = normalize(
      'greenhouse',
      {
        id: 1,
        title: 'Engineer',
        absolute_url: 'https://example.com/1',
        location: { name: 'London' },
        updated_at: '2026-09-20',
      },
      source('greenhouse'),
    );
    expect(job.publishedAt).toBe('');
    expect(job.workMode).toBe('unknown');
  });
  it('handles Ashby salary components without treating equity as salary', () => {
    const job = normalize(
      'ashby',
      {
        title: 'Senior Engineer',
        jobUrl: 'https://example.com/1',
        isRemote: true,
        location: 'EU',
        compensation: {
          summaryComponents: [
            { compensationType: 'EquityPercentage', minValue: 1 },
            {
              compensationType: 'Salary',
              minValue: 80000,
              maxValue: 100000,
              currencyCode: 'EUR',
              interval: '1 YEAR',
            },
          ],
        },
      },
      source('ashby'),
    );
    expect(job).toMatchObject({
      seniority: 'senior',
      salaryMin: 80000,
      salaryPeriod: 'year',
      currency: 'EUR',
    });
  });
  it('does not expose unlisted Ashby jobs', async () => {
    const mock = vi.fn<typeof fetch>().mockResolvedValue(
      response({
        jobs: [
          { title: 'Private', isListed: false },
          { title: 'Public', isListed: true, jobUrl: 'https://example.com/1' },
        ],
      }),
    );
    expect(await fetchJobs(source('ashby'), mock)).toHaveLength(1);
  });
  it('paginates Lever and handles its EU endpoint', async () => {
    const first = Array.from({ length: 100 }, (_, id) => ({
      id,
      text: 'Engineer',
      hostedUrl: `https://example.com/${id}`,
    }));
    const mock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response(first))
      .mockResolvedValueOnce(
        response([{ id: 101, text: 'Final job', hostedUrl: 'https://example.com/101' }]),
      );
    const jobs = await fetchJobs({ ...source('lever'), region: 'eu' }, mock);
    expect(jobs).toHaveLength(101);
    expect(mock.mock.calls[1][0]).toContain('api.eu.lever.co');
    expect(mock.mock.calls[1][0]).toContain('skip=100');
  });
  it('does not interpret Adzuna predicted salary as a confirmed range', () => {
    const job = normalize(
      'adzuna',
      {
        id: 1,
        title: 'Engineer',
        redirect_url: 'https://example.com/1',
        salary_min: 80000,
        salary_max: 100000,
        salary_is_predicted: '1',
      },
      source('adzuna'),
    );
    expect(job.salaryMin).toBeNull();
    expect(job.salaryText).toContain('оценка Adzuna');
  });
  it('validates source responses and reports HTTP failures', async () => {
    await expect(
      fetchJobs(
        source('ashby'),
        vi.fn<typeof fetch>().mockResolvedValue(response({ changed: true })),
      ),
    ).rejects.toThrow('формат');
    await expect(
      fetchJobs(
        source('ashby'),
        vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 429 })),
      ),
    ).rejects.toThrow('429');
  });
  it('persists source cooldowns and avoids refetching Remotive', async () => {
    const store = new Store(':memory:');
    stores.push(store);
    const mock = vi.fn<typeof fetch>().mockResolvedValue(response({ jobs: [] }));
    await new SyncService(store, mock).run();
    const second = await new SyncService(store, mock).run();
    expect(mock).toHaveBeenCalledTimes(1);
    expect(second[0].cached).toBe(true);
  });
  it('isolates a failed source and leaves existing workflow intact', async () => {
    const store = new Store(':memory:');
    stores.push(store);
    const { job } = store.addJob({ title: 'Existing', company: 'Acme', stage: 'interview' });
    store.saveSource({ provider: 'ashby', name: 'Acme', board: 'acme' });
    const mock = vi
      .fn<typeof fetch>()
      .mockImplementation(async (url) =>
        String(url).includes('ashby') ? new Response('', { status: 503 }) : response({ jobs: [] }),
      );
    const result = await new SyncService(store, mock).run();
    expect(result).toHaveLength(2);
    expect(result.some((r) => !!r.error)).toBe(true);
    expect(result.some((r) => !r.error)).toBe(true);
    expect(store.get<Job>('jobs', job.id)?.stage).toBe('interview');
  });
  it('does not leak credentials in source errors', async () => {
    const store = new Store(':memory:');
    stores.push(store);
    const mock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('https://api.example.com?app_key=secret'));
    const result = await new SyncService(store, mock).run();
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
