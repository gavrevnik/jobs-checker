import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X, ArrowUpRight, Check, Copy, FileJson, Upload, AlertCircle, Loader2 } from 'lucide-react';
import Papa from 'papaparse';
import { api, split } from './api';
import {
  providerLabels,
  stageLabels,
  workLabels,
  profileLevelLabel,
  companySizeLabels,
  companyTypeLabels,
  type Company,
  type Job,
  type Profile,
  type Source,
} from '../shared/model';

export function Modal({
  title,
  children,
  close,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), a[href], input:not(:disabled), select, textarea, [tabindex="0"]',
        );
        if (!els?.length) return;
        if (
          e.shiftKey &&
          (document.activeElement === els[0] || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          els[els.length - 1].focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === els[els.length - 1] || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          els[0].focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', key);
      previous?.focus();
    };
  }, [close]);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-button" onClick={close} aria-label="Закрыть">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`field ${full ? 'full' : ''}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Submit({ busy, children = 'Сохранить' }: { busy: boolean; children?: ReactNode }) {
  return (
    <button className="button primary" disabled={busy} type="submit">
      {busy ? <Loader2 size={16} className="spin" /> : <Check size={16} />}
      {children}
    </button>
  );
}
export function ErrorText({ error }: { error: string }) {
  return error ? (
    <div className="error" role="alert">
      <AlertCircle size={17} />
      <span>{error}</span>
    </div>
  ) : null;
}
function companySite(website?: string) {
  try {
    const url = new URL(website || '');
    return ['https:', 'http:'].includes(url.protocol) ? url : undefined;
  } catch {
    return undefined;
  }
}

export function CompanyWebsite({ website }: { website: string }) {
  const site = companySite(website);
  return site ? (
    <External href={site.href} className="company-website">
      {site.hostname.replace(/^www\./, '')}
    </External>
  ) : null;
}

