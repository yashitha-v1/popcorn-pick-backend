/* =====================================================
   CONFIG
===================================================== */
const BACKEND = "http://localhost:3000";
const IMG = "https://image.tmdb.org/t/p/w500";

/* =====================================================
   ELEMENTS
===================================================== */
const grid = document.querySelector(".grid");

const trendingRow = document.getElementById("trendingRow");
const continueRow = document.getElementById("continueRow");
const recommendedRow = document.getElementById("recommendedRow");

const searchBox = document.getElementById("searchBox");
const genreFilter = document.getElementById("genreFilter");
const ratingFilter = document.getElementById("ratingFilter");
const languageFilter = document.getElementById("languageFilter");
const moodFilter = document.getElementById("moodFilter");

const navMovies = document.getElementById("navMovies");
const navShows = document.getElementById("navShows");
const navWatchlist = document.getElementById("navWatchlist");

const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const authModal = document.getElementById("authModal");
const closeAuth = document.getElementById("closeAuth");
const authTitle = document.getElementById("authTitle");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const authSubmit = document.getElementById("authSubmit");
const authToggle = document.getElementById("authToggle");
const authMsg = document.getElementById("authMsg");

const infoOverlay = document.getElementById("infoOverlay");

/* =====================================================
   STATE
===================================================== */
let currentType = "movie";
let page = 1;
let loading = false;
let inWatchlist = false;
let isSignup = false;

let currentUser = JSON.parse(localStorage.getItem("currentUser"));
let watchlist = JSON.parse(localStorage.getItem("watchlist") || "[]");

/* =====================================================
   RESTORE LOGIN
===================================================== */
if (currentUser) {
    loginBtn.innerText = currentUser.name;
    logoutBtn.style.display = "inline-block";
}

/* =====================================================
   SAFE FETCH
===================================================== */
async function fetchJSON(url, fallback = { results: [] }) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error();
        return await res.json();
    } catch {
        return fallback;
    }
}

/* =====================================================
   ACTIVE TAB
===================================================== */
function setActiveTab(activeBtn) {
    [navMovies, navShows, navWatchlist].forEach(btn =>
        btn.classList.remove("active")
    );
    activeBtn.classList.add("active");
}

/* =====================================================
   INIT
===================================================== */
setActiveTab(navMovies);
loadHome();
loadBrowse();

/* =====================================================
   NAVIGATION
===================================================== */
navMovies.onclick = () => {
    inWatchlist = false;
    setActiveTab(navMovies);
    switchType("movie");
};

navShows.onclick = () => {
    inWatchlist = false;
    setActiveTab(navShows);
    switchType("tv");
};

navWatchlist.onclick = () => {
    setActiveTab(navWatchlist);
    openWatchlist();
};

function switchType(type) {
    currentType = type;
    page = 1;
    grid.innerHTML = "";
    loadHome();
    loadBrowse();
}

/* =====================================================
   HOME SECTIONS
===================================================== */
async function loadHome() {
    loadRow(trendingRow, `/api/trending?type=${currentType}`);
    loadRow(continueRow, `/api/movies?type=${currentType}&page=1`);
    loadRow(recommendedRow, `/api/movies?type=${currentType}&rating=7`);
}

async function loadRow(row, endpoint) {
    const data = await fetchJSON(BACKEND + endpoint);
    row.innerHTML = "";
    data.results.slice(0, 10).forEach(m => row.appendChild(movieCard(m)));
}

/* =====================================================
   BROWSE + INFINITE SCROLL
===================================================== */
async function loadBrowse() {
    if (loading || inWatchlist) return;
    loading = true;

    const url =
        `${BACKEND}/api/movies?type=${currentType}` +
        `&page=${page}` +
        `&search=${searchBox.value}` +
        `&genre=${genreFilter.value}` +
        `&rating=${ratingFilter.value}` +
        `&language=${languageFilter.value}` +
        `&mood=${moodFilter.value}`;

    const data = await fetchJSON(url);
    data.results.forEach(m => grid.appendChild(movieCard(m)));

    loading = false;
}

window.addEventListener("scroll", () => {
    if (inWatchlist) return;
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) {
        page++;
        loadBrowse();
    }
});

/* =====================================================
   SEARCH & FILTERS
===================================================== */
searchBox.addEventListener("input", debounce(resetBrowse, 400));
genreFilter.onchange = resetBrowse;
ratingFilter.onchange = resetBrowse;
languageFilter.onchange = resetBrowse;
moodFilter.onchange = resetBrowse;

function resetBrowse() {
    inWatchlist = false;
    page = 1;
    grid.innerHTML = "";
    loadBrowse();
}

