import { cp, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
execFileSync(process.execPath, [process.env.npm_execpath, '--prefix', 'v2', 'run', 'build'], {
  cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'inherit',
});
// Only the fixed output is removed; source archives and dependencies stay private.
const output = new URL('../dist/', import.meta.url);
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of ['index.html', '.nojekyll', 'screenshot.png', 'v1']) {
  await cp(new URL(`../${path}`, import.meta.url), new URL(path, output), { recursive: true });
}
await cp(new URL('../v2/dist/', import.meta.url), new URL('v2/', output), { recursive: true });
console.log('Built static site: default v2, /v1/, /v2/');
