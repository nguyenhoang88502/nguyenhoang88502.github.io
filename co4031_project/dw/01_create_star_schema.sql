-- ============================================================
-- CO4031 BTL - Data Warehouse Star Schema
-- Database : co4031_dw
-- ============================================================

-- Create DW schema
CREATE SCHEMA IF NOT EXISTS dw;

-- ============================================================
-- DIMENSION TABLE 1: DIM_DATE
-- ============================================================
DROP TABLE IF EXISTS dw.dim_date CASCADE;

CREATE TABLE dw.dim_date (
    date_sk SERIAL PRIMARY KEY,
    full_date DATE NOT NULL UNIQUE,
    year SMALLINT NOT NULL,
    quarter SMALLINT NOT NULL, -- 1, 2, 3, 4
    month SMALLINT NOT NULL,
    month_name VARCHAR(15) NOT NULL,
    week SMALLINT NOT NULL, -- ISO week number
    day_of_month SMALLINT NOT NULL,
    day_of_week SMALLINT NOT NULL, -- 1=Mon, 7=Sun
    day_name VARCHAR(15) NOT NULL,
    is_weekend BOOLEAN NOT NULL
);

COMMENT ON TABLE dw.dim_date IS 'Date dimension table for temporal analysis';

-- Populate dim_date for 2023 (simulated data period)
INSERT INTO dw.dim_date
    (full_date, year, quarter, month, month_name, week, 
     day_of_month, day_of_week, day_name, is_weekend)
SELECT
    d::DATE AS full_date,
    EXTRACT(YEAR FROM d)::SMALLINT AS year,
    EXTRACT(QUARTER FROM d)::SMALLINT AS quarter,
    EXTRACT(MONTH FROM d)::SMALLINT AS month,
    TO_CHAR(d, 'Month') AS month_name,
    EXTRACT(WEEK FROM d)::SMALLINT AS week,
    EXTRACT(DAY FROM d)::SMALLINT AS day_of_month,
    EXTRACT(ISODOW FROM d)::SMALLINT AS day_of_week,
    TO_CHAR(d, 'Day') AS day_name,
    EXTRACT(ISODOW FROM d) IN (6, 7) AS is_weekend
FROM generate_series('2023-01-01'::DATE, '2023-12-31'::DATE, '1 day'::INTERVAL) AS s(d);

-- ============================================================
-- DIMENSION TABLE 2: DIM_PRODUCT
-- ============================================================
DROP TABLE IF EXISTS dw.dim_product CASCADE;

CREATE TABLE dw.dim_product (
    product_sk SERIAL PRIMARY KEY,
    product_id VARCHAR(20) NOT NULL,
    quality_type CHAR(1) NOT NULL, -- L, M, H
    quality_label VARCHAR(30) NOT NULL,
    quality_tier SMALLINT NOT NULL -- 1=Low, 2=Medium, 3=High
);

COMMENT ON TABLE dw.dim_product IS 'Product dimension: quality grades and product codes';

-- ============================================================
-- DIMENSION TABLE 3: DIM_FAILURE_TYPE
-- ============================================================
DROP TABLE IF EXISTS dw.dim_failure_type CASCADE;

CREATE TABLE dw.dim_failure_type (
    failure_type_sk SERIAL PRIMARY KEY,
    failure_code VARCHAR(5) NOT NULL UNIQUE,
    failure_name VARCHAR(60) NOT NULL,
    failure_category VARCHAR(30) NOT NULL,
    severity_level SMALLINT NOT NULL, -- 1=Low, 2=Medium, 3=High
    description TEXT
);

COMMENT ON TABLE dw.dim_failure_type IS 'Failure type dimension: codes, names, and severity';

-- Insert all failure types including "No Failure"
INSERT INTO dw.dim_failure_type
    (failure_code, failure_name, failure_category, severity_level, description)
