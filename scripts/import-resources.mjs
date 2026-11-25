import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const [catalogDirectory, manifestPath] = process.argv.slice(2);
if (!catalogDirectory || !manifestPath) throw new Error('Provide an extracted Core catalog directory and a pinned manifest.');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
if (typeof manifest.version !== 'string' || !manifest.version) throw new Error('Resource version is required.');
const cultures = ['tr-TR', 'en-US'];
const snapshots = await Promise.all(cultures.map(async culture => {
  const file = culture + '.json';
  const content = await readFile(join(catalogDirectory, file));
  const hash = createHash('sha256').update(content).digest('hex');
  if (manifest.sha256?.[file]?.toLowerCase() !== hash) throw new Error('Catalog checksum mismatch for ' + file);
  const data = JSON.parse(content.toString('utf8').replace(/^\uFEFF/, ''));
  if (data === null || typeof data !== 'object' || Array.isArray(data) ||
      Object.values(data).some(value => typeof value !== 'string')) throw new Error('Invalid catalog ' + file);
  return { file, content };
}));
const output = new URL('../src/locales/core/', import.meta.url);
await mkdir(output, { recursive: true });
await Promise.all(snapshots.map(({ file, content }) => writeFile(new URL(file, output), content)));
await writeFile(new URL('manifest.json', output), JSON.stringify(manifest, null, 2) + '\n');
