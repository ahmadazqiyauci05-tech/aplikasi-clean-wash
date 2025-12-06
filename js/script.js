// ==========================================
// VARIABEL GLOBAL
// ==========================================
let idEdit = null;
let idUserEditRole = null; 
let dataLayananCache = {}; 
let dataStafCache = {};    
let myBarChart, myPieChart, myMonthlyChart; 
let userRole = ''; 
let daftarLayanan = {}; 
let totalPengeluaranCache = 0;   // Cache untuk pengeluaran
let totalPemasukanCache = 0;   // Cache untuk pemasukan
// Variabel currentUserNama dan fungsi Log Status Dihapus

// ==========================================
// 1. NAVIGASI HALAMAN (SPA)
// ==========================================
function showPage(pageId, btnElement) {
    if (!checkPageAccess(pageId)) {
        alertOtorisasi(`Halaman ${pageId} tidak dapat diakses oleh role ${userRole}.`);
        return;
    }

    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById('page-' + pageId).classList.add('active');

    if (btnElement) {
        document.querySelectorAll('.menu-btn').forEach(btn => btn.classList.remove('active'));
        btnElement.classList.add('active');
    }
}

// ==========================================
// 2. LOGIKA GRAFIK (CHART.JS)
// ==========================================
function initCharts() {
    // Grafik Bar (Status Pesanan)
    const ctxBar = document.getElementById('barChart');
    if(ctxBar) {
        myBarChart = new Chart(ctxBar.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Pesanan Masuk', 'Lunas', 'Diproses', 'Selesai'],
                datasets: [{
                    label: 'Jumlah Pesanan',
                    data: [0, 0, 0, 0],
                    backgroundColor: ['#006aff', '#2ecc71', '#ff9f43', '#FF6B6B'],
                    borderRadius: 5
                }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
    }
    
    // Grafik Pie (Proporsi Master Data)
    const ctxPie = document.getElementById('pieChart');
    if(ctxPie) {
        myPieChart = new Chart(ctxPie.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: ['Total Pesanan', 'Total Staf', 'Total Layanan'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#36a2eb', '#ff9f40', '#ff6384'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, cutout: '70%' }
        });
    }

    // Grafik Garis (Tren Pemasukan Bulanan)
    const ctxMonthly = document.getElementById('monthlyChart');
    if (ctxMonthly) {
        myMonthlyChart = new Chart(ctxMonthly.getContext('2d'), {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
                datasets: [{
                    label: 'Pemasukan (Rp.)',
                    data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(123, 44, 191, 0.2)',
                    borderColor: '#7B2CBF',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { callback: function(value) { return 'Rp ' + value.toLocaleString('id'); } } } } }
        });
    }
}

function updateChartData(index, value) {
    if (myPieChart) { myPieChart.data.datasets[0].data[index] = value; myPieChart.update(); }
}

function updateBarChart(counts) {
    if (myBarChart) { 
        myBarChart.data.datasets[0].data = [
            counts.total || 0,
            counts.lunas || 0,
            counts.diproses || 0,
            counts.selesai || 0
        ];
        myBarChart.update(); 
    }
}

function updateMonthlyChart(monthlyData) {
    if (myMonthlyChart) {
        myMonthlyChart.data.datasets[0].data = monthlyData;
        myMonthlyChart.update();
    }
}


// ==========================================
// 3. LOGIKA UTAMA (FIREBASE)
// ==========================================
auth.onAuthStateChanged((user) => {
    if (user) {
        // --- PROFIL USER & NAVBAR ---
        db.collection('users').doc(user.uid).get().then(doc => {
            if(doc.exists) {
                const data = doc.data();
                userRole = data.role || 'karyawan'; 
                // currentUserNama dihilangkan

                document.getElementById('namaUser').innerText = data.nama;
                document.getElementById('roleUser').innerText = userRole.charAt(0).toUpperCase() + userRole.slice(1);
                
                if(document.getElementById('dispNama')) document.getElementById('dispNama').innerText = data.nama;
                if(document.getElementById('dispEmail')) document.getElementById('dispEmail').innerText = user.email;
                if(document.getElementById('profNama')) document.getElementById('profNama').value = data.nama;
                if(document.getElementById('profEmail')) document.getElementById('profEmail').value = user.email;
                if(document.getElementById('profUid')) document.getElementById('profUid').value = user.uid;

                handleAuthorization(userRole);
                
                const menuStaf = document.getElementById('menu-staf');
                if (menuStaf) menuStaf.onclick = function() { showPage('staf', this); };
                
                if (!checkPageAccess('dashboard')) {
                    showPage('input'); 
                } else {
                    showPage('dashboard', document.getElementById('menu-dashboard')); 
                }
                
                setupKuantitasInput();
            } else {
                document.getElementById('namaUser').innerText = user.email;
                document.getElementById('roleUser').innerText = 'Karyawan';
            }
        });

        initCharts();
        
        // --- Realtime Counters, Charts, dan Laporan Keuangan ---
        db.collection("pesanan").onSnapshot(snap => { 
            let totalPesanan = snap.size;
            let totalLunas = 0;
            let totalDiproses = 0;
            let totalSelesai = 0; 
            
            let totalPemasukanLunas = 0; 
            let totalPiutang = 0; 
            let countTransaksiLunas = 0; 
            
            let monthlySalesData = new Array(12).fill(0); 
            let htmlLaporanDetail = ""; 

            snap.forEach(doc => {
                const d = doc.data();
                
                // 1. Hitungan Status & Keuangan
                if (d.status_bayar === 'Lunas') {
                    totalLunas++;
                    totalPemasukanLunas += d.bayar || 0;
                    countTransaksiLunas++;
                    
                    // Isi Tabel Detail Laporan (HANYA LUNAS)
                    // Menggunakan tanggal_pesanan jika ada, jika tidak, gunakan timestamp
                    const date = d.tanggal_pesanan 
                        ? new Date(d.tanggal_pesanan + 'T00:00:00') 
                        : (d.timestamp ? new Date(d.timestamp.seconds * 1000) : new Date());
                        
                    const tanggal = date.toLocaleDateString('id-ID');
                    const unitLabel = d.satuan === 'kg' ? 'Kg' : 'Pcs';
                    const kuantitasDisplay = `${d.kuantitas || 0} ${unitLabel}`;

                    htmlLaporanDetail += `<tr>
                        <td>${countTransaksiLunas}</td>
                        <td>${tanggal}</td>
                        <td>${d.nama_pelanggan}</td>
                        <td>${d.layanan}</td>
                        <td class="text-center">${kuantitasDisplay}</td>
                        <td class="text-end">Rp. ${(d.total_biaya || 0).toLocaleString('id')}</td>
                        <td class="text-end fw-bold text-success">Rp. ${(d.bayar || 0).toLocaleString('id')}</td>
                    </tr>`;

                    // Hitung data bulanan
                    const month = date.getMonth(); 
                    monthlySalesData[month] += (d.bayar || 0);

                } else {
                    // Hitung Piutang
                    totalPiutang += (d.total_biaya || 0) - (d.bayar || 0);
                }
                
                // 2. Hitungan Status Pesanan untuk Bar Chart
                if (d.status_pesanan === 'Diproses') totalDiproses++;
                if (d.status_pesanan === 'Selesai' || d.status_pesanan === 'Diambil') totalSelesai++;
            });
            
            // NEW: Update Pemasukan Cache dan Hitung Kas Bersih
            totalPemasukanCache = totalPemasukanLunas;
            updateKasBersih(); 
            
            // --- UPDATE DASHBOARD CARDS ---
            if (document.getElementById("countPesanan")) document.getElementById("countPesanan").innerText = totalPesanan;
            if (document.getElementById("countLunas")) document.getElementById("countLunas").innerText = totalLunas;
            if (document.getElementById("countDiproses")) document.getElementById("countDiproses").innerText = totalDiproses;
            
            // --- UPDATE LAPORAN KEUANGAN CARDS ---
            if (document.getElementById("laporanPemasukan")) document.getElementById("laporanPemasukan").innerText = `Rp. ${totalPemasukanLunas.toLocaleString('id')}`;
            if (document.getElementById("laporanPiutang")) document.getElementById("laporanPiutang").innerText = `Rp. ${totalPiutang.toLocaleString('id')}`;
            if (document.getElementById("countTransaksiLunas")) document.getElementById("countTransaksiLunas").innerText = countTransaksiLunas;
            if (document.getElementById("tabelLaporanDetail")) document.getElementById("tabelLaporanDetail").innerHTML = htmlLaporanDetail;

            // --- UPDATE CHARTS ---
            updateChartData(0, totalPesanan); 
            updateBarChart({ 
                total: totalPesanan, 
                lunas: totalLunas, 
                diproses: totalDiproses, 
                selesai: totalSelesai 
            });
            updateMonthlyChart(monthlySalesData); 
        });
        
        // --- Realtime Pengeluaran ---
        db.collection("pengeluaran").orderBy("tanggal", "desc").onSnapshot(snap => {
            let totalPengeluaran = 0;
            let html = "";
            let no = 1;

            snap.forEach(doc => {
                const d = doc.data();
                totalPengeluaran += d.nominal || 0;
                
                const tanggal = new Date(d.tanggal + 'T00:00:00').toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' });
                
                let badgeClass = '';
                if (d.kategori === 'Operasional') badgeClass = 'badge-operasional';
                else if (d.kategori === 'Gaji') badgeClass = 'badge-gaji';
                else if (d.kategori === 'Maintenance') badgeClass = 'badge-maintenance';
                else badgeClass = 'badge-lainnya';
                
                const aksiBtns = userRole === 'admin' 
                    ? `<button class="btn btn-sm btn-warning" onclick="editPengeluaran('${doc.id}', '${d.tanggal}', '${d.kategori}', '${d.deskripsi}', ${d.nominal})"><i class="fas fa-edit text-white"></i></button>
                       <button class="btn btn-sm btn-danger" onclick="hapus('${doc.id}', 'pengeluaran')"><i class="fas fa-trash"></i></button>`
                    : `<span class="text-muted">No Akses</span>`;
                    
                html += `<tr>
                    <td>${no++}</td>
                    <td>${tanggal}</td>
                    <td><span class="badge-pesanan ${badgeClass}">${d.kategori}</span></td>
                    <td>${d.deskripsi}</td>
                    <td class="text-end fw-bold text-danger">Rp. ${d.nominal.toLocaleString('id')}</td>
                    <td class="text-center">${aksiBtns}</td>
                </tr>`;
            });

            // NEW: Update Pengeluaran Cache dan Hitung Kas Bersih
            totalPengeluaranCache = totalPengeluaran;
            updateKasBersih(); 

            document.getElementById("tabelPengeluaran").innerHTML = html;
            if (document.getElementById("totalPengeluaranDisplay")) document.getElementById("totalPengeluaranDisplay").innerText = `Rp. ${totalPengeluaran.toLocaleString('id')}`;
            if (document.getElementById("laporanPengeluaran")) document.getElementById("laporanPengeluaran").innerText = `Rp. ${totalPengeluaran.toLocaleString('id')}`;
        });
        
        db.collection("staf").onSnapshot(snap => { 
            if (document.getElementById("countStaf")) document.getElementById("countStaf").innerText = snap.size;
            updateChartData(1, snap.size); 
        });
        
        db.collection("layanan").onSnapshot(snap => { 
            if (document.getElementById("countLayanan")) document.getElementById("countLayanan").innerText = snap.size;
            updateChartData(2, snap.size); 
        });

        // --- D. CRUD STAF (Listener & Form Logic) ---
        const formStaf = document.getElementById("formStaf");
        if(formStaf) {
            formStaf.addEventListener("submit", (e) => {
                e.preventDefault();
                if (userRole !== 'admin') { alertOtorisasi('Fitur CRUD Data Master hanya untuk Admin.'); return; }
                
                if(!idEdit) {
                    Swal.fire('Perhatian!', 'Untuk menambah staf baru, staf harus mendaftar dulu di halaman Register. Admin hanya bisa mengedit NIP di sini.', 'warning');
                }
                else {
                    // Logika NIP di sini dipertahankan untuk referensi jika Admin ingin mengedit NIP.
                    // Namun di Form di index.html, tombol Edit NIP sudah dihapus.
                    db.collection("staf").doc(idEdit).update({
                        nip: document.getElementById("nipStaf").value,
                    }).then(() => { 
                        Swal.fire('Berhasil', 'NIP Staf Diupdate', 'success'); 
                        resetForm('staf'); 
                    }).catch(error => {
                        Swal.fire('Gagal', 'Terjadi kesalahan saat update NIP.', 'error');
                    });
                }
            });

            const usersRef = db.collection('users');
            const stafRef = db.collection('staf').orderBy("timestamp", "desc");

            stafRef.onSnapshot(stafSnap => {
                usersRef.get().then(usersSnap => {
                    const usersMap = {};
                    usersSnap.forEach(doc => {
                        const d = doc.data();
                        usersMap[d.email] = { 
                            uid: d.uid,
                            role: d.role,
                            nama: d.nama
                        };
                    });

                    let html = ""; let no=1;
                    let selectHtml = '<option value="">-- Pilih Staf Penerima --</option>';
                    dataStafCache = {};

                    stafSnap.forEach(doc => {
                        let d = doc.data();
                        
                        const userEmail = d.email_akun || '';
                        let matchedUser = usersMap[userEmail];
                        
                        const userUid = matchedUser ? matchedUser.uid : null;
                        const userRoleDisplay = matchedUser ? matchedUser.role : 'N/A';
                        const stafNameDisplay = d.nama || 'N/A';

                        dataStafCache[doc.id] = stafNameDisplay; 
                        selectHtml += `<option value="${stafNameDisplay}">${stafNameDisplay}</option>`;
                        
                        let aksiBtns = '';
                        if (userRole === 'admin') {
                            aksiBtns = 
                                `<button class="btn btn-sm btn-info text-white me-1" onclick="editRole('${userUid}', '${stafNameDisplay}', '${userEmail}', '${userRoleDisplay}')" title="Kelola Peran"><i class="fas fa-user-tag"></i></button>` +
                                // Tombol Edit NIP (kuning) dihapus di index.html
                                `<button class="btn btn-sm btn-danger" onclick="hapus('${doc.id}', 'staf')" title="Hapus Data Staf"><i class="fas fa-trash"></i></button>`;
                        } else {
                             aksiBtns = `<span class="text-muted">No Akses</span>`;
                        }

                        html += `<tr>
                            <td>${no++}</td>
                            <td>${stafNameDisplay} (${userRoleDisplay})</td>
                            <td class="text-center">${aksiBtns}</td>
                        </tr>`;
                    });
                    document.getElementById("tabelStaf").innerHTML = html;
                    if(document.getElementById("inpStaf")) document.getElementById("inpStaf").innerHTML = selectHtml;
                    if(document.getElementById("editStaf")) document.getElementById("editStaf").innerHTML = selectHtml;
                })
                .catch(error => {
                    console.error("Error fetching staf/users:", error);
                    document.getElementById("tabelStaf").innerHTML = `<tr><td colspan="3" class="text-center text-danger">Gagal memuat data pengguna: Cek aturan Firestore.</td></tr>`;
                });
            });
        }
        
        // --- C. CRUD LAYANAN (Listener) ---
        const formLayanan = document.getElementById("formLayanan");
        if(formLayanan) {
            formLayanan.addEventListener("submit", (e) => {
                e.preventDefault();
                if (userRole !== 'admin') { alertOtorisasi('Fitur CRUD Data Master hanya untuk Admin.'); return; }
                const data = {
                    nama_layanan: document.getElementById("namaLayanan").value,
                    harga_kg_min: parseInt(document.getElementById("hargaKgMin").value) || 0,
                    harga_kg_max: parseInt(document.getElementById("hargaKgMax").value) || 0,
                    harga_pcs_min: parseInt(document.getElementById("hargaPcsMin").value) || 0,
                    harga_pcs_max: parseInt(document.getElementById("hargaPcsMax").value) || 0,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                };
                if(!idEdit) db.collection("layanan").add(data).then(() => { Swal.fire('Berhasil', 'Layanan Tersimpan', 'success'); resetForm('layanan'); });
                else db.collection("layanan").doc(idEdit).update(data).then(() => { Swal.fire('Berhasil', 'Diupdate', 'success'); resetForm('layanan'); });
            });
            
            db.collection("layanan").orderBy("timestamp", "desc").onSnapshot(snap => {
                let html = ""; let no=1;
                let selectHtml = '<option value="">-- Pilih Layanan --</option>';
                daftarLayanan = {};
                snap.forEach(doc => {
                    let d = doc.data();
                    daftarLayanan[doc.id] = d;

                    const hargaKg = `Rp. ${d.harga_kg_min.toLocaleString('id')} - ${d.harga_kg_max.toLocaleString('id')}`;
                    const hargaPcs = `Rp. ${d.harga_pcs_min.toLocaleString('id')} - ${d.harga_pcs_max.toLocaleString('id')}`;
                    
                    selectHtml += `<option value="${doc.id}">${d.nama_layanan}</option>`;
                    
                    const aksiBtns = userRole === 'admin' 
                        ? `<button class="btn btn-sm btn-warning" onclick="editLayanan('${doc.id}', '${d.nama_layanan}', ${d.harga_kg_min}, ${d.harga_kg_max}, ${d.harga_pcs_min}, ${d.harga_pcs_max})"><i class="fas fa-edit text-white"></i></button>
                           <button class="btn btn-sm btn-danger" onclick="hapus('${doc.id}', 'layanan')"><i class="fas fa-trash"></i></button>`
                        : `<span class="text-muted">No Akses</span>`;
                        
                    html += `<tr>
                        <td>${no++}</td>
                        <td>${d.nama_layanan}</td>
                        <td>${hargaKg} / Kg</td>
                        <td>${hargaPcs} / Pcs</td>
                        <td class="text-center">${aksiBtns}</td>
                    </tr>`;
                });
                document.getElementById("tabelLayanan").innerHTML = html;
                
                if(document.getElementById("inpLayanan")) document.getElementById("inpLayanan").innerHTML = selectHtml;
                if(document.getElementById("editLayanan")) document.getElementById("editLayanan").innerHTML = selectHtml;
                
                if (document.getElementById("countLayanan")) document.getElementById("countLayanan").innerText = snap.size;
                updateChartData(2, snap.size);
            });
        }

        // --- NEW: CRUD PENGELUARAN ---
        const formPengeluaran = document.getElementById("formPengeluaran");
        if(formPengeluaran) {
            formPengeluaran.addEventListener("submit", (e) => {
                e.preventDefault();
                if (userRole !== 'admin') { alertOtorisasi('Fitur Pengeluaran hanya untuk Admin.'); return; }
                
                const data = {
                    tanggal: document.getElementById("pengeluaranTanggal").value,
                    kategori: document.getElementById("pengeluaranKategori").value,
                    deskripsi: document.getElementById("pengeluaranDeskripsi").value,
                    nominal: parseInt(document.getElementById("pengeluaranNominal").value) || 0,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                };

                if(data.nominal <= 0) {
                     Swal.fire('Gagal', 'Nominal pengeluaran harus lebih dari nol.', 'error');
                     return;
                }
                
                if(!idEdit) {
                    db.collection("pengeluaran").add(data).then(() => { 
                        Swal.fire('Berhasil', 'Pengeluaran Tersimpan', 'success'); 
                        resetForm('pengeluaran'); 
                        setTanggalPengeluaranDefault();
                    });
                } else {
                    db.collection("pengeluaran").doc(idEdit).update(data).then(() => { 
                        Swal.fire('Berhasil', 'Pengeluaran Diupdate', 'success'); 
                        resetForm('pengeluaran'); 
                        setTanggalPengeluaranDefault();
                    });
                }
            });
        }

        // --- EDIT ROLE ---
        const formEditRole = document.getElementById("formEditRole");
        if(formEditRole) {
            formEditRole.addEventListener("submit", (e) => {
                e.preventDefault();
                if (userRole !== 'admin') { alertOtorisasi('Hanya Admin yang dapat mengubah peran.'); return; }
                
                const newRole = document.getElementById("selectRole").value;
                
                db.collection("users").doc(idUserEditRole).update({
                    role: newRole
                }).then(() => {
                    Swal.fire('Berhasil', `Peran berhasil diubah menjadi ${newRole.toUpperCase()}.`, 'success')
                        .then(() => { 
                            showPage('staf', document.getElementById('menu-staf')); 
                        });
                }).catch((error) => {
                    console.error("Error updating role:", error);
                    Swal.fire('Gagal', 'Terjadi kesalahan saat menyimpan peran.', 'error');
                });
            });
        }
        
        // --- F. CRUD PESANAN (Input Pesanan) ---
        const formPesanan = document.getElementById("formPesanan");
        if(formPesanan) {
            document.getElementById("inpKuantitas").addEventListener("input", () => updateBiayaInput('inp'));
            document.getElementById("inpSatuan").addEventListener("change", () => updateHargaRentang('inp'));
            document.getElementById("inpLayanan").addEventListener("change", () => updateHargaRentang('inp'));


            formPesanan.addEventListener("submit", (e) => {
                e.preventDefault();
                if (userRole !== 'admin' && userRole !== 'karyawan') { alertOtorisasi(); return; } 
                
                updateBiayaInput('inp');
                
                const totalBiaya = parseInt(document.getElementById("inpTotal").value) || 0;
                const bayar = parseInt(document.getElementById("inpBayar").value) || 0;
                const statusBayar = document.getElementById("inpStatusBayar").value;
                const statusPesanan = 'Masuk'; // Default Status

                if (totalBiaya <= 0) {
                     Swal.fire({ icon: 'warning', title: 'Biaya Nol', text: 'Total biaya tidak boleh nol atau harga di luar rentang.', showConfirmButton: true });
                    return;
                }
                if (document.getElementById('inpHargaManual').classList.contains('is-invalid')) {
                    Swal.fire({ icon: 'error', title: 'Gagal Simpan!', text: 'Harga satuan yang dimasukkan tidak valid (di luar rentang).', showConfirmButton: true });
                    return;
                }
                if (statusBayar === 'Lunas' && bayar < totalBiaya) {
                    Swal.fire({ icon: 'error', title: 'Pembayaran Kurang!', text: 'Jika status Lunas, jumlah bayar harus minimal sebesar Total Biaya.', showConfirmButton: true });
                    return;
                }
                
                const layananSelect = document.getElementById("inpLayanan");

                db.collection("pesanan").add({
                    tanggal_pesanan: document.getElementById("inpTanggal").value, 
                    nama_pelanggan: document.getElementById("inpNamaPlg").value,
                    telepon: document.getElementById("inpTelp").value,
                    layanan: layananSelect.options[layananSelect.selectedIndex].text,
                    layanan_id: layananSelect.value, 
                    kuantitas: parseFloat(document.getElementById("inpKuantitas").value) || 0,
                    satuan: document.getElementById("inpSatuan").value,
                    harga_satuan: parseInt(document.getElementById("inpHargaManual").value) || 0, 
                    total_biaya: totalBiaya,
                    bayar: bayar,
                    status_bayar: statusBayar,
                    status_pesanan: statusPesanan, 
                    staf_penerima: document.getElementById("inpStaf").value,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp() 
                }).then((docRef) => { 
                    Swal.fire('Berhasil', 'Pesanan Tersimpan', 'success'); 
                    formPesanan.reset(); 
                    updateHargaRentang('inp'); 
                    setTanggalDefault(); 
                });
            });
        }

        // --- G. EDIT PESANAN (UPDATE) ---
        const formEditPesanan = document.getElementById("formEditPesanan");
        if(formEditPesanan) {
            document.getElementById("editKuantitas").addEventListener("input", () => updateBiayaInput('edit'));
            document.getElementById("editHargaManual").addEventListener("input", () => updateBiayaInput('edit'));
            document.getElementById("editSatuan").addEventListener("change", () => updateHargaRentang('edit'));
            document.getElementById("editLayanan").addEventListener("change", () => updateHargaRentang('edit'));


            formEditPesanan.addEventListener("submit", (e) => {
                e.preventDefault();
                if (userRole !== 'admin' && userRole !== 'karyawan') { alertOtorisasi(); return; }
                
                updateBiayaInput('edit');
                
                const totalBiaya = parseInt(document.getElementById("editTotal").value) || 0;
                const bayar = parseInt(document.getElementById("editBayar").value) || 0;
                const statusBayar = document.getElementById("editStatusBayar").value;
                const newStatusPesanan = document.getElementById("editStatusPesanan").value;

                if (totalBiaya <= 0) {
                     Swal.fire({ icon: 'warning', title: 'Biaya Nol', text: 'Total biaya tidak boleh nol atau harga di luar rentang.', showConfirmButton: true });
                    return;
                }
                if (document.getElementById('editHargaManual').classList.contains('is-invalid')) {
                    Swal.fire({ icon: 'error', title: 'Gagal Simpan!', text: 'Harga satuan yang dimasukkan tidak valid (di luar rentang).', showConfirmButton: true });
                    return;
                }
                if (statusBayar === 'Lunas' && bayar < totalBiaya) {
                    Swal.fire({ icon: 'error', title: 'Pembayaran Kurang!', text: 'Jika status Lunas, jumlah bayar harus minimal sebesar Total Biaya.', showConfirmButton: true });
                    return;
                }
                
                const layananSelect = document.getElementById("editLayanan");
                
                db.collection("pesanan").doc(idEdit).get().then(doc => {
                    const oldStatus = doc.data().status_pesanan;
                    
                    db.collection("pesanan").doc(idEdit).update({
                        tanggal_pesanan: document.getElementById("editTanggal").value, 
                        nama_pelanggan: document.getElementById("editNamaPlg").value,
                        telepon: document.getElementById("editTelp").value,
                        layanan: layananSelect.options[layananSelect.selectedIndex].text,
                        layanan_id: layananSelect.value, 
                        kuantitas: parseFloat(document.getElementById("editKuantitas").value) || 0,
                        satuan: document.getElementById("editSatuan").value,
                        harga_satuan: parseInt(document.getElementById("editHargaManual").value) || 0, 
                        total_biaya: totalBiaya,
                        bayar: bayar,
                        status_bayar: statusBayar,
                        status_pesanan: newStatusPesanan,
                        staf_penerima: document.getElementById("editStaf").value,
                    }).then(() => { 
                        Swal.fire('Berhasil', 'Data Pesanan Diperbarui', 'success')
                            .then(() => { showPage('view'); });
                    });
                });
            });
        }

        // --- H. VIEW PESANAN (REVISI RENDERING TABEL UNTUK STATUS CEPAT) ---
        db.collection("pesanan").orderBy("timestamp", "desc").onSnapshot(snap => {
            let html = ""; let no=1;
            let totalPemasukanLunas = 0;

            snap.forEach(doc => {
                let d = doc.data();
                const docId = doc.id; 
                const currentStatus = d.status_pesanan;

                if (d.status_bayar === 'Lunas') {
                    totalPemasukanLunas += d.bayar || 0;
                }
                
                // NEW: Format Tanggal Pesanan
                const displayDate = d.tanggal_pesanan 
                    ? new Date(d.tanggal_pesanan + 'T00:00:00').toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' }) 
                    : 'N/A';
                
                let statusBayarBadge = d.status_bayar === "Lunas" 
                    ? `<span class="badge-status status-lulus"><i class="fas fa-check me-1"></i>Lunas</span>` 
                    : `<span class="badge-status status-gagal"><i class="fas fa-clock me-1"></i>Belum Lunas</span>`;
                
                let statusPesananBadge;
                if(currentStatus === "Masuk") {
                    statusPesananBadge = `<span class="badge-pesanan badge-masuk">Masuk</span>`;
                } else if (currentStatus === "Diproses") {
                    statusPesananBadge = `<span class="badge-pesanan badge-proses">Diproses</span>`;
                } else if (currentStatus === "Selesai") {
                    statusPesananBadge = `<span class="badge-pesanan badge-selesai">Selesai</span>`;
                } else {
                    statusPesananBadge = `<span class="badge-pesanan badge-ambil">Diambil</span>`;
                }
                
                const unitLabel = d.satuan === 'kg' ? 'Kg' : 'Pcs';
                const kuantitasDisplay = `${d.kuantitas || 0} ${unitLabel} (@Rp. ${(d.harga_satuan || 0).toLocaleString('id')})`;

                
                let aksiBtns = '';
                const canEdit = userRole === 'admin' || userRole === 'karyawan';

                if (canEdit) {
                    // Tombol Aksi Cepat
                    if (currentStatus === 'Masuk' || currentStatus === 'Diambil') {
                        aksiBtns += `<button class="btn btn-sm btn-outline-info me-1" onclick="updateStatusCepat('${docId}', 'Diproses', '${currentStatus}')" title="Set Diproses"><i class="fas fa-arrow-right"></i></button>`;
                    }
                    if (currentStatus === 'Diproses') {
                        aksiBtns += `<button class="btn btn-sm btn-outline-success me-1" onclick="updateStatusCepat('${docId}', 'Selesai', '${currentStatus}')" title="Set Selesai"><i class="fas fa-check"></i></button>`;
                    }
                    if (currentStatus === 'Selesai') {
                         aksiBtns += `<button class="btn btn-sm btn-outline-primary me-1" onclick="updateStatusCepat('${docId}', 'Diambil', '${currentStatus}')" title="Set Diambil"><i class="fas fa-shopping-bag"></i></button>`;
                    }
                    
                    // Tombol Cetak (DIKEMBALIKAN)
                    aksiBtns += `<button class="btn btn-sm btn-success ms-1" onclick="printInvoice('${docId}')" title="Cetak Bukti Transaksi"><i class="fas fa-print"></i></button>`;

                    // Tombol Edit & Hapus
                    aksiBtns += `<button class="btn btn-sm btn-warning ms-1" onclick="editPesanan('${docId}')" title="Edit Pesanan"><i class="fas fa-edit text-white"></i></button>
                                 <button class="btn btn-sm btn-danger" onclick="hapus('${docId}', 'pesanan')" title="Hapus Pesanan"><i class="fas fa-trash"></i></button>`;
                } else {
                    aksiBtns = `<span class="text-muted">No Akses</span>`;
                }

                
                html += `<tr>
                    <td>${no++}</td>
                    <td>${displayDate}</td> <td class="fw-bold text-dark">${d.nama_pelanggan}</td>
                    <td>${d.layanan}</td>
                    <td class="text-center">${kuantitasDisplay}</td>
                    <td class="text-end fw-bold text-primary">Rp. ${d.total_biaya ? d.total_biaya.toLocaleString('id') : 0}</td>
                    <td class="text-center">${statusBayarBadge}</td>
                    <td class="text-center">${statusPesananBadge}</td>
                    <td class="text-center">${d.staf_penerima || '-'}</td>
                    <td class="text-center" style="min-width: 250px;">${aksiBtns}</td>
                </tr>`;
            });
            document.getElementById("tabelPesanan").innerHTML = html;
            
            if (document.getElementById("laporanPemasukan")) {
                document.getElementById("laporanPemasukan").innerText = `Rp. ${totalPemasukanLunas.toLocaleString('id')}`;
            }
        });

        // --- UPDATE PROFIL ---
        const formProfil = document.getElementById("formProfil");
        if(formProfil) {
            formProfil.addEventListener("submit", (e) => {
                e.preventDefault();
                const namaBaru = document.getElementById("profNama").value;
                db.collection('users').doc(user.uid).update({ nama: namaBaru }).then(() => {
                    document.getElementById('namaUser').innerText = namaBaru;
                    document.getElementById('dispNama').innerText = namaBaru;
                    Swal.fire({ icon: 'success', title: 'Berhasil!', text: 'Profil diperbarui.', timer: 1500, showConfirmButton: false });
                });
            });
        }

    } else { window.location.href = "login.html"; }
});

// ==========================================
// 4. HELPER FUNCTIONS
// ==========================================

// FUNGSI addStatusLog DIHAPUS

// FUNGSI showLogStatus DIHAPUS

// NEW: FUNGSI CETAK INVOICE (Dipertahankan)
window.printInvoice = function(docId) {
    db.collection('pesanan').doc(docId).get().then(doc => {
        if (!doc.exists) {
            Swal.fire('Error', 'Data pesanan tidak ditemukan.', 'error');
            return;
        }
        const d = doc.data();
        const date = d.tanggal_pesanan ? new Date(d.tanggal_pesanan + 'T00:00:00') : new Date();
        const tanggalStr = date.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
        const unitLabel = d.satuan === 'kg' ? 'Kg' : 'Pcs';

        const content = `
            <div style="width: 300px; padding: 10px; font-family: monospace; font-size: 11px; margin: 0 auto; line-height: 1.5;">
                <h4 style="text-align: center; margin: 0 0 5px 0;">CLEAN WASH LAUNDRY</h4>
                <p style="text-align: center; border-bottom: 1px dashed black; padding-bottom: 5px; margin-bottom: 5px;">Jl. Contoh No. 123, Kota Anda</p>

                <p style="margin: 0;"><strong>ID Pesanan:</strong> ${docId.substring(0, 8).toUpperCase()}</p>
                <p style="margin: 0;"><strong>Tanggal:</strong> ${tanggalStr}</p>
                <p style="margin: 0;"><strong>Pelanggan:</strong> ${d.nama_pelanggan}</p>
                <p style="margin: 0 0 10px 0;"><strong>Telp:</strong> ${d.telepon}</p>

                <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                    <thead>
                        <tr style="border-top: 1px dashed black; border-bottom: 1px dashed black;">
                            <th style="text-align: left; padding: 3px 0;">Layanan</th>
                            <th style="text-align: right; padding: 3px 0;">Qty</th>
                            <th style="text-align: right; padding: 3px 0;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td style="text-align: left; padding: 3px 0;">${d.layanan}</td>
                            <td style="text-align: right; padding: 3px 0;">${d.kuantitas} ${unitLabel}</td>
                            <td style="text-align: right; padding: 3px 0;">Rp ${d.total_biaya.toLocaleString('id')}</td>
                        </tr>
                    </tbody>
                </table>

                <p style="text-align: right; border-top: 1px dashed black; padding-top: 5px; margin-top: 5px;"><strong>TOTAL:</strong> Rp ${d.total_biaya.toLocaleString('id')}</p>
                <p style="text-align: right; margin: 0;"><strong>BAYAR:</strong> Rp ${d.bayar.toLocaleString('id')}</p>
                <p style="text-align: right; margin: 0;"><strong>KEMBALI:</strong> Rp ${(d.bayar - d.total_biaya).toLocaleString('id')}</p>
                
                <p style="text-align: center; margin-top: 15px; font-size: 10px;">Status Pembayaran: <strong>${d.status_bayar}</strong></p>
                <p style="text-align: center; margin: 0; font-size: 10px;">--- Terima Kasih ---</p>
            </div>
        `;

        const printWindow = window.open('', 'Print Invoice', 'height=600,width=400');
        printWindow.document.write('<html><head><title>Invoice</title>');
        printWindow.document.write('</head><body>');
        printWindow.document.write(content);
        printWindow.document.write('</body></html>');
        printWindow.document.close();
        printWindow.print();
    }).catch(error => {
        Swal.fire('Gagal', 'Gagal memuat data pesanan untuk dicetak.', 'error');
    });
}


function setupKuantitasInput() {
    const inpSatuan = document.getElementById('inpSatuan');
    const editSatuan = document.getElementById('editSatuan');
    
    if (inpSatuan) inpSatuan.dispatchEvent(new Event('change'));
    if (editSatuan) editSatuan.dispatchEvent(new Event('change'));
}
window.addEventListener('load', setupKuantitasInput);

// NEW: Set Tanggal Hari Ini sebagai Default untuk Pesanan
function setTanggalDefault() {
    const today = new Date().toISOString().split('T')[0];
    const inpTanggal = document.getElementById('inpTanggal');
    if (inpTanggal) {
        inpTanggal.value = today;
    }
}
document.addEventListener('DOMContentLoaded', setTanggalDefault);

// NEW: Set Tanggal Hari Ini sebagai Default untuk Pengeluaran
function setTanggalPengeluaranDefault() {
    const today = new Date().toISOString().split('T')[0];
    const inpTanggal = document.getElementById('pengeluaranTanggal');
    if (inpTanggal) {
        inpTanggal.value = today;
    }
}
document.addEventListener('DOMContentLoaded', setTanggalPengeluaranDefault);

// NEW: FUNGSI UNTUK MENGHITUNG DAN MENAMPILKAN KAS BERSIH
window.updateKasBersih = function() {
    const kasBersih = totalPemasukanCache - totalPengeluaranCache;
    const element = document.getElementById("laporanKasBersih");

    if (element) {
        element.innerText = `Rp. ${kasBersih.toLocaleString('id')}`;
        
        // Opsional: ganti warna card berdasarkan laba/rugi
        const cardStat = element.closest('.card-stat');
        if (cardStat) {
            if (kasBersih < 0) {
                // Background untuk Rugi (Merah Tua)
                cardStat.style.background = 'linear-gradient(45deg, #a80000, #ff6b6b)';
            } else {
                // Background untuk Laba (Hijau Tosca)
                cardStat.style.background = 'linear-gradient(45deg, #00A896, #2ecc71)';
            }
        }
    }
}


window.toggleSidebar = function() {
    const body = document.querySelector('body');
    const toggleIcon = document.getElementById('toggleIcon');
    
    body.classList.toggle('sidebar-hidden');
    
    if (body.classList.contains('sidebar-hidden')) {
        toggleIcon.classList.remove('fa-bars');
        toggleIcon.classList.add('fa-times'); 
    } else {
        toggleIcon.classList.remove('fa-times');
        toggleIcon.classList.add('fa-bars'); 
    }
}

// UPDATE: Menghapus logika log status dari updateStatusCepat
window.updateStatusCepat = function(id, statusBaru, statusLama) {
    if (userRole !== 'admin' && userRole !== 'karyawan') { 
        alertOtorisasi('Anda tidak diizinkan mengubah status pesanan.'); 
        return; 
    }

    if (statusBaru === statusLama) {
        Swal.fire('Info', `Status sudah "${statusBaru}". Tidak ada perubahan.`, 'info');
        return;
    }
    
    Swal.fire({
        title: `Ubah status ke ${statusBaru}?`,
        text: "Status pesanan akan segera diperbarui.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Ya, Ubah!',
        confirmButtonColor: '#7B2CBF'
    }).then((result) => {
        if (result.isConfirmed) {
            db.collection("pesanan").doc(id).update({
                status_pesanan: statusBaru
            }).then(() => {
                // Logic Log Status Dihapus
                Swal.fire('Berhasil!', `Status diubah menjadi ${statusBaru}.`, 'success');
            }).catch(error => {
                console.error("Error updating status:", error);
                Swal.fire('Gagal!', 'Terjadi kesalahan saat update status.', 'error');
            });
        }
    });
}


function checkPageAccess(pageId) {
    const allowedKaryawan = ['dashboard', 'input', 'view', 'profil', 'edit-pesanan'];
    const allowedAdmin = ['dashboard', 'layanan', 'staf', 'input', 'view', 'laporan', 'profil', 'edit-pesanan', 'role', 'pengeluaran']; 

    if (userRole === 'admin') {
        return allowedAdmin.includes(pageId);
    } else if (userRole === 'karyawan') {
        return allowedKaryawan.includes(pageId);
    } 
    return ['dashboard', 'profil'].includes(pageId);
}

function handleAuthorization(role) {
    const adminMenus = ['layanan', 'staf', 'laporan', 'pengeluaran'];
    
    adminMenus.forEach(id => {
        const menu = document.getElementById(`menu-${id}`);
        if(menu) menu.style.display = (role === 'admin' ? 'flex' : 'none');
    });

    const exportBtnContainer = document.getElementById('exportButtons');
    if(exportBtnContainer) exportBtnContainer.style.display = (role === 'admin' ? 'block' : 'none');
    
    const financeCard = document.getElementById('financeCard');
    if(financeCard) financeCard.style.display = (role === 'admin' ? 'flex' : 'none');
    
    const menuInput = document.getElementById('menu-input');
    const menuView = document.getElementById('menu-view');

    if (role === 'admin') {
        if(menuInput) menuInput.style.display = 'flex';
        if(menuView) menuView.style.display = 'flex'; 
    } else if (role === 'karyawan') {
        if(menuInput) menuInput.style.display = 'flex';
        if(menuView) menuView.style.display = 'flex'; 
        adminMenus.forEach(id => {
            const menu = document.getElementById(`menu-${id}`);
            if(menu) menu.style.display = 'none';
        });
    }
}

window.alertOtorisasi = function(message = 'Akses Ditolak. Anda tidak memiliki izin untuk fitur ini.') {
    Swal.fire({
        title: 'Akses Ditolak!',
        text: message,
        icon: 'error',
        confirmButtonText: 'OK',
    });
}

// EDIT FUNGSI MASTER DATA
window.editLayanan = function(id, nama, kg_min, kg_max, pcs_min, pcs_max) {
    if (userRole !== 'admin') { alertOtorisasi('Fitur CRUD Data Master hanya untuk Admin.'); return; }
    idEdit = id;
    document.getElementById("namaLayanan").value = nama; 
    document.getElementById("hargaKgMin").value = kg_min;
    document.getElementById("hargaKgMax").value = kg_max;
    document.getElementById("hargaPcsMin").value = pcs_min;
    document.getElementById("hargaPcsMax").value = pcs_max; 
    document.getElementById("btnLayanan").innerText = "Update"; 
    document.getElementById("btnLayanan").classList.add("btn-warning");
    showPage('layanan'); 
}

// NEW: EDIT PENGELUARAN
window.editPengeluaran = function(id, tanggal, kategori, deskripsi, nominal) {
    if (userRole !== 'admin') { alertOtorisasi('Fitur Pengeluaran hanya untuk Admin.'); return; }
    idEdit = id;
    document.getElementById("pengeluaranTanggal").value = tanggal;
    document.getElementById("pengeluaranKategori").value = kategori;
    document.getElementById("pengeluaranDeskripsi").value = deskripsi;
    document.getElementById("pengeluaranNominal").value = nominal;
    document.getElementById("btnPengeluaran").innerText = "Update Pengeluaran";
    document.getElementById("btnPengeluaran").classList.add("btn-warning");
    showPage('pengeluaran');
}

// FUNGSI BARU: EDIT ROLE
window.editRole = function(uid, nama, email, roleSaatIni) {
    if (userRole !== 'admin') { alertOtorisasi('Hanya Admin yang dapat mengubah peran.'); return; }
    
    if (!uid || uid === 'null' || uid === 'undefined') {
         Swal.fire('Peringatan', 'Pengguna ini belum memiliki akun yang terdaftar di sistem otorisasi (users). Silakan minta pengguna mendaftar melalui halaman register.', 'warning');
         return;
    }
    
    idUserEditRole = uid;
    document.getElementById("roleUserName").innerText = nama;
    document.getElementById("roleUserEmail").value = email;
    document.getElementById("selectRole").value = roleSaatIni;

    // Hapus Karis 3 dari dropdown role saat edit (JIKA ADA)
    const selectRole = document.getElementById("selectRole");
    if (selectRole) {
        const karisOption = selectRole.querySelector('option[value="karis3"]');
        if (karisOption) {
            karisOption.remove();
        }
    }
    
    showPage('role'); 
}

window.editPesanan = function(id) {
    if (userRole !== 'admin' && userRole !== 'karyawan') { alertOtorisasi(); return; } 
    idEdit = id; 
    
    db.collection("pesanan").doc(id).get().then(doc => {
        if (doc.exists) {
            const d = doc.data();
            
            // NEW: Isi input tanggal
            document.getElementById("editTanggal").value = d.tanggal_pesanan || ''; 
            
            // Isi form data pelanggan & staf
            document.getElementById("editNamaPlg").value = d.nama_pelanggan || ''; 
            document.getElementById("editTelp").value = d.telepon || '';
            document.getElementById("editStaf").value = d.staf_penerima || '';
            
            // Isi form Layanan & Kuantitas
            document.getElementById("editLayanan").value = d.layanan_id || '';
            document.getElementById("editSatuan").value = d.satuan || 'kg';
            document.getElementById("editKuantitas").value = d.kuantitas || 0;
            
            // Isi form Pembayaran & Status
            document.getElementById("editBayar").value = d.bayar || 0;
            document.getElementById("editStatusBayar").value = d.status_bayar || 'Belum Lunas';
            document.getElementById("editStatusPesanan").value = d.status_pesanan || 'Masuk';
            
            // Panggil updateHargaRentang untuk mengisi rentang dan set HargaManual default
            updateHargaRentang('edit'); 

            // Set HargaManual dengan nilai yang tersimpan di database
            document.getElementById("editHargaManual").value = d.harga_satuan || 0;

            // Panggil updateBiayaInput untuk perhitungan akhir
            updateBiayaInput('edit');
            
            showPage('edit-pesanan');
        } else {
            Swal.fire('Error', 'Data tidak ditemukan.', 'error');
        }
    });
}

// RESET FORM
window.resetForm = function(type) {
    idEdit = null; 
    if(type === 'layanan') { 
        document.getElementById("formLayanan").reset(); 
        document.getElementById("btnLayanan").innerText = "Simpan"; 
        document.getElementById("btnLayanan").classList.remove("btn-warning"); 
    }
    if(type === 'staf') { 
        // Logika NIP/ID Dihapus total, tidak ada form untuk direset
    }
    if(type === 'pengeluaran') {
        document.getElementById("formPengeluaran").reset();
        document.getElementById("btnPengeluaran").innerText = "Simpan Pengeluaran";
        document.getElementById("btnPengeluaran").classList.remove("btn-warning");
        setTanggalPengeluaranDefault();
    }
}

// HAPUS DATA
window.hapus = function(id, collection) {
    if (collection !== 'pesanan' && userRole !== 'admin') {
        alertOtorisasi('Hanya Admin yang dapat menghapus Data Master.');
        return;
    }
    if (collection === 'pesanan' && userRole !== 'admin' && userRole !== 'karyawan') {
        alertOtorisasi('Anda tidak diizinkan menghapus data pesanan.');
        return;
    }

    Swal.fire({ title: 'Hapus data ini?', icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Hapus' })
    .then((result) => { if (result.isConfirmed) db.collection(collection).doc(id).delete().then(() => Swal.fire('Terhapus!', 'Data berhasil dihapus.', 'success')); });
};

function logout() {
    Swal.fire({ title: 'Keluar?', text: "Anda harus login ulang nanti.", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', confirmButtonText: 'Ya, Logout!' })
    .then((result) => { if (result.isConfirmed) auth.signOut().then(() => window.location.href = "login.html"); });
}

// FUNGSI HARGA RENTANG DAN PERHITUNGAN
window.updateHargaRentang = function(prefix) {
    const layananId = document.getElementById(prefix + 'Layanan').value;
    const satuan = document.getElementById(prefix + 'Satuan').value;
    const rentangHargaInput = document.getElementById(prefix + 'RentangHarga');
    const hargaManualInput = document.getElementById(prefix + 'HargaManual');
    const kuantitasInput = document.getElementById(prefix + 'Kuantitas');
    const labelKuantitas = document.getElementById('labelKuantitas' + (prefix === 'edit' ? 'Edit' : ''));
    
    // --- LOGIKA KUANTITAS DINAMIS BARU ---
    if (satuan === 'kg') {
         kuantitasInput.setAttribute('min', 0.1);
         kuantitasInput.setAttribute('step', 'any'); 
         kuantitasInput.value = Math.max(0.1, parseFloat(kuantitasInput.value) || 0.1); 
    } else { // pcs
         kuantitasInput.setAttribute('min', 1);
         kuantitasInput.setAttribute('step', 1); 
         kuantitasInput.value = Math.max(1, parseInt(kuantitasInput.value) || 1); 
    }
    // --- AKHIR LOGIKA KUANTITAS DINAMIS ---


    if (!layananId || !daftarLayanan[layananId]) {
        rentangHargaInput.value = 'Rp. 0 - Rp. 0';
        hargaManualInput.value = 0;
        updateBiayaInput(prefix);
        return;
    }

    const dataLayanan = daftarLayanan[layananId];
    let min, max;
    let unitLabel;

    if (satuan === 'kg') {
        min = dataLayanan.harga_kg_min || 0;
        max = dataLayanan.harga_kg_max || 0;
        unitLabel = 'Berat (Kg)';
    } else { // satuan === 'pcs'
        min = dataLayanan.harga_pcs_min || 0;
        max = dataLayanan.harga_pcs_max || 0;
        unitLabel = 'Jumlah (Pcs)';
    }
    
    if(labelKuantitas) labelKuantitas.innerText = unitLabel;

    rentangHargaInput.value = `Rp. ${min.toLocaleString('id')} - Rp. ${max.toLocaleString('id')}`;
    
    if (parseInt(hargaManualInput.value) === 0 || hargaManualInput.value === "") {
        hargaManualInput.value = min;
    } else if (parseInt(hargaManualInput.value) < min || parseInt(hargaManualInput.value) > max) {
         hargaManualInput.value = min;
    }
    
    updateBiayaInput(prefix);
}

window.updateBiayaInput = function(prefix) {
    const layananId = document.getElementById(prefix + 'Layanan').value;
    const satuan = document.getElementById(prefix + 'Satuan').value;
    const kuantitas = parseFloat(document.getElementById(prefix + 'Kuantitas').value) || 0;
    const hargaManualInput = document.getElementById(prefix + 'HargaManual');
    const hargaManual = parseInt(hargaManualInput.value) || 0;
    const totalInputHidden = document.getElementById(prefix + 'Total');
    const totalInputDisplay = document.getElementById('dispTotalBiaya' + (prefix === 'edit' ? 'Edit' : ''));

    if (!layananId || kuantitas <= 0 || !daftarLayanan[layananId]) {
        totalInputDisplay.innerText = 'Rp. 0';
        totalInputHidden.value = 0;
        hargaManualInput.classList.remove('is-invalid'); 
        return;
    }

    const dataLayanan = daftarLayanan[layananId];
    let min, max;

    if (satuan === 'kg') {
        min = dataLayanan.harga_kg_min || 0;
        max = dataLayanan.harga_kg_max || 0;
    } else { 
        min = dataLayanan.harga_pcs_min || 0;
        max = dataLayanan.harga_pcs_max || 0;
    }
    
    // --- VALIDASI RENTANG HARGA ---
    if (hargaManual < min || hargaManual > max) {
        hargaManualInput.classList.add('is-invalid');
        totalInputDisplay.innerText = 'Rp. 0 (Invalid Harga)';
        totalInputHidden.value = 0;
        return; 
    } else {
        hargaManualInput.classList.remove('is-invalid');
    }
    // --- AKHIR VALIDASI RENTANG HARGA ---

    const totalBiaya = hargaManual * kuantitas;
    
    totalInputDisplay.innerText = 'Rp. ' + totalBiaya.toLocaleString('id');
    totalInputHidden.value = totalBiaya.toFixed(0);
}

// ==========================================
// 5. FUNGSI EKSPOR PDF & EXCEL
// ==========================================
window.exportToPdf = function() {
    if (userRole !== 'admin') { alertOtorisasi('Hanya Admin yang dapat melakukan Ekspor data.'); return; }
    
    const table = document.getElementById('pesananTable');
    if (!table) return;

    const head = [];
    const body = [];
    
    // Ambil header, kecuali kolom Aksi (index 9)
    const headerCells = table.querySelectorAll('thead th');
    headerCells.forEach((th, index) => {
        if (index !== 9) { // 9 adalah index kolom Aksi
            head.push(th.innerText);
        }
    });

    const dataRows = table.querySelectorAll('tbody tr');
    dataRows.forEach(row => {
        const rowData = [];
        const cells = row.querySelectorAll('td');
        
        // Ambil data sel, kecuali sel ke-9 (kolom Aksi)
        cells.forEach((cell, index) => {
            if (index !== 9) {
                 rowData.push(cell.innerText.trim());
            }
        });
        body.push(rowData);
    });

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('l', 'pt', 'a4'); 
    
    doc.autoTable({
        head: [head],
        body: body,
        startY: 40,
        styles: { font: 'Poppins', overflow: 'linebreak' },
        headStyles: { fillColor: [0, 106, 255] },
        theme: 'striped',
        didDrawPage: function (data) {
            doc.setFontSize(18);
            doc.text("Laporan Daftar Pesanan Laundry", data.settings.margin.left, 25);
        }
    });

    doc.save('Laporan_Pesanan_Laundry.pdf');
    Swal.fire({ icon: 'success', title: 'PDF Siap!', text: 'File telah diunduh.', timer: 1500, showConfirmButton: false });
}

window.exportToExcel = function() {
    if (userRole !== 'admin') { alertOtorisasi('Hanya Admin yang dapat melakukan Ekspor data.'); return; }
    
    const table = document.getElementById('pesananTable');
    if (!table) return;

    const ws = XLSX.utils.table_to_sheet(table);

    // Hapus Kolom Aksi (Kolom ke-10, index 9)
    if(ws['!cols']) {
        ws['!cols'].splice(9, 1);
    }
    
    // Hapus data sel di kolom ke-10 (index 9)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
        const C = 9; // Kolom ke-10 (Aksi)
        const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
        
        if (ws[cellAddress]) { 
            delete ws[cellAddress];
        }
    }
    
    range.e.c--; 
    ws['!ref'] = XLSX.utils.encode_range(range);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar Pesanan");
    XLSX.writeFile(wb, "Laporan_Pesanan_Laundry.xlsx");
    
    Swal.fire({ icon: 'success', title: 'Excel Siap!', text: 'File telah diunduh.', timer: 1500, showConfirmButton: false });
}