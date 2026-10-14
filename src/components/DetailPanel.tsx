import type { ReactNode } from 'react';
import type { VehicleView } from '../domain/selectors';
import { missionProgress, nextDelivery } from '../domain/selectors';
import { RULE_DESCRIPTIONS, compareMissionDistance, deliveryLateness, missionLateness } from '../domain/rules';
import { DELIVERY_STATUS, MISSION_STATUS, VEHICLE_STATUS, latenessMeta } from '../domain/status';
import type { Delivery, Mission, Vehicle } from '../domain/types';
import { formatAge, formatTime } from '../domain/time';
import { formatKm } from './format';
import { DistanceCell } from './DistancePanel';
import { Icon } from './Icon';
import { missionIcon } from './Lists';
import { Plate } from './Plate';
import { StatusBadge } from './StatusBadge';
import { Timeline } from './Timeline';

/** Petite carte chiffrée de la fiche (horaires, progression, km…). */
function Stat({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`stat ${wide ? 'stat--wide' : ''}`}>
      <dt className="stat__label">{label}</dt>
      <dd className="stat__value">{children}</dd>
    </div>
  );
}

function SheetHead({ kicker, icon, title, children, onClose, closeLabel }: {
  kicker: string;
  icon: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  onClose: () => void;
  closeLabel: string;
}) {
  return (
    <header className="sheet__head">
      <div className="sheet__head-main">
        <p className="sheet__kicker">
          {icon}
          {kicker}
        </p>
        <h2 id="sheet-title" className="sheet__title">
          {title}
        </h2>
        {children}
      </div>
      <button type="button" className="btn btn--icon" onClick={onClose} aria-label={closeLabel}>
        <Icon name="close" />
      </button>
    </header>
  );
}

function DeliveryList({ mission, now }: { mission: Mission; now: Date }) {
  if (mission.deliveries.length === 0) {
    return <p className="empty-inline">Aucun arrêt rattaché à cette tournée.</p>;
  }
  const sorted = [...mission.deliveries].sort((a, b) => (a.sequence ?? Infinity) - (b.sequence ?? Infinity));
  return (
    <section aria-labelledby="stops-title">
      <h3 id="stops-title" className="section-title">
        Arrêts <span className="section-title__count">{sorted.length}</span>
      </h3>
      <ol className="stops">
        {sorted.map((d) => (
          <DeliveryItem key={d.id} d={d} now={now} />
        ))}
      </ol>
    </section>
  );
}

function DeliveryItem({ d, now }: { d: Delivery; now: Date }) {
  const lateness = deliveryLateness(d, now);
  const late = lateness.kind === 'late' ? latenessMeta(lateness) : null;
  const status = DELIVERY_STATUS[d.status];
  const kindLabel = d.kind === 'pickup' ? 'Collecte' : d.kind === 'delivery' ? 'Livraison' : 'Arrêt';
  return (
    <li className={`stop stop--${status.tone}`}>
      <span className="stop__seq" aria-hidden="true">
        {d.sequence ?? '·'}
      </span>
      <div className="stop__body">
        <p className="stop__name">{d.customerName}</p>
        <p className="stop__meta">
          <Icon name={d.kind === 'pickup' ? 'bin' : d.kind === 'delivery' ? 'box' : 'pin'} size={12} />
          {kindLabel}
          {d.siteName && <> · {d.siteName}</>}
          <span className="stop__ref"> · {d.reference}</span>
        </p>
        {(d.actualArrival || d.actualCompletion || d.plannedWindowEnd) && (
          <p className="stop__times">
            {d.plannedWindowEnd && <span>Demandé {formatTime(d.plannedWindowEnd, now)}</span>}
            {d.actualArrival && (
              <span>
                <Icon name="clock" size={11} /> {formatTime(d.actualArrival, now)}
                {d.actualCompletion && <> → {formatTime(d.actualCompletion, now)}</>}
              </span>
            )}
          </p>
        )}
      </div>
      <div className="stop__status">
        <StatusBadge meta={status} srPrefix={kindLabel} />
        {d.emptyRun && (
          <StatusBadge meta={{ label: `À vide${d.emptyRunReason ? ` · ${d.emptyRunReason}` : ''}`, tone: 'warn', glyph: '∅' }} />
        )}
        {late && <StatusBadge meta={late} />}
      </div>
    </li>
  );
}

