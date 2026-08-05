-- DB Monitor: Site system status
SELECT
    SiteCode,
    SiteSystem,
    Role,
    Status,
    AvailabilityState
FROM v_SiteSystemSummarizer
ORDER BY Status DESC, Role
