/**
 * Règles métier explicites d'Agrivalor Dispatch.
 *
 * Toutes les règles qui transforment des données brutes en constat (retard,
 * position ancienne, écart de distance) sont centralisées ici. Les seuils
 * sont des valeurs de départ à faire valider par l'exploitation.
 */
import type {
  Delivery,
  DistanceComparison,
  Lateness,
  Mission,
  VehiclePosition,
} from './types';
import { minutesBetween } from './time';

export const RULES = {
  /** Tolérance après la fin du créneau prévu avant de déclarer un retard. */
  lateToleranceMin: 15,
  /** Âge au-delà duquel une position est signalée comme ancienne. */
  stalePositionMin: 15,
  /** Écart relatif de distance au-delà duquel l'écart est signalé. */
  distanceAnomalyRatio: 0.2,
} as const;

export const RULE_DESCRIPTIONS = {
  late: `Une tournée est en retard lorsqu'elle dépasse son heure de fin prévue (début prévu + durée prévue) de plus de ${RULES.lateToleranceMin} min : encore en cours après cette heure, ou terminée plus tard (fin réelle = fin de tournée, à défaut fin du dernier arrêt réalisé). Un arrêt est en retard lorsque son arrivée dépasse la fin de son créneau de plus de ${RULES.lateToleranceMin} min. Sans heure de fin prévue ni créneau, le retard est indéterminé.`,
  stale: `Une position est considérée comme ancienne au-delà de ${RULES.stalePositionMin} min sans nouvelle mesure.`,
  distance: `L'écart compare la distance parcourue (télématique) à la distance prévue (planning) pour les missions où les deux valeurs existent. Un écart supérieur à ${Math.round(RULES.distanceAnomalyRatio * 100)} % est signalé. Pour une mission en cours, la distance parcourue est partielle et l'écart n'est pas calculé.`,
} as const;

/**
 * Évalue le retard d'une livraison selon la règle `RULE_DESCRIPTIONS.late`.
 * N'invente aucune heure : sans fin de créneau, le retard est « inconnu ».
 */
export function deliveryLateness(delivery: Delivery, now: Date): Lateness {
  if (delivery.status === 'cancelled') return { kind: 'not_applicable' };

  const deadline = delivery.plannedWindowEnd;
  if (!deadline) return { kind: 'unknown', reason: 'Fin de créneau non renseignée' };

  const threshold = RULES.lateToleranceMin;
  const reference = delivery.actualArrival ?? delivery.actualCompletion;

  if (reference) {
    const minutes = minutesBetween(deadline, reference);
    return minutes > threshold
      ? { kind: 'late', minutes, since: deadline, basis: 'actual' }
      : { kind: 'on_time' };
  }

  if (delivery.status === 'unknown') {
    // Sans statut ni heure réelle, impossible de savoir si la livraison a eu lieu.
    return { kind: 'unknown', reason: 'Statut de livraison non fourni par la source' };
  }

  if (delivery.status === 'delivered' || delivery.status === 'failed') {
    // Statut final sans horodatage : impossible de conclure.
    return { kind: 'unknown', reason: 'Heure réelle non renseignée' };
  }

  const elapsed = minutesBetween(deadline, now);
  if (elapsed > threshold) {
    return { kind: 'late', minutes: elapsed, since: deadline, basis: 'elapsed' };
  }

  if (delivery.estimatedArrival) {
    const minutes = minutesBetween(deadline, delivery.estimatedArrival);
    if (minutes > threshold) {
      return { kind: 'late', minutes, since: deadline, basis: 'eta' };
    }
  }

  return { kind: 'on_time' };
}

/**
 * Retard d'une mission = retard le plus important parmi ses livraisons.
 * Si aucune livraison n'est évaluable, le retard est inconnu.
 */
/** Fin réelle de tournée : heure de fin fournie, sinon fin du dernier arrêt réalisé. */
export function missionActualEnd(mission: Mission): Date | undefined {
  if (mission.actualEnd) return mission.actualEnd;
  const ends = mission.deliveries.map((d) => d.actualCompletion?.getTime()).filter((t): t is number => t !== undefined);
  return ends.length ? new Date(Math.max(...ends)) : undefined;
}

