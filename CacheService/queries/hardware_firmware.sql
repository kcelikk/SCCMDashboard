-- Hardware & Firmware: BIOS, TPM, donanim bilgileri
SELECT
    s.ResourceID,
    s.Name0 AS Hostname,
    CASE
        WHEN os.BuildNumber0 = '26100' AND s.Operating_System_Name_and0 NOT LIKE '%Server%' THEN 'Windows 11 24H2'
        WHEN os.BuildNumber0 = '22631' THEN 'Windows 11 23H2'
        WHEN os.BuildNumber0 = '22621' THEN 'Windows 11 22H2'
        WHEN os.BuildNumber0 = '22000' THEN 'Windows 11 21H2'
        WHEN os.BuildNumber0 = '19045' THEN 'Windows 10 22H2'
        WHEN os.BuildNumber0 = '20348' THEN 'Windows Server 2022'
        WHEN os.BuildNumber0 = '17763' AND s.Operating_System_Name_and0 LIKE '%Server%' THEN 'Windows Server 2019'
        WHEN os.BuildNumber0 = '17763' THEN 'Windows 10 LTSC 2019'
        WHEN os.Caption0 IS NOT NULL THEN REPLACE(os.Caption0, 'Microsoft ', '')
        ELSE REPLACE(ISNULL(s.Operating_System_Name_and0, ''), 'Microsoft ', '')
    END AS OS,
    CASE WHEN s.Operating_System_Name_and0 LIKE '%Server%' THEN 'Server' ELSE 'Workstation' END AS DeviceType,
    cs.Model0 AS Model,
    cs.Manufacturer0 AS Manufacturer,
    bios.SMBIOSBIOSVersion0 AS BIOSVersion,
    bios.ReleaseDate0 AS BIOSDate,
    bios.Manufacturer0 AS BIOSManufacturer,
    tpm.SpecVersion0 AS TPMVersion,
    tpm.IsActivated_InitialValue0 AS TPMActivated,
    tpm.IsEnabled_InitialValue0 AS TPMEnabled,
    tpm.IsOwned_InitialValue0 AS TPMOwned,
    tpm.ManufacturerVersion0 AS TPMFirmwareVersion,
    CASE WHEN bios.SMBIOSBIOSVersion0 LIKE '%UEFI%'
         OR cs.Manufacturer0 LIKE '%VMware%'
         OR os.BuildNumber0 >= '10240'
         THEN 1 ELSE 0 END AS UEFIEnabled,
    CASE WHEN tpm.IsEnabled_InitialValue0 = 1 AND os.BuildNumber0 >= '10240'
         THEN 1 ELSE 0 END AS SecureBoot
FROM v_R_System s
LEFT JOIN v_GS_OPERATING_SYSTEM os ON s.ResourceID = os.ResourceID
LEFT JOIN v_GS_COMPUTER_SYSTEM cs ON s.ResourceID = cs.ResourceID
LEFT JOIN v_GS_PC_BIOS bios ON s.ResourceID = bios.ResourceID
LEFT JOIN v_GS_TPM tpm ON s.ResourceID = tpm.ResourceID
WHERE s.Client0 = 1
ORDER BY s.Name0
