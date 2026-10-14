import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { VehicleView } from '../domain/selectors';
import { DELIVERY_STATUS, VEHICLE_STATUS } from '../domain/status';
import { deliveryLateness, isLate } from '../domain/rules';
import type { LatLng, Mission } from '../domain/types';
import { formatAge, formatTime } from '../domain/time';
import { config } from '../data/config';
import type { Selection } from './Lists';

interface Props {
  views: VehicleView[];
  selection: Selection;
  /** Mission dont on affiche les points de livraison. */
  focusMission?: Mission;
  now: Date;
  onSelect: (s: Selection) => void;
}

const DEFAULT_CENTER: L.LatLngExpression = [48.0, 7.3];

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function vehicleIcon(v: VehicleView, selected: boolean): L.DivIcon {
  const meta = VEHICLE_STATUS[v.vehicle.status];
  const late = isLate(v.lateness);
  const cls = [
    'vm',
    `vm--${meta.tone}`,
    v.freshness === 'stale' ? 'vm--stale' : '',
    late ? 'vm--late' : '',
    selected ? 'vm--selected' : '',
  ].join(' ');
  return L.divIcon({
    className: 'vm-wrap',
    html: `<span class="${cls}"><span class="vm__glyph">${meta.glyph}</span><span class="vm__label">${esc(
      v.vehicle.registration,
    )}</span>${late ? '<span class="vm__flag" title="En retard">!</span>' : ''}${
      v.freshness === 'stale' ? '<span class="vm__flag vm__flag--stale" title="Position ancienne">⏱</span>' : ''
    }</span>`,
    iconSize: undefined,
    iconAnchor: [14, 14],
  });
}

function deliveryIcon(label: string, tone: string, late: boolean): L.DivIcon {
  return L.divIcon({
    className: 'dm-wrap',
    html: `<span class="dm dm--${tone} ${late ? 'dm--late' : ''}">${esc(label)}</span>`,
    iconAnchor: [11, 11],
  });
}

