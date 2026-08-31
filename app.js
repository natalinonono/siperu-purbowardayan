/**
 * SIPERU PURBOWARDAYAN - Sistem Informasi Peminjaman Ruang Paroki SPMR Purbowardayan
 * Core JavaScript Logic & State Management
 */

// 1. DATA MASTER RUANGAN (Urutan Hierarki: Gedung Gereja -> Ruang Doa -> Pendopo -> Lantai 1 -> Lantai 2 -> Lantai 3)
const ROOMS_DATA = [
    { id: 11, room_name: "Gedung Gereja", location_floor: "Utama", description: "Ibadah Utama / Perayaan Besar", capacity: 2000 },
    { id: 10, room_name: "Ruang Doa", location_floor: "Lantai 1", description: "R. Doa / Adorasi Khusus", capacity: 20 },
    { id: 12, room_name: "Pendopo Darmoyuwana", location_floor: "Area Luar", description: "Kegiatan Terbuka / Acara Bersama", capacity: 50 },
    { id: 3, room_name: "Ruang Xaverius", location_floor: "Lantai 1", description: "Ruang Rapat", capacity: 20 },
    { id: 4, room_name: "Ruang Albertus", location_floor: "Lantai 1", description: "R. Pertemuan Besar", capacity: 500 },
    { id: 5, room_name: "Ruang Ignasius", location_floor: "Lantai 1", description: "R. Rapat Pengurus", capacity: 50 },
    { id: 6, room_name: "Ruang Yosep 1", location_floor: "Lantai 1", description: "R. Serbaguna Utama Lt. 1", capacity: 40 },
    { id: 1, room_name: "Ruang Fransiskus", location_floor: "Lantai 2", description: "R. Rapat / Pertemuan", capacity: 100 },
    { id: 2, room_name: "Ruang Robertus", location_floor: "Lantai 2", description: "Ruang Rapat", capacity: 20 },
    { id: 7, room_name: "Ruang Yosep 2", location_floor: "Lantai 2", description: "R. Serbaguna Utama Lt. 2", capacity: 40 },
    { id: 9, room_name: "Ruang Martha", location_floor: "Lantai 2", description: "R. Konsumsi / Pertemuan", capacity: 40 },
    { id: 8, room_name: "Ruang Yosep 3", location_floor: "Lantai 3", description: "R. Serbaguna Utama Lt. 3", capacity: 40 }
];

// 2. STATE APLIKASI
let bookings = [];
let currentUser = null; // null jika logout
let activeRole = 'PUBLIC'; // PUBLIC, USER, ADMIN
let currentCalendarDate = new Date(); // Hari ini (dinamis)
let currentCalendarView = 'month'; // month, week, day
let activeFilters = []; // Room IDs yang dicentang. Jika kosong, berarti tampilkan semua.

// Smart Data Protection & Merge Engine: Menjamin data booking tidak pernah hilang saat update/redeploy kode
function mergeBookingsData(primaryList, fallbackList) {
    if (!Array.isArray(primaryList)) primaryList = [];
    if (!Array.isArray(fallbackList)) fallbackList = [];

    const map = new Map();

    // 1. Masukkan data fallback lokal terlebih dahulu
    fallbackList.forEach(item => {
        if (item && item.id) map.set(item.id, item);
    });

    // 2. Timpa / gabungkan dengan data primer server (jika ada pembaruan status lebih baru)
    primaryList.forEach(item => {
        if (item && item.id) {
            const existing = map.get(item.id);
            if (!existing) {
                map.set(item.id, item);
            } else {
                // Pertahankan status yang paling mutakhir dan jangan hilangkan field penting
                map.set(item.id, {
                    ...existing,
                    ...item,
                    previous_version: item.previous_version || existing.previous_version || null,
                    revision_reason: item.revision_reason || existing.revision_reason || '',
                    cancellation_reason: item.cancellation_reason || existing.cancellation_reason || '',
                    photo_before_url: item.photo_before_url || existing.photo_before_url || '',
                    photo_after_url: item.photo_after_url || existing.photo_after_url || ''
                });
            }
        }
    });

    return Array.from(map.values());
}

// Foto Simulasi Default (Base64 Mocks untuk before/after agar tampilan langsung terlihat bagus)
const MOCK_DIRTY_PHOTO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='100%' height='100%' fill='%23f1f5f9'/><text x='50%27' y='45%27' font-family='sans-serif' font-size='16' fill='%23ef4444' text-anchor='middle' font-weight='bold'>MOCK FOTO: BEFORE-USE</text><text x='50%27' y='55%27' font-family='sans-serif' font-size='12' fill='%2364748b' text-anchor='middle'>Kursi berantakan %26 sisa kertas di meja</text><circle cx='100' cy='200' r='10' fill='%2394a3b8'/><circle cx='280' cy='180' r='15' fill='%2394a3b8'/><line x1='120' y1='220' x2='250' y2='220' stroke='%23475569' stroke-width='3'/></svg>";
const MOCK_CLEAN_PHOTO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300' viewBox='0 0 400 300'><rect width='100%' height='100%' fill='%23e6f4ea'/><text x='50%27' y='45%27' font-family='sans-serif' font-size='16' fill='%2310b981' text-anchor='middle' font-weight='bold'>MOCK FOTO: AFTER-USE</text><text x='50%27' y='55%27' font-family='sans-serif' font-size='12' fill='%23065f46' text-anchor='middle'>Ruangan bersih %26 kursi tertata rapi</text><line x1='50' y1='220' x2='350' y2='220' stroke='%2310b981' stroke-width='4'/><path d='M200 120 L210 140 L230 140 L215 155 L220 175 L200 160 L180 175 L185 155 L170 140 L190 140 Z' fill='%23eab308'/></svg>";

// 2b. WRAPPER AMAN & ENGINE RENDERING IKON (Lucide + Inline SVG Fallback)
function safeCreateIcons() {
    try {
        if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
            return;
        }
    } catch (e) {
        console.warn('Lucide CDN error, beralih ke inline SVG dictionary:', e);
    }

    // Fallback: render SVG langsung ke elemen [data-lucide]
    if (window.SVG_ICONS) {
        document.querySelectorAll('[data-lucide]').forEach(el => {
            const iconName = el.getAttribute('data-lucide');
            if (window.SVG_ICONS[iconName]) {
                el.innerHTML = window.SVG_ICONS[iconName];
                el.removeAttribute('data-lucide'); // cegah loop render
            }
        });
    }
}

// 2c. TEMA (LIGHT / DARK MODE)
let currentTheme = localStorage.getItem('spmr_theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('spmr_theme', theme);

    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        themeIcon.setAttribute('data-lucide', theme === 'dark' ? 'sun' : 'moon');
    }
    safeCreateIcons();
}

function toggleTheme() {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
}

// 2d. REAL-TIME SSE (SERVER-SENT EVENTS) & NOTIFICATION SYSTEM
let activeNotifFilter = 'all'; // 'all', 'unread', 'approved'

function getNotificationStorageKey() {
    if (activeRole === 'ADMIN') {
        return 'spmr_notifications_admin';
    } else if (currentUser && currentUser.email) {
        return `spmr_notifications_user_${currentUser.email}`;
    } else {
        return 'spmr_notifications_public';
    }
}

function getInitialNotifications(role, userEmail) {
    // Kosongkan notifikasi dummy bawaan agar tidak mengganggu pengguna
    return [];
}

function loadNotificationsForCurrentRole() {
    const key = getNotificationStorageKey();
    const stored = localStorage.getItem(key);
    if (stored) {
        try {
            return JSON.parse(stored);
        } catch (e) {
            console.error('Error parsing notifications JSON:', e);
        }
    }
    return [];
}

let notificationsList = loadNotificationsForCurrentRole();

function saveCurrentNotifications() {
    const key = getNotificationStorageKey();
    localStorage.setItem(key, JSON.stringify(notificationsList));
}

function initRealtimeSSE() {
    let sseActive = false;
    if (window.EventSource) {
        try {
            const eventSource = new EventSource('/api/events');

            eventSource.onopen = function () {
                sseActive = true;
                console.log('⚡ [SANCTUS Real-Time] SSE Stream connected successfully.');
            };

            eventSource.onmessage = function (event) {
                try {
                    const payload = JSON.parse(event.data);
                    if (payload.type === 'BOOKINGS_UPDATED') {
                        console.log('⚡ [SANCTUS Real-Time] Booking data updated instantly.');
                        const previousCount = bookings.length;
                        bookings = payload.data || [];
                        localStorage.setItem('spmr_cached_bookings', JSON.stringify(bookings));
                        
                        // Notifikasi berbeda tergantung peran
                        if (activeRole === 'ADMIN') {
                            if (bookings.length > previousCount) {
                                addNotification('Permohonan Baru (Admin)', 'Ada pengajuan peminjaman ruangan baru yang membutuhkan persetujuan Anda.', 'update', 'ADMIN');
                            } else {
                                addNotification('Data Sistem Diperbarui', 'Data kalender booking dan status persetujuan telah disinkronkan.', 'update', 'ADMIN');
                            }
                        } else if (activeRole === 'USER' && currentUser) {
                            const myLastBooking = bookings.filter(b => b.user_email === currentUser.email).sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
                            if (myLastBooking && myLastBooking.status === 'APPROVED') {
                                addNotification('Pengajuan Disetujui', `Permohonan "${myLastBooking.event_name}" telah disetujui oleh Admin.`, 'approved', 'USER', currentUser.email);
                            } else if (myLastBooking && myLastBooking.status === 'REJECTED') {
                                addNotification('Pengajuan Ditolak', `Permohonan "${myLastBooking.event_name}" ditolak oleh Admin: ${myLastBooking.rejection_reason || '-'}`, 'rejected', 'USER', currentUser.email);
                            } else {
                                addNotification('Jadwal Diperbarui', 'Jadwal kalender gereja telah diperbarui secara realtime.', 'update', 'USER', currentUser.email);
                            }
                        }
                        
                        // Re-render components
                        renderCalendar();
                        renderRoomFilters();
                        renderMyBookings();
                        renderAdminApprovals();
                    }
                } catch (err) {
                    console.error('Error parsing SSE event:', err);
                }
            };

            eventSource.onerror = function () {
                sseActive = false;
                console.warn('SSE connection disconnected. Polling fallback active...');
            };
        } catch (e) {
            console.warn('EventSource initialization failed:', e);
        }
    }

    // High-frequency Background Poll Fallback (setiap 3 detik) untuk sinkronisasi multi-device real-time
    setInterval(async () => {
        try {
            const res = await fetch('/api/bookings');
            if (res.ok) {
                const fresh = await res.json();
                
                // JIKA SERVER MENGEMBALIKAN KOSONG TAPI KITA PUNYA DATA LOKAL: SINKRONKAN DATA KITA KE SERVER
                if (Array.isArray(fresh) && fresh.length === 0 && bookings.length > 0) {
                    saveBookingsToStorage();
                    return;
                }

                if (Array.isArray(fresh) && fresh.length > 0) {
                    const merged = mergeBookingsData(fresh, bookings);
                    const mergedJson = JSON.stringify(merged);
                    const currentJson = JSON.stringify(bookings);
                    
                    if (mergedJson !== currentJson) {
                        const oldBookings = [...bookings];
                        const previousCount = oldBookings.length;
                        bookings = merged;
                        localStorage.setItem('spmr_cached_bookings', mergedJson);

                        // Deteksi jika ada booking baru dari device lain
                        if (bookings.length > previousCount) {
                            const newEntries = bookings.filter(b => !oldBookings.some(o => o.id === b.id));
                            newEntries.forEach(nb => {
                                const roomObj = ROOMS_DATA.find(r => r.id === nb.room_id);
                                const rName = roomObj ? roomObj.room_name : 'Ruangan';
                                
                                if (activeRole === 'ADMIN') {
                                    addNotification('Permohonan Baru (Admin)', `${nb.applicant || 'Jemaat'} mengajukan ${rName} untuk "${nb.event_name}".`, 'update', 'ADMIN');
                                }
                            });
                        } else {
                            // Deteksi perubahan status (misal approval / reject / revisi)
                            bookings.forEach(fb => {
                                const oldB = oldBookings.find(o => o.id === fb.id);
                                if (oldB && oldB.status !== fb.status) {
                                    if (activeRole === 'USER' && currentUser && fb.user_email === currentUser.email) {
                                        if (fb.status === 'APPROVED') {
                                            addNotification('Pengajuan Disetujui', `Permohonan "${fb.event_name}" telah disetujui oleh Admin.`, 'approved', 'USER', currentUser.email);
                                        } else if (fb.status === 'REJECTED') {
                                            addNotification('Pengajuan Ditolak', `Permohonan "${fb.event_name}" ditolak: ${fb.rejection_reason || '-'}`, 'rejected', 'USER', currentUser.email);
                                        }
                                    } else if (activeRole === 'ADMIN' && fb.status === 'REVISION') {
                                        addNotification('Permohonan Revisi', `Peminjaman "${fb.event_name}" telah direvisi oleh pemohon dan menunggu persetujuan ulang.`, 'update', 'ADMIN');
                                    }
                                }
                            });
                        }

                        renderCalendar();
                        renderRoomFilters();
                        renderMyBookings();
                        renderAdminApprovals();
                    }
                }
            }
        } catch (e) {}
    }, 3000);
}

