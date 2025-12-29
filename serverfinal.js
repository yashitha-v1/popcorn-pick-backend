import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import axios from "axios";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

/* =========================
   PATH FIX (ES MODULE)
========================= */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// FRONTEND IS ONE LEVEL UP (D:\popcorn)
const FRONTEND_PATH = path.join(__dirname, "..");

/* =========================
   APP INIT
========================= */
const app = express();
const PORT = process.env.PORT || 3000;

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use(cors());
app.use(express.static(FRONTEND_PATH));

/* =========================
   MONGODB CONNECT
========================= */
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Error:", err));

/* =========================
   USER MODEL  ✅ MISSING BEFORE
========================= */
watchlist: [
    {
        id: Number,
        type: String
    }
]

const User = mongoose.model("User", userSchema);

/* =========================
   TMDB CONFIG
========================= */
const TMDB = "https://api.themoviedb.org/3";
const KEY = process.env.TMDB_KEY;

console.log("TMDB KEY:", KEY ? "LOADED ✅" : "MISSING ❌");

/* =========================
   API ROUTES
========================= */

// 🔥 Trending
app.get("/api/trending", async (req, res) => {
    try {
        const type = req.query.type || "movie";
        const r = await axios.get(`${TMDB}/trending/${type}/day`, {
            params: { api_key: KEY }
        });
        res.json(r.data);
    } catch {
        res.json({ results: [] });
    }
});

// 🎬 Movies / TV
app.get("/api/movies", async (req, res) => {
    try {
        const {
            type = "movie",
            page = 1,
            search = "",
            genre = "",
            rating = "",
            language = "",
            mood = ""
        } = req.query;

        const url = search
            ? `${TMDB}/search/${type}`
            : `${TMDB}/discover/${type}`;

        const params = {
            api_key: KEY,
            page,
            sort_by: "popularity.desc",
            query: search || undefined
        };

        if (genre) params.with_genres = genre;
        if (rating) params["vote_average.gte"] = rating;
        if (language) params.with_original_language = language;

        if (mood === "romantic") params.with_genres = "10749";
        if (mood === "thriller") params.with_genres = "53,27";
        if (mood === "family") params.with_genres = "10751";
        if (mood === "feelgood") params.with_genres = "35";

        const r = await axios.get(url, { params });
        res.json(r.data);
    } catch {
        res.json({ results: [] });
    }
});

// 🎥 Movie Details
app.get("/api/movie/:id", async (req, res) => {
    try {
        const type = req.query.type || "movie";
        const id = req.params.id;

        const [details, credits, videos, providers] = await Promise.all([
            axios.get(`${TMDB}/${type}/${id}`, { params: { api_key: KEY } }),
            axios.get(`${TMDB}/${type}/${id}/credits`, { params: { api_key: KEY } }),
            axios.get(`${TMDB}/${type}/${id}/videos`, { params: { api_key: KEY } }),
            axios.get(`${TMDB}/${type}/${id}/watch/providers`, {
                params: { api_key: KEY }
            })
        ]);

        const trailer = videos.data.results.find(v => v.site === "YouTube");

        let ottLink = null;
        const regions = providers.data.results || {};
        for (const r in regions) {
            if (regions[r]?.link) {
                ottLink = regions[r].link;
                break;
            }
        }

        res.json({
            details: details.data,
            credits: credits.data,
            trailerKey: trailer?.key || null,
            ottLink
        });
    } catch {
        res.json({});
    }
});

/* =========================
   AUTH (JWT) – WORKING
========================= */

// SIGN UP
app.post("/api/auth/signup", async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ msg: "Email and password required" });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(400).json({ msg: "User already exists" });
        }

        const hash = await bcrypt.hash(password, 10);

        const user = await User.create({
            name: name || "User",
            email,
            password: hash,
            watchlist: []
        });

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET
        );

        res.json({ token, name: user.name });
    } catch (err) {
        console.error("SIGNUP ERROR:", err);
        res.status(500).json({ msg: "Signup failed" });
    }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ msg: "Email and password required" });
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ msg: "User not found" });
        }

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) {
            return res.status(401).json({ msg: "Wrong password" });
        }

        const token = jwt.sign(
            { id: user._id },
            process.env.JWT_SECRET
        );

        res.json({ token, name: user.name });
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        res.status(500).json({ msg: "Login failed" });
    }
});
// =========================
// AUTH MIDDLEWARE (ADD ONLY)
// =========================
function auth(req, res, next) {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ msg: "No token" });

    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        next();
    } catch {
        res.status(403).json({ msg: "Invalid token" });
    }
}

/* =========================
   FRONTEND FALLBACK
========================= */
app.get("*", (req, res) => {
    res.sendFile(path.join(FRONTEND_PATH, "index.html"));
});
// =========================
// WATCHLIST APIs (ADD ONLY)
// =========================

// ADD TO WATCHLIST
app.post("/api/watchlist", auth, async (req, res) => {
    const user = await User.findById(req.user.id);

    const exists = user.watchlist.find(
        item => item.id === req.body.id && item.type === req.body.type
    );

    if (!exists) {
        user.watchlist.push({
            id: req.body.id,
            type: req.body.type
        });
        await user.save();
    }

    res.json({ success: true });
});

// GET WATCHLIST
app.get("/api/watchlist", auth, async (req, res) => {
    const user = await User.findById(req.user.id);
    res.json(user.watchlist);
});


/* =========================
   START SERVER
========================= */
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
