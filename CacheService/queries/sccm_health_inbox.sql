-- SCCM Health: Site system detay (inbox yerine site system kullan)
SELECT
    ss.SiteCode,
    CASE
        WHEN ss.SiteSystem LIKE '%Display=\\%'
        THEN REPLACE(SUBSTRING(ss.SiteSystem,
            CHARINDEX('\\', ss.SiteSystem) + 2,
            CHARINDEX('\"]', ss.SiteSystem) - CHARINDEX('\\', ss.SiteSystem) - 2
        ), '\', '')
        ELSE ss.SiteSystem
    END AS SiteSystem,
    ss.Role,
    ss.Status,
    CASE ss.Status
        WHEN 0 THEN 'OK'
        WHEN 1 THEN 'Warning'
        WHEN 2 THEN 'Critical'
        ELSE 'Unknown'
    END AS StatusName,
    ss.AvailabilityState,
    CASE ss.AvailabilityState
        WHEN 0 THEN 'Online'
        WHEN 3 THEN 'Offline'
        ELSE 'Unknown'
    END AS AvailabilityName
FROM v_SiteSystemSummarizer ss
ORDER BY ss.Status DESC, ss.Role
