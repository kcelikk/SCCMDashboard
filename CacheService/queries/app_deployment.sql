-- App Deployment: Application Model deployments
-- v_DeploymentSummary kullanilir (noexpand sorunu yok)
SELECT
    aa.AssignmentID,
    aa.AssignmentName,
    aa.CollectionName,
    aa.StartTime AS DeploymentDate,
    aa.DesiredConfigType,
    aa.OfferTypeID,
    ISNULL(ds.NumberTotal, 0) AS TotalDevices,
    ISNULL(ds.NumberSuccess, 0) AS Success,
    ISNULL(ds.NumberErrors, 0) AS Failed,
    ISNULL(ds.NumberInProgress, 0) AS InProgress,
    ISNULL(ds.NumberOther, 0) AS RequirementsNotMet,
    ISNULL(ds.NumberUnknown, 0) AS Other
FROM v_ApplicationAssignment aa
LEFT JOIN v_DeploymentSummary ds ON aa.AssignmentID = ds.AssignmentID
ORDER BY aa.StartTime DESC
