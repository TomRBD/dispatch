/**
 * DONNÉES DE DÉMONSTRATION — entièrement fictives.
 *
 * Immatriculations, clients, références et conducteurs sont inventés pour
 * illustrer l'interface. Les horaires sont exprimés relativement à l'heure
 * courante afin que la journée reste cohérente quel que soit le moment du
 * lancement. Aucune de ces valeurs ne provient de Webfleet ni de Business
 * Central.
 */
import type { Delivery, LatLng, Mission, Vehicle } from '../../domain/types';

const PLACES = {
  depot: { lat: 48.1902, lng: 7.3361 },
  colmar: { lat: 48.0794, lng: 7.3585 },
  selestat: { lat: 48.2594, lng: 7.4542 },
  kaysersberg: { lat: 48.1386, lng: 7.2636 },
  rouffach: { lat: 47.9575, lng: 7.3003 },
  guebwiller: { lat: 47.9093, lng: 7.2108 },
  cernay: { lat: 47.8063, lng: 7.1766 },
  mulhouse: { lat: 47.7508, lng: 7.3359 },
  altkirch: { lat: 47.6238, lng: 7.2399 },
  hirsingue: { lat: 47.5864, lng: 7.2522 },
  neufBrisach: { lat: 48.0177, lng: 7.5283 },
  munster: { lat: 48.0408, lng: 7.1352 },
  thann: { lat: 47.8075, lng: 7.1030 },
  saintLouis: { lat: 47.5903, lng: 7.5600 },
  marckolsheim: { lat: 48.1630, lng: 7.5440 },
} satisfies Record<string, LatLng>;

const between = (a: LatLng, b: LatLng, t: number): LatLng => ({
  lat: a.lat + (b.lat - a.lat) * t,
  lng: a.lng + (b.lng - a.lng) * t,
});

interface DeliverySeed {
  ref: string;
  order?: string;
  customer: string;
  site?: string;
  at: LatLng;
  status: Delivery['status'];
  /** Créneau prévu, en minutes relatives à maintenant. */
  window?: [number, number];
  eta?: number;
  arrival?: number;
  done?: number;
}

function deliveries(missionId: string, seeds: DeliverySeed[], at: (m: number) => Date): Delivery[] {
  return seeds.map((s, i) => ({
    id: `${missionId}-L${i + 1}`,
    reference: s.ref,
    orderReference: s.order,
    missionId,
    sequence: i + 1,
    customerName: s.customer,
    siteName: s.site,
    location: s.at,
    status: s.status,
    plannedWindowStart: s.window ? at(s.window[0]) : undefined,
    plannedWindowEnd: s.window ? at(s.window[1]) : undefined,
    estimatedArrival: s.eta !== undefined ? at(s.eta) : undefined,
    actualArrival: s.arrival !== undefined ? at(s.arrival) : undefined,
    actualCompletion: s.done !== undefined ? at(s.done) : undefined,
  }));
}

