# Manufacturing Failure Analysis Dashboard

CO4031 project: a data warehouse and business intelligence system for analyzing manufacturing machine failures using the AI4I 2020 predictive maintenance dataset.

The project includes a complete analytics workflow:

- raw dataset exploration and preprocessing
- ETL into a PostgreSQL staging area
- star-schema data warehouse design
- OLAP analysis outputs
- Streamlit dashboard for interactive BI reporting
- optional XGBoost machine-failure prediction model

## Project Purpose

The goal is to transform machine-operation data into business intelligence that helps answer questions such as:

- Which failure types happen most often?
- How does failure rate vary by product quality?
- How does tool wear affect machine risk?
- Which months have higher failure counts?
- Can machine failure be predicted from operating measurements?

The dashboard can run directly from included CSV outputs, so PostgreSQL is only required if you want to rebuild the ETL and data warehouse from the raw dataset.

## Repository Structure

```text
.
|-- app.py
|-- run_etl.py
|-- main.py
|-- pyproject.toml
|-- README.md
|
|-- .streamlit/
|   `-- config.toml
|
|-- data/
|   |-- raw/
|   |   |-- ai4i2020.csv
|   |   `-- 01_exploration.py
|   `-- cleaned/
|       |-- machine_data_cleaned.csv
|       |-- eda_distributions.png
|       `-- correlation_heatmap.png
|
|-- etl/
|   |-- staging.sql
|   |-- 02 _load_to_dw.py
|   `-- machine_etl.ktr
|
|-- dw/
|   |-- 01_create_star_schema.sql
|   |-- 02_populate_star.py
|   |-- OLAP Failure Distribution by Failure Type.sql
|   |-- OLAP Failure Distribution by Failure Type.csv
|   |-- OLAP Failure Rate by Product Quality Type.sql
|   |-- OLAP Failure Rate by Product Quality Type.csv
|   |-- OLAP Machine Condition vs Failure Rate.sql
|   |-- OLAP Machine Condition vs Failure Rate.csv
|   |-- OLAP Monthly Failure Trend.sql
|   |-- OLAP Monthly Failure Trend.csv
|   `-- ETL & DW & OLAP.docx
|
|-- ml/
|   |-- xgboost_failure_prediction.py
|   |-- xgboost_model.pkl
|   |-- scaler.pkl
|   `-- plots/
|       |-- model_evaluation.png
|       `-- shap_summary.png
|
`-- picture/
    |-- 01_kpi_cards.jpg
    |-- 01_overview_top.jpg
    |-- 02_failure_distribution_bar.jpg
    |-- 03_monthly_trend_line.jpg
    |-- 04_machine_condition_scatter.jpg
    |-- 05_product_quality_bar.jpg
    |-- 06_data_tables.jpg
    |-- 07_sidebar_filters.jpg
    `-- 08_full_dashboard_composite.jpg
```

## Main Components

### 1. Streamlit Dashboard

Main file:

```text
app.py
```

The dashboard reads the OLAP CSV files in `dw/` and displays:

- total records, total failures, average failure rate, and top failure type
- failure distribution by failure type
- monthly failure trend for 2023
- machine condition vs failure rate
- failure rate by product quality type
- detail tables for all OLAP datasets
- sidebar filters for failure type, month, and machine condition

Because the dashboard reads CSV files, it does not require PostgreSQL.

### 2. Full ETL Pipeline

Main file:

```text
run_etl.py
```

This script runs the complete pipeline:

1. Load raw data from `data/raw/ai4i2020.csv`
2. Inspect missing values and duplicates
3. Remove duplicate rows
4. Fill missing numeric values with medians
5. Remove physically impossible records
6. Remove extreme outliers from rotational speed and torque
7. Create derived features
8. Save cleaned data to `data/cleaned/machine_data_cleaned.csv`
9. Load data into `staging.machine_data`
10. Populate the `dw` star schema
11. Run OLAP summaries

This script requires PostgreSQL and a `DATABASE_URL` environment variable.

### 3. Data Warehouse

The data warehouse schema is defined in:

```text
dw/01_create_star_schema.sql
```

It uses a star schema:

```text
                         dim_date
                            |
dim_product -- fact_machine_operations -- dim_failure_type
                            |
                 dim_machine_condition
```

Fact table:

- `dw.fact_machine_operations`

Dimension tables:

- `dw.dim_date`
- `dw.dim_product`
- `dw.dim_failure_type`
- `dw.dim_machine_condition`

