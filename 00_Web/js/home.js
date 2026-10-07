// Página de inicio (index.html, en la raíz) — usa el catálogo de archive.js
const WEB = '00_Web/';
const RECENT_COUNT = 12;
let homeCatalog = null;

function episodeUrl(ep) {
    return `${WEB}player.html?season=${ep.seasonId}&episode=${ep.id}`;
}

function renderSeasons(seasons) {
    const el = document.getElementById('home-seasons');
    el.innerHTML = seasons.map(season => {
        const withThumb = season.episodes.find(ep => ep.thumbnail);
        const thumb = withThumb ? withThumb.thumbnail : THUMB_FALLBACK;
        const alt = withThumb && withThumb.thumbnailAlt ? withThumb.thumbnailAlt : '';
        return `
            <a href="${WEB}episodes.html?season=${season.id}" class="snap-start min-w-[240px] group">
                <div class="aspect-video bg-surface-container rounded-lg overflow-hidden relative mb-3">
                    <div class="w-full h-full group-hover:scale-110 transition-transform duration-700">${seasonCoverHtml(season)}</div>
                    <div class="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                    <span class="absolute top-2 right-2 bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-bold">
                        ${season.episodes.length} eps
                    </span>
                </div>
                <h4 class="font-bold text-lg group-hover:text-primary transition-colors">${escapeHtml(season.name)}</h4>
            </a>`;
    }).join('');
}

function renderRecent(episodes) {
    const el = document.getElementById('home-recent');
    el.innerHTML = episodes.map(ep => `
        <a href="${episodeUrl(ep)}" class="snap-start min-w-[320px] max-w-[320px] group">
            <div class="aspect-video bg-surface-container rounded-lg overflow-hidden relative mb-4">
                <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                     src="${ep.thumbnail || THUMB_FALLBACK}" data-alt="${ep.thumbnailAlt || ''}" onerror="thumbFail(this)" loading="lazy"
                     alt="${escapeHtml(ep.title)}" />
                <div class="absolute inset-0 bg-black/20 group-hover:bg-black/0 transition-colors"></div>
                ${ep.duration ? `<div class="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur text-white text-xs rounded-md">${ep.duration}</div>` : ''}
            </div>
            <h4 class="font-bold text-lg group-hover:text-primary transition-colors line-clamp-2">${escapeHtml(ep.title)}</h4>
            <p class="text-sm text-on-surface-variant">Season ${ep.seasonId} • Ep ${ep.id}</p>
        </a>`).join('');
}

function renderFavorites() {
    const el = document.getElementById('home-favorites');
    if (!homeCatalog) return;
    const byId = new Map(homeCatalog.seasons.flatMap(s => s.episodes).map(ep => [ep.id, ep]));
    const eps = Favorites.all().map(id => byId.get(id)).filter(Boolean);
    if (!eps.length) {
        el.innerHTML = '<p class="text-on-surface-variant py-4">No favorites yet. Tap the heart on any episode to save it here.</p>';
        return;
    }
    el.innerHTML = eps.map(ep => `
        <a href="${episodeUrl(ep)}" class="snap-start min-w-[260px] max-w-[260px] group">
            <div class="aspect-video bg-surface-container rounded-lg overflow-hidden relative mb-3">
                <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                     src="${ep.thumbnail || THUMB_FALLBACK}" data-alt="${ep.thumbnailAlt || ''}" onerror="thumbFail(this)" loading="lazy"
                     alt="${escapeHtml(ep.title)}" />
                <span class="material-symbols-outlined absolute top-2 right-2 text-secondary drop-shadow" style="font-variation-settings: 'FILL' 1;">favorite</span>
            </div>
            <p class="font-bold group-hover:text-primary transition-colors line-clamp-2">${escapeHtml(ep.title)}</p>
            <p class="text-sm text-on-surface-variant">Season ${ep.seasonId} • Ep ${ep.id}</p>
        </a>`).join('');
}

window.addEventListener('favorites:sync', renderFavorites);

// Desliza una fila horizontal (temporadas, recientes, favoritos)
function scrollRow(id, dir) {
    const row = document.getElementById(id);
    if (row) row.scrollBy({ left: dir * Math.max(300, row.clientWidth * 0.8), behavior: 'smooth' });
}

function playRandomEpisodeHome() {
    if (!homeCatalog) return;
    const all = homeCatalog.seasons.flatMap(s => s.episodes);
    if (!all.length) return;
    window.location.href = episodeUrl(all[Math.floor(Math.random() * all.length)]);
}

async function loadHome() {
    try {
        homeCatalog = await getData();
        const all = homeCatalog.seasons.flatMap(s => s.episodes);

        // Hero: un episodio al azar (imagen, título, temporada y botón para verlo)
        const hero = document.getElementById('hero-image');
        const pool = all.filter(e => e.thumbnail);
        if (hero && pool.length) {
            const ep = pool[Math.floor(Math.random() * pool.length)];
            hero.dataset.alt = ep.thumbnailAlt || '';
            hero.onerror = () => thumbFail(hero);
            hero.src = ep.thumbnail;

            document.getElementById('hero-title').textContent = ep.title;
            document.getElementById('hero-meta').textContent =
                `Season ${ep.seasonId} • Ep ${ep.id}${ep.duration ? ' • ' + ep.duration : ''}`;
            const watch = document.getElementById('hero-watch');
            if (watch) watch.onclick = () => { window.location.href = episodeUrl(ep); };
        }

        renderSeasons(homeCatalog.seasons);
        renderFavorites();
        window.addEventListener('pageshow', renderFavorites);
        renderRecent([...all].sort((a, b) => b.id - a.id).slice(0, RECENT_COUNT));

    } catch (error) {
        console.error('Error loading home:', error);
        const t = document.getElementById('hero-title');
        if (t && !t.textContent) t.textContent = 'Shin-chan';
        const msg = '<div class="text-red-500 py-8">Could not load the catalog from archive.org</div>';
        document.getElementById('home-seasons').innerHTML = msg;
        document.getElementById('home-recent').innerHTML = msg;
        document.getElementById('home-favorites').innerHTML = msg;
    }
}

loadHome();
