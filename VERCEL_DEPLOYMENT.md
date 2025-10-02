# PAYU Squid Game - Vercel Deployment Rehberi

Bu proje **Vercel Postgres** veritabanı ile çalışacak şekilde hazırlandı. Tüm platform tek yerden (Vercel) çalışacak.

## 🚀 Hızlı Deployment (5 dakika)

### 1️⃣ Vercel'e Proje Yükle

1. [Vercel.com](https://vercel.com)'a git ve ücretsiz hesap aç
2. "New Project" butonuna tıkla
3. GitHub hesabını bağla
4. Bu projeyi seç ve "Import" et

### 2️⃣ Vercel Postgres Database Ekle

1. Proje dashboard'unda **"Storage"** sekmesine git
2. **"Create Database"** > **"Postgres"** seç
3. Database adı: `payu-giveaway-db` (ya da istediğin isim)
4. **"Create"** butonuna tıkla

Vercel otomatik olarak şu environment variables'ları ekleyecek:
- `POSTGRES_URL`
- `POSTGRES_PRISMA_URL`
- `POSTGRES_URL_NON_POOLING`
- `DATABASE_URL`

### 3️⃣ Build & Deploy Ayarları

Vercel otomatik olarak algılayacak, ama kontrol et:

**Root Directory:** `/` (boş bırak)

**Build Command:**
```bash
cd frontend && npm install && npm run build
```

**Output Directory:**
```
frontend/build
```

**Install Command:**
```bash
cd backend && pip install -r requirements.txt && cd ../frontend && npm install
```

### 4️⃣ Environment Variables (Opsiyonel)

Eğer CORS ayarlarını değiştirmek istersen:

```
CORS_ORIGINS=*
```

### 5️⃣ Deploy Et!

"Deploy" butonuna tıkla ve bekle. İlk deployment 2-3 dakika sürebilir.

## 📱 Deployment Sonrası

### ✅ Başarılı Deployment Kontrolü

1. Vercel size bir URL verecek: `https://your-project.vercel.app`
2. URL'i aç ve sayfanın yüklendiğini kontrol et
3. "JOIN THE GIVEAWAY" butonuna tıkla
4. Cüzdan bağla ve test et

### 🗄️ Database Tabloları

Database tabloları otomatik olarak oluşacak. Backend ilk çalıştığında:
- `registrations` - Katılımcı kayıtları
- `task_clicks` - Görev tıklamaları
- `giveaway_settings` - Giveaway ayarları
- `status_checks` - Sistem durumu

### 🔑 Admin Panel

Admin paneli şu adresten erişilebilir:
```
https://your-project.vercel.app/admin
```

Admin cüzdan adresi: `0xd9C4b8436d2a235A1f7DB09E680b5928cFdA641a`

## 🐛 Sorun Giderme

### Deployment Hatası?

1. Vercel dashboard'unda **"Deployments"** > Son deployment'a tıkla
2. **"Build Logs"** sekmesinde hatayı bul
3. Genelde eksik environment variable ya da build hatası

### Database Bağlanamıyor?

1. **"Storage"** > Postgres database'ine git
2. **"Settings"** > **"Environment Variables"**
3. `POSTGRES_URL` ve `DATABASE_URL` var mı kontrol et
4. Yoksa tekrar **"Connect"** butonuna tıkla

### Frontend API Çağrıları 404?

Frontend production'da `/api` endpoint'ini kullanıyor. Vercel.json dosyası routing'i yönetiyor:
```json
{
  "src": "/api/(.*)",
  "dest": "backend/server.py"
}
```

## 📊 Production Monitoring

Vercel dashboard'unda:
- **Analytics**: Ziyaretçi istatistikleri
- **Logs**: Runtime logs (errors, API calls)
- **Speed Insights**: Performans metrikleri

## 🔄 Güncelleme Yapmak

Git'e push yaptığında Vercel otomatik olarak yeniden deploy eder:

```bash
git add .
git commit -m "Update feature"
git push origin main
```

Vercel 1-2 dakika içinde yeni versiyonu yayınlar.

## 🎯 Smart Contract Bilgileri

- **Network:** BSC Mainnet (Chain ID: 56)
- **Contract:** `0x17A0D20Fc22c30a490FB6F186Cf2c31d738B5567`
- **Registration Fee:** 0.00098 BNB
- **Admin Wallet:** `0xd9C4b8436d2a235A1f7DB09E680b5928cFdA641a`

## ✨ Özellikler

✅ Tek platformda çalışma (Vercel)
✅ Otomatik SSL sertifikası
✅ Global CDN
✅ Otomatik scaling
✅ PostgreSQL veritabanı
✅ Zero-downtime deployments
✅ Ücretsiz tier (hobby projeler için)

## 💰 Vercel Ücretsiz Limitleri

- 100 GB bandwidth/month
- Unlimited sites
- Automatic HTTPS
- Vercel Postgres: 256 MB storage

Daha fazla trafik için **Vercel Pro** planına geçebilirsin ($20/month).

---

**Hazır!** Projen artık Vercel'de live! 🎉
