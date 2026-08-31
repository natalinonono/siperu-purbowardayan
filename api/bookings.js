const http = require('http');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

let isMongoConnected = false;

if (MONGODB_URI) {
    mongoose.connect(MONGODB_URI)
        .then(() => {
            isMongoConnected = true;
        })
        .catch(err => {
            isMongoConnected = false;
        });
}

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

// In-Memory Cloud Storage fallback with initial state
const INITIAL_DEFAULT_BOOKINGS = [
    {
        id: "b_demo_1",
        user_id: "u_demo_omk",
        user_name: "Ignatius Budi",
        user_email: "jemaat.aktif@gmail.com",
        room_id: 1,
        event_name: "Latihan Koor & Rapat OMK",
        description: "Persiapan tugas koor Misa Minggu",
        applicant: "OMK Paroki",
        start_time: "2026-08-31T09:00",
        end_time: "2026-08-31T11:30",
        status: "APPROVED",
        photo_before_url: "",
        photo_after_url: "",
        rejection_reason: "",
        created_at: "2026-08-30T10:00:00.000Z"
    }
];

let memoryBookings = [...INITIAL_DEFAULT_BOOKINGS];

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.statusCode = 200;
        res.end();
        return;
    }

    if (req.method === 'GET') {
        if (isMongoConnected) {
            try {
                const docs = await Booking.find({}).lean();
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(docs));
                return;
            } catch (e) {}
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(memoryBookings));
        return;
    }

    if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', async () => {
            try {
                const parsed = JSON.parse(body);
                memoryBookings = parsed;
                if (isMongoConnected) {
                    try {
                        await Booking.deleteMany({});
                        if (parsed && parsed.length > 0) {
                            await Booking.insertMany(parsed);
                        }
                    } catch (e) {}
                }
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
            } catch (err) {
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    }
};
