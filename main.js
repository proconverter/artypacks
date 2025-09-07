document.addEventListener('DOMContentLoaded', ( ) => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = "https://artypacks-converter-backend-sandbox.onrender.com/convert";
    const VITE_CHECK_API_ENDPOINT = "https://artypacks-converter-backend-sandbox.onrender.com/check-license";
    const VITE_RECOVER_API_ENDPOINT = "https://artypacks-converter-backend-sandbox.onrender.com/recover-link";
    const ETSY_STORE_LINK = 'https://www.etsy.com/shop/artypacks';
    const MAX_BATCH_SIZE = 10;

    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key'  );
    const licenseStatus = document.getElementById('license-status');
    const getLicenseLinkContainer = document.querySelector('.get-license-link');
    const convertButton = document.getElementById('convert-button');
    const activationNotice = document.getElementById('activation-notice');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const appStatus = document.getElementById('app-status');
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const statusMessage = document.getElementById('status-message');
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    const currentYearSpan = document.getElementById('current-year');
    const appTool = document.getElementById('app-tool');
    const downloadView = document.getElementById('download-view');
    const downloadFilename = document.getElementById('download-filename');
    const downloadFileButton = document.getElementById('download-file-button');
    const convertAnotherButton = document.getElementById('convert-another-button');
    // New v2.0 selectors
    const dropZoneText = document.getElementById('drop-zone-text');
    const dropZoneLimits = document.getElementById('drop-zone-limits');
    const dropZoneError = document.getElementById('drop-zone-error');


    // --- STATE MANAGEMENT (v2.0) ---
    let uploadedFile = null; // Will become an array for multi-credit users
    let isLicenseValid = false;
    let creditsRemaining = 0;
    let userType = 'none'; // 'none', 'single_credit', or 'multi_credit'
    let validationController;
    let messageIntervalId;
    let isFileConverted = false;

    // --- INITIALIZATION ---
    const initializeApp = () => {
        if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
        setupEventListeners();
        checkLicenseAndToggleUI();
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
        convertAnotherButton.addEventListener('click', resetApp);
        setupAccordion();
        setupContactForm();
    };

    const handleLicenseInput = () => {
        if (validationController) validationController.abort();
        clearInterval(messageIntervalId);
        // Reset state
        isLicenseValid = false;
        creditsRemaining = 0;
        userType = 'none';
        checkLicenseAndToggleUI();
        const key = licenseKeyInput.value.trim();
        if (key.length > 5) {
            validateLicenseWithRetries(key);
        } else {
            licenseStatus.innerHTML = '';
            licenseStatus.className = 'license-status-message';
        }
    };

    const getCreditsMessage = (credits) => {
        if (credits > 0) {
            return `Credit is valid. You're ready to convert!`;
        } else {
            return `This license has been used. <a href="${ETSY_STORE_LINK}" target="_blank">Get a new one to convert another file.</a>`;
        }
    };

    async function validateLicenseWithRetries(key) {
        validationController = new AbortController();
        const signal = validationController.signal;

        const coldStartMessages = ["Initializing connection...", "Waking up the servers...", "Establishing secure link...", "Authenticating...", "Just a moment..."];
        let messageIndex = 0;
        licenseStatus.className = 'license-status-message checking';
        const showNextMessage = () => {
            licenseStatus.innerHTML = coldStartMessages[messageIndex % coldStartMessages.length];
            messageIndex++;
        };
        showNextMessage();
        messageIntervalId = setInterval(showNextMessage, 3000);

        try {
            const response = await fetch(VITE_CHECK_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: key }),
                signal
            });

            clearInterval(messageIntervalId);
            const result = await response.json();

            if (response.ok && result.isValid) {
                isLicenseValid = true;
                creditsRemaining = result.sessions_remaining;
                userType = result.user_type; // Store the user type
                licenseStatus.className = 'license-status-message valid';
                licenseStatus.innerHTML = getCreditsMessage(creditsRemaining);

                if (creditsRemaining <= 0) {
                    // Magic Link Recovery (no changes needed here)
                }
            } else {
                isLicenseValid = false;
                creditsRemaining = 0;
                userType = 'none';
                licenseStatus.className = 'license-status-message invalid';
                licenseStatus.innerHTML = result.message || 'Invalid license key.';
            }
        } catch (error) {
            if (signal.aborted) return;
            clearInterval(messageIntervalId);
            isLicenseValid = false;
            creditsRemaining = 0;
            userType = 'none';
            licenseStatus.className = 'license-status-message invalid';
            licenseStatus.textContent = 'Unable to connect. Please try again in a minute.';
        } finally {
            checkLicenseAndToggleUI();
        }
    }

    const handleDrop = (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); };
    const handleFileSelect = (e) => processFiles(e.target.files);

    // ==================================================================
    // THIS IS THE CORE V2.0 UI LOGIC
    // ==================================================================
    const checkLicenseAndToggleUI = () => {
        // Hide any previous error messages
        dropZoneError.style.display = 'none';
        dropZoneError.textContent = '';

        const isDropZoneLocked = !isLicenseValid || creditsRemaining <= 0 || !!uploadedFile;
        dropZone.classList.toggle('disabled', isDropZoneLocked);
        
        // Configure Drop Zone based on userType
        if (userType === 'single_credit') {
            fileInput.removeAttribute('multiple');
            dropZoneText.innerHTML = '<strong>Drop a single .brushset file here</strong>';
            dropZoneLimits.textContent = 'or click to upload (1 credit will be used)';
        } else if (userType === 'multi_credit') {
            fileInput.setAttribute('multiple', true);
            dropZoneText.innerHTML = '<strong>Drop up to 10 .brushset files here</strong>';
            dropZoneLimits.textContent = `or click to upload (You have ${creditsRemaining} credits remaining)`;
        } else { // 'none' or default state
            fileInput.removeAttribute('multiple');
            dropZoneText.innerHTML = '<strong>Drag & drop your Procreate file here</strong>';
            dropZoneLimits.textContent = 'or click to upload';
        }

        const canConvert = isLicenseValid && creditsRemaining > 0 && uploadedFile && !isFileConverted;
        convertButton.disabled = !canConvert;
        activationNotice.style.display = canConvert ? 'none' : 'block';
    };

    const processFiles = (files) => {
        // Clear previous errors
        dropZoneError.style.display = 'none';

        // Single Credit User Logic
        if (userType === 'single_credit') {
            if (files.length > 1) {
                dropZoneError.textContent = 'Error: Please upload only one file at a time with a single-credit license.';
                dropZoneError.style.display = 'block';
                return;
            }
            const file = files[0];
            if (file && file.name.endsWith('.brushset')) {
                uploadedFile = file; // For single user, it's an object
                updateFileList();
            }
        } 
        // Multi-Credit User Logic
        else if (userType === 'multi_credit') {
            if (files.length > MAX_BATCH_SIZE) {
                dropZoneError.textContent = `Error: You can convert a maximum of ${MAX_BATCH_SIZE} files at a time.`;
                dropZoneError.style.display = 'block';
                return;
            }
            if (files.length > creditsRemaining) {
                dropZoneError.textContent = `Error: You have selected ${files.length} files but only have ${creditsRemaining} credits remaining.`;
                dropZoneError.style.display = 'block';
                return;
            }
            // For multi-user, uploadedFile will be an array
            uploadedFile = Array.from(files).filter(f => f.name.endsWith('.brushset'));
            updateFileList(); // This function will need to be updated for arrays
        }
        
        checkLicenseAndToggleUI();
    };

    // This function needs updating for v2.0, but for now, it will work for the single-file case
    const updateFileList = () => {
        fileList.innerHTML = '';
        if (!uploadedFile) {
            fileList.classList.add('hidden');
            return;
        }
        
        fileList.classList.remove('hidden');
        
        // Handle both single file (object) and multiple files (array)
        const filesToShow = Array.isArray(uploadedFile) ? uploadedFile : [uploadedFile];

        filesToShow.forEach(file => {
            const listItem = document.createElement('li');
            const fileSize = (file.size / 1024 / 1024).toFixed(2);
            listItem.innerHTML = `<span>${file.name} (${fileSize} MB)</span>`;
            // In a real v2.0, the remove button would need to handle arrays
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'Remove file';
            removeBtn.onclick = () => removeFile(); // This will clear all files for now
            listItem.appendChild(removeBtn);
            fileList.appendChild(listItem);
        });
    };

    const removeFile = () => {
        uploadedFile = null;
        isFileConverted = false;
        fileInput.value = '';
        updateFileList();
        resetStatusUI();
        checkLicenseAndToggleUI();
    };

    // The rest of the file (handleConversion, showDownloadView, etc.) remains the same for now
    // as we are only implementing the dynamic drop zone in this step.
    // The conversion logic will need to be updated later to handle a queue.
    
    // [ ... The rest of your main.js file from the last working version ... ]
    // (handleConversion, showDownloadView, resetApp, etc.)
    const handleConversion = () => { /* ... */ };
    const showDownloadView = (url, filename) => { /* ... */ };
    const resetApp = () => { /* ... */ };
    const updateProgress = (percentage, message) => { /* ... */ };
    const showError = (message) => { /* ... */ };
    const resetStatusUI = () => { /* ... */ };
    const setupAccordion = () => { /* ... */ };
    const setupContactForm = () => { /* ... */ };

    initializeApp();
});
