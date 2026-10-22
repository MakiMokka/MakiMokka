import '@testing-library/jest-dom/vitest';

// jsdom no implementa matchMedia; se simula una pantalla amplia.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: /min-width/.test(query),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
