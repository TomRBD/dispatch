/**
 * `npm run bc:inspect` — liste les champs réels de Tournee_Excel et
 * Mission_Excel pour compléter server/bc/mapping.ts.
 *
 *   npm run bc:inspect                         → les deux entités par défaut
 *   npm run bc:inspect -- 2026-10-14           → limité à une journée (Tour_Date)
 *   npm run bc:inspect -- Mission_WCAP [date]  → n'importe quelle entité OData
 *
 * N'affiche ni le token ni de lignes complètes : uniquement le nom des champs,
 * leur type, leur taux de remplissage et, pour les champs texte à peu de
 * valeurs distinctes (statuts typiquement), ces valeurs.
 * Le résultat est aussi écrit dans bc-inspect.txt (non versionné).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT_DIR, bcConfigured, serverConfig } from '../config';
import { BC_MAPPING } from './mapping';
import { BcHttpError, fetchEntity } from './odata';

const SAMPLE = 200;
const MAX_DISTINCT = 12;

function kind(v: unknown): string {
  if (v === null || v === undefined) return 'vide';
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return 'datetime';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'date';
    if (/^\d{2}:\d{2}(:\d{2})?/.test(v)) return 'heure';
    if (/^P\d*D?T/.test(v)) return 'durée';
    return 'texte';
  }
  return typeof v;
}

function describe(entity: string, rows: Record<string, unknown>[]): string {
  const lines = [`=== ${entity} — ${rows.length} ligne(s) échantillonnée(s) ===`];
  if (rows.length === 0) return [...lines, '(aucune ligne)'].join('\n');
  const fields = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((f) => !f.startsWith('@odata'));
  for (const f of fields) {
    const values = rows.map((r) => r[f]);
    const filled = values.filter((v) => v !== null && v !== undefined && v !== '' && !String(v).startsWith('0001-01-01'));
    const kinds = [...new Set(filled.map(kind))].join('/') || 'vide';
    let line = `- ${f} : ${kinds}, rempli ${filled.length}/${rows.length}`;
    if (kinds === 'texte' || kinds === 'durée') {
      const distinct = [...new Set(filled.map(String))];
      if (distinct.length <= MAX_DISTINCT) {
        line += ` — valeurs : ${distinct.map((d) => JSON.stringify(d.slice(0, 40))).join(', ')}`;
      } else {
        line += ` — ${distinct.length}+ valeurs distinctes`;
      }
    } else if (kinds === 'boolean') {
      line += ` — vrai ${filled.filter((v) => v === true).length}, faux ${filled.filter((v) => v === false).length}`;
    } else if (kinds === 'number') {
      line += ` — non nul ${filled.filter((v) => v !== 0).length}/${rows.length}`;
    } else if (kinds === 'heure') {
      // Heures significatives (00:00:00 = non renseignée) : repère les horodatages réels.
      const set = filled.map(String).filter((v) => !/^00:00(:00)?/.test(v)).sort();
      line += set.length ? ` — renseignée ${set.length}, de ${set[0]!.slice(0, 5)} à ${set.at(-1)!.slice(0, 5)}` : ' — toujours 00:00';
    } else if (kinds === 'datetime') {
      const set = filled.map(String).sort();
      line += ` — de ${set[0]!.slice(0, 16)} à ${set.at(-1)!.slice(0, 16)}`;
    }
    lines.push(line);
  }
  return lines.join('\n');
}

async function main() {
  if (!bcConfigured()) {
    console.error('BC_TENANT_ID et BC_COMPANY doivent être renseignés dans server/.env');
    process.exit(1);
  }
  const args = process.argv.slice(2);
  const day = args.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const names = args.filter((a) => a !== day);
  if (names.some((n) => !/^[A-Za-z0-9_]+$/.test(n))) {
    console.error("Nom d'entité invalide (lettres, chiffres et _ uniquement) ; date au format AAAA-MM-JJ");
    process.exit(1);
  }
  const { tourneeEntity, missionEntity } = serverConfig.bc;
  const targets: [string, string | null][] = names.length
    ? names.map((n) => [n, 'Tour_Date'])
    : [
        [tourneeEntity, BC_MAPPING.tournee.date],
        [missionEntity, BC_MAPPING.mission.date],
      ];
  const out: string[] = day ? [`Journée : ${day}`] : [];
  for (const [entity, dateField] of targets) {
    try {
      const filter = day && dateField ? `${dateField} eq ${day}` : undefined;
      let rows: Record<string, unknown>[];
      let note = '';
      try {
        rows = await fetchEntity(entity, { top: SAMPLE, filter });
      } catch (e) {
        // L'entité n'a peut-être pas de champ Tour_Date : échantillon sans filtre de date.
        if (!filter || !(e instanceof BcHttpError) || e.status !== 400) throw e;
        rows = await fetchEntity(entity, { top: SAMPLE });
        note = ` (pas de champ ${dateField} : échantillon sans filtre de date)`;
      }
      out.push(describe(entity + note, rows));
    } catch (e) {
      out.push(`=== ${entity} — ERREUR : ${(e as Error).message}`);
    }
  }
  const report = out.join('\n\n');
  console.log(report);
  writeFileSync(resolve(ROOT_DIR, 'bc-inspect.txt'), `${report}\n`);
  console.log('\nRésultat enregistré dans bc-inspect.txt — relisez-le avant de le partager.');
}

void main();
