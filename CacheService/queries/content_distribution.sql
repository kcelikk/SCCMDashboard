-- Content Distribution: Paket dagitim durumu
-- v_ContentDistributionReport uzerinden paket bazli agrege (StateGroup: 1=Success, 2=InProgress, 3=Error)
SELECT
    cdr.PkgID AS PackageID,
    pkg.Name AS PackageName,
    pkg.PackageType,
    CASE pkg.PackageType
        WHEN 0 THEN 'Package'
        WHEN 3 THEN 'Driver Package'
        WHEN 4 THEN 'Task Sequence'
        WHEN 5 THEN 'Update Package'
        WHEN 6 THEN 'Device Setting'
        WHEN 8 THEN 'Application'
        WHEN 257 THEN 'OS Image'
        WHEN 258 THEN 'Boot Image'
        WHEN 259 THEN 'OS Upgrade'
        ELSE 'Other'
    END AS PackageTypeName,
    COUNT(*) AS NumberTargeted,
    SUM(CASE WHEN cdr.StateGroup = 1 THEN 1 ELSE 0 END) AS NumberInstalled,
    SUM(CASE WHEN cdr.StateGroup = 2 THEN 1 ELSE 0 END) AS NumberInProgress,
    SUM(CASE WHEN cdr.StateGroup = 3 THEN 1 ELSE 0 END) AS NumberErrors,
    CASE
        WHEN COUNT(*) > 0 THEN CAST(ROUND(
            SUM(CASE WHEN cdr.StateGroup = 1 THEN 1.0 ELSE 0 END) * 100.0 / COUNT(*), 1
        ) AS DECIMAL(5,1))
        ELSE 0
    END AS SuccessPercent
FROM v_ContentDistributionReport cdr
JOIN v_Package pkg ON cdr.PkgID = pkg.PackageID
GROUP BY cdr.PkgID, pkg.Name, pkg.PackageType
ORDER BY SUM(CASE WHEN cdr.StateGroup = 3 THEN 1 ELSE 0 END) DESC, pkg.Name
