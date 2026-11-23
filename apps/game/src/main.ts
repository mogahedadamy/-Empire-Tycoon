/** Opens the Big Order journey by default, keeping preview and checkpoint entry points reachable. */
const params = new URLSearchParams(location.search);
if (params.get('preview') === '1') void import('./preview');
else if (params.get('checkpoint') === '1') void import('./company/app');
else if (params.get('playbook') === '1') void import('./journey/playbook-app');
else if (params.get('industry') === 'ai') void import('./ai/app');
else if (params.has('industry')) void import('./projects/app');
else void import('./journey/app');
