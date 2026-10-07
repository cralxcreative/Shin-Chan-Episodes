// =====================================================
//  Fuente de datos: Internet Archive
//  Cambia ARCHIVE_ID si algún día subes un item nuevo.
// =====================================================
var ARCHIVE_ID = 'shinchan_episodes-13092026-0930';
var ARCHIVE_BASE = 'https://archive.org';
var ARCHIVE_CACHE_KEY = 'shinchan_archive_v3';
var ARCHIVE_SCRIPT_DIR = (typeof document !== 'undefined' && document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '');
var ARCHIVE_CACHE_TTL = 6 * 60 * 60 * 1000; // 6 horas

// Imagen de reserva (SVG inline, no depende de ningún servicio externo)
var THUMB_FALLBACK = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">' +
    '<rect width="640" height="360" fill="#fdd400"/>' +
    '<text x="50%" y="54%" font-family="Arial, sans-serif" font-size="56" font-weight="800" ' +
    'fill="#594a00" text-anchor="middle">SHIN CHAN</text></svg>'
);

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

// Codifica cada segmento de la ruta por separado (los nombres tienen tildes, ¿, ?, etc.)
function archiveFileUrl(path) {
    return `${ARCHIVE_BASE}/download/${ARCHIVE_ID}/` +
        path.split('/').map(encodeURIComponent).join('/');
}

// onerror de las <img>: primero prueba la miniatura alternativa, luego el SVG de reserva
function thumbFail(img) {
    if (img.dataset.alt && !img.dataset.altTried) {
        img.dataset.altTried = '1';
        img.src = img.dataset.alt;
        return;
    }
    img.onerror = null;
    img.src = THUMB_FALLBACK;
}

