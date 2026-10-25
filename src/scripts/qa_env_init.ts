import { AsyncLocalStorage } from "node:async_hooks";

// Provide global AsyncLocalStorage so Next.js internal storage initializes properly in test runtime
if (typeof globalThis !== "undefined") {
  (globalThis as any).AsyncLocalStorage = AsyncLocalStorage;
}
