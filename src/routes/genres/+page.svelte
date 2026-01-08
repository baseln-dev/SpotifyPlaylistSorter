<script lang="ts">
  let isLoading = false;
  // Get genres from localStorage, set by playlists page
  let genres: string[] = [];
  let searchQuery: string = '';
  let filteredGenres: string[] = [];
  
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('playlist_genres');
    if (stored) {
      genres = JSON.parse(stored);
      filteredGenres = genres;
    }
  }
  let selectedGenres: string[] = [];
  let playlistMode = 'single'; // 'single' or 'multiple'

  function filterGenres(query: string) {
    if (!query.trim()) {
      filteredGenres = genres;
    } else {
      const lowerQuery = query.toLowerCase();
      filteredGenres = genres.filter(genre =>
        genre.toLowerCase().includes(lowerQuery)
      );
    }
  }

  function handleSearchInput(e: Event) {
    const target = e.target as HTMLInputElement;
    searchQuery = target.value;
    filterGenres(searchQuery);
  }

  function toggleGenre(genre: string) {
    if (selectedGenres.includes(genre)) {
      selectedGenres = selectedGenres.filter(g => g !== genre);
    } else {
      selectedGenres = [...selectedGenres, genre];
    }
  }

  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { toApi } from '$lib/api';

  async function handleContinue() {
  if (selectedGenres.length === 0) return;
  isLoading = true;
    const token = localStorage.getItem('spotify_access_token');
    const playlistId = localStorage.getItem('selected_playlist_id');
    const userRes = await fetch(toApi('me'), {
      headers: { Authorization: `Bearer ${token}` }
    });
    const userData = await userRes.json();
    let tracksData: any;
    if (playlistId === 'liked-songs') {
      // Fetch ALL liked songs (paginated)
      let allItems = [];
      let nextUrl = toApi('me/tracks?limit=50');
      while (nextUrl) {
        const tracksRes = await fetch(nextUrl, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const pageData = await tracksRes.json();
        if (Array.isArray(pageData.items)) {
          allItems.push(...pageData.items);
        }
        nextUrl = pageData.next ? toApi(pageData.next) : '';
      }
      tracksData = { items: allItems };
    } else {
      const tracksRes = await fetch(toApi(`playlists/${playlistId}/tracks`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      tracksData = await tracksRes.json();
    }

    // Helper to get track URIs for a genre using batched artist lookups
    // Helper: sleep for ms milliseconds
    function sleep(ms: number) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    async function getTrackUrisForGenre(genre: string) {
      let uris: string[] = [];
      // Collect all unique artist IDs from tracks
      let artistIdToTrackUris: Record<string, string[]> = {};
      let allArtistIds: string[] = [];
      for (const item of tracksData.items) {
        if (item.track && item.track.artists) {
          for (const artist of item.track.artists) {
            if (!allArtistIds.includes(artist.id)) {
              allArtistIds.push(artist.id);
            }
            if (!artistIdToTrackUris[artist.id]) {
              artistIdToTrackUris[artist.id] = [];
            }
            artistIdToTrackUris[artist.id].push(item.track.uri);
          }
        }
      }
      // Batch artist lookups (max 50 per request)
      let artistGenres: Record<string, string[]> = {};
      for (let i = 0; i < allArtistIds.length; i += 50) {
        const batchIds = allArtistIds.slice(i, i + 50);
        const artistsRes = await fetch(toApi(`artists?ids=${batchIds.join(',')}`), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const artistsData = await artistsRes.json();
        if (artistsData.artists) {
          for (const artist of artistsData.artists) {
            artistGenres[artist.id] = artist.genres || [];
          }
        }
        // Add a delay after each batch to avoid rate limiting
        if (i + 50 < allArtistIds.length) {
          await sleep(750);
        }
      }
      // For each artist, if they match the genre, add their tracks
      for (const artistId in artistIdToTrackUris) {
        if (artistGenres[artistId] && artistGenres[artistId].includes(genre)) {
          uris.push(...artistIdToTrackUris[artistId]);
        }
      }
      // Remove duplicates
      uris = Array.from(new Set(uris));
      return uris;
    }

    try {
      if (playlistMode === 'single') {
        // One playlist with all selected genres
        let allUris = [];
        for (const genre of selectedGenres) {
          const uris = await getTrackUrisForGenre(genre);
          allUris.push(...uris);
        }
        // Remove duplicates
        allUris = Array.from(new Set(allUris));
        const createRes = await fetch(toApi(`users/${userData.id}/playlists`), {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `Genres: ${selectedGenres.join(', ')}`,
            description: 'Created by Playlist Sorter',
            public: false
          })
        });
        const newPlaylist = await createRes.json();
        for (let i = 0; i < allUris.length; i += 100) {
          const batch = allUris.slice(i, i + 100);
          await fetch(toApi(`playlists/${newPlaylist.id}/tracks`), {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ uris: batch })
          });
        }
        localStorage.setItem('created_playlist', JSON.stringify(newPlaylist));
      } else {
        // Multiple playlists, one per genre
        let created = [];
        for (const genre of selectedGenres) {
          const uris = await getTrackUrisForGenre(genre);
          if (uris.length === 0) continue;
          const createRes = await fetch(toApi(`users/${userData.id}/playlists`), {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              name: `Genre: ${genre}`,
              description: 'Created by Playlist Sorter',
              public: false
            })
          });
          const newPlaylist = await createRes.json();
          for (let i = 0; i < uris.length; i += 100) {
            const batch = uris.slice(i, i + 100);
            await fetch(toApi(`playlists/${newPlaylist.id}/tracks`), {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ uris: batch })
            });
          }
          created.push(newPlaylist);
        }
        localStorage.setItem('created_playlist', JSON.stringify(created));
      }
  // Only navigate after all work is done
  isLoading = false;
  goto(`${base}/created`);
    } catch (e: unknown) {
  isLoading = false;
  alert('Error creating playlist: ' + (e instanceof Error ? e.message : String(e)));
    }
  }
