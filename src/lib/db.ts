import { neonConfig } from "@neondatabase/serverless";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../generated/prisma/client";
import ws from "ws";

// Local Docker only: route the Neon driver at the local neon-proxy container.
// Turned on by USE_LOCAL_NEON_PROXY=true (set in docker-compose.yml), not by
// NODE_ENV, so plain `npm run dev` and production still use real Neon.
if (process.env.USE_LOCAL_NEON_PROXY === "true") {
  neonConfig.fetchEndpoint = () => "http://neon-proxy:4444/sql";
  neonConfig.wsProxy = () => "neon-proxy:4444/v2";
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineConnect = false;
}
// Node.js has no native WebSocket, so the Neon adapter needs one supplied.
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