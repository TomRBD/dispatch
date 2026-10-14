import type { VehicleView } from '../domain/selectors';
import { missionProgress } from '../domain/selectors';
import { missionLateness } from '../domain/rules';
import { MISSION_STATUS, VEHICLE_STATUS, latenessMeta } from '../domain/status';
import type { Mission, Vehicle } from '../domain/types';
import { formatAge, formatTime } from '../domain/time';
import { StatusBadge } from './StatusBadge';
import { Icon } from './Icon';

export type Selection = { kind: 'vehicle'; id: string } | { kind: 'mission'; id: string } | null;

function EmptyList({ filtered }: { filtered: boolean }) {
  return (
    <p className="empty">
      {filtered ? 'Aucun résultat pour ces filtres.' : 'Aucun élément à afficher pour la journée.'}
    </p>
  );
}

export function VehicleList({
  views,
  now,
  selection,
  onSelect,
  filtered,
}: {
  views: VehicleView[];
  now: Date;
  selection: Selection;
  onSelect: (s: Selection) => void;
  filtered: boolean;
}) {
  if (views.length === 0) return <EmptyList filtered={filtered} />;
  return (
    <ul className="list" aria-label="Véhicules">
      {views.map((v) => {
        const selected = selection?.kind === 'vehicle' && selection.id === v.vehicle.id;
        const late = latenessMeta(v.lateness);
        return (
          <li key={v.vehicle.id}>
            <button
              type="button"
              className={`row ${selected ? 'row--selected' : ''} ${v.needsAction ? 'row--action' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect({ kind: 'vehicle', id: v.vehicle.id })}
            >
              <span className="row__main">
                <span className="row__title">
                  {v.vehicle.registration}
                  {v.needsAction && (
                    <span className="flag flag--warn">
                      <span aria-hidden="true">▲</span> Action requise
                    </span>
                  )}
                </span>
                <span className="row__sub">
                  {v.mission ? (
                    <>
                      {v.missionRole === 'next' ? 'Prochaine : ' : v.missionRole === 'last' ? 'Dernière : ' : ''}
                      {v.mission.label ?? v.mission.reference}
                    </>
                  ) : (
                    'Aucune mission affectée'
                  )}
                </span>
                <span className="row__meta">
                  <Icon name="pin" size={12} />{' '}
                  {v.vehicle.position ? (
                    <span className={v.freshness === 'stale' ? 'text-warn' : undefined}>
                      {v.freshness === 'stale' && <span aria-hidden="true">⚠ </span>}
                      Position {formatAge(v.vehicle.position.recordedAt, now)}
                      {v.freshness === 'stale' && ' (ancienne)'}
                    </span>
                  ) : (
                    <span className="text-warn">⚠ Position indisponible</span>
                  )}
                </span>
              </span>
              <span className="row__side">
                <StatusBadge meta={VEHICLE_STATUS[v.vehicle.status]} srPrefix="État" />
                {late && v.lateness.kind !== 'on_time' && <StatusBadge meta={late} />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function MissionList({
  missions,
  vehicles,
  now,
  selection,
  onSelect,
  filtered,
}: {
  missions: Mission[];
  vehicles: Map<string, Vehicle>;
  now: Date;
  selection: Selection;
  onSelect: (s: Selection) => void;
  filtered: boolean;
}) {
  if (missions.length === 0) return <EmptyList filtered={filtered} />;
  return (
    <ul className="list" aria-label="Missions du jour">
      {missions.map((m) => {
        const selected = selection?.kind === 'mission' && selection.id === m.id;
        const lateness = missionLateness(m, now);
        const late = latenessMeta(lateness);
        const vehicle = m.vehicleId ? vehicles.get(m.vehicleId) : undefined;
        const p = missionProgress(m);
        return (
          <li key={m.id}>
            <button
              type="button"
              className={`row ${selected ? 'row--selected' : ''} ${lateness.kind === 'late' && m.status !== 'completed' ? 'row--late' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect({ kind: 'mission', id: m.id })}
            >
              <span className="row__main">
                <span className="row__title">
                  {m.label ?? m.reference}
                  <span className="row__ref">{m.reference}</span>
                </span>
                <span className="row__sub">
                  {vehicle ? (
                    vehicle.registration
                  ) : m.vehicleId ? (
                    `${m.vehicleId} (sans données télématiques)`
                  ) : (
                    <span className="text-warn">
                      <span aria-hidden="true">⚠ </span>Non affectée à un véhicule
                    </span>
                  )}
                  {' · '}
                  {p.unknown === p.total && p.total > 0
                    ? `${p.total} arrêt(s)`
                    : `${p.done}/${p.total} arrêt(s)`}
                </span>
                <span className="row__meta">
                  <Icon name="clock" size={12} />{' '}
                  {m.plannedStart ? `Prévu ${formatTime(m.plannedStart, now)}` : 'Horaire prévu non renseigné'}
                  {m.plannedEnd && ` → ${formatTime(m.plannedEnd, now)}`}
                </span>
              </span>
              <span className="row__side">
                <StatusBadge meta={MISSION_STATUS[m.status]} srPrefix="Mission" />
                {late && lateness.kind !== 'on_time' && <StatusBadge meta={late} />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
