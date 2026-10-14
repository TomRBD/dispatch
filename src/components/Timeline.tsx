import { buildMissionTimeline, countMissingTimestamps } from '../domain/timeline';
import type { Mission, OpsEvent } from '../domain/types';
import { formatTime, minutesBetween, formatDuration } from '../domain/time';

const TYPE_GLYPH: Record<OpsEvent['type'], string> = {
  departure: '⇢',
  arrival: '⌖',
  delivery: '✓',
  delay: '!',
  mission_end: '⚑',
};

function eventState(e: OpsEvent): 'done' | 'pending' | 'delay' | 'missing' | 'uncertain' {
  if (e.type === 'delay') return 'delay';
  if (e.pending) return 'pending';
  if (e.uncertain) return 'uncertain';
  return e.actualAt ? 'done' : 'missing';
}

export function Timeline({ mission, now }: { mission: Mission; now: Date }) {
  const events = buildMissionTimeline(mission, now);
  const missing = countMissingTimestamps(events.filter((e) => e.type !== 'delay'));

  return (
    <section className="timeline" aria-label={`Timeline de la mission ${mission.reference}`}>
      <h3 className="section-title">Déroulement de la mission</h3>
      {missing > 0 && (
        <p className="notice notice--warn">
          <span aria-hidden="true">⚠ </span>
          {missing} événement(s) réalisé(s) sans horodatage réel : la chronologie est incomplète.
        </p>
      )}
      <ol className="timeline__list">
        {events.map((e) => {
          const state = eventState(e);
          const drift =
            e.actualAt && e.plannedAt && e.type !== 'delay' ? minutesBetween(e.plannedAt, e.actualAt) : undefined;
          return (
            <li key={e.id} className={`tl tl--${state}`}>
              <span className="tl__dot" aria-hidden="true">
                {TYPE_GLYPH[e.type]}
              </span>
              <div className="tl__body">
                <p className="tl__label">{e.label}</p>
                <p className="tl__times">
                  {e.actualAt && (
                    <span>
                      <span className="sr-only">Heure </span>
                      {e.type === 'delay' ? 'Depuis' : 'Réel'} <strong>{formatTime(e.actualAt, now)}</strong>
                    </span>
                  )}
                  {e.plannedAt && (
                    <span className="tl__planned">
                      {e.type === 'delay' ? 'Fin de créneau' : 'Prévu'} {formatTime(e.plannedAt, now)}
                    </span>
                  )}
                  {drift !== undefined && Math.abs(drift) >= 5 && (
                    <span className={drift > 0 ? 'text-danger' : 'text-ok'}>
                      ({drift > 0 ? '+' : '−'}
                      {formatDuration(drift)})
                    </span>
                  )}
                  {state === 'pending' && <span className="tl__tag">À venir</span>}
                  {state === 'missing' && <span className="tl__tag tl__tag--warn">Horodatage manquant</span>}
                  {state === 'uncertain' && <span className="tl__tag">Réalisation non confirmée par la source</span>}
                  {!e.actualAt && !e.plannedAt && state === 'pending' && (
                    <span className="tl__planned">Aucun horaire prévu</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
