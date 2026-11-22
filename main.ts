// Entry point for the make.fun "Make GTA 6" bounty.
// Copies game/ and screenshots/ into the output directory and writes
// dossier.json exactly as the kit's buildDossier writes it. Run with:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// (Node's built-in TypeScript type stripping runs this file directly.)
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { buildDossier } from './vendor/makefun-game.ts';

const OUT = resolve(process.env.MAKEFUN_OUTPUT_DIR || 'out');
const ROOT = resolve(import.meta.dirname || '.');

// The caps the bounty's scorer passes buildDossier from its gate.json
// (see the header of vendor/makefun-game.ts): the text cap shapes the
// dossier bytes, the other caps only refuse input past them.
const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

// The most bytes game/ and screenshots/ may cost together: the gate's
// dossier_matches row caps the hand-in at 1536 KiB.
const HANDIN_MAX_BYTES = 1536 * 1024;

/** The files' bytes under a directory, summed recursively. */
function dirBytes(dir) {
  let total = 0;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    total += st.isDirectory() ? dirBytes(p) : st.size;
  }
  return total;
}

function main() {
  mkdirSync(OUT, { recursive: true });
  for (const src of ['game', 'screenshots']) {
    const srcPath = join(ROOT, src);
    if (!existsSync(srcPath)) throw new Error(`missing ${src}/ in ${ROOT}`);
    cpSync(srcPath, join(OUT, src), { recursive: true });
  }
  // Fail loudly where the scorer would refuse, instead of handing in a
  // dossier the gate rejects.
  const handinBytes = dirBytes(join(OUT, 'game')) + dirBytes(join(OUT, 'screenshots'));
  if (handinBytes > HANDIN_MAX_BYTES) {
    throw new Error(`game/ + screenshots/ come to ${handinBytes} bytes, over the ${HANDIN_MAX_BYTES} the gate allows`);
  }
  // buildDossier returns the dossier (makefun/dossier/v1) as canonical
  // JSON bytes: write them exactly, with no reformatting and no fallback.
  // If the input is past a cap it throws, and main.ts fails loudly.
  const dossier = buildDossier(OUT, CAPS);
  writeFileSync(join(OUT, 'dossier.json'), dossier);
  console.log(`Handed in ${join(OUT, 'dossier.json')} (${dossier.length} bytes; game/ + screenshots/ ${handinBytes} bytes)`);
}

main();
