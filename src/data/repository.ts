/**
 * Point d'entrée unique des données. L'interface ne connaît que
 * `DispatchRepository` ; brancher les intégrations réelles se fait ici, sans
 * toucher aux composants.
 */
import type { DispatchSnapshot, Mission, SourceState } from '../domain/types';
import { createBusinessCentralAdapter } from './adapters/businessCentral';
import { IntegrationError } from './adapters/http';
import { createWebfleetAdapter } from './adapters/webfleet';
import { config } from './config';
import { buildDemoData } from './demo/demoData';

export interface DispatchRepository {
  readonly mode: 'demo' | 'live';
  load(signal?: AbortSignal): Promise<DispatchSnapshot>;
}

function opsDay(d: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(d);
}

function failedState(e: unknown): SourceState {
  if (e instanceof IntegrationError && e.code === 'not_configured') return { kind: 'not-configured' };
  return {
    kind: 'error',
    message: e instanceof IntegrationError ? e.message : 'Erreur inattendue lors du chargement',
  };
}

export function createDemoRepository(): DispatchRepository {
  return {
    mode: 'demo',
    async load() {
      // Léger délai pour rendre visibles les états de chargement.
      await new Promise((r) => setTimeout(r, 350));
      const now = new Date();
      const { vehicles, missions } = buildDemoData(now);
      const demo: SourceState = { kind: 'ok', origin: 'demo', fetchedAt: now };
      return { vehicles, missions, sources: { webfleet: demo, businessCentral: demo }, loadedAt: now };
    },
  };
}

export function createLiveRepository(baseUrl: string): DispatchRepository {
  const webfleet = createWebfleetAdapter(baseUrl);
  const bc = createBusinessCentralAdapter(baseUrl);

  return {
    mode: 'live',
    async load(signal) {
      const now = new Date();
      const [fleet, orders] = await Promise.allSettled([
        webfleet.fetchFleet(signal),
        bc.fetchMissions(opsDay(now), signal),
      ]);
      signal?.throwIfAborted();

      const sources: DispatchSnapshot['sources'] = {
        webfleet:
          fleet.status === 'fulfilled'
            ? { kind: 'ok', origin: 'live', fetchedAt: new Date(), rejected: fleet.value.rejected }
            : failedState(fleet.reason),
        businessCentral:
          orders.status === 'fulfilled'
            ? { kind: 'ok', origin: 'live', fetchedAt: new Date(), rejected: orders.value.rejected }
            : failedState(orders.reason),
      };

      const vehicles = fleet.status === 'fulfilled' ? fleet.value.vehicles : [];
      const distances = fleet.status === 'fulfilled' ? fleet.value.missionDistances : new Map();
      const missions: Mission[] =
        orders.status === 'fulfilled'
          ? orders.value.missions.map((m) =>
              m.actualDistanceKm === undefined && distances.has(m.id)
                ? { ...m, actualDistanceKm: distances.get(m.id) }
                : m,
            )
          : [];

      return { vehicles, missions, sources, loadedAt: now };
    },
  };
}

export function createRepository(): DispatchRepository {
  return config.apiBaseUrl ? createLiveRepository(config.apiBaseUrl) : createDemoRepository();
}
