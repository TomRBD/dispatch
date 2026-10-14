import { describe, expect, it } from 'vitest';
import { canonicalPlate } from '../plate';
import { BC_MAPPING } from '../bc/mapping';
import { transformBc } from '../bc/transform';
import { transformWebfleet, vehicleStatus } from './transform';

describe('canonicalPlate', () => {
  it('normalises French plates from various spellings', () => {
    expect(canonicalPlate('GX-349-PZ')).toBe('GX-349-PZ');
    expect(canonicalPlate('gx 349 pz')).toBe('GX-349-PZ');
    expect(canonicalPlate('BOM 12 - GX349PZ')).toBe('GX-349-PZ');
    expect(canonicalPlate('Remorque 4')).toBeUndefined();
  });
});

describe('Webfleet showObjectReportExtern', () => {
  it('derives status only from ignition / standstill flags', () => {
    expect(vehicleStatus({ ignition: 0, standstill: 1 })).toBe('ignition_off');
    expect(vehicleStatus({ ignition: '1', standstill: '0' })).toBe('driving');
    expect(vehicleStatus({ ignition: 1, standstill: 1 })).toBe('stopped');
    expect(vehicleStatus({})).toBe('unknown');
  });

  it('converts micro-degrees and keeps the GPS timestamp', () => {
    const [v] = transformWebfleet(
      [{ objectno: '012', objectname: 'GX-349-PZ BOM', latitude_mdeg: 47586400, longitude_mdeg: 7252200,
        pos_time: '2026-10-14T09:12:00+02:00', postext: 'Hirsingue', ignition: 1, standstill: 0, drivername: 'X' }],
      false,
    );
    expect(v).toEqual({
      id: 'GX-349-PZ', registration: 'GX-349-PZ', label: 'GX-349-PZ BOM', status: 'driving',
      position: { lat: 47.5864, lng: 7.2522, recordedAt: '2026-10-14T07:12:00.000Z', placeLabel: 'Hirsingue' },
      driverName: undefined,
    });
  });

  it('drops positions without timestamp and hides drivers unless allowed', () => {
    const [a, b] = transformWebfleet(
      [
        { objectno: '7', objectname: 'Chargeuse', latitude_mdeg: 47_000_000, longitude_mdeg: 7_000_000 },
        { objectno: '8', objectname: 'FQ-089-KY', drivername: 'Conducteur', pos_time: 'n/a' },
      ],
      true,
    );
    expect(a).toMatchObject({ id: 'webfleet:7', registration: 'Chargeuse', position: undefined });
    expect(b).toMatchObject({ id: 'FQ-089-KY', driverName: 'Conducteur', position: undefined });
  });
});

describe('BC ↔ Webfleet', () => {
  it('uses the origin for pickups and canonical plates for vehicles', () => {
    const { missions } = transformBc(
      [{ No: '018700', Tour_Date: '2026-10-14', Vehicle_No: 'gx-349-pz', Status: 'In Progress',
        Planned_Starting_Time: '05:00:00', Planned_Duration: 'P0DT0H0M0.0S' }],
      [{ No: 'M1', Tour_No: '018700', Tour_Date: '2026-10-14', Rank: 3, Service_Type_Direction: 'Pickup',
        Origin_Name: 'Mairie X', Origin_City: 'MUTZIG', Origin_Latitude: 48.54, Origin_Longitude: 7.45,
        Destination_Name: 'AGRIVALOR ENERGIE', Destination_City: 'HIRSINGUE', Requested_Time: '06:30:00' }],
      BC_MAPPING,
    );
    expect(missions[0]).toMatchObject({ vehicleId: 'GX-349-PZ', status: 'in_progress' });
    expect(missions[0]!.deliveries[0]).toMatchObject({
      customerName: 'Mairie X', siteName: 'MUTZIG', location: { lat: 48.54, lng: 7.45 },
      plannedWindowEnd: '2026-10-14T04:30:00.000Z',
    });
  });
});
