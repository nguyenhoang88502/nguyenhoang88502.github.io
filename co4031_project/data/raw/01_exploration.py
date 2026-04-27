"""
CO4031 - Data Warehouse | BTL Guide
CHAPTER 3. DATA PREPROCESSING
Script: 01_exploration.py
"""

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
import os
import warnings

warnings.filterwarnings('ignore')

# ============================================================
# PATHS
# ============================================================

RAW_PATH     = r"C:\co4031_project\data\raw\ai4i2020.csv"
CLEANED_PATH = r"C:\co4031_project\data\cleaned\machine_data_cleaned.csv"
DIST_PATH    = r"C:\co4031_project\data\cleaned\eda_distributions.png"
HEATMAP_PATH = r"C:\co4031_project\data\cleaned\correlation_heatmap.png"

os.makedirs(os.path.dirname(CLEANED_PATH), exist_ok=True)

# ============================================================
# SECTION 1: Load Raw Data (READ ONLY — never written back)
# ============================================================

print("=" * 60)
print(" STEP 1: Loading Raw Data ")
print("=" * 60)

raw = pd.read_csv(RAW_PATH)

print(f"Shape            : {raw.shape}")
print(f"Rows             : {raw.shape[0]}")
print(f"Columns          : {raw.shape[1]}")
print()
print("First 5 rows:")
print(raw.head())
print()
print("Column data types:")
print(raw.dtypes)
print()

# ============================================================
# SECTION 2: Data Quality Inspection
# ============================================================

print("=" * 60)
print(" STEP 2: Data Quality Inspection ")
print("=" * 60)

missing = raw.isnull().sum()
print("Missing values per column:")
print(missing)
print(f"Total missing    : {missing.sum()}")
print()

n_dup = raw.duplicated().sum()
print(f"Duplicate rows   : {n_dup}")
print()

numeric_cols = [
    'Air temperature [K]',
    'Process temperature [K]',
    'Rotational speed [rpm]',
    'Torque [Nm]',
    'Tool wear [min]'
]

print("Descriptive statistics (numeric columns):")
print(raw[numeric_cols].describe().round(2))
print()

# ============================================================
# SECTION 3: Cleaning  (work on a copy — raw is untouched)
# ============================================================

print("=" * 60)
print(" STEP 3: Data Cleaning ")
print("=" * 60)

df = raw.copy()

# 3a: Remove duplicates
before = len(df)
df = df.drop_duplicates()
print(f"Duplicate rows removed    : {before - len(df)}")

# 3b: Fill missing values with column median
for col in numeric_cols:
    n_null = df[col].isnull().sum()
    if n_null > 0:
        med = df[col].median()
        df[col] = df[col].fillna(med)
        print(f"  Filled {n_null} nulls in '{col}' with median={med:.2f}")
print("Missing value handling    : complete")

# 3c: Remove physically impossible values
before = len(df)
df = df[df['Air temperature [K]']     > 0]
df = df[df['Process temperature [K]'] > 0]
df = df[df['Rotational speed [rpm]']  > 0]
df = df[df['Torque [Nm]']             >= 0]
df = df[df['Tool wear [min]']         >= 0]
print(f"Impossible records removed: {before - len(df)}")

# 3d: IQR outlier removal (factor=3 — only extreme outliers)
def remove_iqr_outliers(df, col, factor=3.0):
    Q1, Q3 = df[col].quantile(0.25), df[col].quantile(0.75)
    IQR = Q3 - Q1
    lo, hi = Q1 - factor * IQR, Q3 + factor * IQR
    before = len(df)
    df = df[(df[col] >= lo) & (df[col] <= hi)]
    print(f"  '{col}': removed {before - len(df)} outliers  [{lo:.1f} – {hi:.1f}]")
    return df

print("Removing extreme outliers (IQR x3):")
for col in ['Rotational speed [rpm]', 'Torque [Nm]']:
    df = remove_iqr_outliers(df, col)

print(f"Records after cleaning    : {len(df)}")
print()

# ============================================================
# SECTION 4: Transformation & Feature Engineering
# ============================================================

print("=" * 60)
print(" STEP 4: Data Transformation ")
print("=" * 60)

# 4a: Kelvin → Celsius
df['Air_Temp_C']     = df['Air temperature [K]']     - 273.15
df['Process_Temp_C'] = df['Process temperature [K]'] - 273.15
print("Converted: temperatures K → C")

# 4b: Temperature differential
df['Temp_Differential_C'] = df['Process_Temp_C'] - df['Air_Temp_C']
print("Created  : Temp_Differential_C")

# 4c: Mechanical power  (W = Nm * rad/s)
df['Power_W'] = df['Torque [Nm]'] * (2 * np.pi * df['Rotational speed [rpm]'] / 60)
print("Created  : Power_W")

# 4d: Encode quality type  L=0  M=1  H=2
type_map = {'L': 0, 'M': 1, 'H': 2}
df['Type_Encoded'] = df['Type'].map(type_map)
print("Created  : Type_Encoded (L=0, M=1, H=2)")

# 4e: Human-readable failure label
def get_failure_type(row):
    if   row['TWF'] == 1: return 'Tool Wear Failure'
    elif row['HDF'] == 1: return 'Heat Dissipation Failure'
    elif row['PWF'] == 1: return 'Power Failure'
    elif row['OSF'] == 1: return 'Overstrain Failure'
    elif row['RNF'] == 1: return 'Random Failure'
    else:                 return 'No Failure'

