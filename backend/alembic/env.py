import os
import sys
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool
from sqlalchemy.exc import OperationalError

sys.path.append(os.getcwd())
load_dotenv(override=True)

from database import Base
from models import *


# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config


def get_sync_database_url() -> str:
    """Return a sync SQLAlchemy URL for Alembic."""
    sync_url = os.getenv("SYNC_DATABASE_URL")
    if sync_url:
        return sync_url

    async_url = os.getenv("DATABASE_URL")
    if async_url:
        return async_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")

    raise RuntimeError(
        "No database URL configured for Alembic. Set SYNC_DATABASE_URL or DATABASE_URL."
    )


config.set_main_option("sqlalchemy.url", get_sync_database_url())
# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
target_metadata = Base.metadata

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection, target_metadata=target_metadata
            )

            with context.begin_transaction():
                context.run_migrations()
    except OperationalError as exc:
        raise RuntimeError(
            "Alembic could not connect to the configured database. "
            "If you are using Supabase, verify the hostname resolves on this machine "
            "or point DATABASE_URL/SYNC_DATABASE_URL to a reachable local Postgres instance."
        ) from exc


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
