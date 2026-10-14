import { describe, expect, it } from 'vitest';
import { parseMissionDistances, parseMissions, parseVehicles } from './normalize';
import { buildDemoData } from '../demo/demoData';

describe('parseVehicles', () => {
  it('keeps valid vehicles and rejects invalid entries', () => {
    const { items, rejected } = parseVehicles([
      { id: 'v1', registration: 'AA-001-AA', status: 'driving', position: { lat: 48, lng: 7, recordedAt: '2026-10-14T10:00:00Z' } },
      { registration: 'sans id' },
      'pas un objet',
    ]);
    expect(rejected).toBe(2);
    expect(items).toHaveLength(1);
    expect(items[0]!.position?.recordedAt.toISOString()).toBe('2026-10-14T10:00:00.000Z');
  });

  it('never invents values for missing or invalid fields', () => {
    const [v] = parseVehicles([
      { id: 'v1', status: 'teleporting', position: { lat: 48, lng: 7 }, distanceTodayKm: -4 },
    ]).items;
    expect(v).toMatchObject({ registration: 'v1', status: 'unknown', position: null });
    expect(v!.distanceTodayKm).toBeUndefined();
    expect(v!.driverName).toBeUndefined();
  });

  it('rejects null-island and out-of-range coordinates', () => {
    const items = parseVehicles([
      { id: 'a', position: { lat: 0, lng: 0, recordedAt: '2026-10-14T10:00:00Z' } },
      { id: 'b', position: { lat: 120, lng: 7, recordedAt: '2026-10-14T10:00:00Z' } },
    ]).items;
    expect(items.map((v) => v.position)).toEqual([null, null]);
  });

  it('handles non-array payloads', () => {
    expect(parseVehicles(undefined)).toEqual({ items: [], rejected: 0 });
  });
});

describe('parseMissions', () => {
  it('parses deliveries and dates, ignoring invalid dates', () => {
    const { items } = parseMissions([
      {
        id: 'm1',
        reference: 'TR-1',
        status: 'in_progress',
        plannedStart: 'pas une date',
        deliveries: [{ id: 'd1', reference: 'BL-1', status: 'delivered', plannedWindowEnd: '2026-10-14T09:00:00Z' }, {}],
      },
    ]);
    const m = items[0]!;
    expect(m.plannedStart).toBeUndefined();
    expect(m.deliveries).toHaveLength(1);
    expect(m.deliveries[0]).toMatchObject({ missionId: 'm1', status: 'delivered', customerName: 'Client non renseigné' });
  });

  it('round-trips demo data through JSON (same contract as the gateway)', () => {
    const demo = buildDemoData(new Date('2026-10-14T12:00:00Z'));
    const json = JSON.parse(JSON.stringify(demo));
    expect(parseMissions(json.missions)).toEqual({ items: demo.missions, rejected: 0 });
    expect(parseVehicles(json.vehicles).rejected).toBe(0);
  });
});

describe('parseMissionDistances', () => {
  it('maps mission ids to distances', () => {
    const map = parseMissionDistances([{ missionId: 'm1', actualDistanceKm: 42 }, { missionId: 'm2' }]);
    expect([...map]).toEqual([['m1', 42]]);
  });
});