/** Règle tournée : dépassement de l'heure de fin prévue (voir RULE_DESCRIPTIONS.late). */
export function tourOverrun(mission: Mission, now: Date): Lateness {
  const deadline = mission.plannedEnd;
  if (!deadline || mission.status === 'cancelled') return { kind: 'not_applicable' };
  const threshold = RULES.lateToleranceMin;
  if (mission.status === 'completed') {
    const end = missionActualEnd(mission);
    if (!end) return { kind: 'unknown', reason: 'Heure de fin réelle non disponible' };
    const minutes = minutesBetween(deadline, end);
    return minutes > threshold ? { kind: 'late', minutes, since: deadline, basis: 'actual' } : { kind: 'on_time' };
  }
  if (mission.status === 'in_progress' || mission.status === 'planned') {
    const minutes = minutesBetween(deadline, now);
    return minutes > threshold ? { kind: 'late', minutes, since: deadline, basis: 'elapsed' } : { kind: 'on_time' };
  }
  return { kind: 'unknown', reason: 'Statut de tournée inconnu' };
}

export function missionLateness(mission: Mission, now: Date): Lateness {
  if (mission.status === 'cancelled') return { kind: 'not_applicable' };
  const tour = tourOverrun(mission, now);
  const results = [...mission.deliveries.map((d) => deliveryLateness(d, now)), tour];
  const late = results.filter((r): r is Extract<Lateness, { kind: 'late' }> => r.kind === 'late');
  if (late.length > 0) {
    return late.reduce((worst, r) => (r.minutes > worst.minutes ? r : worst));
  }
  if (results.some((r) => r.kind === 'on_time')) return { kind: 'on_time' };
  return { kind: 'unknown', reason: 'Ni heure de fin prévue ni créneau' };
}

export function isLate(l: Lateness): l is Extract<Lateness, { kind: 'late' }> {
  return l.kind === 'late';
}

export type PositionFreshness = 'fresh' | 'stale' | 'unavailable';

export function positionFreshness(
  position: VehiclePosition | null,
  now: Date,
): PositionFreshness {
  if (!position) return 'unavailable';
  return minutesBetween(position.recordedAt, now) > RULES.stalePositionMin ? 'stale' : 'fresh';
}

/** Comparaison prévu / parcouru pour une mission. */
export function compareMissionDistance(mission: Mission): DistanceComparison {
  const { plannedDistanceKm: plannedKm, actualDistanceKm: actualKm } = mission;
  const partial = mission.status === 'in_progress';
  const base = { plannedKm, actualKm, anomaly: false, partial };

  if (plannedKm === undefined && actualKm === undefined) {
    return { ...base, notComparableReason: 'Distances non disponibles' };
  }
  if (plannedKm === undefined) return { ...base, notComparableReason: 'Distance prévue non disponible' };
  if (actualKm === undefined) return { ...base, notComparableReason: 'Distance parcourue non disponible' };
  if (partial) return { ...base, notComparableReason: 'Mission en cours : distance partielle' };
  if (mission.status !== 'completed') {
    return { ...base, notComparableReason: 'Mission non terminée' };
  }
  if (plannedKm <= 0) return { ...base, notComparableReason: 'Distance prévue nulle ou invalide' };

  const deltaKm = actualKm - plannedKm;
  const deltaRatio = deltaKm / plannedKm;
  return {
    ...base,
    deltaKm,
    deltaRatio,
    anomaly: Math.abs(deltaRatio) > RULES.distanceAnomalyRatio,
  };
}

/** Agrège plusieurs missions : seules les missions comparables sont sommées. */
export function aggregateDistance(missions: Mission[]): {
  comparable: number;
  total: number;
  plannedKm: number;
  actualKm: number;
  deltaRatio?: number;
} {
  let plannedKm = 0;
  let actualKm = 0;
  let comparable = 0;
  for (const m of missions) {
    const c = compareMissionDistance(m);
    if (c.deltaKm === undefined || c.plannedKm === undefined || c.actualKm === undefined) continue;
    comparable += 1;
    plannedKm += c.plannedKm;
    actualKm += c.actualKm;
  }
  return {
    comparable,
    total: missions.length,
    plannedKm,
    actualKm,
    deltaRatio: comparable > 0 && plannedKm > 0 ? (actualKm - plannedKm) / plannedKm : undefined,
  };
}
