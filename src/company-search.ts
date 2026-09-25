import { companySizeLabels, providerLabels, type Company, type Job } from '../shared/model';
import { locateJob, sameSalaryGroup, salaryValue } from './analytics';

export type CompanyFilters = {
  query: string;
  status: string;
  type: string;
  country: string;
  mode: string;
  size: string;
  score: number;
  source: string;
  after: string;
  hasJobs: boolean;
  level: string;
  salaryMin: string;
  currency: string;
  period: string;
};
export const defaultCompanyFilters: CompanyFilters = {
  query: '',
  status: 'active',
  type: 'all',
  country: 'all',
  mode: 'all',
  size: 'all',
  score: 0,
  source: 'all',
  after: '',
  hasJobs: false,
  level: 'all',
  salaryMin: '',
  currency: 'EUR',
  period: 'year',
};
export const visibleCompanyTags = (c: Company) =>
  c.tags.filter(
    (t) =>
      !/^(подборка|проверено|проверка|актуализировано)\b/i.test(t) &&
      !/^(Подборка|Проверено|Проверка|Актуализировано)/iu.test(t),
  );
export function companyOrigins(c: Company, jobs: Job[]) {
  if (c.origins?.length) return c.origins;
  const labels = [...new Set(jobs.map((j) => providerLabels[j.source] || j.source))];
  return (labels.length ? labels : ['Вручную']).map((label) => ({ label, url: '' }));
}
export const knownSalary = (j: Job) =>
  j.salaryMin !== null || j.salaryMax !== null || !!j.salaryText.match(/\d/);
export function companyModes(c: Company, jobs: Job[]) {
  return [
    ...new Set([
      ...(c.workModes || []),
      ...jobs.map((j) => j.workMode).filter((m) => m !== 'unknown'),
    ]),
  ];
}
export function selectCompanies(companies: Company[], jobs: Job[], f: CompanyFilters) {
  const geo = new Map<string, string[]>();
  const codes = (location: string) => {
    if (!geo.has(location)) geo.set(location, [...new Set(locateJob(location).map((p) => p.code))]);
    return geo.get(location)!;
  };
  const activeJobs = jobs.filter((j) => j.stage !== 'archived');
  const indexed = new Map<string, Job[]>();
  for (const j of activeJobs) indexed.set(j.companyId, [...(indexed.get(j.companyId) || []), j]);
  return companies
    .map((company) => {
      const allJobs = indexed.get(company.id) || [];
      const matchingJobs = allJobs.filter(
        (j) =>
          (f.country === 'all' ||
            (f.country === 'unknown'
              ? !codes(j.location).length
              : codes(j.location).includes(f.country))) &&
          (f.mode === 'all' || j.workMode === f.mode) &&
          (f.level === 'all' ||
            (f.level === 'middle_plus'
              ? ['middle', 'senior', 'lead'].includes(j.seniority)
              : j.seniority === f.level)) &&
          (!f.salaryMin ||
            (sameSalaryGroup(j, f.currency, f.period) &&
              salaryValue(j, 'low') !== null &&
              salaryValue(j, 'low')! >= Number(f.salaryMin))),
      );
      return { company, allJobs, matchingJobs, origins: companyOrigins(company, allJobs) };
    })
    .filter(({ company: c, allJobs, matchingJobs, origins }) => {
      if (
        f.status === 'active'
          ? c.status === 'archived'
          : f.status !== 'all' && c.status !== f.status
      )
        return false;
      if (f.type !== 'all' && c.companyType !== f.type) return false;
      if (f.size !== 'all' && c.sizeCategory !== f.size) return false;
      if (
        f.score &&
        (c.dataDrivenScore === null ||
          c.dataDrivenScore === undefined ||
          c.dataDrivenScore < f.score)
      )
        return false;
      if (f.source !== 'all' && !origins.some((o) => o.label === f.source)) return false;
      if (f.after && (!c.checkedAt || c.checkedAt < f.after)) return false;
      if (
        f.query &&
        ![
          c.name,
          c.description,
          c.industry,
          c.location,
          c.size,
          companySizeLabels[c.sizeCategory],
          ...visibleCompanyTags(c),
        ]
          .join(' ')
          .toLowerCase()
          .includes(f.query.trim().toLowerCase())
      )
        return false;
      // Country/mode/level/salary criteria must match the same job, not different jobs at the company.
      const jobCriteria = f.hasJobs || f.level !== 'all' || !!f.salaryMin;
      if (jobCriteria && !matchingJobs.length) return false;
      if (!jobCriteria && f.country !== 'all' && !matchingJobs.length) {
        if (
          f.country === 'unknown'
            ? codes(c.location).length > 0
            : !codes(c.location).includes(f.country)
        )
          return false;
      }
      if (
        !jobCriteria &&
        f.mode !== 'all' &&
        !matchingJobs.length &&
        (f.mode === 'unknown'
          ? c.workModes.length > 0
          : !c.workModes.some((mode) => mode === f.mode))
      )
        return false;
      if (
        !jobCriteria &&
        allJobs.length &&
        (f.country !== 'all' || f.mode !== 'all') &&
        !matchingJobs.length
      )
        return false;
      return true;
    })
    .sort(
      (a, b) =>
        (b.company.dataDrivenScore ?? -1) - (a.company.dataDrivenScore ?? -1) ||
        (b.company.checkedAt || '').localeCompare(a.company.checkedAt || '') ||
        a.company.name.localeCompare(b.company.name),
    );
}
