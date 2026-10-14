import type { DispatchSnapshot, SourceId, SourceState } from '../domain/types';
import { formatAge, formatDay, formatTime } from '../domain/time';
import { Icon } from './Icon';

interface Props {
  mode: 'demo' | 'live';
  snapshot: DispatchSnapshot | null;
  now: Date;
  loading: boolean;
  onRefresh: () => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (on: boolean) => void;
  refreshIntervalS: number;
}

const SOURCE_LABEL: Record<SourceId, string> = {
  webfleet: 'Webfleet',
  businessCentral: 'Business Central',
};

function SourcePill({ id, state }: { id: SourceId; state: SourceState }) {
  const name = SOURCE_LABEL[id];
  if (state.kind === 'ok') {
    const demo = state.origin === 'demo';
    return (
      <li className={`source source--${demo ? 'demo' : 'ok'}`}>
        <span aria-hidden="true">{demo ? '◇' : '●'}</span> {name} :{' '}
        {demo ? 'non connecté (démo)' : 'connecté'}
        {!!state.rejected && (
          <span className="source__warn"> · {state.rejected} enregistrement(s) écarté(s)</span>
        )}
      </li>
    );
  }
  if (state.kind === 'error') {
    return (
      <li className="source source--error">
        <span aria-hidden="true">✕</span> {name} : erreur — {state.message}
      </li>
    );
  }
  return (
    <li className="source source--muted">
      <span aria-hidden="true">○</span> {name} : non configuré
    </li>
  );
}

export function Header(p: Props) {
  const loadedAt = p.snapshot?.loadedAt;
  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__logo" aria-hidden="true">
          <Icon name="truck" size={22} />
        </span>
        <div>
          <h1 className="topbar__title">
            <span className="topbar__company">Agrivalor</span> Dispatch
          </h1>
          <p className="topbar__day">{formatDay(p.now)}</p>
        </div>
      </div>

      {p.snapshot && (
        <ul className="topbar__sources" aria-label="État des sources de données">
          <SourcePill id="webfleet" state={p.snapshot.sources.webfleet} />
          <SourcePill id="businessCentral" state={p.snapshot.sources.businessCentral} />
        </ul>
      )}

      <div className="topbar__refresh">
        <p className="freshness" aria-live="polite">
          {p.loading ? (
            'Chargement…'
          ) : loadedAt ? (
            <>
              Données chargées à <strong>{formatTime(loadedAt, p.now)}</strong>{' '}
              <span className="freshness__age">({formatAge(loadedAt, p.now)})</span>
            </>
          ) : (
            'Aucune donnée chargée'
          )}
        </p>
        <button type="button" className={`btn btn--primary ${p.loading ? 'is-loading' : ''}`} onClick={p.onRefresh} disabled={p.loading}>
          <Icon name="refresh" size={16} /> Actualiser
        </button>
        {p.refreshIntervalS > 0 && (
          <label className="toggle">
            <input
              type="checkbox"
              checked={p.autoRefresh}
              onChange={(e) => p.onAutoRefreshChange(e.target.checked)}
            />
            Auto ({p.refreshIntervalS} s)
          </label>
        )}
      </div>

      {p.mode === 'demo' && (
        <p className="demo-banner" role="note">
          <Icon name="info" size={16} />
          <span>
            <strong>Mode démonstration</strong> — toutes les données affichées (véhicules,
            positions, clients, références) sont <strong>fictives</strong>. Aucune connexion à
            Webfleet ni à Business Central n'est configurée.
          </span>
        </p>
      )}
    </header>
  );
}
