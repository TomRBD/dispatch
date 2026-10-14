/**
 * Token d'accès Business Central.
 *
 * Le token est lu dans token.txt (produit par get_bc_token.py). S'il manque
 * ou a expiré, la commande BC_TOKEN_COMMAND est lancée une fois pour le
 * renouveler. Le token n'est jamais journalisé ni renvoyé au navigateur.
 */
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
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

async function runTokenCommand(): Promise<void> {
  const command = serverConfig.bc.tokenCommand;
  if (!command) throw new TokenError('Token BC absent ou expiré, et BC_TOKEN_COMMAND non configuré.');
  const [file, ...args] = command.split(/\s+/);
  console.info('[bc] renouvellement du token via BC_TOKEN_COMMAND');
  try {
    await run(file!, args, { cwd: ROOT_DIR, timeout: 90_000, windowsHide: true });
  } catch (e) {
    // Sortie de la commande non journalisée : elle peut contenir le token ou le secret.
    const code = (e as { code?: unknown }).code;
    throw new TokenError(`La commande de renouvellement du token a échoué (code ${String(code)}).`);
  }
}

/** Renvoie un token valide, en le renouvelant si nécessaire. */
export async function getToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const current = await readTokenFile();
    if (isUsable(current)) return current;
  }
  refreshing ??= runTokenCommand().finally(() => (refreshing = null));
  await refreshing;
  const renewed = await readTokenFile();
  if (!isUsable(renewed)) throw new TokenError('Aucun token BC valide dans le fichier après renouvellement.');
  return renewed;
}
