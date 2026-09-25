import { useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, LocateFixed, Minus, Plus, X } from 'lucide-react';
import { countries, groupPlaces, project, type AnalyticsRow } from './analytics';

export function JobMap({
  rows,
  selectedCountries,
  onCountry,
  onOpen,
}: {
  rows: AnalyticsRow[];
  selectedCountries: string[];
  onCountry: (code: string) => void;
  onOpen: (id: string) => void;
}) {
  const groups = useMemo(() => groupPlaces(rows, selectedCountries), [rows, selectedCountries]);
  const [selected, setSelected] = useState('');
  const selectedGroup = groups.find((g) => g.place.id === selected);
  const countryCounts = countries
    .map((c) => ({
      ...c,
      count: rows.filter((r) => r.places.some((p) => p.code === c.code)).length,
    }))
    .filter((c) => c.count && (!selectedCountries.length || selectedCountries.includes(c.code)))
    .sort((a, b) => b.count - a.count);
  const [camera, setCamera] = useState({ x: 532, y: 338, width: 220 });
  const [size, setSize] = useState({ width: 800, height: 390 });
  const stage = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; camera: typeof camera } | null>(null);
  const moved = useRef(false);
  useEffect(() => {
    const element = stage.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const unit = camera.width / Math.max(1, size.width),
    height = unit * size.height;
  const zoom = (factor: number) =>
    setCamera((c) => ({ ...c, width: Math.max(18, Math.min(1100, c.width * factor)) }));
  const fit = () => {
    if (!groups.length) return;
    const points = groups.map((g) => project(g.place.point));
    const xs = points.map((p) => p[0]),
      ys = points.map((p) => p[1]);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const width = Math.max(
      35,
      (maxX - minX) * 1.5,
      (((maxY - minY) * size.width) / size.height) * 1.6,
    );
    setCamera({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: Math.min(1100, width) });
  };
  const countryKey = selectedCountries.join('|');
  useEffect(() => {
    if (countryKey) fit();
    else setCamera({ x: 532, y: 338, width: 220 });
  }, [countryKey]);
  // Nearby country/city markers get a leader line instead of hiding each other.
  const markers: { group: (typeof groups)[number]; x: number; y: number; anchor: number[] }[] = [];
  for (const group of groups) {
    const anchor = project(group.place.point);
    let [x, y] = anchor;
    for (
      let attempt = 0;
      attempt < 32 && markers.some((m) => Math.hypot(m.x - x, m.y - y) < 38 * unit);
      attempt++
    ) {
      const angle = attempt * 2.4,
        radius = (25 + attempt * 3) * unit;
      x = anchor[0] + Math.cos(angle) * radius;
      y = anchor[1] + Math.sin(angle) * radius;
    }
    markers.push({ group, x, y, anchor });
  }
  return (
    <section className="analytics-panel geography-panel" aria-label="География вакансий">
      <div className="analytics-panel-head">
        <div>
          <h2>География</h2>
          <p>Число вакансий по локациям</p>
        </div>
        <div className="map-view-buttons">
          <button onClick={() => setCamera({ x: 532, y: 338, width: 220 })}>Европа</button>
          <button onClick={() => setCamera({ x: 500, y: 440, width: 1050 })}>
            <Globe2 size={14} />
            Мир
          </button>
          <button
            onClick={fit}
            disabled={!groups.length}
            title="Показать все локации"
            aria-label="Показать все локации"
          >
            <LocateFixed size={16} />
          </button>
        </div>
      </div>
      <div className="geography-layout">
        <div className="job-map" ref={stage}>
          <svg
            viewBox={`${camera.x - camera.width / 2} ${camera.y - height / 2} ${camera.width} ${height}`}
            aria-label="Карта вакансий. Кнопки плюс и минус меняют масштаб; стрелки перемещают карту."
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              const moves: Record<string, number[]> = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              };
              if (moves[e.key]) {
                e.preventDefault();
                const [dx, dy] = moves[e.key];
                setCamera((c) => ({
                  ...c,
                  x: c.x + dx * c.width * 0.15,
                  y: c.y + dy * c.width * 0.15,
                }));
              } else if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                zoom(1 / 1.5);
              } else if (e.key === '-') {
                e.preventDefault();
                zoom(1.5);
              }
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              moved.current = false;
              if ((e.target as Element).closest('[role="button"]')) return;
              drag.current = { x: e.clientX, y: e.clientY, camera };
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (!drag.current) return;
              const dx = e.clientX - drag.current.x,
                dy = e.clientY - drag.current.y;
              if (Math.hypot(dx, dy) > 4) moved.current = true;
              setCamera({
                ...drag.current.camera,
                x: drag.current.camera.x - dx * unit,
                y: drag.current.camera.y - dy * unit,
              });
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerCancel={() => {
              drag.current = null;
            }}
          >
            <g className="map-land">
              {countries.map((c) => {
                const count = countryCounts.find((k) => k.code === c.code)?.count || 0;
                return (
                  <path
                    key={c.code}
                    d={c.path}
                    className={`${count ? 'has-jobs' : ''} ${selectedCountries.includes(c.code) ? 'is-selected' : ''}`}
                    vectorEffect="non-scaling-stroke"
                    role={count ? 'button' : undefined}
                    tabIndex={count ? 0 : undefined}
                    aria-label={count ? `${c.name}: ${count} вакансий. Фильтр страны` : undefined}
                    onClick={() => {
                      if (count && !moved.current) onCountry(c.code);
                    }}
                    onKeyDown={(e) => {
                      if (count && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        onCountry(c.code);
                      }
                    }}
                  >
                    <title>
                      {c.name}
                      {count ? ` · ${count} вакансий` : ''}
                    </title>
                  </path>
                );
              })}
            </g>
            {markers.map(({ group, x, y, anchor }) => (
              <g
                key={group.place.id}
                className={`map-marker ${group.place.kind} ${selected === group.place.id ? 'selected' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`${group.place.name}${group.place.kind === 'country' ? ' — страна, без города' : ''}: ${group.jobs.length} вакансий`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setSelected(selected === group.place.id ? '' : group.place.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelected(group.place.id);
                  }
                }}
              >
                <title>
                  {group.place.name}
                  {group.place.kind === 'country' ? ' (страна без города)' : ''} ·{' '}
                  {group.jobs.length} вакансий
                </title>
                {(x !== anchor[0] || y !== anchor[1]) && (
                  <line x1={anchor[0]} y1={anchor[1]} x2={x} y2={y} strokeWidth={unit} />
                )}
                <circle cx={x} cy={y} r={21 * unit} className="map-hit" />
                <circle
                  cx={x}
                  cy={y}
                  r={14 * unit}
                  strokeWidth={2 * unit}
                  strokeDasharray={
                    group.place.kind === 'country' ? `${3 * unit} ${2 * unit}` : undefined
                  }
                />
                <text x={x} y={y} fontSize={11 * unit} dy=".35em" textAnchor="middle">
                  {group.jobs.length}
                </text>
                {selected === group.place.id && (
                  <text
                    className="map-marker-label"
                    style={{ strokeWidth: 3 * unit }}
                    x={x}
                    y={y - 24 * unit}
                    textAnchor="middle"
                    fontSize={12 * unit}
                  >
                    {group.place.name}
                  </text>
                )}
              </g>
            ))}
          </svg>
          <div className="map-zoom">
            <button aria-label="Приблизить карту" onClick={() => zoom(1 / 1.5)}>
              <Plus size={17} />
            </button>
            <button aria-label="Отдалить карту" onClick={() => zoom(1.5)}>
              <Minus size={17} />
            </button>
          </div>
          {!groups.length && <div className="map-empty">Нет локаций для этих фильтров</div>}
          <a
            className="map-attribution"
            href="https://www.naturalearthdata.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Natural Earth
          </a>
        </div>
        <div className="geo-countries">
          <span className="analytics-kicker">По странам</span>
          {countryCounts.map((c) => (
            <button
              key={c.code}
              className={selectedCountries.includes(c.code) ? 'selected' : ''}
              aria-pressed={selectedCountries.includes(c.code)}
              onClick={() => onCountry(c.code)}
            >
              <span>{c.name}</span>
              <b>{c.count}</b>
              <i style={{ width: `${(c.count / Math.max(1, rows.length)) * 100}%` }} />
            </button>
          ))}
          {rows.some((r) => !r.places.length) && (
            <button
              aria-pressed={selectedCountries.includes('unknown')}
              onClick={() => onCountry('unknown')}
            >
              <span>География не определена</span>
              <b>{rows.filter((r) => !r.places.length).length}</b>
            </button>
          )}
          {!countryCounts.length && <p>Выберите другую страну или измените фильтры.</p>}
        </div>
      </div>
      <div className="map-legend">
        <span>
          <i />
          Город
        </span>
        <span>
          <i className="country" />
          Страна без города
        </span>
        <span>Точка → вакансии · страна → фильтр · перетаскивание → сдвиг</span>
      </div>
      <p className="analytics-footnote">
        Одна вакансия может быть доступна в нескольких странах. В общих итогах она учитывается один
        раз. Точки показывают локацию, указанную в вакансии, а не адрес офиса. Общие регионы вроде
        Europe не разворачиваются в список стран.
      </p>
      {selectedGroup && (
        <div className="map-selection">
          <div>
            <h3>
              {selectedGroup.place.name}
              {selectedGroup.place.kind === 'country' ? ' · город не указан' : ''}
            </h3>
            <button
              className="icon-button"
              aria-label="Закрыть вакансии локации"
              onClick={() => setSelected('')}
            >
              <X size={16} />
            </button>
          </div>
          {selectedGroup.jobs.map((j) => (
            <button key={j.id} onClick={() => onOpen(j.id)}>
              <strong>{j.company}</strong>
              <span>{j.title}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
