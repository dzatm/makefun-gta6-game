// Entry point for the make.fun "Make GTA 6" bounty.
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json describing the entry. Run with:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// (Node's built-in TypeScript type stripping runs this file directly.)
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const OUT = process.env.MAKEFUN_OUTPUT_DIR || 'out';
const ROOT = resolve(import.meta.dirname || '.');

function listFiles(dir, base) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...listFiles(p, join(base, name)));
    else out.push(join(base, name));
  }
  return out;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const gameFiles = [];
  for (const src of ['game', 'screenshots']) {
    const srcPath = join(ROOT, src);
    if (!existsSync(srcPath)) continue;
    cpSync(srcPath, join(OUT, src), { recursive: true });
    gameFiles.push(...listFiles(srcPath, src));
  }

  // The kit's vendored helper, when it exposes a dossier builder, is
  // used for the dossier; otherwise a plain dossier is written.
  let vendorDossier = null;
  try {
    const vendor = await import('./vendor/makefun-game.ts');
    const fn = vendor.buildDossier || vendor.writeDossier || vendor.handIn || vendor.default;
    if (typeof fn === 'function') {
      vendorDossier = fn({ title: 'Solmarina: Streets of Gold', files: gameFiles, outDir: OUT });
    }
  } catch (e) {
    vendorDossier = null;
  }

  const dossier = vendorDossier || {
    title: 'Solmarina: Streets of Gold',
    description: 'An original top-down 2D open-world crime game in the spirit of GTA 6: a seeded coastal city, drivable cars and a motorcycle, a 0-5 star wanted system with coordinated police, five weapons, seven story missions, weather, day/night, economy, saves and photo mode. Vanilla Canvas/JS, fully offline.',
    entrypoint: 'game/index.html',
    files: gameFiles,
    screenshots: ['screenshots/1-start.jpg', 'screenshots/2-drive.jpg', 'screenshots/3-chase.jpg', 'screenshots/4-mission.jpg'],
    run: 'node serve.ts',
  };
  writeFileSync(join(OUT, 'dossier.json'), JSON.stringify(dossier, null, 2) + '\n');
  console.log(`Handed in ${join(OUT, 'dossier.json')} (${gameFiles.length} files)`);
}

await main();
