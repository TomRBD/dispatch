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
  /** Durée prévue (ISO 8601, ex. P0DT1H30M0.0S) : fin prévue = début prévu + durée, si pas de fin explicite. */
  plannedDuration: string | null;
  actualStart: TimeField;
  actualEnd: TimeField;
  plannedDistanceKm: string | null;
  actualDistanceKm: string | null;
  /** Compteurs kilométriques : distance parcourue = fin − début, si pas de distance explicite. */
  startMileage: string | null;
  endMileage: string | null;
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

/**
 * Correspondance relevée sur SUNDGAU COMPOST (npm run bc:inspect).
 * Tournee_Excel → missions/tournées de l'application ; Mission_Excel → livraisons.
 */
export const BC_MAPPING: BcMapping = {
  tournee: {
    id: 'No',
    date: 'Tour_Date',
    reference: 'No',
    label: 'Description',
    vehicle: 'Vehicle_No',
    status: 'Status',
    plannedStart: { date: 'Tour_Date', time: 'Planned_Starting_Time' },
    plannedEnd: null,
    plannedDuration: 'Planned_Duration',
    // Aucune heure réelle de départ / fin dans Tournee_Excel (seulement Real_Duration).
    actualStart: null,
    actualEnd: null,
    // Pas de distance prévue dans BC.
    plannedDistanceKm: null,
    actualDistanceKm: null,
    startMileage: 'Starting_Mileage',
    endMileage: 'Ending_Mileage',
  },
  mission: {
    id: 'No',
    tourneeId: 'Tour_No',
    date: 'Tour_Date',
    reference: 'No',
    orderReference: null,
    sequence: 'Rank',
    customer: 'Destination_Name',
    site: 'Destination_City',
    // Mission_Excel n'a pas de champ statut : statut « inconnu » tant qu'aucune règle n'est validée.
    status: null,
    latitude: 'Destination_Latitude',
    longitude: 'Destination_Longitude',
    // Heure demandée par le client, utilisée comme fin de créneau pour la règle de retard.
    windowStart: null,
    windowEnd: { date: 'Requested_Date', time: 'Requested_Time' },
    estimatedArrival: null,
    actualArrival: null,
    actualCompletion: null,
  },
  // Seule valeur observée à ce jour ; les autres valeurs restent « inconnu » jusqu'à confirmation.
  tourneeStatus: { Finished: 'completed' },
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
