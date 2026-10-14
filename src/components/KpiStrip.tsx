import type { ReactNode } from 'react';
import type { DayKpis } from '../domain/selectors';
import { aggregateDistance } from '../domain/rules';
import type { Mission } from '../domain/types';
import { formatKm, formatPct } from './format';

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
  label: string;
  value: string | number;
  detail?: ReactNode;
  tone?: 'danger' | 'warn' | 'ok';
  onClick?: () => void;
  actionLabel?: string;
}

function Tile({ label, value, detail, tone, onClick, actionLabel }: TileProps) {
  const body = (
    <>
      <span className="kpi__label">{label}</span>
      <span className="kpi__value">
        {tone === 'danger' && <span aria-hidden="true">! </span>}
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
        label="Véhicules en route"
        value={fleetAvailable ? `${kpis.vehiclesDriving} / ${kpis.vehiclesTotal}` : UNAVAILABLE}
        detail={fleetAvailable ? `${kpis.vehiclesWithMission} en mission` : noFleet}
      />
      <Tile
        label="Missions du jour"
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
        label="Arrêts en retard"
        value={ordersAvailable ? d.late : UNAVAILABLE}
        detail={
          !ordersAvailable ? noOrders : <>
            {kpis.lateMissions} mission(s) concernée(s)
            {d.lateUnknown > 0 && <> · {d.lateUnknown} non évaluable(s)</>}
          </>
        }
        tone={!ordersAvailable ? undefined : d.late > 0 ? 'danger' : 'ok'}
        onClick={d.late > 0 ? onShowLate : undefined}
        actionLabel={`${d.late} arrêts en retard — afficher les missions concernées`}
      />
      <Tile
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
      <Tile
        label="Distance (missions terminées)"
        value={dist.comparable > 0 ? formatKm(dist.actualKm) : 'Non calculable'}
        detail={
          dist.comparable > 0 && dist.deltaRatio !== undefined ? (
            <>
              prévu {formatKm(dist.plannedKm)} · écart {formatPct(dist.deltaRatio)} · sur{' '}
              {dist.comparable} mission(s) / {dist.total}
            </>
          ) : (
            'Aucune mission avec distances prévue et parcourue'
          )
        }
      />
    </section>
  );
}
