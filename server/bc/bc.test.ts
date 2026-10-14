import { describe, expect, it } from 'vitest';
import type { BcMapping } from './mapping';
import { BC_MAPPING, missingRequired } from './mapping';
import { extractToken, tokenExpiry } from './token';
import { parisLocalToIso, parseIsoDurationMin, readTime, transformBc } from './transform';

describe('parisLocalToIso', () => {
  it('handles summer and winter time', () => {
    expect(parisLocalToIso('2026-07-01', '08:30:00')).toBe('2026-07-01T06:30:00.000Z');
    expect(parisLocalToIso('2026-12-01', '08:30')).toBe('2026-12-01T07:30:00.000Z');
  });
  it('rejects malformed input', () => {
    expect(parisLocalToIso('01/07/2026', '08:30')).toBeUndefined();
  });
});

describe('readTime', () => {
  it('treats BC blank values as missing', () => {
    expect(readTime({ d: '0001-01-01T00:00:00Z' }, 'd')).toBeUndefined();
    expect(readTime({ d: '2026-10-14', t: '00:00:00' }, { date: 'd', time: 't' })).toBeUndefined();
  });
  it('reads UTC datetimes with or without Z', () => {
    expect(readTime({ d: '2026-10-14T06:00:00Z' }, 'd')).toBe('2026-10-14T06:00:00.000Z');
    expect(readTime({ d: '2026-10-14T06:00:00' }, 'd')).toBe('2026-10-14T06:00:00.000Z');
  });
});

describe('token', () => {
  const jwt = (exp: number) =>
    `x.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.sig`;

  it('accepts raw, Bearer-prefixed and JSON token files', () => {
    expect(extractToken('abc\n')).toBe('abc');
    expect(extractToken('Bearer abc')).toBe('abc');
    expect(extractToken('{"access_token":"abc","expires_in":3600}')).toBe('abc');
    expect(extractToken('')).toBeUndefined();
  });
  it('reads JWT expiry', () => {
    expect(tokenExpiry(jwt(1_800_000_000))?.toISOString()).toBe('2027-01-15T08:00:00.000Z');
    expect(tokenExpiry('not-a-jwt')).toBeUndefined();
  });
});

describe('transformBc', () => {
  const mapping: BcMapping = {
    ...BC_MAPPING,
    tournee: { ...BC_MAPPING.tournee, id: 'No', date: 'Date', vehicle: 'Vehicule', status: 'Statut',
      plannedStart: { date: 'Date', time: 'Heure_Debut' }, plannedDistanceKm: 'Km_Prevus' },
    mission: { ...BC_MAPPING.mission, id: 'No', tourneeId: 'No_Tournee', customer: 'Client', status: 'Statut',
      sequence: 'Ordre', latitude: 'Lat', longitude: 'Lng' },
    tourneeStatus: { 'En cours': 'in_progress' },
    missionStatus: { Livrée: 'delivered' },
  };

  it('nests missions under their tournée and maps statuses', () => {
    const { missions, skipped } = transformBc(
      [{ No: 'T1', Date: '2026-10-14', Vehicule: 'AB-123-CD', Statut: 'En cours', Heure_Debut: '07:15:00', Km_Prevus: '118,5' }],
      [
        { No: 'M1', No_Tournee: 'T1', Client: 'Client A', Statut: 'Livrée', Ordre: 1, Lat: 47.6, Lng: 7.2 },
        { No: 'M2', No_Tournee: 'T1', Client: 'Client B', Statut: 'Bizarre', Ordre: 2, Lat: 0, Lng: '' },
        { No: 'M3', No_Tournee: 'T9' },
      ],
      mapping,
    );
    expect(skipped).toEqual({ tournees: 0, missions: 1 });
    const t = missions[0]!;
    expect(t).toMatchObject({ id: 'T1', vehicleId: 'AB-123-CD', status: 'in_progress', plannedDistanceKm: 118.5,
      plannedStart: '2026-10-14T05:15:00.000Z' });
    expect(t.deliveries.map((d) => d.status)).toEqual(['delivered', 'unknown']);
    expect(t.deliveries[1]!.location).toBeUndefined();
  });

  it('requires the mandatory fields before serving data', () => {
    const empty = { ...mapping, tournee: { ...mapping.tournee, id: null }, mission: { ...mapping.mission, tourneeId: null } };
    expect(missingRequired(empty)).toEqual(['tournee.id', 'mission.tourneeId']);
    expect(missingRequired(BC_MAPPING)).toEqual([]);
  });
});

describe('SUNDGAU COMPOST mapping', () => {
  const tour = {
    No: 'TOU-001', Description: 'Livraison bois', Tour_Date: '2026-10-14', Vehicle_No: 'GE-376-AX',
    Status: 'Finished', Planned_Starting_Time: '08:00:00', Planned_Duration: 'P0DT1H30M0.0S',
    Starting_Mileage: 120_400, Ending_Mileage: 120_486,
  };
  const mission = {
    No: 'MIS-001', Tour_No: 'TOU-001', Tour_Date: '2026-10-14', Rank: 1, Destination_Name: 'Client X',
    Destination_City: 'ALTKIRCH', Destination_Latitude: 47.62, Destination_Longitude: 7.24,
    Requested_Date: '2026-10-14', Requested_Time: '10:00:00',
  };

  it('parses BC durations', () => {
    expect(parseIsoDurationMin('P0DT1H30M0.0S')).toBe(90);
    expect(parseIsoDurationMin('P0DT0H0M0.0S')).toBe(0);
    expect(parseIsoDurationMin('n/a')).toBeUndefined();
  });

  it('maps a tournée and its missions', () => {
    const [t] = transformBc([tour], [mission], BC_MAPPING).missions;
    expect(t).toMatchObject({
      id: 'TOU-001', label: 'Livraison bois', vehicleId: 'GE-376-AX', status: 'completed',
      plannedStart: '2026-10-14T06:00:00.000Z', plannedEnd: '2026-10-14T07:30:00.000Z', actualDistanceKm: 86,
    });
    expect(t!.plannedDistanceKm).toBeUndefined();
    expect(t!.deliveries[0]).toMatchObject({
      id: 'MIS-001', sequence: 1, customerName: 'Client X', siteName: 'ALTKIRCH', status: 'unknown',
      location: { lat: 47.62, lng: 7.24 }, plannedWindowEnd: '2026-10-14T08:00:00.000Z',
    });
  });

  it('leaves end and distance empty when BC values are blank or inconsistent', () => {
    const [t] = transformBc(
      [{ ...tour, Status: 'Planned', Planned_Duration: 'P0DT0H0M0.0S', Ending_Mileage: 0 }], [], BC_MAPPING,
    ).missions;
    expect(t).toMatchObject({ status: 'unknown' });
    expect(t!.plannedEnd).toBeUndefined();
    expect(t!.actualDistanceKm).toBeUndefined();
  });
});
