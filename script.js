// ▼▼▼ ここから追加 (IndexedDB Helper) ▼▼▼
const DB_NAME = 'WaveMusicPlayerDB';
const STORE_NAME = 'tracks';
const DB_VERSION = 1;

function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = () => reject("Error opening DB");
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

function saveTrackToDB(db, track) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(track);
        request.onerror = () => reject("Error saving track");
        request.onsuccess = () => resolve(request.result);
    });
}

function loadTracksFromDB(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onerror = () => reject("Error loading tracks");
        request.onsuccess = () => resolve(request.result);
    });
}

function clearDB(db) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onerror = () => reject("Error clearing DB");
        request.onsuccess = () => resolve();
    });
}
// ▲▲▲ ここまで追加 (IndexedDB Helper) ▲▲▲


class WaveMusicPlayer {
    constructor() {
        this.audio = document.getElementById('audioPlayer');
        this.tracks = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.isShuffle = false;
        this.repeatMode = 0; // 0: off, 1: all, 2: one
        this.volume = 1;
        this.db = null; // To hold the DB connection

        this.contentViewContainer = document.getElementById('contentViewContainer');
        this.currentView = 'library';

        this.playlists = [];
        this.favorites = new Set();
        this.recentPlays = [];
        this.originalTitle = document.title;

        // Initialize the app
        this.initApp();
    }

    async initApp() {
        this.db = await openDB();
        this.initElements();
        this.setupEventListeners();
        this.initTheme();
        await this.loadPersistedTracks();
    }

