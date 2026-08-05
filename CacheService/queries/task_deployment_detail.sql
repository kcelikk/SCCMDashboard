-- OS / Task Deployment Detail: Cihaz bazli task sequence durumu
SELECT
    adv.AdvertisementID,
    s.Name0 AS Hostname,
    s.Operating_System_Name_and0 AS OS,
    cas.LastState,
    CASE cas.LastState
        WHEN 8 THEN 'Waiting'
        WHEN 9 THEN 'Running'
        WHEN 11 THEN 'Failed'
        WHEN 13 THEN 'Success'
        ELSE 'Other (' + CAST(ISNULL(cas.LastState,0) AS VARCHAR) + ')'
    END AS StateName,
    cas.LastStatusTime,
    cas.LastExecutionResult
FROM v_Advertisement adv
JOIN v_TaskSequencePackage ts ON adv.PackageID = ts.PackageID
JOIN v_ClientAdvertisementStatus cas ON adv.AdvertisementID = cas.AdvertisementID
JOIN v_R_System s ON cas.ResourceID = s.ResourceID
ORDER BY adv.AdvertisementID, s.Name0
