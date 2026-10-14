import type { VehicleView } from '../domain/selectors';
import { missionProgress } from '../domain/selectors';
import { missionLateness } from '../domain/rules';
import { MISSION_STATUS, VEHICLE_STATUS, latenessMeta } from '../domain/status';
import type { Mission, Vehicle } from '../domain/types';
import { formatAge, formatTime } from '../domain/time';
import { StatusBadge } from './StatusBadge';
import { Icon, type IconName } from './Icon';
import { Plate } from './Plate';

export type Selection = { kind: 'vehicle'; id: string } | { kind: 'mission'; id: string } | null;

function EmptyList({ filtered }: { filtered: boolean }) {
  return (
    <div className="empty">
      <Icon name={filtered ? 'filter' : 'truck'} size={26} />
      <p>{filtered ? 'Aucun résultat pour ces filtres.' : 'Rien à afficher pour la journée.'}</p>
    </div>
  );
}

/** Pictogramme d'une tournée selon la nature de ses arrêts. */
export function missionIcon(m: Mission): IconName {
  const kinds = new Set(m.deliveries.map((d) => d.kind).filter(Boolean));
  if (kinds.size === 1) return kinds.has('pickup') ? 'bin' : 'box';
  return 'route';
}

function MiniProgress({ done, total, unknown }: { done: number; total: number; unknown: number }) {
  if (total === 0) return <span className="mini-progress__label">Aucun arrêt</span>;
  if (unknown === total) return <span className="mini-progress__label">{total} arrêt(s)</span>;
  return (
    <span className="mini-progress">
      <span className="mini-progress__track" aria-hidden="true">
        <span style={{ width: `${(done / total) * 100}%` }} />
      </span>
      <span className="mini-progress__label">
        {done}/{total} arrêts
      </span>
    </span>
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
        const meta = VEHICLE_STATUS[v.vehicle.status];
        const late = latenessMeta(v.lateness);
        return (
          <li key={v.vehicle.id}>
            <button
              type="button"
              className={`row ${selected ? 'row--selected' : ''} ${v.needsAction ? 'row--action' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect({ kind: 'vehicle', id: v.vehicle.id })}
            >
              <span className={`tile tile--${meta.tone}`} aria-hidden="true">
                <Icon name="truck" size={20} />
              </span>
              <span className="row__main">
                <span className="row__title">
                  <Plate value={v.vehicle.registration} size="sm" />
                  {v.vehicle.label && <span className="row__label">{v.vehicle.label}</span>}
                </span>
                <span className="row__sub">
                  {v.mission ? (
                    <>
                      {v.missionRole === 'next' ? 'Prochaine : ' : v.missionRole === 'last' ? 'Dernière : ' : ''}
                      {v.mission.label ?? v.mission.reference}
                    </>
                  ) : (
                    <span className="muted">Aucune tournée affectée</span>
                  )}
                </span>
                <span className={`row__meta row__meta--nowrap ${v.freshness !== 'fresh' ? 'text-warn' : ''}`}>
                  <Icon name={v.freshness === 'fresh' ? 'pin' : 'clock'} size={12} />
                  <span>
                    {v.vehicle.position
                      ? `Vu ${formatAge(v.vehicle.position.recordedAt, now)}${v.freshness === 'stale' ? ' · ancienne' : ''}`
                      : 'Position indisponible'}
                  </span>
                </span>
              </span>
              <span className="row__side">
                <StatusBadge meta={meta} srPrefix="État" />
                {late && v.lateness.kind === 'late' && <StatusBadge meta={late} />}
                {v.needsAction && v.lateness.kind !== 'late' && (
                  <span className="flag flag--warn">
                    <span aria-hidden="true">▲</span> À vérifier
                  </span>
                )}
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
    <ul className="list" aria-label="Tournées du jour">
      {missions.map((m) => {
        const selected = selection?.kind === 'mission' && selection.id === m.id;
        const lateness = missionLateness(m, now);
        const late = latenessMeta(lateness);
        const vehicle = m.vehicleId ? vehicles.get(m.vehicleId) : undefined;
        const meta = MISSION_STATUS[m.status];
        const isLate = lateness.kind === 'late' && m.status !== 'completed';
        return (
          <li key={m.id}>
            <button
              type="button"
              className={`row ${selected ? 'row--selected' : ''} ${isLate ? 'row--late' : ''}`}
              aria-pressed={selected}
              onClick={() => onSelect({ kind: 'mission', id: m.id })}
            >
              <span className={`tile tile--${isLate ? 'danger' : meta.tone}`} aria-hidden="true">
                <Icon name={missionIcon(m)} size={20} />
              </span>
              <span className="row__main">
                <span className="row__title row__title--text">{m.label ?? m.reference}</span>
                <span className="row__sub row__sub--inline">
                  {vehicle || m.vehicleId ? (
                    <Plate value={vehicle?.registration ?? m.vehicleId!} size="sm" />
                  ) : (
                    <span className="text-warn">
                      <span aria-hidden="true">⚠ </span>Sans véhicule
                    </span>
                  )}
                  <span className="row__ref">{m.reference}</span>
                </span>
                <span className="row__meta">
                  <Icon name="clock" size={12} />
                  {m.plannedStart ? formatTime(m.plannedStart, now) : '—'}
                  {m.plannedEnd && ` → ${formatTime(m.plannedEnd, now)}`}
                  <MiniProgress {...missionProgress(m)} />
                </span>
              </span>
              <span className="row__side">
                <StatusBadge meta={meta} srPrefix="Tournée" />
                {late && lateness.kind === 'late' && <StatusBadge meta={late} />}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