function MissionStats({ mission, now }: { mission: Mission; now: Date }) {
  const p = missionProgress(mission);
  const next = nextDelivery(mission);
  const allUnknown = p.total > 0 && p.unknown === p.total;
  return (
    <dl className="stats">
      <Stat label="Horaires prévus">
        {mission.plannedStart ? formatTime(mission.plannedStart, now) : '—'}
        <span className="stat__arrow" aria-hidden="true">→</span>
        <span className="sr-only"> à </span>
        {mission.plannedEnd ? formatTime(mission.plannedEnd, now) : '—'}
      </Stat>
      <Stat label="Arrêts réalisés">
        {allUnknown ? (
          <span className="stat__muted">{p.total} sans statut</span>
        ) : (
          <>
            {p.done}
            <span className="stat__unit">/{p.total}</span>
            <span className="stat__bar" role="img" aria-label={`${p.done} arrêts réalisés sur ${p.total}`}>
              <span style={{ width: p.total ? `${(p.done / p.total) * 100}%` : 0 }} />
            </span>
          </>
        )}
      </Stat>
      {mission.plannedDistanceKm !== undefined ? (
        <Stat label="Prévu / parcouru" wide>
          <DistanceCell c={compareMissionDistance(mission)} />
        </Stat>
      ) : (
        mission.actualDistanceKm !== undefined && <Stat label="Km parcourus">{formatKm(mission.actualDistanceKm)}</Stat>
      )}
      {mission.status !== 'completed' && (next || p.unknown === 0) && (
        <Stat label="Prochain arrêt" wide>
          {next ? next.siteName ?? next.customerName : <span className="stat__muted">Aucun arrêt restant</span>}
        </Stat>
      )}
    </dl>
  );
}

function MissionBadges({ mission, now }: { mission: Mission; now: Date }) {
  const lateness = missionLateness(mission, now);
  const late = lateness.kind === 'late' ? latenessMeta(lateness) : null;
  return (
    <p className="sheet__badges">
      <StatusBadge meta={MISSION_STATUS[mission.status]} srPrefix="Tournée" size="md" />
      {late && <StatusBadge meta={late} size="md" />}
    </p>
  );
}