export function buildDemoData(now: Date): { vehicles: Vehicle[]; missions: Mission[] } {
  const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);
  const P = PLACES;

  const vehicles: Vehicle[] = [
    {
      id: 'v1', registration: 'DM-101-AA', label: 'Porteur benne 19 t', status: 'driving',
      position: { ...between(P.kaysersberg, P.colmar, 0.55), recordedAt: at(-1), placeLabel: 'D415, vers Colmar' },
      driverName: 'Conducteur A', distanceTodayKm: 64,
    },
    {
      id: 'v2', registration: 'DM-102-BB', label: 'Semi-remorque fond mouvant', status: 'driving',
      position: { ...between(P.cernay, P.thann, 0.4), recordedAt: at(-2), placeLabel: 'N66, Cernay' },
      driverName: 'Conducteur B', distanceTodayKm: 112,
    },
    {
      id: 'v3', registration: 'DM-103-CC', label: 'Porteur citerne', status: 'stopped',
      position: { ...P.neufBrisach, recordedAt: at(-4), placeLabel: 'Neuf-Brisach' },
      driverName: 'Conducteur C', distanceTodayKm: 48,
    },
    {
      id: 'v4', registration: 'DM-104-DD', label: 'Porteur benne 26 t', status: 'ignition_off',
      position: { ...P.depot, recordedAt: at(-38), placeLabel: 'Dépôt' },
      driverName: 'Conducteur D', distanceTodayKm: 141,
    },
    {
      id: 'v5', registration: 'DM-105-EE', label: 'Ampliroll', status: 'stopped',
      // Position ancienne (plus de 15 min) : volontairement pour la démonstration.
      position: { ...between(P.mulhouse, P.altkirch, 0.6), recordedAt: at(-52), placeLabel: 'D432, Walheim' },
      distanceTodayKm: 77,
    },
    {
      id: 'v6', registration: 'DM-106-FF', label: 'Porteur benne 19 t', status: 'ignition_off',
      // Position indisponible : volontairement pour la démonstration.
      position: null,
    },
    {
      id: 'v7', registration: 'DM-107-GG', label: 'Tracteur + benne agricole', status: 'driving',
      position: { ...between(P.selestat, P.marckolsheim, 0.3), recordedAt: at(-3) },
      driverName: 'Conducteur G', distanceTodayKm: 22,
    },
    {
      id: 'v8', registration: 'DM-108-HH', status: 'unknown',
      position: { ...P.hirsingue, recordedAt: at(-190), placeLabel: 'Hirsingue' },
    },
  ];

  const missions: Mission[] = [
    {
      id: 'm1', reference: 'DEMO-TR-0412', label: 'Tournée Vignoble', vehicleId: 'v1', status: 'in_progress',
      plannedStart: at(-150), plannedEnd: at(90), actualStart: at(-145),
      plannedDistanceKm: 118,
      deliveries: deliveries('m1', [
        { ref: 'DEMO-BL-5101', order: 'DEMO-CV-2201', customer: 'Domaine démo Riesling', site: 'Kaysersberg', at: P.kaysersberg, status: 'delivered', window: [-100, -70], arrival: -92, done: -78 },
        { ref: 'DEMO-BL-5102', order: 'DEMO-CV-2202', customer: 'Jardinerie démo Colmar', site: 'Colmar Nord', at: P.colmar, status: 'planned', window: [5, 35], eta: 12 },
        { ref: 'DEMO-BL-5103', order: 'DEMO-CV-2203', customer: 'Coopérative démo Rouffach', site: 'Rouffach', at: P.rouffach, status: 'planned', window: [45, 80] },
      ], at),
    },
    {
      id: 'm2', reference: 'DEMO-TR-0413', label: 'Tournée Thur', vehicleId: 'v2', status: 'in_progress',
      plannedStart: at(-210), plannedEnd: at(30), actualStart: at(-180),
      plannedDistanceKm: 164,
      deliveries: deliveries('m2', [
        { ref: 'DEMO-BL-5201', order: 'DEMO-CV-2301', customer: 'Exploitation démo Guebwiller', site: 'Guebwiller', at: P.guebwiller, status: 'delivered', window: [-150, -110], arrival: -112, done: -95 },
        { ref: 'DEMO-BL-5202', order: 'DEMO-CV-2302', customer: 'Paysagiste démo Thann', site: 'Thann', at: P.thann, status: 'planned', window: [-40, -10], eta: 18 },
        { ref: 'DEMO-BL-5203', order: 'DEMO-CV-2303', customer: 'Commune démo Munster', site: 'Ateliers municipaux', at: P.munster, status: 'planned', window: [10, 40], eta: 65 },
      ], at),
    },
    {
      id: 'm3', reference: 'DEMO-TR-0414', label: 'Tournée Ried', vehicleId: 'v3', status: 'in_progress',
      plannedStart: at(-90), plannedEnd: at(120), actualStart: at(-88),
      plannedDistanceKm: 96,
      deliveries: deliveries('m3', [
        { ref: 'DEMO-BL-5301', customer: 'Maraîcher démo Ried', site: 'Neuf-Brisach', at: P.neufBrisach, status: 'in_progress', window: [-15, 20], arrival: -6 },
        { ref: 'DEMO-BL-5302', customer: 'Golf démo', site: 'Marckolsheim', at: P.marckolsheim, status: 'planned', window: [50, 90] },
      ], at),
    },
    {
      id: 'm4', reference: 'DEMO-TR-0410', label: 'Tournée matinale Sud', vehicleId: 'v4', status: 'completed',
      plannedStart: at(-330), plannedEnd: at(-60), actualStart: at(-325), actualEnd: at(-40),
      plannedDistanceKm: 108, actualDistanceKm: 139,
      deliveries: deliveries('m4', [
        { ref: 'DEMO-BL-5001', order: 'DEMO-CV-2001', customer: 'Pépinière démo Mulhouse', site: 'Mulhouse Est', at: P.mulhouse, status: 'delivered', window: [-260, -230], arrival: -252, done: -240 },
        { ref: 'DEMO-BL-5002', order: 'DEMO-CV-2002', customer: 'Exploitation démo Sundgau', site: 'Altkirch', at: P.altkirch, status: 'delivered', window: [-200, -170], arrival: -150, done: -138 },
      ], at),
    },
    {
      id: 'm5', reference: 'DEMO-TR-0415', label: 'Tournée Sundgau', vehicleId: 'v5', status: 'in_progress',
      plannedStart: at(-160), plannedEnd: at(20), actualStart: at(-158),
      plannedDistanceKm: 132,
      deliveries: deliveries('m5', [
        { ref: 'DEMO-BL-5401', customer: 'Viticulteur démo Sud', site: 'Saint-Louis', at: P.saintLouis, status: 'delivered', window: [-120, -90], arrival: -100, done: -88 },
        { ref: 'DEMO-BL-5402', customer: 'Exploitation démo Hirsingue', site: 'Hirsingue', at: P.hirsingue, status: 'planned', window: [-70, -40] },
      ], at),
    },
    {
      id: 'm6', reference: 'DEMO-TR-0416', label: 'Tournée après-midi', vehicleId: 'v6', status: 'planned',
      plannedStart: at(80), plannedEnd: at(260), plannedDistanceKm: 87,
      deliveries: deliveries('m6', [
        { ref: 'DEMO-BL-5501', customer: 'Centre équestre démo', site: 'Sélestat', at: P.selestat, status: 'planned', window: [120, 150] },
        { ref: 'DEMO-BL-5502', customer: 'Client démo sans créneau', at: P.marckolsheim, status: 'planned' },
      ], at),
    },
    {
      id: 'm7', reference: 'DEMO-TR-0409', label: 'Collecte matinale', vehicleId: 'v8', status: 'completed',
      plannedStart: at(-420), plannedEnd: at(-240), actualStart: at(-415), actualEnd: at(-230),
      plannedDistanceKm: 72,
      deliveries: deliveries('m7', [
        { ref: 'DEMO-BL-4901', customer: 'Domaine démo Altkirch', site: 'Altkirch', at: P.altkirch, status: 'delivered', window: [-360, -330], arrival: -350, done: -341 },
        { ref: 'DEMO-BL-4902', customer: 'Exploitation démo Hirsingue', site: 'Hirsingue', at: P.hirsingue, status: 'delivered' },
      ], at),
    },
    {
      id: 'm8', reference: 'DEMO-TR-0417', label: 'Livraison urgente', status: 'planned',
      plannedStart: at(40), plannedEnd: at(150),
      deliveries: deliveries('m8', [
        { ref: 'DEMO-BL-5601', order: 'DEMO-CV-2601', customer: 'Serres démo Colmar', site: 'Colmar Sud', at: P.colmar, status: 'planned', window: [70, 100] },
      ], at),
    },
    {
      id: 'm9', reference: 'DEMO-TR-0411', label: 'Tournée Hardt', vehicleId: 'v7', status: 'completed',
      plannedStart: at(-300), plannedEnd: at(-150), actualStart: at(-290), actualEnd: at(-160),
      plannedDistanceKm: 64, actualDistanceKm: 61,
      deliveries: deliveries('m9', [
        { ref: 'DEMO-BL-4801', customer: 'Exploitation démo Hardt', site: 'Neuf-Brisach', at: P.neufBrisach, status: 'delivered', window: [-240, -200], arrival: -230, done: -218 },
        { ref: 'DEMO-BL-4802', customer: 'Client démo absent', site: 'Marckolsheim', at: P.marckolsheim, status: 'failed', window: [-190, -160], arrival: -185, done: -180 },
      ], at),
    },
  ];

  return { vehicles, missions };
}
