-- DB Monitor: Last backup info (runs against msdb)
SELECT
    bs.database_name AS DatabaseName,
    bs.type AS BackupType,
    MAX(bs.backup_finish_date) AS LastBackupDate,
    DATEDIFF(HOUR, MAX(bs.backup_finish_date), GETDATE()) AS HoursSinceBackup
FROM msdb.dbo.backupset bs
WHERE bs.database_name = DB_NAME()
GROUP BY bs.database_name, bs.type
ORDER BY bs.type
