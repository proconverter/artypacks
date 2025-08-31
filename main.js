document.addEventListener('DOMContentLoaded', () => {
    const licenseKeyInput = document.getElementById('license-key');
    const licenseStatus = document.getElementById('license-status');
    
    // --- THIS IS THE CRITICAL CHANGE ---
    // We are hardcoding the URL to bypass any environment variable issues.
    const HARDCODED_CHECK_API_ENDPOINT = 'https://artypacks-converter-backend-SANDBOX.onrender.com/check-license';

    console.log("HARDCODED URL TEST SCRIPT LOADED." );
    console.log("Endpoint being used:", HARDCODED_CHECK_API_ENDPOINT);

    const handleLicenseInput = async () => {
        const key = licenseKeyInput.value.trim();
        if (key.length < 6) {
            licenseStatus.innerHTML = '';
            return;
        }

        licenseStatus.className = 'license-status-message';
        licenseStatus.innerHTML = 'Checking with hardcoded URL...';

        try {
            const response = await fetch(HARDCODED_CHECK_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: key })
            });

            const result = await response.json();

            if (response.ok && result.isValid) {
                licenseStatus.className = 'license-status-message valid';
                licenseStatus.innerHTML = `HARDCODED URL SUCCESS! Credits: ${result.credits}`;
            } else {
                licenseStatus.className = 'license-status-message invalid';
                licenseStatus.innerHTML = `Request sent, but failed: ${result.message || 'Invalid key.'}`;
            }
        } catch (error) {
            console.error("HARDCODED FETCH FAILED:", error);
            licenseStatus.className = 'license-status-message invalid';
            licenseStatus.innerHTML = `CRITICAL ERROR: Could not connect even with a hardcoded URL. This points to a CORS or backend issue.`;
        }
    };

    licenseKeyInput.addEventListener('input', handleLicenseInput);
});
