async function loadSeasons() {
    try {
        const data = await getData();
        displaySeasons(data.seasons);
    } catch (error) {
        console.error('Error loading seasons:', error);
        document.getElementById('seasons-container').innerHTML = 
            '<div class="col-span-full text-center py-12 text-red-500">Error al cargar las temporadas</div>';
    }
}

function displaySeasons(seasons) {
    const container = document.getElementById('seasons-container');
    container.innerHTML = '';

    seasons.forEach((season) => {
        const seasonCard = document.createElement('div');
        seasonCard.className = 'group cursor-pointer rounded-lg overflow-hidden bg-surface-container-low hover:bg-surface-container transition-all duration-300 border border-outline-variant/5 hover:border-primary/30 shadow-md hover:shadow-xl';
        seasonCard.onclick = () => window.location.href = `episodes.html?season=${season.id}`;
        
        // Miniatura de la temporada: la primera que tenga imagen (estable entre visitas)
        const withThumb = season.episodes.find(ep => ep.thumbnail);
        const thumbnail = withThumb ? withThumb.thumbnail : THUMB_FALLBACK;
        
        seasonCard.innerHTML = `
            <div class="relative overflow-hidden h-64">
                <div class="w-full h-full group-hover:scale-110 transition-transform duration-500">${seasonCoverHtml(season)}</div>
                <div class="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <span class="material-symbols-outlined text-white text-6xl" style="font-variation-settings: 'FILL' 1;">play_circle</span>
                </div>
                <div class="absolute top-4 right-4">
                    <span class="bg-primary-container text-on-primary-container px-3 py-1 rounded-full text-xs font-bold">
                        ${season.episodes.length} eps
                    </span>
                </div>
            </div>
            <div class="p-6">
                <h3 class="text-2xl font-bold text-on-surface mb-2 group-hover:text-primary transition-colors">
                    ${escapeHtml(season.name)}
                </h3>
                <div class="flex items-center gap-2 text-primary font-bold text-sm group-hover:translate-x-1 transition-transform">
                    Ver episodios
                    <span class="material-symbols-outlined text-sm">arrow_forward</span>
                </div>
            </div>
        `;
        
        container.appendChild(seasonCard);
    });
}


function playRandomSeason() {
    const seasons = document.querySelectorAll('#seasons-container > div');
    
    if (seasons.length > 0) {
        // Generamos un índice entre 0 y el total de temporadas - 1
        const randomIndex = Math.floor(Math.random() * seasons.length);
        
        // Hacemos clic en la temporada aleatoria
        seasons[randomIndex].click();
    }
}

loadSeasons();
