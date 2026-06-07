import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadPlugins } from './plugins.js';

const pluginDir = path.join(process.cwd(), '.tmp-plugin-test');
const originalPluginDir = process.env.PLUGIN_DIR;

afterEach(async () => {
  if (originalPluginDir === undefined) {
    delete process.env.PLUGIN_DIR;
  } else {
    process.env.PLUGIN_DIR = originalPluginDir;
  }
  await rm(pluginDir, { recursive: true, force: true });
});

describe('loadPlugins', () => {
  it('loads plugin modules from filesystem paths', async () => {
    const auditDir = path.join(pluginDir, 'audit-log');
    await mkdir(auditDir, { recursive: true });
    await writeFile(
      path.join(auditDir, 'plugin.json'),
      JSON.stringify({
        name: 'audit-log',
        version: '0.1.0',
        entrypoint: 'index.mjs',
        capabilities: ['event-handler'],
      }),
    );
    await writeFile(path.join(auditDir, 'index.mjs'), 'export function onEvent() {};\n');
    process.env.PLUGIN_DIR = pluginDir;

    const plugins = await loadPlugins();

    expect(plugins).toHaveLength(1);
    expect(plugins[0].onEvent).toEqual(expect.any(Function));
  });
});
