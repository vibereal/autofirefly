# Firefly Boost - Automation ⚡

**Firefly Boost** adalah ekstensi Google Chrome yang dirancang untuk mengotomatisasi proses pembuatan gambar (image generation) di Adobe Firefly. Alat ini memungkinkan pengguna untuk memuat daftar prompt dari file teks, menjalankannya secara berurutan, dan mengunduh hasil gambar secara otomatis.

## 🚀 Fitur Utama

- **Bulk Prompt Loading**: Memuat banyak prompt sekaligus dari file `.txt`.
- **Automated Typing**: Mensimulasikan pengetikan manusia pada kolom prompt untuk menghindari deteksi bot.
- **Auto Generate**: Secara otomatis menekan tombol "Generate" setelah prompt dimasukkan.
- **Auto Download**: Mendeteksi ketika gambar selesai dibuat dan mengunduhnya secara otomatis ke komputer Anda.
- **Smart Detection**: Menggunakan algoritma cerdas untuk menembus Shadow DOM dan mendeteksi elemen antarmuka Adobe Firefly.
- **Content Credentials Handling**: Menangani popup konfirmasi kredensial konten secara otomatis.
- **Side Panel UI**: Antarmuka yang bersih dan mudah digunakan yang terintegrasi langsung di samping browser.

## 🛠️ Tech Stack

Proyek ini dibangun menggunakan teknologi web modern dan standar ekstensi Chrome:

- **Manifest V3**: Standar terbaru untuk ekstensi Chrome yang lebih aman dan performa lebih baik.
- **JavaScript (ES6+)**: Logika utama untuk otomatisasi dan interaksi DOM.
- **HTML5 & CSS3**: Membangun antarmuka pengguna (Side Panel).
- **Vite**: Build tool yang cepat untuk pengembangan frontend (opsional untuk pengembangan lebih lanjut).
- **Chrome APIs**:
  - `sidePanel`: Untuk antarmuka pengguna.
  - `scripting`: Untuk menyuntikkan skrip ke halaman web.
  - `storage`: Untuk menyimpan status dan konfigurasi.
  - `downloads`: Untuk manajemen unduhan file.

## 📦 Instalasi

1. **Clone atau Download** repository ini ke komputer Anda.
   ```bash
   git clone https://github.com/username/autofirefly.git
   ```
2. **Install Dependencies** (Opsional, jika ingin mengembangkan):
   ```bash
   npm install
   ```
3. **Muat Ekstensi di Chrome**:
   - Buka browser Google Chrome dan pergi ke `chrome://extensions/`.
   - Aktifkan **Developer mode** di pojok kanan atas.
   - Klik tombol **Load unpacked**.
   - Pilih folder direktori proyek ini (`autofirefly`).

## 🎮 Cara Penggunaan

1. **Buka Adobe Firefly**:
   - Navigasikan ke [https://firefly.adobe.com/](https://firefly.adobe.com/) dan masuk ke akun Adobe Anda.
   - Pilih fitur "Text to Image".

2. **Buka Side Panel**:
   - Klik ikon ekstensi **Firefly Boost** di toolbar Chrome.
   - Pilih "Open Side Panel" jika belum terbuka otomatis.

3. **Siapkan Prompt**:
   - Buat file `.txt` yang berisi daftar prompt Anda (satu prompt per baris).

4. **Jalankan Otomatisasi**:
   - Di Side Panel, klik **Choose File** dan pilih file `.txt` prompt Anda.
   - Klik tombol **Start New**.
   - Ekstensi akan mulai mengetik prompt pertama, membuat gambar, dan mengunduhnya.
   - Proses akan berlanjut ke prompt berikutnya secara otomatis hingga selesai.

5. **Kontrol**:
   - **Pause**: Jeda proses sementara.
   - **Resume**: Lanjutkan proses dari posisi terakhir.
   - **Stop**: Hentikan seluruh proses.
   - **Reset**: Reset status dan log.

## 📂 Struktur Proyek

- `manifest.json`: Konfigurasi utama ekstensi.
- `background.js`: Service worker untuk manajemen background task.
- `content.js`: Skrip yang berjalan di halaman web untuk interaksi DOM (ketik, klik, download).
- `sidepanel.html` & `sidepanel.js`: Antarmuka pengguna dan logikanya.
- `utils.js`: Fungsi utilitas umum.

---
**Catatan**: Ekstensi ini dibuat untuk tujuan edukasi dan produktivitas pribadi. Gunakan dengan bijak dan patuhi syarat & ketentuan penggunaan Adobe Firefly.
