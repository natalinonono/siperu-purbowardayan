require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 8000;
const BOOKINGS_FILE = path.join(__dirname, 'data', 'bookings.json');
const MONGODB_URI = process.env.MONGODB_URI;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml'
};

let isMongoConnected = false;

// Koneksi ke MongoDB jika URI tersedia
if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => {
            console.log('✅ Berhasil terhubung ke MongoDB Atlas');
            isMongoConnected = true;
        })
        .catch(err => {
            console.error('❌ Gagal terhubung ke MongoDB Atlas, beralih ke local JSON file:', err.message);
            isMongoConnected = false;
        });
} else {
    console.log('ℹ️ MONGODB_URI tidak dikonfigurasi. Menggunakan penyimpanan lokal bookings.json');
}

// Skema Booking untuk MongoDB
const BookingSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    user_id: String,
    user_name: String,
    user_email: String,
    room_id: Number,
    event_name: String,
    description: String,
    applicant: String,
    start_time: String,
    end_time: String,
    status: String,
    photo_before_url: String,
    photo_after_url: String,
    rejection_reason: String,
    previous_version: mongoose.Schema.Types.Mixed,
    created_at: String
}, { minimize: false });

const Booking = mongoose.models.Booking || mongoose.model('Booking', BookingSchema);

// Helper: baca bookings dari db / file
async function readBookings() {
    if (isMongoConnected) {
        try {
            const docs = await Booking.find({}).lean();
            return docs.map(doc => {
                const obj = { ...doc };
                delete obj._id;
                delete obj.__v;
                return obj;
            });
        } catch (e) {
            console.error('Gagal mengambil data dari MongoDB, beralih ke local JSON:', e);
        }
    }
    
    // Fallback lokal
    try {
        const dir = path.dirname(BOOKINGS_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        if (!fs.existsSync(BOOKINGS_FILE)) {
            fs.writeFileSync(BOOKINGS_FILE, '[]', 'utf-8');
        }
        const raw = fs.readFileSync(BOOKINGS_FILE, 'utf-8');
        return JSON.parse(raw || '[]');
    } catch (e) {
        console.error('Gagal membaca bookings.json:', e);
        return [];
    }
}

// Helper: simpan bookings ke db / file
async function writeBookings(data) {
    if (isMongoConnected) {
        try {
            await Booking.deleteMany({});
            if (data && data.length > 0) {
                await Booking.insertMany(data);
            }
            return true;
        } catch (e) {
            console.error('Gagal menyimpan data ke MongoDB, beralih ke local JSON:', e);
        }
    }

    // Fallback lokal
    try {
        fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(data, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('Gagal menulis bookings.json:', e);
        return false;
    }
}

// --- REAL-TIME SSE (SERVER-SENT EVENTS) CLIENTS ---
const sseClients = new Set();

function broadcastEvent(type, data) {
    const payload = `data: ${JSON.stringify({ type, data, timestamp: new Date().toISOString() })}\n\n`;
    for (const client of sseClients) {
        client.write(payload);
    }
}

const server = http.createServer(async (req, res) => {
    // --- API ENDPOINTS ---

    // GET /api/events → SSE Real-Time Stream
    if (req.method === 'GET' && req.url.startsWith('/api/events')) {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        res.write(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'SSE Stream Connected' })}\n\n`);
        
        sseClients.add(res);

        req.on('close', () => {
            sseClients.delete(res);
        });
        return;
    }

    // GET /api/bookings → baca dari db / file
    if (req.method === 'GET' && req.url === '/api/bookings') {
        const data = await readBookings();
        res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(data));
        return;
    }

    // POST /api/bookings → tulis ke db / file & broadcast real-time
    if (req.method === 'POST' && req.url === '/api/bookings') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                const ok = await writeBookings(parsed);
                if (ok) {
                    broadcastEvent('BOOKINGS_UPDATED', parsed);
                }
                res.writeHead(ok ? 200 : 500, {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(JSON.stringify({ success: ok }));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // OPTIONS preflight CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }

    // --- STATIC FILE SERVER ---
    let filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath).toLowerCase();

    // Simple path sanitization to prevent directory traversal
    if (!filePath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Access Denied');
        return;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('404 Not Found');
            } else {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}/`);
    console.log(`Data booking disimpan di: ${BOOKINGS_FILE}`);
});

module.exports = server;