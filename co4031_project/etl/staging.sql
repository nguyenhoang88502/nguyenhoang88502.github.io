-- Create schema for staging area
CREATE SCHEMA IF NOT EXISTS staging;

-- Drop if exists (for clean re-runs during development)
DROP TABLE IF EXISTS staging.machine_data;

-- Create the staging table
CREATE TABLE staging.machine_data (
    record_id INTEGER PRIMARY KEY,
    product_id VARCHAR(20),
    quality_type CHAR(1),
    air_temp_k FLOAT,
    process_temp_k FLOAT,
    rotational_speed_rpm INTEGER,
    torque_nm FLOAT,
    tool_wear_min INTEGER,
    machine_failure SMALLINT,
    failure_twf SMALLINT,
    failure_hdf SMALLINT,
    failure_pwf SMALLINT,
    failure_osf SMALLINT,
    failure_rnf SMALLINT,
    -- Derived / transformed columns
    air_temp_c FLOAT,
    process_temp_c FLOAT,
    temp_differential_c FLOAT,
    power_w FLOAT,
    type_encoded SMALLINT,
    failure_type VARCHAR(50),
    load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