function addNotification(title, desc, type = 'system', targetRole = 'ALL', targetUserEmail = '') {
    // Abaikan jika notifikasi bukan untuk role/user saat ini
    if (targetRole !== 'ALL' && targetRole !== activeRole) {
        // Simpan juga ke storage role target agar saat login/switch terlihat
        saveTargetNotificationToStorage(title, desc, type, targetRole, targetUserEmail);
        return;
    }
    if (targetRole === 'USER' && targetUserEmail && currentUser && currentUser.email !== targetUserEmail) {
        saveTargetNotificationToStorage(title, desc, type, targetRole, targetUserEmail);
        return;
    }

    const newNotif = {
        id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        type: type, // 'approved', 'rejected', 'update', 'reminder', 'system'
        targetRole: targetRole,
        targetUserEmail: targetUserEmail,
        title: title,
        desc: desc,
        time: 'Baru saja',
        timestamp: Date.now(),
        read: false
    };
    notificationsList.unshift(newNotif);
    saveCurrentNotifications();
    renderNotifications();
    showRealtimeToast(title, desc, type);
    playNotifSound();
}

function saveTargetNotificationToStorage(title, desc, type, targetRole, targetUserEmail) {
    let key = 'spmr_notifications_public';
    if (targetRole === 'ADMIN') {
        key = 'spmr_notifications_admin';
    } else if (targetUserEmail) {
        key = `spmr_notifications_user_${targetUserEmail}`;
    }
    
    let list = [];
    try {
        const raw = localStorage.getItem(key);
        list = raw ? JSON.parse(raw) : getInitialNotifications(targetRole, targetUserEmail);
    } catch (e) {
        list = [];
    }

    list.unshift({
        id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        type: type,
        targetRole: targetRole,
        targetUserEmail: targetUserEmail,
        title: title,
        desc: desc,
        time: 'Baru saja',
        timestamp: Date.now(),
        read: false
    });
    localStorage.setItem(key, JSON.stringify(list));
}

function showRealtimeToast(title, desc, type = 'system') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'realtime-toast';
    
    let iconName = 'bell';
    if (type === 'approved') iconName = 'check-circle';
    else if (type === 'rejected') iconName = 'x-circle';
    else if (type === 'update') iconName = 'refresh-cw';
    else if (type === 'reminder') iconName = 'camera';

    toast.innerHTML = `
        <div class="toast-icon">
            <i data-lucide="${iconName}"></i>
        </div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${desc}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i data-lucide="x" style="width:14px; height:14px;"></i>
        </button>
    `;

    container.appendChild(toast);
    safeCreateIcons();

    setTimeout(() => {
        if (toast.parentElement) toast.remove();
    }, 5000);
}

function playNotifSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.25);
    } catch(e) {
        // Abaikan jika browser memblokir autoplay audio
    }
}

function filterNotifications(tab) {
    activeNotifFilter = tab;
    document.querySelectorAll('.notif-tab').forEach(t => t.classList.remove('active'));
    const activeBtn = document.getElementById(`notif-tab-${tab}`);
    if (activeBtn) activeBtn.classList.add('active');
    renderNotifications();
}

function toggleNotifReadStatus(event, notifId) {
    if (event) event.stopPropagation();
    const item = notificationsList.find(n => n.id === notifId);
    if (item) {
        item.read = !item.read;
        saveCurrentNotifications();
        renderNotifications();
    }
}

function deleteNotification(event, notifId) {
    if (event) event.stopPropagation();
    notificationsList = notificationsList.filter(n => n.id !== notifId);
    saveCurrentNotifications();
    renderNotifications();
}

function markAllNotificationsRead() {
    notificationsList.forEach(n => { n.read = true; });
    saveCurrentNotifications();
    renderNotifications();
}

function clearAllNotifications() {
    if (notificationsList.length === 0) return;
    if (confirm("Apakah Anda yakin ingin menghapus semua riwayat notifikasi?")) {
        notificationsList = [];
        saveCurrentNotifications();
        renderNotifications();
    }
}

function renderNotifications() {
    const listEl = document.getElementById('notif-list-items');
    const badgeEl = document.getElementById('notif-badge');
    const unreadPill = document.getElementById('notif-unread-pill');
    if (!listEl) return;

    listEl.innerHTML = '';
    const unreadCount = notificationsList.filter(n => !n.read).length;

    if (badgeEl) {
        badgeEl.textContent = unreadCount;
        if (unreadCount === 0) {
            badgeEl.classList.add('hidden');
        } else {
            badgeEl.classList.remove('hidden');
        }
    }

    if (unreadPill) {
        unreadPill.textContent = `${unreadCount} Baru`;
    }

    // Filter daftar sesuai activeNotifFilter
    let filtered = notificationsList;
    if (activeNotifFilter === 'unread') {
        filtered = notificationsList.filter(n => !n.read);
    } else if (activeNotifFilter === 'approved') {
        filtered = notificationsList.filter(n => n.type === 'approved' || n.title.toLowerCase().includes('setuju'));
    }

    if (filtered.length === 0) {
        listEl.innerHTML = `
            <div style="padding:28px 16px; text-align:center; color:var(--text-muted);">
                <i data-lucide="bell-off" style="width:28px; height:28px; margin:0 auto 8px auto; opacity:0.4; display:block;"></i>
                <p style="font-size:0.78rem; font-weight:600; margin-bottom:2px;">Tidak Ada Notifikasi</p>
                <p style="font-size:0.7rem; color:var(--text-light); margin:0;">${activeNotifFilter === 'unread' ? 'Semua notifikasi sudah dibaca.' : 'Belum ada notifikasi terkini.'}</p>
            </div>
        `;
        safeCreateIcons();
        return;
    }

    filtered.forEach(n => {
        const item = document.createElement('div');
        item.className = `notif-item ${n.read ? '' : 'unread'}`;
        
        let iconName = 'bell';
        let iconClass = 'system';
        if (n.type === 'approved' || n.title.toLowerCase().includes('setuju')) {
            iconName = 'check-circle';
            iconClass = 'approved';
        } else if (n.type === 'rejected' || n.title.toLowerCase().includes('tolak')) {
            iconName = 'x-circle';
            iconClass = 'rejected';
        } else if (n.type === 'reminder' || n.title.toLowerCase().includes('foto')) {
            iconName = 'camera';
            iconClass = 'reminder';
        } else if (n.type === 'update') {
            iconName = 'refresh-cw';
            iconClass = 'update';
        }

        item.innerHTML = `
            <div class="notif-icon-box ${iconClass}">
                <i data-lucide="${iconName}"></i>
            </div>
            <div class="notif-content">
                <div class="notif-header-row">
                    <span class="notif-title">${n.title}</span>
                    <span class="notif-time">${n.time}</span>
                </div>
                <p class="notif-desc">${n.desc}</p>
                <div class="notif-actions-inline">
                    <button class="btn-notif-read-toggle" onclick="toggleNotifReadStatus(event, '${n.id}')" title="Ubah status baca">
                        <i data-lucide="${n.read ? 'circle' : 'check'}" style="width:11px; height:11px;"></i>
                        ${n.read ? 'Tandai Belum Dibaca' : 'Tandai Telah Dibaca'}
                    </button>
                    <button class="btn-notif-delete" onclick="deleteNotification(event, '${n.id}')" title="Hapus Notifikasi Ini">
                        <i data-lucide="trash" style="width:11px; height:11px;"></i>
                    </button>
                </div>
            </div>
        `;
        listEl.appendChild(item);
    });

    safeCreateIcons();
}

// 3. INISIALISASI DATA
async function initApp() {
    // Terapkan tema yang tersimpan
    applyTheme(currentTheme);

    // Bersihkan cache notifikasi mentah/dummy lama yang pernah tersimpan di browser
    const legacyKeys = [
        'spmr_notifications',
        'spmr_notifications_admin',
        'spmr_notifications_public',
        'spmr_notifications_user_jemaat.aktif@gmail.com'
    ];
    legacyKeys.forEach(k => {
        const item = localStorage.getItem(k);
        if (item && (item.includes('OMK') || item.includes('notif-1') || item.includes('notif-admin-1'))) {
            localStorage.removeItem(k);
        }
    });

    // Bersihkan data dummy demo 'Latihan Koor & Rapat OMK' / 'b_demo_1' secara permanen jika masih ada di browser
    const cachedBookingsRaw = localStorage.getItem('spmr_cached_bookings');
    if (cachedBookingsRaw && cachedBookingsRaw.includes('b_demo_1')) {
        let cleanBookings = JSON.parse(cachedBookingsRaw).filter(b => b.id !== 'b_demo_1');
        localStorage.setItem('spmr_cached_bookings', JSON.stringify(cleanBookings));
    }

    // Inisialisasi Real-Time Notifikasi & SSE
    notificationsList = loadNotificationsForCurrentRole();
    renderNotifications();
    initRealtimeSSE();

    // 3a. Ambil data dari server API dengan perlindungan anti-hilang / anti-corrupt (Smart Merge & Auto-Backup)
    try {
        const response = await fetch('/api/bookings');
        if (response.ok) {
            let serverBookings = await response.json();
            if (Array.isArray(serverBookings)) {
                serverBookings = serverBookings.filter(b => b.id !== 'b_demo_1');
            }
            
            let localCachedRaw = localStorage.getItem('spmr_cached_bookings');
            let localCached = localCachedRaw ? JSON.parse(localCachedRaw) : [];
            localCached = localCached.filter(b => b.id !== 'b_demo_1');

            // Gabungkan data server dan cache lokal secara cerdas
            if (Array.isArray(serverBookings) && serverBookings.length > 0) {
                bookings = mergeBookingsData(serverBookings, localCached).filter(b => b.id !== 'b_demo_1');
            } else if (localCached && localCached.length > 0) {
                bookings = localCached.filter(b => b.id !== 'b_demo_1');
                saveBookingsToStorage();
            } else {
                bookings = [];
            }

            // Simpan backup permanen di localStorage
            localStorage.setItem('spmr_cached_bookings', JSON.stringify(bookings));
            localStorage.setItem('spmr_bookings_backup_' + new Date().toISOString().split('T')[0], JSON.stringify(bookings));
        } else {
            const cached = localStorage.getItem('spmr_cached_bookings');
            bookings = cached ? JSON.parse(cached) : [];
        }
    } catch (err) {
        console.warn("Server API tidak terjangkau, memuat data dari offline storage aman:", err);
        const cached = localStorage.getItem('spmr_cached_bookings');
        bookings = cached ? JSON.parse(cached) : [];
    }

    // 3b. Setup Filters Ruangan di Sidebar & Dropdown Tahun
    populateCalendarYearDropdown();
    renderRoomFilters();
    populateRoomSelectDropdowns();

    // 3c. Deteksi sesi login aktif
    const storedUser = localStorage.getItem('spmr_user');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        activeRole = currentUser.role;
        updateRoleSelectorActiveBtn();
    } else {
        activeRole = 'PUBLIC';
    }

    // 3d. Terapkan akses visibilitas menu sesuai peran
    applyRoleAccessControl();

    // 3e. Render Kalender Utama
    renderCalendar();

    // 3f. Inisialisasi Ikon Lucide
    safeCreateIcons();

    // Set default tanggal pencari ketersediaan ke hari ini
    const dateInput = document.getElementById('avail-check-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
}

async function saveBookingsToStorage() {
    // Simpan ke localStorage terlebih dahulu untuk jaminan offline & instant feedback
    try {
        localStorage.setItem('spmr_cached_bookings', JSON.stringify(bookings));
    } catch (e) {
        console.warn("Gagal menyimpan ke localStorage:", e);
    }

    try {
        await fetch('/api/bookings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(bookings)
        });
    } catch (err) {
        console.error("Gagal menyimpan data ke server API:", err);
    }
}

// 4. ROLE & ACCESSIBILITY CONTROLS
function switchRole(role) {
    activeRole = role;

    if (role === 'PUBLIC') {
        currentUser = null;
        localStorage.removeItem('spmr_user');
    } else if (role === 'USER') {
        currentUser = {
            id: 'u_jemaat',
            name: 'Ignatius Budi',
            email: 'jemaat.aktif@gmail.com',
            role: 'USER',
            photo_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=FX1'
        };
        localStorage.setItem('spmr_user', JSON.stringify(currentUser));
    } else if (role === 'ADMIN') {
        currentUser = {
            id: 'u_admin',
            name: 'Bapak FX. Hardi (Admin)',
            email: 'admin.purbowardayan@gereja.id',
            role: 'ADMIN',
            photo_url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=Admin'
        };
        localStorage.setItem('spmr_user', JSON.stringify(currentUser));
    }

    // Muat daftar notifikasi independen milik peran/user aktif
    notificationsList = loadNotificationsForCurrentRole();
    renderNotifications();

    updateRoleSelectorActiveBtn();
    applyRoleAccessControl();

    // Kembalikan ke tab Kalender default agar aman
    switchTab('calendar-section');
    renderCalendar();

    // Re-render dashboard tab jika terbuka
    renderMyBookings();
    renderAdminApprovals();
    renderAuditGallery();
}

