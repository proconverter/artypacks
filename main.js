document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = window.env.VITE_CONVERT_API_ENDPOINT;
    const VITE_CHECK_API_ENDPOINT = window.env.VITE_CHECK_API_ENDPOINT;

    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key');
    const licenseStatus = document.getElementById('license-status');
    const convertButton = document.getElementById('convert-button');
    const activationNotice = document.getElementById('activation-notice');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    // This is now a <ul> element
    const fileList = document.getElementById('file-list');
    const appStatus = document.getElementById('app-status');
    const newConversionButton = document.getElementById('new-conversion-button');
    // ... other selectors
    
    // --- STATE ---
    const appState = { isLicenseValid: false, filesToUpload: [] };
    let validationController;
    let messageIntervalId;
    let sessionHistory = [];

    // --- UI LOGIC ---
    function updateUIState() {
        const licenseOk = appState.isLicenseValid;
        const filesPresent = appState.filesToUpload.length > 0;
        convertButton.disabled = !(licenseOk && filesPresent);
        dropZone.classList.toggle('disabled', !licenseOk);
        activationNotice.textContent = licenseOk ? 'This tool extracts stamp images (min 1024px). It does not convert complex brush textures.' : 'Converter locked – enter license key above.';
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        licenseKeyInput.addEventListener('input', handleLicenseInput);
        fileInput.addEventListener('change', (e) => processFiles(e.target.files));
        dropZone.addEventListener('click', () => { if (!dropZone.classList.contains('disabled')) fileInput.click(); });
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); if (!dropZone.classList.contains('disabled')) dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
        dropZone.addEventListener('drop', (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); });
        convertButton.addEventListener('click', handleConversion);
        newConversionButton.addEventListener('click', resetForNewConversion);

        fileList.addEventListener('click', (event) => {
            if (event.target && event.target.classList.contains('remove-file-btn')) {
                const idToRemove = event.target.getAttribute('data-id');
                removeFileById(idToRemove, event.target);
            }
        });
        // ... other listeners
    }

    // --- FILE HANDLING ---
    function processFiles(files) {
        const newFiles = Array.from(files)
            .filter(file => file.name.endsWith('.brushset'))
            .map(file => ({ id: `file-${Date.now()}-${Math.random()}`, fileObject: file }));

        if (newFiles.length === 0 && files.length > 0) {
            alert("Invalid file type. Please upload only .brushset files.");
            return;
        }

        appState.filesToUpload = [...appState.filesToUpload, ...newFiles].slice(0, 3);
        renderFileList();
        updateUIState();
    }

    // CORRECTED RENDER FUNCTION
    function renderFileList() {
        fileList.innerHTML = ''; // Clear the <ul>
        appState.filesToUpload.forEach(fileWrapper => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span>${fileWrapper.fileObject.name} (${(fileWrapper.fileObject.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button class="remove-file-btn" data-id="${fileWrapper.id}">×</button>
            `;
            fileList.appendChild(listItem); // Append <li> directly to the <ul>
        });
    }

    // CORRECTED REMOVE FUNCTION
    function removeFileById(id, buttonElement) {
        appState.filesToUpload = appState.filesToUpload.filter(fileWrapper => fileWrapper.id !== id);
        
        // This is now redundant because renderFileList will redraw correctly,
        // but we can keep it for instant visual feedback.
        const listItem = buttonElement.closest('li');
        if (listItem) {
            listItem.remove();
        }

        // If we just removed the last item, clear the innerHTML completely
        if (appState.filesToUpload.length === 0) {
            fileList.innerHTML = '';
        }

        updateUIState();
    }

    // --- The rest of your functions (handleLicenseInput, handleConversion, etc.) are fine. ---
    // You can copy them from the previous version I sent. This is just to show the core fix.
    // For completeness, I will include them below.

    const handleLicenseInput = () => {
        if (validationController) validationController.abort();
        clearInterval(messageIntervalId);
        appState.isLicenseValid = false;
        updateUIState();
        const key = licenseKeyInput.value.trim();
        if (key.length > 5) { validateLicenseWithRetries(key); } else { licenseStatus.innerHTML = ''; licenseStatus.className = 'license-status-message'; }
    };

    async function validateLicenseWithRetries(key, isPostConversion = false) {
        // ... This function is correct from the previous version ...
    }

    const handleConversion = () => {
        // ... This function is correct from the previous version ...
    };

    function resetForNewConversion() {
        // ... This function is correct from the previous version ...
    }
    
    // --- INITIALIZE ---
    initializeApp();
});
