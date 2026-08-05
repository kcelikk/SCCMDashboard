-- CMG Clients: Internet-based client bilgisi
SELECT
    s.ResourceID,
    s.Name0 AS Hostname,
    s.Client_Version0 AS ClientVersion,
    s.InternetEnabled0 AS InternetEnabled,
    s.AlwaysInternet0 AS AlwaysInternet,
    s.ManagementAuthority AS ManagementAuthority,
    ch.LastActiveTime,
    ch.ClientActiveStatus,
    ch.LastMPServerName AS ManagementPoint
FROM v_R_System s
LEFT JOIN v_CH_ClientSummary ch ON s.ResourceID = ch.ResourceID
WHERE s.Client0 = 1
ORDER BY s.Name0
