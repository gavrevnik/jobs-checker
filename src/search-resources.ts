export const resourceCategories = {
  jobs: 'Вакансии',
  research: 'Компании и команды',
  salary: 'Зарплаты и уровни',
  relocation: 'Переезд',
} as const;

export type ResourceCategory = keyof typeof resourceCategories;
export type SearchResource<Category extends string = ResourceCategory> = {
  id: string;
  name: string;
  alias?: string;
  url: string;
  sourceUrl: string;
  categories: Category[];
  score: number;
  reach: string;
  description: string;
  fit: string;
  caveat: string;
  connector?: boolean;
  extraUrl?: string;
  extraLabel?: string;
};

// Editorial recommendations for the user's Product Analyst search, not measured rankings.
export const resourcesCheckedAt = '21 сентября 2026';
export const searchResources: SearchResource[] = [
  {
    id: 'linkedin',
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/jobs/',
    sourceUrl: 'https://www.linkedin.com/jobs/jobs-in-europe',
    categories: ['jobs', 'research'],
    score: 5,
    reach: 'Европа · широкий охват',
    description: 'Вакансии, рекрутеры, профессиональные связи и страницы компаний в одном месте.',
    fit: 'Основной канал для Product Analyst / Senior Product Analyst в big tech и европейских продуктовых компаниях. Ищи также Product Data Scientist и Decision Scientist, проверяя задачи.',
    caveat:
      'Один заголовок не раскрывает роль. Сверяй публикацию с сайтом работодателя, а аналитическую культуру — с устройством команды.',
  },
  {
    id: 'welcome',
    name: 'Welcome to the Jungle',
    alias: 'включая бывшую Otta',
    url: 'https://global.welcometothejungle.com/',
    sourceUrl: 'https://solutions.welcometothejungle.com/en/otta-is-now-welcome-to-the-jungle',
    categories: ['jobs', 'research'],
    score: 4.5,
    reach: 'Европейский tech · UK и другие рынки',
    description:
      'Поиск tech-ролей с подбором по предпочтениям и информацией о работодателе. Otta теперь входит в Welcome to the Jungle.',
    fit: 'Хороший второй канал для продуктовых команд и растущих tech-компаний. Ищи роли с ownership метрик и экспериментов.',
    caveat:
      'Покрытие зависит от страны. Профиль компании помогает начать проверку, но не подтверждает зрелость конкретной data-команды.',
  },
  {
    id: 'glassdoor',
    name: 'Glassdoor',
    url: 'https://www.glassdoor.com/',
    sourceUrl: 'https://www.glassdoor.com/about/',
    categories: ['research', 'salary'],
    score: 4.5,
    reach: 'Международный · выбирай европейский офис',
    description: 'Отзывы сотрудников, сведения о зарплатах и опыте интервью, а также поиск работы.',
    fit: 'Полезен перед откликом и интервью: ищи отзывы аналитиков, отношение к экспериментам, влияние на PM и реальные обязанности.',
    caveat:
      'Это пользовательские сведения. Сопоставляй несколько свежих отзывов из нужного офиса; средняя оценка компании не равна оценке команды.',
  },
  {
    id: 'levels',
    name: 'Levels.fyi',
    url: 'https://www.levels.fyi/',
    sourceUrl: 'https://www.levels.fyi/',
    categories: ['salary'],
    score: 4.5,
    reach: 'Big tech · международные зарплатные данные',
    description:
      'Данные о компенсациях, грейдах и составе пакета: базовая зарплата, бонусы и акции.',
    fit: 'Особенно полезен для сравнения офферов big tech и понимания seniority. Сравнивай один город, роль и уровень.',
    caveat:
      'По Product Analyst выборка может быть небольшой. Не переноси зарплату US Software Engineer на европейского аналитика; проверяй дату и число наблюдений.',
  },
  {
    id: 'greenhouse',
    name: 'Greenhouse / MyGreenhouse',
    url: 'https://my.greenhouse.com/',
    sourceUrl:
      'https://support.greenhouse.io/hc/en-us/articles/43418495049499-MyGreenhouse-FAQ-for-Candidates',
    categories: ['jobs'],
    score: 4,
    reach: 'Компании, использующие Greenhouse',
    description:
      'Greenhouse — система найма работодателей. MyGreenhouse — портал кандидата для поиска вакансий, откликов и их отслеживания.',
    fit: 'Полезен для адресного поиска в выбранных tech-компаниях. Их отдельные Greenhouse-доски уже можно подключать к Scout.',
    caveat:
      'Охват ограничен работодателями на этой платформе. Само использование Greenhouse ничего не говорит о силе аналитики.',
    extraUrl: 'https://www.greenhouse.com/',
    extraLabel: 'Сайт Greenhouse',
    connector: true,
  },
  {
    id: 'indeed',
    name: 'Indeed',
    url: 'https://www.indeed.com/',
    sourceUrl: 'https://www.indeed.com/about',
    categories: ['jobs'],
    score: 4,
    reach: 'Массовый рынок · много стран Европы',
    description:
      'Большой поисковик вакансий разных отраслей: прямые работодатели и объявления из других источников.',
    fit: 'Дополняет tech-площадки и помогает расширить список компаний. Используй Product Analyst / Data Analyst вместе со страной и продуктовой тематикой.',
    caveat:
      'Широкая выдача требует отбора: под Analyst могут скрываться отчётность, финансы или операции. Для культуры и интервью полезнее дополнить Glassdoor.',
  },
  {
    id: 'blind',
    name: 'Blind',
    url: 'https://www.teamblind.com/',
    sourceUrl: 'https://us.teamblind.com/faq',
    categories: ['research', 'salary'],
    score: 3.5,
    reach: 'Профессиональное tech-сообщество',
    description:
      'Анонимные обсуждения работы, команд, интервью и компенсаций среди верифицированных профессионалов.',
    fit: 'Дополнительный контекст по big tech: вопросы про аналитические команды, калибровку уровней, менеджеров и процесс найма.',
    caveat:
      'Проверяй, что обсуждение относится к Европе и нужной функции. Верификация участника не делает каждое его утверждение достоверным; часть возможностей требует аккаунта.',
  },
  {
    id: 'wellfound',
    name: 'Wellfound',
    url: 'https://wellfound.com/jobs',
    sourceUrl: 'https://wellfound.com/',
    categories: ['jobs', 'research'],
    score: 3.5,
    reach: 'Стартапы · международный охват',
    description: 'Вакансии стартапов и прямой контакт с основателями и нанимающими командами.',
    fit: 'Помогает находить продуктовые роли с большим влиянием на бизнес, особенно в компаниях, которые уже выросли до отдельной data-функции.',
    caveat:
      'Роль первого аналитика может означать построение отчётности с нуля. Для твоего запроса отдельно проверяй наставничество, команду и практику A/B-тестов.',
  },
  {
    id: 'relocate',
    name: 'Relocate.me',
    url: 'https://relocate.me/international-jobs',
    sourceUrl: 'https://relocate.me/international-jobs',
    categories: ['jobs', 'relocation'],
    score: 3,
    reach: 'Международные вакансии · переезд',
    description:
      'Ресурс для международного поиска работы и переезда, с каталогом вакансий и материалами о жизни в других странах.',
    fit: 'Дополнительный канал для вакансий с явно описанной поддержкой переезда в Испанию или другую европейскую страну.',
    caveat:
      'Узкий запрос Product Analyst может давать мало результатов. Проверяй актуальность на сайте работодателя и различай пакет переезда и визовое спонсорство.',
  },
  {
    id: 'landing',
    name: 'Landing.Jobs',
    url: 'https://landing.jobs/',
    sourceUrl: 'https://wp.landing.jobs/',
    categories: ['jobs', 'relocation'],
    score: 3,
    reach: 'Европейский tech · сильный фокус на Португалии',
    description: 'Tech-рекрутинг и вакансии с удалённым, гибридным и офисным форматом работы.',
    fit: 'Полезен как дополнительный канал при расширении поиска за пределы Испании и для знакомства с работодателями в европейском tech.',
    caveat:
      'Ищи именно продуктовую аналитику среди более широких IT-ролей. Удалённый формат сам по себе не означает возможность переезда или оформления в Испании.',
  },
  {
    id: 'eures',
    name: 'EURES',
    url: 'https://eures.europa.eu/jobseekers_en',
    sourceUrl: 'https://eures.europa.eu/jobseekers_en',
    categories: ['jobs', 'relocation'],
    score: 2.5,
    reach: 'Официальная европейская сеть занятости',
    description:
      'Европейский портал вакансий, консультантов и справочной информации о работе и жизни в разных странах.',
    fit: 'Полезен для изучения рынка выбранной страны и общих вопросов трудовой мобильности.',
    caveat:
      'Широкий межотраслевой ресурс с невысокой точностью для Product Analyst в сильном tech. Право на работу и условия программ зависят от конкретной ситуации.',
  },
  {
    id: 'eu-startups',
    name: 'EU-Startups Jobs',
    url: 'https://www.eu-startups.com/startup-jobs/',
    sourceUrl: 'https://www.eu-startups.com/startup-jobs/advanced-search/',
    categories: ['jobs', 'research'],
    score: 2.5,
    reach: 'Европейская стартап-экосистема',
    description:
      'Доска вакансий при издании о европейских стартапах; дополнительный путь к новым работодателям.',
    fit: 'Используй для пополнения списка компаний, затем изучай их продукт, data-команду и карьерную страницу.',
    caveat:
      'Это дополнительный, а не основной канал под твой профиль: зрелость аналитики и наличие подходящих ролей придётся проверять отдельно.',
  },
  {
    id: 'quora',
    name: 'Quora',
    url: 'https://www.quora.com/',
    sourceUrl: 'https://help.quora.com/hc/en-us/articles/115004145066-What-is-Quora',
    categories: ['research'],
    score: 1.5,
    reach: 'Общие вопросы и ответы · международный',
    description:
      'Площадка вопросов и ответов, где встречаются рассказы о компаниях, карьере и интервью.',
    fit: 'Можно использовать для отдельных вопросов о профессии и опыта конкретного автора, когда более прямых источников нет.',
    caveat:
      'Низкий приоритет для поиска актуальных европейских вакансий. Ответы могут быть старыми, рекламными или неприменимыми к твоей роли.',
  },
];
