<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';

  const clientId = '0e612a7fd5544773bb7f69ba48861721';
  const ghRepo = 'SpotifyPlaylistSorter';
  
  // Fixed redirect URIs - must match login page
  const getRedirectUri = () => {
    if (typeof window === 'undefined') return 'http://127.0.0.1:5173/callback';
    
    // Local development
    if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
      return 'http://127.0.0.1:5173/callback';
    }
    
    // GitHub Pages production
    if (window.location.hostname.endsWith('.github.io')) {
      return `https://${window.location.hostname}/${ghRepo}/callback`;
    }
    
    // Fallback
    return 'http://127.0.0.1:5173/callback';
  };

  async function exchangeCodeForToken(code: string) {
    try {
      console.log('Exchanging code for token with PKCE...');
      
      // Get the code verifier we stored during login
      const codeVerifier = localStorage.getItem('spotify_code_verifier');
      if (!codeVerifier) {
        throw new Error('No code verifier found');
      }

      // Exchange code for token using PKCE
      const response = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: getRedirectUri(),
          client_id: clientId,
          code_verifier: codeVerifier
        })
      });

      const data = await response.json();
      console.log('Token exchange response:', data);
      
      if (data.access_token) {
        // Store tokens
        localStorage.setItem('spotify_access_token', data.access_token);
        if (data.refresh_token) {
          localStorage.setItem('spotify_refresh_token', data.refresh_token);
        }
        
        // Clean up code verifier
        localStorage.removeItem('spotify_code_verifier');
        
        // Check if this was for a delete operation
        const deleteAuthRequired = localStorage.getItem('delete_auth_required');
        if (deleteAuthRequired) {
          localStorage.removeItem('delete_auth_required');
          goto(`${base}/playlists`);
        } else {
          goto(`${base}/playlists`);
        }
      } else {
        console.error('No access token in response:', data);
        alert(`Spotify login failed: ${data.error_description || data.error || 'No access token received'}`);
        goto(`${base}/login`);
      }
    } catch (err: unknown) {
      console.error('Token exchange error:', err);
      const message = err instanceof Error ? err.message : String(err);
      alert(`Spotify login failed: ${message}`);
      goto(`${base}/login`);
    }
  }

  onMount(() => {
    if (window.location.hostname === 'localhost') {
      const url = new URL(window.location.href);
      url.hostname = '127.0.0.1';
      window.location.replace(url.toString());
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    
    if (error) {
      console.error('Spotify OAuth error:', error);
      alert(`Spotify login failed: ${error}`);
      goto(`${base}/login`);
      return;
    }
    
    if (code) {
      exchangeCodeForToken(code);
    } else {
      alert('Spotify login failed. No code found.');
      goto(`${base}/login`);
    }
  });
</script>

<style>
  .callback-container {
    background: #121212;
    color: #fff;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    max-width: 400px;
    margin: 6rem auto;
    text-align: center;
  }
</style>

<div class="callback-container">
  <h2>Logging in with Spotify...</h2>
  <p>Please wait while we process your login.</p>
</div>
