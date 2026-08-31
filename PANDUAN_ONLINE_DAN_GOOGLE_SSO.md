# Panduan Menjadikan Website Online & Konfigurasi Google SSO
## SIPERU PURBOWARDAYAN - SPMR Purbowardayan Surakarta

---

### OPSI 1: Deploy Online Gratis Menggunakan Vercel (Paling Direkomendasikan)
1. Buat akun di [Vercel](https://vercel.com).
2. Upload / push project ini ke GitHub repository Anda.
3. Di Vercel Dashboard, klik **"Add New Project"** dan import repository GitHub Anda.
4. (Opsional) Pada menu **Environment Variables**, tambahkan:
   - `MONGODB_URI` : (Connection string MongoDB Atlas Anda jika ingin database cloud)
5. Klik **"Deploy"**. Dalam hitungan detik website akan online dengan domain HTTPS gratis (contoh: `siperu-purbowardayan.vercel.app`).

---

### OPSI 2: Deploy Online Gratis Menggunakan Render / Railway
1. Buka [Render](https://render.com) atau [Railway](https://railway.app).
2. Buat **Web Service** baru dari GitHub repository Anda.
3. Atur:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Deploy dan dapatkan URL online publik otomatis.

---

### OPSI 3: Online Seketika dari Komputer Lokal Menggunakan Ngrok / Localtunnel
Jika ingin langsung membagikan link website yang sedang berjalan di komputer Anda:
```bash
# Jalankan server lokal
npm start

# Di terminal lain, buka terowongan online publik (pilih salah satu):
npx localtunnel --port 8000
# ATAU
ngrok http 8000
```
Website akan langsung bisa diakses oleh siapa saja melalui internet via URL yang diberikan!

---

### Konfigurasi Google Sign-In (Client ID) Asli
1. Buka [Google Cloud Console](https://console.cloud.google.com/apis/credentials).
2. Buat project baru dan klik **"Create Credentials" > "OAuth client ID"**.
3. Pilih Application Type: **Web application**.
4. Di bagian **Authorized JavaScript origins**, tambahkan:
   - `http://localhost:8000`
   - Domain online Anda (contoh: `https://siperu-spmr.vercel.app`)
5. Salin **Client ID** Anda (contoh: `123456789-xxxx.apps.googleusercontent.com`).
6. Buka file `index.html` dan ganti `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` pada baris 526 dengan Client ID Anda.
