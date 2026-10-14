/**
 * Conversion des lignes OData Tournee_Excel / Mission_Excel vers le contrat
 * JSON attendu par l'application (voir README). Fonctions pures, testées.
 */
import type { BcMapping, TimeField } from './mapping';

type Row = Record<string, unknown>;

const OPS_TZ = 'Europe/Paris';

const text = (row: Row, field: string | null): string | undefined => {
  if (!field) return undefined;
  const v = row[field];
  if (typeof v === 'number') return String(v);
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
};

const number = (row: Row, field: string | null): number | undefined => {
  if (!field) return undefined;
  const v = row[field];
  const n =
    typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

/** Décalage (ms) du fuseau de Paris à un instant donné. */
function parisOffsetMs(utc: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: OPS_TZ,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(utc);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - utc.getTime();
}

/** « 2026-10-14 » + « 08:30:00 » (heure de Paris) → ISO UTC. */
export function parisLocalToIso(date: string, time: string): string | undefined {
  const d = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  const t = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(time);
  if (!d || !t) return undefined;
  const naive = Date.UTC(+d[1]!, +d[2]! - 1, +d[3]!, +t[1]!, +t[2]!, +(t[3] ?? 0));
  // Deux passes pour gérer correctement les changements d'heure.
  let ts = naive - parisOffsetMs(new Date(naive));
  ts = naive - parisOffsetMs(new Date(ts));
  return new Date(ts).toISOString();
}

/** BC renvoie 0001-01-01 / 00:00:00 pour une date ou une heure vide. */
const isBlankDate = (s: string) => s.startsWith('0001-01-01');

export function readTime(row: Row, field: TimeField): string | undefined {
  if (!field) return undefined;
  if (typeof field === 'string') {
    const v = text(row, field);
    if (!v || isBlankDate(v)) return undefined;
    // DateTime BC (UTC, avec ou sans « Z »).
    const d = new Date(/[zZ]|[+-]\d{2}:\d{2}$/.test(v) ? v : `${v}Z`);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const date = text(row, field.date);
  const time = text(row, field.time);
  if (!date || !time || isBlankDate(date)) return undefined;
  // Une heure 00:00:00 en BC signifie généralement « non renseignée ».
  if (/^00:00(:00(\.0+)?)?$/.test(time)) return undefined;
  return parisLocalToIso(date, time);
}

/** Durée ISO 8601 de BC (« P0DT1H30M0.0S ») → minutes. */
export function parseIsoDurationMin(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?)?$/.exec(value);
  if (!m) return undefined;
  const [, d = '0', h = '0', min = '0', sec = '0'] = m;
  return Number(d) * 1440 + Number(h) * 60 + Number(min) + Math.round(Number(sec) / 60);
}

/** Fin prévue = début + durée prévue (durée nulle = non renseignée). */
function plannedEndFrom(start: string | undefined, durationMin: number | undefined): string | undefined {
  if (!start || !durationMin) return undefined;
  return new Date(new Date(start).getTime() + durationMin * 60_000).toISOString();
}

/** Distance parcourue = compteur fin − compteur début, si les deux sont cohérents. */
function mileageDistance(start: number | undefined, end: number | undefined): number | undefined {
  if (start === undefined || end === undefined || start <= 0 || end <= 0 || end < start) return undefined;
  return end - start;
}

export interface ContractDelivery {
  id: string;
  reference: string;
  orderReference?: string;
  sequence?: number;
  customerName?: string;
  siteName?: string;
  location?: { lat: number; lng: number };
  status: string;
  plannedWindowStart?: string;
  plannedWindowEnd?: string;
  estimatedArrival?: string;
  actualArrival?: string;
  actualCompletion?: string;
}

export interface ContractMission {
  id: string;
  reference: string;
  label?: string;
  vehicleId?: string;
  status: string;
  plannedStart?: string;
  plannedEnd?: string;
  actualStart?: string;
  actualEnd?: string;
  plannedDistanceKm?: number;
  actualDistanceKm?: number;
  deliveries: ContractDelivery[];
}

export interface TransformResult {
  missions: ContractMission[];
  /** Lignes ignorées (identifiant absent, mission sans tournée du jour). */
  skipped: { tournees: number; missions: number };
}

export function transformBc(tournees: Row[], missions: Row[], m: BcMapping): TransformResult {
  const skipped = { tournees: 0, missions: 0 };
  const byId = new Map<string, ContractMission>();

  for (const row of tournees) {
    const id = text(row, m.tournee.id);
    if (!id) {
      skipped.tournees += 1;
      continue;
    }
    const rawStatus = text(row, m.tournee.status);
    const plannedStart = readTime(row, m.tournee.plannedStart);
    byId.set(id, {
      id,
      reference: text(row, m.tournee.reference) ?? id,
      label: text(row, m.tournee.label),
      vehicleId: text(row, m.tournee.vehicle),
      status: (rawStatus && m.tourneeStatus[rawStatus]) || 'unknown',
      plannedStart,
      plannedEnd:
        readTime(row, m.tournee.plannedEnd) ??
        plannedEndFrom(plannedStart, parseIsoDurationMin(text(row, m.tournee.plannedDuration))),
      actualStart: readTime(row, m.tournee.actualStart),
      actualEnd: readTime(row, m.tournee.actualEnd),
      plannedDistanceKm: number(row, m.tournee.plannedDistanceKm),
      actualDistanceKm:
        number(row, m.tournee.actualDistanceKm) ??
        mileageDistance(number(row, m.tournee.startMileage), number(row, m.tournee.endMileage)),
      deliveries: [],
    });
  }

  for (const row of missions) {
    const id = text(row, m.mission.id);
    const tourneeId = text(row, m.mission.tourneeId);
    const parent = tourneeId ? byId.get(tourneeId) : undefined;
    if (!id || !parent) {
      skipped.missions += 1;
      continue;
    }
    const lat = number(row, m.mission.latitude);
    const lng = number(row, m.mission.longitude);
    const rawStatus = text(row, m.mission.status);
    parent.deliveries.push({
      id,
      reference: text(row, m.mission.reference) ?? id,
      orderReference: text(row, m.mission.orderReference),
      sequence: number(row, m.mission.sequence),
      customerName: text(row, m.mission.customer),
      siteName: text(row, m.mission.site),
      // BC renvoie 0 pour une coordonnée non saisie.
      location: lat !== undefined && lng !== undefined && !(lat === 0 && lng === 0) ? { lat, lng } : undefined,
      status: (rawStatus && m.missionStatus[rawStatus]) || 'unknown',
      plannedWindowStart: readTime(row, m.mission.windowStart),
      plannedWindowEnd: readTime(row, m.mission.windowEnd),
      estimatedArrival: readTime(row, m.mission.estimatedArrival),
      actualArrival: readTime(row, m.mission.actualArrival),
      actualCompletion: readTime(row, m.mission.actualCompletion),
    });
  }

  return { missions: [...byId.values()], skipped };
}
