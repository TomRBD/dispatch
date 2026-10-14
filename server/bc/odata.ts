/** Lecture OData V4 Business Central avec pagination et renouvellement du token sur 401. */
import { bcODataBase } from '../config';
import { getToken } from './token';

export class BcHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function get(url: string, token: string): Promise<Response> {
  try {
    return await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new BcHttpError(0, 'Business Central injoignable (réseau, proxy ou délai dépassé)');
  }
}

async function getWithAuth(url: string): Promise<Response> {
  let res = await get(url, await getToken());
  if (res.status === 401) res = await get(url, await getToken(true));
  if (!res.ok) {
    throw new BcHttpError(res.status, `Business Central a répondu HTTP ${res.status}`);
  }
  return res;
}

export interface ODataQuery {
  filter?: string;
  top?: number;
}

/** Récupère toutes les lignes d'une entité (suit @odata.nextLink). */
export async function fetchEntity(entity: string, query: ODataQuery = {}): Promise<Record<string, unknown>[]> {
  const params = new URLSearchParams();
  if (query.filter) params.set('$filter', query.filter);
  if (query.top) params.set('$top', String(query.top));
  const qs = params.toString();
  let url: string | undefined = `${bcODataBase()}/${encodeURIComponent(entity)}${qs ? `?${qs}` : ''}`;
  const rows: Record<string, unknown>[] = [];
  let pages = 0;
  while (url && pages < 50) {
    const body = (await (await getWithAuth(url)).json()) as { value?: unknown; '@odata.nextLink'?: unknown };
    if (Array.isArray(body.value)) rows.push(...(body.value as Record<string, unknown>[]));
    url = query.top ? undefined : typeof body['@odata.nextLink'] === 'string' ? body['@odata.nextLink'] : undefined;
    pages += 1;
  }
  return rows;
}

/** Métadonnées OData ($metadata) en XML. */
export async function fetchMetadata(): Promise<string> {
  const root = bcODataBase().replace(/\/Company\(.*\)$/, '');
  return (await getWithAuth(`${root}/$metadata`)).text();
}
