/** Opens company management, with the original founding preview still available. */
const preview = new URLSearchParams(location.search).get('preview') === '1';
if (preview) void import('./preview');
else void import('./company/app');
