import he from 'he';
import { jobSchema, type JobInput, type Source } from '../shared/model.js';
import type { Store } from './store.js';

export function plain(value = '') {
  return he
    .decode(he.decode(String(value)))
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<\/(p|li|div|h[1-6])>|<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
function seniority(title: string): JobInput['seniority'] {
  if (/\b(lead|staff|principal|head|director)\b/i.test(title)) return 'lead';
  if (/\b(senior|sr\.?)\b/i.test(title)) return 'senior';
  if (/\b(junior|jr\.?)\b/i.test(title)) return 'junior';
  if (/\b(intern|internship)\b/i.test(title)) return 'intern';
  if (/\b(mid|middle|mid-level)\b/i.test(title)) return 'middle';
  return 'unknown';
}
function work(value: string): JobInput['workMode'] {
  if (/hybrid/i.test(value)) return 'hybrid';
  if (/remote/i.test(value)) return 'remote';
  if (/on.?site|office/i.test(value)) return 'onsite';
  return 'unknown';
}
function period(value = ''): JobInput['salaryPeriod'] {
  if (/year|annual/i.test(value)) return 'year';
  if (/month/i.test(value)) return 'month';
  if (/hour/i.test(value)) return 'hour';
  return 'unknown';
}
// Raw external payloads are normalized, then checked by the same schema as manual input.
export function normalize(provider: Source['provider'], raw: any, source: Source): JobInput {
  let result: Record<string, unknown> = {
    source: provider,
    company: source.name,
    externalId: String(raw.id || raw.jobUrl || ''),
    title: plain(raw.title || raw.text || ''),
  };
  if (provider === 'remotive')
    result = {
      ...result,
      company: raw.company_name,
      url: raw.url,
      location: raw.candidate_required_location || '',
      workMode: 'remote',
      description: plain(raw.description),
      tags: [raw.category, ...(raw.tags || [])].filter(Boolean).slice(0, 40),
      salaryText: raw.salary || '',
      publishedAt: raw.publication_date || '',
    };
  if (provider === 'greenhouse')
    result = {
      ...result,
      url: raw.absolute_url,
      location: raw.location?.name || '',
      workMode: work(raw.location?.name || ''),
      description: plain(raw.content),
      tags: (raw.departments || []).map((d: any) => d.name).slice(0, 40),
      publishedAt: raw.first_published || '',
    };
  if (provider === 'lever')
    result = {
      ...result,
      url: raw.hostedUrl,
      location: (raw.categories?.allLocations || [raw.categories?.location])
        .filter(Boolean)
        .join('; '),
      workMode: work(raw.workplaceType || ''),
      description: [
        raw.descriptionPlain || plain(raw.description),
        ...(raw.lists || []).map((l: any) => `${l.text}\n${plain(l.content)}`),
        raw.additionalPlain || plain(raw.additional),
      ]
        .filter(Boolean)
        .join('\n\n'),
      tags: [raw.categories?.team, raw.categories?.department].filter(Boolean),
      publishedAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : '',
      salaryMin: raw.salaryRange?.min ?? null,
      salaryMax: raw.salaryRange?.max ?? null,
      currency: raw.salaryRange?.currency || '',
      salaryPeriod: period(raw.salaryRange?.interval),
      salaryText: raw.salaryDescriptionPlain || '',
    };
  if (provider === 'ashby') {
    const salary = raw.compensation?.summaryComponents?.find(
      (c: any) => c.compensationType === 'Salary',
    );
    result = {
      ...result,
      url: raw.jobUrl,
      location: [raw.location, ...(raw.secondaryLocations || []).map((l: any) => l.location)]
        .filter(Boolean)
        .join('; '),
      workMode: work(raw.workplaceType || (raw.isRemote ? 'remote' : '')),
      description: raw.descriptionPlain || plain(raw.descriptionHtml),
      tags: [raw.department, raw.team].filter(Boolean),
      publishedAt: raw.publishedAt || '',
      salaryText: raw.compensation?.scrapeableCompensationSalarySummary || '',
      salaryMin: salary?.minValue ?? null,
      salaryMax: salary?.maxValue ?? null,
      currency: salary?.currencyCode || '',
      salaryPeriod: period(salary?.interval),
    };
  }
  if (provider === 'adzuna') {
    // Do not silently treat Adzuna's predicted salaries as employer-provided compensation.
    result = {
      ...result,
      company: raw.company?.display_name || 'Компания не указана',
      url: raw.redirect_url,
      location: raw.location?.display_name || '',
      description: plain(raw.description),
      publishedAt: raw.created || '',
      tags: [raw.category?.label].filter(Boolean),
      salaryText: raw.salary_min
        ? `${raw.salary_min}–${raw.salary_max || raw.salary_min}${String(raw.salary_is_predicted) === '1' ? ' (оценка Adzuna)' : ' (Adzuna; период и валюту проверьте в объявлении)'}`
        : '',
    };
  }
  result.seniority = seniority(result.title as string);
  return jobSchema.parse(result);
}

export type Fetcher = typeof fetch;
export async function fetchJobs(source: Source, fetcher: Fetcher = fetch): Promise<JobInput[]> {
  const get = async (url: string) => {
    const response = await fetcher(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'ScoutLocal/0.1 (personal job tracker)',
      },
      signal: AbortSignal.timeout(25000),
      redirect: 'error',
    });
    if (!response.ok)
      throw new Error(
        `Источник вернул HTTP ${response.status}${response.status === 429 ? ': слишком частые запросы' : ''}`,
      );
    const body = await response.text();
    if (body.length > 25_000_000) throw new Error('Ответ источника слишком большой');
    return JSON.parse(body);
  };
  const board = encodeURIComponent(source.board);
  let rows: any[] = [];
  if (source.provider === 'remotive') {
    const data = await get('https://remotive.com/api/remote-jobs');
    if (!Array.isArray(data.jobs)) throw new Error('Неожиданный формат ответа Remotive');
    rows = data.jobs;
  }
  if (source.provider === 'greenhouse') {
    const data = await get(`https://boards-api.greenhouse.io/v1/boards/${board}/jobs?content=true`);
    if (!Array.isArray(data.jobs)) throw new Error('Неожиданный формат ответа Greenhouse');
    rows = data.jobs.filter((j: any) => j.internal_job_id !== null);
  }
  if (source.provider === 'ashby') {
    const data = await get(
      `https://api.ashbyhq.com/posting-api/job-board/${board}?includeCompensation=true`,
    );
    if (!Array.isArray(data.jobs)) throw new Error('Неожиданный формат ответа Ashby');
    rows = data.jobs.filter((j: any) => j.isListed !== false);
  }
  if (source.provider === 'lever') {
    for (let skip = 0; skip < 10000; skip += 100) {
      const data = await get(
        `https://api.${source.region === 'eu' ? 'eu.' : ''}lever.co/v0/postings/${board}?mode=json&limit=100&skip=${skip}`,
      );
      if (!Array.isArray(data)) throw new Error('Неожиданный формат ответа Lever');
      rows.push(...data);
      if (data.length < 100) break;
      if (skip === 9900)
        throw new Error('Источник слишком большой: достигнут лимит 10 000 вакансий');
    }
  }
  if (source.provider === 'adzuna') {
    if (!process.env.ADZUNA_APP_ID || !process.env.ADZUNA_APP_KEY)
      throw new Error('Добавьте ADZUNA_APP_ID и ADZUNA_APP_KEY в .env и перезапустите приложение');
    for (let page = 1; page <= 3; page++) {
      const params = new URLSearchParams({
        app_id: process.env.ADZUNA_APP_ID,
        app_key: process.env.ADZUNA_APP_KEY,
        results_per_page: '50',
        what: source.query,
        sort_by: 'date',
        'content-type': 'application/json',
      });
      const data = await get(
        `https://api.adzuna.com/v1/api/jobs/${source.country}/search/${page}?${params}`,
      );
      if (!Array.isArray(data.results)) throw new Error('Неожиданный формат ответа Adzuna');
      rows.push(...data.results);
      if (data.results.length < 50) break;
    }
  }
  if (rows.length > 10000) throw new Error('Источник слишком большой: более 10 000 вакансий');
  return rows.map((row) => normalize(source.provider, row, source));
}

