from contextlib import contextmanager
from typing import Iterator

import pyodbc

from app.core.config import get_settings


@contextmanager
def open_sql_connection() -> Iterator[pyodbc.Connection]:
    settings = get_settings()
    if not settings.has_sql_credentials:
        raise RuntimeError("SQL credentials are missing. Fill .env before using SQL gateway.")
    connection = pyodbc.connect(settings.sql_connection_string, timeout=10)
    try:
        yield connection
    finally:
        connection.close()
