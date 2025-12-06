🧺 Clean Wash - Laundry Management System
Clean Wash adalah aplikasi web berbasis Single Page Application (SPA) sederhana yang berfungsi sebagai sistem manajemen operasional laundry. Aplikasi ini dikembangkan menggunakan HTML, CSS (dengan styling khusus dan Bootstrap), dan JavaScript Vanilla. Untuk backend, aplikasi ini memanfaatkan Google Firebase (Firestore & Auth) untuk otentikasi, realtime database, dan penyimpanan data.

✨ Fitur Utama Berdasarkan Peran
Aplikasi ini mengimplementasikan Role-Based Access Control untuk membedakan hak akses antara Admin dan Karyawan.
Semua Pengguna (Karyawan & Admin)
- Autentikasi: Mendaftar (Register) dan Masuk (Login) menggunakan email dan password.
- Input Pesanan: Mencatat pesanan pelanggan, termasuk tanggal, nama, layanan, kuantitas, harga satuan, dan status pembayaran/pesanan.**
  - Perhitungan Otomatis: Menghitung total biaya berdasarkan kuantitas dan harga satuan, dengan validasi harga agar tidak di luar rentang (Min/Max) yang ditetapkan
- Daftar Pesanan (CRUD): Melihat daftar semua pesanan secara realtime.
  - Aksi Cepat: Mengubah status pesanan (Masuk $\rightarrow$ Diproses $\rightarrow$ Selesai $\rightarrow$ Diambil).
  - Cetak Invoice: Membuat dan mencetak bukti transaksi sederhana untuk pelanggan.
- Profil Saya: Mengelola nama pengguna.

Admin (Akses Penuh)
Peran Admin memiliki akses penuh ke fitur sensitif dan master data.
- Data Master
  - Data Layanan: Mengelola daftar layanan dan menentukan rentang harga (Min-Max) per Kilogram dan per Pcs.
  - Input Pengeluaran: Mencatat pengeluaran operasional (Operasional, Gaji, Maintenance, Lainnya).
- Manajemen Staf: Mengelola data staf dan mengelola peran (role) pengguna yang terdaftar (admin atau karyawan).
- Laporan Keuangan & Analisis:
  - Melihat ringkasan total Pemasukan (Lunas), Pengeluaran, dan menghitung Kas Bersih (Pemasukan - Pengeluaran).
  - Melihat Total Piutang (pesanan Belum Lunas).
  - Grafik Tren Pemasukan Bulanan dan Detail Transaksi Lunas.
  - Ekspor Data: Mengekspor Daftar Pesanan ke format PDF dan Excel.

🔑 Pengaturan Akun Admin & Karyawan
Aplikasi tidak memiliki akun bawaan. Anda harus mendaftar akun Karyawan terlebih dahulu, kemudian meningkatkan perannya menjadi Admin melalui Firebase Console.

Peran	Email Contoh	Password Contoh	Catatan
Admin	    : admin@gmail.com	       pw : admin1	
Karyawan	: karyawan@gmail.com	   pw : karyawan	

🛠 Teknologi yang Digunakan
- Frontend: HTML5, CSS3, JavaScript (Vanilla)
- Framework CSS: Bootstrap 5.3
- Ikon: Font Awesome 6
- Database & Auth: Google Firebase (v8.10.0):
  - firebase-firestore.js

🚀 Cara Instalasi
1. Siapkan Proyek Firebase: Buat proyek baru di Firebase Console dan aktifkan layanan Firestore Database dan Authentication.
2. Konfigurasi Proyek: Ganti nilai objek firebaseConfig di file js/firebase-config.js dengan konfigurasi proyek Firebase Anda.
3. Deploy atau Jalankan Lokal: Anda dapat menjalankan file index.html dan login.html secara lokal atau deploy ke layanan hosting statis (seperti Firebase Hosting).
