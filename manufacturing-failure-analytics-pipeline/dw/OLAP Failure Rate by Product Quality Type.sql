-- OLAP Query 1: Failure Rate by Product Quality Type
SELECT
    p.quality_label AS "Product Quality",
    COUNT(*) AS "Total Operations",
    SUM(f.machine_failure) AS "Total Failures",
    ROUND((100.0 * SUM(f.machine_failure) / COUNT(*))::numeric, 2) AS "Failure Rate (%)",
    ROUND(AVG(f.torque_nm)::numeric, 2) AS "Avg Torque (Nm)",
    ROUND(AVG(f.tool_wear_min)::numeric, 1) AS "Avg Tool Wear (min)"
FROM dw.fact_machine_operations f
JOIN dw.dim_product p ON f.product_fk = p.product_sk
GROUP BY p.quality_label, p.quality_tier
ORDER BY p.quality_tier;