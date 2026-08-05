-- Asset Envanteri: Tum cihazlar
SELECT
    s.ResourceID,
    s.Name0 AS Hostname,
    s.Operating_System_Name_and0 AS OSRaw,
    os.BuildNumber0 AS OSBuild,
    os.Caption0 AS OSCaption,
    CASE
        -- Windows 11
        WHEN os.BuildNumber0 = '26100' THEN 'Windows 11 24H2'
        WHEN os.BuildNumber0 = '22631' THEN 'Windows 11 23H2'
        WHEN os.BuildNumber0 = '22621' THEN 'Windows 11 22H2'
        WHEN os.BuildNumber0 = '22000' THEN 'Windows 11 21H2'
        -- Windows 10
        WHEN os.BuildNumber0 = '19045' THEN 'Windows 10 22H2'
        WHEN os.BuildNumber0 = '19044' THEN 'Windows 10 21H2'
        WHEN os.BuildNumber0 = '19043' THEN 'Windows 10 21H1'
        WHEN os.BuildNumber0 = '19042' THEN 'Windows 10 20H2'
        WHEN os.BuildNumber0 = '19041' THEN 'Windows 10 2004'
        WHEN os.BuildNumber0 = '18363' THEN 'Windows 10 1909'
        WHEN os.BuildNumber0 = '18362' THEN 'Windows 10 1903'
        WHEN os.BuildNumber0 = '17763' AND s.Operating_System_Name_and0 NOT LIKE '%Server%' THEN 'Windows 10 LTSC 2019'
        -- Windows Server
        WHEN os.BuildNumber0 = '26100' AND s.Operating_System_Name_and0 LIKE '%Server%' THEN 'Windows Server 2025'
        WHEN os.BuildNumber0 = '20348' THEN 'Windows Server 2022'
        WHEN os.BuildNumber0 = '17763' AND s.Operating_System_Name_and0 LIKE '%Server%' THEN 'Windows Server 2019'
        WHEN os.BuildNumber0 = '14393' AND s.Operating_System_Name_and0 LIKE '%Server%' THEN 'Windows Server 2016'
        WHEN os.BuildNumber0 = '9600'  AND s.Operating_System_Name_and0 LIKE '%Server%' THEN 'Windows Server 2012 R2'
        -- Fallback
        WHEN os.Caption0 IS NOT NULL THEN REPLACE(REPLACE(os.Caption0, 'Microsoft ', ''), '  ', ' ')
        WHEN s.Operating_System_Name_and0 IS NOT NULL THEN REPLACE(REPLACE(s.Operating_System_Name_and0, 'Microsoft ', ''), 'Workstation ', '')
        ELSE 'Unknown'
    END AS OS,
    CASE
        WHEN os.Caption0 LIKE '%Enterprise%' THEN 'Enterprise'
        WHEN os.Caption0 LIKE '%Pro %' OR os.Caption0 LIKE '%Professional%' THEN 'Pro'
        WHEN os.Caption0 LIKE '%Standard%' THEN 'Standard'
        WHEN os.Caption0 LIKE '%Datacenter%' THEN 'Datacenter'
        WHEN os.Caption0 LIKE '%Education%' THEN 'Education'
        WHEN os.Caption0 LIKE '%Home%' THEN 'Home'
        WHEN os.Caption0 LIKE '%LTSC%' OR os.Caption0 LIKE '%LTSB%' THEN 'LTSC'
        ELSE ''
    END AS OSEdition,
    s.AD_Site_Name0 AS ADSite,
    s.Resource_Domain_OR_Workgr0 AS Domain,
    COALESCE(na.IPAddress0, '') AS IPAddress,
    s.User_Name0 AS AssignedUser,
    s.Distinguished_Name0 AS DN,
    cs.Model0 AS Model,
    cs.Manufacturer0 AS Manufacturer,
    CASE WHEN s.Operating_System_Name_and0 LIKE '%Server%' THEN 'Server' ELSE 'Workstation' END AS DeviceType,
    ch.LastActiveTime,
    ch.ClientActiveStatus,
    ch.LastDDR,
    ch.LastHW,
    s.Client0 AS ClientInstalled,
    s.Client_Version0 AS ClientVersion,
    s.Is_Virtual_Machine0 AS IsVirtual
FROM v_R_System s
LEFT JOIN v_GS_OPERATING_SYSTEM os ON s.ResourceID = os.ResourceID
LEFT JOIN v_GS_COMPUTER_SYSTEM cs ON s.ResourceID = cs.ResourceID
LEFT JOIN (
    SELECT ResourceID, IPAddress0,
           ROW_NUMBER() OVER (PARTITION BY ResourceID ORDER BY IPAddress0) AS rn
    FROM v_GS_NETWORK_ADAPTER_CONFIGURATION
    WHERE IPEnabled0 = 1 AND IPAddress0 IS NOT NULL AND IPAddress0 NOT LIKE '%:%'
) na ON s.ResourceID = na.ResourceID AND na.rn = 1
LEFT JOIN v_CH_ClientSummary ch ON s.ResourceID = ch.ResourceID
WHERE s.Client0 = 1 OR s.Name0 IS NOT NULL
ORDER BY s.Name0
