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
    const manifest = pluginManifestSchema.parse(manifestJson.default);
    const modulePath = path.join(pluginDir, entry.name, manifest.entrypoint);
    const mod = (await import(pathToFileURL(modulePath).href)) as PulsePluginModule;
    loaded.push(mod);
  }

  return loaded;
}
