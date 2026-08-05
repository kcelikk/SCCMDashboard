-- SCCM Health: Site bilgisi
SELECT
    SiteCode,
    SiteName,
    BuildNumber,
    Type,
    Status,
    CASE Status
        WHEN 1 THEN 'Active'
        WHEN 2 THEN 'Maintenance'
        WHEN 3 THEN 'Recovery'
        ELSE 'Unknown'
    END AS StatusName
FROM v_Site
ORDER BY SiteCode
