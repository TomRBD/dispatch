/**
 * WEBFLEET.connect — action showObjectReportExtern (dernière position connue
 * de chaque véhicule). Les identifiants restent côté serveur ; les erreurs ne
 * renvoient jamais l'URL (qui contient le mot de passe et la clé API).
 */
import { serverConfig } from '../config';

export class WebfleetError extends Error {
  constructor(
    message: string,
    public readonly kind: 'auth' | 'upstream',
  ) {
    super(message);
  }
}

export async function fetchObjectReport(): Promise<Record<string, unknown>[]> {
  const w = serverConfig.webfleet;
  const params = new URLSearchParams({
    account: w.account,
    username: w.username,
    password: w.password,
    apikey: w.apiKey,
    lang: 'fr',
    action: 'showObjectReportExtern',
    outputformat: 'json',
    useISO8601: 'true',
  });
  let res: Response;
  try {
    res = await fetch(`${w.baseUrl}/extern?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new WebfleetError('Webfleet injoignable (réseau, proxy ou délai dépassé)', 'upstream');
  }
  if (!res.ok) throw new WebfleetError(`Webfleet a répondu HTTP ${res.status}`, 'upstream');

  const body: unknown = await res.json().catch(() => undefined);
  if (Array.isArray(body)) return body.filter((r): r is Record<string, unknown> => typeof r === 'object' && r !== null);

  // En cas d'erreur, WEBFLEET.connect renvoie un objet { errorCode, errorMsg } avec un HTTP 200.
  const err = (body ?? {}) as { errorCode?: unknown; errorMsg?: unknown };
  const code = Number(err.errorCode);
  if (Number.isFinite(code)) {
    const msg = typeof err.errorMsg === 'string' ? err.errorMsg : '';
    const auth = /auth|password|passwor|apikey|api key|account|user|login|permission|right/i.test(msg);
    throw new WebfleetError(`Webfleet erreur ${code}${msg ? ` : ${msg}` : ''}`, auth ? 'auth' : 'upstream');
  }
  throw new WebfleetError('Réponse Webfleet inattendue', 'upstream');
}
