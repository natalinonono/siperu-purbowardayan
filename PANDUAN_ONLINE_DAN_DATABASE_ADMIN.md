# PANDUAN LENGKAP: MENJADIKAN SIPERU PURBOWARDAYAN ONLINE & TERHUBUNG DATABASE CLOUD ADMIN

Dokumen ini memandu langkah demi langkah dari awal sampai website **SIPERU PURBOWARDAYAN** aktif di internet (*online*) dan seluruh data peminjaman ruangan tersimpan aman di **Database Cloud (MongoDB Atlas)** yang terpusat sehingga semua Admin dan Jemaat terhubung secara real-time.

---

## BAGIAN 1: Membuat Database Cloud Gratis (MongoDB Atlas)

Database ini berfungsi sebagai pusat penyimpanan data. Setiap ada jemaat yang booking atau admin yang menyetujui jadwal dari HP/laptop manapun, datanya otomatis tersimpan di sini.

1. Buka situs [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) dan daftar akun gratis.
2. Buat database baru:
   - Pilih paket **FREE (M0 Shared)** (Gratis selamanya).
   - Pilih provider **AWS** dan region terdekat (misal: *Singapore*).
   - Klik **Create Deployment**.
3. Buat **Username** dan **Password** Database:
   - Masukkan Username (contoh: `admin_siperu`).
   - Masukkan Password yang kuat (contoh: `SpmrPurbowardayan2026!`). Simpan password ini!
   - Klik **Create Database User**.
4. Atur **Network Access (IP Whitelist)**:
   - Pada bagian *Where would you like to connect from?*, pilih **My Local Environment / Cloud Environment**.
   - Masukkan IP Address: `0.0.0.0/0` (Artinya: izinkan akses dari server cloud manapun).
   - Klik **Finish and Close**.
5. Dapatkan **Connection String (URI Database)**:
   - Di halaman database, klik tombol **Connect** > pilih **Drivers (Node.js)**.
   - Anda akan mendapatkan URL koneksi seperti ini:
     ```text
     mongodb+srv://admin_siperu:<password>@cluster0.abcde.mongodb.net/siperu_db?retryWrites=true&w=majority
     ```
   - Ganti `<password>` dengan password yang Anda buat tadi.
   - **Simpan URI ini**, Anda akan memasukkannya ke Vercel/Render!

---

## BAGIAN 2: Deploy Website Menjadi Online (Paling Mudah via Vercel)

Vercel adalah layanan hosting cloud nomor 1 di dunia yang sangat cepat, gratis, dan otomatis memberikan domain `https://`.

### Langkah A: Upload Kode ke GitHub
1. Buka [GitHub](https://github.com) dan buat repository baru dengan nama `siperu-purbowardayan`.
2. Di folder project ini di komputer Anda, buka terminal PowerShell dan jalankan:
   ```bash
   git init
   git add .
   git commit -m "Deploy Siperu Purbowardayan Siap Launching"
   git branch -M main
   git remote add origin https://github.com/USERNAME_GITHUB_ANDA/siperu-purbowardayan.git
   git push -u origin main
   ```

### Langkah B: Hubungkan ke Vercel & Masukkan Database
1. Buka [Vercel](https://vercel.com) dan login dengan akun GitHub Anda.
2. Klik tombol **"Add New..."** > pilih **"Project"**.
3. Pilih repository `siperu-purbowardayan` yang baru saja Anda upload, lalu klik **Import**.
4. Buka bagian **"Environment Variables"** sebelum klik Deploy:
   - **Key / Nama**: `MONGODB_URI`
   - **Value / Nilai**: Masukkan connection string MongoDB Atlas dari Bagian 1 di atas.
5. Klik **"Deploy"**.
6. Tunggu ~30 detik. Website Anda sekarang **resmi online** di seluruh dunia dengan alamat seperti:
   ```text
   https://siperu-purbowardayan.vercel.app
   ```

---

## BAGIAN 3: Menggunakan Domain Khusus Paroki (Opsional)

Jika Gereja SPMR Purbowardayan memiliki domain resmi (contoh: `ruang.purbowardayan.or.id` atau `siperu.gereja.id`):
1. Di dashboard Vercel project Anda, buka menu **Settings > Domains**.
2. Masukkan nama domain yang diinginkan.
3. Tambahkan record DNS (CNAME) sesuai petunjuk yang diberikan Vercel di panel domain gereja Anda.

---

## BAGIAN 4: Cara Admin & Jemaat Mengakses Web Online

Setelah online:
1. **Untuk Jemaat & Dewan Paroki**:
   - Buka link website (contoh: `https://siperu-purbowardayan.vercel.app`).
   - Bisa langsung melihat kalender publik kegiatan yang disetujui & menunggu.
   - Klik **Masuk via Google** dan masukkan email untuk mengajukan peminjaman ruangan.
2. **Untuk Para Admin / Sekretariat / Romo**:
   - Login menggunakan email yang mengandung kata `admin` atau email resmi gereja (contoh: `admin@gereja.id`, `admin.purbowardayan@gmail.com`).
   - Menu **Dasbor Admin** & **Audit Kebersihan** otomatis terbuka.
   - Admin dapat melakukan persetujuan (*Approve*), penolakan (*Reject* dengan alasan), permintaan revisi (*Revision* dengan komparasi diff), dan audit foto ruangan dari HP/Laptop kapan saja dan di mana saja.
   - Semua perubahan langsung tersinkronisasi detik itu juga ke database MongoDB Atlas!

---

## OPSI INSTAN: Membuka Akses Online Langsung dari Komputer Anda Sekarang (Tanpa Upload)

Jika Anda ingin menguji coba atau mendemokan web ini ke romo / admin lain detik ini juga langsung dari komputer Anda:
```powershell
# 1. Jalankan server lokal
node server.js

# 2. Buka terminal lain dan jalankan terowongan online publik:
npx localtunnel --port 8000
```
Terminal akan langsung mengeluarkan link internet publik yang bisa dibuka oleh siapa saja di smartphone atau laptop mereka!
