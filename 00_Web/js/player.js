const urlParams = new URLSearchParams(window.location.search);
const seasonId = parseInt(urlParams.get('season')) || 1;
const episodeId = parseInt(urlParams.get('episode')) || 1;

const video = document.getElementById('main-video');
const playPauseBtn = document.getElementById('play-pause');
const playIcon = document.getElementById('play-icon');
const overlayPlayIcon = document.getElementById('overlay-play-icon');
const progressContainer = document.getElementById('progress-container');
const progressBar = document.getElementById('progress-bar');
const currentTimeDisplay = document.getElementById('current-time');
const durationDisplay = document.getElementById('duration-time');
const playerControls = document.querySelector('.player-controls');
const backgroundImage = document.getElementById('background-image');
let controlsTimeout;
let isMuted = false;

let currentEpisode = null;

// Load episode data
async function loadEpisode() {
    try {
        let episode = null;

        // Solo reutilizamos el episodio guardado si coincide con la URL
        try {
            const stored = JSON.parse(sessionStorage.getItem('currentEpisode'));
            if (stored && stored.id === episodeId && stored.seasonId === seasonId) {
                episode = stored;
            }
        } catch (e) {}

        if (!episode) {
            const data = await getData();
            const season = data.seasons.find(s => s.id === seasonId);
            episode = season && season.episodes.find(e => e.id === episodeId);
        }

        if (episode) {
            currentEpisode = episode;
            displayEpisodeInfo(episode);
            loadVideo(episode);
        } else {
            showError('Episodio no encontrado');
        }
    } catch (error) {
        console.error('Error loading episode:', error);
        showError('Error al cargar el episodio');
    }
}

function displayEpisodeInfo(episode) {
    document.getElementById('episode-title').textContent = episode.title;
    document.getElementById('episode-badge').textContent = `Episodio ${episode.id}`;
    document.title = `${episode.title} - SHIN CHAN`;
    backgroundImage.dataset.alt = episode.thumbnailAlt || '';
    backgroundImage.onerror = () => thumbFail(backgroundImage);
    backgroundImage.src = episode.thumbnail || THUMB_FALLBACK;
}

function loadVideo(episode) {
    video.src = episode.videoUrl;
    video.load();
}

// Auto-hide controls on mobile
function showControls() {
    playerControls.classList.add('always-visible');
    clearTimeout(controlsTimeout);
    
    if (window.innerWidth < 768 && !video.paused) {
        controlsTimeout = setTimeout(() => {
            playerControls.classList.remove('always-visible');
        }, 5000);
    }
}

function hideControls() {
    if (window.innerWidth < 768 && !video.paused) {
        playerControls.classList.remove('always-visible');
    }
}

// Player Controls
function togglePlay() {
    if (video.paused) {
        video.play();
        updatePlayIcon();
    } else {
        video.pause();
        updatePlayIcon();
    }
    showControls();
}

function updatePlayIcon() {
    const icon = video.paused ? 'play_arrow' : 'pause';
    playIcon.textContent = icon;
    overlayPlayIcon.textContent = icon;
}

function rewind() {
    video.currentTime = Math.max(0, video.currentTime - 10);
    showControls();
}

function forward() {
    video.currentTime = Math.min(video.duration, video.currentTime + 10);
    showControls();
}

function setVolume(value) {
    video.volume = value / 100;
    isMuted = false;
    updateVolumeIcon();
}

function toggleVolume() {
    if (isMuted || video.volume === 0) {
        video.volume = 0.7;
        isMuted = false;
    } else {
        video.volume = 0;
        isMuted = true;
    }
    updateVolumeIcon();
    showControls();
}

function updateVolumeIcon() {
    const icon = video.volume === 0 ? 'volume_off' : 'volume_up';
    document.getElementById('mobile-volume-icon').textContent = icon;
}

function updateFavIcon() {
    const on = Favorites.has(episodeId);
    const icon = document.getElementById('fav-icon');
    icon.style.fontVariationSettings = `'FILL' ${on ? 1 : 0}`;
    icon.classList.toggle('text-error-container', on);
    document.getElementById('fav-btn').title = on ? 'Quitar de favoritos' : 'Añadir a favoritos';
}

