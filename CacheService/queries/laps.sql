-- LAPS: Local Administrator Password Solution durumu
-- v_GS_MS_MCS_ADMPWD yoksa sadece cihaz listesi doner (LAPS Yok olarak)
SELECT
    s.ResourceID,
    s.Name0 AS Hostname,
    CASE
        WHEN os.BuildNumber0 = '26100' AND s.Operating_System_Name_and0 NOT LIKE '%Server%' THEN 'Windows 11 24H2'
        WHEN os.BuildNumber0 = '22631' THEN 'Windows 11 23H2'
        WHEN os.BuildNumber0 = '22621' THEN 'Windows 11 22H2'
        WHEN os.BuildNumber0 = '19045' THEN 'Windows 10 22H2'
        WHEN os.BuildNumber0 = '20348' THEN 'Windows Server 2022'
        WHEN os.BuildNumber0 = '17763' AND s.Operating_System_Name_and0 LIKE '%Server%' THEN 'Windows Server 2019'
        WHEN os.Caption0 IS NOT NULL THEN REPLACE(os.Caption0, 'Microsoft ', '')
        ELSE REPLACE(ISNULL(s.Operating_System_Name_and0,''), 'Microsoft ', '')
    END AS OS,
    CASE WHEN s.Operating_System_Name_and0 LIKE '%Server%' THEN 'Server' ELSE 'Workstation' END AS DeviceType,
    s.AD_Site_Name0 AS ADSite,
    s.Resource_Domain_OR_Workgr0 AS Domain,
    ch.LastActiveTime,
    NULL AS PasswordExpiry
FROM v_R_System s
LEFT JOIN v_GS_OPERATING_SYSTEM os ON s.ResourceID = os.ResourceID
LEFT JOIN v_CH_ClientSummary ch ON s.ResourceID = ch.ResourceID
WHERE s.Client0 = 1
ORDER BY s.Name0
