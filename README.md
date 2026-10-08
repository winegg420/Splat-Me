# Splat-Me · Camera Lab

Kamera ve kafa takibi temeli. Oyun efektleri, deformasyon ve ses içermez.

## Çalıştırma

Node.js 22.12+ (veya güncel LTS) gerekir.

```sh
npm ci
npm run dev
```

İlk kurulum, sürümlenmiş MediaPipe modelini indirir; WASM ve worker dosyalarını yerel `public/` dizinine hazırlar. Çalışırken kamera görüntüsü sunucuya gönderilmez; model ve WASM aynı origin'den yüklenir. Model dağıtımının lisans bilgileri için [MediaPipe](https://github.com/google-ai-edge/mediapipe) kaynağına bakın. `public/vendor` ve `public/tracker.js` üretilir, Git'e eklenmez.

```sh
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
npm run preview
```

Kamera için HTTPS veya localhost gerekir. Alt dizinde dağıtım için Vite `base` ayarını uygulayın. Worker, model ve WASM yolları bu tabanı kullanır. `dist/` statik sunucuya dağıtılabilir; `.wasm` dosyalarını `application/wasm` olarak sunun. CSP kullanılıyorsa aynı origin worker ve WASM derlemesine izin verilmelidir.

## Mimari ve tercihlerin gerekçesi

- **Görüntü:** `getUserMedia` 1920×1080 ve 60 FPS'i `ideal` olarak ister. Tarayıcı ve kamera uygun değerleri seçer. Donanımın vermediği kalite veya kare hızı garanti edilmez. Panel, gerçek video boyutlarını ve track ayarını gösterir. Video tarayıcının kendi video katmanında çizilir; her render'da canvas'a kopyalanmaz.
- **Algılama:** MediaPipe Face Landmarker `VIDEO` modu, tek yüz; ayrı klasik Web Worker içinde CPU/WASM. Paket WASM yükleyicisinin `importScripts` kullanımına uyum için worker IIFE olarak paketlenir. Ana thread'de model çıkarımı yoktur. GPU delegate varsayılan değildir: cihazlar arasında worker GPU desteği ve görüntüyle GPU kaynak paylaşımı ayrıca ölçülmelidir. WebGPU için zorunluluk eklenmez.
- **Kare aktarımı:** `requestVideoFrameCallback` yalnız yeni kamera karelerini tetikler. Eski tarayıcılarda `requestAnimationFrame` + değişen `currentTime` kontrolü kullanılır. `createImageBitmap` görüntüyü en uzun kenarı 640 piksele küçültür ve worker'a sahiplik aktarır. Worker bitmap'i her durumda kapatır. Resize/kopya maliyeti platforma bağlıdır; model süresinden ayrı, gönderim→sonuç metriğine dahildir.
- **Kuyruk yok:** Dönüştürme dahil aynı anda en fazla bir kare. İşlem sürerken kareler atlanır; eski kareler birikmez. Üst sınır 30 algılama/s; ölçülen çıkarım süresi uzadıkça aralık genişler. Sabit 60 algılama/s çalıştırılmaz. Kafa sabit diye algılama durdurulmaz; ani hareket ve kadraja dönüş hızlı fark edilmelidir.
- **Takip:** Modelin VIDEO takibi, her karede yüz dedektörünü baştan çalıştırma ihtiyacını azaltır. Tam kadraj küçültülerek işlenir; kırpılmış eski bir ROI yüzünden kadraja dönüş kaçırılmaz. Burun konumu, gözler arası ölçek ve roll açısı çıkarılır. Bu sürüm doğrulanmış 6DoF kafa pozu sunmaz. Adaptif One Euro filtresi küçük titreşimi azaltır, hızlı harekette tepkisini artırır. Yüz kaybında filtre sıfırlanır; 180 ms'den eski sonuçlar çizilmez. Yeni yüz eski konumla harmanlanmaz.
- **Render:** Overlay bağımsız `requestAnimationFrame` döngüsünde çalışır (60 Hz ekranda 60 FPS hedef, yüksek Hz ekranda tarayıcının yenileme hızı). Kamera 30 FPS ise ekranda 60 farklı kamera karesi üretilmez. Aynalanmış görüntü ve takip koordinatları aynı yerleşimi paylaşır.
- **Yaşam döngüsü:** Durdurmada track'ler, worker ve döngüler kapatılır. Bekleyen izin/kare işlemlerinin eski oturuma ait sonuçları atılır. Sekme gizliyken yeni algılama yapılmaz, filtre sıfırlanır; dönüşte yeni kare alınır. İzin reddi, model/worker hatası, track sonlanması ve işlem zaman aşımı tekrar başlatılabilir duruma döner.

