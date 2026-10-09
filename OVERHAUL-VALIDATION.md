# Görsel yenileme — doğrulama raporu

9 Ekim 2026 · `cinematic-fluid-overhaul` · uygulama commit'i `8caf5f5`.

## Teslimat durumu

Derleme, 14 birim testi ve 10 tarayıcı testi geçti; sekiz görsel regresyon karşılaştırması dahil. Doğrulanan uygulama commit’i: `8caf5f5`. [Başarılı CI çalışması](https://github.com/winegg420/Splat-Me/actions/runs/37934127027).

Üretim sürümü değiştirilmedi. `/` kamera laboratuvarı, kamera pipeline'ı, worker, FrameGate ve bağımlılık dosyaları ana dalla aynı. Yeni sürüm ayrı Vercel önizlemesinde. Önizleme için Vercel'in yalnızca o adrese ait paylaşım bağlantısı kullanılır; üretim koruma ayarları değiştirilmez.

## Gerçekten kontrol edilenler

- Organik hacmin perspektif yaklaşması, opak ilk temas, ezilme ve damlacıklara geçişi.
- İrili ufaklı damlalar, uzama, 24 ana damlanın 48 küçük parçaya ayrılması ve zamanla kaybolma.
- Farklı tohumlarda farklı, asimetrik leke dağılımları; yüz ağına bağlı hareket; birkaç saniyede aşağı akış; iki isabette birikme ve temizleme.
- Parçacıklar/lekeler gizliyken yalnızca kamera shader'ı açık/kapalı görüntüler karşılaştırıldı. Gerçek görüntü piksellerindeki yanak, burun ve ağız değişimi görülebiliyor.
- Kaydedilmiş kamera örnekleri + olay zamanından yeniden çizilen efektlerle 0.35× tekrar; tekrar zamanının ilerleme hızı ve aynı klibin ikinci kez oynatılması.
- Düşük FPS'te beşten az kamera örneği nedeniyle başlamayan tekrar bulundu ve düzeltildi. En az iki gerçek örnek ve anlamlı bir zaman aralığı gerekir; araya hayali kamera kareleri üretilmez.
- Gerçek MediaPipe worker'ı, sentetik MediaStream ile yakalama/takip A/B kontrolü ve mobil yerleşim.
- Özgün ses sentezinin sessiz olmaması, stereo farkı ve kırpılma sınırları.

## Görsel kanıtlar

Bunlar yapay bir yetişkin portresinin uygulama içinde render edilmiş kareleridir. Gerçek kullanıcı kamerası performansının kanıtı değildir. Görüntü üretim aracı yalnızca temiz portreyi hazırladı; görülen model, sıçrama, lekeler ve deformasyon uygulama kodundan geliyor.

| An | Görüntü |
|---|---|
| Yaklaşma | [Referans](e2e/visual-baselines/approach.png) |
| İlk temas / ezilme | [Referans](e2e/visual-baselines/contact.png) |
| Dağılma | [Referans](e2e/visual-baselines/dispersal.png) |
| Elastik dönüş | [Referans](e2e/visual-baselines/elastic-return.png) |
| Kalan lekeler | [Referans](e2e/visual-baselines/stains.png) |
| 4 saniyelik akış | [Referans](e2e/visual-baselines/drips.png) |
| Sadece gerçek piksel deformasyonu | [Referans](e2e/visual-baselines/warp-after.png) |

Sekiz görüntü referansı otomatik regresyon testinde karşılaştırılır. Zaman, tohum, portre geometrisi ve FX ölçeği (%65) sabittir. Başarılı piksel karşılaştırması görsel tasarımın herkes tarafından beğenileceğini kanıtlamaz. Kareler ayrıca gözle incelendi: köşeli model normalleri, çiçek gibi açılan merkez tabakası, iğne gibi damlalar ve erken şeffaflaşan temas kütlesi düzeltilerek referanslar kaydedildi. [Ağır çekim ekran görüntüsü](docs/impact-evidence/replay.png) de incelendi; tam test kanıtları CI `browser-evidence` arşivindedir.

## Ölçümler

| Sahne | Render FPS | Kare aralığı p95 | Ortalama CPU çizimi | Gözlenen asenkron GPU sonuçları |
|---|---:|---:|---:|---:|
| Temiz kamera | 13.82 | 133.4 ms | 0.30 ms | 39.11–40.02 ms |
| Yoğun dağılma | 4.59 | 550 ms | 1.17 ms | 39.24–253.94 ms |

Bunlar son başarılı çalışmanın sonuçlarıdır. Önceki yazılımsal GPU koşusunda 28.16 / 8.89 FPS görüldü; paylaşımlı koşucu sonuçları değişkendir. 60 FPS hedefinin sağlandığı iddia edilmiyor. [Ham ölçümler](docs/impact-evidence/visual-performance.json).

Ortam: Linux GitHub Actions, Chromium, **SwiftShader yazılımsal GPU**, sabit yapay portre, 1014×570 kamera çizimi ve sabit %65 FX hedefi. FPS/p95, 30 render aralığından; CPU, çizim çağrılarından gelir. GPU timer query asenkron ve gecikmelidir; aynı sonuç birkaç karede görülebilir. Bu değerler fiziksel GPU benchmark'ı değildir.

Kaynak kamera FPS'i, sunulan kare, callback, worker'a gönderim ve tamamlanan algılama ayrı kalmaya devam eder. Kullanıcının önceki 16 FPS kamera sorununun donanım/tarayıcı nedeni bu ortamda belirlenmedi. Gerçek cihazda 1080p60 veya 60 render FPS doğrulanmadı.

Tekrar renk tamponu 16:9 masaüstünde 45.56 MiB, dar ekranda 17.80 MiB hesaplanır; tüm GPU belleği değildir. Ana görüntü/derinlik/MSAA, sürücü ve video belleği bu sayıya dahil değildir.

Ses: 48 kHz, 2 saniyelik OfflineAudioContext probunda tepe 0.28817, RMS 0.02828, ortalama stereo kanal farkı 0.004636. Sayısal kırpılma görülmedi. Bu test sesin öznel kalitesini veya fiziksel hoparlör/kamera senkronunu ölçmez.

## Açık sınırlar

Gerçek webcam, hızlı baş hareketleri, yüzün uç dönüşleri, Safari/Firefox ve fiziksel mobil GPU bu teslimatta cihaz üzerinde doğrulanmadı. El/saç oklüzyonu ve kişi kimliği takibi yok. Lekeler en fazla dört isabet katmanında tutulur. Sıvı hareketi kontrollü deterministik animasyondur; tam akışkan simülasyonu değildir.

Uygulama sesleri sentezler; özgün kaydedilmiş Foley/stüdyo dinleme değerlendirmesi yapılmadı. Görsel beklentinin öznel kısmı önizlemede değerlendirilebilir.

[Uygulama ve performans mimarisi](IMPACT-LAB.md) · [Yapay portrenin ImageGen kaynağı ve tam prompt'u](public/qa/PROVENANCE.md)
