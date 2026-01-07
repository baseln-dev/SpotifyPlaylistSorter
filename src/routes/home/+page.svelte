<script>
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  
  let isLoggedIn = false;
  
  onMount(() => {
    isLoggedIn = !!localStorage.getItem('spotify_access_token');
  });
</script>

<style>
  .home-container {
    background: #121212;
    padding: 2rem 2.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    width: 100%;
    max-width: 500px;
    margin: 4rem auto;
    text-align: center;
  }
  h1 {
    color: #1DB954;
    font-size: 2.5rem;
    font-weight: 700;
    margin-bottom: 1rem;
    letter-spacing: 1px;
  }
  p {
    color: #fff;
    font-size: 1.2rem;
    margin-bottom: 2rem;
  }
  a {
    color: #1DB954;
    font-weight: 600;
    text-decoration: none;
    transition: color 0.2s;
  }
  a:hover {
    color: #1ed760;
  }
  .start-btn {
    display: block;
    margin: 2rem auto 0 auto;
    background: #1DB954;
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 1.2rem;
    font-weight: 700;
    padding: 1rem 2.5rem;
    cursor: pointer;
    transition: background 0.2s;
    text-align: center;
    letter-spacing: 1px;
    text-decoration: none;
  }
  .start-btn:hover {
    background: #1ed760;
  }
</style>

<div class="home-container">
  <h1>Spotify Playlist Sorter</h1>
  <p>Sort your spotify playlists by genre</p>
  {#if !isLoggedIn}
    <a class="start-btn" href="{base}/login">Log in with Spotify</a>
  {:else}
    <a class="start-btn" href="{base}/playlists">Start Sorting</a>
  {/if}
</div>
