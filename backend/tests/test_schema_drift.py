import pytest
from sqlalchemy import text
from backend.app.core.database import engine
from backend.app.models.models import User

def test_user_model_columns_exist_in_database():
    """
    Assert that every column mapped on the SQLAlchemy User model
    exists in the active database table 'User'.
    Detects any schema drift between ORM models and database tables.
    """
    with engine.connect() as conn:
        result = conn.execute(
            text(
                """
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'User' AND table_schema = current_schema();
                """
            )
        )
        db_columns = {row[0] for row in result.fetchall()}

    assert db_columns, "Table 'User' does not exist in the database or has no columns."

    model_columns = {col.name for col in User.__table__.columns}
    missing_columns = model_columns - db_columns

    assert not missing_columns, (
        f"Schema drift detected: User model has columns not present in database: {sorted(missing_columns)}. "
        f"Ensure Prisma migration has been applied."
    )

