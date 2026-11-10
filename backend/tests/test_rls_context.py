"""Sprint 5, Step 4, PR A: row-level-security CONTEXT mechanism tests.

These run against a real Postgres (DATABASE_URL, which in CI is the
PY_TEST_DATABASE_URL secret) as a non-owner, non-bypass role such as the dev
`wellqc_api`. They need NO row-level-security policies, so they pass before the
policy migration (PR B) exists. The policy tests (T1-T4, T7-T9) arrive with PR B.

  T0  guard: abort if the connected role could bypass row-level security
  T5  the context is transaction-local and cannot leak through the pool
  T6  two threads with different users never see each other's context
  plus: the hook, set_rls_context and get_current_user_optional wiring
"""
import os
import threading
from types import SimpleNamespace

import pytest
from fastapi import Request
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from backend.app.core.database import SessionLocal, engine, set_rls_context
from backend.app.core.dependencies import get_current_user_optional

READ_CTX = text(
    "select coalesce(current_setting('app.user_id', true), ''), "
    "coalesce(current_setting('app.is_admin', true), '')"
)


def _ctx(db):
    row = db.execute(READ_CTX).one()
    return row[0], row[1]


@pytest.fixture(scope="module", autouse=True)
def _postgres_and_role_guard():
    """Skip (locally) or fail (CI) if there is no Postgres; abort on a bypass role."""
    try:
        conn = engine.connect()
    except OperationalError as exc:
        if os.environ.get("CI"):
            pytest.fail(f"CI could not connect to the test database: {exc}")
        pytest.skip("No reachable Postgres for DATABASE_URL; skipping RLS context tests")
    try:
        if conn.dialect.name != "postgresql":
            pytest.skip("RLS context tests need PostgreSQL")
        row = conn.execute(text(
            "select current_user, r.rolbypassrls, r.rolsuper, "
            "  exists (select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace "
            "          where n.nspname = 'public' and c.relkind in ('r','p') and c.relowner = r.oid) "
            "from pg_roles r where r.rolname = current_user"
        )).one()
    finally:
        conn.close()
    who, bypass, superuser, owns_tables = row
    if bypass or superuser or owns_tables:
        if os.environ.get("CI"):
            pytest.exit(
                "T0 FAILED: the test database role '%s' can bypass row-level security "
                "(bypassrls=%s, superuser=%s, owns public tables=%s). Point DATABASE_URL / "
                "PY_TEST_DATABASE_URL at a NOBYPASSRLS role that owns nothing (wellqc_api), "
                "otherwise passing tests would prove nothing." % (who, bypass, superuser, owns_tables),
                returncode=3,
            )
        pytest.skip(
            f"The connected role '{who}' can bypass RLS (owns tables={owns_tables}, bypassrls={bypass}). "
            "Skipping RLS context tests in local environment; requires dedicated unprivileged role like wellqc_api."
        )
    yield


def test_t0_role_is_not_privileged():
    # The real check is the module fixture above (it aborts the run); this makes it visible.
    with engine.connect() as conn:
        bypass, superuser = conn.execute(text(
            "select rolbypassrls, rolsuper from pg_roles where rolname = current_user"
        )).one()
    assert bypass is False and superuser is False


def test_context_applied_when_set_before_first_query():
    db = SessionLocal()
    try:
        set_rls_context(db, SimpleNamespace(id="user-a", role="PETROPHYSICIST"))
        assert _ctx(db) == ("user-a", "false")
    finally:
        db.close()


def test_context_applied_when_transaction_already_open():
    # The auth dependency's user lookup opens the transaction before the user is known.
    db = SessionLocal()
    try:
        db.execute(text("select 1"))
        assert _ctx(db) == ("", "false")
        set_rls_context(db, SimpleNamespace(id="user-a", role="USER"))
        assert _ctx(db) == ("user-a", "false")
    finally:
        db.close()


def test_context_is_reapplied_after_commit_and_rollback():
    db = SessionLocal()
    try:
        set_rls_context(db, SimpleNamespace(id="user-a", role="ADMIN"))
        assert _ctx(db) == ("user-a", "true")
        db.commit()
        assert _ctx(db) == ("user-a", "true")
        db.rollback()
        assert _ctx(db) == ("user-a", "true")
    finally:
        db.close()


