import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";
import ws from "ws";

// --- Local dev only: route the Neon serverless driver's HTTP/WebSocket
// traffic at the local `neon-proxy` container (see docker-compose.yml)
// instead of Neon's real cloud endpoint, so this adapter code runs
// unmodified against local Postgres. NODE_ENV is "development" here because
// `npm run dev` sets it automatically. In production this block never runs
// — untouched, still hits real Neon. ---
if (process.env.NODE_ENV === "development") {
  neonConfig.fetchEndpoint = () => "http://neon-proxy:4444/sql";
  neonConfig.wsProxy = () => "neon-proxy:4444/v2";
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = false;
}
// Node.js (unlike edge runtimes) has no native WebSocket, so PrismaNeon
// needs one supplied. Requires adding "ws" as a dependency (see below) —
// harmless in production too, it's just a polyfill the driver can use.
neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
