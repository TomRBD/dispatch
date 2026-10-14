/**
 * Libellés, tonalités et pictogrammes des statuts — source unique pour toute
 * l'interface. Un statut n'est jamais communiqué par la seule couleur : chaque
 * entrée a un libellé et un pictogramme.
 */
import type { DeliveryStatus, Lateness, MissionStatus, VehicleStatus } from './types';
import { formatDuration } from './time';

export type Tone = 'ok' | 'active' | 'neutral' | 'warn' | 'danger' | 'muted';

export interface StatusMeta {
  label: string;
  tone: Tone;
  /** Pictogramme texte court (lisible sans couleur). */
  glyph: string;
}

export const VEHICLE_STATUS: Record<VehicleStatus, StatusMeta> = {
  driving: { label: 'En route', tone: 'active', glyph: '▶' },
  stopped: { label: "À l'arrêt", tone: 'neutral', glyph: '❚❚' },
  ignition_off: { label: 'Contact coupé', tone: 'muted', glyph: '■' },
  unknown: { label: 'État inconnu', tone: 'muted', glyph: '?' },
};

export const MISSION_STATUS: Record<MissionStatus, StatusMeta> = {
  planned: { label: 'Planifiée', tone: 'neutral', glyph: '○' },
  in_progress: { label: 'En cours', tone: 'active', glyph: '»' },
  completed: { label: 'Terminée', tone: 'ok', glyph: '✓' },
  cancelled: { label: 'Annulée', tone: 'muted', glyph: '⨯' },
  unknown: { label: 'Statut inconnu', tone: 'muted', glyph: '?' },
};

export const DELIVERY_STATUS: Record<DeliveryStatus, StatusMeta> = {
  planned: { label: 'À livrer', tone: 'neutral', glyph: '○' },
  in_progress: { label: 'En cours', tone: 'active', glyph: '»' },
  delivered: { label: 'Livrée', tone: 'ok', glyph: '✓' },
  failed: { label: 'Non livrée', tone: 'danger', glyph: '✕' },
  cancelled: { label: 'Annulée', tone: 'muted', glyph: '⨯' },
  unknown: { label: 'Statut inconnu', tone: 'muted', glyph: '?' },
};

export function latenessMeta(l: Lateness): StatusMeta | null {
  switch (l.kind) {
    case 'late': {
      const prefix = l.basis === 'eta' ? 'Retard prévu' : 'Retard';
      return { label: `${prefix} ${formatDuration(l.minutes)}`, tone: 'danger', glyph: '!' };
    }
    case 'on_time':
      return { label: "À l'heure", tone: 'ok', glyph: '✓' };
    case 'unknown':
      return { label: 'Retard indéterminé', tone: 'muted', glyph: '–' };
    case 'not_applicable':
      return null;
  }
}

/** Valeurs d'entrée tolérantes → statut normalisé (utilisé par les adaptateurs). */
function toKey<K extends string>(table: Record<K, StatusMeta>, v: unknown): K | 'unknown' {
  return typeof v === 'string' && Object.hasOwn(table, v) ? (v as K) : 'unknown';
}
export const toVehicleStatus = (v: unknown): VehicleStatus => toKey(VEHICLE_STATUS, v);
export const toMissionStatus = (v: unknown): MissionStatus => toKey(MISSION_STATUS, v);
export const toDeliveryStatus = (v: unknown): DeliveryStatus => toKey(DELIVERY_STATUS, v);
