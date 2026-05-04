"""
CO4031 BTL - Manufacturing Data Warehouse ETL Pipeline
Full pipeline: Clean -> Stage -> Populate Star Schema -> Run OLAP Queries
"""

import os
import sys
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from datetime import date, timedelta
import random
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns

# ============================================================
# DATABASE CONNECTION
# ============================================================
DATABASE_URL = os.environ.get('DATABASE_URL')
if not DATABASE_URL:
    print("ERROR: DATABASE_URL environment variable not set.")
    sys.exit(1)

engine = create_engine(DATABASE_URL)

RAW_PATH     = "data/raw/ai4i2020.csv"
CLEANED_PATH = "data/cleaned/machine_data_cleaned.csv"
DIST_PATH    = "data/cleaned/eda_distributions.png"
HEATMAP_PATH = "data/cleaned/correlation_heatmap.png"

# ============================================================
# STEP 1: DATA EXPLORATION & CLEANING
# ============================================================
print("=" * 60)
print(" STEP 1: Loading & Cleaning Raw Data")
print("=" * 60)

raw = pd.read_csv(RAW_PATH)
print(f"Shape            : {raw.shape}")
print(f"Rows             : {raw.shape[0]}")
print(f"Columns          : {raw.shape[1]}")

numeric_cols = [
    'Air temperature [K]', 'Process temperature [K]',
    'Rotational speed [rpm]', 'Torque [Nm]', 'Tool wear [min]'
]

missing = raw.isnull().sum()
print(f"Total missing    : {missing.sum()}")
print(f"Duplicate rows   : {raw.duplicated().sum()}")

df = raw.copy()
before = len(df)
df = df.drop_duplicates()
print(f"Duplicate rows removed    : {before - len(df)}")

for col in numeric_cols:
    n_null = df[col].isnull().sum()
    if n_null > 0:
        med = df[col].median()
        df[col] = df[col].fillna(med)

before = len(df)
df = df[df['Air temperature [K]']     > 0]
df = df[df['Process temperature [K]'] > 0]
df = df[df['Rotational speed [rpm]']  > 0]
df = df[df['Torque [Nm]']             >= 0]
df = df[df['Tool wear [min]']         >= 0]
print(f"Impossible records removed: {before - len(df)}")

def remove_iqr_outliers(df, col, factor=3.0):
    Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
    IQR = Q3 - Q1
    lo, hi = Q1 - factor * IQR, Q3 + factor * IQR
    before = len(df)
    df = df[(df[col] >= lo) & (df[col] <= hi)]
    print(f"  '{col}': removed {before - len(df)} outliers")
    return df

print("Removing extreme outliers (IQR x3):")
for col in ['Rotational speed [rpm]', 'Torque [Nm]']:
    df = remove_iqr_outliers(df, col)
print(f"Records after cleaning    : {len(df)}")

# ============================================================
# STEP 2: TRANSFORMATION & FEATURE ENGINEERING
# ============================================================
print("\n" + "=" * 60)
print(" STEP 2: Feature Engineering")
print("=" * 60)

df['Air_Temp_C']          = df['Air temperature [K]']     - 273.15
df['Process_Temp_C']      = df['Process temperature [K]'] - 273.15
df['Temp_Differential_C'] = df['Process_Temp_C'] - df['Air_Temp_C']
df['Power_W']             = df['Torque [Nm]'] * (2 * np.pi * df['Rotational speed [rpm]'] / 60)
df['Type_Encoded']        = df['Type'].map({'L': 0, 'M': 1, 'H': 2})

def get_failure_type(row):
    if row['TWF'] == 1: return 'Tool Wear Failure'
    if row['HDF'] == 1: return 'Heat Dissipation Failure'
    if row['PWF'] == 1: return 'Power Failure'
    if row['OSF'] == 1: return 'Overstrain Failure'
    if row['RNF'] == 1: return 'Random Failure'
    return 'No Failure'

df['Failure_Type'] = df.apply(get_failure_type, axis=1)

