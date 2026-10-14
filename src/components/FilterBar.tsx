import { useState } from 'react';
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

/**
 * Recherche + priorités toujours visibles ; filtres par état repliés derrière
 * un bouton, pour laisser la place à la liste.
 */
export function FilterBar({ filters, onChange, vehicleStatuses, missionStatuses, hasLate, hasAction }: Props) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const statusCount = filters.vehicleStatuses.length + filters.missionStatuses.length;
  const [open, setOpen] = useState(statusCount > 0);
  const hasStatusFilters = vehicleStatuses.length > 0 || missionStatuses.length > 0;

  return (
    <div className="filters">
      <div className="search">
        <Icon name="search" size={16} />
        <label htmlFor="search" className="sr-only">
          Rechercher une plaque, une tournée, un client ou une ville
        </label>
        <input
          id="search"
          type="search"
          placeholder="Plaque, tournée, client, ville…"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          autoComplete="off"
        />
      </div>

      <div className="filters__bar">
        {hasLate && (
          <label className="chip chip--danger">
            <input type="checkbox" checked={filters.lateOnly} onChange={(e) => set({ lateOnly: e.target.checked })} />
            En retard
          </label>
        )}
        {hasAction && (
          <label className="chip chip--warn">
            <input type="checkbox" checked={filters.actionOnly} onChange={(e) => set({ actionOnly: e.target.checked })} />
            À vérifier
          </label>
        )}
        {hasStatusFilters && (
          <button
            type="button"
            className={`chip chip--toggle ${open ? 'is-open' : ''}`}
            aria-expanded={open}
            aria-controls="status-filters"
            onClick={() => setOpen(!open)}
          >
            <Icon name="filter" size={13} />
            États{statusCount > 0 && <span className="chip__count">{statusCount}</span>}
          </button>
        )}
        {isFiltered(filters) && (
          <button type="button" className="filters__reset" onClick={() => onChange(EMPTY_FILTERS)}>
            Tout afficher
          </button>
        )}
      </div>

      {open && hasStatusFilters && (
        <div id="status-filters" className="filters__more">
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
                  {VEHICLE_STATUS[s].label}
                </label>
              ))}
            </fieldset>
          )}
          {missionStatuses.length > 0 && (
            <fieldset className="chips">
              <legend className="chips__legend">Tournées</legend>
              {missionStatuses.map((s) => (
                <label key={s} className="chip">
                  <input
                    type="checkbox"
                    checked={filters.missionStatuses.includes(s)}
                    onChange={() => set({ missionStatuses: toggle(filters.missionStatuses, s) })}
                  />
                  {MISSION_STATUS[s].label}
                </label>
              ))}
            </fieldset>
          )}
        </div>
      )}
    </div>
  );
}