function updateRoleSelectorActiveBtn() {
    const btnPub = document.getElementById('btn-role-public');
    const btnUsr = document.getElementById('btn-role-user');
    const btnAdm = document.getElementById('btn-role-admin');
    
    if (btnPub) btnPub.classList.remove('active');
    if (btnUsr) btnUsr.classList.remove('active');
    if (btnAdm) btnAdm.classList.remove('active');

    if (activeRole === 'PUBLIC' && btnPub) {
        btnPub.classList.add('active');
    } else if (activeRole === 'USER' && btnUsr) {
        btnUsr.classList.add('active');
    } else if (activeRole === 'ADMIN' && btnAdm) {
        btnAdm.classList.add('active');
    }
}

function applyRoleAccessControl() {
    // Tampilkan / sembunyikan tombol otentikasi
    const loggedOutDiv = document.getElementById('auth-logged-out');
    const loggedInDiv = document.getElementById('auth-logged-in');

    if (currentUser) {
        loggedOutDiv.classList.add('hidden');
        loggedInDiv.classList.remove('hidden');

        document.getElementById('user-avatar').src = currentUser.photo_url;
        document.getElementById('user-display-name').textContent = currentUser.name;
        document.getElementById('user-role-badge').textContent = currentUser.role;

        if (currentUser.role === 'ADMIN') {
            document.getElementById('user-role-badge').style.background = '#d97706'; // Gold
        } else {
            document.getElementById('user-role-badge').style.background = '#3b82f6'; // Blue
        }
    } else {
        loggedOutDiv.classList.remove('hidden');
        loggedInDiv.classList.add('hidden');
    }

    // Filter visibilitas Navigasi Tab
    const userOnlyNavs = document.querySelectorAll('.user-only');
    const adminOnlyNavs = document.querySelectorAll('.admin-only');

    if (activeRole === 'PUBLIC') {
        userOnlyNavs.forEach(el => el.classList.add('hidden'));
        adminOnlyNavs.forEach(el => el.classList.add('hidden'));
    } else if (activeRole === 'USER') {
        // Tampilkan semua elemen user-only
        userOnlyNavs.forEach(el => el.classList.remove('hidden'));
        // Sembunyikan hanya elemen yang MURNI admin-only (tidak punya class user-only juga)
        // Elemen dengan KEDUA class (user-only + admin-only) tetap tampil untuk USER
        adminOnlyNavs.forEach(el => {
            if (!el.classList.contains('user-only')) {
                el.classList.add('hidden');
            }
        });
    } else if (activeRole === 'ADMIN') {
        userOnlyNavs.forEach(el => el.classList.remove('hidden'));
        adminOnlyNavs.forEach(el => el.classList.remove('hidden'));
    }

    // Refresh icons
    safeCreateIcons();
}

// Navigasi Tab SPA
function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(section => {
        section.classList.add('hidden');
        section.classList.remove('active');
    });

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
    });

    const activeSection = document.getElementById(tabId);
    if (activeSection) {
        activeSection.classList.remove('hidden');
        activeSection.classList.add('active');
    }

    // Tambah kelas active ke tombol nav
    if (tabId === 'calendar-section') {
        document.getElementById('tab-calendar-btn').classList.add('active');
        renderCalendar();
    } else if (tabId === 'my-bookings-section') {
        document.getElementById('tab-my-bookings-btn').classList.add('active');
        renderMyBookings();
    } else if (tabId === 'admin-dashboard-section') {
        document.getElementById('tab-admin-dashboard-btn').classList.add('active');
        renderAdminApprovals();
    } else if (tabId === 'admin-audit-section') {
        document.getElementById('tab-admin-audit-btn').classList.add('active');
        renderAuditGallery();
    }
}

// 5. GOOGLE IDENTITY SERVICES (GSI) & SSO LOGIN INTEGRATION
function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        console.error('Error parsing Google JWT Token:', e);
        return null;
    }
}

// Helper: Cek apakah email berhak atas role ADMIN
function checkIsAdminRole(email) {
    if (!email) return false;
    const clean = email.toLowerCase().trim();
    // Otomatis ADMIN jika:
    // 1. Berakhiran @gereja.id
    // 2. Mengandung kata admin (admin, admin1, admin2, admin.spmr, admin_gereja, dsb) sebelum atau sesudah domain
    return clean.endsWith('@gereja.id') || clean.includes('admin');
}

// Callback otomatis dari Google Identity Services SDK
function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;

    const payload = parseJwt(response.credential);
    if (!payload || !payload.email) {
        alert("Gagal membaca profil dari Akun Google.");
        return;
    }

    const email = payload.email.toLowerCase();
    const name = payload.name || payload.email.split('@')[0];
    const photo = payload.picture || `https://api.dicebear.com/7.x/adventurer/svg?seed=${name}`;
    const isAdmin = checkIsAdminRole(email);

    currentUser = {
        id: payload.sub || 'u_' + Date.now(),
        name: name,
        email: email,
        role: isAdmin ? 'ADMIN' : 'USER',
        photo_url: photo
    };

    localStorage.setItem('spmr_user', JSON.stringify(currentUser));
    activeRole = currentUser.role;

    // Muat notifikasi spesifik akun Google ini
    notificationsList = loadNotificationsForCurrentRole();
    renderNotifications();

    updateRoleSelectorActiveBtn();
    applyRoleAccessControl();
    closeModal('login-modal');
    switchTab('calendar-section');

    addNotification('Login Berhasil', `Selamat datang kembali, ${name}! (${currentUser.role})`, 'system', currentUser.role, currentUser.email);
}

function triggerGoogleOneTapLogin() {
    // Coba minta email akun Google langsung melalui prompt yang ramah
    const emailInput = document.getElementById('custom-email');
    const existingVal = emailInput ? emailInput.value.trim() : '';
    
    if (existingVal) {
        simulateCustomLogin();
        return;
    }

    const email = prompt("Masukkan alamat email Akun Google Anda untuk masuk:", "jemaat@gmail.com");
    if (email && email.trim()) {
        if (emailInput) emailInput.value = email.trim();
        simulateCustomLogin();
    }
}

function openLoginModal() {
    document.getElementById('login-modal').classList.remove('hidden');
    if (window.google && window.google.accounts && window.google.accounts.id) {
        try {
            window.google.accounts.id.renderButton(
                document.querySelector('.g_id_signin'),
                { theme: 'outline', size: 'large', width: 280 }
            );
        } catch(e) {}
    }
}

function simulateLogin(type) {
    if (type === 'peminjam') {
        switchRole('USER');
    } else if (type === 'admin') {
        switchRole('ADMIN');
    }
    closeModal('login-modal');
}

function simulateCustomLogin() {
    const emailInput = document.getElementById('custom-email').value.trim();
    if (!emailInput) {
        alert("Masukkan email terlebih dahulu!");
        return;
    }

    // Deteksi admin: mengandung 'admin' (misal admin1@gmail.com) atau @gereja.id
    const isAdmin = checkIsAdminRole(emailInput);
    const namePart = emailInput.split('@')[0];
    const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);

    currentUser = {
        id: 'u_' + Date.now(),
        name: formattedName,
        email: emailInput,
        role: isAdmin ? 'ADMIN' : 'USER',
        photo_url: `https://api.dicebear.com/7.x/adventurer/svg?seed=${namePart}`
    };

    localStorage.setItem('spmr_user', JSON.stringify(currentUser));
    activeRole = currentUser.role;

    notificationsList = loadNotificationsForCurrentRole();
    renderNotifications();

    updateRoleSelectorActiveBtn();
    applyRoleAccessControl();
    closeModal('login-modal');
    switchTab('calendar-section');

    addNotification('Login Berhasil', `Selamat datang, ${formattedName}! (${currentUser.role})`, 'system', currentUser.role, currentUser.email);
}

function logout() {
    currentUser = null;
    activeRole = 'PUBLIC';
    localStorage.removeItem('spmr_user');
    
    notificationsList = loadNotificationsForCurrentRole();
    renderNotifications();

    updateRoleSelectorActiveBtn();
    applyRoleAccessControl();
    switchTab('calendar-section');

    if (window.google && window.google.accounts && window.google.accounts.id) {
        window.google.accounts.id.disableAutoSelect();
    }
}

// 6. RENDER SIDEBAR FILTERS & OPTION DROPDOWNS
// REVISI 3: Tampilkan status ketersediaan ruangan (hijau = tersedia, merah = terisi hari ini)
function getRoomAvailabilityToday(roomId) {
    const todayStr = new Date().toISOString().split('T')[0];
    const busyBookings = bookings.filter(b => {
        return parseInt(b.room_id) === parseInt(roomId)
            && b.start_time.split('T')[0] === todayStr
            && (b.status === 'APPROVED' || b.status === 'PENDING' || b.status === 'REVISION');
    });
    if (busyBookings.length === 0) return 'available';
    // Cek apakah ada yang APPROVED (berarti sudah dikunci)
    const hasApproved = busyBookings.some(b => b.status === 'APPROVED');
    return hasApproved ? 'busy' : 'pending';
}

function getRoomAvailabilityOnDate(roomId, dateStr) {
    const busyBookings = bookings.filter(b => {
        return parseInt(b.room_id) === parseInt(roomId)
            && b.start_time.split('T')[0] === dateStr
            && (b.status === 'APPROVED' || b.status === 'PENDING' || b.status === 'REVISION');
    });
    if (busyBookings.length === 0) return 'available';
    const hasApproved = busyBookings.some(b => b.status === 'APPROVED');
    return hasApproved ? 'busy' : 'pending';
}

let currentRoomCategory = 'all';
let currentRoomSearchQuery = '';

function setRoomCategory(cat) {
    currentRoomCategory = cat;
    document.querySelectorAll('.cat-pill').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderRoomFilters();
}

function filterRoomList() {
    const input = document.getElementById('room-search-input');
    currentRoomSearchQuery = (input ? input.value : '').toLowerCase().trim();
    renderRoomFilters();
}

function updateResetFilterBtnState() {
    const btn = document.getElementById('btn-reset-filter');
    if (!btn) return;
    if (activeFilters.length > 0 || currentRoomCategory !== 'all' || currentRoomSearchQuery !== '') {
        btn.removeAttribute('disabled');
    } else {
        btn.setAttribute('disabled', 'true');
    }
}

function renderRoomFilters() {
    const container = document.getElementById('room-filters-container');
    container.innerHTML = '';

    const availInput = document.getElementById('avail-check-date');
    const viewDateStr = (availInput && availInput.value) || new Date().toISOString().split('T')[0];

    // Filter daftar ruangan berdasarkan pencarian dan kategori
    let displayedRooms = ROOMS_DATA.filter(room => {
        // Search filter
        if (currentRoomSearchQuery && !room.room_name.toLowerCase().includes(currentRoomSearchQuery)) {
            return false;
        }
        // Category filter
        if (currentRoomCategory === 'indoor') {
            return !room.room_name.toLowerCase().includes('pendopo') && !room.room_name.toLowerCase().includes('lapangan');
        } else if (currentRoomCategory === 'outdoor') {
            return room.room_name.toLowerCase().includes('pendopo') || room.room_name.toLowerCase().includes('lapangan');
        } else if (currentRoomCategory === 'large') {
            return room.capacity >= 100;
        }
        return true;
    });

    if (displayedRooms.length === 0) {
        container.innerHTML = '<p class="text-xs text-muted" style="padding:10px 0;">Tidak ada ruangan yang cocok.</p>';
        updateResetFilterBtnState();
        return;
    }

    displayedRooms.forEach(room => {
        const availability = getRoomAvailabilityOnDate(room.id, viewDateStr);
        const dotColor = availability === 'available' ? '#10B981'
                        : availability === 'pending'   ? '#F59E0B'
                        : '#EF4444';
        const dotTitle = availability === 'available' ? 'Tersedia pada tanggal ini'
                        : availability === 'pending'   ? 'Ada pengajuan menunggu verifikasi'
                        : 'Terisi / Bentrok pada tanggal ini';

        const item = document.createElement('div');
        item.className = 'room-filter-item';
        item.innerHTML = `
            <input type="checkbox" id="filter-room-${room.id}" value="${room.id}" onchange="toggleRoomFilter(${room.id})">
            <div class="room-info-label">
                <div class="room-name-row">
                    <span class="room-name">${room.room_name}</span>
                    <span class="room-avail-dot" style="background:${dotColor}; box-shadow: 0 0 6px ${dotColor}88;" title="${dotTitle}"></span>
                    <span class="room-cap-badge">${room.capacity} org</span>
                </div>
                <span class="room-desc">${room.location_floor}</span>
            </div>
        `;
        container.appendChild(item);
        const cb = document.getElementById(`filter-room-${room.id}`);
        if (cb && activeFilters.includes(room.id)) cb.checked = true;
    });

    updateResetFilterBtnState();
}

