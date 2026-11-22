/** Opens the Big Order journey by default, keeping preview and checkpoint entry points reachable. */
const params = new URLSearchParams(location.search);
if (params.get('preview') === '1') void import('./preview');
else if (params.get('checkpoint') === '1') void import('./company/app');
else void import('./journey/app');
