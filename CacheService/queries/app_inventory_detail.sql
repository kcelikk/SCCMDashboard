-- App Inventory Detail: Cihaz bazli kurulu uygulamalar
SELECT
    s.Name0 AS Hostname,
    apps.DisplayName0 AS AppName,
    apps.Publisher0 AS Publisher,
    apps.Version0 AS Version,
    apps.InstallDate0 AS InstallDate
FROM (
    SELECT ResourceID, DisplayName0, Publisher0, Version0, InstallDate0
    FROM v_GS_ADD_REMOVE_PROGRAMS
    WHERE DisplayName0 IS NOT NULL AND DisplayName0 != ''
    UNION ALL
    SELECT ResourceID, DisplayName0, Publisher0, Version0, InstallDate0
    FROM v_GS_ADD_REMOVE_PROGRAMS_64
    WHERE DisplayName0 IS NOT NULL AND DisplayName0 != ''
) apps
JOIN v_R_System s ON apps.ResourceID = s.ResourceID
ORDER BY apps.DisplayName0, s.Name0
