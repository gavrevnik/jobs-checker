import { z } from 'zod';

export const stages = ['new', 'saved', 'applied', 'interview', 'offer', 'archived'] as const;
export const stageLabels: Record<string, string> = {
  new: 'Новые',
  saved: 'В планах',
  applied: 'Откликнулся',
  interview: 'Интервью',
  offer: 'Оффер',
  archived: 'Архив',
};
export const workLabels: Record<string, string> = {
  remote: 'Удалённо',
  hybrid: 'Гибрид',
  onsite: 'Офис',
  unknown: 'Не указан',
};
export const providerLabels: Record<string, string> = {
  manual: 'Вручную',
  import: 'Импорт',
  remotive: 'Remotive',
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  adzuna: 'Adzuna',
  demo: 'Демо',
};
const text = z.string().trim().max(2000);
const link = z.union([
  z.literal(''),
  z.url().refine((v) => /^https?:\/\//i.test(v), 'Нужна ссылка http:// или https://'),
]);
const optionalNumber = z.number().finite().min(0).max(1e9).nullable().default(null);
const timestamp = z
  .string()
  .max(50)
  .refine((v) => !v || Number.isFinite(Date.parse(v)), 'Некорректная дата');
export const companySizeLabels = {
  unknown: 'Размер не подтверждён',
  small: 'Небольшая · до 50',
  medium: 'Средняя · 51–200',
  growth: 'Растущая · 201–1 000',
  large: 'Крупная · 1 001–5 000',
  enterprise: 'Enterprise · 5 000+',
};
export const companyTypeLabels = {
  fintech: 'Fintech',
  saas: 'B2B SaaS',
  marketplace: 'Marketplace',
  consumer: 'Consumer tech',
  gaming: 'Gaming',
  edtech: 'EdTech',
  healthtech: 'Healthtech',
  retail: 'Retail / e-commerce',
  media: 'Медиа',
  services: 'Услуги / агентство',
  nonprofit: 'Некоммерческая',
  other: 'Другое',
};
export const companySchema = z.object({
  name: z.string().trim().min(1, 'Укажите название компании').max(200),
  website: link.default(''),
  industry: text.default(''),
  location: text.default(''),
  size: text.default(''),
  description: z.string().max(2000).default(''),
  companyType: z
    .enum([
      'fintech',
      'saas',
      'marketplace',
      'consumer',
      'gaming',
      'edtech',
      'healthtech',
      'retail',
      'media',
      'services',
      'nonprofit',
      'other',
    ])
    .default('other'),
  sizeCategory: z
    .enum(['unknown', 'small', 'medium', 'growth', 'large', 'enterprise'])
    .default('unknown'),
  workModes: z
    .array(z.enum(['remote', 'hybrid', 'onsite']))
    .max(3)
    .default([]),
  checkedAt: z.union([z.literal(''), z.iso.date()]).default(''),
  origins: z
    .array(z.object({ label: z.string().trim().min(1).max(100), url: link.default('') }))
    .max(15)
    .default([]),
  dataDrivenScore: z.number().int().min(1).max(10).nullable().default(null),
  dataDrivenEvidence: z.string().max(4000).default(''),
  evidenceUrls: z.array(link).max(20).default([]),
  tags: z.array(z.string().trim().max(80)).max(40).default([]),
  notes: z.string().max(30000).default(''),
  status: z.enum(['watching', 'research', 'contacted', 'archived']).default('watching'),
  demo: z.boolean().default(false),
});
export const jobSchema = z
  .object({
    title: z.string().trim().min(1, 'Укажите название вакансии').max(300),
    company: z.string().trim().min(1, 'Укажите компанию').max(200),
    url: link.default(''),
    location: text.default(''),
    workMode: z.enum(['remote', 'hybrid', 'onsite', 'unknown']).default('unknown'),
    seniority: z
      .enum(['intern', 'junior', 'middle', 'senior', 'lead', 'unknown'])
      .default('unknown'),
    salaryMin: optionalNumber,
    salaryMax: optionalNumber,
    currency: z.string().trim().max(3).default(''),
    salaryPeriod: z.enum(['year', 'month', 'hour', 'unknown']).default('unknown'),
    salaryText: text.default(''),
    tags: z.array(z.string().trim().max(80)).max(40).default([]),
    description: z.string().max(200000).default(''),
    notes: z.string().max(30000).default(''),
    stage: z.enum(stages).default('new'),
    favorite: z.boolean().default(false),
    followUp: z.union([z.literal(''), z.iso.date()]).default(''),
    source: z
      .enum(['manual', 'import', 'remotive', 'greenhouse', 'lever', 'ashby', 'adzuna', 'demo'])
      .default('manual'),
    externalId: text.default(''),
    publishedAt: timestamp.default(''),
    demo: z.boolean().default(false),
  })
  .refine(
    (v) => v.salaryMin === null || v.salaryMax === null || v.salaryMax >= v.salaryMin,
    'Верхняя граница зарплаты меньше нижней',
  );
export const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  keywords: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(100)
        .refine((v) => keywordTerms(v).length > 0, 'Укажите слово или синоним'),
    )
    .max(30)
    .default([]),
  exclude: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  locations: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  workMode: z.enum(['any', 'remote', 'hybrid', 'onsite']).default('any'),
  seniority: z
    .enum(['any', 'intern', 'junior', 'middle', 'middle_plus', 'senior', 'lead'])
    .default('any'),
  notes: z.string().max(10000).default(''),
  minSalary: optionalNumber,
  currency: z.enum(['USD', 'EUR', 'GBP', 'MDL', 'RON']).default('EUR'),
  salaryPeriod: z.enum(['year', 'month', 'hour']).default('year'),
});
export const sourceSchema = z
  .object({
    provider: z.enum(['remotive', 'greenhouse', 'lever', 'ashby', 'adzuna']),
    name: z.string().trim().min(1).max(200),
    board: z
      .string()
      .trim()
      .max(150)
      .regex(/^[a-zA-Z0-9_.-]*$/, 'Нужен идентификатор доски, а не URL')
      .default(''),
    region: z.enum(['global', 'eu']).default('global'),
    enabled: z.boolean().default(true),
    query: z.string().trim().max(200).default(''),
    country: z
      .enum([
        'gb',
        'us',
        'de',
        'fr',
        'nl',
        'pl',
        'at',
        'au',
        'ca',
        'nz',
        'za',
        'br',
        'it',
        'es',
        'in',
        'sg',
        'ch',
        'be',
        'mx',
      ])
      .default('gb'),
  })
  .refine(
    (v) => !['greenhouse', 'lever', 'ashby'].includes(v.provider) || !!v.board,
    'Укажите идентификатор доски вакансий',
  );
