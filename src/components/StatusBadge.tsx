import type { StatusMeta } from '../domain/status';

interface Props {
  meta: StatusMeta;
  /** Préfixe lu par les lecteurs d'écran (ex. « Statut véhicule »). */
  srPrefix?: string;
  size?: 'sm' | 'md';
}

/** Statut = pictogramme + libellé + couleur (jamais la couleur seule). */
export function StatusBadge({ meta, srPrefix, size = 'sm' }: Props) {
  return (
    <span className={`badge badge--${meta.tone} badge--${size}`}>
      <span className="badge__glyph" aria-hidden="true">
        {meta.glyph}
      </span>
      {srPrefix && <span className="sr-only">{srPrefix} : </span>}
      {meta.label}
    </span>
  );
}