function populateRoomSelectDropdowns() {
    const bookingRoomSelect = document.getElementById('booking-room-id');
    const auditRoomSelect = document.getElementById('audit-room-filter');

    if (bookingRoomSelect) {
        bookingRoomSelect.innerHTML = '<option value="" disabled selected>Pilih Ruangan</option>';
        ROOMS_DATA.forEach(room => {
            const bOpt = document.createElement('option');
            bOpt.value = room.id;
            bOpt.textContent = `${room.room_name} (Kapasitas: ${room.capacity} org - ${room.location_floor})`;
            bookingRoomSelect.appendChild(bOpt);
        });
    }

    if (auditRoomSelect) {
        auditRoomSelect.innerHTML = '<option value="all">Semua Ruangan</option>';
        ROOMS_DATA.forEach(room => {
            const aOpt = document.createElement('option');
            aOpt.value = room.id;
            aOpt.textContent = room.room_name;
            auditRoomSelect.appendChild(aOpt);
        });
    }
}

function toggleRoomFilter(roomId) {
    const id = parseInt(roomId);
    const index = activeFilters.indexOf(id);
    if (index > -1) {
        activeFilters.splice(index, 1);
    } else {
        activeFilters.push(id);
    }
    renderCalendar();
    updateResetFilterBtnState();
}

