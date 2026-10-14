/** Formats d'affichage partagés par les composants. */

const kmFmt = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const pctFmt = new Intl.NumberFormat('fr-FR', {
  style: 'percent',
  maximumFractionDigits: 0,
  signDisplay: 'exceptZero',
});

export const formatKm = (km?: number) => (km === undefined ? '—' : `${kmFmt.format(km)} km`);
export const formatSignedKm = (km: number) =>
  `${km > 0 ? '+' : km < 0 ? '−' : ''}${kmFmt.format(Math.abs(km))} km`;
export const formatPct = (ratio: number) => pctFmt.format(ratio).replace('-', '−');
