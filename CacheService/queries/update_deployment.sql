-- Update Deployment: Deployment bazli compliance durumu
-- COUNT(DISTINCT) kullanilir: bir cihaz birden fazla update icin sayilmamali
SELECT
    a.AssignmentID,
    a.AssignmentName,
    a.CollectionName,
    a.StartTime AS DeploymentDate,
    a.AssignmentType,
    COUNT(DISTINCT ucs.ResourceID) AS TotalDevices,
    COUNT(DISTINCT CASE WHEN ucs.Status = 3 THEN ucs.ResourceID END) AS Installed,
    COUNT(DISTINCT CASE WHEN ucs.Status = 2 THEN ucs.ResourceID END) AS Required,
    COUNT(DISTINCT CASE WHEN ucs.Status = 0 THEN ucs.ResourceID END) AS Unknown,
    COUNT(DISTINCT CASE WHEN ucs.Status NOT IN (0,2,3) THEN ucs.ResourceID END) AS Failed,
    COUNT(DISTINCT ac.CI_ID) AS UpdateCount
FROM v_CIAssignment a
JOIN v_CIAssignmentToCI ac ON a.AssignmentID = ac.AssignmentID
JOIN v_UpdateComplianceStatus ucs ON ac.CI_ID = ucs.CI_ID
WHERE a.AssignmentType IN (1, 5, 8)
GROUP BY a.AssignmentID, a.AssignmentName, a.CollectionName, a.StartTime, a.AssignmentType
ORDER BY a.StartTime DESC