function formatDuration(seconds) {
    const total = Math.round(parseFloat(seconds));
    if (!isFinite(total) || total <= 0) return '';
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = n => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

// Convierte la lista de archivos del item en { seasons: [ { id, name, episodes: [...] } ] }
function buildCatalog(meta) {
    const files = meta.files || [];
    const thumbs = {};   // "Season_1/<base>" -> [{ idx, name }]
    const episodes = {}; // id -> episodio

    // Las miniaturas se llaman igual que el vídeo ("1 ShinChaneros - Título._000135.jpg"):
    // comparamos sin ".ia", sin puntos finales y, como alternativa, sin el número inicial
    const normBase = b => b.replace(/\.ia$/, '').replace(/\.+$/, '').trim();
    const noNum = b => b.replace(/^\d+\s+/, '');
    const thumbRe = /\.thumbs\/(Season_\d+)\/(.+)_(\d+)\.jpg$/;
    const videoRe = /^Season_(\d+)\/(\d+) (.+)\.mp4$/;

    for (const f of files) {
        const name = f.name;

        let m = name.match(thumbRe);
        if (m) {
            const b = normBase(m[2]);
            new Set([`${m[1]}/${b}`, `${m[1]}/${noNum(b)}`]).forEach(k => {
                (thumbs[k] = thumbs[k] || []).push({ idx: m[3], name });
            });
            continue;
        }

        m = name.match(videoRe);
        if (!m) continue;

        const isIa = name.endsWith('.ia.mp4'); // derivado H.264 de IA: siempre reproducible en navegador
        const seasonNum = parseInt(m[1], 10);
        const epNum = parseInt(m[2], 10);
        const rawTitle = m[3].replace(/\.ia$/, '');
        const nameBase = name.replace(/^Season_\d+\//, '').replace(/\.mp4$/, '').replace(/\.ia$/, ''); // p. ej. "1 Título."

        // Si hay original y derivado .ia.mp4, nos quedamos con el derivado
        if (episodes[epNum] && episodes[epNum].isIa && !isIa) continue;

        episodes[epNum] = {
            id: epNum,
            seasonId: seasonNum,
            title: rawTitle.replace(/\.+$/, '').trim(),
            thumbKey: `Season_${m[1]}/${normBase(nameBase)}`,
            thumbKeyAlt: `Season_${m[1]}/${normBase(rawTitle)}`,
            guessBase: `Season_${m[1]}/${nameBase}`,
            duration: formatDuration(f.length),
            videoUrl: archiveFileUrl(name),
            isIa
        };
    }

    let unmatched = 0;
    const seasons = {};
    Object.values(episodes).forEach(ep => {
        // Ruta garantizada: <id>.thumbs/Season_N/<base>_000001.jpg
        const first = archiveFileUrl(`${ARCHIVE_ID}.thumbs/${ep.guessBase}_000001.jpg`);
        const list = thumbs[ep.thumbKey] || thumbs[ep.thumbKeyAlt];
        if (!list || !list.length) unmatched++;
        if (list && list.length) {
            // Preferimos un fotograma intermedio (el _000001 suele ser negro/fundido)
            list.sort((a, b) => a.idx.localeCompare(b.idx));
            const pick = list.find(t => t.idx === '000135') || list[Math.floor(list.length / 2)];
            ep.thumbnail = archiveFileUrl(pick.name);
            ep.thumbnailAlt = ep.thumbnail === first ? null : first;
        } else {
            ep.thumbnail = first;
            ep.thumbnailAlt = null;
        }
        delete ep.thumbKey;
        delete ep.thumbKeyAlt;
        delete ep.guessBase;
        delete ep.isIa;
        (seasons[ep.seasonId] = seasons[ep.seasonId] || []).push(ep);
    });

    if (unmatched) console.warn(`[catalog] ${unmatched} episodio(s) sin miniatura emparejada en archive.org`);

    return {
        seasons: Object.keys(seasons)
            .map(Number)
            .sort((a, b) => a - b)
            .map(id => ({
                id,
                name: `Temporada ${id}`,
                episodes: seasons[id].sort((a, b) => a.id - b.id)
            }))
    };
}

function readCache(allowStale) {
    try {
        const cached = JSON.parse(localStorage.getItem(ARCHIVE_CACHE_KEY));
        if (cached && cached.data && (allowStale || Date.now() - cached.t < ARCHIVE_CACHE_TTL)) {
            return cached.data;
        }
    } catch (e) {}
    return null;
}

// Devuelve el catálogo (con caché en localStorage para no pedir la metadata en cada página)
async function getData() {
    const fresh = readCache(false);
    if (fresh) return fresh;

    try {
        const res = await fetch(`${ARCHIVE_BASE}/metadata/${ARCHIVE_ID}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = buildCatalog(await res.json());
        if (!data.seasons.length) throw new Error('El item no contiene episodios');

        try {
            localStorage.setItem(ARCHIVE_CACHE_KEY, JSON.stringify({ t: Date.now(), data }));
        } catch (e) {}
        return data;
    } catch (err) {
        const stale = readCache(true);
        if (stale) return stale;
        throw err;
    }
}


// Elige n episodios repartidos de forma uniforme (estable entre visitas)
function pickSpread(episodes, n) {
    const list = episodes.filter(e => e.thumbnail);
    if (list.length <= n) return list;
    const out = [];
    for (let i = 0; i < n; i++) out.push(list[Math.floor((i + 0.5) * list.length / n)]);
    return out;
}

// Mosaico de fotogramas (n = 4 -> 2x2, n = 6 -> 3x2). Si faltan imágenes, usa una sola.
function mosaicHtml(episodes, n) {
    const picks = pickSpread(episodes, n);
    const img = (ep, cls) => `<img class="${cls}" src="${ep ? ep.thumbnail : THUMB_FALLBACK}" data-alt="${(ep && ep.thumbnailAlt) || ''}" onerror="thumbFail(this)" loading="lazy" alt="" />`;
    if (picks.length < n) return img(picks[0], 'w-full h-full object-cover');
    const cols = n === 6 ? 'grid-cols-3' : 'grid-cols-2';
    return `<div class="grid ${cols} grid-rows-2 w-full h-full">${picks.map(ep => img(ep, 'w-full h-full object-cover')).join('')}</div>`;
}


// Portada de temporada: 00_Web/assets/seasons/Season_N.png (se resuelve igual desde index.html y 00_Web/)
function seasonArt(id) {
    const rel = `assets/seasons/Season_${id}.png`;
    return ARCHIVE_SCRIPT_DIR ? new URL('../' + rel, ARCHIVE_SCRIPT_DIR).href : rel;
}

// Si falta el PNG de una temporada, se sustituye por el mosaico de fotogramas
function seasonArtFail(img, id) {
    img.onerror = null;
    const data = readCache(true);
    const s = data && data.seasons.find(x => x.id === id);
    img.outerHTML = s ? mosaicHtml(s.episodes, 4) : '';
}

function seasonCoverHtml(season) {
    return `<img class="w-full h-full object-cover" src="${seasonArt(season.id)}" alt="${escapeHtml(season.name)}" loading="lazy" onerror="seasonArtFail(this, ${season.id})" />`;
}

// Collage con las portadas de las primeras temporadas (hero de Seasons)
function seasonsCollageHtml(seasons) {
    const list = seasons.slice(0, 6);
    if (list.length <= 1) return list.length ? seasonCoverHtml(list[0]) : '';
    const cols = Math.min(list.length, 3);
    return `<div class="grid w-full h-full" style="grid-template-columns:repeat(${cols},1fr);grid-auto-rows:1fr">${list.map(seasonCoverHtml).join('')}</div>`;
}