export type CompanyInput = z.infer<typeof companySchema>;
export type JobInput = z.infer<typeof jobSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type SourceInput = z.infer<typeof sourceSchema>;
export type Company = CompanyInput & { id: string; createdAt: string; updatedAt: string };
export type Job = JobInput & {
  id: string;
  companyId: string;
  createdAt: string;
  updatedAt: string;
  sourceId: string;
  lastSeenAt: string;
  history: { stage: string; at: string }[];
};
export type Profile = ProfileInput & { id: string };
export type Source = SourceInput & {
  id: string;
  lastSync: string;
  lastAttempt: string;
  error: string;
  count: number;
};
export type State = {
  jobs: Job[];
  companies: Company[];
  profiles: Profile[];
  sources: Source[];
  adzunaConfigured: boolean;
};
export type Match = {
  score: number | null;
  reasons: string[];
  missing: string[];
  excluded: boolean;
};

export function keywordTerms(value: string) {
  return value
    .split('|')
    .map((v) => v.trim())
    .filter(Boolean);
}
export function keywordLabel(value: string) {
  return keywordTerms(value).join(' / ');
}
export function profileLevelLabel(value: string) {
  return value === 'any' ? 'Любой' : value === 'middle_plus' ? 'Middle / Senior / Lead' : value;
}

export function matchJob(job: JobInput, profile?: ProfileInput): Match {
  if (!profile) return { score: null, reasons: [], missing: [], excluded: false };
  const haystack = [job.title, job.company, job.description, job.location, ...job.tags]
    .join(' ')
    .toLowerCase();
  const excludes = profile.exclude.filter((k) => haystack.includes(k.toLowerCase()));
  const reasons: string[] = [];
  const missing: string[] = [];
  let points = 0;
  let total = 0;
  const check = (ok: boolean, weight: number, label: string) => {
    total += weight;
    if (ok) {
      points += weight;
      reasons.push(label);
    } else missing.push(label);
  };
  if (profile.keywords.length)
    for (const keyword of profile.keywords)
      check(
        keywordTerms(keyword).some((term) => haystack.includes(term.toLowerCase())),
        50 / profile.keywords.length,
        keywordLabel(keyword),
      );
  if (profile.workMode !== 'any')
    check(job.workMode === profile.workMode, 20, workLabels[profile.workMode]);
  if (profile.locations.length)
    check(
      profile.locations.some((x) => job.location.toLowerCase().includes(x.toLowerCase())),
      15,
      'География',
    );
  if (profile.seniority !== 'any')
    check(
      profile.seniority === 'middle_plus'
        ? ['middle', 'senior', 'lead'].includes(job.seniority)
        : job.seniority === profile.seniority,
      10,
      profileLevelLabel(profile.seniority),
    );
  if (profile.minSalary !== null)
    check(
      job.currency === profile.currency &&
        job.salaryPeriod === profile.salaryPeriod &&
        job.salaryMin !== null &&
        job.salaryMin >= profile.minSalary,
      15,
      `Зарплата от ${profile.minSalary} ${profile.currency}`,
    );
  return {
    score: excludes.length ? 0 : total ? Math.round((points / total) * 100) : null,
    reasons,
    missing: [...missing, ...excludes.map((x) => `Исключение: ${x}`)],
    excluded: !!excludes.length,
  };
}

export function canonicalUrl(value: string) {
  if (!value) return '';
  const url = new URL(value);
  url.hash = '';
  for (const key of [...url.searchParams.keys()])
    if (/^(utm_|ref$|source$)/i.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  return url.toString().replace(/\/$/, '');
}