function clearRoomFilters() {
    activeFilters = [];
    currentRoomCategory = 'all';
    currentRoomSearchQuery = '';
    
    const searchInput = document.getElementById('room-search-input');
    if (searchInput) searchInput.value = '';

    document.querySelectorAll('.cat-pill').forEach((btn, idx) => {
        if (idx === 0) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    ROOMS_DATA.forEach(room => {
        const cb = document.getElementById(`filter-room-${room.id}`);
        if (cb) cb.checked = false;
    });

    renderCalendar();
    renderRoomFilters();
    updateResetFilterBtnState();
}

function refreshFilterAvailability() {
    renderRoomFilters();
}

// Quick Preset Date Buttons (Bagian 4.1 - Hari Ini, Akhir Pekan, Minggu Depan, Bulan Ini, Bulan Depan, Tahun Depan)
function setCalendarQuickDate(type) {
    const today = new Date();
    if (type === 'today') {
        currentCalendarDate = new Date(today);
        const availInput = document.getElementById('avail-check-date');
        if (availInput) availInput.value = today.toISOString().split('T')[0];
    } else if (type === 'weekend') {
        const d = new Date(today);
        const day = d.getDay();
        const diffToSaturday = day === 6 ? 0 : 6 - day;
        d.setDate(d.getDate() + diffToSaturday);
        currentCalendarDate = new Date(d);
        const availInput = document.getElementById('avail-check-date');
        if (availInput) availInput.value = d.toISOString().split('T')[0];
    } else if (type === 'next_week') {
        const d = new Date(today);
        d.setDate(d.getDate() + 7);
        currentCalendarDate = new Date(d);
        const availInput = document.getElementById('avail-check-date');
        if (availInput) availInput.value = d.toISOString().split('T')[0];
    } else if (type === 'month') {
        currentCalendarDate = new Date(today.getFullYear(), today.getMonth(), 1);
        const availInput = document.getElementById('avail-check-date');
        if (availInput) availInput.value = today.toISOString().split('T')[0];
    } else if (type === 'next_month') {
        currentCalendarDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
        const availInput = document.getElementById('avail-check-date');
        if (availInput) availInput.value = currentCalendarDate.toISOString().split('T')[0];
    } else if (type === 'next_year') {
        currentCalendarDate = new Date(today.getFullYear() + 1, today.getMonth(), 1);
        const availInput = document.getElementById('avail-check-date');
        if (availInput) availInput.value = currentCalendarDate.toISOString().split('T')[0];
    }
    renderCalendar('calendarTransition');
    renderRoomFilters();
}

// 7. KALENDER INTERAKTIF (Engine Calendar)
function navigateCalendar(direction) {
    if (currentCalendarView === 'month' || currentCalendarView === 'agenda') {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    } else if (currentCalendarView === 'week') {
        currentCalendarDate.setDate(currentCalendarDate.getDate() + (direction * 7));
    } else if (currentCalendarView === 'day') {
        currentCalendarDate.setDate(currentCalendarDate.getDate() + direction);
    }
    renderCalendar(direction > 0 ? 'slide-next' : 'slide-prev');
}

function goToday() {
    currentCalendarDate = new Date();
    renderCalendar('calendarTransition');
}

function changeCalendarView(viewType) {
    currentCalendarView = viewType;
    document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(`view-${viewType}`);
    if (btn) btn.classList.add('active');
    renderCalendar('calendarTransition');
}

// Helper Inisialisasi Dropdown Tahun (Mulai dari 2026 s/d 10 tahun ke depan: 2036)
function populateCalendarYearDropdown() {
    const yearSelect = document.getElementById('calendar-year-select');
    if (!yearSelect) return;

    const startYear = 2026;
    const endYear = 2036;

    yearSelect.innerHTML = '';
    for (let y = startYear; y <= endYear; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = `Tahun ${y}`;
        yearSelect.appendChild(opt);
    }
}

function jumpCalendarMonthYear() {
    const monthSelect = document.getElementById('calendar-month-select');
    const yearSelect = document.getElementById('calendar-year-select');
    if (!monthSelect || !yearSelect) return;

    const selMonth = parseInt(monthSelect.value);
    const selYear = parseInt(yearSelect.value);

    currentCalendarDate.setFullYear(selYear);
    currentCalendarDate.setMonth(selMonth);

    renderCalendar('calendarTransition');
    renderRoomFilters();
}

function renderCalendar(animClass = '') {
    const titleEl = document.getElementById('calendar-title');
    const wrapper = document.getElementById('calendar-grid-wrapper');
    
    // Reset dan pasang animasi
    wrapper.className = 'calendar-grid-container' + (animClass ? ' ' + animClass : '');
    wrapper.innerHTML = '';

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    const minDate = new Date(2026, 0, 1); // Mulai dari 1 Januari 2026
    const maxDate = new Date(2036, 11, 31); // 10 tahun ke depan (31 Desember 2036)

    if (currentCalendarDate < minDate) currentCalendarDate = new Date(minDate);
    if (currentCalendarDate > maxDate) currentCalendarDate = new Date(maxDate);

    // Sinkronkan nilai dropdown bulan dan tahun
    const monthSelect = document.getElementById('calendar-month-select');
    const yearSelect = document.getElementById('calendar-year-select');
    if (monthSelect) monthSelect.value = month;
    if (yearSelect) {
        if (yearSelect.options.length === 0) populateCalendarYearDropdown();
        yearSelect.value = year;
    }

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

    if (currentCalendarView === 'month') {
        if (titleEl) titleEl.textContent = `${monthNames[month]} ${year}`;
        renderMonthGrid(wrapper, year, month);
    } else if (currentCalendarView === 'week') {
        const startOfWeek = getStartOfWeek(currentCalendarDate);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        if (titleEl) titleEl.textContent = `${startOfWeek.getDate()} ${monthNames[startOfWeek.getMonth()]} - ${endOfWeek.getDate()} ${monthNames[endOfWeek.getMonth()]} ${year}`;
        renderWeekGrid(wrapper, startOfWeek);
    } else if (currentCalendarView === 'day') {
        if (titleEl) titleEl.textContent = `${currentCalendarDate.getDate()} ${monthNames[month]} ${year}`;
        renderDayGrid(wrapper, currentCalendarDate);
    } else if (currentCalendarView === 'agenda') {
        if (titleEl) titleEl.textContent = `Agenda: ${monthNames[month]} ${year}`;
        renderAgendaGrid(wrapper, year, month);
    }
}

function getStartOfWeek(date) {
    const temp = new Date(date);
    const day = temp.getDay();
    const diff = temp.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(temp.setDate(diff));
}

// 7a. View Bulanan
function renderMonthGrid(wrapper, year, month) {
    wrapper.classList.add('calendar-grid-month');

    // Header Hari (Senin - Minggu)
    const daysOfWeek = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
    daysOfWeek.forEach(day => {
        const header = document.createElement('div');
        header.className = 'calendar-header-day';
        header.textContent = day;
        wrapper.appendChild(header);
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

    const totalDays = new Date(year, month + 1, 0).getDate();
    const totalDaysPrev = new Date(year, month, 0).getDate();

    // Render sel dari bulan sebelumnya (padding)
    for (let i = offset - 1; i >= 0; i--) {
        const dayNum = totalDaysPrev - i;
        const cell = document.createElement('div');
        cell.className = 'calendar-cell other-month';
        cell.innerHTML = `<span class="day-number">${dayNum}</span>`;
        wrapper.appendChild(cell);
    }

    // Render hari bulan ini
    const _todayNow = new Date();
    for (let day = 1; day <= totalDays; day++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell';

        if (year === _todayNow.getFullYear() && month === _todayNow.getMonth() && day === _todayNow.getDate()) {
            cell.classList.add('today');
        }

        const cellDateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        cell.innerHTML = `<span class="day-number">${day}</span>`;

        cell.onclick = () => {
            if (currentUser) {
                openBookingModal('', cellDateString);
            }
        };

        const dayBookings = bookings.filter(b => {
            // Sembunyikan event CANCELLED dari seluruh kalender
            if (b.status === 'CANCELLED') return false;
            // Untuk pengunjung Publik (tanpa login), hanya tampilkan yang APPROVED dan PENDING
            if (activeRole === 'PUBLIC' && !['APPROVED', 'PENDING'].includes(b.status)) return false;
            if (activeFilters.length > 0 && !activeFilters.includes(b.room_id)) return false;
            const bookingDate = b.start_time.split('T')[0];
            return bookingDate === cellDateString;
        });

        dayBookings.sort((a, b) => a.start_time.localeCompare(b.start_time));

        dayBookings.forEach(booking => {
            const evCard = document.createElement('div');
            const statusClass = booking.status.toLowerCase();
            evCard.className = `event-card ${statusClass}`;

            const roomObj = ROOMS_DATA.find(r => r.id === booking.room_id);
            const rName = roomObj ? roomObj.room_name : 'Ruangan';

            const startTimeStr = booking.start_time.split('T')[1];
            const endTimeStr = booking.end_time.split('T')[1];

            evCard.textContent = `[${startTimeStr}] ${booking.event_name} (${rName})`;
            
            // Hover Tooltip popover
            evCard.onmouseenter = (e) => showEventTooltip(e, booking, rName, startTimeStr, endTimeStr);
            evCard.onmouseleave = () => hideEventTooltip();

            evCard.onclick = (e) => {
                e.stopPropagation();
                openDetailModal(booking.id);
            };

            cell.appendChild(evCard);
        });

        wrapper.appendChild(cell);
    }

    // Sisa grid agar pas genap barisnya (kelipatan 7)
    const totalCells = offset + totalDays;
    const remaining = totalCells % 7 === 0 ? 0 : 7 - (totalCells % 7);
    for (let i = 1; i <= remaining; i++) {
        const cell = document.createElement('div');
        cell.className = 'calendar-cell other-month';
        cell.innerHTML = `<span class="day-number">${i}</span>`;
        wrapper.appendChild(cell);
    }
}

// 7c. Agenda View (Bagian 3.4)
function renderAgendaGrid(wrapper, year, month) {
    const container = document.createElement('div');
    container.className = 'agenda-view-container';

    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthBookings = bookings.filter(b => {
        if (b.status === 'CANCELLED') return false;
        if (activeRole === 'PUBLIC' && !['APPROVED', 'PENDING'].includes(b.status)) return false;
        if (activeFilters.length > 0 && !activeFilters.includes(b.room_id)) return false;
        return b.start_time.startsWith(monthStr);
    });

    if (monthBookings.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="calendar"></i>
                <p>Tidak ada kegiatan terjadwal untuk bulan ini.</p>
            </div>
        `;
        wrapper.appendChild(container);
        safeCreateIcons();
        return;
    }

    monthBookings.sort((a, b) => a.start_time.localeCompare(b.start_time));

    // Kelompokkan per tanggal
    const grouped = {};
    monthBookings.forEach(b => {
        const dateKey = b.start_time.split('T')[0];
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(b);
    });

    for (const [dateKey, list] of Object.entries(grouped)) {
        const groupEl = document.createElement('div');
        groupEl.className = 'agenda-day-group';

        const d = new Date(dateKey);
        const formattedDate = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        groupEl.innerHTML = `<div class="agenda-day-header"><span>${formattedDate}</span><span>${list.length} Kegiatan</span></div>`;

        list.forEach(b => {
            const roomObj = ROOMS_DATA.find(r => r.id === b.room_id);
            const rName = roomObj ? roomObj.room_name : 'Ruangan';
            const sTime = b.start_time.split('T')[1];
            const eTime = b.end_time.split('T')[1];

            const row = document.createElement('div');
            row.className = 'agenda-event-row';
            row.innerHTML = `
                <div>
                    <strong>${b.event_name}</strong>
                    <div class="text-xs text-muted"><i data-lucide="building"></i> ${rName} &bull; Peminjam: ${b.applicant}</div>
                </div>
                <div style="text-align:right;">
                    <span class="status-badge ${b.status.toLowerCase()}">${b.status}</span>
                    <div class="text-xs text-muted margin-top-xs">${sTime} - ${eTime}</div>
                </div>
            `;
            row.onclick = () => openDetailModal(b.id);
            groupEl.appendChild(row);
        });

        container.appendChild(groupEl);
    }

    wrapper.appendChild(container);
    safeCreateIcons();
}

// 7b. View Mingguan & Harian
function renderWeekGrid(wrapper, startOfWeek) {
    wrapper.classList.add('calendar-grid-detail');

    // Axis Jam
    const axis = document.createElement('div');
    axis.className = 'time-axis';

    // Kosongkan header pojok kiri atas
    const corner = document.createElement('div');
    corner.className = 'time-slot';
    corner.style.height = '40px';
    axis.appendChild(corner);

    for (let hour = 7; hour <= 22; hour++) {
        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.textContent = `${String(hour).padStart(2, '0')}:00`;
        axis.appendChild(slot);
    }
    wrapper.appendChild(axis);

    // Columns Grid Hari
    const cols = document.createElement('div');
    cols.className = 'events-columns';

    const dayNames = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

    for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);

        const col = document.createElement('div');
        col.className = 'events-column';
        col.style.minHeight = '960px'; // 16 jam * 60px

        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        // Header Kolom Tanggal
        const colHeader = document.createElement('div');
        colHeader.className = 'column-header';
        colHeader.style.height = '40px';
        colHeader.innerHTML = `<div>${dayNames[i]}</div><div style="font-size:0.7rem; opacity:0.8;">${d.getDate()}/${d.getMonth() + 1}</div>`;
        col.appendChild(colHeader);

        // Ambil peminjaman hari ini
        const dayBookings = bookings.filter(b => {
            if (b.status === 'CANCELLED') return false;
            if (activeRole === 'PUBLIC' && !['APPROVED', 'PENDING'].includes(b.status)) return false;
            if (activeFilters.length > 0 && !activeFilters.includes(b.room_id)) return false;
            return b.start_time.split('T')[0] === dateStr;
        });

        // Gambar event ke dalam grid
        dayBookings.forEach(booking => {
            const evEl = createDetailedEventElement(booking);
            col.appendChild(evEl);
        });

        cols.appendChild(col);
    }
    wrapper.appendChild(cols);
}

function renderDayGrid(wrapper, targetDate) {
    wrapper.classList.add('calendar-grid-detail');

    // Axis Jam
    const axis = document.createElement('div');
    axis.className = 'time-axis';

    const corner = document.createElement('div');
    corner.className = 'time-slot';
    corner.style.height = '40px';
    axis.appendChild(corner);

    for (let hour = 7; hour <= 22; hour++) {
        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.textContent = `${String(hour).padStart(2, '0')}:00`;
        axis.appendChild(slot);
    }
    wrapper.appendChild(axis);

    // Kolom Event Tunggal
    const cols = document.createElement('div');
    cols.className = 'events-columns';

    const col = document.createElement('div');
    col.className = 'events-column';
    col.style.minHeight = '960px';

    const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

    const colHeader = document.createElement('div');
    colHeader.className = 'column-header';
    colHeader.style.height = '40px';
    colHeader.innerHTML = `<div>Jadwal Ruangan</div><div style="font-size:0.7rem; opacity:0.8;">${targetDate.getDate()} / ${targetDate.getMonth() + 1} / ${targetDate.getFullYear()}</div>`;
    col.appendChild(colHeader);

    // Ambil peminjaman hari ini
    const dayBookings = bookings.filter(b => {
        if (b.status === 'CANCELLED') return false;
        if (activeRole === 'PUBLIC' && !['APPROVED', 'PENDING'].includes(b.status)) return false;
        if (activeFilters.length > 0 && !activeFilters.includes(b.room_id)) return false;
        return b.start_time.split('T')[0] === dateStr;
    });

    dayBookings.forEach(booking => {
        const evEl = createDetailedEventElement(booking);
        col.appendChild(evEl);
    });

    cols.appendChild(col);
    wrapper.appendChild(cols);
}

// Helper posisikan Event secara absolut pada grid berdasarkan Jam (7:00 - 22:00)
function createDetailedEventElement(booking) {
    const startParts = booking.start_time.split('T')[1].split(':');
    const endParts = booking.end_time.split('T')[1].split(':');

    const startMin = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMin = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

    // Offset Mulai dari jam 07:00 pagi (420 menit)
    const baseMin = 420;
    const pxPerMin = 1.0; // 60px per jam -> 1px per menit

    const topOffset = Math.max(0, startMin - baseMin) * pxPerMin + 40; // +40px untuk header kolom
    const height = Math.max(30, (endMin - startMin) * pxPerMin);

    const ev = document.createElement('div');
    ev.className = `positioned-event ${booking.status.toLowerCase()}`;
    ev.style.top = `${topOffset}px`;
    ev.style.height = `${height}px`;

    const roomObj = ROOMS_DATA.find(r => r.id === booking.room_id);
    const rName = roomObj ? roomObj.room_name : 'Ruangan';

    ev.innerHTML = `
        <span class="event-time">${startParts[0]}:${startParts[1]} - ${endParts[0]}:${endParts[1]}</span>
        <span class="event-title">${booking.event_name}</span>
        <span style="font-size:0.65rem; opacity:0.8;">${rName}</span>
    `;

    ev.onclick = (e) => {
        e.stopPropagation();
        openDetailModal(booking.id);
    };

    return ev;
}

// 8. COLLISION CONTROLLER (Pencegah Jadwal Bentrok)
function checkCollision(roomId, startTime, endTime, skipBookingId = '') {
    // Cari bentrok waktu pada ruangan yang sama
    // Collision jika: (StartA < EndB) dan (EndA > StartB)
    const newStart = new Date(startTime);
    const newEnd = new Date(endTime);

    for (let i = 0; i < bookings.length; i++) {
        const b = bookings[i];

        // Lewati jika booking berstatus REJECTED atau CANCELLED, atau ID yang sedang diedit
        if (b.status === 'REJECTED' || b.status === 'CANCELLED') continue;
        if (skipBookingId && b.id === skipBookingId) continue;

        if (parseInt(b.room_id) === parseInt(roomId)) {
            const bStart = new Date(b.start_time);
            const bEnd = new Date(b.end_time);

            if (newStart < bEnd && newEnd > bStart) {
                return b; // Mengembalikan data booking yang menabrak
            }
        }
    }
    return null;
}

// 9. MODALS MANAGEMENT
function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) {
        el.classList.add('hidden');
        // Hentikan kamera jika modal upload ditutup
        if (modalId === 'upload-photo-modal') {
            stopCamera();
        }
    }
}

// Tutup semua modal yang terbuka
function closeAllModals() {
    document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => {
        m.classList.add('hidden');
    });
    stopCamera();
}

// FIX: Terima parameter presetDate agar klik sel kalender bisa langsung preset tanggal
function openBookingModal(bookingId = '', presetDate = '') {
    if (!currentUser) {
        openLoginModal();
        return;
    }

    const modal = document.getElementById('booking-modal');
    const titleEl = document.getElementById('booking-modal-title');
    const form = document.getElementById('booking-form');

    // Set min date ke hari ini (atau awal 2026) dan max date ke akhir 2036
    const todayStr = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('booking-date');
    dateInput.min = todayStr < '2026-01-01' ? '2026-01-01' : todayStr;
    dateInput.max = '2036-12-31';

    // Reset Form
    form.reset();
    document.getElementById('booking-edit-id').value = '';
    document.getElementById('booking-error-alert').classList.add('hidden');
    document.getElementById('booking-revision-info').classList.add('hidden');

    if (bookingId) {
        // Edit Mode
        const booking = bookings.find(b => b.id === bookingId);
        if (!booking) return;

        titleEl.textContent = "Ubah Peminjaman Ruangan";
        document.getElementById('booking-edit-id').value = booking.id;
        document.getElementById('booking-event-name').value = booking.event_name;
        document.getElementById('booking-room-id').value = booking.room_id;
        document.getElementById('booking-applicant').value = booking.applicant;

        const datePart = booking.start_time.split('T')[0];
        const startPart = booking.start_time.split('T')[1];
        const endPart = booking.end_time.split('T')[1];

        document.getElementById('booking-date').value = datePart;
        document.getElementById('booking-start-time').value = startPart;
        document.getElementById('booking-end-time').value = endPart;
        document.getElementById('booking-desc').value = booking.description;

        // Berikan warning & input alasan jika status sudah APPROVED atau REVISION
        const revReasonGroup = document.getElementById('booking-revision-reason-group');
        const revReasonInput = document.getElementById('booking-revision-reason');
        if ((booking.status === 'APPROVED' || booking.status === 'REVISION') && activeRole !== 'ADMIN') {
            document.getElementById('booking-revision-info').classList.remove('hidden');
            if (revReasonGroup) revReasonGroup.classList.remove('hidden');
            if (revReasonInput) revReasonInput.value = booking.revision_reason || '';
        } else {
            if (revReasonGroup) revReasonGroup.classList.add('hidden');
            if (revReasonInput) revReasonInput.value = '';
        }
    } else {
        // Create Mode
        titleEl.textContent = "Formulir Pengajuan Peminjaman";
        document.getElementById('booking-applicant').value = currentUser.name;

        const revReasonGroup = document.getElementById('booking-revision-reason-group');
        if (revReasonGroup) revReasonGroup.classList.add('hidden');

        // FIX: gunakan presetDate dari klik sel kalender, atau hari ini sebagai fallback
        document.getElementById('booking-date').value = presetDate || todayStr;
    }

    modal.classList.remove('hidden');
}

function handleBookingSubmit(event) {
    event.preventDefault();

    const editId = document.getElementById('booking-edit-id').value;
    const eventName = document.getElementById('booking-event-name').value.trim();
    const roomId = parseInt(document.getElementById('booking-room-id').value);
    const applicant = document.getElementById('booking-applicant').value.trim();
    const date = document.getElementById('booking-date').value;
    const startTimeStr = document.getElementById('booking-start-time').value;
    const endTimeStr = document.getElementById('booking-end-time').value;
    const description = document.getElementById('booking-desc').value.trim();
    const revisionReason = (document.getElementById('booking-revision-reason') ? document.getElementById('booking-revision-reason').value.trim() : '');

    const startDateTime = `${date}T${startTimeStr}`;
    const endDateTime = `${date}T${endTimeStr}`;

    // Validasi Jam Mulai harus sebelum Jam Selesai
    if (startTimeStr >= endTimeStr) {
        showBookingError("Waktu selesai harus setelah waktu mulai!");
        return;
    }

    // CHECK COLLISION (Collision Control)
    // Jika user mengedit jadwal approved yang lama, lewati tabrakan dengan jadwal lamanya sendiri
    const collision = checkCollision(roomId, startDateTime, endDateTime, editId);
    if (collision) {
        showBookingError(`Gagal menyimpan! Waktu tersebut bentrok dengan acara "${collision.event_name}" (${collision.applicant}) di ruangan yang sama.`);
        return;
    }

    if (editId) {
        // WORKFLOW EDIT
        const index = bookings.findIndex(b => b.id === editId);
        if (index === -1) return;

        const originalBooking = bookings[index];

        if (activeRole === 'ADMIN') {
            // Admin bebas merubah langsung kapan saja
            bookings[index] = {
                ...originalBooking,
                event_name: eventName,
                room_id: roomId,
                applicant: applicant,
                start_time: startDateTime,
                end_time: endDateTime,
                description: description,
                status: 'APPROVED' // Auto-ACC
            };
        } else {
            // Aturan Peminjam (User)
            if (originalBooking.status === 'APPROVED' || originalBooking.status === 'REVISION') {
                if (!revisionReason) {
                    showBookingError("Wajib mengisi alasan pengajuan revisi!");
                    return;
                }

                // Aturan edit APPROVED: Berubah jadi Permohonan Revisi dengan snapshot data sebelumnya
                const prevSnapshot = originalBooking.previous_version || {
                    event_name: originalBooking.event_name,
                    room_id: originalBooking.room_id,
                    applicant: originalBooking.applicant,
                    start_time: originalBooking.start_time,
                    end_time: originalBooking.end_time,
                    description: originalBooking.description
                };

                bookings[index] = {
                    ...originalBooking,
                    event_name: eventName,
                    room_id: roomId,
                    applicant: applicant,
                    start_time: startDateTime,
                    end_time: endDateTime,
                    description: description,
                    revision_reason: revisionReason,
                    previous_version: prevSnapshot,
                    status: 'REVISION' // Membutuhkan persetujuan ulang
                };
                alert("Pengajuan revisi peminjaman berhasil dikirim. Jadwal akan ditinjau kembali oleh Admin beserta riwayat perubahannya.");
            } else {
                // Status PENDING bebas diubah tanpa mengubah alur status
                bookings[index] = {
                    ...originalBooking,
                    event_name: eventName,
                    room_id: roomId,
                    applicant: applicant,
                    start_time: startDateTime,
                    end_time: endDateTime,
                    description: description
                };
            }
        }
    } else {
        // WORKFLOW PENGAJUAN BARU
        const isAutoAcc = (activeRole === 'ADMIN');
        const newBooking = {
            id: 'b_' + Date.now(),
            user_id: currentUser.id,
            user_name: currentUser.name,
            user_email: currentUser.email,
            room_id: roomId,
            event_name: eventName,
            description: description,
            applicant: applicant,
            start_time: startDateTime,
            end_time: endDateTime,
            status: isAutoAcc ? 'APPROVED' : 'PENDING',
            photo_before_url: '',
            photo_after_url: '',
            rejection_reason: '',
            created_at: new Date().toISOString()
        };

        bookings.push(newBooking);

        const roomNameObj = ROOMS_DATA.find(r => r.id === roomId);
        const rName = roomNameObj ? roomNameObj.room_name : 'Ruangan';

        // Notifikasi untuk User pembuat
        addNotification('Pengajuan Terkirim', `Peminjaman "${eventName}" di ${rName} berhasil diajukan untuk jadwal ${date}.`, 'system', 'USER', currentUser.email);

        // Notifikasi untuk Admin bahwa ada permohonan baru
        if (!isAutoAcc) {
            addNotification('Permohonan Baru (Admin)', `${currentUser.name} mengajukan peminjaman ${rName} untuk "${eventName}".`, 'update', 'ADMIN');
        }

        if (isAutoAcc) {
            // Admin: langsung setujui, tidak perlu peringatan foto
            alert('✅ Peminjaman berhasil disimpan dan disetujui otomatis (Admin).');
        } else {
            // REVISI 2: Tampilkan peringatan wajib foto kondisi ruangan
            showPhotoObligationWarning(newBooking.id, eventName);
            return; // hentikan eksekusi, modal warning yang akan menutup booking modal
        }
    }

    saveBookingsToStorage();
    closeModal('booking-modal');
    renderCalendar();

    // Refresh tab views
    renderMyBookings();
    renderAdminApprovals();
}

// REVISI 2: Modal peringatan wajib foto kondisi ruangan saat pengajuan baru berhasil
function showPhotoObligationWarning(bookingId, eventName) {
    saveBookingsToStorage();
    closeModal('booking-modal');
    renderCalendar();
    renderMyBookings();
    renderAdminApprovals();

    // Tampilkan modal peringatan foto
    const overlay = document.getElementById('photo-obligation-modal');
    document.getElementById('photo-obligation-event-name').textContent = eventName;
    document.getElementById('photo-obligation-booking-id').value = bookingId;
    if (overlay) overlay.classList.remove('hidden');
}

function showBookingError(msg) {
    const alertBox = document.getElementById('booking-error-alert');
    const alertTxt = document.getElementById('booking-error-text');
    alertTxt.textContent = msg;
    alertBox.classList.remove('hidden');
}

// 10. DETAIL MODAL & AUDIT COMPARISON
function openDetailModal(bookingId) {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const modal = document.getElementById('detail-modal');

    document.getElementById('detail-event-title').textContent = booking.event_name;

    const statusBadge = document.getElementById('detail-status-badge');
    statusBadge.className = `badge status-badge ${booking.status.toLowerCase()}`;
    statusBadge.textContent = booking.status;

    const roomObj = ROOMS_DATA.find(r => r.id === booking.room_id);
    document.getElementById('detail-room').textContent = roomObj ? `${roomObj.room_name} (${roomObj.location_floor})` : 'Ruangan';

    document.getElementById('detail-applicant').textContent = booking.applicant;

    // Format Waktu Cantik
    const startD = new Date(booking.start_time);
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const dateFormatted = startD.toLocaleDateString('id-ID', options);

    const startStr = booking.start_time.split('T')[1];
    const endStr = booking.end_time.split('T')[1];
    document.getElementById('detail-time').textContent = `${dateFormatted} (${startStr} - ${endStr})`;

    document.getElementById('detail-description').textContent = booking.description || "-";

    // Alasan penolakan jika ada
    const rejectBlock = document.getElementById('detail-rejection-block');
    if (booking.status === 'REJECTED' && booking.rejection_reason) {
        rejectBlock.classList.remove('hidden');
        document.getElementById('detail-rejection-reason').textContent = booking.rejection_reason;
    } else if (rejectBlock) {
        rejectBlock.classList.add('hidden');
    }

    // Alasan pembatalan (CANCELLED) jika ada
    const cancelBlock = document.getElementById('detail-cancel-block');
    if (booking.status === 'CANCELLED' && booking.cancellation_reason) {
        if (cancelBlock) {
            cancelBlock.classList.remove('hidden');
            document.getElementById('detail-cancel-reason').textContent = booking.cancellation_reason;
        }
    } else if (cancelBlock) {
        cancelBlock.classList.add('hidden');
    }

    // Riwayat Komparasi Sebelum vs Sesudah Revisi (Bagian 4)
    const revBlock = document.getElementById('detail-revision-block');
    const revTbody = document.getElementById('detail-revision-diff-tbody');
    const revReasonText = document.getElementById('detail-revision-reason-text');
    const revReasonWrap = document.getElementById('detail-revision-reason-wrap');

    if (booking.previous_version && revBlock && revTbody) {
        revBlock.classList.remove('hidden');
        revTbody.innerHTML = '';

        if (booking.revision_reason && revReasonText && revReasonWrap) {
            revReasonWrap.classList.remove('hidden');
            revReasonText.textContent = booking.revision_reason;
        } else if (revReasonWrap) {
            revReasonWrap.classList.add('hidden');
        }

        const prev = booking.previous_version;
        const prevRoom = ROOMS_DATA.find(r => r.id === prev.room_id) || { room_name: 'Ruangan' };
        const currRoom = ROOMS_DATA.find(r => r.id === booking.room_id) || { room_name: 'Ruangan' };

        const diffFields = [
            {
                label: 'Nama Kegiatan',
                oldVal: prev.event_name,
                newVal: booking.event_name,
                changed: prev.event_name !== booking.event_name
            },
            {
                label: 'Ruangan',
                oldVal: prevRoom.room_name,
                newVal: currRoom.room_name,
                changed: prev.room_id !== booking.room_id
            },
            {
                label: 'Waktu Mulai',
                oldVal: prev.start_time ? prev.start_time.replace('T', ' ') : '-',
                newVal: booking.start_time ? booking.start_time.replace('T', ' ') : '-',
                changed: prev.start_time !== booking.start_time
            },
            {
                label: 'Waktu Selesai',
                oldVal: prev.end_time ? prev.end_time.replace('T', ' ') : '-',
                newVal: booking.end_time ? booking.end_time.replace('T', ' ') : '-',
                changed: prev.end_time !== booking.end_time
            },
            {
                label: 'Deskripsi Acara',
                oldVal: prev.description || '-',
                newVal: booking.description || '-',
                changed: (prev.description || '') !== (booking.description || '')
            }
        ];

        diffFields.forEach(f => {
            const tr = document.createElement('tr');
            if (f.changed) {
                tr.innerHTML = `
                    <td><strong>${f.label}</strong></td>
                    <td><span class="diff-old">${f.oldVal}</span></td>
                    <td><span class="diff-new">${f.newVal}</span></td>
                `;
            } else {
                tr.innerHTML = `
                    <td><strong>${f.label}</strong></td>
                    <td colspan="2" class="text-muted" style="font-size:0.75rem;">(Tidak ada perubahan: ${f.newVal})</td>
                `;
            }
            revTbody.appendChild(tr);
        });
    } else if (revBlock) {
        revBlock.classList.add('hidden');
    }

    // Tampilkan foto Before / After
    const beforePicWrap = document.getElementById('detail-pic-before');
    const afterPicWrap = document.getElementById('detail-pic-after');

    if (booking.photo_before_url) {
        beforePicWrap.innerHTML = `<img src="${booking.photo_before_url}" alt="Before-Use">`;
    } else {
        beforePicWrap.innerHTML = `<span class="no-pic-text">Belum diunggah</span>`;
    }

    if (booking.photo_after_url) {
        afterPicWrap.innerHTML = `<img src="${booking.photo_after_url}" alt="After-Use">`;
    } else {
        afterPicWrap.innerHTML = `<span class="no-pic-text">Belum diunggah</span>`;
    }

    // FIX: Tampilkan tombol aksi dinamis berdasarkan role dan status booking
    const detailActionsEl = document.getElementById('detail-modal-actions');
    detailActionsEl.innerHTML = ''; // reset

    const canEdit = ['PENDING', 'APPROVED', 'REVISION'].includes(booking.status);
    const isOwner = currentUser && (booking.user_email === currentUser.email || activeRole === 'ADMIN');

    if (currentUser && canEdit && isOwner) {
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-secondary btn-icon';
        editBtn.innerHTML = '<i data-lucide="edit-3"></i> Edit';
        editBtn.onclick = () => {
            closeModal('detail-modal');
            openBookingModal(booking.id);
        };
        detailActionsEl.appendChild(editBtn);
    }

    if (activeRole === 'ADMIN' && (booking.status === 'PENDING' || booking.status === 'REVISION')) {
        const approveBtn = document.createElement('button');
        approveBtn.className = 'btn btn-primary btn-icon';
        approveBtn.innerHTML = '<i data-lucide="check"></i> Setujui';
        approveBtn.onclick = () => {
            approveBooking(booking.id);
            closeModal('detail-modal');
        };
        detailActionsEl.appendChild(approveBtn);

        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'btn btn-danger btn-icon';
        rejectBtn.innerHTML = '<i data-lucide="x"></i> Tolak';
        rejectBtn.onclick = () => {
            closeModal('detail-modal');
            openRejectModal(booking.id);
        };
        detailActionsEl.appendChild(rejectBtn);
    }

    if (currentUser && canEdit && isOwner) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'btn btn-danger btn-icon';
        cancelBtn.innerHTML = '<i data-lucide="trash"></i> Batalkan';
        cancelBtn.onclick = () => {
            closeModal('detail-modal');
            cancelBooking(booking.id);
        };
        detailActionsEl.appendChild(cancelBtn);
    }

    // Perbarui ikon Lucide
    safeCreateIcons();

    modal.classList.remove('hidden');
}

// 11. TAB PEMINJAMAN SAYA (User View)
function filterMyBookings() {
    renderMyBookings();
}

function renderMyBookings() {
    const tbody = document.getElementById('my-bookings-tbody');
    const emptyState = document.getElementById('my-bookings-empty');
    const table = document.getElementById('my-bookings-table');
    const searchInput = document.getElementById('my-bookings-search');
    const statusFilter = document.getElementById('my-bookings-status-filter');

    const searchKeyword = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : '';
    const selectedStatus = (statusFilter && statusFilter.value) ? statusFilter.value : 'all';

    tbody.innerHTML = '';

    if (!currentUser) return;

    // Filter peminjaman milik user saat ini (Admin bisa melihat semua)
    let myData = bookings.filter(b => {
        if (activeRole === 'ADMIN') return true; // Admin melihat semua
        return b.user_email === currentUser.email;
    });

    // Filter berdasarkan kata kunci pencarian
    if (searchKeyword) {
        myData = myData.filter(b => {
            const roomObj = ROOMS_DATA.find(r => r.id === b.room_id);
            const rName = roomObj ? roomObj.room_name.toLowerCase() : '';
            const evName = (b.event_name || '').toLowerCase();
            const applicant = (b.applicant || '').toLowerCase();
            const dateStr = (b.start_time || '').toLowerCase();
            return evName.includes(searchKeyword) || rName.includes(searchKeyword) || applicant.includes(searchKeyword) || dateStr.includes(searchKeyword);
        });
    }

    // Filter berdasarkan status
    if (selectedStatus !== 'all') {
        myData = myData.filter(b => b.status === selectedStatus);
    }

    if (myData.length === 0) {
        table.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    table.classList.remove('hidden');
    emptyState.classList.add('hidden');

    // Urutkan dari pengajuan terbaru
    myData.sort((a, b) => b.created_at.localeCompare(a.created_at));

    myData.forEach(b => {
        const tr = document.createElement('tr');
        const roomObj = ROOMS_DATA.find(r => r.id === b.room_id);
        const rName = roomObj ? roomObj.room_name : 'Ruangan';

        // Format waktu
        const startD = new Date(b.start_time);
        const startStr = b.start_time.split('T')[1];
        const endStr = b.end_time.split('T')[1];
        const formattedDate = startD.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

        // Foto Indicator logic
        const beforeUploaded = !!b.photo_before_url;
        const afterUploaded = !!b.photo_after_url;

        // Button Aksi logika
        let actionButtons = `<button class="btn btn-secondary btn-xs" onclick="openDetailModal('${b.id}')"><i data-lucide="info"></i> Detail</button> `;
        if (b.status === 'PENDING' || b.status === 'APPROVED' || b.status === 'REVISION') {
            actionButtons += `<button class="btn btn-secondary btn-xs" onclick="openBookingModal('${b.id}')"><i data-lucide="edit-3"></i> Edit</button> `;
        }
        const canCancel = activeRole === 'ADMIN'
            ? (b.status === 'PENDING' || b.status === 'APPROVED' || b.status === 'REVISION')
            : (b.status === 'PENDING' || b.status === 'APPROVED' || b.status === 'REVISION');
        if (canCancel) {
            actionButtons += `<button class="btn btn-danger btn-xs" onclick="cancelBooking('${b.id}')"><i data-lucide="trash"></i> Batal</button>`;
        }

        tr.innerHTML = `
            <td>
                <strong>${b.event_name}</strong>
                <div style="font-size:0.75rem; color:var(--text-muted);"><i data-lucide="building" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>${rName}</div>
            </td>
            <td>
                <div>${formattedDate}</div>
                <div class="text-xs text-muted">${startStr} - ${endStr}</div>
            </td>
            <td>
                <span class="status-badge ${b.status.toLowerCase()}">${b.status}</span>
            </td>
            <td>
                <div class="photo-status-box">
                    <button type="button" class="photo-indicator ${beforeUploaded ? 'uploaded' : ''}" onclick="openUploadModal('${b.id}', 'before')">
                        <i data-lucide="camera" style="pointer-events:none;"></i> Before
                    </button>
                    <button type="button" class="photo-indicator ${afterUploaded ? 'uploaded' : ''}" onclick="openUploadModal('${b.id}', 'after')">
                        <i data-lucide="camera" style="pointer-events:none;"></i> After
                    </button>
                </div>
            </td>
            <td>
                ${actionButtons}
            </td>
        `;

        tbody.appendChild(tr);
    });

    safeCreateIcons();
}

function cancelBooking(bookingId) {
    const booking = bookings.find(b => b.id === bookingId);
    if (!booking) return;

    const cancelModal = document.getElementById('cancel-reason-modal');
    const cancelIdInput = document.getElementById('cancel-booking-id');
    const cancelReasonInput = document.getElementById('cancel-reason-text');

    if (cancelModal && cancelIdInput && cancelReasonInput) {
        cancelIdInput.value = bookingId;
        cancelReasonInput.value = '';
        cancelModal.classList.remove('hidden');
    }
}

function submitCancelWithReason() {
    const bookingId = document.getElementById('cancel-booking-id').value;
    const reason = document.getElementById('cancel-reason-text').value.trim();

    if (!reason) {
        alert("Wajib mengisi alasan pembatalan!");
        return;
    }

    const index = bookings.findIndex(b => b.id === bookingId);
    if (index === -1) return;

    bookings[index].status = 'CANCELLED';
    bookings[index].cancellation_reason = reason;

    const evName = bookings[index].event_name;
    const applicant = bookings[index].applicant || 'Pemohon';

    addNotification('Peminjaman Dibatalkan', `Peminjaman "${evName}" dibatalkan dengan alasan: ${reason}`, 'rejected', 'ADMIN');
    
    if (currentUser && bookings[index].user_email === currentUser.email) {
        addNotification('Peminjaman Dibatalkan', `Peminjaman "${evName}" Anda telah dibatalkan.`, 'rejected', 'USER', currentUser.email);
    }

    closeModal('cancel-reason-modal');
    saveBookingsToStorage();
    renderCalendar();
    renderMyBookings();
    renderAdminApprovals();
}

// 12. FOTO UPLOAD LOGIC
let _cameraStream = null; // Referensi stream kamera aktif

function openUploadModal(bookingId, type) {
    document.getElementById('upload-booking-id').value = bookingId;
    document.getElementById('upload-photo-type').value = type;

    const titleEl = document.getElementById('upload-modal-title');
    titleEl.textContent = `Unggah Foto Kondisi ${type === 'before' ? 'Sebelum (Before-Use)' : 'Sesudah (After-Use)'}`;

    removePhotoSelection(); // reset modal state
    document.getElementById('upload-photo-modal').classList.remove('hidden');
}

function triggerFileInput() {
    document.getElementById('photo-file-input').click();
}

function handlePhotoFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const dataUrl = e.target.result;
        showPhotoPreview(dataUrl);
    };
    reader.readAsDataURL(file);
}

function simulatePhotoUpload(mockType) {
    const dataUrl = mockType === 'dirty' ? MOCK_DIRTY_PHOTO : MOCK_CLEAN_PHOTO;
    showPhotoPreview(dataUrl);
}

function showPhotoPreview(dataUrl) {
    stopCamera(); // matikan kamera jika aktif
    document.getElementById('upload-area-box').classList.add('hidden');
    document.getElementById('camera-section').classList.add('hidden');

    const previewContainer = document.getElementById('photo-preview-container');
    previewContainer.classList.remove('hidden');

    const img = document.getElementById('photo-preview-img');
    img.src = dataUrl;
    img.dataset.loaded = 'true'; // FIX: tandai bahwa gambar sudah diisi
}

function removePhotoSelection() {
    document.getElementById('photo-file-input').value = '';
    document.getElementById('upload-area-box').classList.remove('hidden');
    document.getElementById('photo-preview-container').classList.add('hidden');
    document.getElementById('camera-section').classList.add('hidden');
    const img = document.getElementById('photo-preview-img');
    img.src = '';
    img.removeAttribute('data-loaded'); // FIX: hapus tanda loaded
    stopCamera();
}

// FIX: Fitur Kamera Webcam
function startCamera() {
    const cameraSection = document.getElementById('camera-section');
    const videoEl = document.getElementById('camera-video');
    const captureBtn = document.getElementById('btn-capture-photo');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        alert('Browser Anda tidak mendukung akses kamera. Gunakan Chrome/Firefox terbaru.');
        return;
    }

    document.getElementById('upload-area-box').classList.add('hidden');
    cameraSection.classList.remove('hidden');

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(stream => {
            _cameraStream = stream;
            videoEl.srcObject = stream;
            videoEl.play();
            captureBtn.disabled = false;
        })
        .catch(err => {
            console.error('Kamera error:', err);
            alert('Gagal mengakses kamera: ' + err.message + '. Pastikan izin kamera sudah diberikan.');
            cameraSection.classList.add('hidden');
            document.getElementById('upload-area-box').classList.remove('hidden');
        });
}

function capturePhoto() {
    const videoEl = document.getElementById('camera-video');
    const canvas = document.getElementById('camera-canvas');

    canvas.width = videoEl.videoWidth || 640;
    canvas.height = videoEl.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    showPhotoPreview(dataUrl);
}

function stopCamera() {
    if (_cameraStream) {
        _cameraStream.getTracks().forEach(track => track.stop());
        _cameraStream = null;
    }
    const videoEl = document.getElementById('camera-video');
    if (videoEl) videoEl.srcObject = null;
}

function saveUploadedPhoto() {
    const bookingId = document.getElementById('upload-booking-id').value;
    const type = document.getElementById('upload-photo-type').value;
    const imgElement = document.getElementById('photo-preview-img');

    // FIX: validasi menggunakan dataset.loaded bukan .src (yang selalu truthy)
    if (!imgElement.dataset.loaded || !imgElement.src || imgElement.src === window.location.href) {
        alert('Silakan pilih foto, gunakan kamera, atau pilih foto demo terlebih dahulu!');
        return;
    }

    const index = bookings.findIndex(b => b.id === bookingId);
    if (index === -1) return;

    if (type === 'before') {
        bookings[index].photo_before_url = imgElement.src;
    } else {
        bookings[index].photo_after_url = imgElement.src;
    }

    saveBookingsToStorage();
    closeModal('upload-photo-modal');
    renderMyBookings();
    renderAuditGallery();
    alert('Foto dokumentasi kebersihan berhasil disimpan.');
}

// 13. TAB ADMIN DASHBOARD (Approvals)
function filterAdminApprovals() {
    renderAdminApprovals();
}

function exportBookingsToCSV() {
    if (!bookings || bookings.length === 0) {
        alert("Tidak ada data peminjaman untuk diekspor!");
        return;
    }

    const headers = ["ID", "Nama Acara", "Ruangan", "Peminjam", "Email", "Waktu Mulai", "Waktu Selesai", "Status", "Alasan Penolakan", "Tanggal Dibuat"];
    const rows = bookings.map(b => {
        const roomObj = ROOMS_DATA.find(r => r.id === b.room_id);
        const rName = roomObj ? roomObj.room_name : 'Ruangan';
        return [
            `"${b.id}"`,
            `"${(b.event_name || '').replace(/"/g, '""')}"`,
            `"${rName}"`,
            `"${(b.applicant || '').replace(/"/g, '""')}"`,
            `"${b.user_email || ''}"`,
            `"${b.start_time || ''}"`,
            `"${b.end_time || ''}"`,
            `"${b.status || ''}"`,
            `"${(b.rejection_reason || '').replace(/"/g, '""')}"`,
            `"${b.created_at || ''}"`
        ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Rekap_Peminjaman_SPMR_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderAdminApprovals() {
    const tbody = document.getElementById('admin-approvals-tbody');
    const emptyState = document.getElementById('admin-approvals-empty');
    const table = document.getElementById('admin-approvals-table');
    const searchInput = document.getElementById('admin-search-input');
    const searchKeyword = (searchInput && searchInput.value) ? searchInput.value.toLowerCase().trim() : '';

    // Update Counter Stats
    const pendingCount = bookings.filter(b => b.status === 'PENDING').length;
    const approvedCount = bookings.filter(b => b.status === 'APPROVED').length;
    const revisionCount = bookings.filter(b => b.status === 'REVISION').length;

    document.getElementById('stat-pending-count').textContent = pendingCount;
    document.getElementById('stat-approved-count').textContent = approvedCount;
    document.getElementById('stat-revision-count').textContent = revisionCount;

    tbody.innerHTML = '';

    // Hanya tampilkan pengajuan yang membutuhkan keputusan (PENDING & REVISION)
    let approvalsList = bookings.filter(b => b.status === 'PENDING' || b.status === 'REVISION');

    // Filter berdasarkan pencarian kata kunci admin
    if (searchKeyword) {
        approvalsList = approvalsList.filter(b => {
            const roomObj = ROOMS_DATA.find(r => r.id === b.room_id);
            const rName = roomObj ? roomObj.room_name.toLowerCase() : '';
            const evName = (b.event_name || '').toLowerCase();
            const uName = (b.user_name || '').toLowerCase();
            const uEmail = (b.user_email || '').toLowerCase();
            return evName.includes(searchKeyword) || rName.includes(searchKeyword) || uName.includes(searchKeyword) || uEmail.includes(searchKeyword);
        });
    }

    if (approvalsList.length === 0) {
        table.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    table.classList.remove('hidden');
    emptyState.classList.add('hidden');

    // Urutkan pengajuan lama terlebih dahulu
    approvalsList.sort((a, b) => a.created_at.localeCompare(b.created_at));

    approvalsList.forEach(b => {
        const tr = document.createElement('tr');
        const roomObj = ROOMS_DATA.find(r => r.id === b.room_id);
        const rName = roomObj ? roomObj.room_name : 'Ruangan';

        const startD = new Date(b.start_time);
        const startStr = b.start_time.split('T')[1];
        const endStr = b.end_time.split('T')[1];
        const formattedDate = startD.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

        tr.innerHTML = `
            <td>
                <strong>${b.user_name}</strong>
                <div class="text-xs text-muted">${b.user_email}</div>
            </td>
            <td>
                <strong>${b.event_name}</strong>
                <div class="text-xs text-muted"><i data-lucide="building" style="width:12px; height:12px; display:inline-block; vertical-align:middle; margin-right:4px;"></i>${rName}</div>
            </td>
            <td>
                <div>${formattedDate}</div>
                <div class="text-xs text-muted">${startStr} - ${endStr}</div>
            </td>
            <td>
                <span class="status-badge ${b.status.toLowerCase()}">${b.status}</span>
            </td>
            <td>
                <button class="btn btn-secondary btn-xs" onclick="openDetailModal('${b.id}')"><i data-lucide="info"></i> Detail</button>
                <button class="btn btn-primary btn-xs" onclick="approveBooking('${b.id}')"><i data-lucide="check"></i> Setujui</button>
                <button class="btn btn-danger btn-xs" onclick="openRejectModal('${b.id}')"><i data-lucide="x"></i> Tolak</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    safeCreateIcons();
}

function approveBooking(bookingId) {
    const index = bookings.findIndex(b => b.id === bookingId);
    if (index === -1) return;

    bookings[index].status = 'APPROVED';
    bookings[index].rejection_reason = '';

    const evName = bookings[index].event_name;
    const applicantEmail = bookings[index].user_email;

    // Notifikasi untuk Admin (konfirmasi aksi)
    addNotification('Peminjaman Disetujui (Admin)', `Anda telah menyetujui pengajuan "${evName}".`, 'approved', 'ADMIN');
    
    // Notifikasi terpisah khusus untuk User peminjam
    addNotification('Peminjaman Disetujui', `Pengajuan "${evName}" Anda telah disetujui Admin.`, 'approved', 'USER', applicantEmail);

    saveBookingsToStorage();
    renderCalendar();
    renderAdminApprovals();
    renderMyBookings();
    alert("Pengajuan peminjaman disetujui.");
}

function openRejectModal(bookingId) {
    document.getElementById('reject-booking-id').value = bookingId;
    document.getElementById('rejection-reason').value = '';
    document.getElementById('reject-modal').classList.remove('hidden');
}

function submitRejection() {
    const bookingId = document.getElementById('reject-booking-id').value;
    const reason = document.getElementById('rejection-reason').value.trim();

    if (!reason) {
        alert("Silakan isi alasan penolakan!");
        return;
    }

    const index = bookings.findIndex(b => b.id === bookingId);
    if (index === -1) return;

    bookings[index].status = 'REJECTED';
    bookings[index].rejection_reason = reason;

    const evName = bookings[index].event_name;
    const applicantEmail = bookings[index].user_email;

    // Notifikasi untuk Admin
    addNotification('Peminjaman Ditolak (Admin)', `Anda telah menolak pengajuan "${evName}". Alasan: ${reason}`, 'rejected', 'ADMIN');

    // Notifikasi terpisah khusus untuk User peminjam
    addNotification('Peminjaman Ditolak', `Pengajuan "${evName}" Anda ditolak Admin dengan alasan: ${reason}`, 'rejected', 'USER', applicantEmail);

    saveBookingsToStorage();
    closeModal('reject-modal');
    renderCalendar();
    renderAdminApprovals();
    renderMyBookings();
    alert("Pengajuan peminjaman ditolak.");
}

// 14. TAB AUDIT KEBERSIHAN (Admin: semua, User: hanya milik sendiri)
function renderAuditGallery() {
    const container = document.getElementById('audit-gallery-container');
    const emptyState = document.getElementById('admin-audit-empty');
    const roomFilterVal = document.getElementById('audit-room-filter').value;

    container.innerHTML = '';

    // Ambil peminjaman yang memiliki minimal salah satu foto
    let auditList = bookings.filter(b => b.photo_before_url || b.photo_after_url);

    // Blueprint: User hanya melihat foto milik sendiri; Admin melihat semua
    if (activeRole === 'USER' && currentUser) {
        auditList = auditList.filter(b => b.user_email === currentUser.email);
    }

    // Saring berdasarkan ruangan jika dipilih spesifik
    if (roomFilterVal !== 'all') {
        auditList = auditList.filter(b => parseInt(b.room_id) === parseInt(roomFilterVal));
    }

    if (auditList.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    // Urutkan terbaru
    auditList.sort((a, b) => b.created_at.localeCompare(a.created_at));

    auditList.forEach(b => {
        const card = document.createElement('div');
        card.className = 'audit-card';

        const roomObj = ROOMS_DATA.find(r => r.id === b.room_id);
        const rName = roomObj ? roomObj.room_name : 'Ruangan';

        const startD = new Date(b.start_time);
        const dateFormatted = startD.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

        const beforePicContent = b.photo_before_url
            ? `<img src="${b.photo_before_url}" class="audit-img" alt="Before">`
            : `<div class="audit-no-img"><i data-lucide="image"></i><span>Belum ada</span></div>`;

        const afterPicContent = b.photo_after_url
            ? `<img src="${b.photo_after_url}" class="audit-img" alt="After">`
            : `<div class="audit-no-img"><i data-lucide="image"></i><span>Belum ada</span></div>`;

        card.innerHTML = `
            <div class="audit-card-header">
                <div class="audit-card-title">${b.event_name}</div>
                <div class="audit-card-meta">${rName} &bull; ${dateFormatted} &bull; Peminjam: ${b.applicant}</div>
            </div>
            
            <div class="audit-pics-comparison">
                <div class="audit-pic-box">
                    <div class="audit-pic-title">Before-Use</div>
                    <div class="audit-pic-wrapper">${beforePicContent}</div>
                </div>
                <div class="audit-pic-box">
                    <div class="audit-pic-title">After-Use</div>
                    <div class="audit-pic-wrapper">${afterPicContent}</div>
                </div>
            </div>
            
            <div class="audit-card-footer">
                <span>Diajukan oleh: ${b.user_name} (${b.user_email})</span>
            </div>
        `;

        container.appendChild(card);
    });

    safeCreateIcons();
}

// 16. FITUR INTERAKTIF BARU: TOOLTIP, WIZARD, DROPDOWN & EKSPOR (Bagian 3, 5, 6, 7)

// Tooltip popover saat hover jadwal di kalender (Bagian 3.3)
function showEventTooltip(e, booking, rName, startTimeStr, endTimeStr) {
    const tooltip = document.getElementById('calendar-event-tooltip');
    if (!tooltip) return;

    document.getElementById('tt-title').textContent = booking.event_name;
    document.getElementById('tt-room').textContent = rName;
    document.getElementById('tt-applicant').textContent = booking.applicant;
    document.getElementById('tt-time').textContent = `${startTimeStr} - ${endTimeStr}`;

    const statusBadge = document.getElementById('tt-status');
    statusBadge.textContent = booking.status;
    statusBadge.className = `tooltip-status badge ${booking.status.toLowerCase()}`;

    tooltip.style.left = `${e.clientX + 15}px`;
    tooltip.style.top = `${e.clientY + 15}px`;
    tooltip.classList.remove('hidden');
}

function hideEventTooltip() {
    const tooltip = document.getElementById('calendar-event-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
}

// User Profile Dropdown (Bagian 5.1)
function toggleUserDropdown() {
    const dropdown = document.getElementById('profile-dropdown-content');
    if (!dropdown) return;
    dropdown.classList.toggle('hidden');
    if (currentUser) {
        document.getElementById('dropdown-user-name').textContent = currentUser.name;
        document.getElementById('dropdown-user-email').textContent = currentUser.email;
    }
}

// Notification Center Panel (Bagian 5.2)
function toggleNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
}

// Role Switcher Collapse FAB Toggle (Bagian 6.1)
function toggleRoleWidget() {
    const widget = document.getElementById('role-switcher-widget');
    const btn = document.getElementById('btn-collapse-role');
    if (!widget) return;
    widget.classList.toggle('collapsed');
    if (btn) {
        btn.textContent = widget.classList.contains('collapsed') ? '+' : '_';
    }
}

// Multi-Step Wizard Modal Controller (Bagian 7.1)
let currentWizardStep = 1;

function updateWizardView() {
    // Sembunyikan semua step panel
    document.querySelectorAll('.wizard-step-panel').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.step-item').forEach(s => s.classList.remove('active', 'completed'));

    // Tampilkan panel aktif
    const activePanel = document.getElementById(`wizard-step-${currentWizardStep}`);
    if (activePanel) activePanel.classList.remove('hidden');

    // Update bar indikator
    for (let i = 1; i <= 3; i++) {
        const stepTab = document.getElementById(`step-tab-${i}`);
        if (!stepTab) continue;
        if (i < currentWizardStep) {
            stepTab.classList.add('completed');
        } else if (i === currentWizardStep) {
            stepTab.classList.add('active');
        }
    }

    // Tombol Prev / Next / Submit
    const btnPrev = document.getElementById('btn-wizard-prev');
    const btnNext = document.getElementById('btn-wizard-next');
    const btnSubmit = document.getElementById('btn-booking-submit');

    if (btnPrev) btnPrev.style.display = currentWizardStep > 1 ? 'inline-block' : 'none';
    
    if (currentWizardStep === 3) {
        if (btnNext) btnNext.classList.add('hidden');
        if (btnSubmit) btnSubmit.classList.remove('hidden');
    } else {
        if (btnNext) {
            btnNext.classList.remove('hidden');
            btnNext.textContent = `Lanjut ke Langkah ${currentWizardStep + 1}`;
        }
        if (btnSubmit) btnSubmit.classList.add('hidden');
    }
}

function nextWizardStep() {
    // Validasi input di step saat ini
    if (currentWizardStep === 1) {
        const roomId = document.getElementById('booking-room-id').value;
        const date = document.getElementById('booking-date').value;
        const sTime = document.getElementById('booking-start-time').value;
        const eTime = document.getElementById('booking-end-time').value;

        if (!roomId || !date || !sTime || !eTime) {
            alert('Harap lengkapi semua bidang yang bertanda bintang (*) pada Langkah 1.');
            return;
        }
        if (sTime >= eTime) {
            alert('Jam selesai harus lebih besar dari jam mulai.');
            return;
        }
    } else if (currentWizardStep === 2) {
        const eventName = document.getElementById('booking-event-name').value.trim();
        const applicant = document.getElementById('booking-applicant').value.trim();

        if (!eventName || !applicant) {
            alert('Harap isi Nama Acara dan Komunitas Peminjam pada Langkah 2.');
            return;
        }
    }

    if (currentWizardStep < 3) {
        currentWizardStep++;
        updateWizardView();
    }
}

function prevWizardStep() {
    if (currentWizardStep > 1) {
        currentWizardStep--;
        updateWizardView();
    }
}

// Reset Wizard saat modal dibuka
const originalOpenBookingModal = openBookingModal;
openBookingModal = function(bookingId = '', presetDate = '') {
    currentWizardStep = 1;
    updateWizardView();
    originalOpenBookingModal(bookingId, presetDate);
};

// Ekspor ke iCalendar (.ics) / Google Calendar (Bagian 7.3)
function exportToICalendar() {
    if (!bookings || bookings.length === 0) {
        alert('Tidak ada data jadwal untuk diekspor.');
        return;
    }

    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//SIPERU SPMR Purbowardayan//ID\nCALSCALE:GREGORIAN\nMETHOD:PUBLISH\n";

    bookings.forEach(b => {
        if (b.status === 'APPROVED') {
            const startClean = b.start_time.replace(/[-:]/g, "") + "00Z";
            const endClean = b.end_time.replace(/[-:]/g, "") + "00Z";
            const roomObj = ROOMS_DATA.find(r => r.id === b.room_id);
            const rName = roomObj ? roomObj.room_name : 'Gereja Purbowardayan';

            icsContent += "BEGIN:VEVENT\n";
            icsContent += `UID:${b.id}@siperu.purbowardayan.org\n`;
            icsContent += `DTSTAMP:${startClean}\n`;
            icsContent += `DTSTART:${startClean}\n`;
            icsContent += `DTEND:${endClean}\n`;
            icsContent += `SUMMARY:${b.event_name}\n`;
            icsContent += `DESCRIPTION:Peminjam: ${b.applicant}\\nDeskripsi: ${b.description || '-'}\n`;
            icsContent += `LOCATION:${rName}, SPMR Purbowardayan\n`;
            icsContent += `STATUS:CONFIRMED\n`;
            icsContent += "END:VEVENT\n";
        }
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Jadwal_Kegiatan_SPMR_${new Date().toISOString().split('T')[0]}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// 15. STARTUP APPLICATION ON LOAD
window.addEventListener('DOMContentLoaded', () => {
    initApp();

    // Tutup modal dengan tombol ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    // Tutup dropdown jika klik di luar
    document.addEventListener('click', (e) => {
        const userMenu = document.getElementById('user-profile-menu');
        const notifWrap = document.getElementById('notification-wrap');
        const dropdown = document.getElementById('profile-dropdown-content');
        const notifPanel = document.getElementById('notification-panel');

        if (dropdown && userMenu && !userMenu.contains(e.target)) {
            dropdown.classList.add('hidden');
        }
        if (notifPanel && notifWrap && !notifWrap.contains(e.target)) {
            notifPanel.classList.add('hidden');
        }
    });

    // Klik backdrop (luar modal card) untuk menutup modal
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) {
                backdrop.classList.add('hidden');
                stopCamera();
            }
        });
    });
});