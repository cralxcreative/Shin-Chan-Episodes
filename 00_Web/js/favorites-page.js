// Página de favoritos — requiere favorites.js y archive.js
async function loadFavorites() {
    const grid = document.getElementById('favorites-grid');
    const empty = document.getElementById('favorites-empty');
    const count = document.getElementById('favorites-count');

    try {
        const data = await getData();
        const byId = new Map();
        data.seasons.forEach(s => s.episodes.forEach(ep => byId.set(ep.id, { ...ep, seasonName: s.name })));
        render(byId);
        window.addEventListener('pageshow', () => render(byId));
    } catch (e) {
        console.error('Error loading favorites:', e);
        grid.innerHTML = '<div class="col-span-full text-red-500 py-8">Could not load the catalog from archive.org</div>';
    }

    function render(byId) {
        const eps = Favorites.all().map(id => byId.get(id)).filter(Boolean);
        count.textContent = eps.length ? `${eps.length} saved episode${eps.length === 1 ? '' : 's'}` : '';
        empty.classList.toggle('hidden', eps.length > 0);

        grid.innerHTML = eps.map(ep => `
            <div class="fav-card group relative rounded-lg bg-surface-container-low overflow-hidden cursor-pointer" data-id="${ep.id}">
                <div class="aspect-video relative overflow-hidden bg-surface-container">
                    <img class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                         src="${ep.thumbnail || THUMB_FALLBACK}" data-alt="${ep.thumbnailAlt || ''}" onerror="thumbFail(this)" loading="lazy"
                         alt="${escapeHtml(ep.title)}" />
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <span class="material-symbols-outlined text-white text-5xl opacity-0 group-hover:opacity-100 transition-opacity" style="font-variation-settings: 'FILL' 1;">play_circle</span>
                    </div>
                    ${ep.duration ? `<div class="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded">${ep.duration}</div>` : ''}
                    <button type="button" class="fav-remove absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 flex items-center justify-center hover:scale-110 active:scale-95 transition-all" title="Remove from favorites" aria-label="Remove from favorites">
                        <span class="material-symbols-outlined text-secondary" style="font-variation-settings: 'FILL' 1;">favorite</span>
                    </button>
                </div>
                <div class="p-5">
                    <span class="text-xs font-bold text-primary uppercase tracking-wider">${escapeHtml(ep.seasonName)} • EP ${ep.id}</span>
                    <h4 class="text-lg font-bold text-on-surface mt-1 line-clamp-2 group-hover:text-primary transition-colors">${escapeHtml(ep.title)}</h4>
                </div>
            </div>`).join('');

        grid.querySelectorAll('.fav-card').forEach(card => {
            const ep = byId.get(+card.dataset.id);
            card.addEventListener('click', () => {
                window.location.href = `player.html?season=${ep.seasonId}&episode=${ep.id}`;
            });
            card.querySelector('.fav-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                Favorites.toggle(ep.id);
                render(byId);
            });
        });
    }
}

loadFavorites();
