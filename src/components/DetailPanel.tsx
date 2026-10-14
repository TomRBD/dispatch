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
import { StatusBadge } from './StatusBadge';
import { Timeline } from './Timeline';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

const Missing = ({ children = 'Non disponible' }: { children?: ReactNode }) => (
  <span className="missing">{children}</span>
);

function DeliveryList({ mission, now }: { mission: Mission; now: Date }) {
  if (mission.deliveries.length === 0) return <p className="empty">Aucune livraison rattachée à cette mission.</p>;
  const sorted = [...mission.deliveries].sort((a, b) => (a.sequence ?? Infinity) - (b.sequence ?? Infinity));
  return (
    <section>
      <h3 className="section-title">Arrêts (livraisons / collectes)</h3>
      <ol className="deliveries">
        {sorted.map((d) => (
          <DeliveryItem key={d.id} d={d} now={now} />
        ))}
      </ol>
    </section>
  );
}

function DeliveryItem({ d, now }: { d: Delivery; now: Date }) {
  const late = latenessMeta(deliveryLateness(d, now));
  return (
    <li className="delivery">
      <div className="delivery__head">
        <span className="delivery__seq" aria-hidden="true">
          {d.sequence ?? '·'}
        </span>
        <div>
          <p className="delivery__customer">{d.customerName}</p>
          <p className="delivery__ref">
            {d.reference}
            {d.orderReference && <> · Cde {d.orderReference}</>}
            {d.siteName && <> · {d.siteName}</>}
          </p>
        </div>
      </div>
      <div className="delivery__status">
        {d.kind && <span className="tag">{d.kind === 'pickup' ? 'Collecte' : 'Livraison'}</span>}
        <StatusBadge meta={DELIVERY_STATUS[d.status]} srPrefix={d.kind === 'pickup' ? 'Collecte' : 'Livraison'} />
        {d.emptyRun && (
          <StatusBadge
            meta={{ label: `Passage à vide${d.emptyRunReason ? ` : ${d.emptyRunReason}` : ''}`, tone: 'warn', glyph: '∅' }}
          />
        )}
        {late && <StatusBadge meta={late} />}
      </div>
      <p className="delivery__times">
        Créneau{' '}
        {d.plannedWindowStart || d.plannedWindowEnd ? (
          <>
            {d.plannedWindowStart ? formatTime(d.plannedWindowStart, now) : '?'} –{' '}
            {d.plannedWindowEnd ? formatTime(d.plannedWindowEnd, now) : '?'}
          </>
        ) : (
          <Missing>non renseigné</Missing>
        )}
        {d.actualArrival && <> · Arrivée {formatTime(d.actualArrival, now)}</>}
        {d.actualCompletion && <> · Fin {formatTime(d.actualCompletion, now)}</>}
        {!d.actualArrival && d.estimatedArrival && <> · ETA source {formatTime(d.estimatedArrival, now)}</>}
      </p>
    </li>
  );
}

