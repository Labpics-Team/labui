/// <reference types="vite/client" />

// Brings Vite's ambient client types into the docs typecheck — notably the
// typed `import.meta.glob`, which the auto-discovered component registry
// (`template/registry.ts`) relies on. Without this reference, `tsc --noEmit`
// in CI fails before the build step ever runs.
