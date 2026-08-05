-- SCCM Health: Component detayli durum
SELECT
    ComponentName,
    SiteCode,
    Status,
    State,
    CASE State
        WHEN 0 THEN 'Stopped'
        WHEN 1 THEN 'Started'
        WHEN 2 THEN 'Paused'
        WHEN 3 THEN 'Installing'
        ELSE 'Unknown'
    END AS StateName,
    CASE Status
        WHEN 0 THEN 'OK'
        WHEN 1 THEN 'Warning'
        WHEN 2 THEN 'Critical'
        ELSE 'Unknown'
    END AS StatusName,
    Errors,
    Warnings,
    Infos,
    Type,
    CASE Type
        WHEN 0 THEN 'Autostart'
        WHEN 1 THEN 'Scheduled'
        WHEN 2 THEN 'Manual'
        ELSE 'Other'
    END AS TypeName,
    TallyInterval,
    LastContacted AS LastMessageTime
FROM v_ComponentSummarizer
ORDER BY Status DESC, Errors DESC, State ASC, ComponentName
