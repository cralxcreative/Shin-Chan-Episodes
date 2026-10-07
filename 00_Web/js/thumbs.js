// =====================================================
//  Miniaturas generadas desde el propio vídeo
//  1) Placeholder inmediato (SVG con el número)
//  2) Cuando la tarjeta es visible: captura un fotograma (canvas) y lo guarda en IndexedDB
//  3) Si el navegador bloquea el canvas (CORS), muestra el fotograma con un <video> sin controles
//  Requiere archive.js (episodePlaceholder, escapeHtml)
// =====================================================
var Thumbs = (function () {
    const DB_NAME = 'shinchan-thumbs';
    const STORE = 'frames';
    const MAX_PARALLEL = 3;
    const W = 320, H = 180;

    const mem = new Map();       // id -> dataURL
    const inflight = new Map();  // id -> Promise
    const failed = new Set();    // ids que no se pudieron capturar en esta sesión
    const waiting = [];
    let active = 0;
    let dbPromise = null;

    // ---------- IndexedDB ----------
    function db() {
        if (!dbPromise) {
            dbPromise = new Promise(resolve => {
                try {
                    const req = indexedDB.open(DB_NAME, 1);
                    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
                    req.onsuccess = () => resolve(req.result);
                    req.onerror = () => resolve(null);
                } catch (e) { resolve(null); }
            });
        }
        return dbPromise;
    }
    async function idbGet(key) {
        const d = await db();
        if (!d) return null;
        return new Promise(resolve => {
            try {
                const q = d.transaction(STORE).objectStore(STORE).get(key);
                q.onsuccess = () => resolve(q.result || null);
                q.onerror = () => resolve(null);
            } catch (e) { resolve(null); }
        });
    }
    async function idbSet(key, val) {
        const d = await db();
        if (!d) return;
        try { d.transaction(STORE, 'readwrite').objectStore(STORE).put(val, key); } catch (e) {}
    }

    // ---------- cola con límite de descargas simultáneas ----------
    function enqueue(task) {
        return new Promise(resolve => {
            waiting.push({ task, resolve });
            pump();
        });
    }
    function pump() {
        while (active < MAX_PARALLEL && waiting.length) {
            const w = waiting.shift();
            active++;
            w.task().then(w.resolve, () => w.resolve(null)).finally(() => { active--; pump(); });
        }
    }

    // ---------- captura de un fotograma ----------
    function capture(url) {
        return new Promise(resolve => {
            const v = document.createElement('video');
            let settled = false;
            const finish = (val) => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                v.removeAttribute('src');
                try { v.load(); } catch (e) {}
                resolve(val);
            };
            const timer = setTimeout(() => finish(null), 25000);

            v.crossOrigin = 'anonymous';
            v.muted = true;
            v.playsInline = true;
            v.preload = 'metadata';

            v.addEventListener('error', () => finish(null));
            v.addEventListener('loadedmetadata', () => {
                const d = v.duration;
                // un punto tempranito pero pasados los créditos iniciales
                v.currentTime = Math.min(120, (isFinite(d) && d > 0 ? d : 240) * 0.25);
            });
            v.addEventListener('seeked', () => {
                try {
                    const c = document.createElement('canvas');
                    c.width = W; c.height = H;
                    const vw = v.videoWidth, vh = v.videoHeight;
                    const s = Math.max(W / vw, H / vh); // "cover"
                    c.getContext('2d').drawImage(v, (W - vw * s) / 2, (H - vh * s) / 2, vw * s, vh * s);
                    finish(c.toDataURL('image/jpeg', 0.72)); // lanza error si el canvas está "tainted"
                } catch (e) { finish(null); }
            });

            v.src = url;
        });
    }

    async function get(id, url) {
        if (mem.has(id)) return mem.get(id);
        const stored = await idbGet(id);
        if (stored) { mem.set(id, stored); return stored; }
        if (failed.has(id)) return null;
        if (inflight.has(id)) return inflight.get(id);

        const p = enqueue(() => capture(url)).then(data => {
            inflight.delete(id);
            if (data) { mem.set(id, data); idbSet(id, data); }
            else failed.add(id);
            return data;
        });
        inflight.set(id, p);
        return p;
    }

    // Solo mira la caché (sin descargar nada)
    async function peek(id) {
        if (mem.has(id)) return mem.get(id);
        const stored = await idbGet(id);
        if (stored) mem.set(id, stored);
        return stored;
    }

    // ---------- DOM ----------
    function videoFallback(img, url) {
        const v = document.createElement('video');
        v.className = img.className;
        v.muted = true;
        v.playsInline = true;
        v.preload = 'metadata';
        v.setAttribute('aria-hidden', 'true');
        v.style.pointerEvents = 'none';
        v.addEventListener('error', () => { if (v.parentNode) v.replaceWith(img); });
        v.src = url + '#t=60';
        img.replaceWith(v);
    }

    async function load(img) {
        const data = await get(img.dataset.thumbId, img.dataset.thumbVideo);
        if (data) img.src = data;
        else videoFallback(img, img.dataset.thumbVideo);
    }

    const io = 'IntersectionObserver' in window
        ? new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) { io.unobserve(e.target); load(e.target); }
            });
        }, { rootMargin: '300px' })
        : null;

    // Busca <img data-thumb-id> sin procesar y las carga cuando sean visibles
    function hydrate(root) {
        (root || document).querySelectorAll('img[data-thumb-id]:not([data-thumb-bound])').forEach(img => {
            img.dataset.thumbBound = '1';
            if (io) io.observe(img); else load(img);
        });
    }

    // HTML de una miniatura (placeholder + datos para hydrate)
    function imgTag(ep, cls, opts) {
        opts = opts || {};
        const label = opts.label !== undefined ? opts.label : ep.id;
        const alt = opts.alt !== undefined ? opts.alt : ep.title;
        return `<img class="${cls}" alt="${escapeHtml(alt)}" src="${episodePlaceholder(label, ep.seasonId)}" ` +
               `data-thumb-id="${ep.id}" data-thumb-video="${escapeHtml(ep.videoUrl)}">`;
    }

    return { img: imgTag, hydrate, peek, get };
})();
