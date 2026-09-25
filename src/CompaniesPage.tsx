import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Globe2,
  MapPin,
  Search,
  SlidersHorizontal,
  CalendarDays,
} from 'lucide-react';
import {
  companySizeLabels,
  companyTypeLabels,
  workLabels,
  type Company,
  type Job,
} from '../shared/model';
import { External, Logo, Salary } from './components';
import { countries, locateJob, periodLabels } from './analytics';
import {
  companyModes,
  companyOrigins,
  defaultCompanyFilters,
  knownSalary,
  selectCompanies,
  visibleCompanyTags,
  type CompanyFilters,
} from './company-search';
import './companies.css';

export function CompaniesPage({
  companies,
  jobs,
  onDetail,
  onJobs,
  onAdd,
}: {
  companies: Company[];
  jobs: Job[];
  onDetail: (id: string) => void;
  onJobs: (companyId: string, ids: string[]) => void;
  onAdd: () => void;
}) {
  const [filters, setFilters] = useState<CompanyFilters>(defaultCompanyFilters);
  const update = <K extends keyof CompanyFilters>(key: K, value: CompanyFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));
  const rows = useMemo(() => selectCompanies(companies, jobs, filters), [companies, jobs, filters]);
  const countryOptions = useMemo(() => {
    const codes = new Set(
      [...companies.map((c) => c.location), ...jobs.map((j) => j.location)].flatMap((location) =>
        locateJob(location).map((p) => p.code),
      ),
    );
    return countries
      .filter((c) => codes.has(c.code))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [companies, jobs]);
  const origins = [
    ...new Set(
      companies.flatMap((c) =>
        companyOrigins(
          c,
          jobs.filter((j) => j.companyId === c.id),
        ).map((o) => o.label),
      ),
    ),
  ].sort();
  const filteredJobs = [...new Set(rows.flatMap((r) => r.matchingJobs.map((j) => j.id)))];
  return (
    <div className="companies-page">
      <section className="company-filter-panel" aria-label="Фильтры компаний">
        <div className="company-filter-main">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Поиск компаний"
              placeholder="Название, описание или сфера"
              value={filters.query}
              onChange={(e) => update('query', e.target.value)}
            />
          </div>
          <label>
            Тип компании
            <select value={filters.type} onChange={(e) => update('type', e.target.value)}>
              <option value="all">Все типы</option>
              {Object.entries(companyTypeLabels).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Страна
            <select value={filters.country} onChange={(e) => update('country', e.target.value)}>
              <option value="all">Все страны</option>
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
              <option value="unknown">Не определена</option>
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
        </div>
        <div className="company-filter-main secondary-filters">
          <label>
            Размер
            <select value={filters.size} onChange={(e) => update('size', e.target.value)}>
              <option value="all">Любой размер</option>
              {Object.entries(companySizeLabels).map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>
            Data-driven
            <select value={filters.score} onChange={(e) => update('score', Number(e.target.value))}>
              <option value={0}>Любая оценка</option>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <option key={n} value={n}>
                  От {n} / 10
                </option>
              ))}
            </select>
          </label>
          <label>
            Источник компании
            <select value={filters.source} onChange={(e) => update('source', e.target.value)}>
              <option value="all">Все источники</option>
              {origins.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label>
            Статус компаний
            <select value={filters.status} onChange={(e) => update('status', e.target.value)}>
              <option value="active">Без архива</option>
              <option value="all">Все</option>
              <option value="watching">Слежу</option>
              <option value="research">Изучаю</option>
              <option value="contacted">Связался</option>
              <option value="archived">Архив</option>
            </select>
          </label>
        </div>
        <details className="company-extra-filters">
          <summary>
            <SlidersHorizontal size={14} />
            Вакансии, зарплата и дата
          </summary>
          <div>
            <label>
              Уровень вакансий
              <select value={filters.level} onChange={(e) => update('level', e.target.value)}>
                <option value="all">Любой уровень</option>
                <option value="middle_plus">Middle / Senior / Lead</option>
                {['middle', 'senior', 'lead', 'junior', 'intern', 'unknown'].map((v) => (
                  <option key={v} value={v}>
                    {v === 'unknown' ? 'Не указан' : v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Нижняя граница зарплаты от
              <input
                type="number"
                min="0"
                value={filters.salaryMin}
                placeholder="Не задано"
                onChange={(e) => update('salaryMin', e.target.value)}
              />
            </label>
            <label>
              Валюта
              <select value={filters.currency} onChange={(e) => update('currency', e.target.value)}>
                {[
                  ...new Set(['EUR', 'GBP', 'USD', ...jobs.map((j) => j.currency).filter(Boolean)]),
                ].map((c) => (
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
              Актуализировано с
              <input
                type="date"
                value={filters.after}
                onChange={(e) => update('after', e.target.value)}
              />
            </label>
          </div>
        </details>
        <div className="company-filter-footer">
          <label>
            <input
              type="checkbox"
              checked={filters.hasJobs}
              onChange={(e) => update('hasJobs', e.target.checked)}
            />
            Только с подходящими вакансиями
          </label>
          <button className="text-link" onClick={() => setFilters(defaultCompanyFilters)}>
            Сбросить фильтры
          </button>
        </div>
      </section>
      <div className="company-results-heading">
        <span role="status">
          Компаний: {rows.length} · Вакансий: {filteredJobs.length}
        </span>
        <button
          className="text-link"
          disabled={!filteredJobs.length}
          onClick={() => onJobs('', filteredJobs)}
        >
          Показать вакансии выборки <ArrowRight size={14} />
        </button>
      </div>
      <p className="company-rating-help">
        Data-driven — экспертная оценка продуктовой аналитики, а не работодателя в целом. Основания
        — внутри карточки. Формат и зарплата зависят от конкретной вакансии.
      </p>
      <div className="company-grid company-catalog">
        {rows.map(({ company: c, matchingJobs, origins: sourceOrigins }) => {
          const modes = matchingJobs.length
              ? [...new Set(matchingJobs.map((j) => j.workMode))]
              : c.workModes,
            salaryJobs = matchingJobs.filter(knownSalary);
          return (
            <article className="company-card" key={c.id}>
              <div className="company-identity">
                <Logo name={c.name} website={c.website} large />
                <div className="company-provenance">
                  <span className="company-checked" title="Дата актуализации информации">
                    <CalendarDays size={11} />
                    {c.checkedAt
                      ? new Date(c.checkedAt + 'T12:00:00').toLocaleDateString('ru-RU')
                      : 'Дата не указана'}
                  </span>
                  <div>
                    {sourceOrigins.slice(0, 2).map((o) =>
                      o.url ? (
                        <External key={o.label} className="company-origin" href={o.url}>
                          {o.label}
                        </External>
                      ) : (
                        <span key={o.label} className="company-origin">
                          {o.label}
                        </span>
                      ),
                    )}
                    {sourceOrigins.length > 2 && (
                      <span
                        className="company-origin"
                        title={sourceOrigins.map((o) => o.label).join(', ')}
                      >
                        +{sourceOrigins.length - 2}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <h2 className="company-title">
                {c.website ? (
                  <External href={c.website}>{c.name}</External>
                ) : (
                  <button onClick={() => onDetail(c.id)}>{c.name}</button>
                )}
              </h2>
              <p className="company-industry">
                {c.industry || companyTypeLabels[c.companyType] || 'Тип не указан'}
              </p>
              <div className="catalog-company-location">
                <MapPin size={13} />
                <span>{c.location || 'Локация офиса не указана'}</span>
              </div>
              <div className="catalog-company-location">
                <Globe2 size={13} />
                <span>
                  {modes.length ? modes.map((m) => workLabels[m]).join(' / ') : 'Формат не указан'}
                </span>
              </div>
              {c.description && <p className="catalog-company-description">{c.description}</p>}
              <div className="company-catalog-facts">
                <div>
                  <Building2 size={13} />
                  <span>Размер</span>
                  <strong title={c.size}>
                    {companySizeLabels[c.sizeCategory] || c.size || 'Не подтверждён'}
                  </strong>
                </div>
                <div>
                  <span>Data-driven</span>
                  <button
                    onClick={() => onDetail(c.id)}
                    className={`data-score ${(c.dataDrivenScore ?? 0) >= 8 ? 'high' : ''}`}
                    aria-label={`Data-driven ${c.name}: ${c.dataDrivenScore ?? 'не оценено'}. Открыть обоснование`}
                  >
                    {c.dataDrivenScore === null || c.dataDrivenScore === undefined
                      ? 'Не оценено'
                      : `${c.dataDrivenScore} / 10`}
                  </button>
                </div>
              </div>
              {salaryJobs.length > 0 && (
                <div className="company-salaries">
                  <span>Зарплаты вакансий</span>
                  {salaryJobs.slice(0, 2).map((j) => (
                    <div key={j.id} title={j.title}>
                      <Salary job={j} />
                    </div>
                  ))}
                  {salaryJobs.length > 2 && <small>Ещё {salaryJobs.length - 2} в вакансиях</small>}
                </div>
              )}
              <div className="company-catalog-footer">
                <button className="text-link" onClick={() => onDetail(c.id)}>
                  Карточка и заметки
                </button>
                <button
                  className="text-link"
                  disabled={!matchingJobs.length}
                  onClick={() =>
                    onJobs(
                      c.id,
                      matchingJobs.map((j) => j.id),
                    )
                  }
                >
                  Вакансии · {matchingJobs.length} <ArrowRight size={13} />
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {!rows.length && (
        <div className="empty compact-empty">
          <h2>Компаний по этим фильтрам нет</h2>
          <button className="button secondary" onClick={() => setFilters(defaultCompanyFilters)}>
            Сбросить фильтры
          </button>
          <button className="text-link" onClick={onAdd}>
            Добавить компанию
          </button>
        </div>
      )}
    </div>
  );
}

export function CompanyDetails({
  company: c,
  jobs,
  onEdit,
  onConnect,
}: {
  company: Company;
  jobs: Job[];
  onEdit: () => void;
  onConnect: () => void;
}) {
  return (
    <div className="company-detail-content">
      <div className="company-detail-actions">
        {c.website && <External href={c.website}>Сайт компании</External>}
        <button className="button secondary" onClick={onEdit}>
          Редактировать
        </button>
      </div>
      <p>
        {c.industry} · {c.location || 'Офис не указан'}
      </p>
      <p>
        {companyModes(c, jobs)
          .map((m) => workLabels[m])
          .join(' / ') || 'Формат не указан'}{' '}
        · {companySizeLabels[c.sizeCategory]}
        {c.size && ` (${c.size})`}
      </p>
      <section>
        <h3>Описание</h3>
        <p>{c.description || 'Описание пока не добавлено.'}</p>
      </section>
      <section>
        <h3>Заметки</h3>
        <p className="preserve-lines">{c.notes || 'Заметок пока нет.'}</p>
      </section>
      <section>
        <h3>
          Data-driven · {c.dataDrivenScore === null ? 'не оценено' : `${c.dataDrivenScore} / 10`}
        </h3>
        <p className="preserve-lines">
          {c.dataDrivenEvidence || 'Недостаточно информации для оценки.'}
        </p>
      </section>
      {visibleCompanyTags(c).length > 0 && (
        <div className="job-tags">
          {visibleCompanyTags(c).map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
      )}
      {c.evidenceUrls?.some(Boolean) && (
        <section>
          <h3>Проверка информации</h3>
          {c.evidenceUrls.filter(Boolean).map((url, i) => (
            <External key={i} href={url}>
              {new URL(url).hostname.replace(/^www\./, '')} · источник {i + 1}
            </External>
          ))}
        </section>
      )}
      <p className="muted">
        Актуализировано: {c.checkedAt || 'дата не указана'} ·{' '}
        {companyOrigins(c, jobs)
          .map((o) => o.label)
          .join(', ')}
      </p>
      <button className="text-link" onClick={onConnect}>
        Подключить карьерную страницу
      </button>
    </div>
  );
}
