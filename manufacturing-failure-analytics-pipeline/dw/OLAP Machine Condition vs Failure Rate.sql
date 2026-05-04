-- OLAP Query 4: Machine Condition vs Failure Rate
SELECT
    mc.condition_label AS "Condition",
    mc.risk_label AS "Risk Level",
    COUNT(*) AS "Operations",
    SUM(f.machine_failure) AS "Failures",
    ROUND(100.0 * SUM(f.machine_failure) / COUNT(*), 2) AS "Failure Rate (%)",
    mc.action_required AS "Recommended Action"
FROM dw.fact_machine_operations f
JOIN dw.dim_machine_condition mc ON f.condition_fk = mc.condition_sk
GROUP BY mc.condition_label, mc.risk_label, mc.risk_level, mc.action_required
ORDER BY mc.risk_level;