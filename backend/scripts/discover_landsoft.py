from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import get_settings
from app.db.sqlserver import open_sql_connection


def fetch_all(cursor, sql: str) -> list[dict]:
    cursor.execute(sql)
    cols = [col[0] for col in cursor.description]
    return [dict(zip(cols, row)) for row in cursor.fetchall()]


def build_markdown(payload: dict) -> str:
    lines = [
        "# Landsoft discovery",
        "",
        f"- generated_at: {payload['generated_at']}",
        f"- sql_server: {payload['sql_server']}",
        f"- sql_database: {payload['sql_database']}",
        "",
        "## Counts",
        "",
        f"- tables: {len(payload['tables'])}",
        f"- views: {len(payload['views'])}",
        f"- stored_procedures: {len(payload['stored_procedures'])}",
        f"- foreign_keys: {len(payload['foreign_keys'])}",
        "",
        "## Candidate business objects",
    ]
    for section in ["property_candidates", "user_candidates", "note_candidates", "status_candidates"]:
        lines.append("")
        lines.append(f"### {section}")
        for item in payload[section]:
            lines.append(f"- {item['schema_name']}.{item['object_name']}")
    return "\n".join(lines) + "\n"


def candidate_objects(objects: list[dict], keywords: tuple[str, ...]) -> list[dict]:
    out = []
    for item in objects:
        haystack = f"{item.get('schema_name','')} {item.get('object_name','')}".lower()
        if any(keyword in haystack for keyword in keywords):
            out.append(item)
    return out


def main() -> None:
    settings = get_settings()
    if not settings.has_sql_credentials:
        raise SystemExit("Missing SQL credentials. Fill .env before running discovery.")

    with open_sql_connection() as conn:
        cursor = conn.cursor()
        tables = fetch_all(
            cursor,
            """
            SELECT s.name AS schema_name, t.name AS object_name
            FROM sys.tables t
            JOIN sys.schemas s ON s.schema_id = t.schema_id
            ORDER BY s.name, t.name
            """,
        )
        views = fetch_all(
            cursor,
            """
            SELECT s.name AS schema_name, v.name AS object_name
            FROM sys.views v
            JOIN sys.schemas s ON s.schema_id = v.schema_id
            ORDER BY s.name, v.name
            """,
        )
        procedures = fetch_all(
            cursor,
            """
            SELECT s.name AS schema_name, p.name AS object_name
            FROM sys.procedures p
            JOIN sys.schemas s ON s.schema_id = p.schema_id
            ORDER BY s.name, p.name
            """,
        )
        columns = fetch_all(
            cursor,
            """
            SELECT
              TABLE_SCHEMA AS schema_name,
              TABLE_NAME AS object_name,
              COLUMN_NAME AS column_name,
              DATA_TYPE AS data_type,
              IS_NULLABLE AS is_nullable
            FROM INFORMATION_SCHEMA.COLUMNS
            ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION
            """,
        )
        foreign_keys = fetch_all(
            cursor,
            """
            SELECT
              fk.name AS fk_name,
              sch1.name AS parent_schema,
              tab1.name AS parent_table,
              col1.name AS parent_column,
              sch2.name AS ref_schema,
              tab2.name AS ref_table,
              col2.name AS ref_column
            FROM sys.foreign_key_columns fkc
            JOIN sys.foreign_keys fk ON fk.object_id = fkc.constraint_object_id
            JOIN sys.tables tab1 ON tab1.object_id = fkc.parent_object_id
            JOIN sys.schemas sch1 ON sch1.schema_id = tab1.schema_id
            JOIN sys.columns col1 ON col1.object_id = tab1.object_id AND col1.column_id = fkc.parent_column_id
            JOIN sys.tables tab2 ON tab2.object_id = fkc.referenced_object_id
            JOIN sys.schemas sch2 ON sch2.schema_id = tab2.schema_id
            JOIN sys.columns col2 ON col2.object_id = tab2.object_id AND col2.column_id = fkc.referenced_column_id
            ORDER BY parent_schema, parent_table, fk_name
            """,
        )

    now = datetime.now(UTC)
    timestamp = now.strftime("%Y%m%d-%H%M%S")
    payload = {
        "generated_at": now.isoformat(),
        "sql_server": settings.sql_server,
        "sql_database": settings.sql_database,
        "tables": tables,
        "views": views,
        "stored_procedures": procedures,
        "columns": columns,
        "foreign_keys": foreign_keys,
        "property_candidates": candidate_objects(tables + views + procedures, ("house", "home", "property", "product", "bds", "batdongsan", "nha", "kho")),
        "user_candidates": candidate_objects(tables + views + procedures, ("user", "staff", "nhanvien", "nhansu", "account", "login")),
        "note_candidates": candidate_objects(tables + views + procedures, ("note", "comment", "log", "history", "ghichu", "lichsu")),
        "status_candidates": candidate_objects(tables + views + procedures, ("status", "state", "trangthai")),
    }

    settings.discovery_dir.mkdir(parents=True, exist_ok=True)
    json_path = settings.discovery_dir / f"landsoft-discovery-{timestamp}.json"
    md_path = settings.discovery_dir / f"landsoft-discovery-{timestamp}.md"
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(build_markdown(payload), encoding="utf-8")

    print(f"JSON: {json_path}")
    print(f"Markdown: {md_path}")


if __name__ == "__main__":
    main()