def test_no_user_means_default_deny():
    db = SessionLocal()
    try:
        assert _ctx(db) == ("", "false")           # never called
        set_rls_context(db, None)
        assert _ctx(db) == ("", "false")           # called with no user
    finally:
        db.close()


@pytest.mark.parametrize("role,expected", [
    ("ADMIN", "true"), ("admin", "true"), (" Admin ", "true"),
    ("USER", "false"), ("PETROPHYSICIST", "false"), ("", "false"), (None, "false"),
])
def test_admin_flag_comes_from_role(role, expected):
    db = SessionLocal()
    try:
        set_rls_context(db, SimpleNamespace(id="u1", role=role))
        assert _ctx(db)[1] == expected
    finally:
        db.close()


def test_t5_context_does_not_leak_through_the_pool():
    db = SessionLocal()
    try:
        set_rls_context(db, SimpleNamespace(id="user-a", role="ADMIN"))
        assert _ctx(db) == ("user-a", "true")
        db.commit()
    finally:
        db.close()

    # Plain engine connections have no hook: they show exactly what the pool hands out.
    n = max(engine.pool.checkedin(), 1)
    conns = [engine.connect() for _ in range(n)]
    try:
        for conn in conns:
            assert conn.execute(READ_CTX).one() == ("", ""), "context leaked across transactions"
    finally:
        for conn in conns:
            conn.close()


def test_t6_two_threads_never_see_each_others_context():
    barrier = threading.Barrier(2)
    errors = []

    def worker(user_id, is_admin):
        try:
            barrier.wait(timeout=10)
            for _ in range(25):
                db = SessionLocal()
                try:
                    set_rls_context(db, SimpleNamespace(id=user_id, role="ADMIN" if is_admin else "USER"))
                    got = _ctx(db)
                    if got != (user_id, "true" if is_admin else "false"):
                        errors.append((user_id, got))
                    db.execute(text("select pg_sleep(0.002)"))
                    db.commit()
                    got = _ctx(db)
                    if got != (user_id, "true" if is_admin else "false"):
                        errors.append((user_id, "after-commit", got))
                finally:
                    db.close()
        except Exception as exc:  # pragma: no cover
            errors.append((user_id, repr(exc)))

    threads = [threading.Thread(target=worker, args=("user-a", False)),
               threading.Thread(target=worker, args=("user-b", True))]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=60)
    assert not errors, errors


# --- get_current_user_optional wiring ------------------------------------------------

class _FakeQuery:
    def __init__(self, user):
        self._user = user

    def filter(self, *a, **k):
        return self

    def first(self):
        return self._user


def _request(with_cookie=True):
    headers = [(b"cookie", b"wellqc_session=mock-token")] if with_cookie else []
    return Request({"type": "http", "headers": headers})


def _call(monkeypatch, db, user, session=True, cookie=True, open_tx=False):
    monkeypatch.setattr(db, "query", lambda *a, **k: _FakeQuery(user))
    token = {"id": "any"} if session else None
    monkeypatch.setattr("backend.app.core.dependencies.read_session_token", lambda t: token)
    if open_tx:
        db.execute(text("select 1"))
    return get_current_user_optional(request=_request(cookie), bearer_creds=None, db=db)


def test_dependency_sets_context_for_admin_and_user(monkeypatch):
    for role, admin in (("ADMIN", "true"), ("PETROPHYSICIST", "false")):
        for open_tx in (False, True):
            db = SessionLocal()
            try:
                user = SimpleNamespace(id="user-x", role=role)
                assert _call(monkeypatch, db, user, open_tx=open_tx) is user
                assert _ctx(db) == ("user-x", admin)
            finally:
                db.close()


@pytest.mark.parametrize("case", ["no_token", "bad_token", "unknown_user"])
def test_dependency_denies_on_every_early_return(monkeypatch, case):
    db = SessionLocal()
    try:
        if case == "no_token":
            result = _call(monkeypatch, db, None, session=False, cookie=False)
        elif case == "bad_token":
            result = _call(monkeypatch, db, None, session=False)
        else:
            result = _call(monkeypatch, db, None, open_tx=True)   # valid token, no such user
        assert result is None
        assert _ctx(db) == ("", "false")
    finally:
        db.close()
