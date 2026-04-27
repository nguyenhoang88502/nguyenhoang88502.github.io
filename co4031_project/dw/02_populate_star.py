"""
CO4031 BTL - Step: Populate Star Schema from Staging
Purpose: Reads from staging.machine_data, loads into dw.* tables
"""

import pandas as pd
from sqlalchemy import create_engine, text
import numpy as np
from datetime import date, timedelta
import random
import warnings

warnings.filterwarnings('ignore')

# ============================================================
# CONNECTION CONFIGURATION
# ============================================================
DB_USER = "postgres"
DB_PASSWORD = "885028" # Update this to your actual password!
DB_HOST = "localhost"
DB_PORT = "5432"
DB_NAME = "co4031_dw"

conn_str = f"postgresql+psycopg2://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(conn_str)

print("Loading staging data...")
df = pd.read_sql("SELECT * FROM staging.machine_data", engine)
print(f"Loaded {len(df)} rows from staging.")

# ============================================================
# POPULATE DIM_PRODUCT
# ============================================================
print("\nPopulating dim_product ...")

quality_label_map = {
    'L': 'Low Quality',
    'M': 'Medium Quality',
    'H': 'High Quality'
}
quality_tier_map = {'L': 1, 'M': 2, 'H': 3}

products = df[['product_id', 'quality_type']].drop_duplicates()
products['quality_label'] = products['quality_type'].map(quality_label_map)
products['quality_tier'] = products['quality_type'].map(quality_tier_map)

with engine.connect() as conn:
    conn.execute(text("DELETE FROM dw.dim_product"))
    conn.commit()

products.to_sql('dim_product', schema='dw', con=engine, if_exists='append', index=False)
print(f"Inserted {len(products)} product records.")

# Fetch back product SK mapping
dim_prod_df = pd.read_sql("SELECT product_sk, product_id FROM dw.dim_product", engine)
prod_map = dict(zip(dim_prod_df['product_id'], dim_prod_df['product_sk']))

# ============================================================
# POPULATE DIM_FAILURE_TYPE (already populated via SQL)
# ============================================================
dim_fail_df = pd.read_sql("SELECT failure_type_sk, failure_code FROM dw.dim_failure_type", engine)
fail_code_map = dict(zip(dim_fail_df['failure_code'], dim_fail_df['failure_type_sk']))

def get_failure_code(row):
    if row['failure_twf'] == 1: return 'TWF'
    if row['failure_hdf'] == 1: return 'HDF'
    if row['failure_pwf'] == 1: return 'PWF'
    if row['failure_osf'] == 1: return 'OSF'
    if row['failure_rnf'] == 1: return 'RNF'
    return 'NF'

df['failure_code'] = df.apply(get_failure_code, axis=1)
df['failure_type_fk'] = df['failure_code'].map(fail_code_map)

# ============================================================
# POPULATE DIM_MACHINE_CONDITION
# ============================================================
dim_cond_df = pd.read_sql("SELECT condition_sk, condition_code FROM dw.dim_machine_condition", engine)
cond_map = dict(zip(dim_cond_df['condition_code'], dim_cond_df['condition_sk']))

def get_condition_code(wear_min):
    if wear_min <= 100: return 'NEW_TOOL'
    if wear_min <= 200: return 'MID_TOOL'
    if wear_min <= 240: return 'OLD_TOOL'
    return 'WORN_TOOL'

df['condition_code'] = df['tool_wear_min'].apply(get_condition_code)
df['condition_fk'] = df['condition_code'].map(cond_map)

# ============================================================
# SIMULATE DATES (since dataset has no timestamps)
# ============================================================
# We assign records to business days in 2023, simulating 10,000 operations
random.seed(42)
start_date = date(2023, 1, 2)
all_biz_days = []
d = start_date
while len(all_biz_days) < 400: # Ensure enough days
    if d.weekday() < 5: # Monday-Friday
        all_biz_days.append(d)
    d += timedelta(days=1)

assigned_dates = [random.choice(all_biz_days) for _ in range(len(df))]
df['simulated_date'] = assigned_dates

# Fetch date dimension SK map
dim_date_df = pd.read_sql("SELECT date_sk, full_date FROM dw.dim_date", engine)
dim_date_df['full_date'] = pd.to_datetime(dim_date_df['full_date']).dt.date
date_map = dict(zip(dim_date_df['full_date'], dim_date_df['date_sk']))
df['date_fk'] = df['simulated_date'].map(date_map)

# ============================================================
# POPULATE FACT TABLE
# ============================================================
print("\nPopulating fact_machine_operations ...")

df['product_fk'] = df['product_id'].map(prod_map)

fact_cols = [
    'product_fk', 'failure_type_fk', 'condition_fk', 'date_fk',
    'record_id', # source_record_id
    'air_temp_k', 'process_temp_k', 'rotational_speed_rpm', 
    'torque_nm', 'tool_wear_min', 'machine_failure',
    'failure_twf', 'failure_hdf', 'failure_pwf',
    'failure_osf', 'failure_rnf', 'air_temp_c', 
    'process_temp_c', 'temp_differential_c', 'power_w'
]

# Create fact dataframe and rename the source tracking ID
fact_df = df[fact_cols].copy()
fact_df = fact_df.rename(columns={'record_id': 'source_record_id'})

# Drop nulls in FKs (safety check)
before = len(fact_df)
fact_df = fact_df.dropna(subset=['product_fk', 'failure_type_fk', 'condition_fk', 'date_fk'])
dropped = before - len(fact_df)
if dropped > 0:
    print(f"Warning: dropped {dropped} rows with null FK values")

# Load to fact table
with engine.connect() as conn:
    conn.execute(text("DELETE FROM dw.fact_machine_operations"))
    conn.commit()

fact_df.to_sql('fact_machine_operations', schema='dw', con=engine, if_exists='append', index=False, chunksize=500, method='multi')

# Verify
with engine.connect() as conn:
    cnt = conn.execute(text("SELECT COUNT(*) FROM dw.fact_machine_operations")).fetchone()[0]
    print(f"Inserted {cnt} rows into fact_machine_operations.")
    
    fail_cnt = conn.execute(text("SELECT COUNT(*) FROM dw.fact_machine_operations WHERE machine_failure = 1")).fetchone()[0]
    print(f"Of which {fail_cnt} are failure records.")

print("\n=== STAR SCHEMA POPULATION COMPLETE ===")