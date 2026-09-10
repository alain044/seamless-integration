import { describe, it, expect } from 'vitest';
import { readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { EDGE_FUNCTIONS, probeableFunctions, scheduledFunctions } from '@/lib/edgeFunctions';

const FUNCTIONS_DIR = join(process.cwd(), 'supabase/functions');

/** Directory names under supabase/functions that contain an index.ts. */
const deployedFunctions = (): string[] =>
  readdirSync(FUNCTIONS_DIR)
    .filter((entry) => statSync(join(FUNCTIONS_DIR, entry)).isDirectory())
    .filter((entry) => existsSync(join(FUNCTIONS_DIR, entry, 'index.ts')))
    .sort();

describe('edge function registry', () => {
  it('only lists functions that are actually deployed', () => {
    const deployed = new Set(deployedFunctions());
    const phantom = EDGE_FUNCTIONS.map((f) => f.name).filter((n) => !deployed.has(n));
    expect(phantom).toEqual([]);
  });

  it('lists every deployed function (this is the drift guard)', () => {
    const registered = new Set(EDGE_FUNCTIONS.map((f) => f.name));
    const unregistered = deployedFunctions().filter((n) => !registered.has(n));
    expect(unregistered).toEqual([]);
  });

  it('has no duplicate entries', () => {
    const names = EDGE_FUNCTIONS.map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('gives every entry a description and either a probe or a reason not to probe', () => {
    for (const fn of EDGE_FUNCTIONS) {
      expect(fn.description.trim(), `${fn.name} needs a description`).not.toBe('');
      if (fn.probe === null) {
        expect(fn.scheduledReason?.trim(), `${fn.name} needs scheduledReason`).toBeTruthy();
      } else {
        expect(fn.probe.expect.length, `${fn.name} needs expected statuses`).toBeGreaterThan(0);
      }
    }
  });

  it('never probes a cron entrypoint', () => {
    const cron = ['check-price-alerts', 'integrity-check-cron'];
    for (const name of cron) {
      const fn = EDGE_FUNCTIONS.find((f) => f.name === name);
      expect(fn, `${name} should be registered`).toBeDefined();
      expect(fn!.probe, `${name} must not be HTTP-probed`).toBeNull();
    }
    // And no other entry may be unprobed without also being declared scheduled.
    expect(scheduledFunctions().map((f) => f.name).sort()).toEqual([...cron].sort());
  });

  it('probes contact-message with a body that cannot create a row', () => {
    const fn = EDGE_FUNCTIONS.find((f) => f.name === 'send-contact-message')!;
    const body = fn.probe!.body as { name: string; email: string; message: string };
    // The function validates before inserting, so this must stay invalid.
    const looksValid = body.name.trim().length > 0 && body.message.trim().length >= 5 && body.email.includes('@');
    expect(looksValid).toBe(false);
    expect(fn.probe!.expect).toEqual([400]);
  });

  it('marks auth-gated functions as requiring auth', () => {
    const authGated = ['ai-usage-check', 'admin-stepup', 'ai-budget-suggest', 'ai-goal-coach', 'integrity-check', 'smartscan-extract'];
    for (const name of authGated) {
      const fn = EDGE_FUNCTIONS.find((f) => f.name === name);
      expect(fn?.requiresAuth, `${name} should require auth`).toBe(true);
    }
    // Public endpoints must not be flagged, or the panel would hide real failures.
    for (const name of ['finance-chat', 'ai-insights', 'market-quotes', 'exchange-rates']) {
      const fn = EDGE_FUNCTIONS.find((f) => f.name === name);
      expect(fn?.requiresAuth, `${name} should not require auth`).toBeFalsy();
    }
  });

  it('never lets a probe consume AI credits or mutate the caller\'s data', () => {
    // These three do AI generation for an authenticated user. Probing them with a
    // session would spend credits, so the anonymous rejection must be the signal.
    for (const name of ['ai-budget-suggest', 'ai-goal-coach', 'ai-usage-check']) {
      const fn = EDGE_FUNCTIONS.find((f) => f.name === name)!;
      expect(fn.probe?.expect, `${name} must be probed anonymously`).toEqual([401]);
    }

    // Any auth-gated entry may only expect a rejection, or an explicitly read-only
    // 200 (admin-check answers {verified:false} without running work).
    for (const fn of EDGE_FUNCTIONS.filter((f) => f.requiresAuth)) {
      const expectCodes = fn.probe!.expect;
      const allowed = fn.name === 'admin-check' ? [200] : [401];
      expect(expectCodes, `${fn.name} probe expectation`).toEqual(allowed);
    }
  });

  it('reports a non-empty, partitioned set', () => {
    expect(EDGE_FUNCTIONS.length).toBe(14);
    expect(probeableFunctions().length).toBe(12);
    expect(scheduledFunctions().length).toBe(2);
  });
});
