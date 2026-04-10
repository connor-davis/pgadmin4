import { Electroview } from "electrobun/view";
import type { PgAdminRPCSchema } from "../rpc-schema";

// Create typed RPC handler for the webview side.
// The webview doesn't handle incoming requests from bun (empty requests).
const rpc = Electroview.defineRPC<PgAdminRPCSchema>({
  maxRequestTime: 30_000, // 30 seconds to accommodate longer-running queries
  handlers: {
    requests: {},
    messages: {},
  },
});

const electroview = new Electroview({ rpc });

// Expose the rpc object globally so the Vite-bundled React app can call bun handlers
// without importing Bun-only modules (which Vite can't bundle).
(window as any).__pgRpc = electroview.rpc;
