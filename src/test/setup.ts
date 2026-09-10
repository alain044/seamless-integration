import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom ships neither observer. Radix primitives and sonner construct both on
// mount, so rendering <App /> (or any overlay) throws without these stubs.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

Object.defineProperty(window, "ResizeObserver", { writable: true, value: NoopObserver });
Object.defineProperty(window, "IntersectionObserver", { writable: true, value: NoopObserver });
Object.defineProperty(globalThis, "ResizeObserver", { writable: true, value: NoopObserver });

// Radix scroll-locks and cmdk call these during layout.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!window.scrollTo) {
  window.scrollTo = (() => {}) as typeof window.scrollTo;
}