</script>

<style>
  .loading-modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #121212;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  .loading-wheel {
    border: 8px solid #121212;
    border-top: 8px solid #1ED760;
    border-radius: 50%;
    width: 80px;
    height: 80px;
    animation: spin 1s linear infinite;
    margin-bottom: 2rem;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .loading-text {
    font-size: 1.2rem;
    color: #FFFFFF;
    margin-bottom: 0.5rem;
  }
  .loading-subtext {
    color: #FFFFFF;
    font-size: 1rem;
  }
  .genres-container {
    background: #121212;
    padding: 2rem 2.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    width: 100%;
    max-width: 600px;
    max-height: 80vh;
    margin: 4rem auto;
    color: #fff;
    text-align: center;
    display: flex;
    flex-direction: column;
  }
  h1 {
    color: #1DB954;
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 2rem;
    letter-spacing: 1px;
  }
  .genres-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
    max-height: 400px;
    overflow-y: auto;
    padding: 0.5rem;
    border: 1px solid #333;
    border-radius: 8px;
    background: #191414;
  }
  
  /* Custom scrollbar for the genres grid */
  .genres-grid::-webkit-scrollbar {
    width: 8px;
  }
  
  .genres-grid::-webkit-scrollbar-track {
    background: #191414;
    border-radius: 4px;
  }
  
  .genres-grid::-webkit-scrollbar-thumb {
    background: #1DB954;
    border-radius: 4px;
  }
  
  .genres-grid::-webkit-scrollbar-thumb:hover {
    background: #1ed760;
  }
  .genre-btn {
    background: #191414;
    color: #fff;
    border: 2px solid #333;
    border-radius: 20px;
    font-size: 1rem;
    font-weight: 600;
    padding: 0.75rem 1.5rem;
    cursor: pointer;
    transition: border 0.2s, background 0.2s, color 0.2s;
    outline: none;
  }
  .genre-btn.selected {
    border: 2px solid #1DB954;
    background: #1DB954;
    color: #191414;
  }
  .continue-btn {
    background: #1DB954;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 1rem;
    font-weight: 600;
    padding: 0.75rem 2rem;
    cursor: pointer;
    transition: background 0.2s;
  }
  .continue-btn:hover {
    background: #1ed760;
  }
  
  .controls-section {
    margin-top: auto;
    padding-top: 1rem;
    border-top: 1px solid #333;
    flex-shrink: 0;
  }
  
  label {
    color: #fff;
    margin: 0.5rem 0;
    display: inline-flex;
    align-items: center;
    cursor: pointer;
  }
  
  input[type="radio"] {
    margin-right: 0.5rem;
    accent-color: #1DB954;
  }

  .search-container {
    position: relative;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
  }

  .search-input {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 1rem;
    background: #191414;
    border: 2px solid #333;
    border-radius: 20px;
    color: #fff;
    font-size: 0.95rem;
    transition: border 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #1DB954;
  }

  .search-input::placeholder {
    color: #666;
  }

  .search-clear {
    position: absolute;
    right: 1rem;
    color: #b3b3b3;
    cursor: pointer;
    font-weight: bold;
    transition: color 0.2s;
    background: none;
    border: none;
    padding: 0.25rem 0.5rem;
    font-size: 1.2rem;
  }

  .search-clear:hover {
    color: #fff;
  }

  .search-clear:focus {
    outline: none;
    color: #1DB954;
  }

  .no-results {
    text-align: center;
    color: #b3b3b3;
    padding: 2rem;
    font-style: italic;
  }
</style>

<div class="genres-container">
  {#if isLoading}
    <div class="loading-modal">
      <div class="loading-wheel"></div>
      <div class="loading-text">Creating your playlists...</div>
      <div class="loading-subtext">This may take a few moments</div>
      <div class="loading-subtext">If your playlist has a lot of songs it may take longer</div>
      <br><br>
      <div class="loading-subtext">Please do not close this window</div>
    </div>
  {/if}
  <h1>Select Genres</h1>
  <div class="search-container">
    <input
      type="text"
      class="search-input"
      placeholder="Search genres..."
      value={searchQuery}
      on:input={handleSearchInput}
    />
    {#if searchQuery}
      <button
        type="button"
        class="search-clear"
        on:click={() => { searchQuery = ''; filteredGenres = genres; }}
        aria-label="Clear search"
      >
        ✕
      </button>
    {/if}
  </div>
  {#if filteredGenres.length === 0}
    <div class="no-results">No genres match "{searchQuery}"</div>
  {/if}
  <div class="genres-grid">
    {#each filteredGenres as genre}
      <button
        class="genre-btn {selectedGenres.includes(genre) ? 'selected' : ''}"
        on:click={() => toggleGenre(genre)}
      >
        {genre}
      </button>
    {/each}
  </div>
  <div class="controls-section">
    <div style="margin-bottom:1.5rem;">
      <label>
        <input type="radio" bind:group={playlistMode} value="single" />
        Create one playlist with all selected genres
      </label>
      <br />
      <label>
        <input type="radio" bind:group={playlistMode} value="multiple" />
        Create a playlist for each selected genre
      </label>
    </div>
    <button class="continue-btn" on:click={handleContinue} disabled={selectedGenres.length === 0}>
      Continue
    </button>
  </div>
</div>
