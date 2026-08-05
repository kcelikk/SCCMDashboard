# SCCM Dashboard

Microsoft System Center Configuration Manager (SCCM/MECM) için hafif izleme paneli.

SCCM site veritabanını periyodik olarak sorgular, sonuçları statik JSON dosyalarına yazar ve IIS üzerinden servis edilen vanilla JavaScript arayüzüyle gösterir. **Derleme adımı, npm bağımlılığı ve çalışma zamanı sunucu kodu yoktur** — arayüz sadece statik dosyadır, veritabanına yalnızca zamanlanmış PowerShell görevi bağlanır.

---

## Neden bu yaklaşım

SCCM konsolu ve SSRS raporları çalışır ama günlük "her şey yolunda mı" bakışı için ağırdır. Bu panel araya bir önbellek katmanı koyar:

- **Veritabanına yük binmez.** Kullanıcı sayfayı her açtığında SQL çalışmaz; sorgular saatte bir arka planda koşar (varsayılan), tarayıcı sadece hazır JSON okur. 27 sorgunun tamamı ~3.6 saniyede tamamlanır.
- **Arayüz tarafında sunucu kodu yoktur.** IIS yalnızca statik dosya servis eder; saldırı yüzeyi buna göre dardır.
- **Veritabanı erişimi Windows Integrated Authentication ile yapılır** — hiçbir yerde parola saklanmaz.

---

## Mimari

```
CacheService/queries/*.sql
        │  Run-CacheRefresh.ps1  (Zamanlanmış Görev, varsayılan 60 dk)
        ▼
Web/data/*.json ─────────────► Browser fetch()  ──► Web/pages/*.html
        ▲                                              (IIS, statik)
        │  POST /api/refresh
Start-RefreshAPI.ps1  (HttpListener, port 9091)
```

Her `.sql` dosyası birebir bir `.json` dosyasına karşılık gelir; uzantısız dosya adı, arayüzün `Dashboard.fetchData('ad')` çağrısında kullandığı uç noktadır. Yeni bir `.sql` eklemek yeterlidir — cache servisi bir sonraki çalışmada otomatik keşfeder.

### Üretilen meta dosyalar

| Dosya | İçerik |
|---|---|
| `_cache_meta.json` | Son yenileme zamanı, sorgu başına durum/süre/kayıt sayısı |
| `_sync_status.json` | Yenileme sırasında canlı ilerleme (faz, tamamlanan, hatalar) |
| `_thresholds.json` | `Config/thresholds.json`'ın her döngüde yayınlanan kopyası |
| `_config_public.json` | Arayüzün okuduğu ayar alt kümesi — sunucu/veritabanı adı **içermez** |
| `_history.json` | Her yenilemede eklenen özet metrik anlık görüntüsü (Trend sayfasını besler) |

---

## Sayfalar

