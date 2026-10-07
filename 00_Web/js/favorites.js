// =====================================================
//  Favoritos
//  - Siempre funcionan en localStorage (lista de ids, el más reciente primero)
//  - Si inicias sesión con Google, se sincronizan con Firestore (users/{uid}.favs = { id: timestamp })
//  - Carga el SDK de Firebase por su cuenta: las páginas solo necesitan incluir este archivo
//  Eventos: 'favorites:change' (toggle propio) · 'favorites:sync' (la nube actualizó la lista local)
// =====================================================
var Favorites = (function () {
    const KEY = 'shinchan_favorites_v1';
    const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/';
    const DIR = ((typeof document !== 'undefined' && document.currentScript && document.currentScript.src) || '').replace(/[^/]*$/, '');

    let auth = null, db = null, user = null, unsubscribe = null;
    let synced = false, wasSignedIn = false, authResolved = false;
    let settle;
    const settled = new Promise(r => { settle = r; });   // la lista ya refleja la cuenta (o no hay cuenta)
    setTimeout(settle, 4000);                             // nunca bloquear la UI más de 4 s
    const buttons = [];
    let menu = null;

    // ---------- localStorage ----------
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
    function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }

    // ---------- API pública ----------
    // Devuelve true si el episodio queda como favorito
    function toggle(id) {
        const list = read();
        const i = list.indexOf(id);
        const on = i < 0;
        if (on) list.unshift(id); else list.splice(i, 1);
        write(list);
        cloudSet(id, on);
        emit('favorites:change', { id, on });
        return on;
    }

    // ---------- Firestore ----------
    const FV = () => firebase.firestore.FieldValue;
    const userDoc = () => db.collection('users').doc(user.uid);
    const warn = (e) => console.warn('[favorites] cloud error:', e && e.code || e);

    function cloudSet(id, on) {
        if (!db || !user) return;
        userDoc().set({
            favs: { [id]: on ? Date.now() : FV().delete() },
            updatedAt: FV().serverTimestamp()
        }, { merge: true }).catch(warn);
    }

    function startSync() {
        unsubscribe = userDoc().onSnapshot(snap => {
            const exists = typeof snap.exists === 'function' ? snap.exists() : snap.exists;
            const cloud = (exists && snap.data().favs) || {};
            const map = Object.assign({}, cloud);

            // Primera sincronización tras iniciar sesión: los favoritos locales se suben a la cuenta
            if (!synced) {
                synced = true;
                const now = Date.now();
                const upload = {};
                read().forEach((id, i) => {
                    if (!(id in cloud)) { upload[id] = now - i; map[id] = now - i; }
                });
                if (Object.keys(upload).length) {
                    userDoc().set({ favs: upload, updatedAt: FV().serverTimestamp() }, { merge: true }).catch(warn);
                }
            }

            write(Object.keys(map).map(Number).sort((a, b) => map[b] - map[a]));
            emit('favorites:sync');
            settle();
        }, err => { warn(err); settle(); });
    }

    function onAuth(u) {
        authResolved = true;
        if (unsubscribe) { unsubscribe(); unsubscribe = null; }
        user = u;
        synced = false;
        if (u) {
            wasSignedIn = true;
            startSync();
        } else {
            // Al cerrar sesión, la lista local (que era de la cuenta) se limpia
            if (wasSignedIn) { write([]); emit('favorites:sync'); wasSignedIn = false; }
            settle();
        }
        renderAuth();
    }

    function signIn() {
        if (!auth) return;
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(err => {
            if (err.code === 'auth/popup-blocked' || err.code === 'auth/operation-not-supported-in-this-environment') {
                auth.signInWithRedirect(provider);
            } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                console.error('Sign-in error:', err);
                alert('Could not sign in: ' + err.message);
            }
        });
    }
    function signOut() { if (auth) auth.signOut(); }

    // ---------- Botón de cuenta en el header ----------
    function closeMenu() { if (menu) { menu.remove(); menu = null; } }

    function openMenu() {
        if (menu) { closeMenu(); return; }
        menu = document.createElement('div');
        menu.className = 'fixed top-16 right-4 z-[60] bg-white rounded-lg shadow-2xl p-4 min-w-[220px] space-y-3';
        const info = document.createElement('div');
        const name = document.createElement('div');
        name.className = 'font-bold text-sm text-[#2d2f2f]';
        name.textContent = user.displayName || 'Signed in';
        const mail = document.createElement('div');
        mail.className = 'text-xs text-[#5a5c5c] break-all';
        mail.textContent = user.email || '';
        info.append(name, mail);
        const out = document.createElement('button');
        out.type = 'button';
        out.className = 'w-full bg-[#fdd400] text-[#594a00] font-bold text-sm px-4 py-2 rounded-full hover:scale-105 active:scale-95 transition-all';
        out.textContent = 'Sign out';
        out.onclick = () => { closeMenu(); signOut(); };
        menu.append(info, out);
        document.body.appendChild(menu);
    }

    function makeButton() {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'auth-btn flex items-center gap-2 text-[#2d2f2f] hover:text-[#6d5a00] hover:scale-105 transition-all';
        b.style.visibility = 'hidden';
        b.addEventListener('click', () => { if (user) openMenu(); else signIn(); });
        buttons.push(b);
        return b;
    }

    function renderAuth() {
        buttons.forEach(b => {
            b.style.visibility = authResolved ? 'visible' : 'hidden';
            b.textContent = '';
            if (user && user.photoURL) {
                const img = document.createElement('img');
                img.src = user.photoURL;
                img.alt = '';
                img.referrerPolicy = 'no-referrer';
                img.className = 'w-8 h-8 rounded-full object-cover';
                b.appendChild(img);
            } else {
                const ic = document.createElement('span');
                ic.className = 'material-symbols-outlined';
                ic.textContent = 'account_circle';
                b.appendChild(ic);
                if (!user) {
                    const t = document.createElement('span');
                    t.className = 'hidden md:inline text-sm font-bold font-headline';
                    t.textContent = 'Sign in';
                    b.appendChild(t);
                }
            }
            b.title = user ? (user.displayName || user.email || 'Account') : 'Sign in with Google';
        });
        if (!user) closeMenu();
    }

    function mountButtons() {
        const header = document.querySelector('header');
        if (!header) return;
        const desktop = header.querySelector('div.hidden');
        if (desktop) desktop.appendChild(makeButton());

        // Contenedor móvil compartido con el botón de búsqueda (search.js lo reutiliza)
        let wrap = header.querySelector('#mobile-actions');
        if (!wrap) {
            wrap = document.createElement('div');
            wrap.id = 'mobile-actions';
            wrap.className = 'md:hidden flex items-center gap-4 ml-auto';
            header.appendChild(wrap);
        }
        wrap.appendChild(makeButton());
        renderAuth();

        document.addEventListener('click', (e) => {
            if (menu && !menu.contains(e.target) && !e.target.closest('.auth-btn')) closeMenu();
        });
    }

    // ---------- Carga del SDK ----------
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = () => reject(new Error('No se pudo cargar ' + src));
            document.head.appendChild(s);
        });
    }

    function boot() {
        loadScript(DIR + 'firebase-config.js')
            .then(() => loadScript(SDK + 'firebase-app-compat.js'))
            .then(() => Promise.all([
                loadScript(SDK + 'firebase-auth-compat.js'),
                loadScript(SDK + 'firebase-firestore-compat.js')
            ]))
            .then(() => {
                firebase.initializeApp(firebaseConfig);
                auth = firebase.auth();
                db = firebase.firestore();
                auth.onAuthStateChanged(onAuth);
            })
            .catch(e => {
                console.warn('[favorites] Firebase no disponible, se usa solo el almacenamiento local:', e.message);
                settle();
            });
    }

    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountButtons);
        else mountButtons();
        boot();
    }

    return { has, toggle, all: read, settled, signIn, signOut };
})();