export class SyncService {
  busy = false;
  constructor(
    private store: Store,
    private fetcher: Fetcher = fetch,
  ) {}
  async run(sourceId?: string) {
    if (this.busy) throw new Error('Обновление уже выполняется');
    this.busy = true;
    const results: {
      id: string;
      name: string;
      added: number;
      total: number;
      cached?: boolean;
      error?: string;
    }[] = [];
    try {
      const sources = this.store
        .list<Source>('sources')
        .filter((s) => s.enabled && (!sourceId || sourceId === s.id));
      for (const source of sources) {
        const cooldown = source.provider === 'remotive' ? 6 * 3600000 : 15 * 60000;
        const last = source.lastSync && new Date(source.lastSync).getTime();
        const attempted = source.lastAttempt && new Date(source.lastAttempt).getTime();
        if (
          (last && Date.now() - last < cooldown) ||
          (attempted && Date.now() - attempted < 60000)
        ) {
          results.push({
            id: source.id,
            name: source.name,
            added: 0,
            total: source.count,
            cached: true,
            ...(source.error ? { error: source.error } : {}),
          });
          continue;
        }
        source.lastAttempt = new Date().toISOString();
        this.store.put('sources', source);
        try {
          const jobs = await fetchJobs(source, this.fetcher);
          let added = 0;
          this.store.transaction(() => {
            for (const job of jobs) if (this.store.addJob(job, source.id, true).created) added++;
            this.store.put('sources', {
              ...source,
              lastSync: new Date().toISOString(),
              error: '',
              count: jobs.length,
            });
          });
          results.push({ id: source.id, name: source.name, added, total: jobs.length });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Ошибка соединения';
          // Fetch errors may embed request URLs with API credentials; never return them.
          const safeMessage = /app_key|app_id|https?:\/\//i.test(message)
            ? 'Не удалось подключиться к источнику'
            : message.slice(0, 500);
          this.store.put('sources', { ...source, error: safeMessage });
          results.push({
            id: source.id,
            name: source.name,
            added: 0,
            total: 0,
            error: safeMessage,
          });
        }
      }
      return results;
    } finally {
      this.busy = false;
    }
  }
}
