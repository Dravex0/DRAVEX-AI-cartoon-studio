import { mkdir, readdir, copyFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const sourceDir = resolve("node_modules/onnxruntime-web/dist");
const targetDir = resolve("public/vendor/onnxruntime");
const entries = await readdir(sourceDir);
const assets = entries.filter(name => /^ort-wasm.*\\.(?:wasm|mjs)$/u.test(name));

if (!assets.some(name => name.endsWith(".wasm"))) {
  throw new Error("ONNX Runtime Web WASM binary was not found in the installed package.");
}

await mkdir(targetDir, { recursive: true });
for (const name of assets) {
  await copyFile(join(sourceDir, name), join(targetDir, name));
}
process.stdout.write(`Copied ${assets.length} ONNX Runtime Web WASM assets.\\n`);
