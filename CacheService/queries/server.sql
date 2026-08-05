-- Server: Server cihazlar + donanim detay
SELECT
    s.ResourceID,
    s.Name0 AS Hostname,
    CASE
        WHEN os.BuildNumber0 = '26100' THEN 'Windows Server 2025'
        WHEN os.BuildNumber0 = '20348' THEN 'Windows Server 2022'
        WHEN os.BuildNumber0 = '17763' THEN 'Windows Server 2019'
        WHEN os.BuildNumber0 = '14393' THEN 'Windows Server 2016'
        WHEN os.BuildNumber0 = '9600'  THEN 'Windows Server 2012 R2'
        WHEN os.BuildNumber0 = '9200'  THEN 'Windows Server 2012'
        WHEN os.Caption0 IS NOT NULL THEN REPLACE(REPLACE(os.Caption0, 'Microsoft ', ''), '  ', ' ')
        ELSE REPLACE(s.Operating_System_Name_and0, 'Microsoft ', '')
    END AS OS,
    CASE
        WHEN os.Caption0 LIKE '%Standard%' THEN 'Standard'
        WHEN os.Caption0 LIKE '%Datacenter%' THEN 'Datacenter'
        WHEN os.Caption0 LIKE '%Essentials%' THEN 'Essentials'
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
    procinfo.Name0 AS ProcessorName,
    procinfo.NumberOfCores0 AS CPUCores,
    meminfo.TotalPhysicalMemory0 AS TotalMemoryKB,
    diskinfo.Size0 AS DiskSizeGB,
    diskinfo.FreeSpace0 AS DiskFreeGB,
    diskinfo.DeviceID0 AS DiskDrive,
    s.Is_Virtual_Machine0 AS IsVirtual
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
WHERE s.Operating_System_Name_and0 LIKE '%Server%'
  AND s.Name0 IS NOT NULL
ORDER BY s.Name0
