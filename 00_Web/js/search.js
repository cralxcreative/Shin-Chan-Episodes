// =====================================================
//  Buscador global — requiere archive.js (getData, escapeHtml, thumbFail)
//  Atajos: "/" o Ctrl/Cmd+K para abrir · Esc para cerrar · ↑ ↓ Enter para navegar
// =====================================================
(function () {
    // Carpeta de js/ de este script: sirve igual desde index.html (raíz) y desde 00_Web/
    const SCRIPT_DIR = document.currentScript.src.replace(/[^/]*$/, '');
    const playerUrl = (ep) => new URL(`../player.html?season=${ep.seasonId}&episode=${ep.id}`, SCRIPT_DIR).href;

    const MAX_RESULTS = 50;
    let episodes = null;   // lista plana con texto normalizado
    let results = [];
    let active = -1;
    let overlay, input, list, status;

    const normalize = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    async function loadIndex() {
        if (episodes) return;
        const data = await getData();
        episodes = [];
        data.seasons.forEach(season => season.episodes.forEach(ep => {
            episodes.push({
                ...ep,
                seasonName: season.name,
                haystack: normalize(`${ep.id} ep ${ep.title} ${season.name} t${season.id}`)
            });
        }));
    }

    function search(query) {
        const tokens = normalize(query).split(/\s+/).filter(Boolean);
        if (!tokens.length) return [];
        const q = normalize(query).trim();

        return episodes
            .filter(ep => tokens.every(t => ep.haystack.includes(t)))
            .map(ep => {
                // ranking: nº exacto > título empieza por > resto
                let score = 2;
                if (String(ep.id) === q) score = 0;
                else if (normalize(ep.title).startsWith(q)) score = 1;
                return { ep, score };
            })
            .sort((a, b) => a.score - b.score || a.ep.id - b.ep.id)
            .map(r => r.ep);
    }

    function render() {
        const q = input.value.trim();
        if (!q) {
            results = [];
            list.innerHTML = '';
            status.textContent = 'Escribe un título, una palabra o el número del episodio';
            return;
        }
        if (!episodes) return;

        const all = search(q);
        results = all.slice(0, MAX_RESULTS);
        active = results.length ? 0 : -1;

        status.textContent = all.length
            ? `${all.length} resultado${all.length === 1 ? '' : 's'}${all.length > MAX_RESULTS ? ` (mostrando ${MAX_RESULTS})` : ''}`
            : 'Sin resultados';

        list.innerHTML = results.map((ep, i) => `
            <a href="${playerUrl(ep)}" data-i="${i}"
               class="search-item flex items-center gap-4 p-3 rounded-lg hover:bg-surface-container-low transition-colors">
                <img src="${ep.thumbnail || THUMB_FALLBACK}" data-alt="${ep.thumbnailAlt || ''}" onerror="thumbFail(this)" loading="lazy"
                     alt="" class="w-28 h-16 object-cover rounded-md flex-shrink-0 bg-surface-container" />
                <div class="min-w-0">
                    <div class="text-xs font-bold uppercase tracking-wider text-primary">EP ${ep.id} · ${escapeHtml(ep.seasonName)}${ep.duration ? ' · ' + ep.duration : ''}</div>
                    <div class="font-bold text-on-surface line-clamp-2">${escapeHtml(ep.title)}</div>
                </div>
            </a>`).join('');
        highlight();
    }

    function highlight() {
        list.querySelectorAll('.search-item').forEach((el, i) => {
            el.classList.toggle('bg-surface-container-low', i === active);
            if (i === active) el.scrollIntoView({ block: 'nearest' });
        });
    }

    function build() {
        overlay = document.createElement('div');
        overlay.className = 'fixed inset-0 z-[100] hidden bg-black/50 backdrop-blur-sm px-4';
        overlay.innerHTML = `
            <div class="max-w-2xl mx-auto mt-16 md:mt-24 bg-surface-container-lowest rounded-lg shadow-2xl overflow-hidden" role="dialog" aria-label="Buscar episodios">
                <div class="flex items-center gap-3 px-5 py-4 border-b border-outline-variant/20">
                    <span class="material-symbols-outlined text-on-surface-variant">search</span>
                    <input type="text" autocomplete="off" spellcheck="false" placeholder="Buscar episodios..."
                           class="flex-1 bg-transparent outline-none border-0 focus:ring-0 text-lg text-on-surface placeholder:text-on-surface-variant" />
                    <button type="button" class="search-close material-symbols-outlined text-on-surface-variant hover:text-on-surface">close</button>
                </div>
                <div class="search-status px-5 pt-3 text-xs font-semibold text-on-surface-variant"></div>
                <div class="search-list max-h-[60vh] overflow-y-auto p-2"></div>
            </div>`;
        document.body.appendChild(overlay);

        input = overlay.querySelector('input');
        list = overlay.querySelector('.search-list');
        status = overlay.querySelector('.search-status');

        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('.search-close').addEventListener('click', close);
        list.addEventListener('mousemove', (e) => {
            const item = e.target.closest('.search-item');
            if (item) { active = +item.dataset.i; highlight(); }
        });

        let timer;
        input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(render, 80); });
        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown' && results.length) { e.preventDefault(); active = (active + 1) % results.length; highlight(); }
            else if (e.key === 'ArrowUp' && results.length) { e.preventDefault(); active = (active - 1 + results.length) % results.length; highlight(); }
            else if (e.key === 'Enter' && results[active]) { window.location.href = playerUrl(results[active]); }
        });
    }

    async function open() {
        if (!overlay) build();
        overlay.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        input.focus();
        input.select();

        if (!episodes) {
            status.textContent = 'Cargando catálogo...';
            try {
                await loadIndex();
            } catch (e) {
                console.error('Search index error:', e);
                status.textContent = 'No se pudo cargar el catálogo';
                return;
            }
        }
        render();
    }

    function close() {
        if (!overlay) return;
        overlay.classList.add('hidden');
        document.body.style.overflow = '';
    }

    // Botones de búsqueda del header (el de escritorio ya existe) + uno para móvil
    function wireButtons() {
        const header = document.querySelector('header');
        if (!header) return;

        header.querySelectorAll('button').forEach(btn => {
            if (btn.textContent.trim() === 'search') {
                btn.setAttribute('aria-label', 'Buscar');
                btn.addEventListener('click', open);
            }
        });

        const mobileBtn = document.createElement('button');
        mobileBtn.className = 'md:hidden material-symbols-outlined text-[#2d2f2f]';
        mobileBtn.setAttribute('aria-label', 'Buscar');
        mobileBtn.textContent = 'search';
        mobileBtn.addEventListener('click', open);
        header.appendChild(mobileBtn);
    }

    document.addEventListener('keydown', (e) => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
        if ((e.key === 'k' && (e.ctrlKey || e.metaKey)) || (e.key === '/' && !typing)) {
            e.preventDefault();
            open();
        } else if (e.key === 'Escape') {
            close();
        }
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireButtons);
    else wireButtons();
})();
