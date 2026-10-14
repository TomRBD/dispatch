/** Dérivations utilisées par l'interface (sans état, testables). */
import type { Delivery, DispatchSnapshot, Lateness, Mission, Vehicle } from './types';
import { deliveryLateness, isLate, missionLateness, positionFreshness, type PositionFreshness } from './rules';

export interface VehicleView {
  vehicle: Vehicle;
  /** Mission en cours, sinon prochaine mission planifiée, sinon dernière terminée. */
  mission?: Mission;
  missionRole?: 'current' | 'next' | 'last';
  missions: Mission[];
  lateness: Lateness;
  freshness: PositionFreshness;
  nextDelivery?: Delivery;
  progress?: { done: number; total: number };
  needsAction: boolean;
}

const time = (d?: Date) => d?.getTime() ?? Infinity;

export function pickMission(missions: Mission[]): Pick<VehicleView, 'mission' | 'missionRole'> {
  const current = missions.find((m) => m.status === 'in_progress');
  if (current) return { mission: current, missionRole: 'current' };
  const next = missions
    .filter((m) => m.status === 'planned')
    .sort((a, b) => time(a.plannedStart) - time(b.plannedStart))[0];
  if (next) return { mission: next, missionRole: 'next' };
  const last = missions
    .filter((m) => m.status === 'completed')
    .sort((a, b) => time(b.actualEnd ?? b.plannedEnd) - time(a.actualEnd ?? a.plannedEnd))[0];
  return last ? { mission: last, missionRole: 'last' } : {};
}

const FINAL: Delivery['status'][] = ['delivered', 'failed', 'cancelled'];

export function missionProgress(m: Mission): { done: number; total: number } {
  const relevant = m.deliveries.filter((d) => d.status !== 'cancelled');
  return {
    done: relevant.filter((d) => FINAL.includes(d.status)).length,
    total: relevant.length,
  };
}

export function nextDelivery(m: Mission): Delivery | undefined {
  return [...m.deliveries]
    .sort((a, b) => (a.sequence ?? Infinity) - (b.sequence ?? Infinity))
    .find((d) => d.status === 'planned' || d.status === 'in_progress');
}

export function buildVehicleViews(s: DispatchSnapshot, now: Date): VehicleView[] {
  return s.vehicles.map((vehicle) => {
    const missions = s.missions.filter((m) => m.vehicleId === vehicle.id);
    const { mission, missionRole } = pickMission(missions);
    const lateness =
      mission && missionRole !== 'last' ? missionLateness(mission, now) : { kind: 'not_applicable' as const };
    const freshness = positionFreshness(vehicle.position, now);
    const active = missionRole === 'current';
    return {
      vehicle,
      mission,
      missionRole,
      missions,
      lateness,
      freshness,
      nextDelivery: mission && missionRole !== 'last' ? nextDelivery(mission) : undefined,
      progress: mission ? missionProgress(mission) : undefined,
      // Action requise : retard, ou mission en cours sans position récente.
      needsAction: isLate(lateness) || (active && freshness !== 'fresh'),
    };
  });
}

export interface DayKpis {
  vehiclesTotal: number;
  vehiclesDriving: number;
  vehiclesWithMission: number;
  missions: { total: number; planned: number; inProgress: number; completed: number; unassigned: number };
  deliveries: { total: number; delivered: number; inProgress: number; planned: number; failed: number; late: number; lateUnknown: number };
  lateMissions: number;
  positionsStale: number;
  positionsUnavailable: number;
}

export function computeKpis(s: DispatchSnapshot, views: VehicleView[], now: Date): DayKpis {
  const deliveries = s.missions.flatMap((m) => m.deliveries);
  const lates = deliveries.map((d) => deliveryLateness(d, now));
  return {
    vehiclesTotal: s.vehicles.length,
    vehiclesDriving: s.vehicles.filter((v) => v.status === 'driving').length,
    vehiclesWithMission: views.filter((v) => v.missionRole === 'current').length,
    missions: {
      total: s.missions.length,
      planned: s.missions.filter((m) => m.status === 'planned').length,
      inProgress: s.missions.filter((m) => m.status === 'in_progress').length,
      completed: s.missions.filter((m) => m.status === 'completed').length,
      unassigned: s.missions.filter((m) => !m.vehicleId && m.status !== 'cancelled').length,
    },
    deliveries: {
      total: deliveries.filter((d) => d.status !== 'cancelled').length,
      delivered: deliveries.filter((d) => d.status === 'delivered').length,
      inProgress: deliveries.filter((d) => d.status === 'in_progress').length,
      planned: deliveries.filter((d) => d.status === 'planned').length,
      failed: deliveries.filter((d) => d.status === 'failed').length,
      // Retards encore actionnables : livraisons non terminées.
      late: deliveries.filter((d, i) => isLate(lates[i]!) && !FINAL.includes(d.status)).length,
      lateUnknown: lates.filter((l) => l.kind === 'unknown').length,
    },
    lateMissions: s.missions.filter(
      (m) => m.status !== 'completed' && isLate(missionLateness(m, now)),
    ).length,
    positionsStale: views.filter((v) => v.freshness === 'stale').length,
    positionsUnavailable: views.filter((v) => v.freshness === 'unavailable').length,
  };
}
