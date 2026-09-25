import { GET, POST, PUT, DELETE } from "@/app/api/standardisation/aliases/route";
import { saveUserCustomAlias, readCustomAliasesForUser } from "@/lib/las/alias-storage";
import fs from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const ALIASES_FILE = path.join(DATA_DIR, "custom-aliases.json");

describe("/api/standardisation/aliases Route", () => {
  let originalFileContent = "[]";

  beforeAll(() => {
    if (fs.existsSync(ALIASES_FILE)) {
      originalFileContent = fs.readFileSync(ALIASES_FILE, "utf8");
    }
  });

  afterAll(() => {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(ALIASES_FILE, originalFileContent, "utf8");
  });

  beforeEach(() => {
    fs.writeFileSync(ALIASES_FILE, "[]", "utf8");
  });

  it("GET returns initial empty custom aliases array", async () => {
    const res = await GET();
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.aliases).toEqual([]);
  });

  it("POST creates a new custom alias with author and timestamp (Issue 1 & 4)", async () => {
    const req = new Request("http://localhost/api/standardisation/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        standardMnemonic: "GR",
        alias: "GAMMA_SPECIAL_V3",
        addedBy: "Dr. Evelyn Reed",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.entry.alias).toBe("GAMMA_SPECIAL_V3");
    expect(data.entry.standardMnemonic).toBe("GR");
    expect(data.entry.addedBy).toBe("Dr. Evelyn Reed");
    expect(data.entry.addedAt).toBeDefined();
    expect(data.aliases).toHaveLength(1);

    // Verify GET returns this saved alias across any subsequent request
    const getRes = await GET();
    const getData = await getRes.json();
    expect(getData.aliases).toHaveLength(1);
    expect(getData.aliases[0].alias).toBe("GAMMA_SPECIAL_V3");
  });

  it("POST blocks duplicate alias across curves with exact error message (Issue 2)", async () => {
    // Attempt to map RT (deep resistivity) under CALI (caliper)
    const req = new Request("http://localhost/api/standardisation/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        standardMnemonic: "CALI",
        alias: "RT",
      }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe("RT is already mapped to RT. Remove or choose a different alias.");
    expect(data.mappedCurve).toBe("RT");
  });

  it("PUT edits an existing alias (Issue 3)", async () => {
    // First create alias
    const createReq = new Request("http://localhost/api/standardisation/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        standardMnemonic: "RHOB",
        alias: "DENS_TEMP",
      }),
    });
    await POST(createReq);

    // Now edit DENS_TEMP to DENS_PERM
    const editReq = new Request("http://localhost/api/standardisation/aliases", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        standardMnemonic: "RHOB",
        oldAlias: "DENS_TEMP",
        newAlias: "DENS_PERM",
      }),
    });

    const editRes = await PUT(editReq);
    const editData = await editRes.json();

    expect(editRes.status).toBe(200);
    expect(editData.entry.alias).toBe("DENS_PERM");

    // Verify GET reflects the edit
    const getRes = await GET();
    const getData = await getRes.json();
    expect(getData.aliases[0].alias).toBe("DENS_PERM");
  });

  it("DELETE removes an alias (Issue 3)", async () => {
    // Create alias
    const createReq = new Request("http://localhost/api/standardisation/aliases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        standardMnemonic: "SP",
        alias: "SP_REMOVE_ME",
      }),
    });
    await POST(createReq);

    // Delete alias
    const deleteReq = new Request("http://localhost/api/standardisation/aliases?standardMnemonic=SP&alias=SP_REMOVE_ME", {
      method: "DELETE",
    });

    const deleteRes = await DELETE(deleteReq);
    const deleteData = await deleteRes.json();

    expect(deleteRes.status).toBe(200);
    expect(deleteData.aliases).toHaveLength(0);

    // Verify GET is empty
    const getRes = await GET();
    const getData = await getRes.json();
    expect(getData.aliases).toHaveLength(0);
  });

  it("enforces strict account isolation between different user accounts", () => {
    const userA = { id: "user_a_123", email: "alice@company.com", name: "Alice" };
    const userB = { id: "user_b_456", email: "bob@company.com", name: "Bob" };

    // Alice adds a custom alias for GR
    saveUserCustomAlias(userA, {
      id: "alias_alice_1",
      alias: "ALICE_GAMMA_V1",
      standardMnemonic: "GR",
      addedBy: "Alice",
      addedAt: new Date().toISOString(),
    });

    // Bob adds a custom alias for DT
    saveUserCustomAlias(userB, {
      id: "alias_bob_1",
      alias: "BOB_SONIC_V1",
      standardMnemonic: "DT",
      addedBy: "Bob",
      addedAt: new Date().toISOString(),
    });

    // Alice should only see her alias
    const aliceAliases = readCustomAliasesForUser(userA);
    expect(aliceAliases).toHaveLength(1);
    expect(aliceAliases[0].alias).toBe("ALICE_GAMMA_V1");

    // Bob should only see his alias (not Alice's)
    const bobAliases = readCustomAliasesForUser(userB);
    expect(bobAliases).toHaveLength(1);
    expect(bobAliases[0].alias).toBe("BOB_SONIC_V1");

    // A brand new user C should see 0 custom aliases
    const userC = { id: "user_c_789", email: "charlie@company.com", name: "Charlie" };
    const charlieAliases = readCustomAliasesForUser(userC);
    expect(charlieAliases).toHaveLength(0);
  });
});
