<script>
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  onMount(() => {
    const timer = setTimeout(() => {
      goto('/created');
    }, 10000);
    return () => clearTimeout(timer);
  });
</script>

<style>
  .loading-container {
    background: #121212;
    padding: 2rem 2.5rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    width: 100%;
    max-width: 400px;
    margin: 6rem auto;
    color: #fff;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .loading-wheel {
    border: 8px solid #191414;
    border-top: 8px solid #1ed760;
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
    color: #fff;
    margin-bottom: 0.5rem;
  }
  .loading-subtext {
    color: #b3b3b3;
    font-size: 1rem;
    margin-bottom: 0.5rem;
  }
</style>

<div class="loading-container">
  <div class="loading-wheel"></div>
  <div class="loading-text">Creating your playlists...</div>
  <div class="loading-subtext">This may take a few moments</div>
  <div class="loading-subtext" style="color: #1ed760; font-weight: bold; font-size: 1.5rem;">🚨 TEST TEXT - If your playlist has a lot of songs it may take longer 🚨</div>
  <br><br>
  <div class="loading-subtext" style="color: #1ed760; font-weight: bold; font-size: 1.5rem;">🚨 TEST TEXT - Please do not close this window 🚨</div>
</div>
