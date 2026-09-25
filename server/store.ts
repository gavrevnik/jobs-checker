import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  canonicalUrl,
  companySchema,
  jobSchema,
  profileSchema,
  sourceSchema,
  type Company,
  type Job,
  type Profile,
  type Source,
  type JobInput,
  type SourceInput,
} from '../shared/model.js';
import { z } from 'zod';

const importedJob = jobSchema.safeExtend({
  sourceId: z.string().max(100).optional(),
  createdAt: z.iso.datetime().optional(),
  updatedAt: z.iso.datetime().optional(),
  lastSeenAt: z.union([z.literal(''), z.iso.datetime()]).optional(),
  history: z
    .array(
      z.object({
        stage: z.enum(['new', 'saved', 'applied', 'interview', 'offer', 'archived']),
        at: z.iso.datetime(),
      }),
    )
    .max(10000)
    .optional(),
});
const importedSource = sourceSchema.safeExtend({ id: z.string().max(100).optional() });
export const importSchema = z
  .object({
    companies: z.array(companySchema).max(5000).default([]),
    jobs: z.array(importedJob).max(5000).default([]),
    profiles: z.array(profileSchema).max(100).default([]),
    sources: z.array(importedSource).max(100).default([]),
  })
  .refine(
    (x) => x.companies.length + x.jobs.length + x.profiles.length + x.sources.length > 0,
    'Файл не содержит записей',
  );
const stamp = () => new Date().toISOString();
const nameKey = (name: string) => name.trim().toLowerCase().replace(/\s+/g, ' ');