function toggleFavorite() {
    Favorites.toggle(episodeId);
    updateFavIcon();
    showControls();
}

async function togglePiP() {
    try {
        if (document.pictureInPictureElement) {
            await document.exitPictureInPicture();
        } else if (document.pictureInPictureEnabled && !video.disablePictureInPicture) {
            await video.requestPictureInPicture();
        } else if (video.webkitSupportsPresentationMode && typeof video.webkitSetPresentationMode === 'function') {
            // Safari antiguo
            video.webkitSetPresentationMode(
                video.webkitPresentationMode === 'picture-in-picture' ? 'inline' : 'picture-in-picture'
            );
        }
    } catch (err) {
        console.error('PiP error:', err);
    }
    showControls();
}

// Oculta el botón PiP si el navegador no lo soporta
(function initPiP() {
    const btn = document.getElementById('pip-btn');
    const supported = document.pictureInPictureEnabled ||
        (video.webkitSupportsPresentationMode && typeof video.webkitSetPresentationMode === 'function');
    if (btn && !supported) btn.style.display = 'none';
})();

function toggleFullscreen() {
    const playerContainer = document.querySelector('.player-container');
    if (!document.fullscreenElement) {
        if (playerContainer.requestFullscreen) {
            playerContainer.requestFullscreen();
        } else if (playerContainer.webkitRequestFullscreen) {
            playerContainer.webkitRequestFullscreen();
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    showControls();
}

function goBack() {
    if (document.referrer.includes('episodes.html')) {
        window.history.back();
    } else {
        window.location.href = `episodes.html?season=${seasonId}`;
    }
}

function showError(message) {
    document.body.innerHTML = `
        <div class="flex items-center justify-center h-screen w-screen bg-inverse-surface">
            <div class="text-center text-surface-bright px-6">
                <h1 class="text-3xl font-bold mb-4">Error</h1>
                <p class="text-surface-bright/70 mb-8">${message}</p>
                <button 
                    onclick="window.history.back()" 
                    class="bg-primary-container text-on-primary-container px-8 py-4 rounded-full font-bold hover:scale-105 transition-transform"
                >
                    Volver
                </button>
            </div>
        </div>
    `;
}

// Video Events
video.addEventListener('timeupdate', updateProgress);
video.addEventListener('loadedmetadata', updateDuration);
video.addEventListener('ended', handleVideoEnded);
video.addEventListener('play', updatePlayIcon);
video.addEventListener('pause', updatePlayIcon);
video.addEventListener('error', () => {
    console.error('Error de reproducción', video.error, video.src);
    document.getElementById('episode-badge').textContent = 'No se pudo reproducir';
});

// Mouse move shows controls
document.addEventListener('mousemove', showControls);

function updateProgress() {
    const percent = (video.currentTime / video.duration) * 100;
    progressBar.style.width = percent + '%';
    currentTimeDisplay.textContent = formatTime(video.currentTime);
}

function updateDuration() {
    durationDisplay.textContent = formatTime(video.duration);
}

function formatTime(seconds) {
    if (isNaN(seconds)) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// Progress bar click
progressContainer.addEventListener('click', (e) => {
    const rect = progressContainer.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    video.currentTime = Math.max(0, Math.min(percent * video.duration, video.duration));
    showControls();
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    showControls();
    switch(e.key.toLowerCase()) {
        case ' ':
            e.preventDefault();
            togglePlay();
            break;
        case 'arrowleft':
            rewind();
            break;
        case 'arrowright':
            forward();
            break;
        case 'f':
            toggleFullscreen();
            break;
        case 'm':
            toggleVolume();
            break;
        case 'p':
            togglePiP();
            break;
    }
});

function handleVideoEnded() {
    updatePlayIcon();
}

// Initialize
loadEpisode();
updateFavIcon();
window.addEventListener('favorites:sync', updateFavIcon);
video.volume = 0.7;
showControls();