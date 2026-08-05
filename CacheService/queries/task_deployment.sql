-- OS / Task Deployment: Task Sequence, OS Image, Boot Image dagitim durumu
SELECT
    ts.PackageID,
    ts.Name AS TaskSequenceName,
    ts.SourceVersion,
    ts.BootImageID,
    adv.AdvertisementID,
    adv.AdvertisementName,
    col.Name AS CollectionName,
    adv.PresentTime AS DeploymentDate,
    adv.ExpirationTime,
    adv.AdvertFlags,
    CASE
        WHEN adv.AdvertFlags & 0x04000000 > 0 THEN 'Required'
        ELSE 'Available'
    END AS DeploymentPurpose,
    CASE
        WHEN adv.AdvertFlags & 0x00400000 > 0 THEN 'PXE'
        WHEN adv.AdvertFlags & 0x00020000 > 0 THEN 'Media'
        ELSE 'Standard'
    END AS DeploymentMethod,
    COUNT(DISTINCT cas.ResourceID) AS TotalDevices,
    SUM(CASE WHEN cas.LastState = 13 THEN 1 ELSE 0 END) AS Success,
    SUM(CASE WHEN cas.LastState = 11 THEN 1 ELSE 0 END) AS Failed,
    SUM(CASE WHEN cas.LastState IN (8,9) THEN 1 ELSE 0 END) AS Running,
    SUM(CASE WHEN cas.LastState NOT IN (8,9,11,13) THEN 1 ELSE 0 END) AS Other
FROM v_TaskSequencePackage ts
JOIN v_Advertisement adv ON ts.PackageID = adv.PackageID
JOIN v_Collection col ON adv.CollectionID = col.CollectionID
LEFT JOIN v_ClientAdvertisementStatus cas ON adv.AdvertisementID = cas.AdvertisementID
GROUP BY ts.PackageID, ts.Name, ts.SourceVersion, ts.BootImageID,
    adv.AdvertisementID, adv.AdvertisementName, col.Name,
    adv.PresentTime, adv.ExpirationTime, adv.AdvertFlags
ORDER BY adv.PresentTime DESC
