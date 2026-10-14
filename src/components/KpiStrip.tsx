import type { ReactNode } from 'react';
import type { DayKpis } from '../domain/selectors';
import { aggregateDistance } from '../domain/rules';
import type { Mission } from '../domain/types';
import { formatKm, formatPct } from './format';
import { Icon, type IconName } from './Icon';

interface Props {
  kpis: DayKpis;
  missions: Mission[];
  onShowLate: () => void;
  onShowAction: () => void;
  actionCount: number;
  /** Disponibilité des sources : sans source, l'indicateur est « Indisponible », pas 0. */
  fleetAvailable: boolean;
  ordersAvailable: boolean;
}

interface TileProps {
  icon: IconName;
  label: string;
  value: string | number;
  detail?: ReactNode;
  tone?: 'danger' | 'warn' | 'ok';
  onClick?: () => void;
  actionLabel?: string;
}

function Tile({ icon, label, value, detail, tone, onClick, actionLabel }: TileProps) {
  const body = (
    <>
      <span className="kpi__head">
        <span className="kpi__icon" aria-hidden="true">
          <Icon name={icon} size={16} />
        </span>
        <span className="kpi__label">{label}</span>
      </span>
      <span className="kpi__value">
        {value}
      </span>
      {detail && <span className="kpi__detail">{detail}</span>}
    </>
  );
  const cls = `kpi ${tone ? `kpi--${tone}` : ''}`;
  return onClick ? (
    <button type="button" className={`${cls} kpi--button`} onClick={onClick} aria-label={actionLabel}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const UNAVAILABLE = 'Indisponible';

export function KpiStrip({ kpis, missions, onShowLate, onShowAction, actionCount, fleetAvailable, ordersAvailable }: Props) {
  const noOrders = 'Business Central non disponible';
  const noFleet = 'Webfleet non disponible';
  const d = kpis.deliveries;
  const dist = aggregateDistance(missions);
  return (
    <section className="kpis" aria-label="Synthèse de la journée">
      <Tile
        icon="truck"
        label="Véhicules en route"
        value={fleetAvailable ? `${kpis.vehiclesDriving} / ${kpis.vehiclesTotal}` : UNAVAILABLE}
        detail={fleetAvailable ? `${kpis.vehiclesWithMission} en tournée` : noFleet}
      />
      <Tile
        icon="layers"
        label="Tournées du jour"
        value={ordersAvailable ? kpis.missions.total : UNAVAILABLE}
        detail={
          !ordersAvailable ? noOrders : <>
            {kpis.missions.inProgress} en cours · {kpis.missions.completed} terminées ·{' '}
            {kpis.missions.planned} planifiées
            {kpis.missions.unassigned > 0 && <> · {kpis.missions.unassigned} non affectée(s)</>}
          </>
        }
        tone={kpis.missions.unassigned > 0 ? 'warn' : undefined}
      />
      <Tile
        icon="check"
        label="Arrêts réalisés"
        value={
          !ordersAvailable || (d.total > 0 && d.unknownStatus === d.total) ? UNAVAILABLE : `${d.delivered} / ${d.total}`
        }
        detail={
          !ordersAvailable ? noOrders : d.total > 0 && d.unknownStatus === d.total ? (
            `Statut des ${d.total} arrêt(s) non fourni par la source`
          ) : <>
            {d.inProgress} en cours · {d.planned} à faire
            {d.failed > 0 && <> · {d.failed} non réalisé(s)</>}
            {d.unknownStatus > 0 && <> · {d.unknownStatus} sans statut</>}
          </>
        }
      />
      <Tile
        icon="alert"
        label="Tournées en retard"
        value={ordersAvailable ? kpis.lateMissions : UNAVAILABLE}
        detail={
          !ordersAvailable ? noOrders : <>
            en cours au-delà de la fin prévue
            {kpis.lateCompletedMissions > 0 && <> · {kpis.lateCompletedMissions} terminée(s) en retard</>}
            {kpis.lateUnknownMissions > 0 && <> · {kpis.lateUnknownMissions} sans fin prévue</>}
          </>
        }
        tone={!ordersAvailable ? undefined : kpis.lateMissions > 0 ? 'danger' : 'ok'}
        onClick={kpis.lateMissions > 0 ? onShowLate : undefined}
        actionLabel={`${kpis.lateMissions} tournées en retard — afficher les tournées concernées`}
      />
      <Tile
        icon="gauge"
        label="À surveiller"
        value={fleetAvailable ? actionCount : UNAVAILABLE}
        detail={
          !fleetAvailable ? noFleet : <>
            {kpis.positionsStale} position(s) ancienne(s) · {kpis.positionsUnavailable} indisponible(s)
          </>
        }
        tone={!fleetAvailable ? undefined : actionCount > 0 ? 'warn' : 'ok'}
        onClick={actionCount > 0 ? onShowAction : undefined}
        actionLabel={`${actionCount} véhicules nécessitent une action — filtrer la liste`}
      />
      {dist.comparable > 0 && dist.deltaRatio !== undefined ? (
        <Tile
          icon="route"
          label="Distance (tournées terminées)"
          value={formatKm(dist.actualKm)}
          detail={
            <>
              prévu {formatKm(dist.plannedKm)} · écart {formatPct(dist.deltaRatio)} · sur {dist.comparable}{' '}
              tournée(s) / {dist.total}
            </>
          }
        />
      ) : (
        kpis.drivenKm.missions > 0 && (
          <Tile
            icon="route"
            label="Km parcourus"
            value={formatKm(kpis.drivenKm.total)}
            detail={`compteurs de ${kpis.drivenKm.missions} tournée(s) / ${kpis.missions.total}`}
          />
        )
      )}
    </section>
  );
}
