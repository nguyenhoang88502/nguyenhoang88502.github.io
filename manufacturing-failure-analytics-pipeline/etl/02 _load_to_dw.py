"""
CO4031 BTL - Step 02: Load Cleaned Data to PostgreSQL
Purpose: Load the transformed CSV into the staging.machine_data table
"""

import pandas as pd
from sqlalchemy import create_engine, text
import warnings
from pathlib import Path
warnings.filterwarnings('ignore')

# ============================================================
# CONNECTION CONFIGURATION
# ============================================================
# Change these if your PostgreSQL settings are different:
DB_USER = "postgres"
DB_PASSWORD = "885028" # your PostgreSQL password
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "co4031_dw"

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CLEANED_PATH = PROJECT_ROOT / "data" / "cleaned" / "machine_data_cleaned.csv"

# Build connection string
conn_str = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

print("Connecting to PostgreSQL...")
engine = create_engine(conn_str)

# Test connection
with engine.connect() as conn:
    result = conn.execute(text("SELECT version()"))
    print(f"Connected! PostgreSQL version: {result.fetchone()[0][:30]}...")

# ============================================================
# LOAD DATA
# ============================================================

print("\nLoading cleaned CSV file...")
df = pd.read_csv(CLEANED_PATH)
print(f"Loaded {len(df)} rows, {len(df.columns)} columns.")

# Select and rename columns to match database table exactly
db_columns = [
    'record_id', 'product_id', 'quality_type',
    'air_temp_k', 'process_temp_k', 'rotational_speed_rpm',
    'torque_nm', 'tool_wear_min', 'machine_failure',
    'failure_twf', 'failure_hdf', 'failure_pwf',
    'failure_osf', 'failure_rnf',
    'Air_Temp_C', 'Process_Temp_C',
    'Temp_Differential_C', 'Power_W',
    'Type_Encoded', 'Failure_Type'
]

# Rename derived columns to lowercase for DB consistency
df = df.rename(columns={
    'Air_Temp_C': 'air_temp_c',
    'Process_Temp_C': 'process_temp_c',
    'Temp_Differential_C': 'temp_differential_c',
    'Power_W': 'power_w',
    'Type_Encoded': 'type_encoded',
    'Failure_Type': 'failure_type'
})

print("Loading data to staging.machine_data table...")

# Load using pandas to_sql (much faster than row-by-row INSERT)
df.to_sql(
    name='machine_data',
    schema='staging',
    con=engine,
    if_exists='replace', # 'replace' drops and recreates; use 'append' later
    index=False,
    chunksize=1000,      # process 1000 rows at a time
    method='multi'       # batch inserts (faster)
)

# Verify the load
with engine.connect() as conn:
    count = conn.execute(
        text("SELECT COUNT(*) FROM staging.machine_data")
    ).fetchone()[0]
    print(f"\nVerification: {count} rows loaded to staging.machine_data")

    # Show sample
    sample = conn.execute(
        text("SELECT record_id, quality_type, machine_failure, failure_type "
             "FROM staging.machine_data LIMIT 5")
    )
    print("\nSample rows:")
    for row in sample:
        print(f"ID={row[0]}, Type={row[1]}, Failure={row[2]}, Kind='{row[3]}'")

print("\n=== ETL LOAD COMPLETE ===")
