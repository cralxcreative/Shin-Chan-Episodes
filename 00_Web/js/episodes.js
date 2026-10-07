// Get season ID from URL params
const urlParams = new URLSearchParams(window.location.search);
const seasonId = parseInt(urlParams.get('season')) || 1;
let favPainters = [];

// Load episodes from archive.org
async function loadEpisodes() {
    try {
        const data = await getData();
        const season = data.seasons.find(s => s.id === seasonId);

        if (season) {
            displaySeason(season);
            setupNextSeason(data, season);
            displayEpisodes(season.episodes);
        } else {
            document.getElementById('episodes-container').innerHTML = 
                '<div class="text-center py-12 text-on-surface-variant">Temporada no encontrada</div>';
        }
    } catch (error) {
        console.error('Error loading episodes:', error);
        document.getElementById('episodes-container').innerHTML = 
            '<div class="text-center py-12 text-red-500">Error al cargar los episodios</div>';
    }
}

// Botón "Temporada siguiente" (se oculta en la última)
function setupNextSeason(data, season) {
    const btn = document.getElementById('next-season-btn');
    const next = data.seasons[data.seasons.findIndex(s => s.id === season.id) + 1];
    if (!btn || !next) return;
    btn.href = `episodes.html?season=${next.id}`;
    btn.classList.remove('hidden');
    btn.classList.add('flex');
}

function displaySeason(season) {
    document.getElementById('season-title').textContent = season.name;
    document.getElementById('season-info').textContent = `${season.episodes.length} Episodios`;
    document.getElementById('episode-count').textContent = season.episodes.length;
    document.title = `${season.name} - SHIN CHAN`;

    // Portada: artwork de la temporada (si falta, un fotograma intermedio)
    const cover = document.getElementById('season-cover');
    if (cover) {
        const pick = pickSpread(season.episodes, 3)[1] || pickSpread(season.episodes, 3)[0];
        cover.onerror = () => {
            cover.onerror = null;
            if (pick) {
                cover.dataset.alt = pick.thumbnailAlt || '';
                cover.onerror = () => thumbFail(cover);
                cover.src = pick.thumbnail;
            }
        };
        cover.src = seasonArt(season.id);
    }
}

function displayEpisodes(episodes) {
    const container = document.getElementById('episodes-container');
    container.innerHTML = '';
    favPainters = [];

    episodes.forEach((episode) => {
        const episodeEl = document.createElement('div');
        episodeEl.className = 'group flex flex-col md:flex-row items-center gap-6 p-4 rounded-lg bg-surface-container-lowest hover:bg-surface-container-low transition-all duration-300 cursor-pointer';
        episodeEl.onclick = () => playEpisode(episode);
        
        const title = escapeHtml(episode.title);
        const durationBadge = episode.duration ? `
                <div class="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded">
                    ${episode.duration}
                </div>` : '';

        episodeEl.innerHTML = `
            <div class="relative w-full md:w-64 h-36 flex-shrink-0 overflow-hidden rounded-lg">
                <img 
                    alt="${title}" 
                    class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                    src="${episode.thumbnail || THUMB_FALLBACK}" 
                    loading="lazy"
                    data-alt="${episode.thumbnailAlt || ''}"
                    onerror="thumbFail(this)"
                />
                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                    <span class="material-symbols-outlined text-white text-5xl opacity-0 group-hover:opacity-100 transition-opacity" style="font-variation-settings: 'FILL' 1;">play_circle</span>
                </div>${durationBadge}
            </div>
            <div class="flex-1 space-y-1 w-full">
                <span class="text-primary font-bold text-sm tracking-wider uppercase">EP ${episode.id}</span>
                <h3 class="text-xl font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-2">
                    ${title}
                </h3>
            </div>
        `;
        
        // Botón de favorito
        const favBtn = document.createElement('button');
        favBtn.type = 'button';
        favBtn.className = 'fav-btn flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-on-surface-variant hover:bg-surface-container hover:scale-110 active:scale-95 transition-all self-end md:self-center';
        const paintFav = () => {
            const on = Favorites.has(episode.id);
            favBtn.innerHTML = `<span class="material-symbols-outlined ${on ? 'text-secondary' : ''}" style="font-variation-settings: 'FILL' ${on ? 1 : 0};">favorite</span>`;
            favBtn.title = on ? 'Quitar de favoritos' : 'Añadir a favoritos';
            favBtn.setAttribute('aria-pressed', on);
        };
        paintFav();
        favPainters.push(paintFav);
        favBtn.onclick = (e) => { e.stopPropagation(); Favorites.toggle(episode.id); paintFav(); };
        episodeEl.appendChild(favBtn);

        container.appendChild(episodeEl);
    });
}

function playRandomEpisode() {
    const episodes = document.querySelectorAll('#episodes-container > div');
    
    if (episodes.length > 0) {
        // Generamos un índice entre 0 y el total de episodios - 1
        const randomIndex = Math.floor(Math.random() * episodes.length);
        
        // Hacemos clic en el episodio aleatorio
        episodes[randomIndex].click();
    }
}

function playEpisode(episode) {
    // Store episode data in sessionStorage
    sessionStorage.setItem('currentEpisode', JSON.stringify({
        ...episode,
        seasonId: seasonId
    }));
    
    // Redirect to player
    window.location.href = 'player.html?season=' + seasonId + '&episode=' + episode.id;
}

// Si la nube actualiza los favoritos, repintar los corazones
window.addEventListener('favorites:sync', () => favPainters.forEach(paint => paint()));

// Load episodes on page load
loadEpisodes();
