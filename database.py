"""
database.py
-----------
SQLAlchemy 2.0 engine, session factory, and declarative base for the
AI-Powered Continuous Cyber Risk Quantification (CRQ) platform.

Configured for production PostgreSQL with resilient connection pooling:
    - pool_size=10
    - max_overflow=20
    - pool_pre_ping=True (recovers from stale/dropped database connections)
    
Connection parameters are dynamically read from the `DATABASE_URL` environment
variable, falling back to a local PostgreSQL instance by default.
"""

from __future__ import annotations

import os
from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from urllib.parse import quote_plus
# Dynamic database URL with safe production PostgreSQL default
raw_password = "0208"  # e.g. "password@1308" or whatever it is
encoded_password = quote_plus(raw_password)

DATABASE_URL = f"postgresql+psycopg2://postgres:{encoded_password}@localhost:5432/cyber_risk_db"
# Engine configuration with production connection pooling parameters
engine_kwargs: dict[str, Any] = {
    "echo": False,
    "future": True,
    "pool_pre_ping": True,
}

if not DATABASE_URL.startswith("sqlite"):
    engine_kwargs.update(
        {
            "pool_size": 10,
            "max_overflow": 20,
        }
    )
else:
    # Retain safe thread sharing if SQLite is supplied (e.g. in offline unit tests)
    engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
    future=True,
)


class Base(DeclarativeBase):
    """Declarative base class shared by all ORM models in the platform."""

    pass


def init_db() -> None:
    """Creates all database tables defined in the ORM schema if they do not exist."""
    # Imported locally to avoid circular import between database and models
    import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency and context generator that yields a SQLAlchemy session
    and guarantees proper session cleanup and closure.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
