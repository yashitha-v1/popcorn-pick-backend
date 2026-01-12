const express = require("express");
const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Backend running 🚀");
});

app.get("/movies", (req, res) => {
    res.json({ message: "Movies API working" });
});

module.exports = app;
