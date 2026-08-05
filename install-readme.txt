  SCCM Dashboard - Kurulum Rehberi
  ==================================

  Hizli Kurulum (Tek Komut)
  -------------------------

  1. Bu "Installer" klasorunu hedef SCCM sunucusuna kopyala:

     Copy-Item -Path ".\Installer" -Destination "\\HEDEF-SUNUCU\C$\Temp\SCCMDashboard-Installer" -Recurse

  2. Hedef sunucuda PowerShell'i yonetici olarak ac ve calistir:

     cd C:\Temp\SCCMDashboard-Installer
     .\Install.ps1 -SqlServer "sccm-sql01.domain.local" -Database "CM_ABC"

  3. Kurulum tamamlaninca tarayicida ac:

     http://SUNUCU-ADI:9090


  Parametreler
  ------------

  +------------------+---------+------------------+-----------------------------------+
  |    Parametre     | Zorunlu |   Varsayilan     |           Aciklama                |
  +------------------+---------+------------------+-----------------------------------+
  | -SqlServer       | Evet    | -                | SCCM SQL Server adi (FQDN)        |
  | -Database        | Evet    | -                | Site DB adi (CM_XXX)              |
  | -Port            | Hayir   | 9090             | IIS web portu                     |
  | -InstallPath     | Hayir   | C:\SCCMDashboard | Kurulum hedef dizini              |
  | -RefreshInterval | Hayir   | 60               | Cache yenileme suresi (dakika)    |
  | -RefreshApiPort  | Hayir   | 9091             | Manuel refresh API portu          |
  | -SkipIIS         | Hayir   | false            | IIS kurulumunu atla               |
  +------------------+---------+------------------+-----------------------------------+


  Install.ps1 Ne Yapar?
  ---------------------

  1. Onkosul kontrolu   : PowerShell 5.1+, IIS, SQL baglanti testi
  2. Dosya kopyalama     : Installer -> C:\SCCMDashboard (veya belirtilen path)
  3. Config guncelleme   : SQL Server/DB bilgileri config.json'a yazilir
  4. Eski veri temizleme : Test ortamindan kalan JSON'lar silinir
  5. IIS yapilandirma    : App Pool, Web Site, Windows Auth, MIME type
  6. Scheduled Task      : Cache refresh task'i (periyodik SQL -> JSON)
  7. Refresh API         : Manuel yenileme icin HTTP endpoint
  8. Firewall kurallari  : TCP inbound (web + API portlari)
  9. Ilk cache refresh   : Hemen ilk veri cekimini baslatir


  Dashboard Ozellikleri
  ---------------------

  - 17 farkli SCCM veri kaynagi (asset, update, app, BitLocker, CMG, DB)
  - Manuel refresh butonu (header'da "Yenile" butonu)
  - Otomatik cache yenileme (varsayilan: 60 dakika)
  - Windows Authentication (Kerberos)
  - Karanlik/aydinlik tema
  - CSV/JSON/HTML export
  - Responsive tasarim


  Baska Bir SCCM'e Tasima
  -----------------------

  1. Installer klasorunu yeni sunucuya kopyala
  2. Install.ps1'i yeni SQL/DB bilgileriyle calistir
  3. Dashboard otomatik olarak yeni SCCM verilerini gosterir


  Kaldirma
  --------

  .\Uninstall.ps1                # IIS + Task kaldir, dosyalar kalsin
  .\Uninstall.ps1 -RemoveFiles   # Her seyi sil


  Tani / Sorun Giderme
  --------------------

  .\Diagnose.ps1                 # Tam diagnostik raporu calistirir
