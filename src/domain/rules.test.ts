import { describe, expect, it } from 'vitest';
import type { Delivery, Mission } from './types';
import {
  tourOverrun,
  RULES,
  aggregateDistance,
  compareMissionDistance,
  deliveryLateness,
  missionLateness,
  positionFreshness,
} from './rules';
import { buildMissionTimeline, countMissingTimestamps } from './timeline';

const now = new Date('2026-10-14T12:00:00Z');
const at = (min: number) => new Date(now.getTime() + min * 60_000);

const delivery = (patch: Partial<Delivery> = {}): Delivery => ({
  id: 'd1',
  reference: 'BL-1',
  missionId: 'm1',
  customerName: 'Client',
  status: 'planned',
  ...patch,
});

const mission = (patch: Partial<Mission> = {}): Mission => ({
  id: 'm1',
  reference: 'TR-1',
  status: 'completed',
  deliveries: [],
  ...patch,
});

describe('deliveryLateness', () => {
  it('is unknown without a planned window end', () => {
    expect(deliveryLateness(delivery(), now)).toEqual({ kind: 'unknown', reason: 'Fin de créneau non renseignée' });
  });

  it('is on time within the tolerance', () => {
    const d = delivery({ plannedWindowEnd: at(-RULES.lateToleranceMin) });
    expect(deliveryLateness(d, now).kind).toBe('on_time');
  });

  it('is late once the tolerance is exceeded without delivery, since the window end', () => {
    const d = delivery({ plannedWindowEnd: at(-40) });
    expect(deliveryLateness(d, now)).toEqual({ kind: 'late', minutes: 40, since: at(-40), basis: 'elapsed' });
  });

  it('uses the actual arrival when present', () => {
    const d = delivery({ status: 'delivered', plannedWindowEnd: at(-60), actualArrival: at(-30) });
    expect(deliveryLateness(d, now)).toMatchObject({ kind: 'late', minutes: 30, basis: 'actual' });
    const ok = delivery({ status: 'delivered', plannedWindowEnd: at(-60), actualArrival: at(-70) });
    expect(deliveryLateness(ok, now).kind).toBe('on_time');
  });

  it('forecasts a delay only from a source-provided ETA', () => {
    const d = delivery({ plannedWindowEnd: at(10), estimatedArrival: at(40) });
    expect(deliveryLateness(d, now)).toMatchObject({ kind: 'late', minutes: 30, basis: 'eta' });
    expect(deliveryLateness(delivery({ plannedWindowEnd: at(10) }), now).kind).toBe('on_time');
  });

  it('does not conclude for a final status without timestamp', () => {
    const d = delivery({ status: 'delivered', plannedWindowEnd: at(-60) });
    expect(deliveryLateness(d, now).kind).toBe('unknown');
  });

  it('does not assume a delay when the delivery status is unknown', () => {
    const d = delivery({ status: 'unknown', plannedWindowEnd: at(-120) });
    expect(deliveryLateness(d, now).kind).toBe('unknown');
    const withActual = delivery({ status: 'unknown', plannedWindowEnd: at(-120), actualArrival: at(-60) });
    expect(deliveryLateness(withActual, now).kind).toBe('late');
  });

  it('ignores cancelled deliveries', () => {
    expect(deliveryLateness(delivery({ status: 'cancelled', plannedWindowEnd: at(-90) }), now).kind).toBe(
      'not_applicable',
    );
  });
});

describe('missionLateness', () => {
  it('returns the worst delivery delay', () => {
    const m = mission({
      status: 'in_progress',
      deliveries: [
        delivery({ id: 'a', plannedWindowEnd: at(-20) }),
        delivery({ id: 'b', plannedWindowEnd: at(-50) }),
      ],
    });
    expect(missionLateness(m, now)).toMatchObject({ kind: 'late', minutes: 50 });
  });

  it('is unknown when no delivery can be evaluated', () => {
    expect(missionLateness(mission({ deliveries: [delivery()] }), now).kind).toBe('unknown');
  });
});

