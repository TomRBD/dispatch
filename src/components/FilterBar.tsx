import { MISSION_STATUS, VEHICLE_STATUS } from '../domain/status';
import type { MissionStatus, VehicleStatus } from '../domain/types';
import { type Filters, EMPTY_FILTERS, isFiltered } from './filters';
import { Icon } from './Icon';

interface Props {
  filters: Filters;
  onChange: (f: Filters) => void;
  /** Statuts réellement présents : on ne propose pas de filtre sans données. */
  vehicleStatuses: VehicleStatus[];
  missionStatuses: MissionStatus[];
  hasLate: boolean;
  hasAction: boolean;
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterBar({ filters, onChange, vehicleStatuses, missionStatuses, hasLate, hasAction }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  return (
    <div className="filters">
      <div className="search">
        <Icon name="search" size={16} />
        <label htmlFor="search" className="sr-only">
          Rechercher un véhicule, une mission ou une référence
        </label>
        <input
          id="search"
          type="search"
          placeholder="Immatriculation, mission, BL, client…"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          autoComplete="off"
        />
      </div>

      {vehicleStatuses.length > 0 && (
        <fieldset className="chips">
          <legend className="chips__legend">Véhicules</legend>
          {vehicleStatuses.map((s) => (
            <label key={s} className="chip">
              <input
                type="checkbox"
                checked={filters.vehicleStatuses.includes(s)}
                onChange={() => set({ vehicleStatuses: toggle(filters.vehicleStatuses, s) })}
              />
              <span aria-hidden="true">{VEHICLE_STATUS[s].glyph}</span> {VEHICLE_STATUS[s].label}
            </label>
          ))}
        </fieldset>
      )}

      {missionStatuses.length > 0 && (
        <fieldset className="chips">
          <legend className="chips__legend">Missions</legend>
          {missionStatuses.map((s) => (
            <label key={s} className="chip">
              <input
                type="checkbox"
                checked={filters.missionStatuses.includes(s)}
                onChange={() => set({ missionStatuses: toggle(filters.missionStatuses, s) })}
              />
              <span aria-hidden="true">{MISSION_STATUS[s].glyph}</span> {MISSION_STATUS[s].label}
            </label>
          ))}
        </fieldset>
      )}

      {(hasLate || hasAction) && (
        <fieldset className="chips">
          <legend className="chips__legend">Priorités</legend>
          {hasLate && (
            <label className="chip chip--danger">
              <input type="checkbox" checked={filters.lateOnly} onChange={(e) => set({ lateOnly: e.target.checked })} />
              <span aria-hidden="true">!</span> En retard
            </label>
          )}
          {hasAction && (
            <label className="chip chip--warn">
              <input
                type="checkbox"
                checked={filters.actionOnly}
                onChange={(e) => set({ actionOnly: e.target.checked })}
              />
              <span aria-hidden="true">▲</span> Action requise
            </label>
          )}
        </fieldset>
      )}

      {isFiltered(filters) && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onChange(EMPTY_FILTERS)}>
          <Icon name="close" size={14} /> Revenir à la vue complète
        </button>
      )}
    </div>
  );
}