    initElements() {
        this.controlsFooter = document.querySelector('.controls');
        // Player Controls
        this.playBtn = document.getElementById('playBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.repeatBtn = document.getElementById('repeatBtn');
        this.volumeBtn = document.getElementById('volumeBtn');

        // Progress and Volume
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');
        this.volumeSlider = document.getElementById('volumeSlider');
        this.volumeFill = document.getElementById('volumeFill');

        // Display (Now Playing)
        this.currentTitle = document.getElementById('currentTitle');
        this.currentArtist = document.getElementById('currentArtist');
        this.albumArtwork = document.getElementById('albumArtwork');

        // Input
        this.searchInput = document.getElementById('searchInput');
        this.navBtns = document.querySelectorAll('.nav-btn');
        this.alertContainer = document.getElementById('alertContainer');
        this.modalContainer = document.getElementById('modalContainer');
        
        // Settings Modal Elements
        this.settingsModal = document.getElementById('settingsModal');
        this.openSettingsBtn = document.getElementById('openSettingsBtn');
        this.closeSettingsBtn = document.getElementById('closeSettingsBtn');
        this.settingsOverlay = document.getElementById('settingsOverlay');
        this.themeToggleSwitch = document.getElementById('themeToggleSwitch');
        this.clearLibraryBtn = document.getElementById('clearLibraryBtn');

        // Fullscreen Player
        this.playerFullscreen = document.getElementById('playerFullscreen');
        this.closePlayerBtn = document.getElementById('closePlayerBtn');
        this.footerTrackInfoTrigger = document.getElementById('footerTrackInfoTrigger');

        // Footer track display
        this.footerArtwork = document.getElementById('footerArtwork');
        this.footerTitle = document.getElementById('footerTitle');
        this.footerArtist = document.getElementById('footerArtist');

        // Fullscreen player elements
        this.fullscreenArtworkBg = document.getElementById('fullscreenArtworkBg');
        this.fullscreenArtwork = document.getElementById('fullscreenArtwork');
        this.fullscreenTitle = document.getElementById('fullscreenTitle');
        this.fullscreenArtist = document.getElementById('fullscreenArtist');
        this.fullscreenProgressBar = document.getElementById('fullscreenProgressBar');
        this.fullscreenProgressFill = document.getElementById('fullscreenProgressFill');
        this.fullscreenCurrentTime = document.getElementById('fullscreenCurrentTime');
        this.fullscreenTotalTime = document.getElementById('fullscreenTotalTime');
        this.fullscreenVolumeSlider = document.getElementById('fullscreenVolumeSlider');
        this.fullscreenVolumeFill = document.getElementById('fullscreenVolumeFill');

        // Fullscreen controls
        this.fullscreenPlayBtn = document.getElementById('fullscreenPlayBtn');
        this.fullscreenPrevBtn = document.getElementById('fullscreenPrevBtn');
        this.fullscreenNextBtn = document.getElementById('fullscreenNextBtn');
        this.fullscreenShuffleBtn = document.getElementById('fullscreenShuffleBtn');
        this.fullscreenRepeatBtn = document.getElementById('fullscreenRepeatBtn');
        this.fullscreenFavoriteBtn = document.getElementById('fullscreenFavoriteBtn');
        this.fullscreenPlaylistBtn = document.getElementById('fullscreenPlaylistBtn');
    }

    setupEventListeners() {
        // Audio events
        this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('ended', () => this.handleTrackEnd());
        this.audio.addEventListener('play', () => this.handlePlay());
        this.audio.addEventListener('pause', () => this.handlePause());

        // Player Controls
        this.playBtn.addEventListener('click', () => this.togglePlay());
        this.prevBtn.addEventListener('click', () => this.previousTrack());
        this.nextBtn.addEventListener('click', () => this.nextTrack());
        this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
        this.repeatBtn.addEventListener('click', () => this.toggleRepeat());
        this.volumeBtn.addEventListener('click', () => this.toggleMute());
        
        // Progress & Volume
        this.progressBar.addEventListener('click', (e) => this.seekTo(e, this.progressBar));
        this.volumeSlider.addEventListener('click', (e) => this.setVolumeFromSlider(e, this.volumeSlider));
        this.searchInput.addEventListener('input', (e) => this.searchTracks(e.target.value));
        this.navBtns.forEach(btn => btn.addEventListener('click', (e) => this.handleNavigation(e)));
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Volume Drag and Scroll
        this.volumeSlider.addEventListener('mousedown', (e) => { this.isDraggingVolume = true; });
        document.addEventListener('mousemove', (e) => { if(this.isDraggingVolume) this.setVolumeFromSlider(e, this.volumeSlider) });
        document.addEventListener('mouseup', () => { this.isDraggingVolume = false; });
        this.volumeBtn.addEventListener('wheel', (e) => this.adjustVolumeOnScroll(e));

        // Settings Modal Events
        this.openSettingsBtn.addEventListener('click', () => this.openSettings());
        this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
        this.settingsOverlay.addEventListener('click', () => this.closeSettings());
        this.themeToggleSwitch.addEventListener('change', () => this.toggleTheme());
        this.clearLibraryBtn.addEventListener('click', () => this.handleClearLibrary());
        
        // Fullscreen Player Events
        this.controlsFooter.addEventListener('click', (e) => {
            if (e.target.closest('button, .progress-bar, .volume-slider, .track-actions, a')) {
                return;
            }
            this.openPlayer();
        });
        this.closePlayerBtn.addEventListener('click', () => this.closePlayer());
        this.fullscreenProgressBar.addEventListener('click', (e) => this.seekTo(e, this.fullscreenProgressBar));

        this.fullscreenPlayBtn.addEventListener('click', () => this.togglePlay());
        this.fullscreenPrevBtn.addEventListener('click', () => this.previousTrack());
        this.fullscreenNextBtn.addEventListener('click', () => this.nextTrack());
        this.fullscreenShuffleBtn.addEventListener('click', () => this.toggleShuffle());
        this.fullscreenRepeatBtn.addEventListener('click', () => this.toggleRepeat());
        this.fullscreenFavoriteBtn.addEventListener('click', (e) => this.toggleFavorite(this.currentIndex, e));
        this.fullscreenPlaylistBtn.addEventListener('click', (e) => this.promptAddToPlaylist(this.currentIndex, e));
        this.fullscreenVolumeSlider.addEventListener('click', (e) => this.setVolumeFromSlider(e, this.fullscreenVolumeSlider));
        this.fullscreenVolumeSlider.addEventListener('mousedown', (e) => { this.isDraggingVolumeFs = true; });
        document.addEventListener('mousemove', (e) => { if(this.isDraggingVolumeFs) this.setVolumeFromSlider(e, this.fullscreenVolumeSlider) });
        document.addEventListener('mouseup', () => { this.isDraggingVolumeFs = false; });
    }
    
    openPlayer() {
        if (this.tracks.length > 0) {
            this.playerFullscreen.classList.add('is-open');
        }
    }

    closePlayer() {
        this.playerFullscreen.classList.remove('is-open');
    }

    // --- Settings & Theme --- (変更なし)
    openSettings() { this.settingsModal.classList.remove('hidden'); }
    closeSettings() { this.settingsModal.classList.add('hidden'); }
    initTheme() { const savedTheme = localStorage.getItem('wavePlayerTheme') || 'dark'; document.documentElement.setAttribute('data-theme', savedTheme); this.themeToggleSwitch.checked = savedTheme === 'dark'; }
    toggleTheme() { const newTheme = this.themeToggleSwitch.checked ? 'dark' : 'light'; document.documentElement.setAttribute('data-theme', newTheme); localStorage.setItem('wavePlayerTheme', newTheme); }
    async handleClearLibrary() { if (confirm("Are you sure you want to delete all tracks from your library? This action cannot be undone.")) { await clearDB(this.db); this.showAlert('Library cleared. The application will now reload.', 'info', 4000); setTimeout(() => window.location.reload(), 4000); } }

    // --- Data Persistence --- (変更なし)
    async loadPersistedTracks() { const dbTracks = await loadTracksFromDB(this.db); if (dbTracks && dbTracks.length > 0) { this.tracks = dbTracks.map(track => { if (track.originalFile instanceof Blob) { track.file = URL.createObjectURL(track.originalFile); } return track; }); this.showAlert(`${this.tracks.length} tracks loaded from your library.`, 'success'); } else { await this.loadSampleTracks(); } this.renderContentView(this.currentView); }
    async handleFiles(event) { const files = Array.from(event.target.files); await this.addFilesToLibrary(files); event.target.value = ''; }
    async addFilesToLibrary(files) { let addedCount = 0; for (const file of files) { if (file.type.startsWith('audio/')) { const trackId = this.generateUniqueId(); const track = { title: file.name.replace(/\.[^/.]+$/, ""), artist: 'Unknown Artist', album: 'Unknown Album', file: URL.createObjectURL(file), originalFile: file, duration: null, id: trackId }; this.tracks.push(track); await saveTrackToDB(this.db, track); this.extractMetadata(file, track); addedCount++; } } if (addedCount > 0) { this.showAlert(`${addedCount} track(s) added to your library.`, 'success'); this.renderContentView(this.currentView); } }
    extractMetadata(file, track) { if (window.jsmediatags) { jsmediatags.read(file, { onSuccess: async (tag) => { const tags = tag.tags; if (tags.title) track.title = tags.title; if (tags.artist) track.artist = tags.artist; if (tags.album) track.album = tags.album; if (tags.picture) { const base64String = this.arrayBufferToBase64(tags.picture.data); track.artwork = `data:${tags.picture.format};base64,${base64String}`; } this.renderContentView(this.currentView); await saveTrackToDB(this.db, track); }, onError: (error) => { console.log('Metadata extraction error:', error); } }); } }

    playTrack(index) {
        if (index >= 0 && index < this.tracks.length) {
            this.currentIndex = index;
            const track = this.tracks[index];
            this.audio.src = track.file;
            this.audio.load();

            this.currentTitle.textContent = track.title;
            this.currentArtist.textContent = track.artist;
            this.footerTitle.textContent = track.title;
            this.footerArtist.textContent = track.artist || 'Unknown Artist';
            this.fullscreenTitle.textContent = track.title;
            this.fullscreenArtist.textContent = track.artist || 'Unknown Artist';

            const artworkHtml = track.artwork 
                ? `<img src="${track.artwork}" alt="Album Art">` 
                : `<div class="album-placeholder"><i class="ri-disc-line"></i></div>`;
            const footerArtworkHtml = track.artwork
                ? `<img src="${track.artwork}" alt="Album Art">`
                : `<i class="ri-music-2-line"></i>`;

            if (track.artwork) {
                this.fullscreenArtworkBg.innerHTML = `<img src="${track.artwork}" alt="">`;
                this.fullscreenArtworkBg.style.opacity = 1;
            } else {
                this.fullscreenArtworkBg.style.opacity = 0;
            }
            
            this.albumArtwork.innerHTML = artworkHtml;
            this.fullscreenArtwork.innerHTML = artworkHtml;
            this.footerArtwork.innerHTML = footerArtworkHtml;
            
            this.audio.play();
            this.renderContentView(this.currentView);
            this.addRecentPlay(index);
            this.updateFavoriteButtons();
        }
    }

    handlePlay() {
        this.isPlaying = true;
        this.playBtn.innerHTML = '<i class="ri-pause-fill"></i>';
        this.fullscreenPlayBtn.innerHTML = '<i class="ri-pause-fill"></i>';
        this.albumArtwork.classList.add('playing');
        const track = this.tracks[this.currentIndex];
        if (track) { document.title = `▶ ${track.title} - ${track.artist}`; }
    }

    handlePause() {
        this.isPlaying = false;
        this.playBtn.innerHTML = '<i class="ri-play-fill"></i>';
        this.fullscreenPlayBtn.innerHTML = '<i class="ri-play-fill"></i>';
        this.albumArtwork.classList.remove('playing');
        const track = this.tracks[this.currentIndex];
        if (track) { document.title = `${track.title} - ${track.artist}`; } else { document.title = this.originalTitle; }
    }

    toggleShuffle() {
        this.isShuffle = !this.isShuffle;
        this.shuffleBtn.classList.toggle('active', this.isShuffle);
        this.fullscreenShuffleBtn.classList.toggle('active', this.isShuffle);
    }

    toggleRepeat() {
        this.repeatMode = (this.repeatMode + 1) % 3;
        const icons = ['ri-repeat-line', 'ri-repeat-line', 'ri-repeat-one-line'];
        const iconHtml = `<i class="${icons[this.repeatMode]}"></i>`;
        this.repeatBtn.innerHTML = iconHtml;
        this.fullscreenRepeatBtn.innerHTML = iconHtml;
        const isActive = this.repeatMode > 0;
        this.repeatBtn.classList.toggle('active', isActive);
        this.fullscreenRepeatBtn.classList.toggle('active', isActive);
    }

    setVolumeLevel(level) {
        this.audio.muted = false;
        this.volume = Math.max(0, Math.min(1, level));
        this.audio.volume = this.volume;
        this.updateVolumeUI();
    }

    setVolumeFromSlider(event, sliderElement) {
        const rect = sliderElement.getBoundingClientRect();
        const percent = (event.clientX - rect.left) / rect.width;
        this.setVolumeLevel(percent);
    }
    
    updateVolumeUI() {
        const percent = this.audio.muted ? 0 : this.volume * 100;
        const icon = this.audio.muted || this.volume === 0 ? 'ri-volume-mute-line' : 'ri-volume-up-line';
        this.volumeFill.style.width = `${percent}%`;
        this.fullscreenVolumeFill.style.width = `${percent}%`;
        this.volumeBtn.innerHTML = `<i class="${icon}"></i>`;
    }

    toggleMute() {
        this.audio.muted = !this.audio.muted;
        this.updateVolumeUI();
    }
    
    seekTo(event, barElement) {
        if (isNaN(this.audio.duration)) return;
        const rect = barElement.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
        this.audio.currentTime = percent * this.audio.duration;
    }
    
    updateProgress() {
        if (this.audio.duration) {
            const percent = (this.audio.currentTime / this.audio.duration) * 100;
            const percentStr = percent + '%';
            this.progressFill.style.width = percentStr;
            this.fullscreenProgressFill.style.width = percentStr;

            const currentTimeFormatted = this.formatTime(this.audio.currentTime);
            this.currentTime.textContent = currentTimeFormatted;
            this.fullscreenCurrentTime.textContent = currentTimeFormatted;
        }
    }

    updateDuration() {
        const durationFormatted = this.formatTime(this.audio.duration);
        this.totalTime.textContent = durationFormatted;
        this.fullscreenTotalTime.textContent = durationFormatted;
        if (this.tracks[this.currentIndex]) {
            this.tracks[this.currentIndex].duration = this.formatTime(this.audio.duration);
        }
        this.renderContentView(this.currentView);
    }
    
    toggleFavorite(trackIndex, event) {
        event.stopPropagation();
        const trackTitle = this.tracks[trackIndex].title;
        if (this.favorites.has(trackIndex)) {
            this.favorites.delete(trackIndex);
            this.showAlert(`Removed "${trackTitle}" from Favorites.`, 'info');
        } else {
            this.favorites.add(trackIndex);
            this.showAlert(`Added "${trackTitle}" to Favorites.`, 'success');
        }
        this.updateFavoriteButtons();
        if(this.currentView === 'favorites') {
            this.renderContentView('favorites');
        }
    }

    updateFavoriteButtons() {
        const isFavorite = this.favorites.has(this.currentIndex);
        // Fullscreen button
        this.fullscreenFavoriteBtn.classList.toggle('active', isFavorite);
        this.fullscreenFavoriteBtn.innerHTML = `<i class="${isFavorite ? 'ri-heart-fill' : 'ri-heart-line'}"></i>`;

        // List view buttons
        document.querySelectorAll('.favorite-btn').forEach(btn => {
            const btnIndex = parseInt(btn.dataset.index);
            const isFav = this.favorites.has(btnIndex);
            btn.classList.toggle('active', isFav);
            btn.innerHTML = `<i class="${isFav ? 'ri-heart-fill' : 'ri-heart-line'}"></i>`;
        });
    }

    // --- (↓) ここから下のコードは大きな変更なし ---
    handleTrackEnd() { if (this.repeatMode === 2) { this.audio.currentTime = 0; this.audio.play(); } else if (this.repeatMode === 1) { this.nextTrack(); } else { if (this.currentIndex < this.tracks.length - 1 || this.isShuffle) { this.nextTrack(); } else { this.handlePause(); } } }
    previousTrack() { if (this.tracks.length === 0) return; let prevIndex; if (this.isShuffle) { prevIndex = Math.floor(Math.random() * this.tracks.length); } else { prevIndex = this.currentIndex - 1; if (prevIndex < 0) prevIndex = this.tracks.length - 1; } this.playTrack(prevIndex); }
    nextTrack() { if (this.tracks.length === 0) return; let nextIndex; if (this.isShuffle) { nextIndex = Math.floor(Math.random() * this.tracks.length); } else { nextIndex = this.currentIndex + 1; if (nextIndex >= this.tracks.length) nextIndex = 0; } this.playTrack(nextIndex); }
    togglePlay() { if (this.tracks.length === 0) return; if (this.audio.paused) { if (!this.audio.src) { this.playTrack(0); } else { this.audio.play(); } } else { this.audio.pause(); } }
    adjustVolumeOnScroll(e) { e.preventDefault(); let newVolume = this.volume; if (e.deltaY < 0) { newVolume += 0.05; } else { newVolume -= 0.05; } this.setVolumeLevel(newVolume); }
    formatTime(seconds) { if (isNaN(seconds)) return '0:00'; const mins = Math.floor(seconds / 60); const secs = Math.floor(seconds % 60); return `${mins}:${secs.toString().padStart(2, '0')}`; }
    generateUniqueId() { return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) { var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8); return v.toString(16); }); }
    showAlert(message, type = 'info', duration = 3000) { const alertElement = document.createElement('div'); alertElement.className = `custom-alert ${type}`; const icons = { success: 'ri-checkbox-circle-line', error: 'ri-error-warning-line', info: 'ri-information-line' }; alertElement.innerHTML = `<i class="${icons[type] || icons.info}"></i><span>${message}</span>`; this.alertContainer.appendChild(alertElement); setTimeout(() => { alertElement.remove(); }, duration); }
    closeModal() { this.modalContainer.innerHTML = ''; }
    async loadSampleTracks() { const sampleTracksData = [ { title: 'Midnight Dreams', artist: 'Ethereal Sounds', file: './sounds/sample1.mp3' }, { title: 'Neon Lights', artist: 'Cyber Wave', file: './sounds/sample2.mp3' }, { title: 'Ocean Breeze', artist: 'Ambient Flow', file: './sounds/sample3.mp3' }, ]; for (const trackData of sampleTracksData) { try { const response = await fetch(trackData.file); if (response.ok) { const fileBlob = await response.blob(); const file = new File([fileBlob], trackData.file.split('/').pop(), { type: fileBlob.type }); const track = { ...trackData, duration: null, id: this.generateUniqueId(), originalFile: file, file: URL.createObjectURL(file) }; this.tracks.push(track); await saveTrackToDB(this.db, track); } } catch (error) { console.log(`Sample track ${trackData.file} not found`); } } if (this.tracks.length > 0) this.showAlert('Added sample tracks to get you started.', 'info'); }
    arrayBufferToBase64(buffer) { let binary = ''; const bytes = new Uint8Array(buffer); for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); } return btoa(binary); }
    handleNavigation(event) { this.navBtns.forEach(btn => btn.classList.remove('active')); event.currentTarget.classList.add('active'); const view = event.currentTarget.dataset.view; this.currentView = view; this.renderContentView(view); }
    renderContentView(view) { this.contentViewContainer.innerHTML = ''; this.searchInput.value = ''; let contentHtml = ''; switch(view) { case 'library': contentHtml = this.renderLibraryView(); break; case 'playlist': contentHtml = this.renderPlaylistView(); break; case 'favorites': contentHtml = this.renderFavoritesView(); break; case 'recent': contentHtml = this.renderRecentView(); break; default: contentHtml = this.renderLibraryView(); break; } this.contentViewContainer.innerHTML = contentHtml; this.attachEventListenersToView(view); }
    attachEventListenersToView(view) { this.attachEventListenersToTrackList(); if (view === 'library') { document.getElementById('audioFiles').addEventListener('change', (e) => this.handleFiles(e)); } else if (view === 'playlist') { const createPlaylistBtn = document.getElementById('createPlaylistBtn'); if (createPlaylistBtn) { createPlaylistBtn.addEventListener('click', () => this.promptCreatePlaylist()); } this.playlists.forEach((playlist) => { const playlistItem = document.getElementById(`playlist-${playlist.id}`); if (playlistItem) { playlistItem.addEventListener('click', (e) => { if (!e.target.closest('.action-btn')) { this.renderPlaylistTracks(playlist.id); } }); const deleteBtn = playlistItem.querySelector('.delete-playlist-btn'); if (deleteBtn) { deleteBtn.addEventListener('click', (e) => { e.stopPropagation(); this.deletePlaylist(playlist.id); }); } } }); } }
    renderTrackList(tracksToDisplay, showActions = true) { if (tracksToDisplay.length === 0) { return `<div class="empty-state"><i class="ri-music-2-line empty-icon"></i><div class="empty-title">No music found</div><div class="empty-subtitle">Add music files to your library.</div></div>`; } let trackListHtml = `<div class="track-list">`; tracksToDisplay.forEach((track) => { const originalIndex = this.tracks.findIndex(t => t.id === track.id); const isActive = originalIndex === this.currentIndex; const isFavorite = this.favorites.has(originalIndex); trackListHtml += `<div class="track-item ${isActive ? 'active' : ''}" data-index="${originalIndex}"><div class="track-number">${String(tracksToDisplay.indexOf(track) + 1).padStart(2, '0')}</div><div class="track-info"><div class="track-title">${track.title}</div><div class="track-artist">${track.artist}</div></div><div class="track-duration">${track.duration || '--:--'}</div>${showActions ? `<div class="track-actions"><button class="action-btn favorite-btn ${isFavorite ? 'active' : ''}" data-index="${originalIndex}" title="${isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}"><i class="${isFavorite ? 'ri-heart-fill' : 'ri-heart-line'}"></i></button><button class="action-btn add-to-playlist-btn" data-index="${originalIndex}" title="Add to Playlist"><i class="ri-add-line"></i></button></div>` : ''}</div>`; }); trackListHtml += `</div>`; return trackListHtml; }
    attachEventListenersToTrackList() { document.querySelectorAll('.track-item').forEach(item => { const index = parseInt(item.dataset.index); if(isNaN(index)) return; item.addEventListener('click', (e) => { if (!e.target.closest('.action-btn') && !e.target.closest('.playlist-item')) { this.playTrack(index); } }); }); document.querySelectorAll('.favorite-btn').forEach(btn => { const index = parseInt(btn.dataset.index); btn.addEventListener('click', (e) => this.toggleFavorite(index, e)); }); document.querySelectorAll('.add-to-playlist-btn').forEach(btn => { const index = parseInt(btn.dataset.index); btn.addEventListener('click', (e) => this.promptAddToPlaylist(index, e)); }); }
    renderLibraryView(tracks = this.tracks, title = "Your Library") { return `<div class="list-header"><h1 class="list-title">${title}</h1><label for="audioFiles" class="add-music-btn"><i class="ri-add-line"></i>Add Music<input type="file" id="audioFiles" class="file-input" multiple accept="audio/*"></label></div>${this.renderTrackList(tracks)}`; }
    renderPlaylistView() { return `<div class="list-header"><h1 class="list-title">Your Playlists</h1><button class="add-music-btn" id="createPlaylistBtn"><i class="ri-add-line"></i>Create New Playlist</button></div><div class="track-list playlist-list">${this.playlists.length === 0 ? `<div class="empty-state"><i class="ri-playlist-line empty-icon"></i><div class="empty-title">No playlists yet</div><div class="empty-subtitle">Create your first playlist!</div></div>` : this.playlists.map(playlist => `<div class="track-item playlist-item" id="playlist-${playlist.id}"><div class="track-info"><div class="track-title">${playlist.name}</div><div class="track-artist">${playlist.trackIds.length} tracks</div></div><div class="track-actions"><button class="action-btn delete-playlist-btn" title="Delete Playlist"><i class="ri-delete-bin-line"></i></button></div></div>`).join('')}</div>`; }
    renderPlaylistTracks(playlistId) { const playlist = this.playlists.find(p => p.id === playlistId); if (!playlist) return; const playlistTracks = playlist.trackIds.map(index => this.tracks[index]).filter(Boolean); const contentHtml = `<div class="list-header"><button class="back-btn" id="backToPlaylistsBtn"><i class="ri-arrow-left-line"></i> Back to Playlists</button><h1 class="list-title">${playlist.name}</h1></div>${this.renderTrackList(playlistTracks)}`; this.contentViewContainer.innerHTML = contentHtml; document.getElementById('backToPlaylistsBtn').addEventListener('click', () => this.renderContentView('playlist')); this.attachEventListenersToTrackList(); }
    renderFavoritesView() { const favoriteTracks = Array.from(this.favorites).map(index => this.tracks[index]).filter(Boolean); return `<div class="list-header"><h1 class="list-title">Your Favorites</h1></div>${favoriteTracks.length === 0 ? `<div class="empty-state"><i class="ri-heart-line empty-icon"></i><div class="empty-title">No favorite tracks yet</div><div class="empty-subtitle">Click the heart icon on any track to add it!</div></div>` : this.renderTrackList(favoriteTracks)}`; }
    renderRecentView() { const recentTracks = this.recentPlays.map(index => this.tracks[index]).filter(Boolean); return `<div class="list-header"><h1 class="list-title">Recently Played</h1></div>${recentTracks.length === 0 ? `<div class="empty-state"><i class="ri-time-line empty-icon"></i><div class="empty-title">No recent plays</div><div class="empty-subtitle">Start listening to see your history!</div></div>` : this.renderTrackList(recentTracks, false)}`; }
    promptCreatePlaylist(trackIndexToAddAfterCreation = null) { this.closeModal(); const modalHTML = `<div class="modal-overlay"></div><div class="modal-content create-playlist-modal"><div class="modal-header">Create New Playlist</div><div class="modal-body"><input type="text" id="newPlaylistName" class="modal-input" placeholder="My Awesome Playlist"></div><div class="modal-footer"><button class="modal-button" id="cancelPlaylistCreation">Cancel</button><button class="modal-button-primary" id="confirmPlaylistCreation">Create</button></div></div>`; this.modalContainer.innerHTML = modalHTML; const input = document.getElementById('newPlaylistName'); input.focus(); const createAction = () => { const playlistName = input.value; const newPlaylist = this.createPlaylist(playlistName); if (newPlaylist && trackIndexToAddAfterCreation !== null) { this.addTrackToPlaylist(newPlaylist.id, trackIndexToAddAfterCreation); } this.closeModal(); }; document.getElementById('confirmPlaylistCreation').addEventListener('click', createAction); document.getElementById('cancelPlaylistCreation').addEventListener('click', () => this.closeModal()); this.modalContainer.querySelector('.modal-overlay').addEventListener('click', () => this.closeModal()); input.addEventListener('keydown', (e) => { if (e.key === 'Enter') createAction(); }); }
    createPlaylist(name) { if (!name || !name.trim()) { this.showAlert("Playlist name cannot be empty!", 'error'); return null; } name = name.trim(); if (this.playlists.some(p => p.name.toLowerCase() === name.toLowerCase())) { this.showAlert(`Playlist "${name}" already exists!`, 'error'); return null; } const newPlaylist = { id: this.generateUniqueId(), name, trackIds: [] }; this.playlists.push(newPlaylist); this.showAlert(`Playlist "${name}" created.`, 'success'); if (this.currentView === 'playlist') { this.renderContentView('playlist'); } return newPlaylist; }
    deletePlaylist(playlistId) { if (confirm("Are you sure you want to delete this playlist? This cannot be undone.")) { const playlistIndex = this.playlists.findIndex(p => p.id === playlistId); if (playlistIndex > -1) { const playlistName = this.playlists[playlistIndex].name; this.playlists.splice(playlistIndex, 1); this.showAlert(`Playlist "${playlistName}" deleted.`, 'info'); this.renderContentView('playlist'); } } }
    promptAddToPlaylist(trackIndex, event) { event.stopPropagation(); this.closeModal(); const track = this.tracks[trackIndex]; const rect = event.currentTarget.getBoundingClientRect(); let playlistOptionsHTML = this.playlists.map(playlist => `<li class="modal-list-item" data-playlist-id="${playlist.id}">${playlist.name}</li>`).join(''); if (this.playlists.length === 0) { playlistOptionsHTML = `<li><div style="padding: 10px 12px; color: #888; font-size: 13px;">No playlists yet.</div></li>`; } const modalHTML = `<div class="modal-overlay" style="background: transparent;"></div><div class="modal-content context-menu" style="top: ${rect.bottom + 5}px; left: ${rect.left}px;"><div class="modal-header">Add to...</div><ul class="modal-list">${playlistOptionsHTML}</ul><div class="modal-footer"><button class="modal-button new-playlist-btn" id="newPlaylistFromContext"><i class="ri-add-line"></i> New Playlist</button></div></div>`; this.modalContainer.innerHTML = modalHTML; this.modalContainer.querySelectorAll('.modal-list-item').forEach(item => { item.addEventListener('click', () => { this.addTrackToPlaylist(item.dataset.playlistId, trackIndex); this.closeModal(); }); }); document.getElementById('newPlaylistFromContext').addEventListener('click', () => { this.promptCreatePlaylist(trackIndex); }); this.modalContainer.querySelector('.modal-overlay').addEventListener('click', () => this.closeModal()); }
    addTrackToPlaylist(playlistId, trackIndex) { const playlist = this.playlists.find(p => p.id === playlistId); if (playlist) { if (!playlist.trackIds.includes(trackIndex)) { playlist.trackIds.push(trackIndex); this.showAlert(`Added "${this.tracks[trackIndex].title}" to "${playlist.name}".`, 'success'); if (this.currentView === 'playlist') { this.renderContentView('playlist'); } } else { this.showAlert(`Track is already in "${playlist.name}".`, 'info'); } } }
    addRecentPlay(trackIndex) { this.recentPlays = this.recentPlays.filter(index => index !== trackIndex); this.recentPlays.unshift(trackIndex); if (this.recentPlays.length > 50) { this.recentPlays.pop(); } if (this.currentView === 'recent') { this.renderContentView('recent'); } }
    searchTracks(query) { query = query.toLowerCase(); if (this.currentView !== 'library' && query) { this.navBtns.forEach(btn => btn.classList.remove('active')); document.querySelector('.nav-btn[data-view="library"]').classList.add('active'); this.currentView = 'library'; } const filteredTracks = this.tracks.filter(track => track.title.toLowerCase().includes(query) || track.artist.toLowerCase().includes(query) || (track.album && track.album.toLowerCase().includes(query))); const title = query ? `Search Results for "${query}"` : "Your Library"; this.contentViewContainer.innerHTML = this.renderLibraryView(filteredTracks, title); this.attachEventListenersToView('library'); }
    handleKeyboard(event) { if (event.target.tagName === 'INPUT') return; switch(event.code) { case 'Space': event.preventDefault(); this.togglePlay(); break; case 'ArrowLeft': if (isNaN(this.audio.duration)) return; event.preventDefault(); this.audio.currentTime = Math.max(0, this.audio.currentTime - (event.shiftKey ? 30 : 10)); break; case 'ArrowRight': if (isNaN(this.audio.duration)) return; event.preventDefault(); this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + (event.shiftKey ? 30 : 10)); break; case 'KeyN': if (event.ctrlKey || event.metaKey) return; event.preventDefault(); this.nextTrack(); break; case 'KeyP': if (event.ctrlKey || event.metaKey) return; event.preventDefault(); this.previousTrack(); break; case 'ArrowUp': event.preventDefault(); this.setVolumeLevel(this.volume + 0.05); break; case 'ArrowDown': event.preventDefault(); this.setVolumeLevel(this.volume - 0.05); break; case 'KeyS': if (event.ctrlKey || event.metaKey) event.preventDefault(); else this.toggleShuffle(); break; case 'KeyR': if (event.ctrlKey || event.metaKey) event.preventDefault(); else this.toggleRepeat(); break; case 'KeyM': if (event.ctrlKey || event.metaKey) event.preventDefault(); else this.toggleMute(); break; case 'Slash': if (event.ctrlKey || event.metaKey) { event.preventDefault(); this.searchInput.focus(); } break; } }
}

document.addEventListener('DOMContentLoaded', () => {
    window.wavePlayer = new WaveMusicPlayer();
    
    document.documentElement.style.scrollBehavior = 'smooth';
    
    const app = document.querySelector('.app');
    
    app.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        app.style.borderColor = 'rgba(255, 255, 255, 0.5)';
    });
    
    app.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        app.style.borderColor = ''; // Revert to CSS variable
    });
    
    app.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        app.style.borderColor = ''; // Revert to CSS variable
        
        const files = Array.from(e.dataTransfer.files);
        await window.wavePlayer.addFilesToLibrary(files);
    });
});