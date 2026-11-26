# CAPTCHA ölçümü ve koç paneli

Admin ana sayfasındaki **CAPTCHA məşqçi paneli** `/admin/captcha` yolunu açar. Aynı analiz kullanıcı profilinin Security ve Sales sekmelerinde ilgili kişi/kaynak için bulunur. Kimlik doğrulama ve admin kontrolü sunucuda yapılır; normal kullanıcı analiz API'sini okuyamaz.

## Karşılaştırma mantığı

- Ana süre: tamamlanan CAPTCHA'ların aktif süre toplamı / tamamlanan CAPTCHA sayısıdır. Tur ortalamalarının ortalaması alınmaz. Örneğin 2 CAPTCHA toplam 40 saniye, 5 CAPTCHA toplam 50 saniye ise sonuç 90 / 7 = 12,86 saniye/CAPTCHA'dır; 15 saniye değildir.
- Hata için harcanan aktif süre, sonunda çözülen aynı CAPTCHA'ya bir kez eklenir. Başarısız kalan CAPTCHA, çözüm süresi örneği oluşturmaz; bütün durumlar seçildiğinde hata/cevap deneme sayısına katılır.
- Yeni ölçümlerde otomatik geri bildirim beklemesi, kapalı CAPTCHA penceresi ve gizli sekmede geçen süre aktif çözüm süresine dahil değildir. Satışta bu pencerelerin duvar saati süresi ayrıca takip edilir; CAPTCHA dışı aktif seçim/arama süresi bundan ayrı tutulur. Tur süresi tüm duvar saati süresidir.
- Median bireysel çözüm sürelerinin ortancasıdır (çift örnekte iki orta değerin ortası). P90 en yakın sıra yöntemiyle hesaplanır. İlk denemede çözüm = hiç yanlış cevabı olmadan çözülenler / çözülen CAPTCHA'lar. Deneme doğruluğu = doğru cevap / tüm cevaplar. Çözüm başına deneme yalnızca çözülmüş soruların denemelerini kapsar.
- Varsayılan filtre yalnız tamamlanan turlardır. Yarım/açık turlar ayrıca seçilebilir. Her kartta örnek sayısı gösterilir; kullanıcı karşılaştırmasında 10'dan az çözüm için düşük örnek etiketi bulunur. Bu eşik bir istatistiksel güven testi değildir.

Sayı grupları (0, 2, 5 vb.) ayrı görünür. Tür filtresi tek beceriyi ayırır. Tarih için tam giriş/hazır gün/hazır ay/hazır yıl ve gereken rakam sayısı; rakam/metin/kişisel girişler için karakter sayısı; resim için mantıksal hareket mesafesi grubu kaydedilir. Resim grupları 100 piksel altı, 100–179 ve en az 180 mantıksal pikseldir; resim algoritmasının koordinatları kullanılır.

Tam ssenaryo filtresi kaynak, ölçüm sürümü, gerçek CAPTCHA dizisi, antrenman sıralama ayarı, satış aşaması ve karşılaşılan giriş koşullarını ayırır. Karışık türlerden oluşan genel ortalama tek başına bir beceri sıralaması değildir. Kullanıcı karşılaştırması bu yüzden varsayılan olarak ada göre listelenir; koç süre/doğruluk sıralamasını seçebilir. Yeniden denemede koşulu değişen CAPTCHA'lar soruda birden çok koşulla gösterilir; tek koşul filtresine alınmaz. Donanım, bağlantı, önceki deneyim gibi kontrol edilmeyen farklar için düzeltilmiş bir skor üretilmez.

## Kayıt biçimi ve eski veriler

`metricsVersion: 2` yeni aktif süre yöntemidir; satış `schemaVersion: 2` olay biçimiyle birlikte kullanılır. Her `captchaQuestions` kaydı soru indeksi, tür, aşama, deneme/hata sayısı, aktif süre, tamamlanma ve koşulları taşır. Ham CAPTCHA cevapları veya beklenen tarih/kişisel cevaplar kaydedilmez.

