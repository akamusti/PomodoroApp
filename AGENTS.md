# AGENTS.md - Development & AI Agent Guidelines

Bu rehber, **PomodoroApp** projesinde görev alan yapay zeka ajanları (ve geliştiriciler) için belirlenmiş zorunlu kuralları, güvenlik ilkelerini, iş akışlarını ve kod standartlarını tanımlar.

---

## 1. İletişim ve Dil Kuralları (Language & Communication)

- **Kullanıcı İletişimi:** Kullanıcı ile yapılan tüm yazışmalar, açıklamalar, durum güncellemeleri ve sorular istisnasız **Türkçe** olarak yürütülür.
- **Kod ve Git İletişimi:**
  - Tüm kod içi yorum satırları, dokümantasyonlar, değişken/fonksiyon adlandırmaları **İngilizce** olmalıdır.
  - Git commit mesajları, branch adları ve PR açıklamaları kesinlikle **İngilizce** ve **Conventional Commits** standartlarına uygun yazılmalıdır.

---

## 2. Güvenlik, Gizlilik ve Secret Kontrolü (Secret & Privacy Policy)

Herhangi bir kodlama veya dosya düzenleme adımı tamamlandığında, değişiklikler commit edilmeden önce aşağıdaki güvenlik denetimleri zorunlu olarak uygulanır:

### 2.1. Hassas Bilgi Taraması (Secret Scanning)
Kod tabanında aşağıdakilerin bulunmadığından emin olunmalıdır:
- API Anahtarları (API Keys), Token'lar, Private Key'ler, Parolalar, OAuth credential'ları.
- Kişisel Bilgiler (PII): Gerçek isimler, e-posta adresleri, telefon numaraları, yerel dosya yolu sızıntıları (`/home/<kullanıcı>/...` gibi sabit yollar yerine dinamik veya bağıl yollar kullanılmalıdır).

### 2.2. Çevre Değişkenleri (.env) ve Şablon Yönetimi
- Projeye herhangi bir API, konfigürasyon veya gizli anahtar dahil edilecekse, bunlar kesinlikle kaynak koda doğrudan (hardcoded) yazılmaz.
- Değerler `.env` dosyasına taşınır.
- Projede gizli değerlerin boş şablonunu gösteren bir `.env.example` dosyası oluşturulur ve güncel tutulur.
- `.env`, `.env.local` ve benzeri gizli dosyaların `.gitignore` içerisinde tanımlandığı ve Git tarafından izlenmediği doğrulanır.

---

## 3. Git ve GitHub İş Akışı (Git & Release Workflow)

Her görev veya özellik tamamlandığında şu adımlar sırasıyla işletilir:

1. **Pre-commit Kontrolü:**
   - Kod değişiklikleri taranır (`git diff`), kişisel bilgi veya secret sızıntısı olmadığı teyit edilir.
   - İstenmeyen geçici dosyaların (`node_modules`, `target`, `build`, `__pycache__`, `*.pyc`, binary çıktılar) listelenmediği `.gitignore` ile kontrol edilir.
2. **Commit Süreci:**
   - İngilizce dilinde ve Conventional Commits formatında açık bir mesaj oluşturulur:
     - `feat: add system tray support for pomodoro timer`
     - `fix: resolve notification sound trigger issue on Linux`
     - `style: improve modern UI dark mode palette`
     - `refactor: decouple timer engine from UI components`
3. **Senkronizasyon & Push:**
   - Değişiklikler commit edildikten sonra remote depoya (`origin`) push'lanır.

---

## 4. Linux Masaüstü Entegrasyon Standartları (Desktop App Architecture)

Geliştirilecek olan masaüstü uygulaması Linux kullanıcı deneyimini birinci sınıf kılmalıdır:

- **Masaüstü Bildirimleri (Desktop Notifications):**
  - Mola ve çalışma periyotları bittiğinde Freedesktop standartlarında sistem bildirimi (libnotify) gönderilmelidir.
- **Sesli Uyarılar (Audio Cues):**
  - Çalışma/mola başlangıç ve bitişlerinde hafif, dikkat çekici ses efektleri çalınabilmeli; ses kapatma/açma opsiyonu bulunmalıdır.
- **Sistem Tepsisi Entegrasyonu (System Tray / AppIndicator):**
  - Pencere kapatıldığında uygulamanın arka planda/tepside çalışmaya devam edebilmesi (minimize to tray).
  - Tepsi menüsünden Başlat/Durdur/Sıfırla/Çıkış yapabilme.
  - Mümkünse tepsi simgesinde kalan süreyi veya ilerlemeyi gösterebilme.
- **Kullanıcı Arayüzü (UI/UX):**
  - Modern, minimalist, dikkat dağıtmayan (distraction-free) tasarım.
  - Açık/Koyu tema (Dark/Light Mode) uyumluluğu.
  - Özelleştirilebilir süreler (Çalışma, Kısa Mola, Uzun Mola, Döngü Sayısı).
- **Masaüstü Girişi (.desktop) ve İkon:**
  - Linux uygulama menüsünde düzgün görünmesi için standart `.desktop` dosyası ve yüksek çözünürlüklü SVG/PNG uygulama ikonu sağlanmalıdır.

---

## 5. Kod Kalitesi ve Hata Yönetimi (Code Quality)

- **Modülerlik:** Zamanlayıcı çekirdeği (Timer Engine) ile arayüz katmanı birbirinden bağımsız tutulmalıdır.
- **Kaynak Tüketimi:** Pomodoro arka planda çalışırken CPU ve RAM tüketimi minimum seviyede olmalıdır (özellikle sistem kaynaklarını gereksiz yere meşgul eden döngülerden kaçınılmalıdır).
- **Dayanıklılık:** Ses veya bildirim kütüphanesi sistemde bulunmasa dahi uygulama çökmeksizin (graceful degradation) çalışmaya devam etmelidir.