export function Logo({
  name,
  website,
  large = false,
}: {
  name: string;
  website?: string;
  large?: boolean;
}) {
  const index = [...name].reduce((n, c) => n + c.charCodeAt(0), 0) % 6;
  const site = companySite(website);
  // Some company sites publish their icon outside the conventional favicon path.
  const iconPath =
    site?.hostname.replace(/^www\./, '') === 'nexthink.com'
      ? '/favicons/apple-icon-120x120.png'
      : '/favicon.ico';
  const iconUrl = site ? new URL(iconPath, site.origin).href : '';
  const [failedUrl, setFailedUrl] = useState('');
  const [loadedUrl, setLoadedUrl] = useState('');
  const showImage = !!iconUrl && failedUrl !== iconUrl;
  return (
    <span
      aria-hidden="true"
      className={`company-logo color-${index} ${large ? 'large' : ''} ${showImage && loadedUrl === iconUrl ? 'has-image' : ''}`}
    >
      {name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((n) => n[0])
        .join('')
        .toUpperCase()}
      {showImage && (
        <img
          key={iconUrl}
          src={iconUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onLoad={() => setLoadedUrl(iconUrl)}
          onError={() => setFailedUrl(iconUrl)}
        />
      )}
    </span>
  );
}
export function External({
  href,
  children,
  className = '',
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a className={className} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ArrowUpRight size={14} />
    </a>
  );
}
export function Salary({ job }: { job: Job }) {
  if (job.salaryMin !== null || job.salaryMax !== null)
    return (
      <>
        {[job.salaryMin, job.salaryMax]
          .filter((n, i, a) => n !== null && (i === 0 || n !== a[0]))
          .map((n) => Number(n).toLocaleString('ru-RU'))
          .join(' – ')}{' '}
        {job.currency}{' '}
        <span className="muted">
          {{ year: '/ год', month: '/ мес.', hour: '/ час', unknown: '' }[job.salaryPeriod]}
        </span>
      </>
    );
  return <span className="muted">{job.salaryText || 'Зарплата не указана'}</span>;
}

export function JobForm({
  job,
  companies,
  done,
}: {
  job?: Job;
  companies: Company[];
  done: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        setError('');
        const values = Object.fromEntries(f);
        try {
          const result = await api(job ? `/jobs/${job.id}` : '/jobs', job ? 'PATCH' : 'POST', {
            ...job,
            ...values,
            tags: split(f.get('tags')),
            salaryMin: f.get('salaryMin') ? Number(f.get('salaryMin')) : null,
            salaryMax: f.get('salaryMax') ? Number(f.get('salaryMax')) : null,
          });
          if (!job && result.created === false) {
            setError(
              'Такая вакансия уже есть в базе. Откройте существующую карточку, чтобы изменить её.',
            );
            return;
          }
          done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <Field label="Название вакансии *" full>
          <input
            name="title"
            required
            maxLength={300}
            defaultValue={job?.title}
            placeholder="Например, Product Designer"
          />
        </Field>
        <Field label="Компания *">
          <input
            name="company"
            required
            list="company-options"
            defaultValue={job?.company}
            placeholder="Название компании"
          />
          <datalist id="company-options">
            {companies.map((c) => (
              <option key={c.id}>{c.name}</option>
            ))}
          </datalist>
        </Field>
        <Field label="Ссылка на вакансию">
          <input name="url" type="url" defaultValue={job?.url} placeholder="https://…" />
        </Field>
        <Field label="География / ограничения">
          <input
            name="location"
            defaultValue={job?.location}
            placeholder="Europe, Worldwide, Berlin…"
          />
        </Field>
        <Field label="Формат работы">
          <select name="workMode" defaultValue={job?.workMode || 'unknown'}>
            {Object.entries(workLabels).map(([v, t]) => (
              <option value={v} key={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Уровень">
          <select name="seniority" defaultValue={job?.seniority || 'unknown'}>
            {['unknown', 'intern', 'junior', 'middle', 'senior', 'lead'].map((v) => (
              <option key={v} value={v}>
                {v === 'unknown' ? 'Не указан' : v}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Этап">
          <select name="stage" defaultValue={job?.stage || 'new'}>
            {Object.entries(stageLabels).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Зарплата от">
          <input
            type="number"
            min="0"
            name="salaryMin"
            defaultValue={job?.salaryMin ?? ''}
            placeholder="Не указана"
          />
        </Field>
        <Field label="Зарплата до">
          <input
            type="number"
            min="0"
            name="salaryMax"
            defaultValue={job?.salaryMax ?? ''}
            placeholder="Не указана"
          />
        </Field>
        <Field label="Валюта">
          <select name="currency" defaultValue={job?.currency || ''}>
            {['', 'EUR', 'USD', 'GBP', 'MDL', 'RON'].map((v) => (
              <option key={v} value={v}>
                {v || 'Не указана'}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Период">
          <select name="salaryPeriod" defaultValue={job?.salaryPeriod || 'unknown'}>
            <option value="unknown">Не указан</option>
            <option value="year">За год</option>
            <option value="month">За месяц</option>
            <option value="hour">За час</option>
          </select>
        </Field>
        <Field label="Теги, через запятую">
          <input name="tags" defaultValue={job?.tags.join(', ')} placeholder="SaaS, React, B2B" />
        </Field>
        <Field label="Следующее действие">
          <input type="date" name="followUp" defaultValue={job?.followUp} />
        </Field>
        <Field label="Описание" full>
          <textarea
            name="description"
            rows={5}
            defaultValue={job?.description}
            placeholder="Задачи, требования и условия"
          />
        </Field>
        <Field label="Личные заметки" full>
          <textarea
            name="notes"
            rows={3}
            defaultValue={job?.notes}
            placeholder="Что интересно в этой роли? С кем связаться?"
          />
        </Field>
      </div>
      <ErrorText error={error} />
      <div className="form-footer">
        <span>* Обязательные поля</span>
        <Submit busy={busy} />
      </div>
    </form>
  );
}

export function CompanyForm({ company, done }: { company?: Company; done: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await api(
            company ? `/companies/${company.id}` : '/companies',
            company ? 'PATCH' : 'POST',
            {
              ...company,
              ...Object.fromEntries(f),
              tags: split(f.get('tags')),
              workModes: f.getAll('workModes'),
              dataDrivenScore: f.get('dataDrivenScore') ? Number(f.get('dataDrivenScore')) : null,
              origins: String(f.get('originLabels') || '')
                .split('\n')
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) => {
                  const [label, ...rest] = line.split(' | ');
                  return { label, url: rest.join(' | ') };
                }),
              evidenceUrls: String(f.get('evidenceUrls') || '')
                .split('\n')
                .map((s) => s.trim())
                .filter(Boolean),
            },
          );
          done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <Field label="Название компании *">
          <input name="name" required defaultValue={company?.name} placeholder="Название" />
        </Field>
        <Field label="Сайт">
          <input
            name="website"
            type="url"
            defaultValue={company?.website}
            placeholder="https://…"
          />
        </Field>
        <Field label="Сфера">
          <input
            name="industry"
            defaultValue={company?.industry}
            placeholder="Fintech, SaaS, Healthtech…"
          />
        </Field>
        <Field label="Тип компании">
          <select name="companyType" defaultValue={company?.companyType || 'other'}>
            {Object.entries(companyTypeLabels).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="География">
          <input name="location" defaultValue={company?.location} placeholder="Страна или регион" />
        </Field>
        <Field label="Размер компании">
          <input name="size" defaultValue={company?.size} placeholder="11–50, 51–200…" />
        </Field>
        <Field label="Категория размера">
          <select name="sizeCategory" defaultValue={company?.sizeCategory || 'unknown'}>
            {Object.entries(companySizeLabels).map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Дата актуализации">
          <input type="date" name="checkedAt" defaultValue={company?.checkedAt || ''} />
        </Field>
        <Field label="Data-driven оценка · 1–10">
          <input
            type="number"
            min="1"
            max="10"
            step="1"
            name="dataDrivenScore"
            defaultValue={company?.dataDrivenScore ?? ''}
          />
        </Field>
        <fieldset className="company-workmode-field">
          <legend>Формат работы</legend>
          {['remote', 'hybrid', 'onsite'].map((v) => (
            <label key={v}>
              <input
                type="checkbox"
                name="workModes"
                value={v}
                defaultChecked={company?.workModes?.includes(v as 'remote' | 'hybrid' | 'onsite')}
              />
              {workLabels[v]}
            </label>
          ))}
        </fieldset>
        <Field label="Статус">
          <select name="status" defaultValue={company?.status || 'watching'}>
            <option value="watching">Слежу</option>
            <option value="research">Изучаю</option>
            <option value="contacted">Связался</option>
            <option value="archived">Архив</option>
          </select>
        </Field>
        <Field label="Теги, через запятую" full>
          <input
            name="tags"
            defaultValue={company?.tags.join(', ')}
            placeholder="B2B, Series A, Open source"
          />
        </Field>
        <Field label="Описание · до 4–5 предложений" full>
          <textarea
            name="description"
            rows={4}
            maxLength={2000}
            defaultValue={company?.description || ''}
            placeholder="Чем занимается компания, какой продукт и для кого создаёт"
          />
        </Field>
        <Field label="Заметки и контакты" full>
          <textarea
            name="notes"
            rows={5}
            defaultValue={company?.notes}
            placeholder="Почему интересна компания, ссылки, контакты…"
          />
        </Field>
        <Field label="Обоснование data-driven оценки" full>
          <textarea
            name="dataDrivenEvidence"
            rows={3}
            maxLength={4000}
            defaultValue={company?.dataDrivenEvidence || ''}
            placeholder="Эксперименты, влияние на roadmap, аналитическая команда и ограничения оценки"
          />
        </Field>
        <Field label="Источники появления · название | ссылка, по одному в строке" full>
          <textarea
            name="originLabels"
            rows={3}
            defaultValue={
              company?.origins?.map((o) => o.label + (o.url ? ' | ' + o.url : '')).join('\n') || ''
            }
          />
        </Field>
        <Field label="Ссылки для проверки информации · по одной в строке" full>
          <textarea
            name="evidenceUrls"
            rows={3}
            defaultValue={company?.evidenceUrls?.join('\n') || ''}
          />
        </Field>
      </div>
      <ErrorText error={error} />
      <div className="form-footer">
        <span>Компания может быть без вакансий</span>
        <Submit busy={busy} />
      </div>
    </form>
  );
}

export function ProfileForm({ profile, done }: { profile?: Profile; done: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        try {
          await api(profile ? `/profiles/${profile.id}` : '/profiles', profile ? 'PATCH' : 'POST', {
            ...Object.fromEntries(f),
            keywords: split(f.get('keywords')),
            exclude: split(f.get('exclude')),
            locations: split(f.get('locations')),
            minSalary: f.get('minSalary') ? Number(f.get('minSalary')) : null,
          });
          done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="form-intro">
        Опишите, что вам подходит. Scout покажет совпадения по этим критериям и объяснит оценку
        каждой вакансии.
      </p>
      <div className="form-grid">
        <Field label="Название профиля" full>
          <input required name="name" defaultValue={profile?.name || 'Новый поиск'} />
        </Field>
        <Field label="Навыки и ключевые слова, через запятую" full>
          <input
            name="keywords"
            defaultValue={profile?.keywords.join(', ')}
            placeholder="product analyst | product analytics, SQL, A/B | experimentation"
          />
        </Field>
        <Field label="Исключить слова, через запятую" full>
          <input
            name="exclude"
            defaultValue={profile?.exclude.join(', ')}
            placeholder="internship, unpaid"
          />
        </Field>
        <Field label="География — любое из значений" full>
          <input
            name="locations"
            defaultValue={profile?.locations.join(', ')}
            placeholder="Europe, Worldwide, Moldova"
          />
        </Field>
        <Field label="Формат">
          <select name="workMode" defaultValue={profile?.workMode || 'any'}>
            <option value="any">Любой</option>
            {Object.entries(workLabels)
              .filter(([v]) => v !== 'unknown')
              .map(([v, t]) => (
                <option value={v} key={v}>
                  {t}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Уровень">
          <select name="seniority" defaultValue={profile?.seniority || 'any'}>
            {['any', 'intern', 'junior', 'middle', 'middle_plus', 'senior', 'lead'].map((v) => (
              <option value={v} key={v}>
                {profileLevelLabel(v)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Минимальная зарплата">
          <input
            type="number"
            min="0"
            name="minSalary"
            defaultValue={profile?.minSalary ?? ''}
            placeholder="Не принципиально"
          />
        </Field>
        <Field label="Валюта">
          <select name="currency" defaultValue={profile?.currency || 'EUR'}>
            {['EUR', 'USD', 'GBP', 'MDL', 'RON'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Период зарплаты">
          <select name="salaryPeriod" defaultValue={profile?.salaryPeriod || 'year'}>
            <option value="year">За год</option>
            <option value="month">За месяц</option>
            <option value="hour">За час</option>
          </select>
        </Field>
      </div>
      <Field label="Контекст и приоритеты поиска" full>
        <textarea
          name="notes"
          rows={7}
          maxLength={10000}
          defaultValue={profile?.notes || ''}
          placeholder="Целевые компании, задачи, аналитическая культура и условия переезда"
        />
      </Field>
      <p className="help">
        Разделяйте критерии запятой, а синонимы внутри одного критерия — символом |: A/B |
        experimentation. Достаточно одного синонима; разные критерии дают отдельные баллы. Контекст
        сохраняется как справка и не влияет на процент. Ключевые слова проверяются в названии,
        описании и тегах. География — текстовое совпадение, а не проверка права на работу. Зарплаты
        сравниваются только в одной валюте и за одинаковый период.
      </p>
      <ErrorText error={error} />
      <div className="form-footer">
        <span>Оценки пересчитаются сразу</span>
        <Submit busy={busy} />
      </div>
    </form>
  );
}

export function SourceForm({ done, companyName = '' }: { done: () => void; companyName?: string }) {
  const [provider, setProvider] = useState('ashby');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        const data = Object.fromEntries(f);
        setBusy(true);
        setError('');
        try {
          let board = String(data.board || '').trim();
          if (/^https?:/.test(board)) {
            const url = new URL(board);
            const hosts: Record<string, string[]> = {
              greenhouse: ['boards.greenhouse.io', 'job-boards.greenhouse.io'],
              lever: ['jobs.lever.co', 'jobs.eu.lever.co'],
              ashby: ['jobs.ashbyhq.com'],
            };
            if (!hosts[provider]?.includes(url.hostname))
              throw new Error(
                'Вставьте ссылку на доску выбранной платформы или её короткий идентификатор',
              );
            board = url.pathname.split('/').filter(Boolean)[0] || '';
            if (url.hostname === 'jobs.eu.lever.co') data.region = 'eu';
          }
          await api('/sources', 'POST', { ...data, provider, board });
          done();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="form-grid">
        <Field label="Источник" full>
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            {['ashby', 'greenhouse', 'lever', 'remotive', 'adzuna'].map((v) => (
              <option key={v} value={v}>
                {providerLabels[v]}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={
            ['ashby', 'greenhouse', 'lever'].includes(provider)
              ? 'Название компании *'
              : 'Название источника *'
          }
          full
        >
          <input
            name="name"
            required
            defaultValue={companyName}
            placeholder={
              provider === 'remotive'
                ? 'Remotive · удалённая работа'
                : 'Название компании или поиска'
            }
          />
        </Field>
        {['ashby', 'greenhouse', 'lever'].includes(provider) && (
          <Field label="Ссылка на доску вакансий или идентификатор *" full>
            <input
              name="board"
              required
              placeholder={`https://${provider === 'ashby' ? 'jobs.ashbyhq.com' : provider === 'lever' ? 'jobs.lever.co' : 'job-boards.greenhouse.io'}/company`}
            />
          </Field>
        )}
        {provider === 'lever' && (
          <Field label="Регион Lever">
            <select name="region">
              <option value="global">Global</option>
              <option value="eu">EU</option>
            </select>
          </Field>
        )}
        {provider === 'adzuna' && (
          <>
            <Field label="Поисковый запрос *">
              <input name="query" required placeholder="Product designer" />
            </Field>
            <Field label="Рынок">
              <select name="country">
                {[
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
                ].map((c) => (
                  <option key={c} value={c}>
                    {c.toUpperCase()}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}
      </div>
      <div className="callout">
        {provider === 'remotive'
          ? 'Открытая лента удалённых вакансий разных компаний. Данные обновляются не чаще раза в 6 часов, публикации поступают с задержкой 24 часа.'
          : provider === 'adzuna'
            ? 'Нужны бесплатная регистрация разработчика и ключи в .env: ADZUNA_APP_ID и ADZUNA_APP_KEY. Один запуск загружает до 150 свежих результатов по запросу. Доступ и квоты зависят от аккаунта.'
            : 'Публичные вакансии конкретной компании, без ключа API. Идентификатор находится в URL её карьерной страницы. Обновление — не чаще раза в 15 минут.'}
      </div>
      <ErrorText error={error} />
      <div className="form-footer">
        <span>Загрузка по кнопке «Обновить»</span>
        <Submit busy={busy}>Подключить</Submit>
      </div>
    </form>
  );
}

export const exampleImport = JSON.stringify(
  {
    companies: [
      {
        name: 'Example Company',
        website: 'https://example.com',
        industry: 'SaaS',
        tags: ['B2B'],
        notes: 'Почему компания интересна',
      },
    ],
    jobs: [
      {
        title: 'Product Designer',
        company: 'Example Company',
        url: 'https://example.com/careers/designer',
        location: 'Europe',
        workMode: 'remote',
        seniority: 'senior',
        tags: ['Figma', 'SaaS'],
        source: 'import',
        notes: 'Источник и пояснение из чата',
      },
    ],
  },
  null,
  2,
);
export function ImportForm({ done }: { done: () => void }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<any>(null);
  const [payload, setPayload] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const change = (value: string) => {
    setText(value);
    setPreview(null);
    setPayload(null);
    setError('');
  };
  const parse = (value: string) => {
    const trimmed = value
      .trim()
      .replace(/^```(?:json)?\s*/, '')
      .replace(/\s*```$/, '');
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      const data = JSON.parse(trimmed);
      return Array.isArray(data) ? { jobs: data } : data;
    }
    const parsed = Papa.parse<Record<string, string>>(trimmed, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });
    if (parsed.errors.length) throw new Error(`Ошибка CSV: ${parsed.errors[0].message}`);
    if (!parsed.meta.fields?.includes('company') || !parsed.meta.fields.includes('title'))
      throw new Error(
        'CSV должен содержать столбцы title и company; для компаний используйте JSON',
      );
    return {
      jobs: parsed.data.map((row) => {
        const item: Record<string, unknown> = { ...row, source: row.source || 'import' };
        for (const k of ['salaryMin', 'salaryMax'])
          if (k in item) item[k] = item[k] === '' ? null : Number(item[k]);
        for (const k of ['favorite', 'demo'])
          if (k in item) item[k] = ['true', '1'].includes(String(item[k]).toLowerCase());
        if ('tags' in item)
          item.tags = String(item.tags)
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean);
        for (const k of ['workMode', 'seniority', 'stage', 'salaryPeriod'])
          if (item[k] === '') delete item[k];
        return item;
      }),
    };
  };
  return (
    <div>
      <p className="form-intro">
        Добавьте результаты исследования из чата, JSON-файл или CSV с вакансиями. Перед сохранением
        можно проверить состав импорта.
      </p>
      <div className="import-toolbar">
        <label className="button secondary">
          <Upload size={16} />
          Выбрать файл
          <input
            className="sr-only"
            type="file"
            accept=".json,.csv,application/json,text/csv"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 20_000_000) return setError('Файл больше 20 МБ');
              change(await file.text());
            }}
          />
        </label>
        <button
          className="button ghost"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                `Подготовь проверенные компании и вакансии для моего локального трекера Scout. Не выдумывай вакансии, зарплаты и географию. Возвращай JSON в этой структуре, используй source: "import". Только title и company обязательны для вакансии, name — для компании. Ссылки должны вести на первоисточники. Неизвестные поля пропускай.\n\n${exampleImport}`,
              );
              setCopied(true);
            } catch {
              setError('Буфер обмена недоступен. Скопируйте пример вручную.');
            }
          }}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Промпт скопирован' : 'Промпт для чата'}
        </button>
      </div>
      <textarea
        className="import-text"
        aria-label="Данные для импорта"
        value={text}
        onChange={(e) => change(e.target.value)}
        rows={12}
        placeholder={exampleImport}
        spellCheck={false}
      />
      <details className="schema-help">
        <summary>Формат и пример данных</summary>
        <p className="help">
          JSON: объект с массивами companies и jobs или массив вакансий. CSV: title, company, url,
          location, workMode, seniority, tags, notes. Формат работы: remote / hybrid / onsite /
          unknown. Теги CSV — через точку с запятой. Повторные записи пропускаются.
        </p>
        <pre>{exampleImport}</pre>
        <button className="button secondary" onClick={() => change(exampleImport)}>
          Вставить пример
        </button>
      </details>
      {preview && (
        <div className="import-preview">
          <h3>Готово к импорту</h3>
          <div className="preview-counts">
            <span>
              <b>{preview.jobs.length}</b> вакансий
            </span>
            <span>
              <b>{preview.companies.length}</b> компаний
            </span>
            <span>
              <b>{preview.duplicates}</b> повторов
            </span>
          </div>
          {preview.jobs.slice(0, 5).map((j: any, i: number) => (
            <div className="preview-row" key={i}>
              <span>
                {j.title} · {j.company}
              </span>
              <span className="muted">{j.duplicate ? 'Уже в базе' : 'Новая'}</span>
            </div>
          ))}
          <p className="help">
            Существующие записи и заметки сохранятся. Новые компании из вакансий создаются
            автоматически.
          </p>
        </div>
      )}
      <ErrorText error={error} />
      <div className="form-footer">
        <span>JSON или CSV · до 5 000 записей</span>
        <button
          className="button primary"
          disabled={busy || !text.trim()}
          onClick={async () => {
            setError('');
            setBusy(true);
            try {
              if (!preview) {
                const data = parse(text);
                const p = await api('/import/preview', 'POST', data);
                setPayload(data);
                setPreview(p);
              } else {
                await api('/import', 'POST', payload);
                done();
              }
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? <Loader2 className="spin" size={16} /> : <FileJson size={16} />}
          {preview ? 'Добавить в базу' : 'Проверить данные'}
        </button>
      </div>
    </div>
  );
}