rename_map = {
    'UDI': 'record_id', 'Product ID': 'product_id', 'Type': 'quality_type',
    'Air temperature [K]': 'air_temp_k', 'Process temperature [K]': 'process_temp_k',
    'Rotational speed [rpm]': 'rotational_speed_rpm', 'Torque [Nm]': 'torque_nm',
    'Tool wear [min]': 'tool_wear_min', 'Machine failure': 'machine_failure',
    'TWF': 'failure_twf', 'HDF': 'failure_hdf', 'PWF': 'failure_pwf',
    'OSF': 'failure_osf', 'RNF': 'failure_rnf',
    'Air_Temp_C': 'air_temp_c', 'Process_Temp_C': 'process_temp_c',
    'Temp_Differential_C': 'temp_differential_c', 'Power_W': 'power_w',
    'Type_Encoded': 'type_encoded', 'Failure_Type': 'failure_type',
}
df = df.rename(columns=rename_map)
print("Feature engineering complete.")
print(f"Columns: {list(df.columns)}")

df.to_csv(CLEANED_PATH, index=False)
print(f"Cleaned data saved to: {CLEANED_PATH}")

# ============================================================
# STEP 3: LOAD TO STAGING
# ============================================================
print("\n" + "=" * 60)
print(" STEP 3: Load to Staging Database")
print("=" * 60)

