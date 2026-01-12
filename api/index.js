const express = require("express");
const fetch = require("node-fetch"); // or axios if you prefer

const app = express();

app.use(express.json());

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

app.get("/", (req, res) => {
    res.send("TMDB Backend running on Vercel 🚀");
});

app.get("/movies", async (req, res) => {
    try {
        if (!TMDB_API_KEY) {
            return res.status(500).json({ error: "TMDB API key missing" });
        }

        const response = await fetch(
            `${TMDB_BASE_URL}/movie/popular?api_key=${TMDB_API_KEY}`
        );

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("TMDB error:", error);
        res.status(500).json({ error: "Failed to fetch TMDB movies" });
    }
});

module.exports = app;
