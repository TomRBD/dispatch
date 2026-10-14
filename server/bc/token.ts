/**
 * Token d'accès Business Central.
 *
 * Le token est lu dans token.txt. S'il manque ou a expiré, il est renouvelé :
 * - directement par la passerelle (client credentials Entra ID, mêmes
 *   variables que get_bc_token.py : BC_TOKEN_CLIENT_ID / BC_TOKEN_CLIENT_SECRET) ;
 * - sinon via la commande BC_TOKEN_COMMAND (ex. sur un poste où le script Python
 *   est installé).
 * Sur le VPS, le timer systemd écrit token.txt : aucune des deux n'est requise.
 * Le token n'est jamais journalisé ni renvoyé au navigateur.
 */
import { execFile } from 'node:child_process';
import { chmod, readFile, rename, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { ROOT_DIR, serverConfig } from '../config';

const run = promisify(execFile);

export class TokenError extends Error {}

/** Accepte un token brut ou un JSON contenant access_token. */
export function extractToken(content: string): string | undefined {
  const text = content.trim();
  if (!text) return undefined;
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text) as { access_token?: unknown };
      return typeof parsed.access_token === 'string' ? parsed.access_token.trim() : undefined;
    } catch {
      return undefined;
    }
  }
  return text.replace(/^Bearer\s+/i, '');
}

/** Date d'expiration lue dans le JWT (sans vérification de signature : usage indicatif). */
export function tokenExpiry(token: string): Date | undefined {
  const payload = token.split('.')[1];
  if (!payload) return undefined;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { exp?: unknown };
    return typeof exp === 'number' ? new Date(exp * 1000) : undefined;
  } catch {
    return undefined;
  }
}

const MARGIN_MS = 2 * 60_000;

function isUsable(token: string | undefined, now = Date.now()): token is string {
  if (!token) return false;
  const exp = tokenExpiry(token);
  return !exp || exp.getTime() - MARGIN_MS > now;
}

async function readTokenFile(): Promise<string | undefined> {
  try {
    return extractToken(await readFile(serverConfig.bc.tokenFile, 'utf8'));
  } catch {
    return undefined;
  }
}

let refreshing: Promise<void> | null = null;

/** Même flux que get_bc_token.py, avec écriture atomique de token.txt. */
async function fetchClientCredentialsToken(): Promise<void> {
  const { tenantId, clientId, clientSecret, tokenFile } = serverConfig.bc;
  console.info('[bc] renouvellement du token (client credentials)');
  let res: Response;
  try {
    res = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
        scope: 'https://api.businesscentral.dynamics.com/.default',
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new TokenError('Entra ID injoignable (réseau ou proxy).');
  }
  const body = (await res.json().catch(() => ({}))) as { access_token?: unknown; error?: unknown };
  if (!res.ok || typeof body.access_token !== 'string') {
    // Seul le code d'erreur OAuth est affiché (ex. invalid_client), jamais le secret.
    const code = typeof body.error === 'string' ? body.error : `HTTP ${res.status}`;
    throw new TokenError(`Entra ID a refusé la demande de token (${code}). Vérifiez BC_TOKEN_CLIENT_ID / BC_TOKEN_CLIENT_SECRET.`);
  }
  const tmp = `${tokenFile}.tmp`;
  await writeFile(tmp, body.access_token, 'utf8');
  if (process.platform !== 'win32') await chmod(tmp, 0o600);
  await rename(tmp, tokenFile);
}

async function renewToken(): Promise<void> {
  const { clientId, clientSecret, tokenCommand } = serverConfig.bc;
  if (clientId && clientSecret) return fetchClientCredentialsToken();
  if (tokenCommand) return runTokenCommand(tokenCommand);
  throw new TokenError(
    'Token BC absent ou expiré : renseignez BC_TOKEN_CLIENT_ID et BC_TOKEN_CLIENT_SECRET dans le .env racine.',
  );
}

async function runTokenCommand(command: string): Promise<void> {
  const [file, ...args] = command.split(/\s+/);
  console.info('[bc] renouvellement du token via BC_TOKEN_COMMAND');
  try {
    await run(file!, args, { cwd: ROOT_DIR, timeout: 90_000, windowsHide: true });
  } catch (e) {
    // Sortie de la commande non journalisée : elle peut contenir le token ou le secret.
    const code = (e as { code?: unknown }).code;
    // 9009 (cmd Windows) / ENOENT : programme introuvable (ex. Python non installé).
    if (code === 'ENOENT' || code === 9009) {
      throw new TokenError(`Commande introuvable : « ${file} ». Installez-la ou videz BC_TOKEN_COMMAND.`);
    }
    throw new TokenError(`La commande de renouvellement du token a échoué (code ${String(code)}).`);
  }
}

/** Renvoie un token valide, en le renouvelant si nécessaire. */
export async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const current = await readTokenFile();
    if (isUsable(current)) return current;
  }
  refreshing ??= renewToken().finally(() => (refreshing = null));
  await refreshing;
  const renewed = await readTokenFile();
  if (!isUsable(renewed)) throw new TokenError('Aucun token BC valide dans le fichier après renouvellement.');
  return renewed;
}
