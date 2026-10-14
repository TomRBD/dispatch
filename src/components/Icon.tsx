/** Pictogrammes au trait (24 × 24). Chaque entrée peut contenir plusieurs tracés. */
const PATHS = {
  truck: [
    'M1.5 6.5h11.5v9.5H1.5z',
    'M13 9.5h4.6l3.9 3.9V16H13z',
    'M5.5 19.2a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z',
    'M17.2 19.2a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z',
  ],
  refresh: ['M20 11a8 8 0 1 0-2.3 5.7', 'M20 4v7h-7'],
  search: ['M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z', 'm16 16 5 5'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  pin: ['M12 21s-6-5.6-6-11a6 6 0 1 1 12 0c0 5.4-6 11-6 11Z', 'M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z'],
  alert: ['M12 3 2 20h20L12 3Z', 'M12 9v5', 'M12 17v.5'],
  clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
  route: [
    'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    'M18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
    'M6 15V9a3 3 0 0 1 3-3h6',
    'M18 9v6a3 3 0 0 1-3 3H9',
  ],
  info: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 11v5', 'M12 7.5v.5'],
  /** Bac de collecte (biodéchets). */
  bin: ['M4 7h16', 'M6 7l1 13h10l1-13', 'M9 7V4h6v3', 'M10 11v6', 'M14 11v6'],
  /** Colis / livraison. */
  box: ['M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z', 'M3 7.5 12 12l9-4.5', 'M12 12v9'],
  flag: ['M5 21V4', 'M5 4h11l-2 4 2 4H5'],
  gauge: ['M4 17a8 8 0 1 1 16 0', 'M12 17l4-5', 'M12 17h.01'],
  layers: ['M12 3 2 8l10 5 10-5-10-5Z', 'M2 13l10 5 10-5'],
  check: ['M5 12.5l4.5 4.5L19 7.5'],
  filter: ['M3 5h18l-7 8v6l-4-2v-4z'],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, label, strokeWidth = 2 }: {
  name: IconName;
  size?: number;
  label?: string;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      className="icon"
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Même pictogramme en chaîne SVG, pour les marqueurs Leaflet (HTML brut). */
export function iconSvg(name: IconName, size = 16, strokeWidth = 2.2): string {
  const paths = PATHS[name].map((d) => `<path d="${d}"/>`).join('');
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