function MissionSummary({ mission, vehicle, now }: { mission: Mission; vehicle?: Vehicle; now: Date }) {
  const p = missionProgress(mission);
  const late = latenessMeta(missionLateness(mission, now));
  const next = nextDelivery(mission);
  return (
    <dl className="fields">
      <Field label="Statut">
        <span className="inline-badges">
          <StatusBadge meta={MISSION_STATUS[mission.status]} />
          {late && <StatusBadge meta={late} />}
        </span>
      </Field>
      <Field label="Véhicule">
        {vehicle ? vehicle.registration : mission.vehicleId ? `${mission.vehicleId} (sans données télématiques)` : <Missing>Non affecté</Missing>}
      </Field>
      <Field label="Progression">
        {p.total > 0 && p.unknown === p.total ? (
          <Missing>{p.total} livraison(s), statut non fourni par la source</Missing>
        ) : (
          <span className="progress" role="img" aria-label={`${p.done} livraisons terminées sur ${p.total}`}>
            <span className="progress__bar">
              <span style={{ width: p.total ? `${(p.done / p.total) * 100}%` : 0 }} />
            </span>
            {p.done} / {p.total}
          </span>
        )}
      </Field>
      <Field label="Prochain arrêt">
        {next ? (
          `${next.siteName ?? next.customerName}`
        ) : p.unknown > 0 ? (
          <Missing>Non déterminable (statuts absents)</Missing>
        ) : (
          <Missing>Aucun arrêt restant</Missing>
        )}
      </Field>
      <Field label="Horaires prévus">
        {mission.plannedStart || mission.plannedEnd ? (
          <>
            {mission.plannedStart ? formatTime(mission.plannedStart, now) : '?'} →{' '}
            {mission.plannedEnd ? formatTime(mission.plannedEnd, now) : '?'}
          </>
        ) : (
          <Missing />
        )}
      </Field>
      <Field label="Distance prévu / parcouru">
        <DistanceCell c={compareMissionDistance(mission)} />
      </Field>
    </dl>
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
  return (
    <article className="sheet" aria-labelledby="sheet-title">
      <header className="sheet__head">
        <div>
          <p className="sheet__kicker">Fiche véhicule</p>
          <h2 id="sheet-title" className="sheet__title">
            {vehicle.registration}
          </h2>
          {vehicle.label && <p className="sheet__sub">{vehicle.label}</p>}
        </div>
        <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Fermer la fiche">
          <Icon name="close" />
        </button>
      </header>

      {view.needsAction && (
        <p className="notice notice--warn" role="status">
          <span aria-hidden="true">▲ </span>
          <strong>Action requise :</strong>{' '}
          {view.lateness.kind === 'late'
            ? 'mission en retard.'
            : 'mission en cours sans position récente.'}
        </p>
      )}

      <dl className="fields">
        <Field label="État">
          <StatusBadge meta={VEHICLE_STATUS[vehicle.status]} />
        </Field>
        {vehicle.driverName && <Field label="Conducteur">{vehicle.driverName}</Field>}
        <Field label="Dernière position">
          {pos ? (
            <>
              {pos.placeLabel ?? `${pos.lat.toFixed(4)}, ${pos.lng.toFixed(4)}`}
              <br />
              <span className={view.freshness === 'stale' ? 'text-warn' : 'muted'}>
                {view.freshness === 'stale' && '⚠ Position ancienne · '}
                mesurée à {formatTime(pos.recordedAt, now)} ({formatAge(pos.recordedAt, now)})
              </span>
            </>
          ) : (
            <Missing>⚠ Position indisponible</Missing>
          )}
        </Field>
        <Field label="Distance du jour">
          {vehicle.distanceTodayKm !== undefined ? formatKm(vehicle.distanceTodayKm) : <Missing />}
        </Field>
      </dl>

      {mission ? (
        <>
          <div className="sheet__mission-head">
            <h3 className="section-title">
              {missionRole === 'current' ? 'Mission en cours' : missionRole === 'next' ? 'Prochaine mission' : 'Dernière mission'}
              {' — '}
              {mission.label ?? mission.reference}
            </h3>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => onSelectMission(mission.id)}>
              Ouvrir la mission
            </button>
          </div>
          <MissionSummary mission={mission} vehicle={vehicle} now={now} />
          <Timeline mission={mission} now={now} />
        </>
      ) : (
        <p className="empty">Aucune mission affectée à ce véhicule aujourd'hui.</p>
      )}
      {view.missions.length > 1 && (
        <section>
          <h3 className="section-title">Autres missions du jour</h3>
          <ul className="mini-list">
            {view.missions
              .filter((m) => m.id !== mission?.id)
              .map((m) => (
                <li key={m.id}>
                  <button type="button" className="link" onClick={() => onSelectMission(m.id)}>
                    {m.label ?? m.reference}
                  </button>{' '}
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
  return (
    <article className="sheet" aria-labelledby="sheet-title">
      <header className="sheet__head">
        <div>
          <p className="sheet__kicker">Mission · {mission.reference}</p>
          <h2 id="sheet-title" className="sheet__title">
            {mission.label ?? mission.reference}
          </h2>
        </div>
        <button type="button" className="btn btn--icon" onClick={onClose} aria-label="Fermer la mission">
          <Icon name="close" />
        </button>
      </header>
      {vehicle && (
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => onSelectVehicle(vehicle.id)}>
          <Icon name="truck" size={14} /> Fiche véhicule {vehicle.registration}
        </button>
      )}
      <MissionSummary mission={mission} vehicle={vehicle} now={now} />
      <Timeline mission={mission} now={now} />
      <DeliveryList mission={mission} now={now} />
      <p className="rule-note">
        <Icon name="info" size={14} /> {RULE_DESCRIPTIONS.late}
      </p>
    </article>
  );
}

export function DetailEmpty() {
  return (
    <div className="sheet sheet--empty">
      <Icon name="truck" size={28} />
      <p>
        Sélectionnez un véhicule sur la carte ou dans la liste pour ouvrir sa fiche, ou une mission
        pour voir ses livraisons et sa timeline.
      </p>
    </div>
  );
}
