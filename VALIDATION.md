# Doğrulama kaydı · 2026-10-08

- TypeScript ve Vite üretim derlemesi geçti.
- 4 birim testi geçti: tek kare sınırı, algılama aralığı, ölçekleme, filtre tepkisi ve yeniden yakalama sıfırlaması.
- Yerel Chromium'da 3 tarayıcı testi geçti: izin reddi, mobil yerleşim ve izin beklenirken durdurma sonrasında geç gelen kamera akışının kapatılması. Mobil ekran görüntüsü görsel olarak incelendi.
- Yerel Chromium headless shell, SwiftShader bayraklarına rağmen WebGL bağlamı oluşturamadı. Gerçek worker/model entegrasyon testi bu ortamda başarısız oldu; başarı olarak sayılmadı. Tam Chromium başlatma girişimi de ortamda `spawn UNKNOWN` ile sonuçlandı.
- [GitHub CI çalışması](https://github.com/winegg420/Splat-Me/actions/runs/37818790038) başarılı: temiz Linux kurulumunda derleme, 4 birim testi ve 4 tarayıcı testi geçti. Gerçek MediaPipe worker/model entegrasyonu, sahte kamera ve SwiftShader WebGL ile başarılı; durdurma/yeniden başlatma sırasında track kapatma da doğrulandı. Yerel WebGL engeli bu ortamda tekrarlanmadı.
- Gerçek webcam, yüz içeren gerçek hareket, 1080p/60 FPS başarımı, yeniden yakalama süresi, Safari/Firefox ve mobil donanım performansı ölçülmedi.

Panel değerleri kullanıcı kendi cihazında kamerayı açtığında oluşur. Otomatik testteki sahte kameranın değerleri ürün performansı kanıtı değildir.

## Vercel HTTPS yayını

- https://splat-me.vercel.app üretim adresine dağıtım başarılı.
- Kimlik doğrulaması olmadan Chromium üzerinden sayfa açıldı; HTTPS güvenli bağlam ve kamera API erişimi doğrulandı.
- Worker, yüz modeli, WASM yükleyicisi ve WASM ikilisi HTTP 200 ile geldi; WASM MIME türü ve dosya imzası kontrol edildi.
- Canlı sayfada izin reddi sonrası kontrol düğmelerinin toparlanması geçti; tarayıcı JavaScript hatası görülmedi.
- Bu yayın testi fiziksel kamerayı açmadı; gerçek cihaz performansına ilişkin önceki sınırlar geçerlidir.

## Impact Lab · 2026-10-09

- [CI 37895866011](https://github.com/winegg420/Splat-Me/actions/runs/37895866011) başarılı: üretim derlemesi, 10 birim testi ve 9 tarayıcı testi.
- Eski kamera laboratuvarının 4 testi korunur. Impact testleri: GPU model/splat/yakın kaçış, 0.35× zaman damgalı gerçek kare tekrarı ve tekrar oynatma, video-piksel deformasyonu/taşınan landmark lekeleri, gerçek MediaPipe worker ile yakalama A/B, mobil taşma ve stereo ses dalgası.
- Deformasyon ve leke testi 640×360 sentetik kamera + kontrollü landmark worker kullanır. Bu, fiziksel yüz algılama doğruluğunun testi değildir. Ayrı gerçek MediaPipe testi yüz içermeyen sahte kamera kullanır.
- Ekran görüntüleri incelendi: ilk model yüzey yönü/malzeme kusurları düzeltildi; son model, isabet, tekrar, mobil düzen ve kamera pikselleri üzerindeki lekeler kontrol edildi. Kanıtlar CI `browser-evidence` artifact'indedir.
- Ölçüm ortamı Linux CI + SwiftShader yazılımsal GPU'dur. Son kamerasız yakın-kaçış örneği: render 23.23 FPS, son 120 kare aralığı p95 83.3 ms; replay RGBA tamponu 45.70 MiB. Bunlar donanımlı gerçek cihaz FPS'i veya hedef 60 FPS'in sağlandığı iddiası değildir.
- Sesin 48 kHz, 2 saniyelik OfflineAudioContext ölçümü: peak 0.1681, RMS 0.01591, kanallar arası ortalama mutlak fark 0.00147; sessiz değil, stereo farklı ve dijital kırpılma yok. Algısal ses kalitesi ve fiziksel A/V gecikmesi bu testle ölçülmez.
- Canlı `/`, `/impact-lab` ve `/impact-lab/` yolları HTTP 200; her sayfanın JS/CSS dosyaları, model, worker ve WASM erişimi doğrulandı. `/impact-lab` önce henüz üretimde olmadığı için 404 veriyordu; çok sayfalı build ve explicit Vercel rewrites ile yayınlandı.
- Fiziksel cihazdaki önceki 16 FPS gözleminin kök nedeni kesinleşmedi. Yeni source/presented/callback/submitted/completed sayaçları ve aç/kapat A/B kontrolü, bu ayrımı gerçek cihazda ölçmek için hazır.
