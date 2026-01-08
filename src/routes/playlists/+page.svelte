<script lang="ts">
  interface Playlist {
    id: string;
    name: string;
    tracks: number;
    image: string;
    isLiked?: boolean;
  }

  interface CachedTrackItem {
    track?: {
      uri?: string;
      artists?: { id?: string }[];
    };
  }

  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
  
  let playlists: Playlist[] = [];
  let loading = true;
  let error = '';
  let selectedPlaylists = new Set();
  let deleteMode = false;

  import { toApi } from '$lib/api';

  async function fetchPlaylists() {
    const token = localStorage.getItem('spotify_access_token');
    if (!token) {
      // Check for valid token
      error = 'No Spotify access token found.';
      loading = false;
      return;
    }
    try {
      // Fetch playlists
      const res = await fetch(toApi('me/playlists'), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (res.status === 401) {
        // If the token is expired, clear it and redirect to login
        localStorage.removeItem('spotify_access_token');
        error = 'Your session has expired. Please log in again.';
        loading = false;
        return;
      }
      
      const data = await res.json();
      let loadedPlaylists: Playlist[] = [];
      if (data.items) {
        loadedPlaylists = data.items.map((p: any) => ({
          id: p.id,
          name: p.name,
          tracks: p.tracks.total,
          image: Array.isArray(p.images) && p.images.length > 0 ? p.images[0].url : '',
        }));
      } else {
        error = 'Failed to fetch playlists.';
        console.error('Playlists API response:', data);
      }

      // Fetch liked songs
      const likedRes = await fetch(toApi('me/tracks?limit=1'), {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!likedRes.ok) {
        console.error('Liked Songs API error:', likedRes.status, likedRes.statusText);
        error = `Could not fetch liked songs: ${likedRes.status} ${likedRes.statusText}`;
        loading = false;
        return;
      }
      
      const likedData = await likedRes.json();
      let likedSongsCount = 0;
            
      if (likedData && typeof likedData.total === 'number') {
        likedSongsCount = likedData.total;
      } else if (likedData && Array.isArray(likedData.items)) {
        likedSongsCount = likedData.items.length;
      } else {
        error = 'Could not fetch liked songs count - invalid response format.';
        console.error('Unexpected liked songs response format:', likedData);
      }
      const likedSongsImage = 'https://misc.scdn.co/liked-songs/liked-songs-640.png'; // Default liked songs image
      loadedPlaylists.unshift({
        id: 'liked',
        name: 'Liked Songs',
        tracks: likedSongsCount,
        image: likedSongsImage,
        isLiked: true
      });

      playlists = loadedPlaylists;
    } catch (e: unknown) {
      error = 'Error fetching playlists.';
      console.error('FetchPlaylists error:', e);
    }
    loading = false;
  }

  function toggleDeleteMode() {
    deleteMode = !deleteMode;
    selectedPlaylists.clear();
    selectedPlaylists = new Set(); 
  }

  function togglePlaylistSelection(playlistId: string) {
    if (selectedPlaylists.has(playlistId)) {
      selectedPlaylists.delete(playlistId);
    } else {
      selectedPlaylists.add(playlistId);
    }
    selectedPlaylists = new Set(selectedPlaylists);
  }

  async function deleteSelectedPlaylists() {
    if (selectedPlaylists.size === 0) return;
    
    // Force re-authentication before deleting
    if (!confirm(`Are you sure you want to delete ${selectedPlaylists.size} playlist(s)? This cannot be undone.\n\nYou will need to re-authenticate with Spotify for security.`)) {
      return;
    }
    
    // Store the selected playlists and redirect to Spotify auth
    localStorage.setItem('pending_delete_playlists', JSON.stringify(Array.from(selectedPlaylists)));
    localStorage.setItem('delete_auth_required', 'true');
    
    // Redirect to Spotify login for re-authentication
    const clientId = '0e612a7fd5544773bb7f69ba48861721';
    const redirectUri = 'http://127.0.0.1:5173/callback';
    const scopes = [
      'playlist-read-private',
      'playlist-read-collaborative',
      'user-read-email',
      'user-read-private',
      'playlist-modify-public',
      'playlist-modify-private',
      'user-library-read'
    ];
    
    const authUrl =
      `https://accounts.spotify.com/authorize?` +
      `client_id=${clientId}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes.join(' '))}` +
      `&show_dialog=true`; // Force login dialog
    
    window.location.href = authUrl;
  }

  async function performPendingDelete() {
    const pendingDelete = localStorage.getItem('pending_delete_playlists');
    const authRequired = localStorage.getItem('delete_auth_required');
    
    if (!pendingDelete || !authRequired) return;
    
    // Clear the pending delete flags
    localStorage.removeItem('pending_delete_playlists');
    localStorage.removeItem('delete_auth_required');
    
    const playlistsToDelete = JSON.parse(pendingDelete);
    const token = localStorage.getItem('spotify_access_token');
    
    if (!token) {
      error = 'No access token found after re-authentication';
      return;
    }

    loading = true;
    let deleteErrors = [];

    for (const playlistId of playlistsToDelete) {
      // Disallow user from deleting liked songs
      if (playlistId === 'liked') continue;
      
      try {
        const res = await fetch(toApi(`playlists/${playlistId}/followers`), {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!res.ok) {
          const playlist = playlists.find(p => p.id === playlistId);
          deleteErrors.push(`Failed to delete "${playlist?.name || playlistId}"`);
        }
      } catch (e) {
        const playlist = playlists.find(p => p.id === playlistId);
        deleteErrors.push(`Error deleting "${playlist?.name || playlistId}"`);
      }
    }

    if (deleteErrors.length > 0) {
      error = deleteErrors.join(', ');
    } else {
      error = '';
      // Show success message
      alert(`Successfully deleted ${playlistsToDelete.length} playlist(s)!`);
    }

    // Refresh playlists
    selectedPlaylists.clear();
    selectedPlaylists = new Set();
    deleteMode = false;
    await fetchPlaylists();
  }

  import { onMount } from 'svelte';
  onMount(() => {
    fetchPlaylists();
    // Check if returned from re-authentication for delete
    performPendingDelete();
  });
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';

  let processingPlaylist: string | null = null;
  let processingProgress = { current: 0, total: 0, stage: '' };

  async function handleSelect(playlist: Playlist) {
    // Clear previous playlist creation session
    localStorage.removeItem('created_playlist');
    (window as any)._playlistCreated = false;
    
    // Set processing state
    processingPlaylist = playlist.id;
    processingProgress = { current: 0, total: 0, stage: 'Starting...' };
    
    const token = localStorage.getItem('spotify_access_token');
    try {
      let allTracks: CachedTrackItem[] = [];
      const cacheKey = `playlist_cache_${playlist.id}`;
      const cachedRaw = localStorage.getItem(cacheKey);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw) as { updatedAt: number; trackCount: number; items: CachedTrackItem[] };
          const fresh = Date.now() - cached.updatedAt < CACHE_TTL_MS;
          const countMatches = !playlist.tracks || cached.trackCount === playlist.tracks;
          if (fresh && countMatches && Array.isArray(cached.items)) {
            allTracks = cached.items;
            processingProgress = {
              current: cached.items.length,
              total: playlist.tracks || cached.items.length,
              stage: `Using cached tracks (${cached.items.length}/${playlist.tracks || cached.items.length})...`
            };
          }
        } catch (e) {
          console.warn('Failed to parse cache', e);
        }
      }

      // Fetch tracks if no fresh cache
      if (allTracks.length === 0) {
        processingProgress.stage = 'Fetching tracks...';
        if (playlist.isLiked) {
          localStorage.setItem('selected_playlist_id', 'liked-songs');
          let url: string | null = toApi('me/tracks?limit=50&fields=items(track(uri,artists(id))),next,total');
          let trackCount = 0;
          let totalTarget = playlist.tracks || 0;
          
          while (url) {
            const likedTracksRes: Response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            const tracksData: any = await likedTracksRes.json();
            if (!totalTarget && typeof tracksData.total === 'number') {
              totalTarget = tracksData.total;
            }
            
            if (tracksData.items) {
              allTracks.push(...tracksData.items);
              trackCount += tracksData.items.length;
              const total = totalTarget || trackCount;
              processingProgress = { 
                current: Math.min(trackCount, total), 
                total, 
                stage: `Fetching tracks (${Math.min(trackCount, total)}/${total})...` 
              };
            }
            url = tracksData.next ? toApi(tracksData.next) : null;
          }
          const finalTotal = totalTarget || trackCount;
          processingProgress = { current: Math.min(trackCount, finalTotal), total: finalTotal, stage: 'Tracks fetched.' };
        } else {
          localStorage.setItem('selected_playlist_id', playlist.id);
          let url: string | null = toApi(`playlists/${playlist.id}/tracks?limit=50&fields=items(track(uri,artists(id))),next,total`);
          let trackCount = 0;
          let totalTarget = playlist.tracks || 0;
          
          while (url) {
            const tracksRes: Response = await fetch(url, {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            const tracksData: any = await tracksRes.json();
            if (!totalTarget && typeof tracksData.total === 'number') {
              totalTarget = tracksData.total;
            }
            
            if (tracksData.items) {
              allTracks.push(...tracksData.items);
              trackCount += tracksData.items.length;
              const total = totalTarget || trackCount;
              processingProgress = { 
                current: Math.min(trackCount, total), 
                total, 
                stage: `Fetching tracks (${Math.min(trackCount, total)}/${total})...` 
              };
            }
            url = tracksData.next ? toApi(tracksData.next) : null;
          }
          const finalTotal = totalTarget || trackCount;
          processingProgress = { current: Math.min(trackCount, finalTotal), total: finalTotal, stage: 'Tracks fetched.' };
        }

        // Cache the fetched tracks
        try {
          localStorage.setItem(cacheKey, JSON.stringify({
            updatedAt: Date.now(),
            trackCount: playlist.tracks,
            items: allTracks
          }));
        } catch (e) {
          console.warn('Failed to cache tracks', e);
        }
      }
      
      // Extract artist IDs
      processingProgress.stage = 'Analyzing artists...';
      const artistIds: string[] = [];
      const artistCache: Record<string, string[]> = {};
      if (!Array.isArray(allTracks)) {
        error = 'Error: Could not fetch tracks for this playlist.';
        console.error('allTracks:', allTracks);
        processingPlaylist = null;
        return;
      }
      
      allTracks.forEach((item: any) => {
        if (item.track && item.track.artists) {
          item.track.artists.forEach((artist: any) => {
            if (artist && artist.id && !artistIds.includes(artist.id)) {
              artistIds.push(artist.id);
            }
          });
        }
      });
      
      // Fetch genres
      let genresSet = new Set();
      const totalBatches = Math.ceil(artistIds.length / 50);
      processingProgress.total = totalBatches;
      processingProgress.current = 0;
      
      for (let i = 0; i < artistIds.length; i += 50) {
        const batchNumber = Math.floor(i / 50) + 1;
        processingProgress = { 
          current: batchNumber, 
          total: totalBatches, 
          stage: `Fetching genres (${batchNumber}/${totalBatches} batches)...` 
        };
        
        const batchIds = artistIds.slice(i, i + 50);

        // Use cache to avoid re-fetching same artist IDs (defensive, though artistIds is unique)
        const idsToFetch = batchIds.filter(id => !artistCache[id]);

        if (idsToFetch.length > 0) {
          const idsChunk = idsToFetch.join(',');
          const artistsRes = await fetch(toApi(`artists?ids=${idsChunk}`), {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          const artistsData = await artistsRes.json();
          if (artistsData.artists) {
            artistsData.artists.forEach((artist: any) => {
              artistCache[artist.id] = artist.genres || [];
            });
          }
        }

        batchIds.forEach(id => {
          const genres = artistCache[id];
          if (genres) {
            genres.forEach((genre: string) => genresSet.add(genre));
          }
        });
      }
      
      processingProgress.stage = 'Processing complete!';
      localStorage.setItem('playlist_genres', JSON.stringify(Array.from(genresSet)));
      
      // Small delay to show completion message
      setTimeout(() => {
        processingPlaylist = null;
        goto(`${base}/genres`);
      }, 500);
      
    } catch (e) {
      error = 'Error fetching genres for playlist.';
      console.error(e);
      processingPlaylist = null;
    }
  }
</script>

<div class="playlists-container">
  <div class="header">
    <h1>Your Spotify Playlists</h1>
    <div class="header-buttons">
      <button class="delete-mode-btn" on:click={toggleDeleteMode}>
        {deleteMode ? 'Cancel' : 'Delete Playlists'}
      </button>
      {#if deleteMode && selectedPlaylists.size > 0}
        <button class="delete-selected-btn" on:click={deleteSelectedPlaylists}>
          Delete Selected ({selectedPlaylists.size})
        </button>
      {/if}
    </div>
  </div>
  {#if processingPlaylist}
    <div class="global-progress">
      <div class="global-progress__text">{processingProgress.stage}</div>
      {#if processingProgress.total > 0}
        <div class="global-progress__bar">
          <div class="global-progress__fill" style={`width: ${(processingProgress.current / processingProgress.total) * 100}%`}></div>
        </div>
        <div class="global-progress__numbers">{processingProgress.current}/{processingProgress.total}</div>
      {:else}
        <div class="global-progress__bar global-progress__bar--indeterminate">
          <div class="global-progress__fill global-progress__fill--indeterminate"></div>
        </div>
      {/if}
    </div>
  {/if}
  {#if loading}
    <div style="text-align:center; margin:2rem;">
      <div class="loading-wheel" style="border:8px solid #191414; border-top:8px solid #1DB954; border-radius:50%; width:80px; height:80px; animation:spin 1s linear infinite; margin:auto;"></div>
      <div style="margin-top:1rem; color:#b3b3b3;">Loading playlists...</div>
    </div>
  {:else if error}
    <div style="color:#e74c3c; text-align:center; margin:2rem;">{error}</div>
  {:else if playlists.length === 0}
    <div style="color:#b3b3b3; text-align:center; margin:2rem;">No playlists found.</div>
  {:else}
    <div class="playlists-grid">
      {#each playlists as playlist}
        <div 
          class="playlist-card" 
          class:selected={selectedPlaylists.has(playlist.id)}
          class:clickable={deleteMode && !playlist.isLiked}
          class:processing={processingPlaylist === playlist.id}
          class:disabled={processingPlaylist && processingPlaylist !== playlist.id}
          role="button"
          tabindex="0"
          on:click={() => {
            if (processingPlaylist) return;
            if (deleteMode && !playlist.isLiked) {
              togglePlaylistSelection(playlist.id);
            } else if (!deleteMode) {
              handleSelect(playlist);
            }
          }}
          on:keydown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              if (processingPlaylist) return;
              if (deleteMode && !playlist.isLiked) {
                togglePlaylistSelection(playlist.id);
              } else if (!deleteMode) {
                handleSelect(playlist);
              }
            }
          }}
        >
          <img class="playlist-image" src={playlist.image} alt={playlist.name} />
          <div class="playlist-title">{playlist.name}</div>
          <div class="playlist-tracks">{playlist.tracks} tracks</div>
          {#if processingPlaylist === playlist.id}
            <div class="processing-indicator">
              <div class="processing-spinner"></div>
              <div class="processing-text">{processingProgress.stage}</div>
              {#if processingProgress.total > 0}
                <div class="progress-bar">
                  <div class="progress-fill" style="width: {(processingProgress.current / processingProgress.total) * 100}%"></div>
                </div>
                <div class="progress-text">{processingProgress.current}/{processingProgress.total}</div>
              {/if}
            </div>
          {:else if !deleteMode}
            <button 
              class="select-btn" 
              disabled={processingPlaylist !== null}
              on:click|stopPropagation={() => handleSelect(playlist)}
            >
              {processingPlaylist ? 'Processing...' : 'Select'}
            </button>
          {:else if playlist.isLiked}
            <div class="no-delete-note">Cannot delete Liked Songs</div>
          {:else}
            <div class="delete-instruction">Click to {selectedPlaylists.has(playlist.id) ? 'deselect' : 'select'}</div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }
  .header h1 {
    margin: 0;
    color: #1DB954;
    font-size: 2rem;
    font-weight: 700;
    letter-spacing: 1px;
  }
  .header-buttons {
    display: flex;
    gap: 1rem;
  }
  .delete-mode-btn {
    background: #e74c3c;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  .delete-mode-btn:hover {
    background: #c0392b;
  }
  .delete-selected-btn {
    background: #c0392b;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  .delete-selected-btn:hover {
  
  /* Global processing bar */
  :global(.global-progress) {
    background: #0f0f0f;
    border: 1px solid rgba(29,185,84,0.4);
    border-radius: 10px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  }
  :global(.global-progress__text) {
    color: #1DB954;
    font-weight: 700;
    margin-bottom: 0.35rem;
    font-size: 0.95rem;
  }
  :global(.global-progress__bar) {
    position: relative;
    height: 8px;
    background: rgba(255,255,255,0.15);
    border-radius: 999px;
    overflow: hidden;
  }
  :global(.global-progress__fill) {
    height: 100%;
    background: linear-gradient(90deg, #1DB954, #1ed760);
    width: 0%;
    transition: width 0.25s ease;
  }
  :global(.global-progress__numbers) {
    color: #b3b3b3;
    font-size: 0.85rem;
    margin-top: 0.25rem;
    text-align: right;
  }
  :global(.global-progress__bar--indeterminate) {
    overflow: hidden;
  }
  :global(.global-progress__fill--indeterminate) {
    position: absolute;
    width: 40%;
    animation: indeterminate 1.1s infinite;
  }
  @keyframes indeterminate {
    0% { left: -40%; }
    50% { left: 60%; }
    100% { left: 100%; }
  }
    background: #a93226;
  }
  .playlists-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 2rem;
    margin-top: 2rem;
    width: 100%;
    box-sizing: border-box;
  }
  .playlist-card {
    background: #181818;
    border-radius: 12px;
    padding: 1.3rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    text-align: center;
    color: #fff;
    transition: transform 0.15s, border 0.2s, box-shadow 0.2s;
    position: relative;
    width: 100%;
    box-sizing: border-box;
  }
  .playlist-card:hover {
    transform: scale(1.04);
    box-shadow: 0 4px 16px rgba(30,185,84,0.15);
  }
  .playlist-card.clickable {
    cursor: pointer;
  }
  .playlist-card.clickable:hover {
    box-shadow: 0 4px 16px rgba(231,76,60,0.2);
    border: 2px solid rgba(231,76,60,0.5);
  }
  .playlist-card.selected {
    border: 2px solid #e74c3c;
    box-shadow: 0 4px 16px rgba(231,76,60,0.4);
    background: rgba(231,76,60,0.1);
  }
  
  .playlist-card.processing {
    border: 2px solid #1DB954;
    box-shadow: 0 4px 16px rgba(29,185,84,0.4);
    background: rgba(29,185,84,0.1);
  }
  
  .playlist-card.disabled {
    opacity: 0.5;
    pointer-events: none;
    cursor: not-allowed;
  }
  .delete-instruction {
    font-size: 0.85rem;
    color: #e74c3c;
    font-weight: 600;
    margin-top: 0.5rem;
    opacity: 0.8;
  }
  .no-delete-note {
    font-size: 0.8rem;
    color: #b3b3b3;
    font-style: italic;
    margin-top: 0.5rem;
  }
  .playlist-image {
    width: 180px;
    height: 180px;
    object-fit: cover;
    border-radius: 8px;
    margin: 0 auto 0.7rem auto;
    display: block;
    box-shadow: 0 1px 6px rgba(0,0,0,0.2);
  }
  .playlist-title {
    font-size: 1.1rem;
    font-weight: 600;
    margin-bottom: 0.3rem;
    color: #fff;
  }
  .playlist-tracks {
    font-size: 0.95rem;
    color: #b3b3b3;
    margin-bottom: 0.7rem;
  }
  .select-btn {
    background: #1DB954;
    color: #fff;
    border: none;
    border-radius: 20px;
    padding: 0.5rem 1.2rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  .select-btn:hover:not(:disabled) {
    background: #1ed760;
  }
  
  .select-btn:disabled {
    background: #555;
    cursor: not-allowed;
    opacity: 0.6;
  }
  
  /* Processing indicator styles */
  .processing-indicator {
    padding: 1rem;
    background: rgba(29, 185, 84, 0.1);
    border: 1px solid rgba(29, 185, 84, 0.3);
    border-radius: 8px;
    margin-top: 0.5rem;
  }
  
  .processing-spinner {
    width: 30px;
    height: 30px;
    border: 3px solid rgba(29, 185, 84, 0.3);
    border-top: 3px solid #1DB954;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 0.5rem auto;
  }
  
  .processing-text {
    font-size: 0.9rem;
    color: #1DB954;
    font-weight: 600;
    margin-bottom: 0.5rem;
    text-align: center;
  }
  
  .progress-bar {
    background: rgba(255, 255, 255, 0.2);
    border-radius: 10px;
    height: 6px;
    margin: 0.5rem 0;
    overflow: hidden;
  }
  
  .progress-fill {
    background: #1DB954;
    height: 100%;
    transition: width 0.3s ease;
    border-radius: 10px;
  }
  
  .progress-text {
    font-size: 0.8rem;
    color: #b3b3b3;
    text-align: center;
  }
</style>
