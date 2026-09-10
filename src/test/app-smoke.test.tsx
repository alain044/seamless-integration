import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import App from "@/App";

/**
 * Functional check on the assembled app. The route table, the auth gate and the
 * provider stack only exist once something renders <App /> — every unit test in
 * this suite passes whether or not they were ever wired together. This renders
 * the real entry component and asserts what a visitor actually sees.
 *
 * Supabase is mocked rather than reached over the network: with no session the
 * data layer is unreachable anyway, and the point here is routing, not queries.
 */

vi.mock("@/integrations/supabase/client", () => {
  // Chainable, awaitable no-op: any supabase method returns itself, and
  // awaiting it yields `{ data: null, error: null }`. Proxy-based so that a new
  // `.from(...).select(...).eq(...).maybeSingle()` added to a mount effect
  // cannot break this test with an undefined method.
  const anyCall: any = new Proxy(function () {} as unknown as object, {
    get: (_t, prop) =>
      prop === "then" ? (res: (v: unknown) => void) => res({ data: null, error: null }) : anyCall,
    apply: () => anyCall,
  });

  const ok = async (payload: Record<string, unknown> = {}) => ({ data: payload, error: null });

  const auth: any = new Proxy(function () {} as unknown as object, {
    get: (_t, prop) => {
      if (prop === "then") return undefined;
      if (prop === "onAuthStateChange")
        return () => ({ data: { subscription: { unsubscribe: () => {} } } });
      // Each of these must be a *function* returning a promise — returning the
      // promise itself makes `supabase.auth.getSession()` throw.
      if (prop === "getSession") return () => ok({ session: null });
      if (prop === "getUser") return () => ok({ user: null });
      return () => ok({});
    },
  });

  return {
    supabase: {
      auth,
      from: () => anyCall,
      channel: () => anyCall,
      removeChannel: () => anyCall,
      rpc: () => anyCall,
    },
  };
});

/**
 * Renders the app at `path`. BrowserRouter reads the real location, so the URL
 * is set first; the render is wrapped in act() to flush AuthProvider's
 * getSession() promise, which would otherwise update state outside act().
 */
const renderAt = async (path: string) => {
  window.history.pushState({}, "", path);
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(<App />);
  });
  return view;
};

describe("App", () => {
  it("renders the marketing landing page at /", async () => {
    await renderAt("/");
    const headings = await screen.findAllByRole("heading", { level: 1 });
    expect(headings.some((h) => h.textContent?.includes("Smarter Finance"))).toBe(true);
    expect(screen.getAllByText(/Get Started Free/).length).toBeGreaterThan(0);
  });

  it("renders the 404 page for an unknown route", async () => {
    // NotFound logs the miss on purpose; don't let that noise reach the report.
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await renderAt("/definitely-not-a-route");
      expect(await screen.findByText("Oops! Page not found")).toBeTruthy();
    } finally {
      err.mockRestore();
    }
  });

  it("redirects a signed-out visitor from /dashboard to the auth page", async () => {
    await renderAt("/dashboard");
    // Reaching the auth screen proves the gate ran and did not render the
    // dashboard shell.
    expect(await screen.findByText(/sign in to your account/i)).toBeTruthy();
  });

  it("keeps the legacy /login route working", async () => {
    await renderAt("/login");
    expect(await screen.findByText(/sign in to your account/i)).toBeTruthy();
  });
});
