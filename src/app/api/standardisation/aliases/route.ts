import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  CustomAliasEntry,
  validateAliasForCurve,
  setCustomAliases,
} from "@/lib/las/standardiser";
import {
  readCustomAliasesForUser,
  saveUserCustomAlias,
  updateUserCustomAlias,
  deleteUserCustomAlias,
} from "@/lib/las/alias-storage";

export async function GET() {
  try {
    let currentUser = null;
    try {
      currentUser = await getCurrentUser();
    } catch {
      // outside request store or unauthenticated
    }

    const aliases = readCustomAliasesForUser(currentUser);
    // Sync in-memory cache for server-side standardisation
    setCustomAliases(aliases);
    return NextResponse.json({ aliases });
  } catch (error) {
    console.error("Failed to fetch custom aliases:", error);
    return NextResponse.json(
      { error: "Failed to load custom aliases.", aliases: [] },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { standardMnemonic, alias, addedBy: requestedAddedBy } = body;

    if (!standardMnemonic || typeof standardMnemonic !== "string") {
      return NextResponse.json(
        { error: "Standard mnemonic is required." },
        { status: 400 }
      );
    }

    if (!alias || typeof alias !== "string") {
      return NextResponse.json(
        { error: "Alias is required." },
        { status: 400 }
      );
    }

    const cleanAlias = alias.trim().toUpperCase();
    const cleanCurve = standardMnemonic.trim().toUpperCase();

    // Determine who added it: authenticated user > explicit requested name > default
    let currentUser = null;
    try {
      currentUser = await getCurrentUser();
    } catch {
      // outside request store or unauthenticated
    }

    const addedBy =
      requestedAddedBy?.trim() ||
      currentUser?.name ||
      currentUser?.email?.split("@")[0] ||
      "Lead Petrophysicist";

    // Scope duplicate validation to the current user's account dictionary + built-in standards
    const userAliases = readCustomAliasesForUser(currentUser);

    const validation = validateAliasForCurve(
      cleanAlias,
      cleanCurve,
      undefined,
      userAliases
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error, mappedCurve: validation.mappedCurve },
        { status: 400 }
      );
    }

    const newEntry: CustomAliasEntry = {
      id: `alias_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      alias: cleanAlias,
      standardMnemonic: cleanCurve,
      addedBy,
      addedAt: new Date().toISOString(),
      userId: currentUser?.id || "demo-petrophysicist-uuid",
      userEmail: currentUser?.email || "",
    };

    const updatedUserAliases = saveUserCustomAlias(currentUser, newEntry);
    setCustomAliases(updatedUserAliases);

    return NextResponse.json(
      {
        message: `Alias ${cleanAlias} successfully mapped to ${cleanCurve}.`,
        entry: newEntry,
        aliases: updatedUserAliases,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to add custom alias:", error);
    return NextResponse.json(
      { error: "Failed to save alias to server dictionary." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { standardMnemonic, oldAlias, newAlias } = body;

    if (!standardMnemonic || !oldAlias || !newAlias) {
      return NextResponse.json(
        { error: "standardMnemonic, oldAlias, and newAlias are required." },
        { status: 400 }
      );
    }

    const cleanCurve = standardMnemonic.trim().toUpperCase();
    const cleanOld = oldAlias.trim().toUpperCase();
    const cleanNew = newAlias.trim().toUpperCase();

    let currentUser = null;
    try {
      currentUser = await getCurrentUser();
    } catch {
      // outside request store
    }

    const userAliases = readCustomAliasesForUser(currentUser);
    const existing = userAliases.find(
      (e) =>
        e.standardMnemonic.toUpperCase() === cleanCurve &&
        e.alias.toUpperCase() === cleanOld
    );

    if (!existing) {
      return NextResponse.json(
        { error: `Alias "${oldAlias}" not found under curve ${cleanCurve} in your account.` },
        { status: 404 }
      );
    }

    if (cleanOld !== cleanNew) {
      const validation = validateAliasForCurve(
        cleanNew,
        cleanCurve,
        cleanOld,
        userAliases
      );

      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error, mappedCurve: validation.mappedCurve },
          { status: 400 }
        );
      }
    }

    const updateResult = updateUserCustomAlias(
      currentUser,
      cleanCurve,
      cleanOld,
      cleanNew
    );

    if (!updateResult.success) {
      return NextResponse.json(
        { error: updateResult.error || "Failed to update alias." },
        { status: 400 }
      );
    }

    setCustomAliases(updateResult.aliases);

    return NextResponse.json(
      {
        message: `Alias updated successfully to ${cleanNew}.`,
        entry: updateResult.entry,
        aliases: updateResult.aliases,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to update custom alias:", error);
    return NextResponse.json(
      { error: "Failed to update alias." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    let standardMnemonic = url.searchParams.get("standardMnemonic");
    let alias = url.searchParams.get("alias");

    if (!standardMnemonic || !alias) {
      const body = await request.json().catch(() => ({}));
      standardMnemonic = body.standardMnemonic || standardMnemonic;
      alias = body.alias || alias;
    }

    if (!standardMnemonic || !alias) {
      return NextResponse.json(
        { error: "standardMnemonic and alias are required to delete an alias." },
        { status: 400 }
      );
    }

    const cleanCurve = standardMnemonic.trim().toUpperCase();
    const cleanAlias = alias.trim().toUpperCase();

    let currentUser = null;
    try {
      currentUser = await getCurrentUser();
    } catch {
      // outside request store
    }

    const deleteResult = deleteUserCustomAlias(currentUser, cleanCurve, cleanAlias);

    if (!deleteResult.success) {
      return NextResponse.json(
        { error: deleteResult.error || `Alias "${alias}" was not found under ${cleanCurve}.` },
        { status: 404 }
      );
    }

    setCustomAliases(deleteResult.aliases);

    return NextResponse.json(
      {
        message: `Alias ${cleanAlias} removed from ${cleanCurve}.`,
        aliases: deleteResult.aliases,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to delete custom alias:", error);
    return NextResponse.json(
      { error: "Failed to delete alias." },
      { status: 500 }
    );
  }
}


