/** Local-time YYYY-MM-DD (avoids the UTC shift of toISOString). */
export function toIsoDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** The Sunday that ends the Mon–Sun week containing the given date. */
export function weekEndingFor(d: Date): string {
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  end.setDate(end.getDate() + ((7 - end.getDay()) % 7));
  return toIsoDate(end);
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}