export class Store {
  db: DatabaseSync;
  constructor(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS companies (id TEXT PRIMARY KEY, name_key TEXT UNIQUE NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, url TEXT NOT NULL, origin TEXT NOT NULL, fingerprint TEXT NOT NULL, data TEXT NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS jobs_url ON jobs(url) WHERE url <> '';
      CREATE UNIQUE INDEX IF NOT EXISTS jobs_origin ON jobs(origin) WHERE origin <> '';
      CREATE INDEX IF NOT EXISTS jobs_fingerprint ON jobs(fingerprint);
      CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, data TEXT NOT NULL);
      PRAGMA user_version=1;`);
    if (!this.list<Profile>('profiles').length) this.saveProfile({ name: 'Мой поиск' });
    // Only on first database creation; a removed source is not resurrected.
    this.db.exec('CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)');
    if (!this.db.prepare("SELECT 1 FROM settings WHERE key='initialized'").get()) {
      this.saveSource({ provider: 'remotive', name: 'Remotive · удалённая работа' });
      this.db.prepare("INSERT INTO settings VALUES ('initialized','1')").run();
    }
  }
  list<T>(table: 'jobs' | 'companies' | 'profiles' | 'sources'): T[] {
    return this.db
      .prepare(`SELECT data FROM ${table} ORDER BY rowid DESC`)
      .all()
      .map((row) => this.decode<T>(table, row.data as string));
  }
  decode<T>(table: string, json: string): T {
    const data = JSON.parse(json);
    return (table === 'companies' ? { ...data, ...companySchema.parse(data) } : data) as T;
  }
  get<T>(table: 'jobs' | 'companies' | 'profiles' | 'sources', id: string): T | undefined {
    const row = this.db.prepare(`SELECT data FROM ${table} WHERE id=?`).get(id);
    return row ? this.decode<T>(table, row.data as string) : undefined;
  }
  put<T extends { id: string }>(table: 'profiles' | 'sources', data: T) {
    this.db
      .prepare(
        `INSERT INTO ${table} (id,data) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data`,
      )
      .run(data.id, JSON.stringify(data));
  }
  transaction<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }
  saveCompany(input: unknown, id?: string): Company {
    const data = companySchema.parse(input);
    const old = id ? this.get<Company>('companies', id) : undefined;
    if (id && !old) throw new Error('Компания не найдена');
    const row = this.db
      .prepare('SELECT id FROM companies WHERE name_key=?')
      .get(nameKey(data.name));
    if (row && row.id !== id) {
      if (!id) return this.get<Company>('companies', row.id as string)!;
      throw new Error('Компания с таким названием уже есть');
    }
    const company = {
      ...data,
      id: id || randomUUID(),
      createdAt: old?.createdAt || stamp(),
      updatedAt: stamp(),
    };
    this.db
      .prepare(
        'INSERT INTO companies VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET name_key=excluded.name_key,data=excluded.data',
      )
      .run(company.id, nameKey(data.name), JSON.stringify(company));
    if (old && old.name !== company.name)
      for (const job of this.list<Job>('jobs').filter((j) => j.companyId === id))
        this.writeJob({ ...job, company: company.name });
    return company;
  }
  findDuplicate(data: JobInput, sourceId = ''): Job | undefined {
    const url = canonicalUrl(data.url);
    const origin = sourceId && data.externalId ? `${sourceId}:${data.externalId}` : '';
    const fingerprint = [data.company, data.title, data.location].map(nameKey).join('|');
    const row = this.db
      .prepare(
        "SELECT data FROM jobs WHERE (url=? AND url<>'') OR (origin=? AND origin<>'') OR (?='' AND url='' AND fingerprint=?) LIMIT 1",
      )
      .get(url, origin, url, fingerprint);
    return row ? JSON.parse(row.data as string) : undefined;
  }
  writeJob(job: Job) {
    this.db
      .prepare(
        'INSERT INTO jobs VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET url=excluded.url,origin=excluded.origin,fingerprint=excluded.fingerprint,data=excluded.data',
      )
      .run(
        job.id,
        canonicalUrl(job.url),
        job.sourceId && job.externalId ? `${job.sourceId}:${job.externalId}` : '',
        [job.company, job.title, job.location].map(nameKey).join('|'),
        JSON.stringify(job),
      );
  }
  addJob(input: unknown, sourceId = '', sync = false) {
    const data = jobSchema.parse(input);
    const old = this.findDuplicate(data, sourceId);
    if (old) {
      if (sync && old.sourceId === sourceId) {
        // Source updates never erase the user's workflow, notes, favorites or follow-up date.
        this.writeJob({
          ...old,
          ...data,
          company: this.get<Company>('companies', old.companyId)?.name || data.company,
          id: old.id,
          companyId: old.companyId,
          sourceId,
          stage: old.stage,
          notes: old.notes,
          favorite: old.favorite,
          followUp: old.followUp,
          history: old.history,
          createdAt: old.createdAt,
          updatedAt: stamp(),
          lastSeenAt: stamp(),
        });
      }
      return { job: this.get<Job>('jobs', old.id)!, created: false };
    }
    const company = this.saveCompany({ name: data.company, demo: data.demo });
    const now = stamp();
    const job: Job = {
      ...data,
      id: randomUUID(),
      companyId: company.id,
      sourceId,
      createdAt: now,
      updatedAt: now,
      lastSeenAt: sourceId ? now : '',
      history: [{ stage: data.stage, at: now }],
    };
    this.writeJob(job);
    return { job, created: true };
  }
  updateJob(id: string, input: unknown) {
    const old = this.get<Job>('jobs', id);
    if (!old) throw new Error('Вакансия не найдена');
    const data = jobSchema.parse({ ...old, ...(input as object) });
    const company = this.saveCompany({ name: data.company, demo: data.demo });
    const job = {
      ...old,
      ...data,
      companyId: company.id,
      updatedAt: stamp(),
      history:
        data.stage === old.stage
          ? old.history
          : [...old.history, { stage: data.stage, at: stamp() }],
    };
    this.writeJob(job);
    return job;
  }
  saveProfile(input: unknown, id?: string) {
    if (id && !this.get('profiles', id)) throw new Error('Профиль не найден');
    const profile = { ...profileSchema.parse(input), id: id || randomUUID() };
    this.put('profiles', profile);
    return profile;
  }
  saveSource(input: unknown, id?: string) {
    const data = sourceSchema.parse(input);
    const old = id ? this.get<Source>('sources', id) : undefined;
    if (id && !old) throw new Error('Источник не найден');
    const key = (s: SourceInput) =>
      [s.provider, s.board.toLowerCase(), s.region, s.query, s.country].join('|');
    if (this.list<Source>('sources').some((s) => s.id !== id && key(s) === key(data)))
      throw new Error('Такой источник уже подключён');
    const source: Source = {
      ...data,
      id: id || randomUUID(),
      lastSync: old?.lastSync || '',
      lastAttempt: old?.lastAttempt || '',
      error: old?.error || '',
      count: old?.count || 0,
    };
    this.put('sources', source);
    return source;
  }
  importData(input: unknown, preview = false) {
    const data = importSchema.parse(input);
    const seen = new Set<string>();
    const jobs = data.jobs.map((job) => {
      const key = job.url
        ? canonicalUrl(job.url)
        : [job.company, job.title, job.location].map(nameKey).join('|');
      const duplicate = !!this.findDuplicate(job) || seen.has(key);
      seen.add(key);
      return { ...job, duplicate };
    });
    if (preview)
      return {
        jobs,
        companies: data.companies,
        profiles: data.profiles.length,
        sources: data.sources.length,
        duplicates: jobs.filter((j) => j.duplicate).length,
      };
    return this.transaction(() => {
      let added = 0;
      let skipped = 0;
      let companies = 0;
      for (const company of data.companies) {
        const before = this.list<Company>('companies').length;
        this.saveCompany(company);
        if (this.list<Company>('companies').length > before) companies++;
      }
      for (const profile of data.profiles)
        if (!this.list<Profile>('profiles').some((p) => p.name === profile.name))
          this.saveProfile(profile);
      const sourceMap = new Map<string, string>();
      for (const source of data.sources) {
        const existing = this.list<Source>('sources').find(
          (s) =>
            s.provider === source.provider &&
            s.board.toLowerCase() === source.board.toLowerCase() &&
            s.region === source.region &&
            s.query === source.query &&
            s.country === source.country,
        );
        const saved = existing || this.saveSource(source);
        if (source.id) sourceMap.set(source.id, saved.id);
      }
      for (const job of data.jobs) {
        const sourceId = job.sourceId
          ? sourceMap.get(job.sourceId) || (this.get('sources', job.sourceId) ? job.sourceId : '')
          : '';
        const result = this.addJob(job, sourceId);
        if (result.created) {
          added++;
          this.writeJob({
            ...result.job,
            createdAt: job.createdAt || result.job.createdAt,
            updatedAt: job.updatedAt || result.job.updatedAt,
            lastSeenAt: job.lastSeenAt || result.job.lastSeenAt,
            history: job.history?.length ? job.history : result.job.history,
          });
        } else skipped++;
      }
      return { added, skipped, companies };
    });
  }
  state() {
    return {
      jobs: this.list<Job>('jobs'),
      companies: this.list<Company>('companies'),
      profiles: this.list<Profile>('profiles'),
      sources: this.list<Source>('sources'),
      adzunaConfigured: !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
    };
  }
  delete(table: 'jobs' | 'profiles' | 'sources', id: string) {
    this.db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
  }
  clearDemo() {
    this.transaction(() => {
      for (const job of this.list<Job>('jobs')) if (job.demo) this.delete('jobs', job.id);
      for (const company of this.list<Company>('companies'))
        if (company.demo && !this.list<Job>('jobs').some((j) => j.companyId === company.id))
          this.db.prepare('DELETE FROM companies WHERE id=?').run(company.id);
    });
  }
}