export function VehicleSheet({ view, now, onClose, onSelectMission }: {
  view: VehicleView;
  now: Date;
  onClose: () => void;
  onSelectMission: (id: string) => void;
}) {
  const { vehicle, mission, missionRole } = view;
  const pos = vehicle.position;
  const meta = VEHICLE_STATUS[vehicle.status];
  return (
    <article className="sheet" aria-labelledby="sheet-title">
      <SheetHead
        kicker="Véhicule"
        icon={<Icon name="truck" size={14} />}
        title={<Plate value={vehicle.registration} size="lg" />}
        onClose={onClose}
        closeLabel="Fermer la fiche véhicule"
      >
        {vehicle.label && <p className="sheet__sub">{vehicle.label}</p>}
        <p className="sheet__badges">
          <StatusBadge meta={meta} srPrefix="État" size="md" />
          {view.lateness.kind === 'late' && latenessMeta(view.lateness) && (
            <StatusBadge meta={latenessMeta(view.lateness)!} size="md" />
          )}
        </p>
      </SheetHead>

      {view.needsAction && view.lateness.kind !== 'late' && (
        <p className="notice notice--warn" role="status">
          <Icon name="alert" size={16} />
          <span>
            <strong>À vérifier :</strong> tournée en cours sans position récente.
          </span>
        </p>
      )}

      <div className={`position-card ${view.freshness !== 'fresh' ? 'position-card--warn' : ''}`}>
        <Icon name={pos ? 'pin' : 'alert'} size={18} />
        <div>
          <p className="position-card__place">
            {pos ? pos.placeLabel ?? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}` : 'Position indisponible'}
          </p>
          {pos && (
            <p className="position-card__time">
              {view.freshness === 'stale' && 'Position ancienne · '}
              mesurée à {formatTime(pos.recordedAt, now)}, {formatAge(pos.recordedAt, now)}
            </p>
          )}
        </div>
      </div>

      {(vehicle.driverName || vehicle.distanceTodayKm !== undefined) && (
        <dl className="stats">
          {vehicle.driverName && <Stat label="Conducteur">{vehicle.driverName}</Stat>}
          {vehicle.distanceTodayKm !== undefined && <Stat label="Km du jour">{formatKm(vehicle.distanceTodayKm)}</Stat>}
        </dl>
      )}

      {mission ? (
        <section className="sheet__section" aria-labelledby="vehicle-mission-title">
          <div className="sheet__section-head">
            <p className="section-title" id="vehicle-mission-title">
              {missionRole === 'current' ? 'Tournée en cours' : missionRole === 'next' ? 'Prochaine tournée' : 'Dernière tournée'}
            </p>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onSelectMission(mission.id)}>
              Voir les arrêts
            </button>
          </div>
          <p className="sheet__mission-name">
            <Icon name={missionIcon(mission)} size={16} />
            {mission.label ?? mission.reference}
          </p>
          <MissionBadges mission={mission} now={now} />
          <MissionStats mission={mission} now={now} />
          <Timeline mission={mission} now={now} />
        </section>
      ) : (
        <p className="empty-inline">Aucune tournée affectée à ce véhicule aujourd'hui.</p>
      )}

      {view.missions.length > 1 && (
        <section className="sheet__section">
          <p className="section-title">Autres tournées du jour</p>
          <ul className="mini-list">
            {view.missions
              .filter((m) => m.id !== mission?.id)
              .map((m) => (
                <li key={m.id}>
                  <button type="button" className="link" onClick={() => onSelectMission(m.id)}>
                    {m.label ?? m.reference}
                  </button>
                  <StatusBadge meta={MISSION_STATUS[m.status]} />
                </li>
              ))}
          </ul>
        </section>
      )}
    </article>
  );
}

export function MissionSheet({ mission, vehicle, now, onClose, onSelectVehicle }: {
  mission: Mission;
  vehicle?: Vehicle;
  now: Date;
  onClose: () => void;
  onSelectVehicle: (id: string) => void;
}) {
  const plate = vehicle?.registration ?? mission.vehicleId;
  return (
    <article className="sheet" aria-labelledby="sheet-title">
      <SheetHead
        kicker={`Tournée · ${mission.reference}`}
        icon={<Icon name={missionIcon(mission)} size={14} />}
        title={mission.label ?? mission.reference}
        onClose={onClose}
        closeLabel="Fermer la tournée"
      >
        <MissionBadges mission={mission} now={now} />
      </SheetHead>

      {plate &&
        (vehicle ? (
          <button type="button" className="vehicle-link" onClick={() => onSelectVehicle(vehicle.id)}>
            <Icon name="truck" size={16} />
            <Plate value={plate} size="sm" />
            <span className="vehicle-link__cta">Fiche véhicule</span>
          </button>
        ) : (
          <p className="vehicle-link vehicle-link--static">
            <Icon name="truck" size={16} />
            <Plate value={plate} size="sm" />
            <span className="muted">sans données Webfleet</span>
          </p>
        ))}

      <MissionStats mission={mission} now={now} />
      <Timeline mission={mission} now={now} />
      <DeliveryList mission={mission} now={now} />
      <details className="rule-note">
        <summary>
          <Icon name="info" size={14} /> Comment le retard est calculé
        </summary>
        <p>{RULE_DESCRIPTIONS.late}</p>
      </details>
    </article>
  );
}

export function DetailEmpty() {
  return (
    <div className="sheet sheet--empty">
      <span className="sheet--empty__icon" aria-hidden="true">
        <Icon name="truck" size={34} strokeWidth={1.6} />
      </span>
      <p className="sheet--empty__title">Aucune sélection</p>
      <p>Choisissez un camion sur la carte ou une tournée dans la liste pour voir son état, ses arrêts et le déroulement de la journée.</p>
    </div>
  );
}