export function FleetMap({ views, selection, focusMission, now, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const vehicleLayer = useRef<L.LayerGroup | null>(null);
  const missionLayer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const [tiles, setTiles] = useState<'loading' | 'ok' | 'failed'>('loading');
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Initialisation unique de la carte.
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { center: DEFAULT_CENTER, zoom: 9, zoomControl: true, attributionControl: true });
    let errors = 0;
    L.tileLayer(config.mapTileUrl, { attribution: config.mapAttribution, maxZoom: 18 })
      .on('tileload', () => setTiles('ok'))
      .on('tileerror', () => {
        errors += 1;
        if (errors >= 4) setTiles((t) => (t === 'ok' ? t : 'failed'));
      })
      .addTo(m);
    vehicleLayer.current = L.layerGroup().addTo(m);
    missionLayer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);

  // Marqueurs véhicules.
  useEffect(() => {
    const layer = vehicleLayer.current;
    const m = map.current;
    if (!layer || !m) return;
    layer.clearLayers();
    const points: L.LatLngExpression[] = [];
    for (const v of views) {
      const pos = v.vehicle.position;
      if (!pos) continue;
      const selected = selection?.kind === 'vehicle' && selection.id === v.vehicle.id;
      const meta = VEHICLE_STATUS[v.vehicle.status];
      const title = `${v.vehicle.registration} — ${meta.label}${isLate(v.lateness) ? ', en retard' : ''}, position ${formatAge(pos.recordedAt, now)}${v.freshness === 'stale' ? ' (ancienne)' : ''}`;
      const marker = L.marker([pos.lat, pos.lng], {
        icon: vehicleIcon(v, selected),
        title,
        alt: title,
        keyboard: true,
        zIndexOffset: selected ? 1000 : isLate(v.lateness) ? 500 : 0,
        riseOnHover: true,
      });
      marker.bindTooltip(
        `<strong>${esc(v.vehicle.registration)}</strong> · ${esc(meta.label)}<br/>${
          v.mission ? esc(v.mission.label ?? v.mission.reference) + '<br/>' : ''
        }Position mesurée à ${formatTime(pos.recordedAt, now)} (${formatAge(pos.recordedAt, now)})`,
        { direction: 'top', offset: [0, -14] },
      );
      marker.on('click', () => onSelectRef.current({ kind: 'vehicle', id: v.vehicle.id }));
      marker.addTo(layer);
      // Nom accessible complet (sinon lu à partir des pictogrammes du marqueur).
      marker.getElement()?.setAttribute('aria-label', title);
      points.push([pos.lat, pos.lng]);
    }
    if (!fitted.current && points.length > 0) {
      m.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 12 });
      fitted.current = true;
    }
  }, [views, selection, now]);

  // Points de livraison et tracé indicatif de la mission sélectionnée.
  useEffect(() => {
    const layer = missionLayer.current;
    const m = map.current;
    if (!layer || !m) return;
    layer.clearLayers();
    if (!focusMission) return;
    const stops = [...focusMission.deliveries]
      .sort((a, b) => (a.sequence ?? Infinity) - (b.sequence ?? Infinity))
      .filter((d): d is typeof d & { location: LatLng } => !!d.location);
    const line: L.LatLngExpression[] = stops.map((d) => [d.location.lat, d.location.lng]);
    if (line.length > 1) {
      L.polyline(line, { color: '#1f6f4a', weight: 3, opacity: 0.8, dashArray: '6 6' }).addTo(layer);
    }
    stops.forEach((d, i) => {
      const meta = DELIVERY_STATUS[d.status];
      const late = isLate(deliveryLateness(d, now));
      L.marker([d.location.lat, d.location.lng], {
        icon: deliveryIcon(String(d.sequence ?? i + 1), meta.tone, late),
        title: `Arrêt ${d.sequence ?? i + 1} — ${d.customerName} — ${meta.label}${late ? ', en retard' : ''}`,
        keyboard: false,
      })
        .bindTooltip(
          `<strong>${esc(d.siteName ?? d.customerName)}</strong><br/>${esc(d.reference)} · ${esc(meta.label)}${
            late ? ' · <strong>en retard</strong>' : ''
          }`,
          { direction: 'top', offset: [0, -10] },
        )
        .addTo(layer);
    });
  }, [focusMission, now]);

  // Cadrage sur la mission : uniquement quand la mission change, pas à chaque actualisation.
  const focusId = focusMission?.id;
  useEffect(() => {
    const m = map.current;
    if (!m || !focusMission) return;
    const bounds = L.latLngBounds(
      focusMission.deliveries.flatMap((d) => (d.location ? [[d.location.lat, d.location.lng] as L.LatLngTuple] : [])),
    );
    const vehiclePos = views.find((v) => v.vehicle.id === focusMission.vehicleId)?.vehicle.position;
    if (vehiclePos) bounds.extend([vehiclePos.lat, vehiclePos.lng]);
    if (bounds.isValid()) m.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  // Centrage sur le véhicule sélectionné.
  useEffect(() => {
    if (selection?.kind !== 'vehicle' || !map.current) return;
    const pos = views.find((v) => v.vehicle.id === selection.id)?.vehicle.position;
    if (pos) map.current.panTo([pos.lat, pos.lng]);
    // Seul un changement de sélection doit recentrer, pas une actualisation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection]);

  const withoutPosition = views.filter((v) => !v.vehicle.position);

  return (
    <div className="map">
      <div
        ref={el}
        className="map__canvas"
        role="region"
        aria-label="Carte de la flotte : dernières positions connues des véhicules"
      />
      {tiles === 'failed' && (
        <p className="map__notice" role="status">
          <span aria-hidden="true">⚠ </span>
          Fond de carte indisponible (service de tuiles injoignable). Les positions restent affichées.
        </p>
      )}
      <div className="map__legend" aria-hidden="true">
        <span><b className="lg lg--active">▶</b> En route</span>
        <span><b className="lg lg--neutral">❚❚</b> À l'arrêt</span>
        <span><b className="lg lg--muted">■</b> Contact coupé</span>
        <span><b className="lg lg--late">!</b> En retard</span>
        <span><b className="lg lg--stale">⏱</b> Position ancienne</span>
        {focusMission && <span><b className="lg lg--stop">1</b> Arrêt (tracé indicatif, pas l'itinéraire routier)</span>}
      </div>
      {withoutPosition.length > 0 && (
        <div className="map__nopos">
          <p>
            <span aria-hidden="true">⚠ </span>
            {withoutPosition.length} véhicule(s) sans position :
          </p>
          <ul>
            {withoutPosition.map((v) => (
              <li key={v.vehicle.id}>
                <button
                  type="button"
                  className="link"
                  onClick={() => onSelect({ kind: 'vehicle', id: v.vehicle.id })}
                >
                  {v.vehicle.registration}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
