/**
 * Construit la timeline d'une mission à partir des horodatages réellement
 * présents. Aucun horodatage n'est extrapolé : un événement sans heure prévue
 * ni réelle est conservé et signalé comme « horodatage manquant ».
 */
import type { Mission, OpsEvent } from './types';
import { deliveryLateness } from './rules';

export function buildMissionTimeline(mission: Mission, now: Date): OpsEvent[] {
  const events: OpsEvent[] = [];
  const finished = mission.status === 'completed' || mission.status === 'cancelled';

  events.push({
    id: `${mission.id}:start`,
    type: 'departure',
    label: 'Départ',
    missionId: mission.id,
    plannedAt: mission.plannedStart,
    actualAt: mission.actualStart,
    // Une tournée en cours ou terminée est forcément partie : sans heure réelle, l'horodatage manque.
    pending: !mission.actualStart && mission.status === 'planned',
    uncertain: !mission.actualStart && mission.status === 'unknown',
  });

  const deliveries = [...mission.deliveries].sort(
    (a, b) => (a.sequence ?? Infinity) - (b.sequence ?? Infinity),
  );

  for (const d of deliveries) {
    const where = d.siteName ?? d.customerName;
    const act = d.kind === 'pickup' ? 'Collecte' : 'Livraison';
    const lateness = deliveryLateness(d, now);

    events.push({
      id: `${d.id}:arrival`,
      type: 'arrival',
      label: `Arrivée sur site — ${where}`,
      missionId: mission.id,
      deliveryId: d.id,
      plannedAt: d.plannedWindowStart,
      actualAt: d.actualArrival,
      pending: !d.actualArrival && (d.status === 'planned' || d.status === 'in_progress'),
      uncertain: !d.actualArrival && d.status === 'unknown',
    });

    if (lateness.kind === 'late') {
      const forecast = lateness.basis === 'eta';
      events.push({
        id: `${d.id}:delay`,
        type: 'delay',
        label: forecast
          ? `Retard prévu (ETA de la source) — ${where}`
          : `Début du retard — ${where}`,
        missionId: mission.id,
        deliveryId: d.id,
        // Le retard démarre à la fin du créneau prévu (voir RULE_DESCRIPTIONS.late).
        plannedAt: forecast ? lateness.since : undefined,
        actualAt: forecast ? undefined : lateness.since,
        pending: forecast,
      });
    }

    events.push({
      id: `${d.id}:done`,
      type: 'delivery',
      label:
        d.status === 'failed'
          ? `${act} non réalisée — ${where}`
          : d.emptyRun
            ? `${act} — passage à vide${d.emptyRunReason ? ` (${d.emptyRunReason})` : ''} — ${where}`
            : `${act} — ${where}`,
      missionId: mission.id,
      deliveryId: d.id,
      plannedAt: d.plannedWindowEnd,
      actualAt: d.actualCompletion,
      pending: d.status === 'planned' || d.status === 'in_progress',
      uncertain: !d.actualCompletion && d.status === 'unknown',
    });
  }

  events.push({
    id: `${mission.id}:end`,
    type: 'mission_end',
    label: 'Fin de mission',
    missionId: mission.id,
    plannedAt: mission.plannedEnd,
    actualAt: mission.actualEnd,
    pending: !mission.actualEnd && !finished,
  });

  return events;
}

/** Nombre d'événements réalisés sans horodatage réel. */
export function countMissingTimestamps(events: OpsEvent[]): number {
  return events.filter((e) => !e.pending && !e.uncertain && !e.actualAt).length;
}