The fact table stores one machine operation per row. It contains foreign keys to each dimension plus operational measurements such as temperature, torque, tool wear, rotational speed, power, and failure flags.

### 4. OLAP Outputs

The OLAP query files and their exported CSV results are stored in `dw/`.

Included OLAP datasets:

- `OLAP Failure Distribution by Failure Type.csv`
- `OLAP Failure Rate by Product Quality Type.csv`
- `OLAP Machine Condition vs Failure Rate.csv`
- `OLAP Monthly Failure Trend.csv`

These CSV files are the direct data source for the dashboard.

### 5. Machine Learning Model

Main file:

```text
ml/xgboost_failure_prediction.py
```

The ML script trains an XGBoost classifier to predict `machine_failure` from machine operation features.

It performs:

- train/test split
- SMOTE oversampling for class imbalance
- feature scaling with `StandardScaler`
- XGBoost training
- classification report
- ROC-AUC evaluation
- confusion matrix
- feature importance plot
- SHAP explainability plot
- 5-fold cross-validation

Generated model artifacts:

- `ml/xgboost_model.pkl`
- `ml/scaler.pkl`

Generated plots:

- `ml/plots/model_evaluation.png`
- `ml/plots/shap_summary.png`

## Dataset

Dataset: AI4I 2020 Predictive Maintenance Dataset

Original dataset characteristics:

- 10,000 machine operation records
- machine operating conditions and product quality data
- binary machine failure label
- five specific failure indicator columns:
  - `TWF`: Tool Wear Failure
  - `HDF`: Heat Dissipation Failure
  - `PWF`: Power Failure
  - `OSF`: Overstrain Failure
  - `RNF`: Random Failure

Important raw columns:

- `UDI`
- `Product ID`
- `Type`
- `Air temperature [K]`
- `Process temperature [K]`
- `Rotational speed [rpm]`
- `Torque [Nm]`
- `Tool wear [min]`
- `Machine failure`
- `TWF`
- `HDF`
- `PWF`
- `OSF`
- `RNF`

## Feature Engineering

The preprocessing and ETL scripts create these additional features:

- `air_temp_c`: air temperature converted from Kelvin to Celsius
- `process_temp_c`: process temperature converted from Kelvin to Celsius
- `temp_differential_c`: process temperature minus air temperature
- `power_w`: mechanical power calculated from torque and rotational speed
- `type_encoded`: product quality encoded as numeric values
- `failure_type`: readable failure label derived from failure flags

## Dashboard Data Summary

The included dashboard CSV files currently summarize:

- 6,390 total operations
- 240 total failure records
- 3.76% average failure rate

Failure distribution:

| Failure Type | Occurrences | Percent of All Records |
| --- | ---: | ---: |
| No Failure | 6,145 | 96.17% |
| Heat Dissipation Failure | 80 | 1.25% |
| Power Failure | 65 | 1.02% |
| Overstrain Failure | 55 | 0.86% |
| Tool Wear Failure | 34 | 0.53% |
| Random Failure | 11 | 0.17% |

Failure rate by product quality:

| Product Quality | Operations | Failures | Failure Rate |
| --- | ---: | ---: | ---: |
| Low Quality | 3,844 | 161 | 4.19% |
| Medium Quality | 1,909 | 60 | 3.14% |
| High Quality | 637 | 19 | 2.98% |

Machine condition risk:

| Condition | Risk Level | Operations | Failures | Failure Rate |
| --- | --- | ---: | ---: | ---: |
| New Tool (0-100 min) | Low | 2,956 | 76 | 2.57% |
| Mid-Life Tool (100-200 min) | Medium | 2,930 | 84 | 2.87% |
| Aging Tool (200-240 min) | High | 494 | 76 | 15.38% |
| Worn Tool (>240 min) | Critical | 10 | 4 | 40.00% |

## Requirements

The project requires Python 3.11 or newer.

Core dashboard and ETL dependencies are listed in `pyproject.toml`:

- `streamlit`
- `plotly`
- `pandas`
- `numpy`
- `sqlalchemy`
- `psycopg2-binary`
- `matplotlib`
- `seaborn`
- `playwright`

The ML script also imports packages that are not currently listed in `pyproject.toml`:

- `scikit-learn`
- `imbalanced-learn`
- `xgboost`
- `shap`

Install the project dependencies:

```bash
pip install .
```

If you want to run the ML script, also install:

