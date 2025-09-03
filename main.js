document.addEventListener('DOMContentLoaded', () => {
    // --- AGGRESSIVE DEBUGGING LOGGER ---
    const logger = (source, message, data = null) => {
        console.log(`[DEBUGGER | ${new Date().toLocaleTimeString()}] --- ${source} ---`);
        console.log(message);
        if (data) {
            // Use console.table for arrays of objects for better readability
            if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
                console.table(data);
            } else {
                console.log('Data:', JSON.parse(JSON.stringify(data)));
            }
        }
        console.log('--- END OF LOG ---');
    };

    logger('initializeApp', 'Application is starting. Attaching event listeners.');

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
    const fileList = document.getElementById('file-list');
    const appStatus = document.getElementById('app-status');
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const statusMessage = document.getElementById('status-message');
    const newConversionButton = document.getElementById('new-conversion-button');

    // --- STATE MANAGEMENT ---
    const appState = {
        isLicenseValid: false,
        filesToUpload: []
    };
    logger('StateInit', 'Initial application state has been set.', appState);

    // --- CORE UI LOGIC ---
    function updateUIState() {
        logger('updateUIState', 'Function called. About to check conditions and update UI.');
        
        const licenseOk = appState.isLicenseValid;
        const filesPresent = appState.filesToUpload.length > 0;

        logger('updateUIState', `Checking conditions: isLicenseValid = ${licenseOk}, filesToUpload.length = ${appState.filesToUpload.length} (filesPresent = ${filesPresent})`);
        
        const shouldButtonBeEnabled = licenseOk && filesPresent;
        logger('updateUIState', `Decision: Button should be enabled = ${shouldButtonBeEnabled}.`);

        convertButton.disabled = !shouldButtonBeEnabled;
        logger('updateUIState', `Action: Set convertButton.disabled to ${!shouldButtonBeEnabled}.`);

        dropZone.classList.toggle('disabled', !licenseOk);
    }

    // --- INITIALIZATION ---
    const initializeApp = () => {
        document.getElementById('current-year').textContent = new Date().getFullYear();
        setupEventListeners();
        updateUIState();
    };

    // --- EVENT LISTENERS ---
    const setupEventListeners = () => {
        licenseKeyInput.addEventListener('input', handleLicenseInput);
        dropZone.addEventListener('click', () => { if (!dropZone.classList.contains('disabled')) fileInput.click(); });
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); if (!dropZone.classList.contains('disabled')) dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
        dropZone.addEventListener('drop', handleDrop);
        fileInput.addEventListener('change', handleFileSelect);
        convertButton.addEventListener('click', handleConversion);
        newConversionButton.addEventListener('click', resetForNewConversion);

        fileList.addEventListener('click', (event) => {
            if (event.target && event.target.classList.contains('remove-file-btn')) {
                const idToRemove = event.target.getAttribute('data-id');
                logger('EventListener', `Remove button clicked for file ID: ${idToRemove}.`);
                removeFileById(idToRemove);
            }
        });
        
        // Other listeners...
        document.querySelectorAll('.accordion-question, .footer-accordion-trigger').forEach(trigger => { trigger.addEventListener('click', () => { const item = trigger.closest('.accordion-item, .footer-accordion-item, .footer-main-line'); if (item) item.classList.toggle('open'); }); });
    };

    // --- STATE-MODIFYING FUNCTIONS ---
    const handleLicenseInput = () => {
        // Simplified for brevity in this debug version
        const key = licenseKeyInput.value.trim();
        if (key.length > 5) {
            logger('handleLicenseInput', 'License key is valid length. Simulating successful validation.');
            appState.isLicenseValid = true;
            licenseStatus.innerHTML = 'Debug Mode: License assumed valid.';
            licenseStatus.className = 'license-status-message valid';
        } else {
            appState.isLicenseValid = false;
            licenseStatus.innerHTML = '';
        }
        updateUIState();
    };

    const handleDrop = (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); };
    const handleFileSelect = (e) => {
        logger('handleFileSelect', 'File input "change" event fired.');
        processFiles(e.target.files);
    };

    const processFiles = (files) => {
        logger('processFiles', 'Function called.', { receivedFiles: files.length });
        let newFiles = Array.from(files)
            .filter(file => file.name.endsWith('.brushset'))
            .map(file => ({ id: `file-${Date.now()}-${Math.random()}`, fileObject: file }));
        
        logger('processFiles', `Filtered for .brushset files. Found ${newFiles.length}.`);

        appState.filesToUpload = [...appState.filesToUpload, ...newFiles].slice(0, 3);
        logger('processFiles', 'State updated with new files. Current state:', appState);

        renderFileList();
        updateUIState();

        logger('processFiles', 'Resetting file input value to null.');
        fileInput.value = null;
    };

    const removeFileById = (id) => {
        logger('removeFileById', `Function called to remove ID: ${id}.`);
        logger('removeFileById', 'State BEFORE removal:', appState);

        appState.filesToUpload = appState.filesToUpload.filter(fileWrapper => fileWrapper.id !== id);
        
        logger('removeFileById', 'State AFTER removal:', appState);

        renderFileList();
        updateUIState();
    };

    const renderFileList = () => {
        logger('renderFileList', 'Function called. Clearing and re-rendering file list.');
        fileList.innerHTML = '';
        appState.filesToUpload.forEach(fileWrapper => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span>${fileWrapper.fileObject.name}</span><button class="remove-file-btn" data-id="${fileWrapper.id}">×</button>`;
            fileList.appendChild(listItem);
        });
        logger('renderFileList', `Render complete. ${appState.filesToUpload.length} items drawn to the DOM.`);
    };
    
    // --- OTHER FUNCTIONS (Simplified/Omitted for Debugging) ---
    const handleConversion = () => alert('Conversion logic disabled in debug mode.');
    const resetForNewConversion = () => location.reload();

    // --- START THE APP ---
    initializeApp();
});
