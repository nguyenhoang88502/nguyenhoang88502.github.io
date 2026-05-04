-- OLAP Query 2: Monthly Failure Trend
SELECT
    d.year AS "Year",
    d.month AS "Month",
    d.month_name AS "Month Name",
    COUNT(*) AS "Operations",
    SUM(f.machine_failure) AS "Failures",
    ROUND(100.0 * SUM(f.machine_failure) / COUNT(*), 2) AS "Failure Rate (%)"
FROM dw.fact_machine_operations f
JOIN dw.dim_date d ON f.date_fk = d.date_sk
GROUP BY d.year, d.month, d.month_name
ORDER BY d.year, d.month;