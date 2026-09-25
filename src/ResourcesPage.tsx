import { useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, BookOpen, Building2, Check, Search, Star, X, Plug } from 'lucide-react';
import { External } from './components';
import {
  resourceCategories,
  resourcesCheckedAt,
  searchResources,
  type SearchResource,
} from './search-resources';
import { companyResourceCategories, companyResources } from './company-resources';

const resourceTabs = [
  { id: 'sources', label: 'Ресурсы', icon: Plug },
  { id: 'search', label: 'Ресурсы для поиска', icon: Search },
  { id: 'companies', label: 'Ресурсы для изучения компаний', icon: Building2 },
] as const;
export type ResourceTab = (typeof resourceTabs)[number]['id'];

export function ResourcesPage({
  onSources,
  onCompanies,
  activeTab,
  onTabChange,
  sourcesPanel,
  sourcesCount,
}: {
  activeTab: ResourceTab;
  onTabChange: (tab: ResourceTab) => void;
  sourcesPanel: ReactNode;
  sourcesCount: number;
  onSources: () => void;
  onCompanies: () => void;
}) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('score');
  const isCompanyResearch = activeTab === 'companies';
  const collection: SearchResource<string>[] = isCompanyResearch
    ? companyResources
    : searchResources;
  const categories: Record<string, string> = isCompanyResearch
    ? companyResourceCategories
    : resourceCategories;
  function selectTab(tab: ResourceTab) {
    if (tab === activeTab) return;
    onTabChange(tab);
    setQuery('');
    setCategory('all');
  }
  const resources = useMemo(
    () =>
      collection
        .filter(
          (r) =>
            (category === 'all' || r.categories.some((c) => c === category)) &&
            [r.name, r.alias, r.reach, r.description, r.fit, r.caveat]
              .join(' ')
              .toLowerCase()
              .includes(query.trim().toLowerCase()),
        )
        .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.score - a.score)),
    [collection, query, category, sort],
  );

  return (
    <div className="resources-page">
      <div className="resources-tabs" role="tablist" aria-label="Полезные ресурсы">
        {resourceTabs.map((tab, index) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              ref={(element) => {
                tabRefs.current[index] = element;
              }}
              id={`resources-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="resources-panel"
              tabIndex={activeTab === tab.id ? 0 : -1}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => {
                let next: number;
                if (event.key === 'ArrowRight') next = (index + 1) % resourceTabs.length;
                else if (event.key === 'ArrowLeft')
                  next = (index + resourceTabs.length - 1) % resourceTabs.length;
                else if (event.key === 'Home') next = 0;
                else if (event.key === 'End') next = resourceTabs.length - 1;
                else return;
                event.preventDefault();
                selectTab(resourceTabs[next].id);
                tabRefs.current[next]?.focus();
              }}
            >
              <Icon size={19} aria-hidden="true" />
              <span>{tab.label}</span>
              <span className="resources-tab-count">
                {tab.id === 'sources'
                  ? sourcesCount
                  : tab.id === 'search'
                    ? searchResources.length
                    : companyResources.length}
              </span>
            </button>
          );
        })}
      </div>
      <div
        id="resources-panel"
        role="tabpanel"
        aria-labelledby={`resources-tab-${activeTab}`}
        tabIndex={0}
      >
        {activeTab === 'sources' ? (
          sourcesPanel
        ) : (
          <>
            <section
              className="resources-intro"
              aria-label={isCompanyResearch ? 'Изучение работодателя' : 'Для вашего поиска'}
            >
              <div className="resources-intro-icon">
                {isCompanyResearch ? (
                  <Building2 size={28} strokeWidth={1.5} />
                ) : (
                  <BookOpen size={28} strokeWidth={1.5} />
                )}
              </div>
              <div>
                <h2>
                  {isCompanyResearch ? 'Узнай компанию до интервью' : 'Где искать. Чем проверять.'}
                </h2>
                <p>
                  {isCompanyResearch
                    ? 'Начни с названия компании, нужного офиса и команды. Сопоставь бизнес, отзывы и практику работы с данными — и подготовь вопросы о том, как аналитика влияет на продукт.'
                    : 'Для Product Analyst middle+/senior: big tech и сильные европейские продуктовые команды, метрики, эксперименты и влияние на решения.'}
                </p>
                <div className="resources-route">
                  <span>{isCompanyResearch ? 'Бизнес и продукт' : 'Найти роль'}</span>
                  <ArrowRight size={13} />
                  <span>{isCompanyResearch ? 'Люди и аналитика' : 'Изучить команду'}</span>
                  <ArrowRight size={13} />
                  <span>{isCompanyResearch ? 'Вопросы на интервью' : 'Сравнить предложение'}</span>
                </div>
              </div>
            </section>

            <div className="resources-meta">
              <span>
                <Check size={14} /> Проверено {resourcesCheckedAt}
              </span>
              <details className="resources-method">
                <summary>Как выставлены оценки / 5</summary>
                <p>
                  Авторская оценка пользы для твоего профиля: соответствие продуктовой аналитике,
                  охват Европы и tech-компаний, полезность сведений и затраты на отбор. Это ориентир
                  для распределения времени, а не измеренная доля вакансий или гарантия качества.
                </p>
                <p>
                  5 — основной ресурс; 4 — регулярно использовать; 3 — дополнительный канал; 1–2 —
                  точечно. Оценка учитывает назначение: зарплатный сервис может быть полезен, даже
                  если ты не ищешь в нём вакансии. В каждой вкладке оценка относится к её задаче,
                  поэтому у одного ресурса оценки могут различаться. Это фиксированная подборка, она
                  не пересчитывается при переключении профиля.
                </p>
              </details>
            </div>

            <div className="resources-toolbar">
              <div className="search-input">
                <Search size={17} />
                <input
                  aria-label="Поиск ресурсов"
                  placeholder="Название, страна или задача"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query && (
                  <button
                    className="icon-button"
                    aria-label="Очистить поиск ресурсов"
                    onClick={() => setQuery('')}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
              <select
                aria-label="Сортировка ресурсов"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="score">Сначала полезные для меня</option>
                <option value="name">По названию</option>
              </select>
            </div>
            <div className="resource-filters" aria-label="Назначение ресурса">
              <button aria-pressed={category === 'all'} onClick={() => setCategory('all')}>
                Все <span>{collection.length}</span>
              </button>
              {Object.entries(categories).map(([key, label]) => (
                <button key={key} aria-pressed={category === key} onClick={() => setCategory(key)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="resources-count" role="status">
              Найдено: {resources.length}
            </p>

            <div className="resources-grid">
              {resources.map((r) => (
                <article className="resource-card" key={r.id}>
                  <div className="resource-card-heading">
                    <div>
                      <h2>{r.name}</h2>
                      {r.alias && <span className="resource-alias">{r.alias}</span>}
                    </div>
                    <span
                      className={`resource-score ${r.score >= 4 ? 'high' : ''}`}
                      aria-label={`Авторская оценка ${r.score} из 5`}
                    >
                      <Star size={14} />
                      <b>{r.score.toLocaleString('ru-RU')}</b>
                      <span>/ 5</span>
                    </span>
                  </div>
                  <p className="resource-reach">{r.reach}</p>
                  <div className="resource-tags">
                    {r.categories.map((c) => (
                      <span key={c}>{categories[c]}</span>
                    ))}
                  </div>
                  <p className="resource-description">{r.description}</p>
                  <div className="resource-fit">
                    <h3>{isCompanyResearch ? 'Что узнать о компании' : 'Польза для тебя'}</h3>
                    <p>{r.fit}</p>
                  </div>
                  <div className="resource-caveat">
                    <h3>Что учитывать</h3>
                    <p>{r.caveat}</p>
                  </div>
                  <div className="resource-card-links">
                    <External href={r.url}>Открыть ресурс</External>
                    <External href={r.sourceUrl}>Об источнике</External>
                    {r.extraUrl && <External href={r.extraUrl}>{r.extraLabel}</External>}
                    {r.connector && (
                      <button className="text-link" onClick={onSources}>
                        Подключить доску <ArrowRight size={13} />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {!resources.length && (
              <div className="resources-empty">
                <Search size={28} />
                <h2>Ресурсов не найдено</h2>
                <p>Попробуй другое название или убери фильтр.</p>
                <button
                  className="button secondary"
                  onClick={() => {
                    setQuery('');
                    setCategory('all');
                  }}
                >
                  Сбросить поиск
                </button>
              </div>
            )}
            <aside className="resources-note">
              <BookOpen size={20} />
              {isCompanyResearch ? (
                <p>
                  Сохраняй выводы и ссылки в заметках карточки в разделе{' '}
                  <button className="text-link" onClick={onCompanies}>
                    «Компании»
                  </button>
                  . Отмечай дату и офис; вопросы про роль аналитика, эксперименты и влияние на
                  решения уточняй у будущей команды. Часть площадок есть в обеих вкладках — здесь
                  подсказки посвящены изучению конкретного работодателя.
                </p>
              ) : (
                <p>
                  Это справочник внешних ресурсов. Найденную вакансию можно добавить в Scout вручную
                  или через импорт. Автоматическую загрузку настраивай в разделе{' '}
                  <button className="text-link" onClick={onSources}>
                    «Ресурсы»
                  </button>
                  . Поддержку переезда и визы проверяй в конкретной вакансии.
                </p>
              )}
            </aside>
          </>
        )}
      </div>
    </div>
  );
}
