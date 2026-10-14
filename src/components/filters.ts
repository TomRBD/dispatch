import type { VehicleView } from '../domain/selectors';
import { deliveryLateness, isLate, missionLateness } from '../domain/rules';
import type { Mission, MissionStatus, Vehicle, VehicleStatus } from '../domain/types';

export interface Filters {
  query: string;
  vehicleStatuses: VehicleStatus[];
  missionStatuses: MissionStatus[];
  lateOnly: boolean;
  actionOnly: boolean;
}

export const EMPTY_FILTERS: Filters = {
  query: '',
  vehicleStatuses: [],
  missionStatuses: [],
  lateOnly: false,
  actionOnly: false,
};

export const isFiltered = (f: Filters) =>
  f.query.trim() !== '' ||
  f.vehicleStatuses.length > 0 ||
  f.missionStatuses.length > 0 ||
  f.lateOnly ||
  f.actionOnly;

const norm = (s: string) =>
  s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function missionText(m: Mission): string {
  return [
    m.reference,
    m.label,
    ...m.deliveries.flatMap((d) => [d.reference, d.orderReference, d.customerName, d.siteName]),
  ]
    .filter(Boolean)
    .join(' ');
}

function vehicleText(v: Vehicle): string {
  return [v.registration, v.label, v.id].filter(Boolean).join(' ');
}

export function matchesVehicle(view: VehicleView, f: Filters, now: Date): boolean {
  if (f.vehicleStatuses.length && !f.vehicleStatuses.includes(view.vehicle.status)) return false;
  if (f.missionStatuses.length && !view.missions.some((m) => f.missionStatuses.includes(m.status)))
    return false;
  if (f.lateOnly && !view.missions.some((m) => m.status !== 'completed' && isLate(missionLateness(m, now))))
    return false;
  if (f.actionOnly && !view.needsAction) return false;
  const q = norm(f.query.trim());
  if (!q) return true;
  return norm([vehicleText(view.vehicle), ...view.missions.map(missionText)].join(' ')).includes(q);
}

export function matchesMission(
  m: Mission,
  vehicle: Vehicle | undefined,
  f: Filters,
  now: Date,
  vehicleNeedsAction: boolean,
): boolean {
  if (f.missionStatuses.length && !f.missionStatuses.includes(m.status)) return false;
  if (f.vehicleStatuses.length && (!vehicle || !f.vehicleStatuses.includes(vehicle.status))) return false;
  if (f.lateOnly && !(m.status !== 'completed' && isLate(missionLateness(m, now)))) {
    // Les missions terminées avec retard restent visibles via la recherche, pas via ce filtre.
    return false;
  }
  if (f.actionOnly && !(vehicleNeedsAction || (!m.vehicleId && m.status === 'planned'))) return false;
  const q = norm(f.query.trim());
  if (!q) return true;
  return norm([missionText(m), vehicle ? vehicleText(vehicle) : ''].join(' ')).includes(q);
}

/** Nombre de livraisons en retard d'une mission (pour les listes). */
export const lateDeliveryCount = (m: Mission, now: Date) =>
  m.deliveries.filter((d) => isLate(deliveryLateness(d, now))).length;
