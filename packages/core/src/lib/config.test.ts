import { describe, expect, it } from 'vitest';
import { loadEnv } from './config.js';

describe('loadEnv', () => {
  it('parses explicit false boolean environment values', () => {
    expect(loadEnv({ AUTH_DISABLED: 'false' }).AUTH_DISABLED).toBe(false);
    expect(loadEnv({ AUTH_DISABLED: '0' }).AUTH_DISABLED).toBe(false);
  });

  it('parses explicit true boolean environment values', () => {
    expect(loadEnv({ AUTH_DISABLED: 'true' }).AUTH_DISABLED).toBe(true);
    expect(loadEnv({ AUTH_DISABLED: '1' }).AUTH_DISABLED).toBe(true);
  });
});
