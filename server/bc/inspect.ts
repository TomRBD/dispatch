/**
 * `npm run bc:inspect` — liste les champs réels de Tournee_Excel et
 * Mission_Excel pour compléter server/bc/mapping.ts.
 *
 * N'affiche ni le token ni de lignes complètes : uniquement le nom des champs,
 * leur type, leur taux de remplissage et, pour les champs texte à peu de
 * valeurs distinctes (statuts typiquement), ces valeurs.
 * Le résultat est aussi écrit dans bc-inspect.txt (non versionné).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT_DIR, bcConfigured, serverConfig } from '../config';
import { fetchEntity } from './odata';

const SAMPLE = 200;
const MAX_DISTINCT = 12;

function kind(v: unknown): string {
  if (v === null || v === undefined) return 'vide';
  if (typeof v === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) return 'datetime';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'date';
    if (/^\d{2}:\d{2}(:\d{2})?/.test(v)) return 'heure';
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
    if (kinds === 'texte') {
      const distinct = [...new Set(filled.map(String))];
      if (distinct.length <= MAX_DISTINCT) {
        line += ` — valeurs : ${distinct.map((d) => JSON.stringify(d.slice(0, 40))).join(', ')}`;
      } else {
        line += ` — ${distinct.length}+ valeurs distinctes`;
      }
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
  const { tourneeEntity, missionEntity } = serverConfig.bc;
  const out: string[] = [];
  for (const entity of [tourneeEntity, missionEntity]) {
    try {
      out.push(describe(entity, await fetchEntity(entity, { top: SAMPLE })));
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
