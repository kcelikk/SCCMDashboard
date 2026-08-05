-- Client PC: Workstation cihazlar + donanim detay
SELECT
    s.ResourceID,
    s.Name0 AS Hostname,
    CASE
        WHEN os.BuildNumber0 = '26100' THEN 'Windows 11 24H2'
        WHEN os.BuildNumber0 = '22631' THEN 'Windows 11 23H2'
        WHEN os.BuildNumber0 = '22621' THEN 'Windows 11 22H2'
        WHEN os.BuildNumber0 = '22000' THEN 'Windows 11 21H2'
        WHEN os.BuildNumber0 = '19045' THEN 'Windows 10 22H2'
        WHEN os.BuildNumber0 = '19044' THEN 'Windows 10 21H2'
        WHEN os.BuildNumber0 = '19043' THEN 'Windows 10 21H1'
        WHEN os.BuildNumber0 = '19042' THEN 'Windows 10 20H2'
        WHEN os.BuildNumber0 = '19041' THEN 'Windows 10 2004'
        WHEN os.BuildNumber0 = '18363' THEN 'Windows 10 1909'
        WHEN os.BuildNumber0 = '18362' THEN 'Windows 10 1903'
        WHEN os.BuildNumber0 = '17763' THEN 'Windows 10 LTSC 2019'
        WHEN os.Caption0 IS NOT NULL THEN REPLACE(REPLACE(os.Caption0, 'Microsoft ', ''), '  ', ' ')
        ELSE REPLACE(s.Operating_System_Name_and0, 'Microsoft ', '')
    END AS OS,
    CASE
        WHEN os.Caption0 LIKE '%Enterprise%' THEN 'Enterprise'
        WHEN os.Caption0 LIKE '%Pro %' OR os.Caption0 LIKE '%Professional%' THEN 'Pro'
        WHEN os.Caption0 LIKE '%Education%' THEN 'Education'
        WHEN os.Caption0 LIKE '%Home%' THEN 'Home'
        WHEN os.Caption0 LIKE '%LTSC%' OR os.Caption0 LIKE '%LTSB%' THEN 'LTSC'
        ELSE ''
    END AS OSEdition,
    os.BuildNumber0 AS OSBuild,
    os.LastBootUpTime0,
    s.Resource_Domain_OR_Workgr0 AS Domain,
    s.User_Name0 AS AssignedUser,
    s.Client_Version0 AS ClientVersion,
    s.Client0 AS ClientInstalled,
    COALESCE(netinfo.IPAddress0, '') AS IPAddress,
    cs.Model0 AS Model,
    cs.Manufacturer0 AS Manufacturer,
    ch.LastActiveTime,
    ch.ClientActiveStatus,
    ch.LastDDR,
    ch.LastHW,
    ch.LastPolicyRequest,
    ch.ClientStateDescription,
    ch.IsActiveDDR,
    ch.IsActiveHW,
    ch.IsActiveSW,
    procinfo.Name0 AS ProcessorName,
    procinfo.NumberOfCores0 AS CPUCores,
    meminfo.TotalPhysicalMemory0 AS TotalMemoryKB,
    diskinfo.Size0 AS DiskSizeGB,
    diskinfo.FreeSpace0 AS DiskFreeGB,
    diskinfo.DeviceID0 AS DiskDrive
FROM v_R_System s
LEFT JOIN v_GS_OPERATING_SYSTEM os ON s.ResourceID = os.ResourceID
LEFT JOIN v_GS_COMPUTER_SYSTEM cs ON s.ResourceID = cs.ResourceID
LEFT JOIN (
    SELECT ResourceID, IPAddress0,
           ROW_NUMBER() OVER (PARTITION BY ResourceID ORDER BY IPAddress0) AS rn
    FROM v_GS_NETWORK_ADAPTER_CONFIGURATION
    WHERE IPEnabled0 = 1 AND IPAddress0 IS NOT NULL AND IPAddress0 NOT LIKE '%:%'
) netinfo ON s.ResourceID = netinfo.ResourceID AND netinfo.rn = 1
LEFT JOIN v_CH_ClientSummary ch ON s.ResourceID = ch.ResourceID
LEFT JOIN (
    SELECT ResourceID, Name0, NumberOfCores0,
           ROW_NUMBER() OVER (PARTITION BY ResourceID ORDER BY Name0) AS rn
    FROM v_GS_PROCESSOR
) procinfo ON s.ResourceID = procinfo.ResourceID AND procinfo.rn = 1
LEFT JOIN (
    SELECT ResourceID, TotalPhysicalMemory0
    FROM v_GS_X86_PC_MEMORY
) meminfo ON s.ResourceID = meminfo.ResourceID
LEFT JOIN (
    SELECT ResourceID, Size0, FreeSpace0, DeviceID0,
           ROW_NUMBER() OVER (PARTITION BY ResourceID ORDER BY DeviceID0) AS rn
    FROM v_GS_LOGICAL_DISK
    WHERE DriveType0 = 3 AND DeviceID0 = 'C:'
) diskinfo ON s.ResourceID = diskinfo.ResourceID AND diskinfo.rn = 1
WHERE s.Operating_System_Name_and0 NOT LIKE '%Server%'
  AND s.Name0 IS NOT NULL
ORDER BY s.Name0
