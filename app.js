/**
 * BD Band Music - Lossless FLAC Web Player & Search Engine
 * Native Vanilla ES6+ Web Application
 * Features: Instant Fuzzy Search, FLAC Streaming, MediaSession API, Web Audio Visualizer, Queue Management
 */

(function () {
  'use strict';

  // --- App State ---
  let catalog = [];
  let currentFilteredTracks = [];
  let queue = [];
  let currentTrack = null;
  let currentTrackIndex = -1;
  let isPlaying = false;
  let isShuffle = false;
  let repeatMode = 'all'; // 'off' | 'all' | 'one'
  let activeView = 'tracks'; // 'tracks' | 'albums' | 'artists'
  let activeArtistFilter = 'all';
  let activeAlbumFilter = 'all';
  let searchQuery = '';
  let sortBy = 'default';

  // Audio Context & Visualizer State
  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let visualizerAnimId = null;
  let visualizerEnabled = false;

  // DOM Elements
  const audio = document.getElementById('audioElement');
  const globalSearchInput = document.getElementById('globalSearchInput');
  const clearSearchBtn = document.getElementById('clearSearchBtn');
  const trackCountLabel = document.getElementById('trackCountLabel');
  const brandHomeBtn = document.getElementById('brandHomeBtn');
  const artistFilterBar = document.getElementById('artistFilterBar');
  const viewTabs = document.querySelectorAll('.tab-btn');
  const tracksView = document.getElementById('tracksView');
  const tracksTable = document.getElementById('tracksTable');
  const albumsView = document.getElementById('albumsView');
  const artistsView = document.getElementById('artistsView');
  const tracksTbody = document.getElementById('tracksTbody');
  const albumsGrid = document.getElementById('albumsGrid');
  const artistsGrid = document.getElementById('artistsGrid');
  const noResultsState = document.getElementById('noResultsState');
  const resultsCount = document.getElementById('resultsCount');
  const sortSelect = document.getElementById('sortSelect');
  const activeFilterBanner = document.getElementById('activeFilterBanner');
  const activeFilterValue = document.getElementById('activeFilterValue');
  const resetFilterBtn = document.getElementById('resetFilterBtn');
  const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');

  // Player Elements
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const audioSpinner = document.getElementById('audioSpinner');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const shuffleBtn = document.getElementById('shuffleBtn');
  const repeatBtn = document.getElementById('repeatBtn');
  const repeatOneIndicator = document.getElementById('repeatOneIndicator');
  const seekSlider = document.getElementById('seekSlider');
  const bufferBar = document.getElementById('bufferBar');
  const currentTimeLabel = document.getElementById('currentTimeLabel');
  const durationLabel = document.getElementById('durationLabel');
  const playerCoverImg = document.getElementById('playerCoverImg');
  const playerTitle = document.getElementById('playerTitle');
  const playerArtist = document.getElementById('playerArtist');
  const playerAlbum = document.getElementById('playerAlbum');
  const playerQualityBadge = document.getElementById('playerQualityBadge');
  const coverBars = document.getElementById('coverBars');
  const volumeSlider = document.getElementById('volumeSlider');
  const volumeBtn = document.getElementById('volumeBtn');
  const volHighIcon = document.getElementById('volHighIcon');
  const volMuteIcon = document.getElementById('volMuteIcon');
  const playerDownloadBtn = document.getElementById('playerDownloadBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const visualizerCanvas = document.getElementById('visualizerCanvas');

  // Queue Elements
  const queueDrawer = document.getElementById('queueDrawer');
  const queueDrawerBtn = document.getElementById('queueDrawerBtn');
  const closeQueueBtn = document.getElementById('closeQueueBtn');
  const clearQueueBtn = document.getElementById('clearQueueBtn');
  const queueList = document.getElementById('queueList');
  const queueBadge = document.getElementById('queueBadge');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  // --- Phonetic Normalizer for Bengali & English ---
  function normalizeQuery(str) {
    if (!str) return '';
    return str
      .toLowerCase()
      .replace(/[\u200B-\u200D\uFEFF]/g, '') // remove zero-width spaces
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()\[\]"?]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // --- Show Toast Notification ---
  let toastTimer = null;
  function showToast(message) {
    if (toastTimer) clearTimeout(toastTimer);
    toastMsg.textContent = message;
    toast.style.display = 'block';
    toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 2500);
  }

  // --- Format Seconds into M:SS ---
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  }

  // --- Load Catalog JSON ---
  async function loadCatalog() {
    try {
      trackCountLabel.textContent = 'Loading catalogue...';
      const response = await fetch('catalog.json');
      if (!response.ok) throw new Error('Failed to load catalog.json');
      catalog = await response.json();
      trackCountLabel.textContent = `${catalog.length} FLAC Tracks`;
      
      initArtistFilterBar();
      applyFilters();
      initFromUrlParams();
    } catch (err) {
      console.error('Catalog load error:', err);
      trackCountLabel.textContent = 'Failed to load catalogue';
      showToast('Error loading songs catalogue. Please refresh.');
    }
  }

  // --- Initialize Artist Filter Pills ---
  function initArtistFilterBar() {
    // Count tracks per artist
    const artistCounts = {};
    catalog.forEach(t => {
      artistCounts[t.artist] = (artistCounts[t.artist] || 0) + 1;
    });

    // Top bands to showcase in order
    const priorityBands = [
      'Artcell', 'Black', 'Aurthohin', 'Bassbaba Sumon', 'Arbovirus',
      'Stoic Bliss', 'Indalo', 'Icons', 'Minerva', 'Vibe', 'The Watson Brothers'
    ];

    // Sorted list of artists
    const sortedArtists = Object.keys(artistCounts).sort((a, b) => {
      const idxA = priorityBands.indexOf(a);
      const idxB = priorityBands.indexOf(b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return artistCounts[b] - artistCounts[a];
    });

    let pillsHtml = `<button class="filter-pill ${activeArtistFilter === 'all' ? 'active' : ''}" data-artist="all">All Bands <span class="pill-count">${catalog.length}</span></button>`;
    
    sortedArtists.slice(0, 20).forEach(artist => {
      pillsHtml += `<button class="filter-pill ${activeArtistFilter === artist ? 'active' : ''}" data-artist="${artist}">${artist} <span class="pill-count">${artistCounts[artist]}</span></button>`;
    });

    artistFilterBar.innerHTML = pillsHtml;

    // Attach click listeners to pills
    artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const artist = btn.dataset.artist;
        setArtistFilter(artist);
      });
    });
  }

  // --- Set Active Artist Filter ---
  function setArtistFilter(artist) {
    activeArtistFilter = artist;
    activeAlbumFilter = 'all';
    
    // Update active pill UI
    artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.artist === artist);
    });

    // Update banner
    if (artist !== 'all') {
      activeFilterBanner.style.display = 'flex';
      activeFilterValue.textContent = artist;
    } else {
      activeFilterBanner.style.display = 'none';
    }

    applyFilters();
  }

  // --- Set Active Album Filter ---
  function setAlbumFilter(albumName) {
    activeAlbumFilter = albumName;
    activeArtistFilter = 'all';

    // Reset artist pills UI to All
    artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.artist === 'all');
    });

    // Update banner
    if (albumName !== 'all') {
      activeFilterBanner.style.display = 'flex';
      activeFilterValue.textContent = `Album: ${albumName}`;
    } else {
      activeFilterBanner.style.display = 'none';
    }

    applyFilters();
  }

  // --- Filter & Search Logic ---
  function applyFilters() {
    const rawQuery = globalSearchInput.value.trim();
    const query = normalizeQuery(rawQuery);

    let filtered = catalog.filter(track => {
      // Artist filter
      if (activeArtistFilter !== 'all' && track.artist !== activeArtistFilter) {
        return false;
      }

      // Album filter
      if (activeAlbumFilter !== 'all' && track.album !== activeAlbumFilter) {
        return false;
      }

      // Keyword Search
      if (query) {
        const matchTitle = normalizeQuery(track.title).includes(query);
        const matchArtist = normalizeQuery(track.artist).includes(query);
        const matchAlbum = normalizeQuery(track.album).includes(query);
        const matchYear = track.year && track.year.toString().includes(query);
        const matchFeat = track.featured && normalizeQuery(track.featured).includes(query);
        return matchTitle || matchArtist || matchAlbum || matchYear || matchFeat;
      }

      return true;
    });

    // Sorting
    if (sortBy === 'title-asc') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'artist-asc') {
      filtered.sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortBy === 'year-desc') {
      filtered.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (sortBy === 'year-asc') {
      filtered.sort((a, b) => (a.year || 9999) - (b.year || 9999));
    }

    currentFilteredTracks = filtered;
    renderCurrentView();
  }

  // --- Render Views ---
  function renderCurrentView() {
    if (currentFilteredTracks.length === 0) {
      tracksView.style.display = 'none';
      albumsView.style.display = 'none';
      artistsView.style.display = 'none';
      tracksView.classList.remove('active');
      albumsView.classList.remove('active');
      artistsView.classList.remove('active');
      noResultsState.style.display = 'block';
      resultsCount.textContent = 'Showing 0 tracks';
      return;
    }

    noResultsState.style.display = 'none';

    if (activeView === 'tracks') {
      renderTracksTable();
      tracksView.style.display = 'block';
      albumsView.style.display = 'none';
      artistsView.style.display = 'none';
      tracksView.classList.add('active');
      albumsView.classList.remove('active');
      artistsView.classList.remove('active');
      tracksTable.style.display = 'table';
      resultsCount.textContent = `Showing ${currentFilteredTracks.length} tracks`;
    } else if (activeView === 'albums') {
      renderAlbumsGrid();
      tracksView.style.display = 'none';
      albumsView.style.display = 'block';
      artistsView.style.display = 'none';
      tracksView.classList.remove('active');
      albumsView.classList.add('active');
      artistsView.classList.remove('active');
      albumsGrid.style.display = 'grid';
    } else if (activeView === 'artists') {
      renderArtistsGrid();
      tracksView.style.display = 'none';
      albumsView.style.display = 'none';
      artistsView.style.display = 'block';
      tracksView.classList.remove('active');
      albumsView.classList.remove('active');
      artistsView.classList.add('active');
      artistsGrid.style.display = 'grid';
    }
  }

  // --- Render Tracks Table ---
  function renderTracksTable() {
    let rowsHtml = '';
    currentFilteredTracks.forEach((track, index) => {
      const isCurrent = currentTrack && currentTrack.id === track.id;
      const rowClass = isCurrent ? 'playing' : '';
      
      const numOrEqualizer = isCurrent && isPlaying 
        ? `<div class="row-equalizer"><span></span><span></span><span></span></div>`
        : `<span class="track-num-text">${index + 1}</span>
           <button class="row-play-btn" title="Play">▶</button>`;

      const featTag = track.featured ? `<span class="track-feat">(ft. ${escapeHtml(track.featured)})</span>` : '';
      
      const qualityTag = track.isLossyTranscode
        ? `<span class="lossy-badge" title="16 kHz shelf cutoff transcode">16-CUT</span>`
        : `<span class="flac-badge">FLAC</span>`;

      rowsHtml += `
        <tr class="${rowClass}" data-id="${track.id}" data-index="${index}">
          <td class="td-play">
            <div class="track-num-wrap">${numOrEqualizer}</div>
          </td>
          <td class="td-title">
            <div class="track-main-cell">
              <img class="track-thumb" src="${escapeHtml(track.coverUrl)}" alt="Cover" loading="lazy" onerror="this.src='assets/band_cover.jpg'">
              <div class="track-details">
                <span class="track-title-cell">${escapeHtml(track.title)} ${featTag}</span>
              </div>
            </div>
          </td>
          <td class="td-artist">
            <a href="#" class="clickable-link artist-link" data-artist="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</a>
          </td>
          <td class="td-album">
            <a href="#" class="clickable-link album-link" data-album="${escapeHtml(track.album)}">${escapeHtml(track.album)}</a>
          </td>
          <td class="td-year">${track.year || '—'}</td>
          <td class="td-quality">${qualityTag}</td>
          <td class="td-actions">
            <div class="row-actions">
              <button class="row-action-btn add-queue-btn" title="Add to Queue" data-id="${track.id}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg>
              </button>
              <a href="${escapeHtml(track.downloadUrl || (track.streamUrl + '?download=true'))}" class="row-action-btn download-track-btn" title="Download FLAC Track" download>
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
              </a>
            </div>
          </td>
        </tr>
      `;
    });

    tracksTbody.innerHTML = rowsHtml;

    // Attach row events
    tracksTbody.querySelectorAll('tr').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.clickable-link') || e.target.closest('.row-action-btn')) return;
        const trackId = row.dataset.id;
        playTrackById(trackId);
      });
    });

    // Attach artist click links
    tracksTbody.querySelectorAll('.artist-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        setArtistFilter(link.dataset.artist);
      });
    });

    // Attach album click links
    tracksTbody.querySelectorAll('.album-link').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        setAlbumFilter(link.dataset.album);
      });
    });

    // Attach queue buttons
    tracksTbody.querySelectorAll('.add-queue-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trackId = btn.dataset.id;
        addToQueue(trackId);
      });
    });
  }

  // --- Render Albums Grid ---
  function renderAlbumsGrid() {
    const albumsMap = new Map();
    currentFilteredTracks.forEach(t => {
      if (!albumsMap.has(t.album)) {
        albumsMap.set(t.album, {
          album: t.album,
          artist: t.artist,
          year: t.year,
          coverUrl: t.coverUrl,
          tracks: []
        });
      }
      albumsMap.get(t.album).tracks.push(t);
    });

    const albumList = Array.from(albumsMap.values());
    if (sortBy === 'title-asc') {
      albumList.sort((a, b) => a.album.localeCompare(b.album));
    } else if (sortBy === 'artist-asc') {
      albumList.sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortBy === 'year-desc') {
      albumList.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (sortBy === 'year-asc') {
      albumList.sort((a, b) => (a.year || 9999) - (b.year || 9999));
    }

    resultsCount.textContent = `Showing ${albumList.length} albums`;

    let gridHtml = '';
    albumList.forEach(albumObj => {
      gridHtml += `
        <div class="album-card" data-album="${escapeHtml(albumObj.album)}">
          <div class="album-cover-wrap">
            <img class="album-cover-img" src="${escapeHtml(albumObj.coverUrl)}" alt="${escapeHtml(albumObj.album)}" loading="lazy" onerror="this.src='assets/band_cover.jpg'">
            <button class="album-play-overlay play-album-btn" title="Play Album">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
          </div>
          <div class="album-title" title="${escapeHtml(albumObj.album)}">${escapeHtml(albumObj.album)}</div>
          <div class="album-artist">${escapeHtml(albumObj.artist)}</div>
          <div class="album-meta">
            <span>${albumObj.year || '—'}</span>
            <span class="bullet">•</span>
            <span>${albumObj.tracks.length} tracks</span>
          </div>
        </div>
      `;
    });

    albumsGrid.innerHTML = gridHtml;

    albumsGrid.querySelectorAll('.album-card').forEach(card => {
      const playBtn = card.querySelector('.play-album-btn');
      if (playBtn) {
        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const albumName = card.dataset.album;
          const albumObj = albumsMap.get(albumName);
          if (albumObj && albumObj.tracks.length > 0) {
            playTrackById(albumObj.tracks[0].id);
            queue = albumObj.tracks.slice(1).map(t => t.id);
            updateQueueBadge();
            renderQueueList();
            showToast(`Playing album: ${albumName}`);
          }
        });
      }

      card.addEventListener('click', (e) => {
        if (e.target.closest('.play-album-btn')) return;
        const albumName = card.dataset.album;
        activeView = 'tracks';
        updateViewTabs();
        setAlbumFilter(albumName);
      });
    });
  }

  // --- Iconic Band Front Covers Map ---
  const BAND_FRONT_COVERS = {
    'Artcell': 'https://raw.githubusercontent.com/GhostDog45/Artcell/master/Onno%20Shomoy/cover.jpg',
    'Black': 'https://raw.githubusercontent.com/GhostDog45/Black/master/Amar%20Prithibi/Album%20Cover/Amar%20Prithibi%20%5BFront%5D.jpg',
    'Aurthohin': 'https://raw.githubusercontent.com/GhostDog45/Aurthohin/master/Trimatrik/Album%20Cover/Trimatrik%20%5BFront%5D.jpg',
    'Bassbaba Sumon': 'https://raw.githubusercontent.com/GhostDog45/Bassbaba-Sumon/master/Sumon%20O%20Aurthohin/Album%20Cover/Sumon%20O%20Aurthohin%20%5BFront%5D.jpg',
    'Arbovirus': 'https://raw.githubusercontent.com/GhostDog45/Arbovirus/master/64min53sec%20%282007%29/Album%20Cover/64min53sec%20%5BFront%5D.jpg',
    'Indalo': 'https://raw.githubusercontent.com/GhostDog45/Indalo/master/Kokhon%20Kibhabe%20Ekhane%20Ke%20Jane/Album%20Cover/Kokhon%20Kibhabe%20Ekhane%20Ke%20Jane%20%5BFront%5D.jpg',
    'Minerva': 'https://raw.githubusercontent.com/GhostDog45/Minerva/master/Biday%20Songbidhan/Album%20Cover/folder.jpg',
    'Icons': 'https://raw.githubusercontent.com/GhostDog45/Icons/master/Ishshoronio%20%282005%29/Album%20Cover/folder.jpg',
    'Stoic Bliss': 'https://raw.githubusercontent.com/GhostDog45/Stoic-Bliss/master/Light%20Years%20Ahead/Album%20Cover/Light%20Years%20Ahead%20%5BFront-Back%5D.jpg',
    'The Watson Brothers': 'https://raw.githubusercontent.com/GhostDog45/The-Watson-Brothers/master/Ohom/Album%20Cover/Ohom%20%5BFront%5D.jpg',
    'Vibe': 'https://raw.githubusercontent.com/GhostDog45/Vibe/master/CHENA%20JOGOT/Album%20Cover/Chena%20Jogot%20%5BFront%5D.jpg'
  };

  // --- Render Artists Grid ---
  function renderArtistsGrid() {
    const artistsMap = new Map();
    const sourceTracks = searchQuery ? currentFilteredTracks : catalog;

    sourceTracks.forEach(t => {
      if (!artistsMap.has(t.artist)) {
        const cover = BAND_FRONT_COVERS[t.artist] || t.coverUrl || '';
        artistsMap.set(t.artist, {
          artist: t.artist,
          coverUrl: cover,
          tracksCount: 0,
          albumsSet: new Set()
        });
      }
      const a = artistsMap.get(t.artist);
      if (!a.coverUrl && t.coverUrl) {
        a.coverUrl = t.coverUrl;
      }
      a.tracksCount++;
      a.albumsSet.add(t.album);
    });

    const artistList = Array.from(artistsMap.values());
    if (sortBy === 'title-asc' || sortBy === 'artist-asc') {
      artistList.sort((a, b) => a.artist.localeCompare(b.artist));
    } else {
      artistList.sort((a, b) => b.tracksCount - a.tracksCount);
    }

    resultsCount.textContent = `Showing ${artistList.length} artists`;

    let gridHtml = '';
    artistList.forEach(artistObj => {
      gridHtml += `
        <div class="artist-card" data-artist="${escapeHtml(artistObj.artist)}">
          <img class="artist-avatar" src="${escapeHtml(artistObj.coverUrl)}" alt="${escapeHtml(artistObj.artist)}" loading="lazy" onerror="this.src='assets/band_cover.jpg'">
          <div class="artist-card-name">${escapeHtml(artistObj.artist)}</div>
          <div class="artist-card-count">${artistObj.tracksCount} tracks • ${artistObj.albumsSet.size} albums</div>
        </div>
      `;
    });

    artistsGrid.innerHTML = gridHtml;

    artistsGrid.querySelectorAll('.artist-card').forEach(card => {
      card.addEventListener('click', () => {
        const artist = card.dataset.artist;
        activeView = 'tracks';
        updateViewTabs();
        setArtistFilter(artist);
      });
    });
  }

  // --- Audio Player Logic ---
  function playTrackById(id) {
    const track = catalog.find(t => t.id === id);
    if (!track) return;

    currentTrack = track;
    currentTrackIndex = currentFilteredTracks.findIndex(t => t.id === id);

    // Update Player UI with Full Tooltips to prevent text cutoff
    playerTitle.textContent = track.title;
    playerTitle.title = track.title;
    playerArtist.textContent = track.artist;
    playerArtist.title = track.artist;
    playerAlbum.textContent = track.album;
    playerAlbum.title = track.album;
    playerCoverImg.src = track.coverUrl;
    playerDownloadBtn.href = track.downloadUrl || `${track.streamUrl}?download=true`;
    playerDownloadBtn.setAttribute('download', `${track.artist} - ${track.title}.flac`);

    if (track.isLossyTranscode) {
      playerQualityBadge.textContent = '16-CUT';
      playerQualityBadge.className = 'lossy-badge';
      playerQualityBadge.title = '16 kHz shelf cutoff lossy transcode';
    } else {
      playerQualityBadge.textContent = 'FLAC';
      playerQualityBadge.className = 'flac-badge';
      playerQualityBadge.title = 'Lossless FLAC Audio';
    }

    // Set Clean Audio Source (strip any trailing query parameters)
    const cleanUrl = (track.streamUrl || '').split('?')[0];
    if (audio.src !== cleanUrl) {
      audio.src = cleanUrl;
    }
    audio.load();

    audioSpinner.style.display = 'block';
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'none';

    if (visualizerEnabled) {
      initAudioVisualizer();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    audio.play().then(() => {
      isPlaying = true;
      updatePlayPauseState();
      updateMediaSession();
      if (visualizerEnabled) {
        initAudioVisualizer();
      }
      renderTracksTable(); // Update active row state
    }).catch(err => {
      console.warn('Playback error (possibly user interaction needed):', err);
      audioSpinner.style.display = 'none';
      playIcon.style.display = 'block';
    });

    // Update URL hash
    window.history.replaceState(null, '', `#track=${track.id}`);
  }

  function togglePlayPause() {
    if (!currentTrack) {
      if (currentFilteredTracks.length > 0) {
        playTrackById(currentFilteredTracks[0].id);
      }
      return;
    }

    if (visualizerEnabled) {
      initAudioVisualizer();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    if (audio.paused) {
      audio.play().then(() => {
        isPlaying = true;
        updatePlayPauseState();
      }).catch(err => {
        console.warn('Playback resume error:', err);
      });
    } else {
      audio.pause();
      isPlaying = false;
      updatePlayPauseState();
    }
  }

  function updatePlayPauseState() {
    if (isPlaying) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      audioSpinner.style.display = 'none';
      coverBars.classList.add('playing');
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      audioSpinner.style.display = 'none';
      coverBars.classList.remove('playing');
    }
    renderTracksTable();
  }

  function playNextTrack() {
    // If there is an item in the queue, pop from queue
    if (queue.length > 0) {
      const nextId = queue.shift();
      updateQueueBadge();
      renderQueueList();
      playTrackById(nextId);
      return;
    }

    if (currentFilteredTracks.length === 0) return;

    if (isShuffle) {
      const randomIndex = Math.floor(Math.random() * currentFilteredTracks.length);
      playTrackById(currentFilteredTracks[randomIndex].id);
      return;
    }

    let nextIndex = currentTrackIndex + 1;
    if (nextIndex >= currentFilteredTracks.length) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        return; // Stopped at end
      }
    }
    playTrackById(currentFilteredTracks[nextIndex].id);
  }

  function playPrevTrack() {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    if (currentFilteredTracks.length === 0) return;

    let prevIndex = currentTrackIndex - 1;
    if (prevIndex < 0) {
      prevIndex = currentFilteredTracks.length - 1;
    }
    playTrackById(currentFilteredTracks[prevIndex].id);
  }

  // --- Queue Logic ---
  function addToQueue(id) {
    const track = catalog.find(t => t.id === id);
    if (!track) return;
    queue.push(id);
    updateQueueBadge();
    renderQueueList();
    showToast(`Added to Up Next: "${track.title}"`);
  }

  function updateQueueBadge() {
    if (queue.length > 0) {
      queueBadge.textContent = queue.length;
      queueBadge.style.display = 'flex';
    } else {
      queueBadge.style.display = 'none';
    }
  }

  function renderQueueList() {
    if (queue.length === 0) {
      queueList.innerHTML = `<p style="color: var(--text-muted); font-size: 0.85rem; text-align: center; padding: 2rem 0;">No upcoming tracks in queue.<br>Click the queue icon on any song to add it here!</p>`;
      return;
    }

    let itemsHtml = '';
    queue.forEach((trackId, index) => {
      const track = catalog.find(t => t.id === trackId);
      if (!track) return;
      itemsHtml += `
        <div class="queue-item" data-index="${index}">
          <img class="queue-thumb" src="${escapeHtml(track.coverUrl)}" alt="Cover">
          <div class="queue-info">
            <div class="queue-title">${escapeHtml(track.title)}</div>
            <div class="queue-artist">${escapeHtml(track.artist)}</div>
          </div>
          <button class="queue-remove-btn" title="Remove from queue" data-index="${index}">✕</button>
        </div>
      `;
    });

    queueList.innerHTML = itemsHtml;

    queueList.querySelectorAll('.queue-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.index, 10);
        queue.splice(idx, 1);
        updateQueueBadge();
        renderQueueList();
      });
    });

    queueList.querySelectorAll('.queue-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.queue-remove-btn')) return;
        const idx = parseInt(item.dataset.index, 10);
        const nextId = queue.splice(idx, 1)[0];
        updateQueueBadge();
        renderQueueList();
        playTrackById(nextId);
      });
    });
  }

  // --- Audio Element Event Listeners ---
  audio.addEventListener('timeupdate', () => {
    if (!audio.duration || isNaN(audio.duration)) return;
    const progress = (audio.currentTime / audio.duration) * 100;
    seekSlider.value = progress;
    seekSlider.style.backgroundSize = `${progress}% 100%`;
    currentTimeLabel.textContent = formatTime(audio.currentTime);

    // Update MediaSession position state
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate,
          position: audio.currentTime
        });
      } catch (e) {}
    }
  });

  audio.addEventListener('durationchange', () => {
    durationLabel.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('progress', () => {
    if (audio.buffered.length > 0 && audio.duration) {
      const bufferedEnd = audio.buffered.end(audio.buffered.length - 1);
      const bufferPercent = (bufferedEnd / audio.duration) * 100;
      bufferBar.style.width = `${bufferPercent}%`;
    }
  });

  audio.addEventListener('waiting', () => {
    audioSpinner.style.display = 'block';
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'none';
  });

  audio.addEventListener('canplay', () => {
    audioSpinner.style.display = 'none';
    if (isPlaying) {
      pauseIcon.style.display = 'block';
    } else {
      playIcon.style.display = 'block';
    }
  });

  audio.addEventListener('ended', () => {
    if (repeatMode === 'one') {
      audio.currentTime = 0;
      audio.play();
    } else {
      playNextTrack();
    }
  });

  audio.addEventListener('error', (e) => {
    console.error('Audio stream error:', e);
    showToast('Failed to stream audio file. Check network or CORS.');
    audioSpinner.style.display = 'none';
    playIcon.style.display = 'block';
  });

  // --- Seek Slider Interaction ---
  seekSlider.addEventListener('input', () => {
    if (!audio.duration) return;
    const seekTime = (seekSlider.value / 100) * audio.duration;
    currentTimeLabel.textContent = formatTime(seekTime);
    seekSlider.style.backgroundSize = `${seekSlider.value}% 100%`;
  });

  seekSlider.addEventListener('change', () => {
    if (!audio.duration) return;
    audio.currentTime = (seekSlider.value / 100) * audio.duration;
  });

  // --- Volume Slider ---
  volumeSlider.addEventListener('input', () => {
    audio.volume = parseFloat(volumeSlider.value);
    volumeSlider.style.backgroundSize = `${audio.volume * 100}% 100%`;
    updateVolumeIcon();
  });

  volumeBtn.addEventListener('click', () => {
    if (audio.muted || audio.volume === 0) {
      audio.muted = false;
      audio.volume = parseFloat(volumeSlider.value) || 0.85;
    } else {
      audio.muted = true;
    }
    updateVolumeIcon();
  });

  function updateVolumeIcon() {
    if (audio.muted || audio.volume === 0) {
      volHighIcon.style.display = 'none';
      volMuteIcon.style.display = 'block';
    } else {
      volHighIcon.style.display = 'block';
      volMuteIcon.style.display = 'none';
    }
  }

  // --- Controls Buttons ---
  playPauseBtn.addEventListener('click', togglePlayPause);
  prevBtn.addEventListener('click', playPrevTrack);
  nextBtn.addEventListener('click', playNextTrack);

  shuffleBtn.addEventListener('click', () => {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
    showToast(isShuffle ? 'Shuffle: ON' : 'Shuffle: OFF');
  });

  repeatBtn.addEventListener('click', () => {
    if (repeatMode === 'all') {
      repeatMode = 'one';
      repeatBtn.classList.add('active');
      repeatOneIndicator.style.display = 'flex';
      showToast('Repeat: Current Track');
    } else if (repeatMode === 'one') {
      repeatMode = 'off';
      repeatBtn.classList.remove('active');
      repeatOneIndicator.style.display = 'none';
      showToast('Repeat: OFF');
    } else {
      repeatMode = 'all';
      repeatBtn.classList.add('active');
      repeatOneIndicator.style.display = 'none';
      showToast('Repeat: ALL');
    }
  });

  // --- Search Input Events ---
  let searchDebounceTimer = null;
  globalSearchInput.addEventListener('input', () => {
    clearSearchBtn.style.display = globalSearchInput.value ? 'block' : 'none';
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyFilters, 150);
  });

  clearSearchBtn.addEventListener('click', () => {
    globalSearchInput.value = '';
    clearSearchBtn.style.display = 'none';
    applyFilters();
    globalSearchInput.focus();
  });

  resetFilterBtn.addEventListener('click', () => {
    activeArtistFilter = 'all';
    activeAlbumFilter = 'all';
    artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.artist === 'all');
    });
    activeFilterBanner.style.display = 'none';
    applyFilters();
  });

  clearAllFiltersBtn.addEventListener('click', () => {
    globalSearchInput.value = '';
    clearSearchBtn.style.display = 'none';
    activeArtistFilter = 'all';
    activeAlbumFilter = 'all';
    artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.artist === 'all');
    });
    activeFilterBanner.style.display = 'none';
    applyFilters();
  });

  sortSelect.addEventListener('change', () => {
    sortBy = sortSelect.value;
    applyFilters();
  });

  // --- View Tabs Switcher ---
  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activeView = tab.dataset.view;
      updateViewTabs();
      renderCurrentView();
    });
  });

  function updateViewTabs() {
    viewTabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === activeView);
    });
  }

  // --- Queue Drawer Controls ---
  queueDrawerBtn.addEventListener('click', () => {
    queueDrawer.classList.toggle('open');
  });

  closeQueueBtn.addEventListener('click', () => {
    queueDrawer.classList.remove('open');
  });

  clearQueueBtn.addEventListener('click', () => {
    queue = [];
    updateQueueBadge();
    renderQueueList();
    showToast('Queue cleared');
  });

  // --- Brand Home Button ---
  brandHomeBtn.addEventListener('click', () => {
    globalSearchInput.value = '';
    clearSearchBtn.style.display = 'none';
    activeView = 'tracks';
    updateViewTabs();
    activeArtistFilter = 'all';
    activeAlbumFilter = 'all';
    artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.artist === 'all');
    });
    activeFilterBanner.style.display = 'none';
    applyFilters();
  });

  // --- MediaSession API Integration ---
  function updateMediaSession() {
    if (!('mediaSession' in navigator) || !currentTrack) return;

    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.artist,
      album: currentTrack.album,
      artwork: [
        { src: currentTrack.coverUrl, sizes: '96x96', type: 'image/jpeg' },
        { src: currentTrack.coverUrl, sizes: '128x128', type: 'image/jpeg' },
        { src: currentTrack.coverUrl, sizes: '256x256', type: 'image/jpeg' },
        { src: currentTrack.coverUrl, sizes: '512x512', type: 'image/jpeg' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => {
      audio.play();
      isPlaying = true;
      updatePlayPauseState();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      audio.pause();
      isPlaying = false;
      updatePlayPauseState();
    });
    navigator.mediaSession.setActionHandler('previoustrack', playPrevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', playNextTrack);
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime && audio.duration) {
        audio.currentTime = details.seekTime;
      }
    });
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      audio.currentTime = Math.max(audio.currentTime - (details.seekOffset || 10), 0);
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      audio.currentTime = Math.min(audio.currentTime + (details.seekOffset || 10), audio.duration);
    });
  }

  // --- Web Audio Visualizer ---
  function initAudioVisualizer() {
    if (audioCtx) {
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      return;
    }
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      audioCtx = new AudioContextClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      sourceNode = audioCtx.createMediaElementSource(audio);
      sourceNode.connect(analyser);
      analyser.connect(audioCtx.destination);

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      startVisualizerLoop();
    } catch (err) {
      console.warn('Web Audio API visualizer initialization notice:', err);
      // Start loop for dynamic harmonic visualizer even if Web Audio element source failed
      startVisualizerLoop();
    }
  }

  function startVisualizerLoop() {
    if (visualizerAnimId) return;

    const ctx = visualizerCanvas.getContext('2d');
    const numBars = 32;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(numBars);

    function draw() {
      visualizerAnimId = requestAnimationFrame(draw);
      if (!visualizerEnabled) return;

      if (visualizerCanvas.width !== window.innerWidth) {
        visualizerCanvas.width = window.innerWidth;
        visualizerCanvas.height = 90;
      }

      let hasSignal = false;
      if (analyser && isPlaying && !audio.paused) {
        analyser.getByteFrequencyData(dataArray);
        for (let i = 0; i < dataArray.length; i++) {
          if (dataArray[i] > 0) {
            hasSignal = true;
            break;
          }
        }
      }

      ctx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
      const bufferLen = analyser ? analyser.frequencyBinCount : numBars;
      const barWidth = (visualizerCanvas.width / bufferLen) * 2.2;
      const now = performance.now() * 0.003;

      let x = 0;
      for (let i = 0; i < bufferLen; i++) {
        let barHeight = 0;
        if (isPlaying && !audio.paused) {
          if (hasSignal) {
            barHeight = (dataArray[i] / 255) * (visualizerCanvas.height * 0.85);
          } else {
            // Dynamic harmonic waveform when frequency data is zero or during CORS restriction
            const wave = (Math.sin(now * 3 + i * 0.35) * 0.5 + 0.5) * 
                         (Math.cos(now * 1.5 + i * 0.15) * 0.3 + 0.7);
            barHeight = Math.max(4, wave * (visualizerCanvas.height * 0.75));
          }
        } else {
          barHeight = 2; // Flat subtle baseline when paused
        }

        const grad = ctx.createLinearGradient(0, visualizerCanvas.height, 0, visualizerCanvas.height - barHeight);
        grad.addColorStop(0, 'rgba(139, 92, 246, 0.25)');
        grad.addColorStop(0.7, 'rgba(192, 132, 252, 0.75)');
        grad.addColorStop(1, 'rgba(236, 72, 153, 0.95)');

        ctx.fillStyle = grad;
        ctx.fillRect(x, visualizerCanvas.height - barHeight, Math.max(1, barWidth - 3), barHeight);
        x += barWidth;
      }
    }
    draw();
  }

  themeToggleBtn.addEventListener('click', () => {
    visualizerEnabled = !visualizerEnabled;
    visualizerCanvas.classList.toggle('active', visualizerEnabled);
    themeToggleBtn.classList.toggle('active', visualizerEnabled);

    if (visualizerEnabled) {
      initAudioVisualizer();
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      visualizerCanvas.width = window.innerWidth;
      visualizerCanvas.height = 90;
      startVisualizerLoop();
    }
    showToast(visualizerEnabled ? 'Audio Spectrum: ON' : 'Audio Spectrum: OFF');
  });

  window.addEventListener('resize', () => {
    if (visualizerCanvas) {
      visualizerCanvas.width = window.innerWidth;
      visualizerCanvas.height = 90;
    }
  });

  // --- Keyboard Shortcuts ---
  window.addEventListener('keydown', (e) => {
    // If typing in search box, ignore playback shortcuts
    if (document.activeElement === globalSearchInput) {
      if (e.key === 'Escape') {
        globalSearchInput.blur();
      }
      return;
    }

    if (e.key === '/' || e.key === 'f') {
      e.preventDefault();
      globalSearchInput.focus();
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === 'ArrowRight') {
      audio.currentTime = Math.min(audio.currentTime + 5, audio.duration || 0);
    } else if (e.key === 'ArrowLeft') {
      audio.currentTime = Math.max(audio.currentTime - 5, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      audio.volume = Math.min(audio.volume + 0.05, 1);
      volumeSlider.value = audio.volume;
      volumeSlider.style.backgroundSize = `${audio.volume * 100}% 100%`;
      updateVolumeIcon();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      audio.volume = Math.max(audio.volume - 0.05, 0);
      volumeSlider.value = audio.volume;
      volumeSlider.style.backgroundSize = `${audio.volume * 100}% 100%`;
      updateVolumeIcon();
    } else if (e.key === 'm' || e.key === 'M') {
      volumeBtn.click();
    } else if (e.key === 'n' || e.key === 'N') {
      playNextTrack();
    } else if (e.key === 'p' || e.key === 'P') {
      playPrevTrack();
    } else if (e.key === 's' || e.key === 'S') {
      shuffleBtn.click();
    } else if (e.key === 'r' || e.key === 'R') {
      repeatBtn.click();
    }
  });

  // --- Helper: URL Deep Linking ---
  function initFromUrlParams() {
    const hash = window.location.hash;
    if (hash.startsWith('#track=')) {
      const trackId = hash.replace('#track=', '');
      playTrackById(trackId);
    } else if (hash.startsWith('#artist=')) {
      const artist = decodeURIComponent(hash.replace('#artist=', ''));
      setArtistFilter(artist);
    } else if (hash.startsWith('#album=')) {
      const album = decodeURIComponent(hash.replace('#album=', ''));
      setAlbumFilter(album);
    }
  }

  // --- Helper: HTML Escaper ---
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // --- Run on Load ---
  document.addEventListener('DOMContentLoaded', loadCatalog);

})();
