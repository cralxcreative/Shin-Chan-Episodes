// Favoritos guardados en localStorage (lista de ids de episodio, el más reciente primero)
var Favorites = (function () {
    const KEY = 'shinchan_favorites_v1';

    function read() {
        try {
            const a = JSON.parse(localStorage.getItem(KEY));
            return Array.isArray(a) ? a : [];
        } catch (e) { return []; }
    }
    function write(list) {
        try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    }
    function has(id) { return read().includes(id); }

    // Devuelve true si el episodio queda como favorito
    function toggle(id) {
        const list = read();
        const i = list.indexOf(id);
        if (i >= 0) list.splice(i, 1); else list.unshift(id);
        write(list);
        window.dispatchEvent(new CustomEvent('favorites:change', { detail: { id, on: i < 0 } }));
        return i < 0;
    }

    return { has, toggle, all: read };
})();
