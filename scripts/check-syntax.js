import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT_CONFIGS = ['vite.config.js', 'playwright.config.js'];
const SCAN_DIRECTORIES = ['src', 'tests', 'scripts', 'vendor'];
const EXTENSIONS = new Set(['.js', '.mjs', '.cjs']);
const IGNORED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'coverage', 'playwright-report', 'test-results']);

function collectJavaScriptFiles(directory, output = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!IGNORED_DIRECTORIES.has(entry.name)) collectJavaScriptFiles(path.join(directory, entry.name), output);
      continue;
    }
    if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      output.push(path.join(directory, entry.name));
    }
  }
  return output;
}

const files = ROOT_CONFIGS
  .map(file => path.join(ROOT, file))
  .filter(file => {
    try { return readdirSync(ROOT).includes(path.basename(file)); } catch { return false; }
  });
for (const directory of SCAN_DIRECTORIES) {
  const absolute = path.join(ROOT, directory);
  try { files.push(...collectJavaScriptFiles(absolute)); } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}
files.sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

process.stdout.write('Syntax checked ' + files.length + ' JavaScript files.\\n');