with engine.connect() as conn:
    conn.execute(text("CREATE SCHEMA IF NOT EXISTS staging"))
    conn.execute(text("DROP TABLE IF EXISTS staging.machine_data"))
    conn.execute(text("""
        CREATE TABLE staging.machine_data (
            record_id INTEGER PRIMARY KEY, product_id VARCHAR(20),
            quality_type CHAR(1), air_temp_k FLOAT, process_temp_k FLOAT,
            rotational_speed_rpm INTEGER, torque_nm FLOAT, tool_wear_min INTEGER,
            machine_failure SMALLINT, failure_twf SMALLINT, failure_hdf SMALLINT,
            failure_pwf SMALLINT, failure_osf SMALLINT, failure_rnf SMALLINT,
            air_temp_c FLOAT, process_temp_c FLOAT, temp_differential_c FLOAT,
            power_w FLOAT, type_encoded SMALLINT, failure_type VARCHAR(50),
            load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))
    conn.commit()

df.to_sql('machine_data', schema='staging', con=engine, if_exists='append', index=False,
          chunksize=1000, method='multi')

with engine.connect() as conn:
    count = conn.execute(text("SELECT COUNT(*) FROM staging.machine_data")).fetchone()[0]
    print(f"Loaded {count} rows into staging.machine_data")

# ============================================================
# STEP 4: POPULATE STAR SCHEMA
# ============================================================
print("\n" + "=" * 60)
print(" STEP 4: Populate Star Schema (Data Warehouse)")
print("=" * 60)

staging_df = pd.read_sql("SELECT * FROM staging.machine_data", engine)
print(f"Loaded {len(staging_df)} rows from staging.")

quality_label_map = {'L': 'Low Quality', 'M': 'Medium Quality', 'H': 'High Quality'}
quality_tier_map  = {'L': 1, 'M': 2, 'H': 3}

products = staging_df[['product_id', 'quality_type']].drop_duplicates()
products = products.copy()
products['quality_label'] = products['quality_type'].map(quality_label_map)
products['quality_tier']  = products['quality_type'].map(quality_tier_map)

with engine.connect() as conn:
    conn.execute(text("CREATE SCHEMA IF NOT EXISTS dw"))
    conn.commit()

with engine.connect() as conn:
    conn.execute(text("DELETE FROM dw.fact_machine_operations"))
    conn.execute(text("DELETE FROM dw.dim_product"))
    conn.commit()

products.to_sql('dim_product', schema='dw', con=engine, if_exists='append', index=False)
print(f"Inserted {len(products)} product dimension records.")

dim_prod_df = pd.read_sql("SELECT product_sk, product_id FROM dw.dim_product", engine)
prod_map = dict(zip(dim_prod_df['product_id'], dim_prod_df['product_sk']))

dim_fail_df = pd.read_sql("SELECT failure_type_sk, failure_code FROM dw.dim_failure_type", engine)
fail_code_map = dict(zip(dim_fail_df['failure_code'], dim_fail_df['failure_type_sk']))

def get_failure_code(row):
    if row['failure_twf'] == 1: return 'TWF'
    if row['failure_hdf'] == 1: return 'HDF'
    if row['failure_pwf'] == 1: return 'PWF'
    if row['failure_osf'] == 1: return 'OSF'
    if row['failure_rnf'] == 1: return 'RNF'
    return 'NF'

staging_df['failure_code']    = staging_df.apply(get_failure_code, axis=1)
staging_df['failure_type_fk'] = staging_df['failure_code'].map(fail_code_map)

dim_cond_df = pd.read_sql("SELECT condition_sk, condition_code FROM dw.dim_machine_condition", engine)
cond_map = dict(zip(dim_cond_df['condition_code'], dim_cond_df['condition_sk']))

def get_condition_code(wear_min):
    if wear_min <= 100: return 'NEW_TOOL'
    if wear_min <= 200: return 'MID_TOOL'
    if wear_min <= 240: return 'OLD_TOOL'
    return 'WORN_TOOL'

staging_df['condition_code'] = staging_df['tool_wear_min'].apply(get_condition_code)
staging_df['condition_fk']   = staging_df['condition_code'].map(cond_map)

random.seed(42)
dim_date_df = pd.read_sql("SELECT date_sk, full_date FROM dw.dim_date", engine)
dim_date_df['full_date'] = pd.to_datetime(dim_date_df['full_date']).dt.date
date_map = dict(zip(dim_date_df['full_date'], dim_date_df['date_sk']))

# Use all business days from dim_date for assignment
all_biz_days = [d for d in date_map.keys() if d.weekday() < 5]
staging_df['simulated_date'] = [random.choice(all_biz_days) for _ in range(len(staging_df))]
staging_df['date_fk']        = staging_df['simulated_date'].map(date_map)
staging_df['product_fk'] = staging_df['product_id'].map(prod_map)

fact_cols = [
    'product_fk', 'failure_type_fk', 'condition_fk', 'date_fk',
    'record_id', 'air_temp_c', 'process_temp_c', 'temp_differential_c',
    'rotational_speed_rpm', 'torque_nm', 'tool_wear_min', 'power_w',
    'machine_failure', 'failure_twf', 'failure_hdf', 'failure_pwf', 'failure_osf', 'failure_rnf'
]
fact_df = staging_df[fact_cols].copy()
fact_df = fact_df.rename(columns={'record_id': 'source_record_id'})

before = len(fact_df)
fact_df = fact_df.dropna(subset=['product_fk', 'failure_type_fk', 'condition_fk', 'date_fk'])
dropped = before - len(fact_df)
if dropped > 0:
    print(f"Warning: dropped {dropped} rows with null FK values")

fact_df.to_sql('fact_machine_operations', schema='dw', con=engine,
               if_exists='append', index=False, chunksize=500, method='multi')

with engine.connect() as conn:
    cnt      = conn.execute(text("SELECT COUNT(*) FROM dw.fact_machine_operations")).fetchone()[0]
    fail_cnt = conn.execute(text("SELECT COUNT(*) FROM dw.fact_machine_operations WHERE machine_failure = 1")).fetchone()[0]
    print(f"Inserted {cnt} rows into fact_machine_operations.")
    print(f"Of which {fail_cnt} are failure records ({fail_cnt/cnt*100:.1f}%).")

# ============================================================
# STEP 5: OLAP QUERIES
# ============================================================
print("\n" + "=" * 60)
print(" STEP 5: OLAP Analysis Queries")
print("=" * 60)

with engine.connect() as conn:
    print("\n--- Failure Distribution by Failure Type ---")
    result = conn.execute(text("""
        SELECT ft.failure_name, ft.failure_category,
               COUNT(*) AS total_ops,
               SUM(f.machine_failure) AS failures,
               ROUND(100.0 * SUM(f.machine_failure) / COUNT(*), 2) AS failure_rate_pct
        FROM dw.fact_machine_operations f
        JOIN dw.dim_failure_type ft ON f.failure_type_fk = ft.failure_type_sk
        GROUP BY ft.failure_name, ft.failure_category
        ORDER BY failures DESC
    """))
    rows = result.fetchall()
    print(f"{'Failure Type':<30} {'Category':<15} {'Total':>8} {'Failures':>10} {'Rate%':>8}")
    print("-" * 75)
    for row in rows:
        print(f"{row[0]:<30} {row[1]:<15} {row[2]:>8} {row[3]:>10} {row[4]:>8}")

    print("\n--- Failure Rate by Product Quality Type ---")
    result = conn.execute(text("""
        SELECT p.quality_label, p.quality_type,
               COUNT(*) AS total_ops,
               SUM(f.machine_failure) AS failures,
               ROUND(100.0 * SUM(f.machine_failure) / COUNT(*), 2) AS failure_rate_pct
        FROM dw.fact_machine_operations f
        JOIN dw.dim_product p ON f.product_fk = p.product_sk
        GROUP BY p.quality_label, p.quality_type, p.quality_tier
        ORDER BY p.quality_tier
    """))
    rows = result.fetchall()
    print(f"{'Quality Label':<20} {'Type':>6} {'Total':>8} {'Failures':>10} {'Rate%':>8}")
    print("-" * 55)
    for row in rows:
        print(f"{row[0]:<20} {row[1]:>6} {row[2]:>8} {row[3]:>10} {row[4]:>8}")

    print("\n--- Machine Condition vs Failure Rate ---")
    result = conn.execute(text("""
        SELECT mc.condition_label, mc.risk_label,
               COUNT(*) AS total_ops,
               SUM(f.machine_failure) AS failures,
               ROUND(100.0 * SUM(f.machine_failure) / COUNT(*), 2) AS failure_rate_pct
        FROM dw.fact_machine_operations f
        JOIN dw.dim_machine_condition mc ON f.condition_fk = mc.condition_sk
        GROUP BY mc.condition_label, mc.risk_label, mc.risk_level
        ORDER BY mc.risk_level
    """))
    rows = result.fetchall()
    print(f"{'Condition':<30} {'Risk':>10} {'Total':>8} {'Failures':>10} {'Rate%':>8}")
    print("-" * 70)
    for row in rows:
        print(f"{row[0]:<30} {row[1]:>10} {row[2]:>8} {row[3]:>10} {row[4]:>8}")

    print("\n--- Monthly Failure Trend (Top 6 months) ---")
    result = conn.execute(text("""
        SELECT d.year, d.month, d.month_name,
               COUNT(*) AS total_ops,
               SUM(f.machine_failure) AS failures
        FROM dw.fact_machine_operations f
        JOIN dw.dim_date d ON f.date_fk = d.date_sk
        GROUP BY d.year, d.month, d.month_name
        ORDER BY d.year, d.month
        LIMIT 6
    """))
    rows = result.fetchall()
    print(f"{'Year':>6} {'Month':>6} {'Month Name':<12} {'Total':>8} {'Failures':>10}")
    print("-" * 47)
    for row in rows:
        print(f"{row[0]:>6} {row[1]:>6} {row[2]:<12} {row[3]:>8} {row[4]:>10}")

print("\n" + "=" * 60)
print(" ETL PIPELINE COMPLETE")
print("=" * 60)
print(f"\nCleaned data : {CLEANED_PATH}")
print(f"Database     : staging.machine_data + dw.* (star schema)")
print(f"Schema       : dim_date, dim_product, dim_failure_type,")
print(f"               dim_machine_condition, fact_machine_operations")
