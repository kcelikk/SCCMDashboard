-- DB Monitor: Database size and backup info
-- DB Size
SELECT
    DB_NAME() AS DatabaseName,
    SUM(size * 8 / 1024) AS SizeMB,
    SUM(CASE WHEN type = 0 THEN size * 8 / 1024 ELSE 0 END) AS DataSizeMB,
    SUM(CASE WHEN type = 1 THEN size * 8 / 1024 ELSE 0 END) AS LogSizeMB
FROM sys.database_files;
