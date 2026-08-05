-- App Deployment Detail: Cihaz bazli detay
-- v_AppIntentAssetData kullanilir (v_CICurrentComplianceStatus uyumsuzlugu giderildi)
SELECT
    ai.AssignmentID,
    ai.MachineName AS Hostname,
    ai.ComplianceState AS StatusType,
    aa.CollectionName,
    aa.AssignmentName
FROM v_AppIntentAssetData ai
JOIN v_ApplicationAssignment aa ON ai.AssignmentID = aa.AssignmentID
ORDER BY ai.AssignmentID, ai.MachineName
