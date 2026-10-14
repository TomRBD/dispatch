/** Conversions et formats de dates, centralisés (fuseau de l'exploitation). */

export const OPS_TIME_ZONE = 'Europe/Paris';

const timeFmt = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: OPS_TIME_ZONE,
});

const dayFmt = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: OPS_TIME_ZONE,
});

const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: OPS_TIME_ZONE,
});

export function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 60_000);
}

/** « 14:05 », ou date + heure si le jour diffère de `reference`. */
export function formatTime(d: Date, reference: Date = new Date()): string {
  return sameOpsDay(d, reference) ? timeFmt.format(d) : dateTimeFmt.format(d);
}

export function formatDay(d: Date): string {
  const s = dayFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function sameOpsDay(a: Date, b: Date): boolean {
  const f = new Intl.DateTimeFormat('fr-CA', { timeZone: OPS_TIME_ZONE });
  return f.format(a) === f.format(b);
}

/** Durée lisible : « 45 min », « 1 h 20 ». */
export function formatDuration(minutes: number): string {
  const m = Math.abs(Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${String(rest).padStart(2, '0')}`;
}

/** « à l'instant », « il y a 12 min », « il y a 2 h 05 ». */
export function formatAge(from: Date, now: Date): string {
  const m = minutesBetween(from, now);
  if (m < 1) return "à l'instant";
  return `il y a ${formatDuration(m)}`;
}

/** Convertit une valeur externe en Date valide, ou undefined. */
export function parseDate(value: unknown): Date | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
