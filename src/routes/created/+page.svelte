<div class="created-container">
  <h1>Created Playlists</h1>
  {#if loading}
    <div style="text-align:center; margin:2rem;">
      <div class="loading-wheel" style="border:8px solid #191414; border-top:8px solid #1DB954; border-radius:50%; width:80px; height:80px; animation:spin 1s linear infinite; margin:auto;"></div>
      <div style="margin-top:1rem; color:#b3b3b3;">Loading playlists...</div>
    </div>
  {:else if error}
    <div style="color:#e74c3c; text-align:center; margin:2rem;">{error}</div>
  {:else if createdPlaylists.length === 0}
    <div style="color:#b3b3b3; text-align:center; margin:2rem;">No playlists found.</div>
  {:else}
    <div class="created-grid">
      {#each createdPlaylists as playlist}
        <div class="created-card">
          <img class="created-image" src={playlist.image} alt={playlist.name} />
          <div class="created-title">{playlist.name}</div>
          <div class="created-tracks">{playlist.tracks} tracks</div>
        </div>
      {/each}
    </div>
  {/if}
  <a href="{base}/home" class="home-btn">Return to Home</a>
</div>

<script lang="ts">
  import { base } from '$app/paths';
  import { toApi } from '$lib/api';
  // Load created playlists from localStorage and fetch details from Spotify
  interface Playlist {
    id: string;
    name: string;
    image: string;
    tracks: number;
  }
  let createdPlaylists: Playlist[] = [];
  let loading = true;
  let error = '';

  async function fetchCreatedPlaylists() {
    if (typeof window === 'undefined') return;
    // Wait 2 seconds to allow Spotify to process track additions
    await new Promise(resolve => setTimeout(resolve, 2000));
    const stored = localStorage.getItem('created_playlist');
    const token = localStorage.getItem('spotify_access_token');
    if (stored && token) {
      let playlists = JSON.parse(stored);
      if (!Array.isArray(playlists)) playlists = [playlists];
      let results = [];
      for (const playlist of playlists) {
        try {
          const res = await fetch(toApi(`playlists/${playlist.id}`), {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          results.push({
            id: data.id,
            name: data.name,
            image: (data.images && data.images[0]) ? data.images[0].url : '',
            tracks: data.tracks.total
          });
        } catch (e: unknown) {
          error = 'Error fetching playlist details.';
        }
      }
      createdPlaylists = results;
    }
    loading = false;
  }

  import { onMount } from 'svelte';
  onMount(fetchCreatedPlaylists);
</script>

<style>
  .created-container {
    background: #121212;
    padding: 2rem 2.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    width: 100%;
    max-width: 900px;
    margin: 4rem auto;
    color: #fff;
  }
  h1 {
    color: #1DB954;
    font-size: 2rem;
    font-weight: 700;
    margin-bottom: 2rem;
    text-align: center;
    letter-spacing: 1px;
  }
  .created-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 2rem;
    padding: 0;
    margin: 0;
  }
  .created-card {
    background: #191414;
    border-radius: 8px;
    box-shadow: 0 1px 8px rgba(0,0,0,0.3);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1rem 1rem 1rem;
    transition: transform 0.15s;
    cursor: pointer;
  }
  .created-card:hover {
    transform: scale(1.04);
    box-shadow: 0 4px 16px rgba(29,185,84,0.2);
  }
  .created-image {
    width: 140px;
    height: 140px;
    object-fit: cover;
    border-radius: 8px;
    margin-bottom: 1rem;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .created-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #fff;
    margin-bottom: 0.5rem;
    text-align: center;
  }
  .created-tracks {
    color: #b3b3b3;
    font-size: 0.95rem;
    font-weight: 500;
    margin-bottom: 1rem;
  }
  .home-btn {
    display: block;
    margin: 2rem auto 0 auto;
    background: #1DB954;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 1.1rem;
    font-weight: 600;
    padding: 0.75rem 2rem;
    cursor: pointer;
    transition: background 0.2s;
    text-align: center;
    letter-spacing: 1px;
    text-decoration: none;
  }
  .home-btn:hover {
    background: #1ed760;
  }
</style>