**Genel** — Dashboard (özet KPI'lar, kritik uyarılar), Trend Analizi (zaman serisi)

**Cihazlar & Envanter** — Asset Envanteri, Client PC, Server, Hardware & Firmware, Cihaz Detayı

**Yazılım & Güncellemeler** — Update Deployment, App Deployment, Uygulama Envanteri, OS / Task Deployment, Content Distribution

**Güvenlik & Uyumluluk** — BitLocker, LAPS

**SCCM Altyapı** — SCCM Health, SCCM Alerts, CMG, DB Monitor

**Raporlama & Yönetim** — Raporlar, Sistem Sağlığı, Yönetim (RBAC)

Her sayfa: metrik kartları + grafikler + arama/filtre destekli DataTable + CSV / HTML / JSON dışa aktarım. Satıra tıklayınca sağdan detay paneli açılır.

Arayüz **Türkçe ve İngilizce** (başlıktaki TR/EN düğmesi) ve **açık/koyu tema** destekler.

---

## Gereksinimler

- Windows Server, **PowerShell 5.1+**
- **IIS** (statik içerik; Windows Authentication önerilir)
- SCCM site veritabanına okuma yetkisi olan bir hesap — görev bu hesapla çalışır, Integrated Authentication kullanılır
- Tarayıcıda internet gerekmez; jQuery, DataTables ve Chart.js `Web/js/lib/` altında repoda gelir

---

## Kurulum

Depoyu hedef SCCM sunucusuna klonlayın (veya kopyalayın) ve yönetici PowerShell'de çalıştırın:

```powershell
.\Install.ps1 -SqlServer "sccm-sql01.domain.local" -Database "CM_ABC"
```

Kurulum şunları yapar: dosyaları hedefe kopyalar, `config.json` üretir, IIS site + application pool oluşturur, zamanlanmış görevleri kaydeder, güvenlik duvarı kuralını ve URL ACL'ini ekler.

| Parametre | Zorunlu | Varsayılan | Açıklama |
|---|---|---|---|
| `-SqlServer` | Evet | — | SCCM SQL Server adı (FQDN) |
| `-Database` | Evet | — | Site veritabanı adı (`CM_XXX`) |
| `-Port` | Hayır | `9090` | IIS web portu |
| `-InstallPath` | Hayır | `C:\SCCMDashboard` | Kurulum hedef dizini |
| `-RefreshInterval` | Hayır | `60` | Yenileme aralığı (dakika) |
| `-RefreshApiPort` | Hayır | `9091` | Manuel yenileme API portu |
| `-SkipIIS` | Hayır | — | IIS yapılandırmasını atla |

Kurulum sonrası: `http://SUNUCU-ADI:9090`

**Diğer betikler:** `Uninstall.ps1` (IIS sitesi, görevler, firewall kuralı; `-RemoveFiles` ile dosyalar da), `Diagnose.ps1` (SQL bağlantısı, view/kolon varlığı, sorgu çalıştırma, IIS/görev durumu), `Audit-SCCMData.ps1` (kapsamlı veri ve sorgu denetimi).

### Elle çalıştırma

```powershell
# Tek seferlik yenileme
powershell -ExecutionPolicy Bypass -File .\CacheService\Run-CacheRefresh.ps1

# Manuel yenileme API'si (uzun ömürlü, port 9091)
powershell -ExecutionPolicy Bypass -File .\CacheService\Start-RefreshAPI.ps1
```

İkisi de `-ConfigPath` ile farklı bir yapılandırma dosyası kabul eder.

---

## Yapılandırma

### `Config/config.json`

Depoda yer almaz (ortama özeldir); `Config/config.example.json` şablonundan üretin veya `Install.ps1`'e bırakın.

| Anahtar | Varsayılan | Açıklama |
|---|---|---|
| `sqlServer`, `database` | — | SCCM SQL sunucusu ve site veritabanı |
| `outputPath`, `queriesPath`, `logPath` | — | Dizinler |
| `refreshApiPort` | `9091` | Manuel yenileme API portu |
| `refreshIntervalMinutes` | `60` | Zamanlanmış yenileme aralığı |
| `queryTimeoutSeconds` | `300` | SQL `CommandTimeout` |
| `connectionTimeoutSeconds` | `30` | SQL bağlantı zaman aşımı |
| `logRetentionDays` | `30` | Bundan eski loglar her yenilemede silinir (`0` = kapalı) |
| `historyRetentionDays` | `90` | `_history.json` anlık görüntülerinin saklama süresi |
| `staleThresholdMinutes` | `90` | Başlıktaki cache göstergesinin "eskimiş" sayacağı yaş |
| `autoRefreshSeconds` | `120` | Arayüzün yeni veri kontrol aralığı (`0` = kapalı) |
| `allowedOrigins` | `[]` | Yenileme API'si CORS listesi; boş = makinenin kendi adları/IP'leri |

### `Config/thresholds.json`

Uyarı/kritik eşikleri alan bazında burada tanımlıdır — `updateDeployment`, `asset`, `clientPC`, `server`, `appDeployment`, `taskDeployment`, `contentDistribution`, `bitlocker`, `laps`, `hardwareFirmware`, `cmg`, `sccmHealth`, `systemHealth`, `dbMonitor`.

Dosya her yenilemede arayüze yayınlanır ve metrik kartlarının rengini gerçekten bu değerler belirler; eşik değiştirmek için koda dokunmak gerekmez.

---

## Manuel yenileme API'si

`Start-RefreshAPI.ps1` üç uç nokta sunar: `POST /api/refresh`, `GET /api/status`, `GET /api/health`.

CSRF'e karşı sıkılaştırılmıştır:

- `Access-Control-Allow-Origin` asla `*` değildir; yalnızca izinli origin yansıtılır
- İzinli origin listesi `config.allowedOrigins`, boşsa makinenin tüm host adları ve **yerel IP adresleri** (IIS binding'i IP üzerinden olabildiği için)
- İzinsiz `Origin` başlığı her uç noktada 403 alır
- `POST /api/refresh` ayrıca `X-Dashboard-Refresh` başlığı ister — bu, CORS preflight'ı zorunlu kılarak siteler arası form POST'unu engeller

`Origin` başlığı olmayan istekler (curl, zamanlanmış görev) kabul edilir.

---

## Güvenlik notları

**Gerçek erişim kontrolü IIS Windows Authentication + NTFS izinleridir.** Site üzerinde anonim kimlik doğrulamayı kapatın.

Yönetim sayfasındaki rol/kullanıcı sistemi `localStorage` tabanlıdır ve **bir güvenlik sınırı değildir** — arayüzü kullanıcının rolüne göre sadeleştirmek içindir; geliştirici araçlarıyla değiştirilebilir. Kod ve dokümantasyon bunu açıkça belirtir.

SQL erişimi Integrated Authentication kullanır; depoda ve yapılandırmada hiçbir kimlik bilgisi bulunmaz.

---

## Geliştirme

Derleme adımı yoktur — dosyayı düzenleyin, sayfayı yenileyin.

**Yeni sayfa eklemek:**

1. `CacheService/queries/<ad>.sql` — SCCM sorgusu
2. `Web/pages/<ad>.html` — mevcut sayfa şablonunu izleyin
3. `Web/js/pages/<ad>.js` — `init()` → `Dashboard.init()` → `fetchData()` → render
4. `Web/shared/sidebar.html` — gezinme bağlantısı
5. `Web/js/lang.js` — TR/EN metinler
6. `Web/js/pages/admin.js` içindeki `ALL_PAGES` — RBAC'in sayfayı tanıması için

Cache servisi yeni `.sql` dosyasını bir sonraki çalışmada kendisi bulur.

**Uyulması gereken kurallar** (ayrıntısı `CLAUDE.md`'de):

- Grafikler `Dashboard.chart()` fabrikasından geçer, doğrudan `new Chart()` çağrılmaz
- Renkler `Dashboard.chartColors()` / `Dashboard.statusColors()` üzerinden alınır; sabit hex yazılmaz. Kategorik palet 8 slottur ve **slot sırası renk körlüğü güvenliği için sabittir**; 9. kategori `foldCategories()` ile "Diğer"e katlanır
- Durum renkleri (iyi/uyarı/ciddi/kritik) rezervedir, kategorik seri rengi olarak kullanılmaz
- Eşikler `Dashboard.threshold()` ile okunur, koda gömülmez
- Veri kaynaklı her metin `Dashboard.escapeHtml()` üzerinden geçer
- Veri çekildikten hemen sonra `if (await Dashboard.bailIfEmpty('<uç nokta>', data)) return;` — boş sonuç ile ölçülmüş sıfır farklı şeylerdir
- Sayfa betikleri ES5 uyumludur (IIFE modül, `let`/`const` ve arrow function yok)

---

## Depoda bulunmayanlar

Aşağıdakiler kasıtlı olarak dışarıda bırakılmıştır:

- **`Web/data/*.json`** — canlı SCCM çıktısı. Sunucu adları, iç IP adresleri, AD distinguished name'leri ve atanmış kullanıcılar içerir; kaynak kod değil, üretilen veridir.
- **`CacheService/logs/`** — çalışma zamanı logları
- **`Config/config.json`** — ortama özel SQL sunucu/veritabanı adı (`config.example.json` şablonu mevcut)

İlk yenilemede `Web/data/` dizini ve içeriği otomatik oluşur.