Satışın mevcut üç saniyelik olay kuyruğu korunur. Koşul olayları sunucuda izinli alanlarla doğrulanır; her sonuç önceki aktif denemeye eklenerek soru özeti sunucuda üretilir. Geri bildirim, gizli sekme ve etkileşim süreleri ayrı sayaçlardır. Eski açık bir turun ölçüm sürümü sonradan yeni kabul edilmez. Yeni satış istemcisi tur başlatırken sürümünü bildirir; bunu bildirmeyen önceki istemciler yeni veriyle aynı gruba alınmaz.

Ayrı CAPTCHA antrenmanı başlangıçta gerçek tür dizisini sabitler. Hazır olma bildirimi her denemeyi başlatır; yanlış cevapta aynı sorunun denemesi biter, geri bildirim sonrasında yeni deneme başlar. Önceki birikimli süreyi her hatada yeniden toplama kaldırılmıştır. Sunucu plan/sıra, koşul, zaman sınırları ve tamamlanma durumunu doğrular; sayıları ve soruları denemelerden üretir. Bir istemci tur kimliğiyle yeniden kayıt aynı belgeyi döndürür; değiştirilmiş kayıt reddedilir. Tamamlanma/durdurma/ayrılma sırasında sonuç gönderilir. Aniden kapanan tarayıcı, bağlantı kesilmesi veya gönderilemeyen sayfa ayrılışında antrenmanın son kaydı kaybolabilir; bu akış sürekli sunucuya yazılan satış olay kuyruğuyla aynı dayanıklılık garantisini vermez. Paket sınırı nedeniyle antrenmanda en fazla 50 planlı soru ve 200 cevap denemesi bulunur.

Önceki kayıtlarda bireysel aktif süre, koşul veya seçilen toplam sayı bulunmayabilir. Bunlar `legacy` olarak ayrı tarihçede korunur. Eksik alanlardan sahte tekil örnek, median veya P90 üretilmez; yeni karşılaştırma ortalamalarına eklenmez. Sürüm yükseltmesi eski oturumlara veri yazmaz.

## Arayüz ve veri kapsamı

Kaynak, kullanıcı, plan sayısı, tür, koşul, durum, ölçüm sürümü, tarih aralığı ve tam ssenaryo filtreleri vardır. Gizli gelişmiş filtrelerden aktif olanlar görünür etiketlerde gösterilir. Grafik sütunu ilgili günü seçer; tür satırı türü seçer. Kullanıcı listesi aranabilir/sıralanabilir, profillere geçilebilir. Her tur ve CAPTCHA ayrı açılır. CSV tüm filtrelenmiş soruları içerir; ekrandaki 20 satırla sınırlanmaz. Formül olarak yorumlanabilecek CSV metin hücreleri korunur.

`captcha/analytics` bütün eşleşen özet belgelerini okur; ilk 10/20 kayıt sınırı uygulanmaz. İstemci bu güvenli veri kümesini bir kez alır, filtreleme/gruplama tarayıcıda yapılır; yenileme yeni sunucu görüntüsü alır. Çalışma durumu, şifre özeti, oturum bilgisi ve ayarlardaki cevaplar API sonucuna dahil edilmez. Kullanıcı silinmişse genel karşılaştırma listesine katılmaz. Tarihler `Asia/Baku` ile gösterilir. Kaynak filtresi tek başına seçildiğinde sayılar ve türler yine karışık olabilir; aynı beceri karşılaştırması için ilgili filtreler seçilmelidir.

Büyük geçmişlerde her yenilemenin tüm eşleşen özetleri okuma maliyeti vardır. Grafik en son 30 veri gününü çizer; hesaplamalar seçilen tarih aralığının tüm verilerini kullanır. Firestore kuralları ve sorgu indekslerinde değişiklik gerekmez.

Kontroller: `npm run test:analytics`, `npm run test:captcha`, `npm run test:sales`, yerel Auth/Firestore emülatörleriyle `npm run test:integration`, TypeScript ve production build. Görsel kanıtlar yalnızca sentetik emülatör kayıtlarıyla hazırlanır.
