/**
 * Passerelle Agrivalor Dispatch.
 *
 * Seul ce serveur détient les accès Business Central (et plus tard Webfleet).
 * Il expose au navigateur le contrat JSON décrit dans README.md, sans jamais
 * transmettre le token ni le détail des erreurs internes.
 */
import { createServer, type ServerResponse } from 'node:http';
import { bcConfigured, serverConfig, webfleetConfigured } from './config';
import { BC_MAPPING, missingRequired } from './bc/mapping';
import { BcHttpError, fetchEntity } from './bc/odata';
import { TokenError } from './bc/token';
import { mergeMissionRows, transformBc } from './bc/transform';
import { WebfleetError, fetchObjectReport } from './webfleet/client';
import { type ContractVehicle, transformWebfleet } from './webfleet/transform';

type ErrorCode = 'not_configured' | 'mapping_required' | 'auth_failed' | 'upstream_error' | 'bad_request';

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

const fail = (res: ServerResponse, status: number, code: ErrorCode, message: string) =>
  send(res, status, { error: { code, message } });

async function bcMissions(day: string, res: ServerResponse) {
  if (!bcConfigured()) return fail(res, 503, 'not_configured', 'Business Central non configuré');
  const missing = missingRequired(BC_MAPPING);
  if (missing.length) {
    return fail(res, 503, 'mapping_required', 'Correspondance des champs Business Central à configurer');
  }
  const { tourneeEntity, missionEntity, missionDetailEntity } = serverConfig.bc;
  const tourneeDate = BC_MAPPING.tournee.date!;
  const missionDate = BC_MAPPING.mission.date;
  try {
    const missionQuery = missionDate ? { filter: `${missionDate} eq ${day}` } : {};
    const [tournees, missions, details] = await Promise.all([
      fetchEntity(tourneeEntity, { filter: `${tourneeDate} eq ${day}` }),
      // Sans champ date côté mission, on ne garde que celles des tournées du jour (voir transformBc).
      fetchEntity(missionEntity, missionQuery),
      // Détail facultatif : en cas d'échec, les missions restent affichées sans statut ni heures réelles.
      missionDetailEntity
        ? fetchEntity(missionDetailEntity, missionQuery).catch((e: unknown) => {
            console.warn(`[bc] ${missionDetailEntity} indisponible :`, e instanceof Error ? e.message : e);
            return [];
          })
        : Promise.resolve([]),
    ]);
    const merged = mergeMissionRows(missions, details, BC_MAPPING.mission.id!);
    const result = transformBc(tournees, merged, BC_MAPPING);
    if (result.skipped.tournees || result.skipped.missions) {
      console.info(`[bc] ${day} : lignes ignorées`, result.skipped);
    }
    return send(res, 200, { missions: result.missions });
  } catch (e) {
    if (e instanceof TokenError) {
      console.warn('[bc] token :', e.message);
      return fail(res, 502, 'auth_failed', 'Authentification Business Central impossible');
    }
    if (e instanceof BcHttpError && (e.status === 401 || e.status === 403)) {
      return fail(res, 502, 'auth_failed', 'Accès refusé par Business Central');
    }
    console.error('[bc] erreur :', e instanceof Error ? e.message : e);
    return fail(res, 502, 'upstream_error', 'Business Central indisponible');
  }
}

// WEBFLEET.connect limite showObjectReportExtern à 6 requêtes / minute : cache partagé.
const FLEET_TTL_MS = 30_000;
let fleetCache: { at: number; vehicles: ContractVehicle[] } | null = null;
let fleetInflight: Promise<ContractVehicle[]> | null = null;

async function loadFleet(): Promise<ContractVehicle[]> {
  if (fleetCache && Date.now() - fleetCache.at < FLEET_TTL_MS) return fleetCache.vehicles;
  fleetInflight ??= fetchObjectReport()
    .then((rows) => {
      const vehicles = transformWebfleet(rows, serverConfig.webfleet.showDriverNames);
      fleetCache = { at: Date.now(), vehicles };
      return vehicles;
    })
    .finally(() => (fleetInflight = null));
  return fleetInflight;
}

async function webfleetFleet(res: ServerResponse) {
  if (!webfleetConfigured()) return fail(res, 503, 'not_configured', 'Webfleet non configuré');
  try {
    return send(res, 200, { vehicles: await loadFleet() });
  } catch (e) {
    console.error('[webfleet]', e instanceof Error ? e.message : e);
    if (e instanceof WebfleetError && e.kind === 'auth') {
      return fail(res, 502, 'auth_failed', 'Accès refusé par Webfleet');
    }
    return fail(res, 502, 'upstream_error', 'Webfleet indisponible');
  }
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const path = url.pathname.replace(/^\/api/, '');
  if (req.method !== 'GET') return fail(res, 405, 'bad_request', 'Méthode non autorisée');

  if (path === '/health') return send(res, 200, { ok: true });

  if (path === '/business-central/missions') {
    const day = url.searchParams.get('date') ?? '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return fail(res, 400, 'bad_request', 'Paramètre date invalide');
    return void bcMissions(day, res);
  }

  if (path === '/webfleet/fleet') return void webfleetFleet(res);

  return fail(res, 404, 'bad_request', 'Route inconnue');
});

server.listen(serverConfig.port, '127.0.0.1', () => {
  console.info(`Passerelle Dispatch : http://127.0.0.1:${serverConfig.port}`);
  console.info(`Business Central : ${bcConfigured() ? 'configuré' : 'non configuré'}`);
  console.info(`Webfleet : ${webfleetConfigured() ? 'configuré' : 'non configuré'}`);
  const missing = missingRequired(BC_MAPPING);
  if (missing.length) console.info(`Correspondance BC incomplète : ${missing.join(', ')} (npm run bc:inspect)`);
});
