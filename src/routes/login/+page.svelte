<script lang="ts">
	import { onMount } from 'svelte';

	const clientId = '0e612a7fd5544773bb7f69ba48861721';
	
	const ghRepo = 'SpotifyPlaylistSorter';

	// Fixed redirect URIs - add both to your Spotify app settings
	const getRedirectUri = () => {
		if (typeof window === 'undefined') return 'http://127.0.0.1:5173/callback';
		
		// Local development
		if (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') {
			return 'http://127.0.0.1:5173/callback';
		}
		
		// GitHub Pages production - update 'yourusername' with your GitHub username
		if (window.location.hostname.endsWith('.github.io')) {
			return `https://${window.location.hostname}/${ghRepo}/callback`;
		}
		
		// Fallback (shouldn't be used)
		return 'http://127.0.0.1:5173/callback';
	};

	// Canonicalize dev host to 127.0.0.1 so PKCE storage and redirect origins match
	onMount(() => {
		if (window.location.hostname === 'localhost') {
			const url = new URL(window.location.href);
			url.hostname = '127.0.0.1';
			window.location.replace(url.toString());
		}
	});
	const scopes = [
		'playlist-read-private',
		'playlist-read-collaborative',
		'user-read-email',
		'user-read-private',
		'playlist-modify-public',
		'playlist-modify-private',
		'user-library-read'
	];

	// PKCE helper functions
	function generateCodeVerifier() {
		const array = new Uint8Array(32);
		crypto.getRandomValues(array);
		return btoa(String.fromCharCode(...(Array.from(array) as number[])))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	}

	async function generateCodeChallenge(verifier: string) {
		const encoder = new TextEncoder();
		const data = encoder.encode(verifier);
		const digest = await crypto.subtle.digest('SHA-256', data);
		return btoa(String.fromCharCode(...(Array.from(new Uint8Array(digest)) as number[])))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=/g, '');
	}

	async function loginWithSpotify() {
		// Generate parameters
		const codeVerifier = generateCodeVerifier();
		const codeChallenge = await generateCodeChallenge(codeVerifier);
		
		// Store code verifier for later use in callback
		localStorage.setItem('spotify_code_verifier', codeVerifier);
		
		// Build authorization URL
		const redirectUri = getRedirectUri();
		console.log('Using redirect URI:', redirectUri);
		console.log('Make sure this EXACT URI is added in your Spotify app settings:');
		console.log('  1. Go to https://developer.spotify.com/dashboard');
		console.log('  2. Click your app');
		console.log('  3. Edit Settings > Redirect URIs');
		console.log('  4. Add:', redirectUri);
		
		const authUrl =
			`https://accounts.spotify.com/authorize?` +
			`client_id=${clientId}` +
			`&response_type=code` +
			`&redirect_uri=${encodeURIComponent(redirectUri)}` +
			`&scope=${encodeURIComponent(scopes.join(' '))}` +
			`&code_challenge_method=S256` +
			`&code_challenge=${codeChallenge}`;
		
		window.location.href = authUrl;
	}
</script>

<style>
	:global(body) {
		background: #191414;
		color: #fff;
		font-family: Arial, sans-serif;
		min-height: 100vh;
		margin: 0;
	}
	.login-container {
		background: #121212;
		padding: 2rem 2.5rem;
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0,0,0,0.5);
		width: 100%;
		max-width: 350px;
		margin: 4rem auto;
	}
	h2 {
		margin-bottom: 1.5rem;
		text-align: center;
		color: #1DB954;
		font-weight: 700;
		letter-spacing: 1px;
	}
	button {
		width: 100%;
		padding: 0.75rem;
		background: #1DB954;
		color: #fff;
		border: none;
		border-radius: 4px;
		font-size: 1rem;
		cursor: pointer;
		font-weight: 600;
		letter-spacing: 1px;
		transition: background 0.2s;
	}
	button:hover {
		background: #1ed760;
	}
</style>

<div class="login-container">
	<h2>Log in with Spotify</h2>
	<button on:click={loginWithSpotify} style="margin-top:2rem;">
		<svg width="24" height="24" viewBox="0 0 168 168" style="vertical-align:middle;margin-right:8px;"><circle fill="#1DB954" cx="84" cy="84" r="84"/><path fill="#fff" d="M119.7 122.9c-1.5 2.5-4.7 3.3-7.2 1.8-19.7-12-44.6-14.7-73.7-8.1-2.8.6-5.5-1.2-6.1-4-0.6-2.8 1.2-5.5 4-6.1 31.2-7 58.2-4 79.5 9.1 2.5 1.5 3.3 4.7 1.8 7.3zm9.2-20.2c-1.9 3-5.8 3.9-8.8 2-22.6-13.8-57.1-17.8-83.8-9.8-3.3 1-6.7-0.9-7.7-4.2-1-3.3 0.9-6.7 4.2-7.7 29.6-8.7 66.2-4.3 91.2 11.1 3 1.9 3.9 5.8 2 8.6zm10.2-21.2c-2.3 3.7-7.1 4.8-10.8 2.5-26-15.9-68.2-17.4-92.2-9.6-3.9 1.2-8-1-9.2-4.9-1.2-3.9 1-8 4.9-9.2 27.1-8.4 73.1-6.7 102.2 11.1 3.7 2.3 4.8 7.1 2.5 10.1z"/></svg>
		Log in with Spotify
	</button>
</div>
