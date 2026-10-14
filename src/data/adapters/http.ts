/** Client HTTP minimal vers la passerelle Dispatch (aucun secret côté navigateur). */

/** Codes d'erreur renvoyés par la passerelle (server/index.ts). */
export type GatewayErrorCode =
  | 'not_configured'
  | 'mapping_required'
  | 'auth_failed'
  | 'upstream_error'
  | 'bad_request';

const GATEWAY_MESSAGES: Record<GatewayErrorCode, string> = {
  not_configured: 'Source non configurée sur la passerelle',
  mapping_required: 'Correspondance des champs à configurer sur la passerelle',
  auth_failed: 'Authentification refusée (token expiré ou droits insuffisants)',
  upstream_error: 'Service source indisponible',
  bad_request: 'Requête refusée par la passerelle',
};

export class IntegrationError extends Error {
  constructor(
    public readonly source: string,
    message: string,
    public readonly code?: GatewayErrorCode,
  ) {
    super(message);
    this.name = 'IntegrationError';
  }
}

async function readGatewayCode(res: Response): Promise<GatewayErrorCode | undefined> {
  try {
    const body = (await res.json()) as { error?: { code?: unknown } };
    const code = body.error?.code;
    return typeof code === 'string' && Object.hasOwn(GATEWAY_MESSAGES, code)
      ? (code as GatewayErrorCode)
      : undefined;
  } catch {
    return undefined;
  }
}

export async function getJson(source: string, url: string, signal?: AbortSignal): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' }, signal });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new IntegrationError(source, 'Service injoignable (réseau ou passerelle indisponible)');
  }
  if (!res.ok) {
    // Seul un code d'erreur connu est exploité : le reste du corps n'est jamais affiché.
    const code = await readGatewayCode(res);
    throw new IntegrationError(source, code ? GATEWAY_MESSAGES[code] : `Réponse HTTP ${res.status}`, code);
  }
  try {
    return await res.json();
  } catch {
    throw new IntegrationError(source, 'Réponse illisible (JSON invalide)');
  }
}
