/**
 * Validation défensive des données externes. Les entrées invalides sont
 * écartées (et comptées) plutôt que complétées par des valeurs inventées.
 */
import type { Delivery, LatLng, Mission, Vehicle, VehiclePosition } from '../../domain/types';
import { toDeliveryStatus, toMissionStatus, toVehicleStatus } from '../../domain/status';
import { parseDate } from '../../domain/time';

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const nonNegative = (v: unknown): number | undefined => {
  const n = num(v);
  return n !== undefined && n >= 0 ? n : undefined;
};

export function parseLatLng(v: unknown): LatLng | undefined {
  if (!isObj(v)) return undefined;
  const lat = num(v.lat);
  const lng = num(v.lng);
  if (lat === undefined || lng === undefined) return undefined;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) return undefined;
  return { lat, lng };
}

function parsePosition(v: unknown): VehiclePosition | null {
  if (!isObj(v)) return null;
  const ll = parseLatLng(v);
  const recordedAt = parseDate(v.recordedAt);
  // Sans horodatage, une position ne peut pas être présentée honnêtement.
  if (!ll || !recordedAt) return null;
  return { ...ll, recordedAt, placeLabel: str(v.placeLabel) };
}

export interface Parsed<T> {
  items: T[];
  rejected: number;
}

function parseList<T>(raw: unknown, parseOne: (v: Obj) => T | undefined): Parsed<T> {
  const list = Array.isArray(raw) ? raw : [];
  const items: T[] = [];
  let rejected = 0;
  for (const entry of list) {
    const parsed = isObj(entry) ? parseOne(entry) : undefined;
    if (parsed) items.push(parsed);
    else rejected += 1;
  }
  return { items, rejected };
}

export function parseVehicles(raw: unknown): Parsed<Vehicle> {
  return parseList(raw, (v) => {
    const id = str(v.id);
    const registration = str(v.registration) ?? id;
    if (!id || !registration) return undefined;
    return {
      id,
      registration,
      label: str(v.label),
      status: toVehicleStatus(v.status),
      position: parsePosition(v.position),
      driverName: str(v.driverName),
      distanceTodayKm: nonNegative(v.distanceTodayKm),
    };
  });
}

function parseDelivery(v: Obj, missionId: string): Delivery | undefined {
  const id = str(v.id);
  const reference = str(v.reference) ?? id;
  if (!id || !reference) return undefined;
  return {
    id,
    reference,
    kind: v.kind === 'pickup' || v.kind === 'delivery' ? v.kind : undefined,
    emptyRun: v.emptyRun === true ? true : undefined,
    emptyRunReason: v.emptyRun === true ? str(v.emptyRunReason) : undefined,
    orderReference: str(v.orderReference),
    missionId,
    sequence: num(v.sequence),
    customerName: str(v.customerName) ?? 'Client non renseigné',
    siteName: str(v.siteName),
    location: parseLatLng(v.location),
    status: toDeliveryStatus(v.status),
    plannedWindowStart: parseDate(v.plannedWindowStart),
    plannedWindowEnd: parseDate(v.plannedWindowEnd),
    estimatedArrival: parseDate(v.estimatedArrival),
    actualArrival: parseDate(v.actualArrival),
    actualCompletion: parseDate(v.actualCompletion),
  };
}

export function parseMissions(raw: unknown): Parsed<Mission> {
  return parseList(raw, (v) => {
    const id = str(v.id);
    const reference = str(v.reference) ?? id;
    if (!id || !reference) return undefined;
    const deliveries = parseList(v.deliveries, (d) => parseDelivery(d, id)).items;
    return {
      id,
      reference,
      label: str(v.label),
      vehicleId: str(v.vehicleId),
      status: toMissionStatus(v.status),
      plannedStart: parseDate(v.plannedStart),
      plannedEnd: parseDate(v.plannedEnd),
      actualStart: parseDate(v.actualStart),
      actualEnd: parseDate(v.actualEnd),
      plannedDistanceKm: nonNegative(v.plannedDistanceKm),
      actualDistanceKm: nonNegative(v.actualDistanceKm),
      deliveries,
    };
  });
}

/** Distances parcourues par mission, calculées côté passerelle à partir de Webfleet. */
export function parseMissionDistances(raw: unknown): Map<string, number> {
  const out = new Map<string, number>();
  for (const { missionId, km } of parseList(raw, (v) => {
    const missionId = str(v.missionId);
    const km = nonNegative(v.actualDistanceKm);
    return missionId && km !== undefined ? { missionId, km } : undefined;
  }).items) {
    out.set(missionId, km);
  }
  return out;
}
