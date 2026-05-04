-- OLAP Query 3: Failure Distribution by Failure Type
SELECT
    ft.failure_name AS "Failure Type",
    ft.failure_category AS "Category",
    ft.severity_level AS "Severity",
    COUNT(*) AS "Occurrences",
    ROUND((100.0 * COUNT(*) / SUM(COUNT(*)) OVER ())::numeric, 2) AS "% of All Records",
    ROUND(AVG(f.tool_wear_min)::numeric, 1) AS "Avg Tool Wear (min)",
    ROUND(AVG(f.torque_nm)::numeric, 2) AS "Avg Torque (Nm)"
FROM dw.fact_machine_operations f
JOIN dw.dim_failure_type ft ON f.failure_type_fk = ft.failure_type_sk
GROUP BY ft.failure_name, ft.failure_category, ft.severity_level, ft.failure_code
ORDER BY COUNT(*) DESC;