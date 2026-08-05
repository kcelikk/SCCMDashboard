-- Update Deployment Detail: Cihaz bazli detay
SELECT
    a.AssignmentID,
    s.Name0 AS Hostname,
    s.Operating_System_Name_and0 AS OS,
    ucs.Status,
    ucs.LastStatusCheckTime,
    ui.ArticleID AS KB,
    ui.Title AS UpdateTitle
FROM v_CIAssignment a
JOIN v_CIAssignmentToCI ac ON a.AssignmentID = ac.AssignmentID
JOIN v_UpdateComplianceStatus ucs ON ac.CI_ID = ucs.CI_ID
JOIN v_R_System s ON ucs.ResourceID = s.ResourceID
JOIN v_UpdateInfo ui ON ac.CI_ID = ui.CI_ID
WHERE a.AssignmentType IN (1, 5, 8)
ORDER BY a.AssignmentID, s.Name0