df['Failure_Type'] = df.apply(get_failure_type, axis=1)
print("Created  : Failure_Type")

# 4f: Rename ALL columns to snake_case
rename_map = {
    'UDI'                    : 'record_id',
    'Product ID'             : 'product_id',
    'Type'                   : 'quality_type',
    'Air temperature [K]'    : 'air_temp_k',
    'Process temperature [K]': 'process_temp_k',
    'Rotational speed [rpm]' : 'rotational_speed_rpm',
    'Torque [Nm]'            : 'torque_nm',
    'Tool wear [min]'        : 'tool_wear_min',
    'Machine failure'        : 'machine_failure',
    'TWF'                    : 'failure_twf',
    'HDF'                    : 'failure_hdf',
    'PWF'                    : 'failure_pwf',
    'OSF'                    : 'failure_osf',
    'RNF'                    : 'failure_rnf',
    'Air_Temp_C'             : 'air_temp_c',
    'Process_Temp_C'         : 'process_temp_c',
    'Temp_Differential_C'    : 'temp_differential_c',
    'Power_W'                : 'power_w',
    'Type_Encoded'           : 'type_encoded',
    'Failure_Type'           : 'failure_type',
}
df = df.rename(columns=rename_map)
print("Renamed  : all columns → snake_case")
print()

# Sanity check — confirm the two critical columns exist before saving
assert 'type_encoded' in df.columns, "BUG: type_encoded missing after rename"
assert 'failure_type' in df.columns, "BUG: failure_type missing after rename"
print("Sanity check: type_encoded ✓   failure_type ✓")
print()

# ============================================================
# SECTION 5: Feature Correlation Analysis
# ============================================================

print("=" * 60)
print(" STEP 5: Feature Correlation Analysis ")
print("=" * 60)

feature_cols = [
    'air_temp_k',
    'process_temp_k',
    'rotational_speed_rpm',
    'torque_nm',
    'tool_wear_min',
    'temp_differential_c',
    'power_w',
]

print("Correlation with machine_failure:")
corr = df[feature_cols + ['machine_failure']].corr()['machine_failure']
print(corr.drop('machine_failure').sort_values(ascending=False).round(4))
print("\nAll 7 features retained (domain knowledge).")
print()

# ============================================================
# SECTION 6: Save Cleaned Dataset
# ============================================================

print("=" * 60)
print(" STEP 6: Saving Cleaned Dataset ")
print("=" * 60)

df.to_csv(CLEANED_PATH, index=False)

print(f"Saved to      : {CLEANED_PATH}")
print(f"Final shape   : {df.shape}")
print()
print("All columns in cleaned file:")
for c in df.columns:
    print(f"  {c}")
print()
print("Machine failure distribution:")
dist = df['machine_failure'].value_counts(normalize=True).round(4) * 100
print(dist.rename({0: 'Normal (%)', 1: 'Failure (%)'}))
print()
print("Failure type distribution:")
print(df['failure_type'].value_counts())
print()
print("Type encoded distribution:")
print(df['type_encoded'].value_counts().sort_index())
print()

# ============================================================
# SECTION 7: Visualisations
# ============================================================

print("=" * 60)
print(" STEP 7: Visualisations ")
print("=" * 60)

# --- Distribution plots ---
plot_features = [
    ('air_temp_k',           'Air Temperature (K)'),
    ('process_temp_k',       'Process Temperature (K)'),
    ('rotational_speed_rpm', 'Rotational Speed (RPM)'),
    ('torque_nm',            'Torque (Nm)'),
    ('tool_wear_min',        'Tool Wear (min)'),
    ('power_w',              'Power (W)'),
]

fig, axes = plt.subplots(2, 3, figsize=(15, 10))
fig.suptitle('Feature Distributions by Machine Failure Status', fontsize=14, fontweight='bold')

for ax, (col, label) in zip(axes.flatten(), plot_features):
    normal  = df[df['machine_failure'] == 0][col]
    failure = df[df['machine_failure'] == 1][col]
    ax.hist(normal,  bins=40, alpha=0.6, label='Normal',  color='steelblue')
    ax.hist(failure, bins=40, alpha=0.7, label='Failure', color='tomato')
    ax.set_title(label, fontsize=10)
    ax.set_xlabel(label)
    ax.set_ylabel('Count')
    ax.legend(fontsize=8)

plt.tight_layout()
plt.savefig(DIST_PATH, dpi=150, bbox_inches='tight')
plt.close()
print(f"Saved: {DIST_PATH}")

# --- Correlation heatmap ---
fig2, ax2 = plt.subplots(figsize=(10, 8))
corr_matrix = df[feature_cols + ['machine_failure']].corr()
sns.heatmap(
    corr_matrix, annot=True, fmt='.2f',
    cmap='coolwarm', center=0, ax=ax2, linewidths=0.5
)
ax2.set_title('Feature Correlation Heatmap', fontsize=13, fontweight='bold')
plt.tight_layout()
plt.savefig(HEATMAP_PATH, dpi=150, bbox_inches='tight')
plt.close()
print(f"Saved: {HEATMAP_PATH}")

print()
print("=== PREPROCESSING COMPLETE ===")