-- CMG: Cloud Management Gateway bilgisi
SELECT
    cmg.ServiceCName,
    cmg.State AS CMGState,
    cmg.Region,
    cmg.VmSize,
    cmg.NumberOfInstances,
    cmg.StorageUsage,
    cmg.TrafficOutUsage,
    cmg.NetworkOutUsage,
    cmg.CreationTime
FROM v_CloudManagementGatewayInfo cmg
