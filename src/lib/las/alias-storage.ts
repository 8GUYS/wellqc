import fs from "fs";
import path from "path";
import { CustomAliasEntry } from "./standardiser";
import { db } from "@/lib/db";

const DATA_DIR = path.join(process.cwd(), "data");
const ALIASES_FILE = path.join(DATA_DIR, "custom-aliases.json");

function ensureDirectoryExists() {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      // Read-only filesystem in serverless production
    }
  }
}

export function readAllCustomAliasesFromFile(): CustomAliasEntry[] {
  try {
    ensureDirectoryExists();
    if (!fs.existsSync(ALIASES_FILE)) {
      try {
        fs.writeFileSync(ALIASES_FILE, JSON.stringify([], null, 2), "utf8");
      } catch {
        // Read-only filesystem
      }
      return [];
    }
    const raw = fs.readFileSync(ALIASES_FILE, "utf8");
    if (!raw.trim()) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch (error) {
    console.warn("Failed to read custom aliases file:", error);
    return [];
  }
}

export function writeCustomAliasesToFile(aliases: CustomAliasEntry[]): boolean {
  try {
    ensureDirectoryExists();
    fs.writeFileSync(ALIASES_FILE, JSON.stringify(aliases, null, 2), "utf8");
    return true;
  } catch (error) {
    // In serverless/production (read-only filesystem on Vercel), gracefully catch
    console.warn("Notice: File write skipped in read-only environment:", (error as Error)?.message || error);
    return false;
  }
}

/**
 * Filter custom aliases strictly to the specified user/account.
 * Backward compatibility: unassigned legacy entries are matched by addedBy to preserve existing data.
 */
export function readCustomAliasesForUser(
  user?: { id?: string; email?: string; name?: string } | null
): CustomAliasEntry[] {
  const all = readAllCustomAliasesFromFile();

  if (!user || (!user.id && !user.email)) {
    // Demo or unauthenticated context
    return all.filter(
      (e) => !e.userId || e.userId === "demo-petrophysicist-uuid"
    );
  }

  const userId = user.id?.trim();
  const userEmail = user.email?.trim().toLowerCase();
  const userName = user.name?.trim().toLowerCase();

  return all.filter((entry) => {
    // 1. Explicit userId match
    if (entry.userId) {
      return entry.userId === userId;
    }
    // 2. Explicit email match
    if (entry.userEmail && userEmail) {
      return entry.userEmail.toLowerCase() === userEmail;
    }
    // 3. Fallback for unassigned legacy entries: match by addedBy author name
    if (entry.addedBy && userName) {
      return entry.addedBy.toLowerCase() === userName;
    }
    return false;
  });
}

/**
 * Alias helper for backward-compatibility with existing calls:
 * If a userId or filter string is passed, filters by user; otherwise returns all.
 */
export function readCustomAliasesFromFile(userId?: string): CustomAliasEntry[] {
  if (userId) {
    return readCustomAliasesForUser({ id: userId });
  }
  return readAllCustomAliasesFromFile();
}

/**
 * Saves a new custom alias strictly bound to the user's account.
 */
export function saveUserCustomAlias(
  user: { id?: string; email?: string; name?: string } | null,
  newEntry: CustomAliasEntry
): CustomAliasEntry[] {
  const all = readAllCustomAliasesFromFile();
  const userId = user?.id || "demo-petrophysicist-uuid";
  const userEmail = user?.email || "";

  const entryWithAccount: CustomAliasEntry = {
    ...newEntry,
    userId,
    userEmail,
  };

  const updatedAll = [...all, entryWithAccount];
  writeCustomAliasesToFile(updatedAll);

  return readCustomAliasesForUser(user);
}

/**
 * Updates a custom alias owned by the user's account.
 */
export function updateUserCustomAlias(
  user: { id?: string; email?: string; name?: string } | null,
  standardMnemonic: string,
  oldAlias: string,
  newAlias: string
): { success: boolean; error?: string; aliases: CustomAliasEntry[]; entry?: CustomAliasEntry } {
  const all = readAllCustomAliasesFromFile();
  const cleanMnem = standardMnemonic.trim().toUpperCase();
  const cleanOld = oldAlias.trim().toUpperCase();
  const cleanNew = newAlias.trim().toUpperCase();

  const userAliases = readCustomAliasesForUser(user);
  const targetInUser = userAliases.find(
    (e) =>
      e.standardMnemonic.toUpperCase() === cleanMnem &&
      e.alias.toUpperCase() === cleanOld
  );

  if (!targetInUser) {
    return {
      success: false,
      error: `Alias "${oldAlias}" was not found under ${cleanMnem} for your account.`,
      aliases: userAliases,
    };
  }

  const index = all.findIndex((e) => e.id === targetInUser.id);
  if (index === -1) {
    return {
      success: false,
      error: "Alias not found.",
      aliases: userAliases,
    };
  }

  const updatedEntry: CustomAliasEntry = {
    ...all[index],
    alias: cleanNew,
    addedAt: new Date().toISOString(),
  };

  all[index] = updatedEntry;
  writeCustomAliasesToFile(all);

  return {
    success: true,
    entry: updatedEntry,
    aliases: readCustomAliasesForUser(user),
  };
}

/**
 * Updates a custom alias in the shared enterprise dictionary.
 */
export function updateSharedCustomAlias(
  standardMnemonic: string,
  oldAlias: string,
  newAlias: string
): { success: boolean; error?: string; aliases: CustomAliasEntry[]; entry?: CustomAliasEntry } {
  const all = readAllCustomAliasesFromFile();
  const cleanMnem = standardMnemonic.trim().toUpperCase();
  const cleanOld = oldAlias.trim().toUpperCase();
  const cleanNew = newAlias.trim().toUpperCase();

  const targetIndex = all.findIndex(
    (e) =>
      e.standardMnemonic.toUpperCase() === cleanMnem &&
      e.alias.toUpperCase() === cleanOld
  );

  if (targetIndex === -1) {
    return {
      success: false,
      error: `Alias "${oldAlias}" was not found under ${cleanMnem}.`,
      aliases: all,
    };
  }

  const updatedEntry: CustomAliasEntry = {
    ...all[targetIndex],
    alias: cleanNew,
    addedAt: new Date().toISOString(),
  };

  all[targetIndex] = updatedEntry;
  writeCustomAliasesToFile(all);

  return {
    success: true,
    entry: updatedEntry,
    aliases: all,
  };
}

/**
 * Deletes a custom alias from the shared enterprise dictionary.
 */
export function deleteSharedCustomAlias(
  standardMnemonic: string,
  alias: string
): { success: boolean; error?: string; aliases: CustomAliasEntry[] } {
  const all = readAllCustomAliasesFromFile();
  const cleanMnem = standardMnemonic.trim().toUpperCase();
  const cleanAlias = alias.trim().toUpperCase();

  const target = all.find(
    (e) =>
      e.standardMnemonic.toUpperCase() === cleanMnem &&
      e.alias.toUpperCase() === cleanAlias
  );

  if (!target) {
    return {
      success: false,
      error: `Alias "${alias}" was not found under ${cleanMnem}.`,
      aliases: all,
    };
  }

  const updatedAll = all.filter((e) => e.id !== target.id);
  writeCustomAliasesToFile(updatedAll);

  return {
    success: true,
    aliases: updatedAll,
  };
}

/**
 * Deletes a custom alias owned by the user's account.
 */
export function deleteUserCustomAlias(
  user: { id?: string; email?: string; name?: string } | null,
  standardMnemonic: string,
  alias: string
): { success: boolean; error?: string; aliases: CustomAliasEntry[] } {
  const all = readAllCustomAliasesFromFile();
  const cleanMnem = standardMnemonic.trim().toUpperCase();
  const cleanAlias = alias.trim().toUpperCase();

  const userAliases = readCustomAliasesForUser(user);
  const targetInUser = userAliases.find(
    (e) =>
      e.standardMnemonic.toUpperCase() === cleanMnem &&
      e.alias.toUpperCase() === cleanAlias
  );

  if (!targetInUser) {
    return {
      success: false,
      error: `Alias "${alias}" was not found under ${cleanMnem} for your account.`,
      aliases: userAliases,
    };
  }

  const updatedAll = all.filter((e) => e.id !== targetInUser.id);
  writeCustomAliasesToFile(updatedAll);

  return {
    success: true,
    aliases: readCustomAliasesForUser(user),
  };
}

let hasEnsuredTable = false;
async function ensureDbTableExists() {
  if (hasEnsuredTable) return;
  try {
    await db.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "CustomAlias" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "alias" TEXT NOT NULL,
        "standardMnemonic" TEXT NOT NULL,
        "addedBy" TEXT NOT NULL,
        "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "userId" TEXT,
        "userEmail" TEXT,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX IF NOT EXISTS "CustomAlias_standardMnemonic_alias_userId_key" 
      ON "CustomAlias"("standardMnemonic", "alias", "userId");
      CREATE INDEX IF NOT EXISTS "CustomAlias_userId_idx" ON "CustomAlias"("userId");
      CREATE INDEX IF NOT EXISTS "CustomAlias_userEmail_idx" ON "CustomAlias"("userEmail");
    `);
    hasEnsuredTable = true;
  } catch {
    // Continue if already exists or permission restricted
  }
}

/**
 * Async query for custom aliases from Neon PostgreSQL (with fallback to local file)
 * strictly isolated to the specified user/account.
 */
export async function getCustomAliasesForUserAsync(
  user?: { id?: string; email?: string; name?: string } | null
): Promise<CustomAliasEntry[]> {
  // In unit test runner (Jest), use file storage directly
  if (process.env.NODE_ENV === "test") {
    return readCustomAliasesForUser(user);
  }

  try {
    await ensureDbTableExists();

    const userId = user?.id?.trim();
    const userEmail = user?.email?.trim().toLowerCase();
    const userName = user?.name?.trim().toLowerCase();

    const orConditions: Array<{
      userId?: string;
      userEmail?: { equals: string; mode: "insensitive" };
      addedBy?: { equals: string; mode: "insensitive" };
    }> = [];

    if (userId) {
      orConditions.push({ userId });
    }
    if (userEmail) {
      orConditions.push({ userEmail: { equals: userEmail, mode: "insensitive" } });
    }
    if (userName) {
      orConditions.push({ addedBy: { equals: userName, mode: "insensitive" } });
    }

    const where = orConditions.length > 0
      ? { OR: orConditions }
      : {
          OR: [
            { userId: "demo-petrophysicist-uuid" },
            { userId: null },
            { userId: "" },
          ],
        };

    const rows = await db.customAlias.findMany({
      where,
      orderBy: { addedAt: "asc" },
    });

    const dbEntries: CustomAliasEntry[] = rows.map((r: {
      id: string;
      alias: string;
      standardMnemonic: string;
      addedBy: string;
      addedAt: Date | string;
      userId: string | null;
      userEmail: string | null;
    }) => ({
      id: r.id,
      alias: r.alias,
      standardMnemonic: r.standardMnemonic,
      addedBy: r.addedBy,
      addedAt: r.addedAt instanceof Date ? r.addedAt.toISOString() : String(r.addedAt),
      userId: r.userId || undefined,
      userEmail: r.userEmail || undefined,
    }));

    if (dbEntries.length > 0) {
      return dbEntries;
    }

    // Auto-migrate any unmigrated local file entries for this user into Neon DB
    const fileEntries = readCustomAliasesForUser(user);
    if (fileEntries.length > 0) {
      for (const fe of fileEntries) {
        try {
          const effectiveUserId = fe.userId || userId || "demo-petrophysicist-uuid";
          await db.customAlias.upsert({
            where: {
              standardMnemonic_alias_userId: {
                standardMnemonic: fe.standardMnemonic.toUpperCase(),
                alias: fe.alias.toUpperCase(),
                userId: effectiveUserId,
              },
            },
            create: {
              id: fe.id,
              alias: fe.alias.toUpperCase(),
              standardMnemonic: fe.standardMnemonic.toUpperCase(),
              addedBy: fe.addedBy,
              addedAt: fe.addedAt ? new Date(fe.addedAt) : new Date(),
              userId: effectiveUserId,
              userEmail: fe.userEmail || userEmail || "",
            },
            update: {},
          });
        } catch {
          // ignore duplicate
        }
      }
      return fileEntries;
    }

    return [];
  } catch (error) {
    console.warn("Database custom alias fetch failed, falling back to local file:", error);
    return readCustomAliasesForUser(user);
  }
}

/**
 * Persists a new custom alias strictly bound to the user's account in PostgreSQL,
 * with graceful fallback to file storage.
 */
export async function saveUserCustomAliasAsync(
  user: { id?: string; email?: string; name?: string } | null,
  newEntry: CustomAliasEntry
): Promise<CustomAliasEntry[]> {
  if (process.env.NODE_ENV === "test") {
    return saveUserCustomAlias(user, newEntry);
  }

  const cleanAlias = newEntry.alias.trim().toUpperCase();
  const cleanCurve = newEntry.standardMnemonic.trim().toUpperCase();
  const userId = user?.id?.trim() || newEntry.userId || "demo-petrophysicist-uuid";
  const userEmail = user?.email?.trim().toLowerCase() || newEntry.userEmail || "";
  const addedBy = newEntry.addedBy?.trim() || user?.name?.trim() || "Lead Petrophysicist";

  try {
    await ensureDbTableExists();

    await db.customAlias.upsert({
      where: {
        standardMnemonic_alias_userId: {
          standardMnemonic: cleanCurve,
          alias: cleanAlias,
          userId,
        },
      },
      create: {
        id: newEntry.id,
        alias: cleanAlias,
        standardMnemonic: cleanCurve,
        addedBy,
        addedAt: newEntry.addedAt ? new Date(newEntry.addedAt) : new Date(),
        userId,
        userEmail,
      },
      update: {
        addedBy,
        addedAt: newEntry.addedAt ? new Date(newEntry.addedAt) : new Date(),
        userEmail,
      },
    });

    // Best-effort local file backup (ignored on read-only serverless filesystems)
    try {
      saveUserCustomAlias(user, {
        ...newEntry,
        alias: cleanAlias,
        standardMnemonic: cleanCurve,
        userId,
        userEmail,
      });
    } catch {
      // Ignored on read-only serverless filesystems
    }

    return await getCustomAliasesForUserAsync(user);
  } catch (error) {
    console.error("Failed to save alias to database, falling back to file:", error);
    return saveUserCustomAlias(user, newEntry);
  }
}

/**
 * Updates a custom alias owned by the user's account in PostgreSQL,
 * with graceful fallback to file storage.
 */
export async function updateUserCustomAliasAsync(
  user: { id?: string; email?: string; name?: string } | null,
  standardMnemonic: string,
  oldAlias: string,
  newAlias: string
): Promise<{ success: boolean; error?: string; aliases: CustomAliasEntry[]; entry?: CustomAliasEntry }> {
  if (process.env.NODE_ENV === "test") {
    return updateUserCustomAlias(user, standardMnemonic, oldAlias, newAlias);
  }

  const cleanCurve = standardMnemonic.trim().toUpperCase();
  const cleanOld = oldAlias.trim().toUpperCase();
  const cleanNew = newAlias.trim().toUpperCase();

  const userId = user?.id?.trim() || "demo-petrophysicist-uuid";
  const userEmail = user?.email?.trim().toLowerCase();

  try {
    await ensureDbTableExists();

    const userConditions: Array<{
      userId?: string;
      userEmail?: { equals: string; mode: "insensitive" };
    }> = [{ userId }];

    if (userEmail) {
      userConditions.push({ userEmail: { equals: userEmail, mode: "insensitive" } });
    }

    const existing = await db.customAlias.findFirst({
      where: {
        standardMnemonic: cleanCurve,
        alias: cleanOld,
        OR: userConditions,
      },
    });

    if (!existing) {
      const fileRes = updateUserCustomAlias(user, cleanCurve, cleanOld, cleanNew);
      return fileRes;
    }

    const updated = await db.customAlias.update({
      where: { id: existing.id },
      data: {
        alias: cleanNew,
        addedAt: new Date(),
      },
    });

    // Best-effort file sync
    try {
      updateUserCustomAlias(user, cleanCurve, cleanOld, cleanNew);
    } catch {
      // ignore
    }

    const aliases = await getCustomAliasesForUserAsync(user);
    const updatedEntry: CustomAliasEntry = {
      id: updated.id,
      alias: updated.alias,
      standardMnemonic: updated.standardMnemonic,
      addedBy: updated.addedBy,
      addedAt: updated.addedAt.toISOString(),
      userId: updated.userId || undefined,
      userEmail: updated.userEmail || undefined,
    };

    return {
      success: true,
      entry: updatedEntry,
      aliases,
    };
  } catch (error) {
    console.error("Failed to update alias in DB, falling back to file:", error);
    return updateUserCustomAlias(user, cleanCurve, cleanOld, cleanNew);
  }
}

/**
 * Deletes a custom alias owned by the user's account in PostgreSQL,
 * with graceful fallback to file storage.
 */
export async function deleteUserCustomAliasAsync(
  user: { id?: string; email?: string; name?: string } | null,
  standardMnemonic: string,
  alias: string
): Promise<{ success: boolean; error?: string; aliases: CustomAliasEntry[] }> {
  if (process.env.NODE_ENV === "test") {
    return deleteUserCustomAlias(user, standardMnemonic, alias);
  }

  const cleanCurve = standardMnemonic.trim().toUpperCase();
  const cleanAlias = alias.trim().toUpperCase();

  const userId = user?.id?.trim() || "demo-petrophysicist-uuid";
  const userEmail = user?.email?.trim().toLowerCase();

  try {
    await ensureDbTableExists();

    const userConditions: Array<{
      userId?: string;
      userEmail?: { equals: string; mode: "insensitive" };
    }> = [{ userId }];

    if (userEmail) {
      userConditions.push({ userEmail: { equals: userEmail, mode: "insensitive" } });
    }

    const deleteRes = await db.customAlias.deleteMany({
      where: {
        standardMnemonic: cleanCurve,
        alias: cleanAlias,
        OR: userConditions,
      },
    });

    // Best-effort file sync
    try {
      deleteUserCustomAlias(user, cleanCurve, cleanAlias);
    } catch {
      // ignore
    }

    if (deleteRes.count === 0) {
      const fileRes = deleteUserCustomAlias(user, cleanCurve, cleanAlias);
      if (!fileRes.success) {
        return {
          success: false,
          error: `Alias "${alias}" was not found under ${cleanCurve} for your account.`,
          aliases: await getCustomAliasesForUserAsync(user),
        };
      }
    }

    const aliases = await getCustomAliasesForUserAsync(user);
    return {
      success: true,
      aliases,
    };
  } catch (error) {
    console.error("Failed to delete alias in DB, falling back to file:", error);
    return deleteUserCustomAlias(user, cleanCurve, cleanAlias);
  }
}


