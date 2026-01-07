<script>
	import { goto } from '$app/navigation';
	import { base } from '$app/paths';
	if (typeof window !== 'undefined') {
		goto(`${base}/home`);
	}
</script>
