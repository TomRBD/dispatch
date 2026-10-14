import { useCallback, useEffect, useRef, useState } from 'react';
import type { DispatchSnapshot } from '../domain/types';
import type { DispatchRepository } from './repository';

export interface DispatchDataState {
  snapshot: DispatchSnapshot | null;
  loading: boolean;
  /** Erreur bloquante du dernier chargement (les erreurs par source sont dans snapshot.sources). */
  error: string | null;
  refresh: () => void;
  autoRefresh: boolean;
  setAutoRefresh: (on: boolean) => void;
}

/**
 * Charge l'instantané d'exploitation, avec rafraîchissement manuel et
 * actualisation périodique optionnelle (suspendue quand l'onglet est masqué).
 */
export function useDispatchData(repo: DispatchRepository, intervalS: number): DispatchDataState {
  const [snapshot, setSnapshot] = useState<DispatchSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(intervalS > 0);
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    controller.current?.abort();
    const ctrl = new AbortController();
    controller.current = ctrl;
    setLoading(true);
    repo
      .load(ctrl.signal)
      .then((s) => {
        if (ctrl.signal.aborted) return;
        setSnapshot(s);
        setError(null);
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return;
        console.error('Chargement Dispatch impossible', e);
        // L'instantané précédent est conservé : l'interface affiche son âge.
        setError('Impossible de charger les données. Les dernières données reçues restent affichées.');
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
  }, [repo]);

  useEffect(() => {
    refresh();
    return () => controller.current?.abort();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh || intervalS <= 0) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh();
    }, intervalS * 1000);
    return () => window.clearInterval(id);
  }, [autoRefresh, intervalS, refresh]);

  return { snapshot, loading, error, refresh, autoRefresh, setAutoRefresh };
}

/** Horloge partagée pour recalculer les âges et retards sans recharger les données. */
export function useNow(stepMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), stepMs);
    return () => window.clearInterval(id);
  }, [stepMs]);
  return now;
}
