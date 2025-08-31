const replace = require('replace-in-file');

const options = {
  files: 'index.html',
  from: [
    /VITE_SUPABASE_URL_PLACEHOLDER/g,
    /VITE_SUPABASE_ANON_KEY_PLACEHOLDER/g,
    /VITE_CONVERT_API_ENDPOINT_PLACEHOLDER/g,
    /VITE_CHECK_API_ENDPOINT_PLACEHOLDER/g
  ],
  to: [
    process.env.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_ANON_KEY,
    process.env.VITE_CONVERT_API_ENDPOINT,
    process.env.VITE_CHECK_API_ENDPOINT
  ],
};

(async () => {
  try {
    const results = await replace(options);
    console.log('Replacement results:', results);
  } catch (error) {
    console.error('Error occurred during replacement:', error);
    process.exit(1); // Exit with an error code
  }
})();
