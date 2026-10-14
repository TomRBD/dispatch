import { buildMissionTimeline, countMissingTimestamps } from '../domain/timeline';
import type { Mission, OpsEvent } from '../domain/types';
import { formatDuration, formatTime, minutesBetween } from '../domain/time';
import { Icon, type IconName } from './Icon';

type RowState = 'done' | 'pending' | 'delay' | 'missing' | 'uncertain';

interface Row {
  key: string;
  icon: IconName;
  label: string;
  state: RowState;
  /** Heure réelle (ou début réel pour un arrêt). */
  actual?: Date;
  /** Fin réelle d'un arrêt. */
  actualEnd?: Date;
  planned?: Date;
  plannedLabel: string;
}

function stateOf(e: OpsEvent): RowState {
  if (e.type === 'delay') return 'delay';
  if (e.pending) return 'pending';
  if (e.uncertain) return 'uncertain';
  // Départ / fin de tournée sans heure réelle : seule l'heure prévue est connue, sans alerte.
  if (!e.actualAt && !e.deliveryId) return 'pending';
  return e.actualAt ? 'done' : 'missing';
}

/** Regroupe arrivée + fin d'un même arrêt sur une seule ligne. */
function toRows(events: OpsEvent[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === 'arrival') {
      const done = events.slice(i + 1).find((x) => x.type === 'delivery' && x.deliveryId === e.deliveryId);
      const label = (done?.label ?? e.label).replace(/^Arrivée sur site — /, '');
      const state = done ? stateOf(done) : stateOf(e);
      rows.push({
        key: e.id,
        icon: label.startsWith('Collecte') ? 'bin' : label.startsWith('Livraison') ? 'box' : 'pin',
        label,
        state: state === 'missing' && e.actualAt ? 'done' : state,
        actual: e.actualAt ?? done?.actualAt,
        actualEnd: e.actualAt ? done?.actualAt : undefined,
        planned: done?.plannedAt ?? e.plannedAt,
        plannedLabel: 'Demandé',
      });
      continue;
    }
    if (e.type === 'delivery' && events.some((x) => x.type === 'arrival' && x.deliveryId === e.deliveryId)) continue;
    rows.push({
      key: e.id,
      icon: e.type === 'departure' ? 'truck' : e.type === 'mission_end' ? 'flag' : e.type === 'delay' ? 'alert' : 'pin',
      label: e.label,
      state: stateOf(e),
      actual: e.actualAt,
      planned: e.plannedAt,
      plannedLabel: e.type === 'delay' ? 'Fin prévue' : 'Prévu',
    });
  }
  return rows;
}

export function Timeline({ mission, now }: { mission: Mission; now: Date }) {
  const events = buildMissionTimeline(mission, now);
  const missing = countMissingTimestamps(events.filter((e) => e.type !== 'delay'));
  const rows = toRows(events);

  return (
    <section className="timeline" aria-label={`Déroulement de la tournée ${mission.reference}`}>
      <h3 className="section-title">Déroulement</h3>
      {missing > 0 && (
        <p className="notice notice--warn">
          <Icon name="alert" size={14} />
          <span>{missing} arrêt(s) réalisé(s) sans heure réelle : chronologie incomplète.</span>
        </p>
      )}
      <ol className="tl-list">
        {rows.map((r) => {
          const drift =
            r.actual && r.planned && r.state !== 'delay' ? minutesBetween(r.planned, r.actual) : undefined;
          return (
            <li key={r.key} className={`tl tl--${r.state}`}>
              <span className="tl__time">
                {r.actual ? (
                  <>
                    <span className="sr-only">{r.state === 'delay' ? 'Depuis' : 'Réel'} </span>
                    {formatTime(r.actual, now)}
                  </>
                ) : r.planned ? (
                  <span className="tl__time--planned">
                    <span className="sr-only">Prévu </span>
                    {formatTime(r.planned, now)}
                  </span>
                ) : (
                  <span aria-hidden="true">—</span>
                )}
              </span>
              <span className="tl__dot" aria-hidden="true">
                <Icon name={r.state === 'done' ? 'check' : r.icon} size={12} strokeWidth={2.6} />
              </span>
              <div className="tl__body">
                <p className="tl__label">{r.label}</p>
                <p className="tl__meta">
                  {r.actualEnd && r.actual && (
                    <span>
                      jusqu'à {formatTime(r.actualEnd, now)} · {formatDuration(minutesBetween(r.actual, r.actualEnd))}
                    </span>
                  )}
                  {r.actual && r.planned && (
                    <span className="tl__planned">
                      {r.plannedLabel} {formatTime(r.planned, now)}
                    </span>
                  )}
                  {drift !== undefined && Math.abs(drift) >= 5 && (
                    <span className={drift > 0 ? 'text-danger' : 'text-ok'}>
                      {drift > 0 ? '+' : '−'}
                      {formatDuration(drift)}
                    </span>
                  )}
                  {!r.actual && r.planned && r.state !== 'delay' && <span className="tl__planned">prévu</span>}
                  {r.state === 'missing' && <span className="tl__tag tl__tag--warn">Heure réelle manquante</span>}
                  {r.state === 'uncertain' && <span className="tl__tag">Non confirmé</span>}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
