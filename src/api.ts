export async function api<T = any>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch(`/api${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Не удалось выполнить запрос');
  return body;
}
export function split(value: FormDataEntryValue | null): string[] {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
export function date(value: string) {
  return value && Number.isFinite(Date.parse(value))
    ? new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(new Date(value))
    : '—';
}
