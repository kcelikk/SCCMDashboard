-- SCCM Alerts: Aktif ve gecmis uyarilar
SELECT
    ID AS AlertID,
    Name AS AlertName,
    AlertState,
    CASE AlertState
        WHEN 0 THEN 'Active'
        WHEN 1 THEN 'Postponed'
        WHEN 2 THEN 'Canceled'
        WHEN 3 THEN 'Unknown'
        WHEN 4 THEN 'Disabled'
        WHEN 5 THEN 'Never Triggered'
        ELSE 'Other'
    END AS AlertStateName,
    Severity,
    CASE Severity
        WHEN 1 THEN 'Error'
        WHEN 2 THEN 'Warning'
        WHEN 3 THEN 'Informational'
        ELSE 'Unknown'
    END AS SeverityName,
    TypeID,
    TypeInstanceID,
    CASE
        WHEN ParameterValues IS NOT NULL
        THEN ParameterValues.value(
            '(/Parameters/Parameter[@index="1"])[1]', 'NVARCHAR(100)'
        )
        ELSE NULL
    END AS SourceSiteCode,
    CreationTime AS DateCreated,
    LastChangeTime AS DateLastModified,
    OccurrenceCount,
    ClosedBy,
    FeatureArea
FROM v_Alert
ORDER BY
    CASE AlertState WHEN 0 THEN 0 ELSE 1 END,
    Severity ASC,
    LastChangeTime DESC
