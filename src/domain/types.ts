/**
 * Modèle de données d'Agrivalor Dispatch.
 *
 * Ces types sont indépendants des sources : les adaptateurs Webfleet et
 * Business Central convertissent leurs réponses vers ce modèle. Tout champ
 * optionnel peut être absent de la source et ne doit jamais être inventé.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/** Origine des données affichées. */
export type DataOrigin = 'live' | 'demo';

export type SourceId = 'webfleet' | 'businessCentral';

export type SourceState =
  | {
      kind: 'ok';
      origin: DataOrigin;
      fetchedAt: Date;
      /** Enregistrements écartés car invalides ou incomplets. */
      rejected?: number;
    }
  | { kind: 'error'; message: string }
  | { kind: 'not-configured' };

/** Dernière position connue, telle que transmise par la télématique. */
export interface VehiclePosition extends LatLng {
  /** Horodatage de la mesure GPS (pas l'heure de récupération). */
  recordedAt: Date;
  /** Adresse ou lieu résolu par la source, si fourni. */
  placeLabel?: string;
}

/** État véhicule issu de la télématique (Webfleet). */
export type VehicleStatus = 'driving' | 'stopped' | 'ignition_off' | 'unknown';

export interface Vehicle {
  id: string;
  /** Immatriculation ou identifiant lisible. */
  registration: string;
  /** Désignation interne (ex. « Benne 26 t »), si disponible. */
  label?: string;
  status: VehicleStatus;
  /** null = position indisponible. */
  position: VehiclePosition | null;
  /** N'est renseigné que si la source le fournit et que l'affichage est autorisé. */
  driverName?: string;
  /** Distance parcourue depuis le début de journée (km), si fournie. */
  distanceTodayKm?: number;
}

/** Statut de mission (tournée) issu de Business Central. */
export type MissionStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'unknown';

/** Statut de livraison issu de Business Central. */
export type DeliveryStatus =
  | 'planned'
  | 'in_progress'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'unknown';

export interface Delivery {
  id: string;
  /** Référence de livraison (bon de livraison / expédition). */
  reference: string;
  /** Référence de commande Business Central, si disponible. */
  orderReference?: string;
  missionId: string;
  /** Ordre de passage dans la tournée, si connu. */
  sequence?: number;
  customerName: string;
  siteName?: string;
  location?: LatLng;
  status: DeliveryStatus;
  plannedWindowStart?: Date;
  plannedWindowEnd?: Date;
  /** Heure estimée d'arrivée fournie par une source (jamais calculée ici). */
  estimatedArrival?: Date;
  actualArrival?: Date;
  actualCompletion?: Date;
}

export interface Mission {
  id: string;
  reference: string;
  /** Libellé de tournée, si disponible. */
  label?: string;
  /** undefined = mission non affectée à un véhicule. */
  vehicleId?: string;
  status: MissionStatus;
  plannedStart?: Date;
  plannedEnd?: Date;
  actualStart?: Date;
  actualEnd?: Date;
  /** Distance prévue au planning (km). */
  plannedDistanceKm?: number;
  /** Distance parcourue mesurée par la télématique pour cette mission (km). */
  actualDistanceKm?: number;
  deliveries: Delivery[];
}

/** Types d'événements affichés sur la timeline. */
export type OpsEventType = 'departure' | 'arrival' | 'delivery' | 'delay' | 'mission_end';

export interface OpsEvent {
  id: string;
  type: OpsEventType;
  label: string;
  missionId: string;
  deliveryId?: string;
  plannedAt?: Date;
  actualAt?: Date;
  /** Vrai si l'événement est attendu mais n'a pas encore eu lieu. */
  pending: boolean;
  /** Vrai si la source ne permet pas de savoir si l'événement a eu lieu (statut inconnu). */
  uncertain?: boolean;
}

/** Instantané complet de l'exploitation, tel que chargé par le dépôt. */
export interface DispatchSnapshot {
  vehicles: Vehicle[];
  missions: Mission[];
  sources: Record<SourceId, SourceState>;
  /** Heure de constitution de l'instantané côté application. */
  loadedAt: Date;
}

/** Résultat de l'évaluation de retard (voir domain/rules.ts). */
export type Lateness =
  | { kind: 'on_time' }
  | {
      kind: 'late';
      minutes: number;
      /** Moment à partir duquel le retard est constaté. */
      since: Date;
      /** Base du constat : heure réelle, ETA de la source, ou dépassement en cours. */
      basis: 'actual' | 'eta' | 'elapsed';
    }
  | { kind: 'unknown'; reason: string }
  | { kind: 'not_applicable' };

export interface DistanceComparison {
  plannedKm?: number;
  actualKm?: number;
  /** Écart en km (parcouru − prévu), uniquement si comparable. */
  deltaKm?: number;
  /** Écart relatif (0.12 = +12 %), uniquement si comparable. */
  deltaRatio?: number;
  /** Raison pour laquelle la comparaison n'est pas calculée. */
  notComparableReason?: string;
  /** Vrai si l'écart dépasse le seuil d'anomalie défini dans les règles. */
  anomaly: boolean;
  /** Vrai si la mission est en cours : la distance parcourue est partielle. */
  partial: boolean;
}