describe('positionFreshness', () => {
  it('classifies positions', () => {
    expect(positionFreshness(null, now)).toBe('unavailable');
    expect(positionFreshness({ lat: 48, lng: 7, recordedAt: at(-5) }, now)).toBe('fresh');
    expect(positionFreshness({ lat: 48, lng: 7, recordedAt: at(-RULES.stalePositionMin - 1) }, now)).toBe('stale');
  });
});

describe('distance comparison', () => {
  it('computes delta only for completed missions with both distances', () => {
    const c = compareMissionDistance(mission({ plannedDistanceKm: 100, actualDistanceKm: 130 }));
    expect(c.deltaKm).toBe(30);
    expect(c.deltaRatio).toBeCloseTo(0.3);
    expect(c.anomaly).toBe(true);
  });

  it('does not compute for missing or partial data', () => {
    expect(compareMissionDistance(mission({ plannedDistanceKm: 100 })).deltaKm).toBeUndefined();
    expect(compareMissionDistance(mission({ actualDistanceKm: 100 })).notComparableReason).toMatch(/prévue/);
    const partial = compareMissionDistance(
      mission({ status: 'in_progress', plannedDistanceKm: 100, actualDistanceKm: 40 }),
    );
    expect(partial.deltaKm).toBeUndefined();
    expect(partial.partial).toBe(true);
  });

  it('aggregates comparable missions only', () => {
    const agg = aggregateDistance([
      mission({ id: 'a', plannedDistanceKm: 100, actualDistanceKm: 110 }),
      mission({ id: 'b', plannedDistanceKm: 50 }),
      mission({ id: 'c', status: 'in_progress', plannedDistanceKm: 80, actualDistanceKm: 20 }),
    ]);
    expect(agg).toMatchObject({ comparable: 1, total: 3, plannedKm: 100, actualKm: 110 });
    expect(agg.deltaRatio).toBeCloseTo(0.1);
  });
});

describe('timeline', () => {
  it('flags performed events without actual timestamps', () => {
    const m = mission({
      actualStart: at(-120),
      actualEnd: at(-10),
      deliveries: [delivery({ status: 'delivered', actualCompletion: at(-30) })],
    });
    const events = buildMissionTimeline(m, now);
    expect(events.map((e) => e.type)).toEqual(['departure', 'arrival', 'delivery', 'mission_end']);
    // Arrivée sur site réalisée mais non horodatée.
    expect(countMissingTimestamps(events)).toBe(1);
  });

  it('adds a delay event starting at the window end', () => {
    const m = mission({ status: 'in_progress', deliveries: [delivery({ plannedWindowEnd: at(-45) })] });
    const delay = buildMissionTimeline(m, now).find((e) => e.type === 'delay');
    expect(delay?.actualAt).toEqual(at(-45));
  });
});

describe('tourOverrun (fin prévue dépassée)', () => {
  it('flags a running tour past its planned end, since the planned end', () => {
    const m = mission({ status: 'in_progress', plannedEnd: at(-40) });
    expect(tourOverrun(m, now)).toEqual({ kind: 'late', minutes: 40, since: at(-40), basis: 'elapsed' });
    expect(tourOverrun(mission({ status: 'in_progress', plannedEnd: at(-10) }), now).kind).toBe('on_time');
  });

  it('uses the last completed stop as the real end of a finished tour', () => {
    const m = mission({
      status: 'completed',
      plannedEnd: at(-120),
      deliveries: [
        delivery({ id: 'a', status: 'delivered', actualCompletion: at(-150) }),
        delivery({ id: 'b', status: 'delivered', actualCompletion: at(-90) }),
      ],
    });
    expect(tourOverrun(m, now)).toMatchObject({ kind: 'late', minutes: 30, basis: 'actual' });
    expect(missionLateness(m, now)).toMatchObject({ kind: 'late', minutes: 30 });
  });

  it('is not applicable without planned end, unknown without real end', () => {
    expect(tourOverrun(mission({ status: 'in_progress' }), now).kind).toBe('not_applicable');
    expect(tourOverrun(mission({ status: 'completed', plannedEnd: at(-60) }), now).kind).toBe('unknown');
  });
});
