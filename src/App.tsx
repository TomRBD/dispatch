import { useEffect, useMemo, useRef, useState } from 'react';
import { config } from './data/config';
import { createRepository } from './data/repository';
import { useDispatchData, useNow } from './data/useDispatchData';
import { buildVehicleViews, computeKpis } from './domain/selectors';
import { isLate, missionLateness } from './domain/rules';
import type { MissionStatus, VehicleStatus } from './domain/types';
import { DetailEmpty, MissionSheet, VehicleSheet } from './components/DetailPanel';
import { DistancePanel } from './components/DistancePanel';
import { FilterBar } from './components/FilterBar';
import { EMPTY_FILTERS, type Filters, isFiltered, matchesMission, matchesVehicle } from './components/filters';
import { FleetMap } from './components/FleetMap';
import { Header } from './components/Header';
import { KpiStrip } from './components/KpiStrip';
import { MissionList, type Selection, VehicleList } from './components/Lists';
import { Icon } from './components/Icon';

const repository = createRepository();

const VEHICLE_ORDER: VehicleStatus[] = ['driving', 'stopped', 'ignition_off', 'unknown'];
const MISSION_ORDER: MissionStatus[] = ['in_progress', 'planned', 'completed', 'cancelled', 'unknown'];

export function App() {
  const data = useDispatchData(repository, config.refreshIntervalS);
  const clock = useNow();
  // Les calculs utilisent l'heure la plus récente entre l'horloge et le chargement.
  const now = data.snapshot && data.snapshot.loadedAt > clock ? data.snapshot.loadedAt : clock;
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [selection, setSelection] = useState<Selection>(null);
  const [tab, setTab] = useState<'vehicles' | 'missions'>('vehicles');
  const detailRef = useRef<HTMLElement>(null);

  // Sur tablette et mobile, la fiche est sous la carte : on l'amène à l'écran.
  useEffect(() => {
    if (!selection || window.matchMedia('(min-width: 1181px)').matches) return;
    detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selection]);

  const snapshot = data.snapshot;
  const views = useMemo(() => (snapshot ? buildVehicleViews(snapshot, now) : []), [snapshot, now]);
  const vehiclesById = useMemo(() => new Map(snapshot?.vehicles.map((v) => [v.id, v]) ?? []), [snapshot]);
  const viewsById = useMemo(() => new Map(views.map((v) => [v.vehicle.id, v])), [views]);

  if (!snapshot) {
    return (
      <div className="app">
        <Header
          mode={repository.mode}
          snapshot={null}
          now={now}
          loading={data.loading}
          onRefresh={data.refresh}
          autoRefresh={data.autoRefresh}
          onAutoRefreshChange={data.setAutoRefresh}
          refreshIntervalS={config.refreshIntervalS}
        />
        <main className="state-screen">
          {data.error ? (
            <div role="alert" className="state-screen__box state-screen__box--error">
              <Icon name="alert" size={28} />
              <p>{data.error}</p>
              <button type="button" className="btn btn--primary" onClick={data.refresh}>
                Réessayer
              </button>
            </div>
          ) : (
            <div className="state-screen__box" role="status">
              <span className="spinner" aria-hidden="true" />
              <p>Chargement de l'exploitation du jour…</p>
            </div>
          )}
        </main>
      </div>
    );
  }

  const kpis = computeKpis(snapshot, views, now);
  const actionCount = views.filter((v) => v.needsAction).length;
  const filtered = isFiltered(filters);
  const shownViews = views.filter((v) => matchesVehicle(v, filters, now));
  const shownMissions = snapshot.missions
    .filter((m) =>
      matchesMission(m, m.vehicleId ? vehiclesById.get(m.vehicleId) : undefined, filters, now, !!(m.vehicleId && viewsById.get(m.vehicleId)?.needsAction)),
    )
    .sort((a, b) => {
      // Retards d'abord, puis en cours, planifiées, terminées.
      const la = isLate(missionLateness(a, now)) && a.status !== 'completed' ? 0 : 1;
      const lb = isLate(missionLateness(b, now)) && b.status !== 'completed' ? 0 : 1;
      return la - lb || MISSION_ORDER.indexOf(a.status) - MISSION_ORDER.indexOf(b.status);
    });

  const presentVehicleStatuses = VEHICLE_ORDER.filter((s) => snapshot.vehicles.some((v) => v.status === s));
  const presentMissionStatuses = MISSION_ORDER.filter((s) => snapshot.missions.some((m) => m.status === s));

  const selectedVehicle = selection?.kind === 'vehicle' ? viewsById.get(selection.id) : undefined;
  const selectedMission =
    selection?.kind === 'mission' ? snapshot.missions.find((m) => m.id === selection.id) : undefined;
  const focusMission = selectedMission ?? (selectedVehicle?.missionRole !== 'last' ? selectedVehicle?.mission : undefined);

  const select = (s: Selection) => setSelection(s);
  const noSourceData = snapshot.vehicles.length === 0 && snapshot.missions.length === 0;

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Aller au contenu principal
      </a>
      <Header
        mode={repository.mode}
        snapshot={snapshot}
        now={now}
        loading={data.loading}
        onRefresh={data.refresh}
        autoRefresh={data.autoRefresh}
        onAutoRefreshChange={data.setAutoRefresh}
        refreshIntervalS={config.refreshIntervalS}
      />
      {data.error && (
        <p className="notice notice--danger app__alert" role="alert">
          <Icon name="alert" size={16} /> {data.error}
        </p>
      )}

      <main id="main" className="layout">
        <KpiStrip
          kpis={kpis}
          missions={snapshot.missions}
          actionCount={actionCount}
          fleetAvailable={snapshot.sources.webfleet.kind === 'ok'}
          ordersAvailable={snapshot.sources.businessCentral.kind === 'ok'}
          onShowLate={() => {
            setFilters({ ...EMPTY_FILTERS, lateOnly: true });
            setTab('missions');
          }}
          onShowAction={() => {
            setFilters({ ...EMPTY_FILTERS, actionOnly: true });
            setTab('vehicles');
          }}
        />

        {noSourceData && (
          <p className="notice notice--warn">
            Aucune donnée reçue des sources pour aujourd'hui. Vérifiez l'état des connexions ci-dessus.
          </p>
        )}

        <div className="workspace">
          <aside className="panel side" aria-label="Recherche et listes">
            <FilterBar
              filters={filters}
              onChange={setFilters}
              vehicleStatuses={presentVehicleStatuses}
              missionStatuses={presentMissionStatuses}
              hasLate={kpis.lateMissions > 0}
              hasAction={actionCount > 0}
            />
            <div className="tabs" role="tablist" aria-label="Listes">
              <button
                type="button"
                role="tab"
                id="tab-vehicles"
                aria-selected={tab === 'vehicles'}
                aria-controls="panel-list"
                className="tab"
                onClick={() => setTab('vehicles')}
              >
                Véhicules <span className="tab__count">{shownViews.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                id="tab-missions"
                aria-selected={tab === 'missions'}
                aria-controls="panel-list"
                className="tab"
                onClick={() => setTab('missions')}
              >
                Missions <span className="tab__count">{shownMissions.length}</span>
              </button>
            </div>
            <div id="panel-list" role="tabpanel" aria-labelledby={`tab-${tab}`} className="side__list">
              {tab === 'vehicles' ? (
                <VehicleList views={shownViews} now={now} selection={selection} onSelect={select} filtered={filtered} />
              ) : (
                <MissionList
                  missions={shownMissions}
                  vehicles={vehiclesById}
                  now={now}
                  selection={selection}
                  onSelect={select}
                  filtered={filtered}
                />
              )}
            </div>
          </aside>

          <section className="panel map-panel" aria-label="Carte de flotte">
            <FleetMap views={shownViews} selection={selection} focusMission={focusMission} now={now} onSelect={select} />
          </section>

          <aside ref={detailRef} className="panel detail" aria-label="Détail de la sélection" aria-live="polite">
            {selectedVehicle ? (
              <VehicleSheet
                view={selectedVehicle}
                now={now}
                onClose={() => setSelection(null)}
                onSelectMission={(id) => setSelection({ kind: 'mission', id })}
              />
            ) : selectedMission ? (
              <MissionSheet
                mission={selectedMission}
                vehicle={selectedMission.vehicleId ? vehiclesById.get(selectedMission.vehicleId) : undefined}
                now={now}
                onClose={() => setSelection(null)}
                onSelectVehicle={(id) => setSelection({ kind: 'vehicle', id })}
              />
            ) : (
              <DetailEmpty />
            )}
          </aside>
        </div>

        <DistancePanel
          missions={snapshot.missions}
          vehicles={vehiclesById}
          onSelectMission={(id) => setSelection({ kind: 'mission', id })}
        />
      </main>
    </div>
  );
}
