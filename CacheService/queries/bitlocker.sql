-- BitLocker: Sifreleme durumu
SELECT
    s.ResourceID,
    s.Name0 AS Hostname,
    s.Operating_System_Name_and0 AS OS,
    CASE WHEN s.Operating_System_Name_and0 LIKE '%Server%' THEN 'Server' ELSE 'Workstation' END AS DeviceType,
    ev.DriveLetter0 AS DriveLetter,
    ev.ProtectionStatus0 AS ProtectionStatus,
    bd.ConversionStatus0 AS ConversionStatus,
    bd.EncryptionMethod0 AS EncryptionMethod,
    bd.Compliant0 AS Compliant,
    bd.KeyProtectorTypes0 AS KeyProtectorTypes
FROM v_R_System s
LEFT JOIN v_GS_ENCRYPTABLE_VOLUME ev ON s.ResourceID = ev.ResourceID
LEFT JOIN v_GS_BITLOCKER_DETAILS bd ON s.ResourceID = bd.ResourceID
WHERE ev.DriveLetter0 IS NOT NULL
ORDER BY s.Name0, ev.DriveLetter0
