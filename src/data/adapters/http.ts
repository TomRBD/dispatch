/** Client HTTP minimal vers la passerelle Dispatch (aucun secret côté navigateur). */

export class IntegrationError extends Error {
  constructor(
    public readonly source: string,
    message: string,
  ) {
    super(message);
    this.name = 'IntegrationError';
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
    // Le corps de réponse n'est pas affiché : il peut contenir des détails internes.
    throw new IntegrationError(source, `Réponse HTTP ${res.status}`);
  }
  try {
    return await res.json();
  } catch {
    throw new IntegrationError(source, 'Réponse illisible (JSON invalide)');
  }
}
