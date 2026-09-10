import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HealthCheckPanel } from '@/components/HealthCheckPanel';
import { EDGE_FUNCTIONS, probeableFunctions } from '@/lib/edgeFunctions';

/**
 * Functional check: the panel must render every registered function and honour
 * each probe's expected statuses. A unit test on the registry alone would not
 * catch the list being hardcoded in the component again.
 */

const fakeResponse = (status: number) =>
  ({ ok: status < 400, status, clone: () => ({ json: async () => ({}) }), body: null }) as any;

const statusFor = (url: string): number => {
  const hit = probeableFunctions().find((f) => url.includes(`/functions/v1/${f.name}`));
  if (!hit) return 404;
  return hit.probe!.expect[0];
};

describe('HealthCheckPanel', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: any) => fakeResponse(statusFor(String(input)))));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders a row for every registered edge function', async () => {
    render(<HealthCheckPanel />);
    for (const fn of EDGE_FUNCTIONS) {
      expect(await screen.findByText(fn.name), `${fn.name} row missing`).toBeTruthy();
    }
  });

  it('never issues a request for scheduled functions', async () => {
    render(<HealthCheckPanel />);
    await waitFor(() => expect((fetch as any).mock.calls.length).toBeGreaterThan(0));

    const requested = (fetch as any).mock.calls.map((c: any[]) => String(c[0]));
    for (const name of ['check-price-alerts', 'integrity-check-cron']) {
      expect(
        requested.some((u: string) => u.includes(name)),
        `${name} must not be probed`,
      ).toBe(false);
    }
  });

  it('reports every probeable service as healthy against its declared expectation', async () => {
    render(<HealthCheckPanel />);
    const count = probeableFunctions().length;
    // The paragraph also carries the "scheduled" suffix, so match on a pattern.
    const el = await screen.findByText(new RegExp(`${count}\\/${count} probed services healthy`));
    expect(el.textContent).toContain('2 scheduled, not probed');
  });
});
