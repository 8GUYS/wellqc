# Database schema change workflow

How to change the WellQC database schema without breaking production. Read this before any PR that touches `prisma/`.

## Who owns what

| Piece | Role | Location |
| --- | --- | --- |
| Prisma | Owns the schema and migrations | `prisma/schema.prisma`, `prisma/migrations/` |
| Prisma config | Tells the CLI which database to use | `prisma.config.ts` |
| SQLAlchemy | Python query layer. Reads and writes existing tables only | `backend/app/models/models.py` (`Base` comes from `backend/app/core/database.py`) |

There is no `create_all` and no Alembic in the Python backend. Do not add either. Prisma stays the only schema owner.

Prisma is not used by the live API. It is only the migration tool, and the Python backend reads and writes the tables through SQLAlchemy. Seeding is done by `scripts/seed_db.py`.

## Databases

| Database | Neon host prefix | Used for |
| --- | --- | --- |
| Production | `ep-divine-field` | Live data. Migrations reach it only through CI on merge to `main` |
| Dev | `ep-tiny-haze` | Local work, pytest, Vercel Preview and the staging backend |

Never run tests, resets or experiments against production.

## Which variable the migration uses

`prisma.config.ts` picks the first of these that is set:

1. `DIRECT_URL`
2. `DATABASE_URL_UNPOOLED`
3. `POSTGRES_URL_NON_POOLING`
4. `DATABASE_URL`

CI sets only `DIRECT_URL` (a GitHub secret pointing at production). Locally, `DIRECT_URL` and `DATABASE_URL_UNPOOLED` must both point at dev. If they disagree, the first one set wins silently. Prisma loads `prisma.config.ts` without a flag in CI. The Docker entrypoint passes `--config prisma.config.ts` explicitly, which is also safe to use locally.

### Check the target before any migration command

This prints variable names and hosts only, no passwords:

```powershell
Select-String -Path .env -Pattern "^(DIRECT_URL|DATABASE_URL_UNPOOLED|POSTGRES_URL_NON_POOLING|DATABASE_URL)=" | ForEach-Object { ($_.Line -split "=")[0] + " -> " + (($_.Line -split "@")[1] -split "/")[0] }
```

Every line should show the `ep-tiny-haze` host. If any shows `ep-divine-field`, stop and fix `.env` first.

## Rules

1. Every schema change is a Prisma migration plus the matching SQLAlchemy model change, in the same PR.
2. Make changes additive. Never drop or rename a column or table in the same release that stops using it (see below).
3. Apply the migration to dev before running tests, so tests match the schema.
4. No tests against production. The CI pytest job uses the dev `DATABASE_URL` secret.
5. No force-push. `main` is protected and needs a PR with `lint-and-build` green.

## Steps for a schema change

1. Branch from the latest `main`.
2. Edit `prisma/schema.prisma`.
3. Create the migration against dev, after checking the target (above):

```powershell
   npx prisma migrate dev --name describe_the_change --config prisma.config.ts
```

1. Update the SQLAlchemy model in `backend/app/models/models.py` to match, including types, nullability and defaults.
2. Make sure dev has every migration, then run the Python tests:

```powershell
   npx prisma migrate deploy --config prisma.config.ts
   cd backend
   pytest -q
```

   Tests are real round trips to the dev database, so a full run takes 90 to 100 seconds locally and can stall on a Neon cold start. Re-run once before assuming a failure.
6. Open the PR. Wait for `lint-and-build` and the Python tests job, and test the Vercel Preview. Preview uses the staging backend, which reads the dev database, so the migration must already be applied to dev for the preview to work.
7. Merge. This starts three things:

- Vercel deploys the frontend.
- The "Deploy Database Migrations" workflow runs `npx prisma migrate deploy` against production, with 3 attempts and a 20 second wait for Neon cold starts.
- Render deploys the production backend after CI checks pass.

The Render deploy is not gated on the migrate workflow, so for a short time the new code can be live before the migration has run. That is why changes must be additive (next section).

## Additive changes (expand, then contract)

The old code and the new code overlap briefly during a deploy. Make both work against both schemas.

- **Add a column:** make it nullable or give it a default. Deploy. Then use it.
- **Rename a column:** add the new column, write to both, backfill, switch reads, and only in a later release drop the old column.
- **Drop a column or table:** first release code that no longer uses it. Drop it in a following release.
- **Tighten a constraint** (`NOT NULL`, unique): backfill first, then add the constraint in a later release.

## After merging

1. Open the latest "Deploy Database Migrations" run on `main`. The migrate step should show `Applying migration` for your migration, or `No pending migrations to apply` if it was already applied. It should not show an error.
2. Check the Render production logs for 500s and `column does not exist`.
3. Use the live site once.

## Troubleshooting

| Symptom | Likely cause | First check |
| --- | --- | --- |
| `column does not exist` in Render logs | Model and migration out of step, or the migration was not applied | Compare the SQLAlchemy model with the Prisma migration, then check the migrate workflow run |
| `P1001` in the migrate job | Neon cold start | Re-run the job once. The retry loop should usually cover it |
| `P1001` or "could not translate host name" locally | Local DNS | Retry once, then check Windows DNS settings |
| Tests fail on a missing column or table | Dev database is behind the repo | `npx prisma migrate deploy --config prisma.config.ts` against dev |
| Custom aliases persistence | Stored in PostgreSQL/SQLite `custom_aliases` table | Query or update via `/api/standardisation/aliases` |

## Rollback

A migration cannot be un-run by redeploying code. If a schema change causes trouble, fix forward with a new additive migration. For code problems, promote the last good deployment on Vercel and revert the merge through a PR. Never force-push `main`.