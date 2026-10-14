/**
 * `npm run webfleet:inspect` — vérifie l'accès WEBFLEET.connect et liste les
 * champs réellement renvoyés par showObjectReportExtern, ainsi que le
 * rapprochement des immatriculations. N'affiche ni identifiants ni positions.
 * Résultat aussi écrit dans webfleet-inspect.txt (non versionné).
 */
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT_DIR, serverConfig, webfleetConfigured } from '../config';
import { fetchObjectReport } from './client';
import { transformWebfleet } from './transform';

async function main() {
  if (!webfleetConfigured()) {
    console.error('WEBFLEET_ACCOUNT, WEBFLEET_USERNAME, WEBFLEET_PASSWORD et WEBFLEET_API_KEY doivent être renseignés dans .env');
    process.exit(1);
  }
  const lines: string[] = [];
  try {
    const rows = await fetchObjectReport();
    lines.push(`=== showObjectReportExtern — ${rows.length} objet(s) ===`);
    const fields = [...new Set(rows.flatMap((r) => Object.keys(r)))].sort();
    for (const f of fields) {
      const filled = rows.filter((r) => r[f] !== undefined && r[f] !== null && r[f] !== '').length;
      const types = [...new Set(rows.map((r) => typeof r[f]).filter((t) => t !== 'undefined'))].join('/');
      let line = `- ${f} : ${types}, rempli ${filled}/${rows.length}`;
      if (['ignition', 'standstill', 'tripmode', 'objectclassname'].includes(f)) {
        line += ` — valeurs : ${[...new Set(rows.map((r) => JSON.stringify(r[f])))].slice(0, 10).join(', ')}`;
      }
      lines.push(line);
    }
    const vehicles = transformWebfleet(rows, serverConfig.webfleet.showDriverNames);
    const matched = vehicles.filter((v) => !v.id.startsWith('webfleet:'));
    lines.push('', `Immatriculations reconnues : ${matched.length}/${vehicles.length}`);
    lines.push(`Avec position : ${vehicles.filter((v) => v.position).length}/${vehicles.length}`);
    const counts = vehicles.reduce<Record<string, number>>((acc, v) => ((acc[v.status] = (acc[v.status] ?? 0) + 1), acc), {});
    lines.push(`États : ${JSON.stringify(counts)}`);
    const unmatched = vehicles.filter((v) => v.id.startsWith('webfleet:')).map((v) => v.registration);
    if (unmatched.length) lines.push(`Sans immatriculation reconnue : ${unmatched.slice(0, 20).join(', ')}`);
  } catch (e) {
    lines.push(`ERREUR : ${(e as Error).message}`);
  }
  const report = lines.join('\n');
  console.log(report);
  writeFileSync(resolve(ROOT_DIR, 'webfleet-inspect.txt'), `${report}\n`);
  console.log('\nRésultat enregistré dans webfleet-inspect.txt — relisez-le avant de le partager.');
}

void main();
