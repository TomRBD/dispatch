/**
 * Adaptateur Webfleet.
 *
 * Le navigateur n'appelle jamais Webfleet directement : les identifiants
 * (compte, utilisateur, clé API) restent sur une passerelle serveur qui
 * interroge Webfleet et renvoie le format décrit dans README.md.
 */
import type { Vehicle } from '../../domain/types';
import { getJson } from './http';
import { parseMissionDistances, parseVehicles } from './normalize';

export interface WebfleetData {
  vehicles: Vehicle[];
  /** Distance parcourue par mission (km), si la passerelle sait la calculer. */
  missionDistances: Map<string, number>;
  rejected: number;
}

export interface WebfleetAdapter {
  fetchFleet(signal?: AbortSignal): Promise<WebfleetData>;
}

export function createWebfleetAdapter(baseUrl: string): WebfleetAdapter {
  return {
    async fetchFleet(signal) {
      const body = await getJson('Webfleet', `${baseUrl}/webfleet/fleet`, signal);
      const obj = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
      const { items, rejected } = parseVehicles(obj.vehicles);
      return { vehicles: items, missionDistances: parseMissionDistances(obj.missionDistances), rejected };
    },
  };
}
