import { useMemo, useState } from 'react';
import { ArrowUpRight, Search, SlidersHorizontal, X } from 'lucide-react';
import { stageLabels, workLabels, type Job, type Profile } from '../shared/model';
import { Salary } from './components';
import { JobMap } from './JobMap';
import {
  countries,
  defaultFilters,
  filterAnalytics,
  histogram,
  locateJob,
  median,
  metricLabels,
  periodLabels,
  salaryValue,
  sameSalaryGroup,
  type AnalyticsFilters,
  type SalaryMetric,
} from './analytics';
import './analytics.css';

const number = (value: number | null) =>
  value === null ? '—' : value.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
const short = (value: number) =>
  value >= 1000
    ? `${(value / 1000).toLocaleString('ru-RU', { maximumFractionDigits: 1 })} тыс.`
    : number(value);

export function AnalyticsPage({
  jobs,
  profile,
  onOpen,
}: {
  jobs: Job[];
  profile?: Profile;
  onOpen: (id: string) => void;
}) {
  const [filters, setFilters] = useState<AnalyticsFilters>(defaultFilters);
  const [limit, setLimit] = useState(30);
  const update = <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }));
    setLimit(30);
  };
  const rows = useMemo(() => jobs.map((job) => ({ job, places: locateJob(job.location) })), [jobs]);
  const filtered = useMemo(() => filterAnalytics(rows, filters, profile), [rows, filters, profile]);
  const countryOptions = countries
    .filter((c) => rows.some((r) => r.places.some((p) => p.code === c.code)))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const currencies = [
    ...new Set(['EUR', ...jobs.map((j) => j.currency.toUpperCase()).filter(Boolean)]),
  ].sort();
  const comparable = filtered
    .map((r) => r.job)
    .filter((j) => sameSalaryGroup(j, filters.currency, filters.period));
  const salaryJobs = comparable.filter(
    (j) => salaryValue(j, 'low') !== null || salaryValue(j, 'high') !== null,
  );
  const valuesFor = (metric: SalaryMetric) =>
    comparable.map((j) => salaryValue(j, metric)).filter((n): n is number => n !== null);
  const metricValues = valuesFor(filters.metric),
    bins = histogram(metricValues);
  const maxBin = Math.max(1, ...bins.map((b) => b.count));
  const salaryNumbers = salaryJobs.flatMap((j) =>
    [j.salaryMin, j.salaryMax].filter((n): n is number => n !== null),
  );
  const domainMin = salaryNumbers.length ? Math.max(0, Math.min(...salaryNumbers) * 0.9) : 0;
  const domainMax = Math.max(domainMin + 1, ...salaryNumbers.map((n) => n * 1.05));
  const percent = (n: number) => ((n - domainMin) / (domainMax - domainMin)) * 100;
  const invalidBounds =
    filters.salaryMin !== '' &&
    filters.salaryMax !== '' &&
    Number(filters.salaryMin) > Number(filters.salaryMax);
  const toggleCountry = (code: string) =>
    update(
      'countries',
      filters.countries.includes(code)
        ? filters.countries.filter((c) => c !== code)
        : [...filters.countries, code],
    );
  const unit = `${filters.currency} · ${periodLabels[filters.period as keyof typeof periodLabels]}`;
  const salaryFilterActive =
    filters.onlySalary || filters.salaryMin !== '' || filters.salaryMax !== '';

  return (
    <div className="analytics-page">
      <section className="analytics-filters" aria-label="Фильтры аналитики">
        <div className="analytics-filter-main">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Поиск в аналитике"
              placeholder="Компания, роль или навык"
              value={filters.query}
              onChange={(e) => update('query', e.target.value)}
            />
          </div>
          <label>
            Страны
            <select
              aria-label="Добавить страну в фильтр"
              value=""
              onChange={(e) => {
                if (e.target.value) toggleCountry(e.target.value);
              }}
            >
              <option value="">
                {filters.countries.length ? 'Добавить страну' : 'Все страны'}
              </option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code} disabled={filters.countries.includes(c.code)}>
                  {c.name}
                </option>
              ))}
              {rows.some((r) => !r.places.length) && (
                <option value="unknown" disabled={filters.countries.includes('unknown')}>
                  География не определена
                </option>
              )}
            </select>
          </label>
          <label>
            Формат
            <select value={filters.mode} onChange={(e) => update('mode', e.target.value)}>
              <option value="all">Любой формат</option>
              {Object.entries(workLabels).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <button
            className="text-link analytics-reset"
            onClick={() => {
              setFilters(defaultFilters);
              setLimit(30);
            }}
          >
            Сбросить
          </button>
        </div>
        {filters.countries.length > 0 && (
          <div className="analytics-chips">
            {filters.countries.map((code) => (
              <button
                key={code}
                onClick={() => toggleCountry(code)}
                aria-label={`Убрать страну ${countries.find((c) => c.code === code)?.name || 'География не определена'}`}
              >
                {countries.find((c) => c.code === code)?.name || 'География не определена'}
                <X size={12} />
              </button>
            ))}
          </div>
        )}
        <div className="analytics-salary-filters">
          <label>
            Валюта
            <select value={filters.currency} onChange={(e) => update('currency', e.target.value)}>
              {currencies.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label>
            Период
            <select value={filters.period} onChange={(e) => update('period', e.target.value)}>
              {Object.entries(periodLabels).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Сравнивать
            <select
              value={filters.metric}
              onChange={(e) => update('metric', e.target.value as SalaryMetric)}
            >
              {Object.entries(metricLabels).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Сумма от
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={filters.salaryMin}
              placeholder="Не задано"
              onChange={(e) => update('salaryMin', e.target.value)}
            />
          </label>
          <label>
            До
            <input
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              value={filters.salaryMax}
              placeholder="Не задано"
              onChange={(e) => update('salaryMax', e.target.value)}
            />
          </label>
        </div>
        <div className="analytics-filter-bottom">
          <label className="check-label">
            <input
              type="checkbox"
              checked={filters.onlySalary}
              onChange={(e) => update('onlySalary', e.target.checked)}
            />
            Только с зарплатой для сравнения
          </label>
          <details className="analytics-extra">
            <summary>
              <SlidersHorizontal size={14} />
              Ещё фильтры
            </summary>
            <div>
              <label>
                Уровень
                <select value={filters.level} onChange={(e) => update('level', e.target.value)}>
                  <option value="all">Любой</option>
                  <option value="middle_plus">Middle / Senior / Lead</option>
                  {['intern', 'junior', 'middle', 'senior', 'lead', 'unknown'].map((v) => (
                    <option key={v} value={v}>
                      {v === 'unknown' ? 'Не указан' : v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Этап
                <select value={filters.stage} onChange={(e) => update('stage', e.target.value)}>
                  <option value="active">Без архива</option>
                  <option value="all">Все этапы</option>
                  {Object.entries(stageLabels).map(([v, t]) => (
                    <option key={v} value={v}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Совпадение с профилем
                <select
                  disabled={!profile}
                  value={filters.minMatch}
                  onChange={(e) => update('minMatch', Number(e.target.value))}
                >
                  <option value={0}>Любое</option>
                  <option value={70}>От 70%</option>
                  <option value={90}>От 90%</option>
                </select>
              </label>
            </div>
          </details>
        </div>
        {invalidBounds ? (
          <p className="analytics-filter-error" role="alert">
            Сумма «от» должна быть не больше суммы «до».
          </p>
        ) : (
          <p className="analytics-footnote">
            {salaryFilterActive
              ? `Карта и список отфильтрованы по показателю «${metricLabels[filters.metric].toLowerCase()}», ${unit}. Несопоставимые зарплаты исключены.`
              : `Карта показывает все выбранные вакансии. Зарплатные графики — только ${unit}; чтобы отфильтровать карту по зарплате, задайте сумму или включите флажок.`}
          </p>
        )}
      </section>

      <div className="analytics-summary" role="status">
        <div>
          <span>Вакансий в выборке</span>
          <strong>{filtered.length}</strong>
          <small>из {jobs.length} в базе</small>
        </div>
        <div>
          <span>Компаний</span>
          <strong>{new Set(filtered.map((r) => r.job.companyId)).size}</strong>
        </div>
        <div>
          <span>Стран</span>
          <strong>
            {
              new Set(
                filtered
                  .flatMap((r) => r.places.map((p) => p.code))
                  .filter((c) => !filters.countries.length || filters.countries.includes(c)),
              ).size
            }
          </strong>
        </div>
        <div>
          <span>Сопоставимые зарплаты</span>
          <strong>
            {salaryJobs.length}
            <em> / {filtered.length}</em>
          </strong>
          <small>{unit}</small>
        </div>
      </div>
      <JobMap
        rows={filtered}
        selectedCountries={filters.countries}
        onCountry={toggleCountry}
        onOpen={onOpen}
      />

      <section className="analytics-panel" aria-label="Распределение зарплат">
        <div className="analytics-panel-head">
          <div>
            <h2>Зарплаты</h2>
            <p>{unit}</p>
          </div>
          <span className="analytics-kicker">{salaryJobs.length} вакансий с числовой вилкой</span>
        </div>
        <div className="salary-metrics">
          {(['low', 'mid', 'high'] as SalaryMetric[]).map((metric) => {
            const values = valuesFor(metric);
            return (
              <button
                key={metric}
                aria-pressed={filters.metric === metric}
                onClick={() => update('metric', metric)}
              >
                <span>{metricLabels[metric]}</span>
                <strong>{number(median(values))}</strong>
                <small>медиана · {values.length} вакансий</small>
              </button>
            );
          })}
        </div>
        <div className="salary-charts">
          <div className="salary-distribution">
            <h3>{metricLabels[filters.metric]}: распределение</h3>
            {bins.length ? (
              <div
                className="salary-histogram"
                role="img"
                aria-label={`${metricLabels[filters.metric]}. ${bins.map((b) => `${number(b.low)}–${number(b.high)}: ${b.count} вакансий`).join('; ')}`}
              >
                {bins.map((b, i) => (
                  <div className="histogram-bin" key={i}>
                    <div className="histogram-column">
                      <b>{b.count}</b>
                      <i style={{ height: `${(b.count / maxBin) * 140}px` }} />
                    </div>
                    <span>
                      {short(b.low)}
                      <br />– {short(b.high)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="analytics-empty">
                Нет зарплат для выбранного показателя.
                <span>Смените валюту, период или выберите другую границу вилки.</span>
              </div>
            )}
            <p className="analytics-footnote">
              Центр = (нижняя + верхняя граница) / 2. Открытая вилка без второй границы не участвует
              в расчёте центра. Интервалы гистограммы включают нижнюю границу; последний включает
              обе.
            </p>
          </div>
          <div className="salary-ranges">
            <h3>Вилки по вакансиям</h3>
            <div className="range-legend">
              <i />
              Диапазон <b />
              Центр
            </div>
            {salaryJobs.length > 0 ? (
              <>
                <div className="range-axis">
                  <span>{short(domainMin)}</span>
                  <span>{short(domainMax)}</span>
                </div>
                {salaryJobs
                  .slice()
                  .sort(
                    (a, b) =>
                      (salaryValue(b, filters.metric) ?? -1) -
                      (salaryValue(a, filters.metric) ?? -1),
                  )
                  .slice(0, 40)
                  .map((j) => {
                    const low = salaryValue(j, 'low'),
                      high = salaryValue(j, 'high'),
                      mid = salaryValue(j, 'mid');
                    return (
                      <button
                        className="salary-range-row"
                        key={j.id}
                        onClick={() => onOpen(j.id)}
                        title={`${j.company}: ${j.title}`}
                      >
                        <span>
                          <strong>{j.company}</strong>
                          <span>{j.title}</span>
                        </span>
                        <div className="range-track">
                          {low !== null && high !== null ? (
                            <i
                              style={{
                                left: `${percent(low)}%`,
                                width: `${Math.max(0.5, percent(high) - percent(low))}%`,
                              }}
                            />
                          ) : (
                            <i
                              className="range-endpoint"
                              style={{ left: `${percent(low ?? high ?? 0)}%` }}
                            />
                          )}
                          {mid !== null && <b style={{ left: `${percent(mid)}%` }} />}
                        </div>
                        <small>
                          {low === null ? 'до ' : ''}
                          {number(low ?? high)}
                          {low !== null && high !== null && low !== high
                            ? ` – ${number(high)}`
                            : ''}
                          {high === null ? ' +' : ''}
                        </small>
                      </button>
                    );
                  })}
                {salaryJobs.length > 40 && (
                  <p className="analytics-footnote">
                    Показаны первые 40 вилок. Сузьте выборку фильтрами.
                  </p>
                )}
              </>
            ) : (
              <div className="analytics-empty">Числовые вилки пока не указаны.</div>
            )}
          </div>
        </div>
        <p className="analytics-footnote salary-method">
          Каждая вакансия учитывается один раз. Валюты и периоды не смешиваются, пересчёта по курсу
          нет. Неполные вилки учитываются только по известной границе. Это заявленные суммы из
          карточек: до/после налогов, бонусы и условия нужно сверять в объявлении.
        </p>
      </section>

      <section className="analytics-panel analytics-job-results" aria-label="Вакансии из аналитики">
        <div className="analytics-panel-head">
          <h2>
            Вакансии в выборке <span>{filtered.length}</span>
          </h2>
        </div>
        {!filtered.length ? (
          <div className="analytics-empty">
            Нет вакансий по этим фильтрам.
            <button className="text-link" onClick={() => setFilters(defaultFilters)}>
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <div className="analytics-job-list">
            {filtered.slice(0, limit).map(({ job }) => (
              <button key={job.id} onClick={() => onOpen(job.id)}>
                <span>
                  <strong>{job.company}</strong>
                  <span>{job.title}</span>
                  <small>
                    {job.location || 'География не указана'} · {workLabels[job.workMode]}
                  </small>
                </span>
                <span className="analytics-job-salary">
                  <Salary job={job} />
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </div>
        )}
        {filtered.length > limit && (
          <button className="button secondary" onClick={() => setLimit((n) => n + 30)}>
            Показать ещё
          </button>
        )}
      </section>
    </div>
  );
}
