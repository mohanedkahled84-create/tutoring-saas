// CI preload: even a mistakenly hardcoded production URL cannot receive a test.
const originalFetch = globalThis.fetch;
const testRef = process.env.SUPABASE_TEST_PROJECT_REF;
const productionRef = process.env.SUPABASE_PRODUCTION_PROJECT_REF || 'ofaraxqrpcdiregxjyyb';
const testUrl = process.env.SUPABASE_TEST_URL;
if (!testRef || testRef === productionRef || !testUrl || new URL(testUrl).hostname !== `${testRef}.supabase.co`) {
  throw new Error('Test network guard requires an explicitly isolated Supabase project');
}
globalThis.fetch = function guardedFetch(input, options) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!['localhost', '127.0.0.1', '[::1]', `${testRef}.supabase.co`].includes(url.hostname)) {
    throw new Error(`TEST_NETWORK_BLOCKED: ${url.hostname}`);
  }
  return originalFetch(input, options);
};
