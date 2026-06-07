import { access, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pluginManifestSchema, type EventEnvelope } from '@pulsestack/contracts';
import { loadEnv } from './config.js';

export interface PulsePluginModule {
  onEvent?(event: EventEnvelope): Promise<void> | void;
}

export async function loadPlugins() {
  const env = loadEnv();
  const pluginDir = path.resolve(env.PLUGIN_DIR);
  await access(pluginDir).catch(() => null);
  const entries = await readdir(pluginDir, { withFileTypes: true }).catch(() => []);
  const loaded: PulsePluginModule[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(pluginDir, entry.name, 'plugin.json');
    const manifestJson = await import(pathToFileURL(manifestPath).href, { with: { type: 'json' } }).catch(() => null);
    if (!manifestJson) continue;
    let manifest;
    try {
      manifest = pluginManifestSchema.parse(manifestJson.default);
    } catch (parseError) {
      // Isolate schema validation failures so a single malformed plugin.json
      // does not abort loading for all remaining plugins in the directory.
      console.error(`[plugins] skipping "${entry.name}": manifest validation failed`, parseError);
      continue;
    }
    let mod: PulsePluginModule;
    try {
      const modulePath = path.join(pluginDir, entry.name, manifest.entrypoint);
      mod = (await import(pathToFileURL(modulePath).href)) as PulsePluginModule;
    } catch (importError) {
      console.error(`[plugins] skipping "${entry.name}": failed to import entrypoint`, importError);
      continue;
    }
    loaded.push(mod);
  }

  return loaded;
}
