/**
 * Adaptateur Microsoft Dynamics 365 Business Central.
 *
 * Comme pour Webfleet, l'authentification (Entra ID / OAuth) et l'accès aux
 * API Business Central sont réalisés par la passerelle serveur ; ce module ne
 * fait que lire et valider le format renvoyé (voir README.md).
 */
import type { Mission } from '../../domain/types';
import { getJson } from './http';
import { parseMissions } from './normalize';

export interface BusinessCentralData {
  missions: Mission[];
  rejected: number;
}

export interface BusinessCentralAdapter {
  fetchMissions(day: string, signal?: AbortSignal): Promise<BusinessCentralData>;
}

export function createBusinessCentralAdapter(baseUrl: string): BusinessCentralAdapter {
  return {
    async fetchMissions(day, signal) {
      const url = `${baseUrl}/business-central/missions?date=${encodeURIComponent(day)}`;
      const body = await getJson('Business Central', url, signal);
      const obj = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>;
      const { items, rejected } = parseMissions(obj.missions);
      return { missions: items, rejected };
    },
  };
}
