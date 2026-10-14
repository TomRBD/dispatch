/**
 * Plaque d'immatriculation française (bande bleue « F » + caractères mono).
 * Une valeur qui n'est pas une immatriculation SIV s'affiche en étiquette simple.
 */
const SIV = /^[A-Z]{2}-\d{3}-[A-Z]{2}$/;

export function isPlate(value: string): boolean {
  return SIV.test(value);
}

export function Plate({ value, size = 'md' }: { value: string; size?: 'sm' | 'md' | 'lg' }) {
  if (!isPlate(value)) return <span className={`plate plate--plain plate--${size}`}>{value}</span>;
  return (
    <span className={`plate plate--${size}`}>
      <span className="sr-only">Immatriculation {value}</span>
      <span className="plate__band" aria-hidden="true">
        F
      </span>
      <span className="plate__text" aria-hidden="true">
        {value}
      </span>
    </span>
  );
}

/** Version HTML brute pour les marqueurs de carte. */
export function plateHtml(value: string, esc: (s: string) => string): string {
  return isPlate(value)
    ? `<span class="plate plate--sm"><span class="plate__band">F</span><span class="plate__text">${esc(value)}</span></span>`
    : `<span class="plate plate--plain plate--sm">${esc(value)}</span>`;
}