VALUES
    ('NF',  'No Failure', 'Normal', 1, 'Machine operated within normal parameters. No failure detected.'),
    ('TWF', 'Tool Wear Failure', 'Mechanical', 2, 'Failure caused by excessive tool wear beyond service limit.'),
    ('HDF', 'Heat Dissipation Failure', 'Thermal', 3, 'Failure due to inadequate heat dissipation causing overheating.'),
    ('PWF', 'Power Failure', 'Electrical', 3, 'Failure caused by power supply operating outside rated parameters.'),
    ('OSF', 'Overstrain Failure', 'Mechanical', 3, 'Failure caused by mechanical overstrain exceeding torque limits.'),
    ('RNF', 'Random Failure', 'Unknown', 2, 'Failure with no identifiable root cause. Requires investigation.');

-- ============================================================
-- DIMENSION TABLE 4: DIM_MACHINE_CONDITION
-- ============================================================
DROP TABLE IF EXISTS dw.dim_machine_condition CASCADE;

CREATE TABLE dw.dim_machine_condition (
    condition_sk SERIAL PRIMARY KEY,
    condition_code VARCHAR(10) NOT NULL UNIQUE,
    condition_label VARCHAR(30) NOT NULL,
    risk_level SMALLINT NOT NULL, -- 1=Low, 2=Med, 3=High, 4=Critical
    risk_label VARCHAR(20) NOT NULL,
    action_required TEXT NOT NULL
);

COMMENT ON TABLE dw.dim_machine_condition IS 'Machine health condition dimension for maintenance decisions';

INSERT INTO dw.dim_machine_condition
    (condition_code, condition_label, risk_level, risk_label, action_required)
VALUES
    ('NEW_TOOL',  'New Tool (0-100 min)', 1, 'Low', 'Continue normal operation. Schedule next inspection.'),
    ('MID_TOOL',  'Mid-Life Tool (100-200 min)', 2, 'Medium', 'Monitor closely. Plan tool replacement within 3 days.'),
    ('OLD_TOOL',  'Aging Tool (200-240 min)', 3, 'High', 'Prioritize tool replacement at next opportunity.'),
    ('WORN_TOOL', 'Worn Tool (>240 min)', 4, 'Critical', 'Stop machine and replace tool immediately.');

-- ============================================================
-- FACT TABLE : FACT_MACHINE_OPERATIONS
-- ============================================================
DROP TABLE IF EXISTS dw.fact_machine_operations CASCADE;

CREATE TABLE dw.fact_machine_operations (
    operation_sk BIGSERIAL PRIMARY KEY,
    -- Foreign keys to dimensions
    product_fk INTEGER NOT NULL REFERENCES dw.dim_product(product_sk),
    failure_type_fk INTEGER NOT NULL REFERENCES dw.dim_failure_type(failure_type_sk),
    condition_fk INTEGER NOT NULL REFERENCES dw.dim_machine_condition(condition_sk),
    date_fk INTEGER NOT NULL REFERENCES dw.dim_date(date_sk),
    -- Source tracking
    source_record_id INTEGER NOT NULL, -- UDI from original CSV
    -- Measurements (facts / metrics)
    air_temp_c FLOAT NOT NULL,
    process_temp_c FLOAT NOT NULL,
    temp_differential_c FLOAT NOT NULL,
    rotational_speed_rpm INTEGER NOT NULL,
    torque_nm FLOAT NOT NULL,
    tool_wear_min INTEGER NOT NULL,
    power_w FLOAT NOT NULL,
    -- Outcome flags
    machine_failure SMALLINT NOT NULL,
    failure_twf SMALLINT NOT NULL,
    failure_hdf SMALLINT NOT NULL,
    failure_pwf SMALLINT NOT NULL,
    failure_osf SMALLINT NOT NULL,
    failure_rnf SMALLINT NOT NULL
);

COMMENT ON TABLE dw.fact_machine_operations IS 'Central fact table: one row per manufacturing operation / cycle';

-- Create indexes for query performance
CREATE INDEX idx_fact_product ON dw.fact_machine_operations(product_fk);
CREATE INDEX idx_fact_failure ON dw.fact_machine_operations(failure_type_fk);
CREATE INDEX idx_fact_date ON dw.fact_machine_operations(date_fk);
CREATE INDEX idx_fact_fail_flag ON dw.fact_machine_operations(machine_failure);
