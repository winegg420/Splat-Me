# Cinematic Impact Lab

`/impact-lab/` ayrı Vite sayfasıdır; `/` kamera laboratuvarı korunur. Kamera görüntüsü veya ses sunucuya gönderilmez. Mikrofon istenmez.

## Uygulanan sahne

- Three.js üzerinde özgün, sivrilen 2.8 tur kıvrım geometrisi ve taban hacmi; pürüz dokusu, fiziksel clearcoat malzeme, ortam yansıması, sıcak ana ışık ve soğuk kenar ışığı. Emoji veya sprite kullanılmaz.
- Perspektif kamera içinde uzaktan yaklaşan, dönen model. Hedef fırlatma anında kilitlenir; son anda güncel yüz elipsiyle çarpışma hesaplanır. Yüz takibi yoksa sonuç `untracked` olur, başarılı kaçış sayılmaz.
- İsabette hacimli düzensiz sıçrama yüzeyi ve 160 instanced ıslak damlacık; analitik yerçekimi ve sürüklenen parçalar. Yakın kaçışta model kameranın yanından geçer, kısa sinematik kadraj/radyal hız çizgileri ve özel ses çalar.
- Burun ve yanak landmark'larına bağlı 5 düzensiz ıslak leke. İzleme kaybolursa görünmezler; tekrar bulunan yüzü takip ederler. Bu prototip tam 3D yüz oklüzyonu veya kimlik takibi yapmaz.
- Kamera texture'ının UV koordinatları yüz bölgesinde kısa süreli sıkışır, burun büyür ve elastik dalga oluşur. Gerçek video pikselleri örneklenir; deformasyon sticker değildir.
- Özgün Web Audio sentezi: yaklaşma uğultusu, alt frekanslı gövde darbesi, ıslak gürültü darbesi, elastik squelch, stereo damlacıklar ve kuyruk. Ses AudioContext saatinde planlanır; isabet kararıyla aynı render tick'inde 8 ms öne planlanır. Donanım ses çıkışı gecikmesi ayrıca vardır; fiziksel A/V senkronu ölçülmüş değildir.
- Gerçek composited görüntü kaydı: son 52 GPU karesi, en fazla 24 kayıt FPS, zaman damgalı. İsabet sonrası 0.65 saniye kayıt sürer; kareler gerçek kaydedilmiş sırayla 0.35× oynatılır. Aynı klip tekrar oynatılabilir. Kamera/worker tekrar sırasında durmaz. Replay sesi olay zaman damgasında yeniden sentezlenir; mikrofon kaydı değildir.

## Performans bütçesi

- Kamera yüksek çözünürlükte; algılama en uzun kenarı 640 px olan aktarılabilir bitmap ile ayrı worker'da. Aynı anda tek algılama karesi, en fazla yaklaşık 30 çıkarım/s.
- 3D ve görüntü deformasyonu WebGL ile çalışır. Replay CPU readback yapmaz; render-target kopyası kullanır. 52 RGBA kare masaüstünde yaklaşık 45.7 MiB, mobilde 25.7 MiB ayırır (ana render target, model, sürücü ve diğer texture'lar bu sayıya dahil değildir).
- Kamera piksel sayısı render boyutundan bağımsızdır. Sahne render bütçesi masaüstünde en fazla 1280×720 piksel eşdeğeri, mobilde 960×540 eşdeğeridir. Arka arkaya >22 ms CPU/GPU çizim maliyetinde sahne render boyutu kademeli olarak %75, %56, %42, %40'a düşürülür; panelde açıkça belirtilir. Kamera yakalama çözünürlüğü değişmez.
- Ana kamera sayfasına Three.js yüklenmez. Three.js içeren impact paketi yaklaşık 157 kB gzip; üretim build boyutu her derlemede görülür.
- GPU timer query destekleniyorsa GPU süresi asenkron ölçülür; destek yoksa `null`/`—` gösterilir. CPU çizim çağrı süresi GPU tamamlanma süresi diye raporlanmaz. Replay kopyası CPU çağrı maliyeti de ayrı görünür.

## Kamera FPS araştırması

Önceki sayaç `requestVideoFrameCallback` çağrılarını sayıyordu. Bu, fiziksel sensör FPS'i değildir. Yeni panel ve JSON raporu şu katmanları ayırır:

1. İstenen constraints, cihaz capabilities ve alınan `getSettings()` değerleri.
2. Tarayıcı destekliyorsa `track.stats.totalFrames` ve `deliveredFrames` farkları. Bunlar tarayıcının yakalama hattı sayaçlarıdır, bağımsız donanım ölçümü değildir.
3. Video `presentedFrames` farkı, callback sayısı ve `getVideoPlaybackQuality()` kare/düşme sayıları.
4. Worker'a gönderilen ve tamamlanan kareler, meşgul olduğu için atlanan kareler, aralık sınırı nedeniyle atlanan kareler.
5. Bitmap hazırlama, model çıkarımı, gönderim→sonuç, render FPS ve frame aralığı p95.

**Bulunan ve birim testle doğrulanan sorun:** katı 33.333 ms aralık karşılaştırması, 33/34 ms gibi küçük callback sapmalarında her ikinci kareyi atlayabiliyordu. FrameGate artık en fazla 2 ms tolerans kullanır. Bu, algılama zamanlamasının iyileştirmesidir; kullanıcının 16 FPS kamera gözleminin kök nedeni olarak iddia edilmez.

Kafa takibi aç/kapat A/B kontrolü ve 1080p/720p talep profilleri vardır. Rapor son 180 saniyeyi JSON olarak indirir; cihaz adları yerine tarayıcının izinli settings/capabilities bilgilerini içerir. Fiziksel kamera bu geliştirme ortamında ölçülmediği için donanım, sürücü, pozlama veya tarayıcı sınırlaması arasında kesin neden atanmaz.

## Kontroller

Kamerayı aç → yüz bulunduğunda FIRLAT/SPACE → başını çek. Yüzü temizle lekeleri kaldırır. Otomatik tekrar kapatılabilir; performans ayrıntılarından son olay yeniden oynatılır. Kamerasız önizleme, efekt motorunu simüle hedefle gösterir ve açıkça etiketlidir; gerçek takip testi değildir.

## Sınırlar

Bu prototip bir video dışa aktarma/paylaşma özelliği içermez. Kayıt yalnızca kısa GPU tekrar tamponudur; sayfadan çıkınca silinir. Safari/Firefox ve fiziksel mobil GPU uyumluluğu ayrıca cihaz testi gerektirir. Hızlı hareketteki doğruluk, gerçek yüz deformasyonunun algısal kalitesi ve donanım A/V gecikmesi otomatik sahte kamera testlerinin sonucu sayılamaz.

## Birincil teknik kaynaklar

- [Video kare callback ve presentedFrames](https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback)
- [MediaStreamTrackProcessor taşınabilirlik notları](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrackProcessor)
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)
- [Three.js ShaderMaterial](https://threejs.org/docs/pages/ShaderMaterial.html)
