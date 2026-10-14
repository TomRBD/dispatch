import { RULE_DESCRIPTIONS, aggregateDistance, compareMissionDistance } from '../domain/rules';
import { MISSION_STATUS } from '../domain/status';
import type { DistanceComparison, Mission, Vehicle } from '../domain/types';
import { formatKm, formatPct, formatSignedKm } from './format';
import { Icon } from './Icon';
import { StatusBadge } from './StatusBadge';

/** Cellule compacte « prévu / parcouru (écart) » réutilisée dans les fiches. */
export function DistanceCell({ c }: { c: DistanceComparison }) {
  return (
    <span className="distance-cell">
      {formatKm(c.plannedKm)} / {formatKm(c.actualKm)}
      {c.deltaKm !== undefined && c.deltaRatio !== undefined ? (
        <span className={c.anomaly ? 'text-danger' : 'muted'}>
          {' '}
          ({c.anomaly && <span aria-hidden="true">⚠ </span>}
          {formatSignedKm(c.deltaKm)}, {formatPct(c.deltaRatio)}
          {c.anomaly && ' — écart à examiner'})
        </span>
      ) : (
        c.notComparableReason && <span className="missing"> · {c.notComparableReason}</span>
      )}
    </span>
  );
}

function DeltaBar({ c }: { c: DistanceComparison }) {
  if (c.plannedKm === undefined || c.actualKm === undefined || c.plannedKm <= 0) return null;
  const max = Math.max(c.plannedKm, c.actualKm);
  return (
    <span className="dbar" aria-hidden="true">
      <span className="dbar__planned" style={{ width: `${(c.plannedKm / max) * 100}%` }} />
      <span
        className={`dbar__actual ${c.partial ? 'dbar__actual--partial' : ''} ${c.anomaly ? 'dbar__actual--anomaly' : ''}`}
        style={{ width: `${(c.actualKm / max) * 100}%` }}
      />
    </span>
  );
}

export function DistancePanel({
  missions,
  vehicles,
  onSelectMission,
}: {
  missions: Mission[];
  vehicles: Map<string, Vehicle>;
  onSelectMission: (id: string) => void;
}) {
  const day = aggregateDistance(missions);
  const anyData = missions.some((m) => m.plannedDistanceKm !== undefined || m.actualDistanceKm !== undefined);

  const byVehicle = [...vehicles.values()]
    .map((v) => ({ v, agg: aggregateDistance(missions.filter((m) => m.vehicleId === v.id)) }))
    .filter((x) => x.agg.comparable > 0);

  return (
    <section className="panel distances" aria-labelledby="dist-title">
      <header className="panel__head">
        <h2 id="dist-title" className="panel__title">
          <Icon name="route" /> Distances prévues et parcourues
        </h2>
        <p className="panel__hint">{RULE_DESCRIPTIONS.distance}</p>
      </header>

      {!anyData ? (
        <p className="empty">Aucune distance prévue ni parcourue n'est disponible pour la journée.</p>
      ) : (
        <div className="distances__grid">
          <div className="distances__day">
            <h3 className="section-title">Journée</h3>
            {day.comparable > 0 && day.deltaRatio !== undefined ? (
              <>
                <p className="big-number">
                  {formatPct(day.deltaRatio)}
                  <span className="big-number__unit"> d'écart</span>
                </p>
                <p className="muted">
                  {formatKm(day.actualKm)} parcourus pour {formatKm(day.plannedKm)} prévus, sur{' '}
                  {day.comparable} mission(s) comparable(s) / {day.total}.
                </p>
              </>
            ) : (
              <p className="missing">Aucune mission terminée avec les deux distances : écart non calculé.</p>
            )}
            {byVehicle.length > 0 && (
              <>
                <h3 className="section-title">Par véhicule</h3>
                <ul className="mini-list">
                  {byVehicle.map(({ v, agg }) => (
                    <li key={v.id}>
                      <strong>{v.registration}</strong> — {formatKm(agg.actualKm)} / {formatKm(agg.plannedKm)} prévus
                      {agg.deltaRatio !== undefined && <> ({formatPct(agg.deltaRatio)})</>}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div className="table-wrap">
            <table className="table">
              <caption className="sr-only">Comparaison des distances par mission</caption>
              <thead>
                <tr>
                  <th scope="col">Mission</th>
                  <th scope="col">Véhicule</th>
                  <th scope="col">Statut</th>
                  <th scope="col" className="num">Prévu</th>
                  <th scope="col" className="num">Parcouru</th>
                  <th scope="col">Écart</th>
                </tr>
              </thead>
              <tbody>
                {missions.map((m) => {
                  const c = compareMissionDistance(m);
                  const v = m.vehicleId ? vehicles.get(m.vehicleId) : undefined;
                  return (
                    <tr key={m.id} className={c.anomaly ? 'tr--anomaly' : undefined}>
                      <th scope="row">
                        <button type="button" className="link" onClick={() => onSelectMission(m.id)}>
                          {m.label ?? m.reference}
                        </button>
                      </th>
                      <td>{v?.registration ?? <span className="missing">—</span>}</td>
                      <td>
                        <StatusBadge meta={MISSION_STATUS[m.status]} />
                      </td>
                      <td className="num">{formatKm(c.plannedKm)}</td>
                      <td className="num">
                        {formatKm(c.actualKm)}
                        {c.partial && c.actualKm !== undefined && <span className="muted"> (partiel)</span>}
                      </td>
                      <td>
                        <DeltaBar c={c} />
                        {c.deltaKm !== undefined && c.deltaRatio !== undefined ? (
                          <span className={c.anomaly ? 'text-danger' : undefined}>
                            {c.anomaly && <span aria-hidden="true">⚠ </span>}
                            {formatSignedKm(c.deltaKm)} ({formatPct(c.deltaRatio)})
                            {c.anomaly && <span className="sr-only"> — écart à examiner</span>}
                          </span>
                        ) : (
                          <span className="missing">{c.notComparableReason}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
