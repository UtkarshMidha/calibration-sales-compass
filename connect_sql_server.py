import pyodbc


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

connection = pyodbc.connect(connection_string, timeout=5)
try:
    cursor = connection.cursor()
    cursor.execute("SELECT DB_NAME()")
    print("Connected to:", cursor.fetchone()[0])
finally:
    connection.close()
