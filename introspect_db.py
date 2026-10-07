import pyodbc
import json

password = "K4%LH_FR3lf4c_1%"
connection_string = (
    "DRIVER={ODBC Driver 18 for SQL Server};"
    "SERVER=tcp:192.168.1.200,1433;"
    "DATABASE=PeCalHackathon2026;"
    "UID=PeCalHackathonParticipant;"
    f"PWD={password};"
    "Encrypt=yes;"
    "TrustServerCertificate=no;"
)

conn = pyodbc.connect(connection_string, timeout=10)
cur = conn.cursor()

# List user tables
tables = []
for r in cur.execute(
    "SELECT s.name + '.' + t.name, t.type_desc "
    "FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id "
    "ORDER BY s.name, t.name"
):
    tables.append((r[0], r[1]))

print("=== TABLES ===")
for name, typ in tables:
    print(f"  {name}  ({typ})")

print("\n=== VIEWS ===")
for r in cur.execute(
    "SELECT s.name + '.' + v.name FROM sys.views v JOIN sys.schemas s ON v.schema_id = s.schema_id ORDER BY 1"
):
    print("  " + r[0])

print("\n=== COLUMNS / ROWCOUNTS / SAMPLE ===")
for name, _ in tables:
    try:
        cnt = cur.execute(f"SELECT COUNT_BIG(*) FROM {name}").fetchone()[0]
    except Exception as e:
        cnt = f"ERR {e}"
    print(f"\n--- {name}  rows={cnt}")
    try:
        cols = cur.execute(f"""
            SELECT c.name, ty.name, c.max_length, c.is_nullable
            FROM sys.columns c
            JOIN sys.types ty ON c.user_type_id = ty.user_type_id
            JOIN sys.tables t ON c.object_id = t.object_id
            JOIN sys.schemas s ON t.schema_id = s.schema_id
            WHERE s.name + '.' + t.name = ?
            ORDER BY c.column_id
        """, name).fetchall()
        for c in cols:
            print(f"    {c[0]:40s} {c[1]:15s} null={c[3]}")
    except Exception as e:
        print("    colerr", e)

conn.close()
