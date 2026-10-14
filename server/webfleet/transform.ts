/**
 * showObjectReportExtern → contrat `vehicles` de l'application.
 *
 * Champs utilisés (doc WEBFLEET.connect) :
 * - objectno / objectname : identifiant et nom de l'objet (souvent l'immatriculation) ;
 * - latitude_mdeg / longitude_mdeg : position en micro-degrés (10⁻⁶ °) ;
 * - pos_time : horodatage de la position ; postext : lieu en clair ;
 * - ignition (contact) et standstill (à l'arrêt), 0/1.
 */
import { canonicalPlate } from '../plate';

type Row = Record<string, unknown>;

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : typeof v === 'number' ? String(v) : undefined);
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const flag = (v: unknown): boolean | undefined => {
  const n = num(v);
  if (n === 1) return true;
  if (n === 0) return false;
  if (v === true || v === false) return v;
  return undefined;
};

export interface ContractVehicle {
  id: string;
  registration: string;
  label?: string;
  status: 'driving' | 'stopped' | 'ignition_off' | 'unknown';
  position?: { lat: number; lng: number; recordedAt: string; placeLabel?: string };
  driverName?: string;
}

/** État déduit des seuls indicateurs Webfleet de contact et d'arrêt. */
export function vehicleStatus(row: Row): ContractVehicle['status'] {
  const ignition = flag(row.ignition);
  const standstill = flag(row.standstill);
  if (ignition === false) return 'ignition_off';
  if (ignition === true && standstill === false) return 'driving';
  if (ignition === true && standstill === true) return 'stopped';
  return 'unknown';
}

function position(row: Row): ContractVehicle['position'] {
  const lat = num(row.latitude_mdeg);
  const lng = num(row.longitude_mdeg);
  const time = str(row.pos_time);
  const recorded = time ? new Date(time) : undefined;
  if (lat === undefined || lng === undefined || !recorded || Number.isNaN(recorded.getTime())) return undefined;
  if (lat === 0 && lng === 0) return undefined;
  return { lat: lat / 1e6, lng: lng / 1e6, recordedAt: recorded.toISOString(), placeLabel: str(row.postext) };
}

export function transformWebfleet(rows: Row[], showDriverNames: boolean): ContractVehicle[] {
  const out: ContractVehicle[] = [];
  for (const row of rows) {
    const objectNo = str(row.objectno);
    const name = str(row.objectname);
    if (!objectNo && !name) continue;
    const plate = canonicalPlate(name) ?? canonicalPlate(objectNo);
    out.push({
      // L'immatriculation sert d'identifiant commun avec Business Central.
      id: plate ?? `webfleet:${objectNo ?? name}`,
      registration: plate ?? name ?? objectNo!,
      label: name && name !== plate ? name : undefined,
      status: vehicleStatus(row),
      position: position(row),
      driverName: showDriverNames ? str(row.drivername) : undefined,
    });
  }
  return out;
}
