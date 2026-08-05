-- SCCM Health: Inbox kuyruk dosya sayilari
SELECT
    MachineName AS SiteCode,
    Name AS InboxName,
    FileCurrentCount AS FileCount,
    LastRunTime AS LastFileWriteTime
FROM vSMS_SHM_Inbox_FileCount
ORDER BY FileCurrentCount DESC
