/**
 * Correspondance des champs Business Central → modèle Dispatch.
 *
 * Les noms des champs de Tournee_Excel et Mission_Excel dépendent des pages
 * publiées dans Business Central. Ils ne sont PAS devinés : tant que les champs
 * obligatoires sont vides (null), la passerelle répond « correspondance à
 * configurer ». Lancer `npm run bc:inspect` pour lister les champs réels, puis
 * compléter ce fichier.
 *
 * Une heure peut être un champ unique (DateTime) ou un couple date + heure
 * (Edm.Date + Edm.TimeOfDay, interprétés à l'heure de Paris).
 */

export type TimeField = string | { date: string; time: string } | null;

export interface TourneeMapping {
  /** Identifiant unique de la tournée (obligatoire). */
  id: string | null;
  /** Champ date utilisé pour filtrer la journée (obligatoire, type Edm.Date). */
  date: string | null;
  reference: string | null;
  label: string | null;
  /** Immatriculation ou code véhicule, servant au rapprochement avec Webfleet. */
  vehicle: string | null;
  status: string | null;
  plannedStart: TimeField;
  plannedEnd: TimeField;
  actualStart: TimeField;
  actualEnd: TimeField;
  plannedDistanceKm: string | null;
  actualDistanceKm: string | null;
}

export interface MissionMapping {
  /** Identifiant unique de la mission (obligatoire). */
  id: string | null;
  /** Champ qui rattache la mission à sa tournée (obligatoire). */
  tourneeId: string | null;
  /** Champ date (Edm.Date) pour filtrer la journée, si disponible sur cette entité. */
  date: string | null;
  reference: string | null;
  orderReference: string | null;
  sequence: string | null;
  customer: string | null;
  site: string | null;
  status: string | null;
  latitude: string | null;
  longitude: string | null;
  windowStart: TimeField;
  windowEnd: TimeField;
  estimatedArrival: TimeField;
  actualArrival: TimeField;
  actualCompletion: TimeField;
}

export interface BcMapping {
  tournee: TourneeMapping;
  mission: MissionMapping;
  /** Valeurs de statut BC → statut Dispatch. Toute valeur absente devient « inconnu ». */
  tourneeStatus: Record<string, 'planned' | 'in_progress' | 'completed' | 'cancelled'>;
  missionStatus: Record<string, 'planned' | 'in_progress' | 'delivered' | 'failed' | 'cancelled'>;
}

export const BC_MAPPING: BcMapping = {
  tournee: {
    id: null,
    date: null,
    reference: null,
    label: null,
    vehicle: null,
    status: null,
    plannedStart: null,
    plannedEnd: null,
    actualStart: null,
    actualEnd: null,
    plannedDistanceKm: null,
    actualDistanceKm: null,
  },
  mission: {
    id: null,
    tourneeId: null,
    date: null,
    reference: null,
    orderReference: null,
    sequence: null,
    customer: null,
    site: null,
    status: null,
    latitude: null,
    longitude: null,
    windowStart: null,
    windowEnd: null,
    estimatedArrival: null,
    actualArrival: null,
    actualCompletion: null,
  },
  tourneeStatus: {},
  missionStatus: {},
};

/** Champs obligatoires manquants (vide = correspondance utilisable). */
export function missingRequired(m: BcMapping): string[] {
  const missing: string[] = [];
  if (!m.tournee.id) missing.push('tournee.id');
  if (!m.tournee.date) missing.push('tournee.date');
  if (!m.mission.id) missing.push('mission.id');
  if (!m.mission.tourneeId) missing.push('mission.tourneeId');
  return missing;
}
