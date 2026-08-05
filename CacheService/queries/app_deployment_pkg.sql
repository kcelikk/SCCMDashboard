-- App Deployment: Package/Program deployments
SELECT
    adv.AdvertisementID,
    adv.AdvertisementName,
    col.Name AS CollectionName,
    adv.PresentTime AS DeploymentDate,
    p.Name AS PackageName,
    pr.ProgramName,
    COUNT(DISTINCT cas.ResourceID) AS TotalDevices,
    SUM(CASE WHEN cas.LastState IN (13) THEN 1 ELSE 0 END) AS Success,
    SUM(CASE WHEN cas.LastState IN (11) THEN 1 ELSE 0 END) AS Failed,
    SUM(CASE WHEN cas.LastState IN (8,9) THEN 1 ELSE 0 END) AS Running,
    SUM(CASE WHEN cas.LastState NOT IN (8,9,11,13) THEN 1 ELSE 0 END) AS Other
FROM v_Advertisement adv
JOIN v_Collection col ON adv.CollectionID = col.CollectionID
JOIN v_Package p ON adv.PackageID = p.PackageID
LEFT JOIN v_Program pr ON adv.PackageID = pr.PackageID AND adv.ProgramName = pr.ProgramName
LEFT JOIN v_ClientAdvertisementStatus cas ON adv.AdvertisementID = cas.AdvertisementID
GROUP BY adv.AdvertisementID, adv.AdvertisementName, col.Name, adv.PresentTime,
         p.Name, pr.ProgramName
ORDER BY adv.PresentTime DESC
