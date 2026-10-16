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
  let isSeeking = false;
  let isFullTracksListExpanded = false;
  let albumCoversMap = {};
  let currentLightboxImages = [];
  let currentLightboxIndex = 0;

  // Curated 18 Essential / Iconic Tracks for Instant Homepage Load
  const CURATED_HOMEPAGE_TRACK_IDS = [
    // Arbovirus
    'track-12', // Shorger Shishura
    'track-5',  // Adhar O Ishshor
    'track-7',  // Omanush
    // Black
    'track-266', // Kobor
    'track-273', // Miththa
    'track-276', // Sloak
    'track-296', // Na-Thaka Jibon
    'track-309', // Ajo
    'track-503', // Opolap
    // Artcell
    'track-61', // Gontobbohin
    'track-75', // Ei Bidaye
    // The Watson Brothers
    'track-418', // Ohom
    'track-423', // Shore Daray, Shesh Barer Moto
    'track-414', // Akash
    // Aurthohin
    'track-143', // Golper Shuru
    'track-100', // Rater Train
    'track-117', // Rongdhonu
    'track-139'  // Uru Uru Mon
  ];

  // Audio Context & Visualizer State
  let audioCtx = null;
  let analyser = null;
  let sourceNode = null;
  let visualizerAnimId = null;
  let visualizerEnabled = true;

  // Precision 10-Band Graphic Equalizer State
  const EQ_FREQUENCIES = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const EQ_LABELS = ['32', '64', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];
  
  const EQ_PRESETS = {
    flat: { name: 'Flat (Bit-Perfect)', preamp: 0, gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    rock: { name: 'Rock / Metal Bite', preamp: -1.5, gains: [4.5, 3.0, 1.0, -1.0, -2.5, 0.5, 2.5, 3.5, 3.0, 2.0] },
    bassbaba: { name: 'Bassbaba (Deep Bass)', preamp: -2.5, gains: [6.5, 5.5, 4.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0] },
    vocal: { name: 'Vocal Clarity', preamp: -1.0, gains: [-2.0, -1.5, 0.0, 1.0, 2.5, 3.5, 3.0, 2.0, 1.0, 0.0] },
    acoustic: { name: 'Acoustic & Unplugged', preamp: -1.0, gains: [2.0, 2.5, 1.5, 0.0, 1.0, 1.5, 2.0, 3.0, 3.5, 2.5] },
    electronic: { name: 'Electronic / Beats', preamp: -1.5, gains: [5.0, 4.0, 1.0, 0.0, -1.0, 1.0, 2.0, 3.0, 4.0, 4.5] },
    treble: { name: 'Treble Boost', preamp: -1.5, gains: [-2.0, -1.0, 0.0, 0.0, 1.0, 2.0, 3.5, 5.0, 5.5, 6.0] }
  };

  let eqEnabled = true;
  let eqFilters = [];
  let eqPreampNode = null;
  let currentEqGains = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let currentPreamp = 0;
  let currentPresetKey = 'flat';

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
  const shareFilterBtn = document.getElementById('shareFilterBtn');
  const clearAllFiltersBtn = document.getElementById('clearAllFiltersBtn');
  const seeMoreWrap = document.getElementById('seeMoreWrap');
  const seeMoreBtn = document.getElementById('seeMoreBtn');

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
  const playerShareBtn = document.getElementById('playerShareBtn');
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  const visualizerCanvas = document.getElementById('visualizerCanvas');
  const eqBtn = document.getElementById('eqBtn');
  const eqActiveDot = document.getElementById('eqActiveDot');

  // Queue Elements
  const queueDrawer = document.getElementById('queueDrawer');
  const queueDrawerBtn = document.getElementById('queueDrawerBtn');
  const closeQueueBtn = document.getElementById('closeQueueBtn');
  const clearQueueBtn = document.getElementById('clearQueueBtn');
  const queueList = document.getElementById('queueList');
  const queueBadge = document.getElementById('queueBadge');
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');

  // Credits Modal Elements
  const creditsBtn = document.getElementById('creditsBtn');
  const creditsModal = document.getElementById('creditsModal');
  const closeCreditsModalBtn = document.getElementById('closeCreditsModalBtn');
  const okCreditsBtn = document.getElementById('okCreditsBtn');

  // Precision Equalizer Elements
  const eqModal = document.getElementById('eqModal');
  const closeEqBtn = document.getElementById('closeEqBtn');
  const eqToggle = document.getElementById('eqToggle');
  const eqStatusLabel = document.getElementById('eqStatusLabel');
  const eqPresetSelect = document.getElementById('eqPresetSelect');
  const eqResetBtn = document.getElementById('eqResetBtn');
  const eqPreamp = document.getElementById('eqPreamp');
  const preampVal = document.getElementById('preampVal');
  const eqBandsRack = document.getElementById('eqBandsRack');

  // Landing Page & Manifesto Overlay Elements
  const landingOverlay = document.getElementById('landingOverlay');
  const enterArchiveBtn = document.getElementById('enterArchiveBtn');
  const closeLandingBtn = document.getElementById('closeLandingBtn');
  const storyBtn = document.getElementById('storyBtn');

  // Direct Link Autoplay Floating Prompt Elements
  const directAutoplayPrompt = document.getElementById('directAutoplayPrompt');
  const directAutoplayBtn = document.getElementById('directAutoplayBtn');
  const autoplayPromptTrack = document.getElementById('autoplayPromptTrack');
  const directAutoplayDismiss = document.getElementById('directAutoplayDismiss');
  let activeAutoplayGestureHandler = null;
  
  // Album Artwork Gallery Elements
  const albumGallerySection = document.getElementById('albumGallerySection');
  const galleryAlbumTitle = document.getElementById('galleryAlbumTitle');
  const gallerySubtext = document.getElementById('gallerySubtext');
  const galleryCountBadge = document.getElementById('galleryCountBadge');
  const albumGalleryGrid = document.getElementById('albumGalleryGrid');

  // Fullscreen Image Lightbox Modal Elements
  const imageLightboxModal = document.getElementById('imageLightboxModal');
  const lightboxBackdrop = document.getElementById('lightboxBackdrop');
  const lightboxTitle = document.getElementById('lightboxTitle');
  const lightboxCounter = document.getElementById('lightboxCounter');
  const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');
  const lightboxPrevBtn = document.getElementById('lightboxPrevBtn');
  const lightboxNextBtn = document.getElementById('lightboxNextBtn');
  const lightboxImg = document.getElementById('lightboxImg');

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
      const response = await fetch('catalog.json?v=3.2');
      if (!response.ok) throw new Error('Failed to load catalog.json');
      catalog = await response.json();
      
      // Dynamically update search placeholder and hints from live catalog size
      if (globalSearchInput) {
        globalSearchInput.placeholder = `Search ${catalog.length}+ songs, bands, albums, or lyrics...`;
      }
      const seeMoreHint = document.getElementById('seeMoreHint');
      if (seeMoreHint) {
        seeMoreHint.textContent = `Or use the search bar above to instantly find any of the ${catalog.length} songs`;
      }

      // Dynamically load any newly mapped artist images from artists_map.json
      try {
        const artResp = await fetch('assets/artists/artists_map.json?v=3.2');
        if (artResp.ok) {
          const dynamicMap = await artResp.json();
          Object.assign(ARTIST_OFFICIAL_IMAGES, dynamicMap);
        }
      } catch (err) {
        console.warn('Notice: dynamic artists_map.json skipped, using built-in map.', err);
      }

      // Dynamically load album artwork & physical archive scans
      try {
        const covResp = await fetch('assets/album_covers.json?v=3.2');
        if (covResp.ok) {
          albumCoversMap = await covResp.json();
        }
      } catch (err) {
        console.warn('Notice: dynamic album_covers.json skipped.', err);
      }

      isFullTracksListExpanded = false;
      initArtistFilterBar();
      initFromUrlParams();
      pushNavState({}, true);
      setupDefaultVisualizer();
      loadSavedEqSettings();
      renderEqBands();
    } catch (err) {
      console.error('Catalog load error:', err);
      trackCountLabel.textContent = 'Failed to load catalogue';
      showToast('Error loading songs catalogue. Please refresh.');
    }
  }

  // --- Initialize Audio Spectrum Visualizer by Default ---
  function setupDefaultVisualizer() {
    if (visualizerEnabled) {
      visualizerCanvas.classList.add('active');
      themeToggleBtn.classList.add('active');
      visualizerCanvas.width = window.innerWidth;
      visualizerCanvas.height = 90;
      startVisualizerLoop();
    }
  }

  // --- Initialize Artist Filter Pills ---
  function initArtistFilterBar() {
    // Count tracks per artist (including collaborative tracks for all participating artists)
    const artistCounts = {};
    catalog.forEach(t => {
      const trackArtists = (t.artists && t.artists.length > 0) ? t.artists : [t.artist];
      trackArtists.forEach(art => {
        artistCounts[art] = (artistCounts[art] || 0) + 1;
      });
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

  // --- Navigation & Browser History State ---
  function pushNavState(opts = {}, replace = false) {
    const state = {
      view: opts.view !== undefined ? opts.view : activeView,
      artist: opts.artist !== undefined ? opts.artist : activeArtistFilter,
      album: opts.album !== undefined ? opts.album : activeAlbumFilter,
      search: opts.search !== undefined ? opts.search : globalSearchInput.value
    };

    let hash = '';
    if (state.album !== 'all') {
      hash = `#album=${encodeURIComponent(state.album)}`;
    } else if (state.artist !== 'all') {
      hash = `#artist=${encodeURIComponent(state.artist)}`;
    } else if (state.view !== 'tracks') {
      hash = `#${state.view}`;
    }

    if (replace) {
      window.history.replaceState(state, '', hash || window.location.pathname);
    } else {
      window.history.pushState(state, '', hash || window.location.pathname);
    }
  }

  window.addEventListener('popstate', (e) => {
    if (e.state) {
      activeView = e.state.view || 'tracks';
      activeArtistFilter = e.state.artist || 'all';
      activeAlbumFilter = e.state.album || 'all';
      globalSearchInput.value = e.state.search || '';
      clearSearchBtn.style.display = globalSearchInput.value ? 'block' : 'none';
      isFullTracksListExpanded = !!(globalSearchInput.value || activeArtistFilter !== 'all' || activeAlbumFilter !== 'all');

      // Update pills UI
      artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.artist === activeArtistFilter);
      });

      // Update banner UI
      if (activeAlbumFilter !== 'all') {
        activeFilterBanner.style.display = 'flex';
        activeFilterValue.textContent = `Album: ${activeAlbumFilter}`;
        if (shareFilterBtn) shareFilterBtn.style.display = 'inline-flex';
      } else if (activeArtistFilter !== 'all') {
        activeFilterBanner.style.display = 'flex';
        activeFilterValue.textContent = activeArtistFilter;
        if (shareFilterBtn) shareFilterBtn.style.display = 'inline-flex';
      } else {
        activeFilterBanner.style.display = 'none';
        if (shareFilterBtn) shareFilterBtn.style.display = 'none';
      }

      updateViewTabs();
      applyFilters();
    } else {
      initFromUrlParams();
    }
  });

  // --- Set Active Artist Filter ---
  function setArtistFilter(artist, shouldPushState = true) {
    activeArtistFilter = artist;
    activeAlbumFilter = 'all';
    isFullTracksListExpanded = (artist !== 'all');
    
    // Update active pill UI
    artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.artist === artist);
    });

    // Update banner
    if (artist !== 'all') {
      activeFilterBanner.style.display = 'flex';
      activeFilterValue.textContent = artist;
      if (shareFilterBtn) shareFilterBtn.style.display = 'inline-flex';
    } else {
      activeFilterBanner.style.display = 'none';
      if (shareFilterBtn) shareFilterBtn.style.display = 'none';
    }

    if (shouldPushState) {
      pushNavState({ view: 'tracks', artist: artist, album: 'all' });
    }

    applyFilters();
  }

  // --- Set Active Album Filter ---
  function setAlbumFilter(albumName, shouldPushState = true) {
    activeAlbumFilter = albumName;
    activeArtistFilter = 'all';
    isFullTracksListExpanded = (albumName !== 'all');

    // Reset artist pills UI to All
    artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.artist === 'all');
    });

    // Update banner
    if (albumName !== 'all') {
      activeFilterBanner.style.display = 'flex';
      activeFilterValue.textContent = `Album: ${albumName}`;
      if (shareFilterBtn) shareFilterBtn.style.display = 'inline-flex';
    } else {
      activeFilterBanner.style.display = 'none';
      if (shareFilterBtn) shareFilterBtn.style.display = 'none';
    }

    if (shouldPushState) {
      pushNavState({ view: 'tracks', album: albumName, artist: 'all' });
    }

    applyFilters();
  }

  // --- Empty State Display ---
  function showNoResultsState(viewType) {
    tracksView.style.display = 'none';
    albumsView.style.display = 'none';
    artistsView.style.display = 'none';
    if (albumGallerySection) albumGallerySection.style.display = 'none';
    tracksView.classList.remove('active');
    albumsView.classList.remove('active');
    artistsView.classList.remove('active');
    noResultsState.style.display = 'block';
    if (seeMoreWrap) seeMoreWrap.style.display = 'none';

    const heading = noResultsState.querySelector('h3');
    const desc = noResultsState.querySelector('p');

    if (viewType === 'albums') {
      resultsCount.textContent = 'Showing 0 albums';
      if (heading) heading.textContent = 'No matching albums found';
      if (desc) desc.textContent = 'Try searching for a different album title, artist, or release year.';
    } else if (viewType === 'artists') {
      resultsCount.textContent = 'Showing 0 artists';
      if (heading) heading.textContent = 'No matching artists found';
      if (desc) desc.textContent = 'Try searching for a different band or artist name.';
    } else {
      resultsCount.textContent = 'Showing 0 tracks';
      if (heading) heading.textContent = 'No matching tracks found';
      if (desc) desc.textContent = 'Try searching for a different song title, artist, or album keyword.';
    }
  }

  // --- Filter & Search Logic ---
  function applyFilters() {
    const rawQuery = globalSearchInput.value.trim();
    const query = normalizeQuery(rawQuery);
    searchQuery = query;
    const tokens = query.split(' ').filter(Boolean);

    const isCuratedHomepage = (
      activeView === 'tracks' &&
      tokens.length === 0 &&
      activeArtistFilter === 'all' &&
      activeAlbumFilter === 'all' &&
      !isFullTracksListExpanded
    );

    let filtered = [];

    if (isCuratedHomepage) {
      filtered = CURATED_HOMEPAGE_TRACK_IDS.map(id => catalog.find(t => t.id === id)).filter(Boolean);
    } else {
      filtered = catalog.filter(track => {
        // Artist filter (supports multi-artist collaborations like Ashirbad)
        if (activeArtistFilter !== 'all') {
          const trackArtists = (track.artists && track.artists.length > 0) ? track.artists : [track.artist];
          if (!trackArtists.includes(activeArtistFilter) && track.artist !== activeArtistFilter) {
            return false;
          }
        }

        // Album filter
        if (activeAlbumFilter !== 'all' && track.album !== activeAlbumFilter) {
          return false;
        }

        // Multi-Token Keyword Search across title, artist, album, year, featured, and repo
        if (tokens.length > 0) {
          const trackArtists = (track.artists && track.artists.length > 0) ? track.artists.join(' ') : (track.artist || '');
          const repo = (track.repo || '').replace(/-/g, ' ');
          const blob = normalizeQuery(`${track.title} ${track.artist} ${trackArtists} ${track.album} ${track.year || ''} ${track.featured || ''} ${repo}`);
          return tokens.every(tok => blob.includes(tok));
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
    }

    currentFilteredTracks = filtered;
    renderCurrentView();
  }

  // --- Render Views ---
  function renderCurrentView() {
    if (activeView === 'tracks') {
      if (currentFilteredTracks.length === 0) {
        showNoResultsState('tracks');
        return;
      }

      noResultsState.style.display = 'none';
      renderTracksTable();
      tracksView.style.display = 'block';
      albumsView.style.display = 'none';
      artistsView.style.display = 'none';
      tracksView.classList.add('active');
      albumsView.classList.remove('active');
      artistsView.classList.remove('active');
      tracksTable.style.display = 'table';

      const rawQuery = globalSearchInput.value.trim();
      const isCuratedHomepage = (
        !rawQuery &&
        activeArtistFilter === 'all' &&
        activeAlbumFilter === 'all' &&
        !isFullTracksListExpanded
      );

      if (isCuratedHomepage) {
        trackCountLabel.textContent = `18 Featured (${catalog.length} in Archive)`;
        resultsCount.textContent = `Showing ${currentFilteredTracks.length} Featured Classics • Instant Load (${catalog.length} Songs in Archive)`;
        if (seeMoreWrap) {
          seeMoreWrap.style.display = 'flex';
          if (seeMoreBtn) {
            seeMoreBtn.innerHTML = `
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg>
              <span>See All Tracks (${catalog.length} Songs)</span>
            `;
          }
        }
      } else {
        trackCountLabel.textContent = `${catalog.length} FLAC Tracks`;
        resultsCount.textContent = `Showing ${currentFilteredTracks.length} of ${catalog.length} tracks`;
        if (seeMoreWrap) {
          if (!rawQuery && activeArtistFilter === 'all' && activeAlbumFilter === 'all' && isFullTracksListExpanded) {
            seeMoreWrap.style.display = 'flex';
            if (seeMoreBtn) {
              seeMoreBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/></svg>
                <span>Collapse to 18 Featured Classics</span>
              `;
            }
          } else {
            seeMoreWrap.style.display = 'none';
          }
        }
      }

      // Dynamically render album covers gallery if viewing an album
      renderAlbumGallery(activeAlbumFilter);
    } else if (activeView === 'albums') {
      if (albumGallerySection) albumGallerySection.style.display = 'none';
      tracksView.style.display = 'none';
      artistsView.style.display = 'none';
      tracksView.classList.remove('active');
      artistsView.classList.remove('active');

      const albumList = renderAlbumsGrid();
      if (!albumList || albumList.length === 0) {
        showNoResultsState('albums');
        return;
      }
      noResultsState.style.display = 'none';
      albumsView.style.display = 'block';
      albumsView.classList.add('active');
      albumsGrid.style.display = 'grid';
    } else if (activeView === 'artists') {
      if (albumGallerySection) albumGallerySection.style.display = 'none';
      tracksView.style.display = 'none';
      albumsView.style.display = 'none';
      tracksView.classList.remove('active');
      albumsView.classList.remove('active');

      const artistList = renderArtistsGrid();
      if (!artistList || artistList.length === 0) {
        showNoResultsState('artists');
        return;
      }
      noResultsState.style.display = 'none';
      artistsView.style.display = 'block';
      artistsView.classList.add('active');
      artistsGrid.style.display = 'grid';
    }
  }

  // --- Format Artist Cell for Tracks Table (handles single and multi-artists) ---
  function formatArtistCell(track) {
    const artists = (track.artists && track.artists.length > 0) ? track.artists : [track.artist];
    if (artists.length <= 1) {
      return `<a href="#" class="clickable-link artist-link" data-artist="${escapeHtml(track.artist)}">${escapeHtml(track.artist)}</a>`;
    }
    const links = artists.map(a => `<a href="#" class="clickable-link artist-link" data-artist="${escapeHtml(a)}">${escapeHtml(a)}</a>`);
    if (links.length === 2) {
      return `${links[0]} &amp; ${links[1]}`;
    }
    return `${links.slice(0, -1).join(', ')} &amp; ${links[links.length - 1]}`;
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

      const hasFeatInTitle = track.title.toLowerCase().includes('feat') || track.title.toLowerCase().includes('ft.');
      const featTag = (track.featured && !hasFeatInTitle) ? `<span class="track-feat">(ft. ${escapeHtml(track.featured)})</span>` : '';
      
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
              <img class="track-thumb" src="${escapeHtml(track.coverUrl)}" alt="Cover" loading="lazy" onerror="this.src='assets/default_album_cover.svg'">
              <div class="track-details">
                <span class="track-title-cell">${escapeHtml(track.title)} ${featTag}</span>
              </div>
            </div>
          </td>
          <td class="td-artist">
            ${formatArtistCell(track)}
          </td>
          <td class="td-album">
            <a href="#" class="clickable-link album-link" data-album="${escapeHtml(track.album)}">${escapeHtml(track.album)}</a>
          </td>
          <td class="td-year">${track.year || '—'}</td>
          <td class="td-quality">${qualityTag}</td>
          <td class="td-actions">
            <div class="row-actions">
              <button class="row-action-btn share-track-btn" title="Copy Direct Song Link" data-id="${track.id}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </button>
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

    // Attach share link buttons
    tracksTbody.querySelectorAll('.share-track-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const trackId = btn.dataset.id;
        copyTrackShareLink(trackId);
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
    const rawQuery = globalSearchInput.value.trim();
    const query = normalizeQuery(rawQuery);
    const tokens = query.split(' ').filter(Boolean);

    // Group catalog by album
    const albumsMap = new Map();
    catalog.forEach(t => {
      if (!albumsMap.has(t.album)) {
        const gallery = albumCoversMap[t.album] || albumCoversMap[`${t.artist} - ${t.album}`] || [];
        const verifiedCover = (gallery.length > 0 && gallery[0].url) ? gallery[0].url : (t.coverUrl || 'assets/default_album_cover.svg');
        albumsMap.set(t.album, {
          album: t.album,
          artist: t.repo === 'Mixed-Albums' ? 'Mixed Albums' : t.artist,
          year: t.year,
          coverUrl: verifiedCover,
          repo: (t.repo || '').replace(/-/g, ' '),
          tracks: []
        });
      }
      albumsMap.get(t.album).tracks.push(t);
    });

    let albumList = Array.from(albumsMap.values());

    // Filter by activeArtistFilter if active
    if (activeArtistFilter !== 'all') {
      albumList = albumList.filter(album => {
        return album.tracks.some(t => {
          const trackArtists = (t.artists && t.artists.length > 0) ? t.artists : [t.artist];
          return trackArtists.includes(activeArtistFilter) || t.artist === activeArtistFilter;
        });
      });
    }

    // Filter by search query tokens if present
    if (tokens.length > 0) {
      albumList = albumList.filter(album => {
        const trackTitles = album.tracks.map(t => t.title).join(' ');
        const trackArtists = album.tracks.map(t => (t.artists || [t.artist]).join(' ')).join(' ');
        const blob = normalizeQuery(`${album.album} ${album.artist} ${album.year || ''} ${album.repo} ${trackTitles} ${trackArtists}`);
        return tokens.every(tok => blob.includes(tok));
      });
    }

    // Sort albums
    if (sortBy === 'title-asc') {
      albumList.sort((a, b) => a.album.localeCompare(b.album));
    } else if (sortBy === 'artist-asc') {
      albumList.sort((a, b) => a.artist.localeCompare(b.artist));
    } else if (sortBy === 'year-desc') {
      albumList.sort((a, b) => (b.year || 0) - (a.year || 0));
    } else if (sortBy === 'year-asc') {
      albumList.sort((a, b) => (a.year || 9999) - (b.year || 9999));
    }

    if (albumList.length === 0) {
      return [];
    }

    resultsCount.textContent = `Showing ${albumList.length} album${albumList.length === 1 ? '' : 's'}`;

    let gridHtml = '';
    albumList.forEach(albumObj => {
      gridHtml += `
        <div class="album-card" data-album="${escapeHtml(albumObj.album)}">
          <button class="album-share-btn" data-album="${escapeHtml(albumObj.album)}" title="Share album preview link with artwork">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
          <div class="album-cover-wrap">
            <img class="album-cover-img" src="${escapeHtml(albumObj.coverUrl)}" alt="${escapeHtml(albumObj.album)}" loading="lazy" onerror="this.src='assets/default_album_cover.svg'">
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
      const shareBtn = card.querySelector('.album-share-btn');
      if (shareBtn) {
        shareBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const albumName = card.dataset.album;
          copyAlbumShareLink(albumName);
        });
      }

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
        if (e.target.closest('.play-album-btn') || e.target.closest('.album-share-btn')) return;
        const albumName = card.dataset.album;
        pushNavState({ view: 'tracks', album: albumName, artist: 'all', search: '' });
        activeView = 'tracks';
        updateViewTabs();
        setAlbumFilter(albumName, false);
      });
    });

    return albumList;
  }

  // --- Dynamic Album Artwork & Physical Archive Gallery ---
  function renderAlbumGallery(albumName) {
    if (!albumGallerySection) return;

    // Only display when inside an individual album and in tracks view
    if (activeView !== 'tracks' || activeAlbumFilter === 'all' || !albumName) {
      albumGallerySection.style.display = 'none';
      return;
    }

    // Determine artist context if available
    let artistName = (activeArtistFilter && activeArtistFilter !== 'all') ? activeArtistFilter : '';
    if (!artistName && currentFilteredTracks && currentFilteredTracks.length > 0) {
      const firstArtist = currentFilteredTracks[0].artist;
      const allSame = currentFilteredTracks.every(t => t.artist === firstArtist);
      if (allSame) {
        artistName = firstArtist;
      }
    }

    let covers = [];
    if (artistName && albumCoversMap[`${artistName} - ${albumName}`]) {
      covers = albumCoversMap[`${artistName} - ${albumName}`];
    } else {
      covers = albumCoversMap[albumName] || [];
    }
    if (!covers || covers.length === 0) {
      albumGallerySection.style.display = 'none';
      return;
    }

    albumGallerySection.style.display = 'block';
    if (galleryAlbumTitle) {
      galleryAlbumTitle.textContent = `${albumName} — Physical Artwork & Archive`;
    }
    if (gallerySubtext) {
      gallerySubtext.textContent = `High-resolution scans of original physical release: booklets, inlays, and CD artwork.`;
    }
    if (galleryCountBadge) {
      galleryCountBadge.textContent = `${covers.length} ${covers.length === 1 ? 'Scan' : 'Scans / Art'}`;
    }

    let cardsHtml = '';
    covers.forEach((item, idx) => {
      cardsHtml += `
        <div class="album-gallery-card" data-index="${idx}" title="Click to view ${escapeHtml(item.title)} in HD">
          <div class="gallery-card-thumb-wrap">
            <img class="gallery-card-thumb" src="${escapeHtml(item.url)}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='assets/default_album_cover.svg'">
            <div class="gallery-card-overlay">
              <div class="gallery-zoom-icon">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
              </div>
            </div>
          </div>
          <div class="gallery-card-info">
            <span class="gallery-card-tag">${escapeHtml(item.title)}</span>
          </div>
        </div>
      `;
    });

    if (albumGalleryGrid) {
      albumGalleryGrid.innerHTML = cardsHtml;

      albumGalleryGrid.querySelectorAll('.album-gallery-card').forEach(card => {
        card.addEventListener('click', () => {
          const idx = parseInt(card.dataset.index, 10);
          openLightbox(idx, covers);
        });
      });
    }
  }

  // --- Fullscreen Artwork Lightbox Modal ---
  function openLightbox(index, images) {
    if (!images || images.length === 0 || !imageLightboxModal) return;
    currentLightboxImages = images;
    currentLightboxIndex = index;
    updateLightboxView();
    imageLightboxModal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!imageLightboxModal) return;
    imageLightboxModal.style.display = 'none';
    document.body.style.overflow = '';
  }

  function updateLightboxView() {
    if (!currentLightboxImages || currentLightboxImages.length === 0) return;
    const current = currentLightboxImages[currentLightboxIndex];
    if (lightboxImg) lightboxImg.src = current.url;
    if (lightboxTitle) lightboxTitle.textContent = current.title;
    if (lightboxCounter) lightboxCounter.textContent = `${currentLightboxIndex + 1} / ${currentLightboxImages.length}`;
    if (lightboxDownloadBtn) {
      lightboxDownloadBtn.href = current.url;
      lightboxDownloadBtn.setAttribute('download', current.filename || `${current.title}.jpg`);
    }

    if (lightboxPrevBtn) {
      lightboxPrevBtn.style.display = currentLightboxImages.length > 1 ? 'flex' : 'none';
    }
    if (lightboxNextBtn) {
      lightboxNextBtn.style.display = currentLightboxImages.length > 1 ? 'flex' : 'none';
    }
  }

  function lightboxPrev() {
    if (currentLightboxImages.length <= 1) return;
    currentLightboxIndex = (currentLightboxIndex - 1 + currentLightboxImages.length) % currentLightboxImages.length;
    updateLightboxView();
  }

  function lightboxNext() {
    if (currentLightboxImages.length <= 1) return;
    currentLightboxIndex = (currentLightboxIndex + 1) % currentLightboxImages.length;
    updateLightboxView();
  }

  if (closeLightboxBtn) closeLightboxBtn.addEventListener('click', closeLightbox);
  if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
  if (lightboxPrevBtn) lightboxPrevBtn.addEventListener('click', lightboxPrev);
  if (lightboxNextBtn) lightboxNextBtn.addEventListener('click', lightboxNext);

  document.addEventListener('keydown', (e) => {
    if (imageLightboxModal && imageLightboxModal.style.display === 'flex') {
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') lightboxPrev();
      else if (e.key === 'ArrowRight') lightboxNext();
    }
  });

  // --- Official Artist Logos & Images (OSINT & Verified Band Archives) ---
  const ARTIST_OFFICIAL_IMAGES = {
    'Artcell': 'assets/artists/artcell_logo.png',
    'Black': 'assets/artists/black.jpg',
    'Aurthohin': 'assets/artists/aurthohin.png',
    'Bassbaba Sumon': 'assets/artists/bassbaba_sumon.png',
    'Anila': 'assets/artists/anila.jpg',
    'Arbovirus': 'assets/artists/arbovirus.png',
    'Indalo': 'assets/artists/indalo.png',
    'Icons': 'assets/artists/icons.jpg',
    'Minerva': 'assets/artists/minerva.png',
    'Stoic Bliss': 'assets/artists/stoic_bliss_logo.png',
    'The Watson Brothers': 'assets/artists/the_watson_brothers.jpg',
    'Vibe': 'assets/artists/vibe.jpg',
    'Warfaze': 'assets/artists/warfaze.jpg',
    'Shironamhin': 'assets/artists/shironamhin.jpg',
    'Cryptic Fate': 'assets/artists/cryptic_fate.jpg',
    'Nemesis': 'assets/artists/nemesis.jpg',
    'Avoid Rafa': 'assets/artists/avoid_rafa.jpg',
    'Karnival': 'assets/artists/karnival.jpg',
    'Powersurge': 'assets/artists/powersurge.jpg',
    'Mechanix': 'assets/artists/mechanix.jpg',
    'Habib Wahid': 'assets/artists/habib_wahid.jpg',
    'Mila': 'assets/artists/mila.jpg',
    'Fuad': 'assets/artists/fuad.jpg',
    'Elita': 'assets/artists/elita.jpg',
    'Jon Kabir': 'assets/artists/jon_kabir.jpg',
    'Disciples': 'assets/artists/disciples_logo.jpg',
    'Bohemian': 'assets/artists/bohemian.jpg',
    'Breach': 'assets/artists/breach.png',
    'Durey': 'assets/artists/duray.jpg',
    'Kral': 'assets/artists/kral.png',
    'Metal Maze': 'assets/artists/metal_maze.jpg',
    'Mohakaal': 'assets/artists/mohakal.png',
    'Poizon Green': 'assets/artists/poizon_green.png',
    'Reborn': 'assets/artists/reborn.jpg',
    'Stentorian': 'assets/artists/stentorian.jpg',
    'Striking': 'assets/artists/striking.jpg',
    'Yaatri': 'assets/artists/yaatri.jpg'
  };

  function normalizeArtistSlug(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/[\s_\-\W]+/g, '');
  }

  function getArtistLogo(artistName) {
    if (!artistName) return null;
    if (ARTIST_OFFICIAL_IMAGES[artistName]) {
      return ARTIST_OFFICIAL_IMAGES[artistName];
    }
    const slug = normalizeArtistSlug(artistName);
    for (const [key, val] of Object.entries(ARTIST_OFFICIAL_IMAGES)) {
      if (normalizeArtistSlug(key) === slug) {
        return val;
      }
    }
    return null;
  }

  // --- Dynamic Color Avatars (Simple Colors: Green or Violet) for Artists ---
  function getArtistInitials(name) {
    if (!name) return 'BD';
    const clean = name.replace(/[^\w\s]/gi, '').trim();
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    } else if (words.length === 1 && words[0].length >= 2) {
      return words[0].slice(0, 2).toUpperCase();
    } else if (words.length === 1) {
      return words[0][0].toUpperCase();
    }
    return 'BD';
  }

  function getArtistFallbackSvg(name) {
    let hash = 0;
    const str = name || '';
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const isViolet = Math.abs(hash) % 2 === 1;
    const initials = getArtistInitials(name);
    
    // Simple vibrant colors: Emerald Green or Royal Violet
    const color1 = isViolet ? '#6d28d9' : '#047857';
    const color2 = isViolet ? '#8b5cf6' : '#10b981';
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">` +
      `<defs>` +
        `<linearGradient id="g_${Math.abs(hash)}" x1="0%" y1="0%" x2="100%" y2="100%">` +
          `<stop offset="0%" stop-color="${color1}"/>` +
          `<stop offset="100%" stop-color="${color2}"/>` +
        `</linearGradient>` +
      `</defs>` +
      `<circle cx="80" cy="80" r="80" fill="url(#g_${Math.abs(hash)})"/>` +
      `<circle cx="80" cy="80" r="70" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>` +
      `<text x="80" y="88" font-family="'Plus Jakarta Sans', system-ui, -apple-system, sans-serif" font-size="52" font-weight="800" fill="#ffffff" text-anchor="middle" dominant-baseline="middle" letter-spacing="1">${initials}</text>` +
    `</svg>`;
    
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }
  window.getArtistFallbackSvg = getArtistFallbackSvg;

  // --- Render Artists Grid ---
  function renderArtistsGrid() {
    const rawQuery = globalSearchInput.value.trim();
    const query = normalizeQuery(rawQuery);
    const tokens = query.split(' ').filter(Boolean);

    // Group catalog by artist
    const artistsMap = new Map();
    catalog.forEach(t => {
      const trackArtists = (t.artists && t.artists.length > 0) ? t.artists : [t.artist];
      trackArtists.forEach(art => {
        if (!artistsMap.has(art)) {
          const cover = getArtistLogo(art) || getArtistFallbackSvg(art);
          artistsMap.set(art, {
            artist: art,
            coverUrl: cover,
            tracks: [],
            albumsSet: new Set()
          });
        }
        const a = artistsMap.get(art);
        a.tracks.push(t);
        a.albumsSet.add(t.album);
      });
    });

    let artistList = Array.from(artistsMap.values());

    // Filter by activeArtistFilter if active
    if (activeArtistFilter !== 'all') {
      artistList = artistList.filter(a => a.artist === activeArtistFilter);
    }

    // Filter by search query tokens if present
    if (tokens.length > 0) {
      artistList = artistList.filter(artistObj => {
        const artistNorm = normalizeQuery(artistObj.artist);
        // Direct artist name match
        if (tokens.every(tok => artistNorm.includes(tok))) return true;
        // Or matching any track title or album title by this artist
        const titlesBlob = normalizeQuery(artistObj.tracks.map(t => `${t.title} ${t.album}`).join(' '));
        return tokens.every(tok => titlesBlob.includes(tok));
      });
    }

    // Sort artists
    if (sortBy === 'title-asc' || sortBy === 'artist-asc') {
      artistList.sort((a, b) => a.artist.localeCompare(b.artist));
    } else {
      artistList.sort((a, b) => b.tracks.length - a.tracks.length);
    }

    if (artistList.length === 0) {
      return [];
    }

    resultsCount.textContent = `Showing ${artistList.length} artist${artistList.length === 1 ? '' : 's'}`;

    let gridHtml = '';
    artistList.forEach(artistObj => {
      gridHtml += `
        <div class="artist-card" data-artist="${escapeHtml(artistObj.artist)}">
          <button class="artist-share-btn" data-artist="${escapeHtml(artistObj.artist)}" title="Share artist preview link with photo">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
          </button>
          <img class="artist-avatar" src="${escapeHtml(artistObj.coverUrl)}" alt="${escapeHtml(artistObj.artist)}" loading="lazy" onerror="this.onerror=null; this.src=getArtistFallbackSvg('${escapeHtml(artistObj.artist)}')">
          <div class="artist-card-name">${escapeHtml(artistObj.artist)}</div>
          <div class="artist-card-count">${artistObj.tracks.length} tracks • ${artistObj.albumsSet.size} albums</div>
        </div>
      `;
    });

    artistsGrid.innerHTML = gridHtml;

    artistsGrid.querySelectorAll('.artist-share-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const artist = btn.dataset.artist;
        copyArtistShareLink(artist);
      });
    });

    artistsGrid.querySelectorAll('.artist-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.artist-share-btn')) return;
        const artist = card.dataset.artist;
        pushNavState({ view: 'tracks', artist: artist, album: 'all', search: '' });
        activeView = 'tracks';
        updateViewTabs();
        setArtistFilter(artist, false);
      });
    });

    return artistList;
  }

  // --- Audio Player Logic ---
  function playTrackById(id, isDirectLink = false) {
    const track = catalog.find(t => t.id === id);
    if (!track) return;

    currentTrack = track;
    currentTrackIndex = currentFilteredTracks.findIndex(t => t.id === id);

    // Update Player UI with Full Tooltips to prevent text cutoff
    playerTitle.textContent = track.title;
    playerTitle.title = track.title;

    // Render clickable artist link(s) (Spotify-style)
    const trackArtists = (track.artists && track.artists.length > 0) ? track.artists : [track.artist];
    if (trackArtists.length > 1) {
      playerArtist.innerHTML = trackArtists.map(a => `<span class="player-link-item player-artist-link" data-artist="${escapeHtml(a)}" title="View ${escapeHtml(a)} discography">${escapeHtml(a)}</span>`).join(', ');
      playerArtist.title = `Artists: ${trackArtists.join(', ')}`;
    } else {
      playerArtist.innerHTML = `<span class="player-link-item player-artist-link" data-artist="${escapeHtml(track.artist)}" title="View ${escapeHtml(track.artist)} discography">${escapeHtml(track.artist)}</span>`;
      playerArtist.title = `View all songs by ${track.artist}`;
    }

    // Render clickable album link (Spotify-style)
    playerAlbum.innerHTML = `<span class="player-link-item player-album-link" data-album="${escapeHtml(track.album)}" title="View album: ${escapeHtml(track.album)}">${escapeHtml(track.album)}</span>`;
    playerAlbum.title = `View album: ${track.album}`;

    playerCoverImg.src = track.coverUrl || 'assets/default_album_cover.svg';
    playerCoverImg.title = `Click to view ${track.album} artwork gallery`;
    playerCoverImg.onerror = () => { playerCoverImg.src = 'assets/default_album_cover.svg'; };
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
    if (audio.src !== cleanUrl && !audio.src.endsWith(cleanUrl)) {
      audio.src = cleanUrl;
      audio.load();
    } else if (audio.readyState === 0) {
      audio.load();
    }

    audioSpinner.style.display = 'block';
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'none';

    if (visualizerEnabled) {
      initAudioVisualizer();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        isPlaying = true;
        updatePlayPauseState();
        updateMediaSession();
        if (visualizerEnabled) {
          initAudioVisualizer();
        }
        renderTracksTable(); // Update active row state
        hideAutoplayPrompt();
        if (isDirectLink) {
          showToast(`▶ Now Playing: ${track.title} — ${track.artist}`);
        }
      }).catch(err => {
        console.warn('Playback error (browser autoplay policy restriction):', err);
        audioSpinner.style.display = 'none';
        playIcon.style.display = 'block';

        if (isDirectLink) {
          armOneTouchAutoplay(track);
        }
      });
    }

    // Update URL query parameter for clean sharing
    try {
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('track', track.id);
      currentUrl.hash = '';
      window.history.replaceState({ trackId: track.id }, '', currentUrl.toString());
    } catch (_) {
      window.history.replaceState(null, '', `?track=${track.id}`);
    }

    updatePageMetaForTrack(track);
  }

  // --- Direct Song Link Autoplay Handlers (One-Touch / First-Gesture Autoplay) ---
  function showAutoplayPrompt(track) {
    if (!directAutoplayPrompt) return;
    if (autoplayPromptTrack) {
      autoplayPromptTrack.textContent = `${track.title} — ${track.artist}`;
    }
    directAutoplayPrompt.style.display = 'flex';
  }

  function hideAutoplayPrompt() {
    if (directAutoplayPrompt) {
      directAutoplayPrompt.style.display = 'none';
    }
    if (activeAutoplayGestureHandler) {
      ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
        window.removeEventListener(evt, activeAutoplayGestureHandler, { capture: true });
      });
      activeAutoplayGestureHandler = null;
    }
  }

  function armOneTouchAutoplay(track) {
    showAutoplayPrompt(track);
    showToast(`🎵 Loaded: ${track.title} — Tap anywhere to play`);

    if (activeAutoplayGestureHandler) {
      ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(evt => {
        window.removeEventListener(evt, activeAutoplayGestureHandler, { capture: true });
      });
    }

    const gestureEvents = ['pointerdown', 'touchstart', 'click', 'keydown'];

    activeAutoplayGestureHandler = function onFirstUserGesture(e) {
      // If user specifically clicked the dismiss button, let dismiss button handle it
      if (e.target && e.target.closest && e.target.closest('#directAutoplayDismiss')) {
        return;
      }

      // Check if user clicked another song row
      const clickedRow = e.target && e.target.closest ? e.target.closest('tr[data-id]') : null;
      if (clickedRow && clickedRow.dataset.id !== track.id) {
        hideAutoplayPrompt();
        return;
      }

      // Play audio within genuine user gesture context
      if (audio.paused && currentTrack && currentTrack.id === track.id) {
        audio.play().then(() => {
          isPlaying = true;
          updatePlayPauseState();
          updateMediaSession();
          if (visualizerEnabled) {
            initAudioVisualizer();
            if (audioCtx && audioCtx.state === 'suspended') {
              audioCtx.resume().catch(() => {});
            }
          }
          renderTracksTable();
          showToast(`▶ Now Playing: ${track.title} — ${track.artist}`);
        }).catch(err => {
          console.warn('Playback on user gesture failed:', err);
        });
      }

      hideAutoplayPrompt();
    };

    // Attach capture listener so ANY user gesture on screen starts playback immediately
    gestureEvents.forEach(evt => {
      window.addEventListener(evt, activeAutoplayGestureHandler, { capture: true, once: true });
    });
  }

  if (directAutoplayPrompt) {
    directAutoplayPrompt.addEventListener('click', (e) => {
      if (e.target.closest('#directAutoplayDismiss')) {
        e.stopPropagation();
        hideAutoplayPrompt();
        showToast('Autoplay dismissed');
        return;
      }
      if (currentTrack && audio.paused) {
        audio.play().then(() => {
          isPlaying = true;
          updatePlayPauseState();
          updateMediaSession();
          if (visualizerEnabled) {
            initAudioVisualizer();
            if (audioCtx && audioCtx.state === 'suspended') {
              audioCtx.resume().catch(() => {});
            }
          }
          renderTracksTable();
          showToast(`▶ Now Playing: ${currentTrack.title} — ${currentTrack.artist}`);
        }).catch(() => {});
      }
      hideAutoplayPrompt();
    });
  }

  if (directAutoplayDismiss) {
    directAutoplayDismiss.addEventListener('click', (e) => {
      e.stopPropagation();
      hideAutoplayPrompt();
      showToast('Autoplay dismissed');
    });
  }

  function togglePlayPause() {
    hideAutoplayPrompt();
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
          <img class="queue-thumb" src="${escapeHtml(track.coverUrl)}" alt="Cover" onerror="this.src='assets/default_album_cover.svg'">
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
    if (isSeeking) return; // Prevent overwriting slider position during active user drag
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

  // --- Seek Slider Interaction (Smooth Drag & Release) ---
  const onSeekStart = () => {
    isSeeking = true;
  };

  const onSeekCommit = () => {
    if (isSeeking) {
      if (audio.duration && !isNaN(audio.duration)) {
        const targetTime = (parseFloat(seekSlider.value) / 100) * audio.duration;
        audio.currentTime = targetTime;
      }
      isSeeking = false;
    }
  };

  seekSlider.addEventListener('mousedown', onSeekStart);
  seekSlider.addEventListener('touchstart', onSeekStart, { passive: true });

  seekSlider.addEventListener('input', () => {
    isSeeking = true;
    if (audio.duration && !isNaN(audio.duration)) {
      const seekTime = (parseFloat(seekSlider.value) / 100) * audio.duration;
      currentTimeLabel.textContent = formatTime(seekTime);
    }
    seekSlider.style.backgroundSize = `${seekSlider.value}% 100%`;
  });

  seekSlider.addEventListener('change', onSeekCommit);
  window.addEventListener('mouseup', onSeekCommit);
  window.addEventListener('touchend', onSeekCommit);

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

  // --- Spotify-style Artist, Album & Cover Click Navigation in Player Bar ---
  if (playerArtist) {
    playerArtist.addEventListener('click', (e) => {
      const link = e.target.closest('.player-artist-link');
      const artist = link ? link.dataset.artist : (currentTrack ? currentTrack.artist : null);
      if (!artist || artist === '—') return;
      dismissLanding();
      activeView = 'tracks';
      activeAlbumFilter = 'all';
      updateViewTabs();
      setArtistFilter(artist);
      const targetEl = document.getElementById('mainContent') || document.getElementById('tracksTable');
      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast(`👑 Viewing artist: ${artist}`);
    });
  }

  if (playerAlbum) {
    playerAlbum.addEventListener('click', () => {
      if (!currentTrack || !currentTrack.album || currentTrack.album === '—') return;
      dismissLanding();
      activeView = 'tracks';
      activeArtistFilter = 'all';
      updateViewTabs();
      setAlbumFilter(currentTrack.album);
      const targetEl = document.getElementById('albumGallerySection') || document.getElementById('mainContent') || document.getElementById('tracksTable');
      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast(`💿 Viewing album: ${currentTrack.album}`);
    });
  }

  const playerCoverWrap = document.querySelector('.player-cover-wrap');
  if (playerCoverWrap) {
    playerCoverWrap.addEventListener('click', () => {
      if (!currentTrack || !currentTrack.album) return;
      dismissLanding();
      activeView = 'tracks';
      activeArtistFilter = 'all';
      updateViewTabs();
      setAlbumFilter(currentTrack.album);
      const targetEl = document.getElementById('albumGallerySection') || document.getElementById('mainContent') || document.getElementById('tracksTable');
      if (targetEl) targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // --- Search Input Events ---
  let searchDebounceTimer = null;
  globalSearchInput.addEventListener('input', () => {
    clearSearchBtn.style.display = globalSearchInput.value ? 'block' : 'none';
    if (globalSearchInput.value.trim()) {
      isFullTracksListExpanded = true;
    } else if (activeArtistFilter === 'all' && activeAlbumFilter === 'all') {
      isFullTracksListExpanded = false;
    }
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(applyFilters, 150);
  });

  clearSearchBtn.addEventListener('click', () => {
    globalSearchInput.value = '';
    clearSearchBtn.style.display = 'none';
    isFullTracksListExpanded = false;
    applyFilters();
    globalSearchInput.focus();
  });

  resetFilterBtn.addEventListener('click', () => {
    activeArtistFilter = 'all';
    activeAlbumFilter = 'all';
    isFullTracksListExpanded = false;
    pushNavState({ view: activeView, artist: 'all', album: 'all' });
    artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.artist === 'all');
    });
    activeFilterBanner.style.display = 'none';
    if (shareFilterBtn) shareFilterBtn.style.display = 'none';
    applyFilters();
  });

  clearAllFiltersBtn.addEventListener('click', () => {
    globalSearchInput.value = '';
    clearSearchBtn.style.display = 'none';
    activeArtistFilter = 'all';
    activeAlbumFilter = 'all';
    isFullTracksListExpanded = false;
    pushNavState({ view: activeView, artist: 'all', album: 'all', search: '' });
    artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.artist === 'all');
    });
    activeFilterBanner.style.display = 'none';
    if (shareFilterBtn) shareFilterBtn.style.display = 'none';
    applyFilters();
  });

  if (shareFilterBtn) {
    shareFilterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (activeAlbumFilter !== 'all') {
        copyAlbumShareLink(activeAlbumFilter);
      } else if (activeArtistFilter !== 'all') {
        copyArtistShareLink(activeArtistFilter);
      }
    });
  }

  // --- See More Tracks Handler (Toggle Curated vs Full) ---
  if (seeMoreBtn) {
    seeMoreBtn.addEventListener('click', () => {
      isFullTracksListExpanded = !isFullTracksListExpanded;
      applyFilters();
      if (isFullTracksListExpanded) {
        showToast(`Loaded all ${catalog.length} tracks`);
      } else {
        showToast('Returned to 18 Featured Classics');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });
  }

  sortSelect.addEventListener('change', () => {
    sortBy = sortSelect.value;
    if (sortBy !== 'default') {
      isFullTracksListExpanded = true;
    }
    applyFilters();
  });

  // --- View Tabs Switcher ---
  viewTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      activeView = tab.dataset.view;
      // Switching view tabs cleanly resets sticky 1-album or 1-artist locks
      activeAlbumFilter = 'all';
      activeArtistFilter = 'all';
      artistFilterBar.querySelectorAll('.filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.artist === 'all');
      });
      activeFilterBanner.style.display = 'none';
      if (shareFilterBtn) shareFilterBtn.style.display = 'none';

      pushNavState({ view: activeView, artist: 'all', album: 'all' });
      updateViewTabs();
      applyFilters();
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

  // --- Credits Modal Handlers ---
  function openCreditsModal() {
    if (creditsModal) {
      creditsModal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }

  function closeCreditsModal() {
    if (creditsModal) {
      creditsModal.style.display = 'none';
      document.body.style.overflow = '';
    }
  }

  if (creditsBtn) {
    creditsBtn.addEventListener('click', openCreditsModal);
  }

  if (closeCreditsModalBtn) {
    closeCreditsModalBtn.addEventListener('click', closeCreditsModal);
  }

  if (okCreditsBtn) {
    okCreditsBtn.addEventListener('click', closeCreditsModal);
  }

  if (creditsModal) {
    creditsModal.addEventListener('click', (e) => {
      if (e.target === creditsModal) {
        closeCreditsModal();
      }
    });
  }

  // --- Landing Page & Manifesto Overlay Handlers ---
  function dismissLanding() {
    if (landingOverlay && !landingOverlay.classList.contains('dismissed')) {
      landingOverlay.classList.add('dismissed');
      sessionStorage.setItem('bd_landing_seen', 'true');
    }
  }

  function showLanding() {
    if (landingOverlay) {
      landingOverlay.classList.remove('dismissed');
      landingOverlay.scrollTop = 0;
    }
  }

  // Dismiss ONLY on explicit click of "Enter Lossless Archive" button
  if (enterArchiveBtn) {
    enterArchiveBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dismissLanding();
    });
  }

  // Also support top header enter/close button
  if (closeLandingBtn) {
    closeLandingBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dismissLanding();
    });
  }

  if (storyBtn) {
    storyBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showLanding();
    });
  }

  // --- Brand Home Button ---
  brandHomeBtn.addEventListener('click', () => {
    globalSearchInput.value = '';
    clearSearchBtn.style.display = 'none';
    activeView = 'tracks';
    activeArtistFilter = 'all';
    activeAlbumFilter = 'all';
    isFullTracksListExpanded = false;
    pushNavState({ view: 'tracks', artist: 'all', album: 'all', search: '' });
    updateViewTabs();
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

  // --- Precision Equalizer Utilities & State Management ---
  function dbToGain(db) {
    return Math.pow(10, db / 20);
  }

  function formatDb(val) {
    const num = parseFloat(val);
    if (isNaN(num)) return '0.0';
    return (num > 0 ? '+' : '') + num.toFixed(1);
  }

  function loadSavedEqSettings() {
    try {
      const saved = localStorage.getItem('bd_band_music_eq');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.gains) && parsed.gains.length === 10) {
          currentEqGains = parsed.gains.map(v => Math.max(-12, Math.min(12, parseFloat(v) || 0)));
        }
        if (typeof parsed.preamp === 'number') {
          currentPreamp = Math.max(-6, Math.min(6, parsed.preamp));
        }
        if (typeof parsed.enabled === 'boolean') {
          eqEnabled = parsed.enabled;
        }
        if (parsed.preset && (EQ_PRESETS[parsed.preset] || parsed.preset === 'custom')) {
          currentPresetKey = parsed.preset;
        }
      }
    } catch (_) {}
  }

  function saveEqSettings() {
    try {
      localStorage.setItem('bd_band_music_eq', JSON.stringify({
        enabled: eqEnabled,
        preset: currentPresetKey,
        preamp: currentPreamp,
        gains: currentEqGains
      }));
    } catch (_) {}
  }

  function renderEqBands() {
    if (!eqBandsRack) return;

    let bandsHtml = '';
    EQ_FREQUENCIES.forEach((freq, idx) => {
      const label = EQ_LABELS[idx];
      const gain = currentEqGains[idx] || 0;
      const formatted = formatDb(gain);
      const activeClass = Math.abs(gain) > 0.05 ? 'active-gain' : '';

      bandsHtml += `
        <div class="eq-col" data-index="${idx}">
          <div class="eq-col-meta">
            <span class="eq-gain-val ${activeClass}" id="eqGainVal_${idx}">${formatted}</span>
          </div>
          <div class="eq-slider-slot">
            <input type="range" class="eq-slider-input eq-band-slider" data-index="${idx}" min="-12" max="12" step="0.5" value="${gain}" orient="vertical" aria-label="Frequency band ${label}">
          </div>
          <span class="eq-freq-badge">${label}</span>
        </div>
      `;
    });

    eqBandsRack.innerHTML = bandsHtml;

    // Attach band slider listeners
    eqBandsRack.querySelectorAll('.eq-band-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        const val = parseFloat(e.target.value);
        setBandGain(idx, val);
      });
    });

    // Update Pre-amp
    if (eqPreamp && preampVal) {
      eqPreamp.value = currentPreamp;
      preampVal.textContent = formatDb(currentPreamp);
      preampVal.className = 'eq-gain-val' + (Math.abs(currentPreamp) > 0.05 ? ' active-gain' : '');
    }

    // Update toggle switch
    if (eqToggle) {
      eqToggle.checked = eqEnabled;
      if (eqStatusLabel) {
        eqStatusLabel.textContent = eqEnabled ? 'Active' : 'Bypassed';
      }
    }

    // Update preset selector
    if (eqPresetSelect) {
      eqPresetSelect.value = currentPresetKey;
    }

    updateEqActiveState();
  }

  function setBandGain(index, val) {
    currentEqGains[index] = val;
    const valEl = document.getElementById(`eqGainVal_${index}`);
    if (valEl) {
      valEl.textContent = formatDb(val);
      valEl.className = 'eq-gain-val' + (Math.abs(val) > 0.05 ? ' active-gain' : '');
    }

    if (eqFilters[index] && eqEnabled) {
      eqFilters[index].gain.value = val;
    }

    checkCustomPreset();
    updateEqActiveState();
    saveEqSettings();
  }

  function setPreampGain(val) {
    currentPreamp = val;
    if (preampVal) {
      preampVal.textContent = formatDb(val);
      preampVal.className = 'eq-gain-val' + (Math.abs(val) > 0.05 ? ' active-gain' : '');
    }
    if (eqPreampNode && eqEnabled) {
      eqPreampNode.gain.value = dbToGain(val);
    }
    checkCustomPreset();
    updateEqActiveState();
    saveEqSettings();
  }

  function checkCustomPreset() {
    let matchesPreset = null;
    for (const [key, preset] of Object.entries(EQ_PRESETS)) {
      if (Math.abs(preset.preamp - currentPreamp) < 0.1) {
        const allMatch = preset.gains.every((g, idx) => Math.abs(g - currentEqGains[idx]) < 0.1);
        if (allMatch) {
          matchesPreset = key;
          break;
        }
      }
    }
    currentPresetKey = matchesPreset || 'custom';
    if (eqPresetSelect) {
      eqPresetSelect.value = currentPresetKey;
    }
  }

  function applyEqPreset(presetKey) {
    const preset = EQ_PRESETS[presetKey];
    if (!preset) return;

    currentPresetKey = presetKey;
    currentPreamp = preset.preamp;
    currentEqGains = [...preset.gains];

    if (eqFilters.length === 10) {
      eqFilters.forEach((f, idx) => {
        f.gain.value = eqEnabled ? currentEqGains[idx] : 0;
      });
    }
    if (eqPreampNode) {
      eqPreampNode.gain.value = eqEnabled ? dbToGain(currentPreamp) : 1.0;
    }

    renderEqBands();
    saveEqSettings();
    showToast(`EQ Profile: ${preset.name}`);
  }

  function setEqEnabled(enabled) {
    eqEnabled = enabled;
    if (eqFilters.length === 10) {
      eqFilters.forEach((f, idx) => {
        f.gain.value = enabled ? currentEqGains[idx] : 0;
      });
    }
    if (eqPreampNode) {
      eqPreampNode.gain.value = enabled ? dbToGain(currentPreamp) : 1.0;
    }

    if (eqStatusLabel) {
      eqStatusLabel.textContent = enabled ? 'Active' : 'Bypassed';
    }

    updateEqActiveState();
    saveEqSettings();
    showToast(enabled ? 'Equalizer: Active' : 'Equalizer: Bypassed');
  }

  function resetEqToFlat() {
    applyEqPreset('flat');
  }

  function updateEqActiveState() {
    const isNonFlat = currentEqGains.some(g => Math.abs(g) > 0.05) || Math.abs(currentPreamp) > 0.05;
    const isWorking = eqEnabled && isNonFlat;

    if (eqActiveDot) {
      eqActiveDot.style.display = isWorking ? 'block' : 'none';
    }
    if (eqBtn) {
      eqBtn.classList.toggle('active', isWorking);
    }
  }

  function openEqModal() {
    if (!audioCtx) {
      initAudioVisualizer();
    }
    if (eqModal) {
      eqModal.style.display = 'flex';
      renderEqBands();
    }
  }

  function closeEqModal() {
    if (eqModal) {
      eqModal.style.display = 'none';
    }
  }

  function toggleEqModal() {
    if (eqModal && eqModal.style.display === 'flex') {
      closeEqModal();
    } else {
      openEqModal();
    }
  }

  // Hook Equalizer Panel Events
  if (eqBtn) {
    eqBtn.addEventListener('click', toggleEqModal);
  }
  if (closeEqBtn) {
    closeEqBtn.addEventListener('click', closeEqModal);
  }
  if (eqModal) {
    eqModal.addEventListener('click', (e) => {
      if (e.target === eqModal) closeEqModal();
    });
  }
  if (eqToggle) {
    eqToggle.addEventListener('change', (e) => setEqEnabled(e.target.checked));
  }
  if (eqPresetSelect) {
    eqPresetSelect.addEventListener('change', (e) => applyEqPreset(e.target.value));
  }
  if (eqResetBtn) {
    eqResetBtn.addEventListener('click', resetEqToFlat);
  }
  if (eqPreamp) {
    eqPreamp.addEventListener('input', (e) => setPreampGain(parseFloat(e.target.value)));
  }

  // --- Web Audio Visualizer & DSP Equalizer Pipeline ---
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
      // Configure latencyHint: 'playback' for smooth, glitch-free background audio
      audioCtx = new AudioContextClass({ latencyHint: 'playback' });
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;

      sourceNode = audioCtx.createMediaElementSource(audio);

      // Pre-Amp Gain Node (headroom management)
      eqPreampNode = audioCtx.createGain();
      eqPreampNode.gain.value = eqEnabled ? dbToGain(currentPreamp) : 1.0;

      // 10-Band BiquadFilter Chain
      eqFilters = EQ_FREQUENCIES.map((freq, idx) => {
        const filter = audioCtx.createBiquadFilter();
        if (idx === 0) {
          filter.type = 'lowshelf';
        } else if (idx === EQ_FREQUENCIES.length - 1) {
          filter.type = 'highshelf';
        } else {
          filter.type = 'peaking';
          filter.Q.value = 1.4;
        }
        filter.frequency.value = freq;
        filter.gain.value = eqEnabled ? currentEqGains[idx] : 0;
        return filter;
      });

      // Connect: source -> preamp -> filter[0..9] -> analyser -> destination
      let lastNode = sourceNode;
      lastNode.connect(eqPreampNode);
      lastNode = eqPreampNode;

      eqFilters.forEach(filter => {
        lastNode.connect(filter);
        lastNode = filter;
      });

      lastNode.connect(analyser);
      analyser.connect(audioCtx.destination);

      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }

      startVisualizerLoop();
    } catch (err) {
      console.warn('Web Audio API visualizer/EQ initialization notice:', err);
      // Start loop for dynamic harmonic visualizer even if Web Audio element source failed
      startVisualizerLoop();
    }
  }

  // --- Audio Visualizer Palettes (5 Vibrant Gradients) ---
  const VISUALIZER_PALETTES = [
    // 1: Neon Violet / Fuchsia / Pink (Signature Default)
    [
      { offset: 0, r: 139, g: 92, b: 246, a: 0.25 },
      { offset: 0.7, r: 192, g: 132, b: 252, a: 0.75 },
      { offset: 1, r: 236, g: 72, b: 153, a: 0.95 }
    ],
    // 2: Cyber Cyan / Electric Blue / Royal Indigo
    [
      { offset: 0, r: 6, g: 182, b: 212, a: 0.25 },
      { offset: 0.7, r: 59, g: 130, b: 246, a: 0.75 },
      { offset: 1, r: 99, g: 102, b: 241, a: 0.95 }
    ],
    // 3: Emerald Aurora / Teal / Neon Mint
    [
      { offset: 0, r: 5, g: 150, b: 105, a: 0.25 },
      { offset: 0.7, r: 16, g: 185, b: 129, a: 0.75 },
      { offset: 1, r: 74, g: 222, b: 128, a: 0.95 }
    ],
    // 4: Sunset Amber / Flame Orange / Crimson Coral
    [
      { offset: 0, r: 245, g: 158, b: 11, a: 0.25 },
      { offset: 0.7, r: 249, g: 115, b: 22, a: 0.75 },
      { offset: 1, r: 239, g: 68, b: 68, a: 0.95 }
    ],
    // 5: Cosmic Purple / Radiant Magenta / Hot Rose
    [
      { offset: 0, r: 147, g: 51, b: 234, a: 0.25 },
      { offset: 0.7, r: 217, g: 70, b: 239, a: 0.75 },
      { offset: 1, r: 251, g: 113, b: 133, a: 0.95 }
    ]
  ];

  let currentPaletteIdx = 0;
  let targetPaletteIdx = 0;
  let lastColorSwitchTime = performance.now();
  const COLOR_SWITCH_INTERVAL = 4000; // Change color gradient every 4 seconds
  const COLOR_TRANSITION_DURATION = 1200; // 1.2s smooth blend transition

  function startVisualizerLoop() {
    if (visualizerAnimId) return;

    const ctx = visualizerCanvas.getContext('2d');
    const numBars = 32;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : new Uint8Array(numBars);

    function draw() {
      visualizerAnimId = requestAnimationFrame(draw);
      // Skip canvas drawing if visualizer is disabled or tab is in background
      if (!visualizerEnabled || document.hidden) return;

      if (visualizerCanvas.width !== window.innerWidth) {
        visualizerCanvas.width = window.innerWidth;
        visualizerCanvas.height = 90;
      }

      const nowMs = performance.now();

      // Check for gradient color transition every 4 seconds
      if (nowMs - lastColorSwitchTime >= COLOR_SWITCH_INTERVAL) {
        lastColorSwitchTime = nowMs;
        currentPaletteIdx = targetPaletteIdx;
        let nextIdx;
        do {
          nextIdx = Math.floor(Math.random() * VISUALIZER_PALETTES.length);
        } while (nextIdx === targetPaletteIdx && VISUALIZER_PALETTES.length > 1);
        targetPaletteIdx = nextIdx;
      }

      // Smooth interpolation of RGB color stops between palettes
      const elapsed = nowMs - lastColorSwitchTime;
      const progressRaw = Math.min(1, elapsed / COLOR_TRANSITION_DURATION);
      const progress = progressRaw < 0.5 
        ? 2 * progressRaw * progressRaw 
        : 1 - Math.pow(-2 * progressRaw + 2, 2) / 2;

      const fromPal = VISUALIZER_PALETTES[currentPaletteIdx];
      const toPal = VISUALIZER_PALETTES[targetPaletteIdx];
      const activeStops = [0, 0.7, 1].map((offset, idx) => {
        const c1 = fromPal[idx];
        const c2 = toPal[idx];
        const r = Math.round(c1.r + (c2.r - c1.r) * progress);
        const g = Math.round(c1.g + (c2.g - c1.g) * progress);
        const b = Math.round(c1.b + (c2.b - c1.b) * progress);
        const a = (c1.a + (c2.a - c1.a) * progress).toFixed(2);
        return { offset, color: `rgba(${r}, ${g}, ${b}, ${a})` };
      });

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
      const now = nowMs * 0.003;

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
        activeStops.forEach(s => grad.addColorStop(s.offset, s.color));

        ctx.fillStyle = grad;
        ctx.fillRect(x, visualizerCanvas.height - barHeight, Math.max(1, barWidth - 3), barHeight);
        x += barWidth;
      }
    }
    draw();
  }

  // --- Optimize Background Play & Tab Switching ---
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (visualizerAnimId) {
        cancelAnimationFrame(visualizerAnimId);
        visualizerAnimId = null;
      }
    } else {
      if (visualizerEnabled && isPlaying) {
        startVisualizerLoop();
      }
    }
  });

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
    // If landing overlay is active, ignore audio shortcuts and do NOT dismiss via keyboard
    if (landingOverlay && !landingOverlay.classList.contains('dismissed')) {
      return;
    }

    if (e.key === 'Escape') {
      if (document.activeElement === globalSearchInput) {
        globalSearchInput.blur();
      }
      closeCreditsModal();
      closeEqModal();
      queueDrawer.classList.remove('open');
      return;
    }

    // If typing in search box, ignore playback shortcuts
    if (document.activeElement === globalSearchInput) {
      return;
    }

    if (e.key === '/' || e.key === 'f') {
      e.preventDefault();
      globalSearchInput.focus();
      return;
    }

    if (e.key === 'e' || e.key === 'E') {
      e.preventDefault();
      toggleEqModal();
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

  // --- Helpers: Canonical URLs & Slug Generation for Social Previews ---
  function getBaseSiteUrl() {
    if (window.location.hostname.includes('github.io')) {
      return 'https://bd-band-archive.github.io/BD-Band-Music';
    }
    const path = window.location.pathname.replace(/\/index\.html$/, '').replace(/\/$/, '');
    return `${window.location.origin}${path}`;
  }

  function toSlug(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // --- Dynamic Open Graph & Page Title Injection ---
  function updatePageMetaForTrack(track) {
    if (!track) return;
    document.title = `▶ ${track.title} — ${track.artist} | BD Band Music`;

    const setMeta = (prop, content) => {
      let el = document.querySelector(`meta[property="${prop}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute('property', prop);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    setMeta('og:title', `${track.title} — ${track.artist}`);
    setMeta('og:description', `Album: ${track.album}${track.year ? ` (${track.year})` : ''} • Stream Lossless FLAC`);
    if (track.coverUrl) {
      setMeta('og:image', track.coverUrl);
    }
    setMeta('og:url', `${getBaseSiteUrl()}/track/${track.id}/`);
  }

  // --- Helper: Native Web Share & Clipboard Fallback ---
  function copyShareLink(shareUrl, title, successMsg) {
    if (navigator.share) {
      navigator.share({
        title: title,
        url: shareUrl
      }).catch(err => {
        if (err.name !== 'AbortError') {
          copyToClipboardFallback(shareUrl, successMsg);
        }
      });
    } else {
      copyToClipboardFallback(shareUrl, successMsg);
    }
  }

  function copyToClipboardFallback(shareUrl, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast(successMsg);
      }).catch(() => {
        prompt('Direct Link:', shareUrl);
      });
    } else {
      prompt('Direct Link:', shareUrl);
    }
  }

  // --- Share Triggers (Track, Artist, Album) with Full Image Unfurling ---
  function copyTrackShareLink(trackId) {
    const track = catalog.find(t => t.id === trackId);
    if (!track) return;
    const shareUrl = `${getBaseSiteUrl()}/track/${encodeURIComponent(track.id)}/`;
    const songTitle = `${track.title} (${track.artist})`;
    copyShareLink(shareUrl, songTitle, `🔗 Copied direct link for "${songTitle}"!`);
  }

  function copyArtistShareLink(artistName) {
    if (!artistName || artistName === 'all') return;
    const slug = toSlug(artistName);
    const shareUrl = `${getBaseSiteUrl()}/artist/${slug}/`;
    copyShareLink(shareUrl, `${artistName} — BD Band Music`, `🔗 Copied artist preview link for "${artistName}"!`);
  }

  function copyAlbumShareLink(albumName) {
    if (!albumName || albumName === 'all') return;
    const slug = toSlug(albumName);
    const shareUrl = `${getBaseSiteUrl()}/album/${slug}/`;
    copyShareLink(shareUrl, `${albumName} — BD Band Music`, `🔗 Copied album preview link for "${albumName}"!`);
  }

  // ==========================================================================
  // Spotify-Style Share to Story & Web Card Generator (400x300 & Full Story Size)
  // ==========================================================================
  const storyShareDialog = document.getElementById('storyShareDialog');
  const closeStoryShareBtn = document.getElementById('closeStoryShareBtn');
  const storyCanvas = document.getElementById('storyCanvas');
  const storyCanvasLoading = document.getElementById('storyCanvasLoading');
  const storyPreviewFrame = document.getElementById('storyPreviewFrame');
  const storyPreviewHint = document.getElementById('storyPreviewHint');
  const storyFormatWebBtn = document.getElementById('storyFormatWebBtn');
  const storyFormatStoryBtn = document.getElementById('storyFormatStoryBtn');
  const storyTrackThumb = document.getElementById('storyTrackThumb');
  const storyTrackTitle = document.getElementById('storyTrackTitle');
  const storyTrackArtist = document.getElementById('storyTrackArtist');
  const storyNativeShareBtn = document.getElementById('storyNativeShareBtn');
  const storyDownloadBtn = document.getElementById('storyDownloadBtn');
  const storyDownloadBtnHint = document.getElementById('storyDownloadBtnHint');
  const storyDownloadWebBtn = document.getElementById('storyDownloadWebBtn');
  const storyFbShareBtn = document.getElementById('storyFbShareBtn');
  const storyCopyLinkBtn = document.getElementById('storyCopyLinkBtn');
  const storyLinkUrlDisplay = document.getElementById('storyLinkUrlDisplay');

  let activeStoryTrack = null;
  let activeStoryFormat = 'web'; // 'web' (400x300) or 'story' (9:16)

  function drawRoundRect(ctx, x, y, width, height, radius) {
    if (ctx.roundRect) {
      ctx.beginPath();
      ctx.roundRect(x, y, width, height, radius);
      return;
    }
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Detects the default Story resolution for the current device/platform
  function getDeviceStoryDimensions() {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || 
                     (window.innerWidth <= 768 && window.innerHeight > window.innerWidth);
    if (isMobile && window.screen && window.screen.width && window.screen.height) {
      const screenW = Math.min(window.screen.width, window.screen.height);
      const screenH = Math.max(window.screen.width, window.screen.height);
      const dpr = Math.min(window.devicePixelRatio || 2, 3);
      let targetW = Math.round(screenW * dpr);
      let targetH = Math.round(screenH * dpr);
      if (targetW < 1080) {
        const scale = 1080 / targetW;
        targetW = 1080;
        targetH = Math.round(targetH * scale);
      }
      return { width: targetW, height: targetH, label: `${targetW}×${targetH} Device Native` };
    }
    // Universal 9:16 story standard (Instagram, Facebook, WhatsApp, Snapchat)
    return { width: 1080, height: 1920, label: '1080×1920 HD Story' };
  }

  async function loadCoverImage(coverUrl) {
    if (!coverUrl) return null;
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image failed to load'));
        img.src = coverUrl;
      });
      return img;
    } catch (e) {
      return null;
    }
  }

  // 1. Render 400x300 Web Card (at 800x600 for 2x retina sharpness)
  async function renderWebCard(track, targetCanvas) {
    if (!targetCanvas) return;
    const ctx = targetCanvas.getContext('2d');
    const W = 800;
    const H = 600;
    targetCanvas.width = W;
    targetCanvas.height = H;

    // Background Gradient (Dark Audiophile Violet/Midnight)
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#1a1030');
    bgGrad.addColorStop(0.45, '#0e111a');
    bgGrad.addColorStop(1, '#05070a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Ambient Radial Glow behind Artwork
    const glowGrad = ctx.createRadialGradient(200, 240, 20, 200, 240, 260);
    glowGrad.addColorStop(0, 'rgba(139, 92, 246, 0.42)');
    glowGrad.addColorStop(0.6, 'rgba(217, 70, 239, 0.12)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 0, 480, 500);

    // Header Badge Pill
    const badgeY = 48;
    ctx.save();
    drawRoundRect(ctx, 36, badgeY - 18, 260, 36, 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = '700 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🇧🇩 BD BAND ARCHIVE • FLAC', 166, badgeY);
    ctx.restore();

    // Center-left Album Artwork (Square with soft shadow & rounded corners)
    const artSize = 310;
    const artX = 36;
    const artY = 88;
    const artRadius = 20;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 12;
    drawRoundRect(ctx, artX, artY, artSize, artSize, artRadius);
    ctx.fillStyle = '#121721';
    ctx.fill();
    ctx.restore();

    // Load & Draw Cover
    const coverUrl = track.coverUrl || 'assets/default_album_cover.svg';
    const img = await loadCoverImage(coverUrl);
    ctx.save();
    drawRoundRect(ctx, artX, artY, artSize, artSize, artRadius);
    ctx.clip();
    if (img) {
      ctx.drawImage(img, artX, artY, artSize, artSize);
    } else {
      const fallbackGrad = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
      fallbackGrad.addColorStop(0, '#8b5cf6');
      fallbackGrad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = fallbackGrad;
      ctx.fillRect(artX, artY, artSize, artSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 72px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎸', artX + artSize / 2, artY + artSize / 2);
    }
    ctx.restore();

    // Right Column Track Details
    const textX = 375;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Track Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 32px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    let title = track.title;
    if (ctx.measureText(title).width > 385) {
      while (ctx.measureText(title + '...').width > 385 && title.length > 0) {
        title = title.slice(0, -1);
      }
      title += '...';
    }
    ctx.fillText(title, textX, 135);

    // Artist
    ctx.fillStyle = '#c084fc';
    ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    let artist = track.artist;
    if (ctx.measureText(artist).width > 385) {
      while (ctx.measureText(artist + '...').width > 385 && artist.length > 0) {
        artist = artist.slice(0, -1);
      }
      artist += '...';
    }
    ctx.fillText(artist, textX, 178);

    // Album
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    let album = track.album;
    if (ctx.measureText(album).width > 385) {
      while (ctx.measureText(album + '...').width > 385 && album.length > 0) {
        album = album.slice(0, -1);
      }
      album += '...';
    }
    ctx.fillText(album, textX, 214);

    // FLAC Bit-Perfect Badge Pill
    const pillY = 265;
    drawRoundRect(ctx, textX, pillY - 18, 385, 36, 18);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('FLAC 16-BIT / 44.1 KHZ • BIT-PERFECT CDDA', textX + 192, pillY);

    // CTA Stream Pill
    const ctaY = 325;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    drawRoundRect(ctx, textX, ctaY - 22, 385, 44, 22);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.fillStyle = '#0b0e14';
    ctx.font = '800 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('▶ Listen on BD Band Music Player', textX + 192, ctaY);
    ctx.restore();

    // Bottom Waveform Visualizer
    const waveY = 475;
    const barCount = 44;
    const barWidth = 6;
    const barGap = 10;
    const totalWaveWidth = barCount * (barWidth + barGap) - barGap;
    const startX = (W - totalWaveWidth) / 2;

    const waveHeights = [
      18, 28, 42, 60, 45, 30, 52, 70, 55, 38, 62, 80, 68, 48, 58, 75,
      60, 42, 54, 70, 50, 32, 45, 62, 48, 35, 52, 68, 54, 38, 48, 62,
      44, 28, 40, 52, 38, 24, 36, 48, 32, 22, 16, 12
    ];

    const waveGrad = ctx.createLinearGradient(startX, 0, startX + totalWaveWidth, 0);
    waveGrad.addColorStop(0, '#8b5cf6');
    waveGrad.addColorStop(0.5, '#ec4899');
    waveGrad.addColorStop(1, '#22d3ee');
    ctx.fillStyle = waveGrad;

    for (let i = 0; i < barCount; i++) {
      const bx = startX + i * (barWidth + barGap);
      const bh = (waveHeights[i % waveHeights.length]) * 0.75;
      const by = waveY - bh / 2;
      drawRoundRect(ctx, bx, by, barWidth, bh, 3);
      ctx.fill();
    }

    // Footnote Watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('bd-band-archive.github.io/BD-Band-Music • Bit-Perfect CD Archive', W / 2, 555);
  }

  // 2. Render Vertical 9:16 Story Card (Scales dynamically to device or standard 1080x1920)
  async function renderStoryCardVertical(track, targetCanvas, targetW = 1080, targetH = 1920) {
    if (!targetCanvas) return;
    const ctx = targetCanvas.getContext('2d');
    const W = targetW;
    const H = targetH;
    targetCanvas.width = W;
    targetCanvas.height = H;

    const scale = W / 1080;

    // 1. Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#1c1033');
    bgGrad.addColorStop(0.35, '#0f111a');
    bgGrad.addColorStop(0.7, '#080a0f');
    bgGrad.addColorStop(1, '#040508');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // 2. Ambient Radial Glow
    const glowY = 650 * scale;
    const glowRadius = 520 * scale;
    const glowGrad = ctx.createRadialGradient(W / 2, glowY, 40 * scale, W / 2, glowY, glowRadius);
    glowGrad.addColorStop(0, 'rgba(139, 92, 246, 0.42)');
    glowGrad.addColorStop(0.5, 'rgba(217, 70, 239, 0.15)');
    glowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, 100 * scale, W, 1100 * scale);

    // 3. Header Branding Badge
    const badgeY = 160 * scale;
    const badgeW = 520 * scale;
    const badgeH = 64 * scale;
    ctx.save();
    drawRoundRect(ctx, (W - badgeW) / 2, badgeY - badgeH / 2, badgeW, badgeH, 32 * scale);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fill();
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.14)';
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.font = `700 ${Math.round(24 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🇧🇩 BD BAND ARCHIVE • FLAC', W / 2, badgeY);
    ctx.restore();

    // 4. Centerpiece Album Artwork
    const artSize = 680 * scale;
    const artX = (W - artSize) / 2;
    const artY = 270 * scale;
    const artRadius = 36 * scale;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 48 * scale;
    ctx.shadowOffsetY = 24 * scale;
    drawRoundRect(ctx, artX, artY, artSize, artSize, artRadius);
    ctx.fillStyle = '#121721';
    ctx.fill();
    ctx.restore();

    const coverUrl = track.coverUrl || 'assets/default_album_cover.svg';
    const img = await loadCoverImage(coverUrl);
    ctx.save();
    drawRoundRect(ctx, artX, artY, artSize, artSize, artRadius);
    ctx.clip();
    if (img) {
      ctx.drawImage(img, artX, artY, artSize, artSize);
    } else {
      const fallbackGrad = ctx.createLinearGradient(artX, artY, artX + artSize, artY + artSize);
      fallbackGrad.addColorStop(0, '#8b5cf6');
      fallbackGrad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = fallbackGrad;
      ctx.fillRect(artX, artY, artSize, artSize);
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.round(96 * scale)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🎸', artX + artSize / 2, artY + artSize / 2);
    }
    ctx.restore();

    // 5. Typography
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${Math.round(54 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    let title = track.title;
    const maxTitleW = 860 * scale;
    if (ctx.measureText(title).width > maxTitleW) {
      while (ctx.measureText(title + '...').width > maxTitleW && title.length > 0) {
        title = title.slice(0, -1);
      }
      title += '...';
    }
    ctx.fillText(title, W / 2, 1050 * scale);

    // Artist & Album
    ctx.fillStyle = '#c084fc';
    ctx.font = `700 ${Math.round(38 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    let subtitle = `${track.artist} • ${track.album}`;
    const maxSubW = 880 * scale;
    if (ctx.measureText(subtitle).width > maxSubW) {
      while (ctx.measureText(subtitle + '...').width > maxSubW && subtitle.length > 0) {
        subtitle = subtitle.slice(0, -1);
      }
      subtitle += '...';
    }
    ctx.fillText(subtitle, W / 2, 1120 * scale);

    // 6. Quality Badge Pill
    const qualityY = 1210 * scale;
    const qualityW = 540 * scale;
    const qualityH = 52 * scale;
    drawRoundRect(ctx, (W - qualityW) / 2, qualityY - qualityH / 2, qualityW, qualityH, 26 * scale);
    ctx.fillStyle = 'rgba(34, 211, 238, 0.12)';
    ctx.fill();
    ctx.lineWidth = 1.5 * scale;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.35)';
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = `700 ${Math.round(22 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText('FLAC 16-BIT / 44.1 KHZ • BIT-PERFECT CDDA', W / 2, qualityY);

    // 7. Equalizer Audio Waveform Bars
    const waveY = 1350 * scale;
    const barCount = 32;
    const barWidth = 8 * scale;
    const barGap = 12 * scale;
    const totalWaveWidth = barCount * (barWidth + barGap) - barGap;
    const startX = (W - totalWaveWidth) / 2;

    const waveHeights = [
      24, 38, 55, 75, 95, 65, 45, 80,
      110, 85, 60, 95, 120, 100, 70, 85,
      115, 90, 65, 80, 105, 75, 50, 70,
      85, 60, 45, 65, 80, 55, 38, 22
    ];

    const waveGrad = ctx.createLinearGradient(startX, 0, startX + totalWaveWidth, 0);
    waveGrad.addColorStop(0, '#8b5cf6');
    waveGrad.addColorStop(0.5, '#ec4899');
    waveGrad.addColorStop(1, '#22d3ee');
    ctx.fillStyle = waveGrad;

    for (let i = 0; i < barCount; i++) {
      const bx = startX + i * (barWidth + barGap);
      const bh = (waveHeights[i % waveHeights.length]) * scale;
      const by = waveY - bh / 2;
      drawRoundRect(ctx, bx, by, barWidth, bh, 4 * scale);
      ctx.fill();
    }

    // 8. Bottom CTA Pill (Spotify-style)
    const ctaY = 1560 * scale;
    const ctaW = 620 * scale;
    const ctaH = 76 * scale;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 25 * scale;
    ctx.shadowOffsetY = 10 * scale;
    drawRoundRect(ctx, (W - ctaW) / 2, ctaY - ctaH / 2, ctaW, ctaH, 38 * scale);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.shadowColor = 'transparent';

    ctx.fillStyle = '#0b0e14';
    ctx.font = `800 ${Math.round(28 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText('▶ Listen on bd-band-archive.github.io', W / 2, ctaY);

    // 9. Footnote Watermark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = `600 ${Math.round(20 * scale)}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText('Archived with Lossless CD Packaging Artwork', W / 2, 1720 * scale);

    ctx.restore();
  }

  // Generates high-res story blob at current device/platform default story size
  async function generateFullStoryBlob(track) {
    const dims = getDeviceStoryDimensions();
    const offscreen = document.createElement('canvas');
    await renderStoryCardVertical(track, offscreen, dims.width, dims.height);
    return await new Promise(resolve => offscreen.toBlob(resolve, 'image/png'));
  }

  // Generates 400x300 web card blob
  async function generateWebCardBlob(track) {
    const offscreen = document.createElement('canvas');
    await renderWebCard(track, offscreen);
    return await new Promise(resolve => offscreen.toBlob(resolve, 'image/png'));
  }

  // Refreshes the on-screen preview based on activeStoryFormat
  async function refreshStoryPreview() {
    if (!activeStoryTrack || !storyCanvas) return;
    if (storyCanvasLoading) storyCanvasLoading.classList.remove('hidden');
    try {
      if (activeStoryFormat === 'web') {
        if (storyPreviewFrame) storyPreviewFrame.classList.remove('aspect-story');
        if (storyPreviewHint) storyPreviewHint.textContent = 'Web Card • 400 × 300';
        await renderWebCard(activeStoryTrack, storyCanvas);
      } else {
        if (storyPreviewFrame) storyPreviewFrame.classList.add('aspect-story');
        if (storyPreviewHint) storyPreviewHint.textContent = 'Story View • 9:16 Vertical Preview';
        await renderStoryCardVertical(activeStoryTrack, storyCanvas, 1080, 1920);
      }
    } catch (err) {
      console.error('Error rendering preview:', err);
    } finally {
      if (storyCanvasLoading) storyCanvasLoading.classList.add('hidden');
    }
  }

  async function openStoryShareModal(track) {
    if (!track || !storyShareDialog) return;
    activeStoryTrack = track;
    activeStoryFormat = 'web'; // Default to 400x300 for website

    if (storyFormatWebBtn) storyFormatWebBtn.classList.add('active');
    if (storyFormatStoryBtn) storyFormatStoryBtn.classList.remove('active');

    const dims = getDeviceStoryDimensions();
    if (storyDownloadBtnHint) {
      storyDownloadBtnHint.textContent = `Default Story Size (${dims.width}×${dims.height})`;
    }

    if (storyTrackTitle) storyTrackTitle.textContent = track.title;
    if (storyTrackArtist) storyTrackArtist.textContent = `${track.artist} • ${track.album}`;
    if (storyTrackThumb) {
      storyTrackThumb.src = track.coverUrl || 'assets/default_album_cover.svg';
      storyTrackThumb.onerror = () => { storyTrackThumb.src = 'assets/default_album_cover.svg'; };
    }
    const shareUrl = `${getBaseSiteUrl()}/track/${encodeURIComponent(track.id)}/`;
    if (storyLinkUrlDisplay) {
      storyLinkUrlDisplay.textContent = shareUrl.replace(/^https?:\/\//, '');
    }

    // Open native dialog with showModal (Modern Web Guidance)
    if (typeof storyShareDialog.showModal === 'function') {
      try {
        if (!storyShareDialog.open) storyShareDialog.showModal();
      } catch (e) {
        storyShareDialog.setAttribute('open', '');
      }
    } else {
      storyShareDialog.setAttribute('open', '');
    }

    await refreshStoryPreview();
  }

  // Format Toggle Listeners
  if (storyFormatWebBtn) {
    storyFormatWebBtn.addEventListener('click', () => {
      if (activeStoryFormat === 'web') return;
      activeStoryFormat = 'web';
      storyFormatWebBtn.classList.add('active');
      if (storyFormatStoryBtn) storyFormatStoryBtn.classList.remove('active');
      refreshStoryPreview();
    });
  }

  if (storyFormatStoryBtn) {
    storyFormatStoryBtn.addEventListener('click', () => {
      if (activeStoryFormat === 'story') return;
      activeStoryFormat = 'story';
      storyFormatStoryBtn.classList.add('active');
      if (storyFormatWebBtn) storyFormatWebBtn.classList.remove('active');
      refreshStoryPreview();
    });
  }

  // Close Dialog Actions
  if (closeStoryShareBtn && storyShareDialog) {
    closeStoryShareBtn.addEventListener('click', () => {
      storyShareDialog.close();
    });
  }

  // Fallback for browsers without closedby support (Modern Web Guidance)
  if (storyShareDialog && !('closedBy' in HTMLDialogElement.prototype)) {
    storyShareDialog.addEventListener('click', (event) => {
      if (event.target !== storyShareDialog) return;
      const rect = storyShareDialog.getBoundingClientRect();
      const isInside = (
        rect.top <= event.clientY && event.clientY <= rect.top + rect.height &&
        rect.left <= event.clientX && event.clientX <= rect.left + rect.width
      );
      if (!isInside) storyShareDialog.close();
    });
  }

  function triggerStoryDownload(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
  }

  // 1. Native Mobile Story Share (Uses Default Story Size of Current Device/Platform)
  if (storyNativeShareBtn) {
    storyNativeShareBtn.addEventListener('click', async () => {
      if (!activeStoryTrack) return;
      const track = activeStoryTrack;
      const shareUrl = `${getBaseSiteUrl()}/track/${encodeURIComponent(track.id)}/`;
      showToast('Rendering story image for your device...');

      const blob = await generateFullStoryBlob(track);
      const dims = getDeviceStoryDimensions();
      const fileName = `${track.artist} - ${track.title} Story (${dims.width}x${dims.height}).png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `${track.title} — ${track.artist}`,
            text: `🎵 Listening to ${track.title} by ${track.artist} on BD Band Music!`,
            files: [file],
            url: shareUrl
          });
          showToast('🎉 Shared to Story!');
        } catch (shareErr) {
          if (shareErr.name !== 'AbortError') {
            console.warn('Native share failed, downloading card:', shareErr);
            triggerStoryDownload(blob, fileName);
            copyToClipboardFallback(shareUrl, '⬇️ Saved Story Card & copied direct link!');
          }
        }
      } else {
        // Desktop / Unsupported fallback
        triggerStoryDownload(blob, fileName);
        copyToClipboardFallback(shareUrl, `⬇️ Saved Story Card (${dims.width}×${dims.height}) & copied link!`);
      }
    });
  }

  // 2. Download Story Image (Default Platform / Device Story Size)
  if (storyDownloadBtn) {
    storyDownloadBtn.addEventListener('click', async () => {
      if (!activeStoryTrack) return;
      const track = activeStoryTrack;
      showToast('Rendering full-size story card...');
      const blob = await generateFullStoryBlob(track);
      const dims = getDeviceStoryDimensions();
      const fileName = `${track.artist} - ${track.title} Story Card (${dims.width}x${dims.height}).png`;
      triggerStoryDownload(blob, fileName);
      showToast(`⬇️ Downloaded Story Card (${dims.width}×${dims.height})!`);
    });
  }

  // 3. Download 400x300 Web Card
  if (storyDownloadWebBtn) {
    storyDownloadWebBtn.addEventListener('click', async () => {
      if (!activeStoryTrack) return;
      const track = activeStoryTrack;
      showToast('Rendering 400×300 web card...');
      const blob = await generateWebCardBlob(track);
      const fileName = `${track.artist} - ${track.title} Web Card (400x300).png`;
      triggerStoryDownload(blob, fileName);
      showToast('⬇️ Downloaded Web Card (400×300)!');
    });
  }

  // 4. Share to Facebook Web Dialog
  if (storyFbShareBtn) {
    storyFbShareBtn.addEventListener('click', () => {
      if (!activeStoryTrack) return;
      const shareUrl = `${getBaseSiteUrl()}/track/${encodeURIComponent(activeStoryTrack.id)}/`;
      const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
      window.open(fbUrl, '_blank', 'width=620,height=580,menubar=no,toolbar=no,resizable=yes');
    });
  }

  // 5. Copy Direct Song Link
  if (storyCopyLinkBtn) {
    storyCopyLinkBtn.addEventListener('click', () => {
      if (!activeStoryTrack) return;
      copyTrackShareLink(activeStoryTrack.id);
    });
  }

  // Hook Bottom Player Bar Share Button -> Opens Spotify-Style Share to Story Modal
  if (playerShareBtn) {
    playerShareBtn.title = 'Share Track to Story (Instagram / Facebook)';
    playerShareBtn.addEventListener('click', () => {
      if (currentTrack) {
        openStoryShareModal(currentTrack);
      } else if (catalog && catalog.length > 0) {
        openStoryShareModal(catalog[0]);
      } else {
        showToast('Play or select a song to share to Story');
      }
    });
  }

  // --- Helper: URL Deep Linking & Direct Song Link Routing ---
  function initFromUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const queryTrack = urlParams.get('track') || urlParams.get('song');
    const queryArtist = urlParams.get('artist');
    const queryAlbum = urlParams.get('album');
    const hash = window.location.hash;

    let targetTrack = null;

    if (queryTrack) {
      // 1. Direct ID match
      targetTrack = catalog.find(t => t.id === queryTrack);
      // 2. Slug / Title search match (e.g. ?track=ashirbad or ?track=shorger-shishura)
      if (!targetTrack) {
        const cleanQuery = queryTrack.toLowerCase().replace(/[\s_\-\W]+/g, '');
        targetTrack = catalog.find(t => t.title.toLowerCase().replace(/[\s_\-\W]+/g, '').includes(cleanQuery));
      }
    } else if (hash.startsWith('#track=')) {
      const trackId = hash.replace('#track=', '');
      targetTrack = catalog.find(t => t.id === trackId);
      if (!targetTrack) {
        const cleanQuery = trackId.toLowerCase().replace(/[\s_\-\W]+/g, '');
        targetTrack = catalog.find(t => t.title.toLowerCase().replace(/[\s_\-\W]+/g, '').includes(cleanQuery));
      }
    }

    if (targetTrack) {
      // Direct song link accessed: dismiss landing page overlay immediately
      dismissLanding();
      activeView = 'tracks';
      activeArtistFilter = 'all';
      activeAlbumFilter = 'all';
      isFullTracksListExpanded = true;
      updateViewTabs();
      applyFilters();
      playTrackById(targetTrack.id, true);

      setTimeout(() => {
        const row = document.querySelector(`tr[data-id="${targetTrack.id}"]`);
        if (row) {
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          row.classList.add('highlight-shared');
          setTimeout(() => row.classList.remove('highlight-shared'), 3500);
        }
      }, 400);

      return;
    }

    // Artist query or hash
    if (queryArtist) {
      dismissLanding();
      activeView = 'tracks';
      activeAlbumFilter = 'all';
      const cleanQuery = toSlug(queryArtist);
      let matchedArtist = null;
      for (const t of catalog) {
        const tArtists = (t.artists && t.artists.length > 0) ? t.artists : [t.artist];
        const found = tArtists.find(a => a === queryArtist || toSlug(a) === cleanQuery);
        if (found) {
          matchedArtist = found;
          break;
        }
      }
      setArtistFilter(matchedArtist || queryArtist, false);
      updateViewTabs();
      return;
    }

    // Album query or hash
    if (queryAlbum) {
      dismissLanding();
      activeView = 'tracks';
      activeArtistFilter = 'all';
      const cleanQuery = toSlug(queryAlbum);
      const matchedTrack = catalog.find(t => t.album === queryAlbum || toSlug(t.album) === cleanQuery);
      setAlbumFilter(matchedTrack ? matchedTrack.album : queryAlbum, false);
      updateViewTabs();
      return;
    }

    if (hash.startsWith('#artist=')) {
      dismissLanding();
      const artist = decodeURIComponent(hash.replace('#artist=', ''));
      setArtistFilter(artist, false);
      updateViewTabs();
      return;
    } else if (hash.startsWith('#album=')) {
      dismissLanding();
      const album = decodeURIComponent(hash.replace('#album=', ''));
      setAlbumFilter(album, false);
      updateViewTabs();
      return;
    } else if (hash === '#albums' || hash === '#artists') {
      activeView = hash.replace('#', '');
      updateViewTabs();
      applyFilters();
    } else {
      isFullTracksListExpanded = false;
      applyFilters();
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