/* =====================================================
   MOVIE CARD
===================================================== */
function movieCard(movie) {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
    <img src="${movie.poster_path ? IMG + movie.poster_path : "https://via.placeholder.com/300x450?text=No+Image"}">
    <h4>${movie.title || movie.name}</h4>
    <p>⭐ ${movie.vote_average || "N/A"}</p>
  `;

    div.onclick = () => openDetails(movie.id, movie._type || currentType);
    return div;
}

/* =====================================================
   MOVIE DETAILS
===================================================== */
async function openDetails(id, type = currentType) {
    const data = await fetchJSON(`${BACKEND}/api/movie/${id}?type=${type}`);
    if (!data.details) return;

    const director =
        data.credits?.crew?.find(p => p.job === "Director")?.name || "N/A";

    const cast =
        data.credits?.cast?.slice(0, 8).map(c => c.name).join(", ") || "N/A";

    infoOverlay.innerHTML = `
    <div class="infoCard full">
      <button class="closeDetails">✕</button>
      <img src="${data.details.poster_path ? IMG + data.details.poster_path : "https://via.placeholder.com/500x750?text=No+Image"}">
      <h2>${data.details.title || data.details.name}</h2>
      <p>${data.details.overview}</p>
      <p><b>Director:</b> ${director}</p>
      <p><b>Cast:</b> ${cast}</p>
      <div class="actions">
        ${data.trailerKey ? `<a target="_blank" href="https://youtube.com/watch?v=${data.trailerKey}">▶ Trailer</a>` : ""}
        ${data.ottLink ? `<a target="_blank" href="${data.ottLink}">📺 Watch</a>` : "<span>OTT not available</span>"}
        <button onclick="addToWatchlist(${id})">➕ Watchlist</button>
      </div>
    </div>
  `;

    infoOverlay.style.display = "flex";
    infoOverlay.onclick = () => (infoOverlay.style.display = "none");
    document.querySelector(".infoCard").onclick = e => e.stopPropagation();
    document.querySelector(".closeDetails").onclick = () =>
        (infoOverlay.style.display = "none");
}

/* =====================================================
   WATCHLIST
===================================================== */
function openWatchlist() {
    if (!currentUser) {
        showLoginMessage();
        return;
    }
    inWatchlist = true;
    renderWatchlist();
}

function showLoginMessage() {
    grid.innerHTML = `
    <div class="card loginPromptCard">
      <h2>🔒 Login Required</h2>
      <p>
        Please <span class="loginLink">login</span> or
        <span class="loginLink">sign up</span> to view your watchlist.
      </p>
    </div>
  `;

    document.querySelectorAll(".loginLink").forEach(el => {
        el.onclick = () => {
            authMsg.innerText = "";
            authModal.style.display = "flex";
        };
    });
}

function addToWatchlist(id) {
    if (!currentUser) {
        showLoginMessage();
        return;
    }

    const exists = watchlist.find(
        item => item.id === id && item.type === currentType
    );

    if (!exists) {
        watchlist.push({ id, type: currentType });
        localStorage.setItem("watchlist", JSON.stringify(watchlist));
        alert("Added to Watchlist");
    }
}

async function renderWatchlist() {
    grid.innerHTML = "";

    for (const item of watchlist) {
        const data = await fetchJSON(
            `${BACKEND}/api/movie/${item.id}?type=${item.type}`
        );

        if (!data.details) continue;

        grid.appendChild(
            movieCard({
                id: item.id,
                title: data.details.title || data.details.name,
                poster_path: data.details.poster_path,
                vote_average: data.details.vote_average,
                _type: item.type
            })
        );
    }
}

/* =====================================================
   AUTH
===================================================== */
loginBtn.onclick = () => {
    authMsg.innerText = "";
    authModal.style.display = "flex";
};

closeAuth.onclick = () => (authModal.style.display = "none");

authToggle.onclick = () => {
    isSignup = !isSignup;
    authTitle.innerText = isSignup ? "Create Profile" : "Sign In";
    authName.style.display = isSignup ? "block" : "none";
};

authSubmit.onclick = async () => {
    if (!authEmail.value || !authPassword.value) {
        authMsg.innerText = "Email and password required";
        return;
    }

    const endpoint = isSignup ? "/api/auth/signup" : "/api/auth/login";

    const res = await fetch(BACKEND + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: authName.value,
            email: authEmail.value,
            password: authPassword.value
        })
    });

    const data = await res.json();

    if (!res.ok) {
        authMsg.innerText = data.msg || "Auth failed";
        return;
    }

    currentUser = { name: data.name, token: data.token };
    localStorage.setItem("currentUser", JSON.stringify(currentUser));

    loginBtn.innerText = data.name;
    logoutBtn.style.display = "inline-block";
    authModal.style.display = "none";
};

/* =====================================================
   LOGOUT
===================================================== */
logoutBtn.onclick = () => {
    localStorage.removeItem("currentUser");
    currentUser = null;
    logoutBtn.style.display = "none";
    loginBtn.innerText = "Sign In";
    setActiveTab(navMovies);
    switchType("movie");
};

/* =====================================================
   UTIL
===================================================== */
function debounce(fn, delay) {
    let t;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), delay);
    };
}