```bash
pip install scikit-learn imbalanced-learn xgboost shap
```

## Quick Start: Run the Dashboard

From the project root:

```bash
streamlit run app.py
```

The Streamlit config sets:

```text
address = "0.0.0.0"
port = 5000
```

Open the URL printed by Streamlit in the terminal. It is usually:

```text
http://localhost:5000
```

If Streamlit chooses another port, use the URL shown in the terminal.

## Run the Full ETL Pipeline

Use this path only if you want to rebuild the cleaned data, staging table, data warehouse, and OLAP results from the raw CSV.

### 1. Create a PostgreSQL database

Example database name:

```text
co4031_dw
```

### 2. Create the data warehouse schema

Run:

```sql
\i dw/01_create_star_schema.sql
```

or execute the SQL file using your preferred PostgreSQL client.

### 3. Set the database connection

Linux/macOS:

```bash
export DATABASE_URL="postgresql://username:password@localhost:5432/co4031_dw"
```

Windows PowerShell:

```powershell
$env:DATABASE_URL = "postgresql://username:password@localhost:5432/co4031_dw"
```

Windows CMD:

```cmd
set DATABASE_URL=postgresql://username:password@localhost:5432/co4031_dw
```

### 4. Run the pipeline

```bash
python run_etl.py
```

Important: `run_etl.py` assumes the `dw` schema and dimension tables already exist. Run `dw/01_create_star_schema.sql` first.

## Run Individual ETL Scripts

The repository also contains earlier step-by-step scripts:

- `data/raw/01_exploration.py`: explores and cleans raw data
- `etl/staging.sql`: creates `staging.machine_data`
- `etl/02 _load_to_dw.py`: loads cleaned CSV into PostgreSQL staging
- `dw/02_populate_star.py`: populates the star schema from staging

These scripts are useful for coursework explanation, but some contain hardcoded Windows paths and database credentials. Prefer `run_etl.py` for normal use because it reads the database URL from the environment.

## Run the ML Training Script

Make sure the cleaned data file exists:

```text
data/cleaned/machine_data_cleaned.csv
```

Then run:

```bash
python ml/xgboost_failure_prediction.py
```

The script saves:

- trained model to `ml/xgboost_model.pkl`
- scaler to `ml/scaler.pkl`
- plots to `ml/plots/`

## Key Files

| File | Purpose |
| --- | --- |
| `app.py` | Streamlit BI dashboard |
| `run_etl.py` | Main end-to-end ETL and OLAP pipeline |
| `dw/01_create_star_schema.sql` | Data warehouse schema |
| `etl/staging.sql` | Staging table schema |
| `data/raw/01_exploration.py` | Raw data exploration and preprocessing script |
| `ml/xgboost_failure_prediction.py` | XGBoost model training and explainability |
| `.streamlit/config.toml` | Streamlit server configuration |
| `picture/` | Dashboard screenshots |
| `main.py` | Placeholder script, not used by the project workflow |

## Notes and Limitations

- The dashboard does not query PostgreSQL directly; it reads exported OLAP CSV files.
- The AI4I dataset has no real timestamp column, so the warehouse assigns simulated business dates in 2023.
- The included OLAP CSV files are already generated and can be used immediately.
- The step-by-step ETL scripts include hardcoded paths and credentials; use `run_etl.py` for a cleaner environment-based workflow.
- Some text in older files may display encoding artifacts, but the functional Python, SQL, CSV, and image assets are present.
- The ML dependencies are not fully represented in `pyproject.toml`; install the extra ML packages before running the XGBoost script.

## Recommended Demo Flow

For a project presentation, use this order:

1. Explain the AI4I 2020 dataset and failure labels.
2. Show preprocessing and feature engineering.
3. Present the staging table and star schema.
4. Explain the fact table and four dimensions.
5. Show the OLAP query outputs.
6. Run the Streamlit dashboard.
7. Optionally explain the XGBoost prediction model and SHAP output.

## Technology Stack

| Layer | Tools |
| --- | --- |
| Data processing | Python, pandas, NumPy |
| Visualization | Streamlit, Plotly, Matplotlib, Seaborn |
| Database | PostgreSQL |
| Database access | SQLAlchemy, psycopg2 |
| Data warehouse | Star schema with fact and dimension tables |
| Machine learning | XGBoost, scikit-learn, SMOTE, SHAP |
| ETL tooling | Python scripts, SQL scripts, Pentaho/Kettle `.ktr` file |
