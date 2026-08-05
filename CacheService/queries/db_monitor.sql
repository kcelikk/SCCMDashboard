-- DB Monitor: Component status
SELECT
    ComponentName,
    Status,
    State,
    Errors,
    Warnings,
    Infos,
    SiteCode
FROM v_ComponentSummarizer
ORDER BY Errors DESC, Warnings DESC, ComponentName