`MediaStreamTrackProcessor` + `VideoFrame` doğrudan worker hattı ileride ölçülebilir; tarayıcılar arası kullanılabilirlik farkları nedeniyle temel yol yapılmadı. Mevcut yol `Worker`, WASM, `createImageBitmap` ve worker içinde OffscreenCanvas/WebGL gerektirir. MediaPipe CPU delegate de görüntü hazırlığı için WebGL kullanır. Destek yoksa açık hata verir, çıkarımı ana thread'e taşımaz.

## Ölçümler ve doğrulama sınırları

Panelde render callback FPS, yeni kamera callback FPS, tamamlanan algılama FPS, model işlem süresi, kare gönderimi→sonuç süresi, sonuç yaşı, video çözünürlüğü ve düşük çözünürlüklü algılama girdisi bulunur. Sayaçlar 500 ms aralıklarla güncellenir. Model/latency son örnektir; ortalama veya p95 değildir. Fallback kamera FPS değeri `currentTime` değişimlerinden tahmindir. Sonuç yaşı, modelin kullandığı karenin gönderiminden beri geçen süredir.

Otomatik testler sahte Chromium kamera kaynağı ve yazılımsal SwiftShader WebGL kullanır. Bu kaynak yüz içermez; worker/model çıkarımı, yüz-yok durumu, durdurma/yeniden başlatma, izin hatası ve mobil taşma kontrol edilir. Filtre ve kuyruk davranışları ayrıca birim testlidir. **Gerçek webcam'de 1080p, 60 FPS, hızlı hareket başarısı, yüz algılama doğruluğu veya fiziksel hareket→ekran gecikmesi ölçülmüş değildir.** Safari/Firefox ve mobil donanım doğrulaması bekler.

Gerçek cihaz kabul kontrolü:

1. Kamera ve tarayıcı sürümünü kaydet; aydınlık ve düşük ışıkta en az 60 saniye izle. Gerçek çözünürlük, kamera/render/algılama FPS değerlerini kaydet.
2. Hızlı sağ/sol ve yukarı/aşağı hareketlerde takip halkasının tepkisini kontrol et. Darboğazı model süresi ve gönderim→sonuç farkıyla ayır.
3. Kadrajdan tamamen çıkıp farklı bir kenardan 10 kez geri gir. İlk yeniden bulunan yüzün eski konuma çekilmediğini ve eski halkanın görünmediğini doğrula. Yeniden yakalama süresini harici video veya zaman damgalı kayıtla ölç.
4. Sekme değiştir, yeniden dön; kamerayı durdur/başlat; kamera erişimini iptal et. Kamera kullanım göstergesinin durdurmada söndüğünü kontrol et.
5. Fiziksel toplam gecikmeyi ölçmek için kamera önündeki hareketle ekranı aynı anda gören yüksek hızlı harici kayıt kullan. Panel süresi bunu ölçmez.

## Birincil kaynaklar

- [MediaPipe Web Face Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker/web_js): senkron çıkarımın worker'a alınması, VIDEO takibi.
- [requestVideoFrameCallback](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback): yeni video karelerine göre zamanlama.
- [Kamera constraints ve settings](https://developer.mozilla.org/en-US/docs/Web/API/Media_Capture_and_Streams_API/Constraints): ideal talep ile gerçek cihaz ayarlarının ayrımı.
