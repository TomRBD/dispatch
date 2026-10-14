/** Configuration serveur lue depuis server/.env (secrets inclus — jamais exposés au navigateur). */
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// .env racine (partagé avec get_bc_token.py), puis server/.env qui le complète.
for (const file of ['.env', 'server/.env']) {
  const path = resolve(ROOT_DIR, file);
  if (existsSync(path)) process.loadEnvFile(path);
}

const env = (key: string, fallback = '') => (process.env[key] ?? fallback).trim();

export const serverConfig = {
  port: Number(env('PORT', '8787')) || 8787,
  bc: {
    tenantId: env('BC_TENANT_ID'),
    environment: env('BC_ENVIRONMENT', 'Production'),
    company: env('BC_COMPANY'),
    tourneeEntity: env('BC_TOURNEE_ENTITY', 'Tournee_Excel'),
    missionEntity: env('BC_MISSION_ENTITY', 'Mission_Excel'),
    tokenFile: resolve(ROOT_DIR, env('BC_TOKEN_FILE', 'token.txt')),
    tokenCommand: env('BC_TOKEN_COMMAND'),
    // Mêmes variables que get_bc_token.py (.env racine).
    clientId: env('BC_TOKEN_CLIENT_ID'),
    clientSecret: env('BC_TOKEN_CLIENT_SECRET'),
  },
};

export function bcConfigured(): boolean {
  return Boolean(serverConfig.bc.tenantId && serverConfig.bc.company);
}

/** URL racine OData V4 de la société. */
export function bcODataBase(): string {
  const { tenantId, environment, company } = serverConfig.bc;
  const companyLiteral = company.replace(/'/g, "''");
  return `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(tenantId)}/${encodeURIComponent(
    environment,
  )}/ODataV4/Company('${encodeURIComponent(companyLiteral)}')`;
}
