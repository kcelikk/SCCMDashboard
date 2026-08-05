-- App Inventory: Aggregated installed applications
SELECT
    DisplayName0 AS AppName,
    Publisher0 AS Publisher,
    Version0 AS Version,
    COUNT(DISTINCT ResourceID) AS InstalledCount
FROM (
    SELECT ResourceID, DisplayName0, Publisher0, Version0
    FROM v_GS_ADD_REMOVE_PROGRAMS
    WHERE DisplayName0 IS NOT NULL AND DisplayName0 != ''
    UNION ALL
    SELECT ResourceID, DisplayName0, Publisher0, Version0
    FROM v_GS_ADD_REMOVE_PROGRAMS_64
    WHERE DisplayName0 IS NOT NULL AND DisplayName0 != ''
) apps
GROUP BY DisplayName0, Publisher0, Version0
ORDER BY InstalledCount DESC, DisplayName0
