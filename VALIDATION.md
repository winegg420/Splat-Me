# Doğrulama kaydı · 2026-10-08

- TypeScript ve Vite üretim derlemesi geçti.
- 4 birim testi geçti: tek kare sınırı, algılama aralığı, ölçekleme, filtre tepkisi ve yeniden yakalama sıfırlaması.
- Yerel Chromium'da 3 tarayıcı testi geçti: izin reddi, mobil yerleşim ve izin beklenirken durdurma sonrasında geç gelen kamera akışının kapatılması. Mobil ekran görüntüsü görsel olarak incelendi.
- Yerel Chromium headless shell, SwiftShader bayraklarına rağmen WebGL bağlamı oluşturamadı. Gerçek worker/model entegrasyon testi bu ortamda başarısız oldu; başarı olarak sayılmadı. Tam Chromium başlatma girişimi de ortamda `spawn UNKNOWN` ile sonuçlandı.
- Entegrasyon testi CI içinde de çalıştırılır; test kaldırılmadı veya koşulsuz atlanmadı.
- Gerçek webcam, yüz içeren gerçek hareket, 1080p/60 FPS başarımı, yeniden yakalama süresi, Safari/Firefox ve mobil donanım performansı ölçülmedi.

Panel değerleri kullanıcı kendi cihazında kamerayı açtığında oluşur. Otomatik testteki sahte kameranın değerleri ürün performansı kanıtı değildir.
