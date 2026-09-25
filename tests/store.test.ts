import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store';
import { companySchema, jobSchema, canonicalUrl, type Company, type Job } from '../shared/model';

const stores: Store[] = [];
function memory() {
  const store = new Store(':memory:');
  stores.push(store);
  return store;
}
afterEach(() => {
  for (const store of stores.splice(0)) store.db.close();
});
const input = { title: 'Engineer', company: 'Acme', url: 'https://example.com/jobs/1' };

describe('Persistent local data', () => {
  it('reads old company rows with safe defaults and round-trips enrichment with notes intact', () => {
    const store = memory();
    const legacy = {
      id: 'old',
      name: 'Legacy',
      website: '',
      industry: '',
      location: '',
      size: '',
      tags: [],
      notes: 'My private notes',
      status: 'research',
      demo: false,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    store.db
      .prepare('INSERT INTO companies (id,name_key,data) VALUES (?,?,?)')
      .run('old', 'legacy', JSON.stringify(legacy));
    const c = store.get<Company>('companies', 'old')!;
    expect(c).toMatchObject({
      description: '',
      dataDrivenScore: null,
      sizeCategory: 'unknown',
      notes: 'My private notes',
      id: 'old',
    });
    const updated = store.saveCompany(
      {
        ...c,
        description: 'Payments platform',
        dataDrivenScore: 8,
        sizeCategory: 'growth',
        checkedAt: '2026-09-21',
        origins: [{ label: 'Ashby', url: 'https://example.com' }],
      },
      c.id,
    );
    const copy = memory();
    copy.importData(store.state());
    expect(copy.list<Company>('companies')[0]).toMatchObject({
      description: updated.description,
      dataDrivenScore: 8,
      notes: legacy.notes,
      status: 'research',
      origins: updated.origins,
    });
    expect(() => companySchema.parse({ ...c, dataDrivenScore: 11 })).toThrow();
    expect(() => companySchema.parse({ ...c, checkedAt: '2026-02-30' })).toThrow();
  });
  it('survives closing and reopening the database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'scout-test-'));
    const path = join(dir, 'test.sqlite');
    try {
      const store = new Store(path);
      const { job } = store.addJob(input);
      store.updateJob(job.id, { notes: 'Call Anna', stage: 'interview' });
      store.db.close();
      const reopened = new Store(path);
      expect(reopened.get<Job>('jobs', job.id)?.notes).toBe('Call Anna');
      expect(reopened.get<Job>('jobs', job.id)?.history).toHaveLength(2);
      reopened.db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it('deduplicates tracking URLs but preserves real job query parameters', () => {
    const store = memory();
    store.addJob(input);
    expect(store.addJob({ ...input, url: `${input.url}?utm_source=chat#details` }).created).toBe(
      false,
    );
    expect(store.addJob({ ...input, url: 'https://example.com/careers?gh_jid=1' }).created).toBe(
      true,
    );
    expect(store.addJob({ ...input, url: 'https://example.com/careers?gh_jid=2' }).created).toBe(
      true,
    );
    expect(store.list('jobs')).toHaveLength(3);
  });
  it('does not merge different offices of a job without a URL', () => {
    const store = memory();
    store.addJob({ ...input, url: '', location: 'Berlin' });
    expect(store.addJob({ ...input, url: '', location: 'London' }).created).toBe(true);
    expect(store.addJob({ ...input, url: '', location: 'berlin' }).created).toBe(false);
  });
  it('keeps notes, workflow, favorites and history during a source refresh', () => {
    const store = memory();
    const source = store.saveSource({ provider: 'ashby', name: 'Acme', board: 'acme' });
    const { job } = store.addJob({ ...input, source: 'ashby', externalId: '1' }, source.id, true);
    store.updateJob(job.id, {
      notes: 'My notes',
      stage: 'applied',
      favorite: true,
      followUp: '2026-10-01',
    });
    store.addJob(
      {
        ...input,
        title: 'Senior Engineer',
        description: 'Updated',
        source: 'ashby',
        externalId: '1',
        url: 'https://example.com/jobs/renamed',
      },
      source.id,
      true,
    );
    const updated = store.get<Job>('jobs', job.id)!;
    expect(updated).toMatchObject({
      notes: 'My notes',
      stage: 'applied',
      favorite: true,
      followUp: '2026-10-01',
      title: 'Senior Engineer',
      description: 'Updated',
    });
    expect(updated.history).toHaveLength(2);
    expect(store.list('jobs')).toHaveLength(1);
  });
  it('renames the company in its linked jobs', () => {
    const store = memory();
    const { job } = store.addJob(input);
    store.saveCompany({ name: 'Acme Studio' }, job.companyId);
    expect(store.get<Job>('jobs', job.id)?.company).toBe('Acme Studio');
  });
  it('keeps the linked company name consistent after a source refresh', () => {
    const store = memory();
    const source = store.saveSource({ provider: 'ashby', name: 'Acme', board: 'acme' });
    const { job } = store.addJob({ ...input, externalId: '1' }, source.id, true);
    store.saveCompany({ name: 'Acme Studio' }, job.companyId);
    store.addJob({ ...input, externalId: '1', description: 'Updated' }, source.id, true);
    expect(store.get<Job>('jobs', job.id)?.company).toBe('Acme Studio');
  });
  it('validates the whole import before writing anything', () => {
    const store = memory();
    expect(() =>
      store.importData({
        companies: [{ name: 'Valid' }],
        jobs: [input, { ...input, url: 'javascript:alert(1)' }],
      }),
    ).toThrow();
    expect(store.list('companies')).toHaveLength(0);
    expect(store.list('jobs')).toHaveLength(0);
  });
  it('previews duplicates both within an import and against the database', () => {
    const store = memory();
    store.addJob(input);
    const newJob = { ...input, url: 'https://example.com/jobs/2' };
    const payload = { jobs: [input, newJob, newJob] };
    expect(store.importData(payload, true)).toMatchObject({ duplicates: 2 });
    expect(store.importData(payload)).toMatchObject({ added: 1, skipped: 2 });
  });
  it('reimports an export while preserving workflow and source identity', () => {
    const store = memory();
    const source = store.saveSource({ provider: 'ashby', name: 'Acme', board: 'acme' });
    const { job } = store.addJob({ ...input, source: 'ashby', externalId: 'external' }, source.id);
    store.updateJob(job.id, { stage: 'interview', notes: 'Private note' });
    const copy = memory();
    copy.importData(store.state());
    const imported = copy.list<Job>('jobs')[0];
    expect(imported.history).toHaveLength(2);
    expect(imported.notes).toBe('Private note');
    const restoredSource = copy.get('sources', imported.sourceId);
    expect(restoredSource).toBeDefined();
    copy.addJob(
      { ...input, source: 'ashby', externalId: 'external', description: 'New description' },
      imported.sourceId,
      true,
    );
    expect(copy.list<Job>('jobs')).toHaveLength(1);
    expect(copy.list<Job>('jobs')[0].notes).toBe('Private note');
  });
  it('deleting demo rows preserves real jobs and shared companies', () => {
    const store = memory();
    store.addJob({ ...input, demo: true });
    store.addJob({ ...input, title: 'Real role', url: 'https://example.com/jobs/real' });
    store.clearDemo();
    expect(store.list<Job>('jobs')).toHaveLength(1);
    expect(store.list('companies')).toHaveLength(1);
  });
  it('rejects malformed dates and inverted salary ranges', () => {
    expect(() => jobSchema.parse({ ...input, publishedAt: 'yesterday maybe' })).toThrow();
    expect(() => jobSchema.parse({ ...input, salaryMin: 20, salaryMax: 10 })).toThrow();
  });
  it('canonicalizes query order without dropping job IDs', () => {
    expect(canonicalUrl('https://example.com/jobs?b=2&a=1&utm_source=x')).toBe(
      'https://example.com/jobs?a=1&b=2',
    );
  });
});
