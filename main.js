document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = window.env.VITE_CONVERT_API_ENDPOINT;
    const VITE_CHECK_API_ENDPOINT = window.env.VITE_CHECK_API_ENDPOINT;
    const ETSY_STORE_LINK = 'https://www.etsy.com/shop/artypacks';

    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key' );
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
    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    const currentYearSpan = document.getElementById('current-year');

    // --- STATE MANAGEMENT ---
    let uploadedFiles = [];
    let sessionHistory = [];
    let isLicenseValid = false;
    let validationController;
    let messageIntervalId;

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
        setupAccordion();
        setupContactForm();
    };

    const handleLicenseInput = () => {
        if (validationController) validationController.abort();
        clearInterval(messageIntervalId);
        isLicenseValid = false;
        checkLicenseAndToggleUI();
        const key = licenseKeyInput.value.trim();
        if (key.length > 5) {
            validateLicenseWithRetries(key);
        } else {
            licenseStatus.innerHTML = '';
            licenseStatus.className = 'license-status-message';
        }
    };

    // --- CREDIT MESSAGES ---
    const getCreditsMessage = (credits) => {
        if (credits > 0) {
            return `You have ${credits} conversion${credits === 1 ? '' : 's'} left.`;
        } else {
            return `You have no conversions left.`;
        }
    };

    // --- VALIDATION LOGIC ---
    async function validateLicenseWithRetries(key, isPostConversion = false) {
        validationController = new AbortController();
        const signal = validationController.signal;
        const coldStartMessages = ["Initializing connection...", "Waking up the servers...", "Establishing secure link...", "Authenticating...", "Just a moment...", "Checking credentials...", "Cross-referencing database...", "Almost there...", "Finalizing verification...", "Unlocking converter...", "Hold tight...", "Confirming details..."];
        let messageIndex = 0;

        if (!isPostConversion) {
            licenseStatus.className = 'license-status-message checking';
            const showNextMessage = () => { licenseStatus.innerHTML = coldStartMessages[messageIndex % coldStartMessages.length]; messageIndex++; };
            showNextMessage();
            messageIntervalId = setInterval(showNextMessage, 3000);
        }

        for (let attempt = 1; attempt <= 20; attempt++) {
            try {
                const response = await fetch(VITE_CHECK_API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ licenseKey: key }), signal });
                clearInterval(messageIntervalId);
                const result = await response.json();

                if (response.ok && result.isValid) {
                    isLicenseValid = true;
                    licenseStatus.className = 'license-status-message valid';
                    licenseStatus.innerHTML = getCreditsMessage(result.credits);
                } else {
                    isLicenseValid = false;
                    licenseStatus.className = 'license-status-message invalid';
                    if (result.message && result.message.includes("no conversions left")) {
                        licenseStatus.innerHTML = getCreditsMessage(0);
                    } else {
                        licenseStatus.innerHTML = result.message || 'Invalid license key.';
                    }
                }
                checkLicenseAndToggleUI();
                return;
            } catch (error) {
                if (signal.aborted) { clearInterval(messageIntervalId); return; }
                if (attempt === 20) {
                    clearInterval(messageIntervalId);
                    isLicenseValid = false;
                    licenseStatus.className = 'license-status-message invalid';
                    licenseStatus.innerHTML = 'Unable to connect to the validation server. Please try again in a minute.';
                    checkLicenseAndToggleUI();
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 2500));
            }
        }
    }

    // --- FILE HANDLING & UI ---
    const handleDrop = (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); };
    const handleFileSelect = (e) => processFiles(e.target.files);

    const checkLicenseAndToggleUI = () => {
        dropZone.classList.toggle('disabled', !isLicenseValid);
        dropZone.title = isLicenseValid ? '' : 'Please enter a valid license key to upload files.';
        convertButton.disabled = !(isLicenseValid && uploadedFiles.length > 0);
        if (isLicenseValid) {
            activationNotice.textContent = 'This tool extracts stamp images (min 1024px). It does not convert complex brush textures.';
        } else {
            activationNotice.textContent = 'Converter locked – enter license key above.';
        }
    };

    const processFiles = (files) => {
        resetStatusUI();
        let newFiles = Array.from(files).filter(file => file.name.endsWith('.brushset'));
        if (newFiles.length === 0 && files.length > 0) { alert("Invalid file type. Please upload only .brushset files."); return; }
        uploadedFiles = [...uploadedFiles, ...newFiles].slice(0, 3);
        updateFileList();
        checkLicenseAndToggleUI();
    };

    const updateFileList = () => {
        fileList.innerHTML = '';
        if (uploadedFiles.length === 0) return;
        const list = document.createElement('ul');
        list.className = 'file-list-container';
        
        uploadedFiles.forEach((file, index) => {
            const listItem = document.createElement('li');
            const textSpan = document.createElement('span');
            textSpan.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file-btn';
            removeBtn.title = 'Remove file';
            removeBtn.textContent = '×';
            removeBtn.setAttribute('data-index', index);

            listItem.appendChild(textSpan);
            listItem.appendChild(removeBtn);
            list.appendChild(listItem);
        });

        list.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('remove-file-btn')) {
                const indexToRemove = parseInt(e.target.getAttribute('data-index'), 10);
                removeFile(indexToRemove);
            }
        });

        fileList.appendChild(list);
    };

    // --- THIS IS THE FINAL, CORRECTED FUNCTION ---
    const removeFile = (index) => {
        uploadedFiles.splice(index, 1);
        // If the file list is now empty, reset the button text to its default state.
        if (uploadedFiles.length === 0) {
            convertButton.textContent = 'Convert Your Brushsets';
            // Also hide the status message area.
            appStatus.style.display = 'none';
            statusMessage.textContent = '';
        }
        updateFileList();
        checkLicenseAndToggleUI(); // This will correctly disable the button.
    };

    // --- CONVERSION PROCESS ---
    const handleConversion = () => {
        const licenseKey = licenseKeyInput.value.trim();
        if (!licenseKey || uploadedFiles.length === 0) return;

        resetStatusUI();
        appStatus.style.display = 'block';
        progressBar.style.display = 'block';
        convertButton.disabled = true;
        licenseKeyInput.disabled = true;
        dropZone.classList.add('disabled');

        const formData = new FormData();
        formData.append('licenseKey', licenseKey);
        uploadedFiles.forEach(file => { formData.append('files', file); });

        const xhr = new XMLHttpRequest();
        xhr.open('POST', VITE_CONVERT_API_ENDPOINT, true);
        xhr.upload.onprogress = (event) => { if (event.lengthComputable) { updateProgress(10 + (event.loaded / event.total) * 80, 'Uploading and converting...'); } };

        xhr.onload = async () => {
            licenseKeyInput.disabled = false;
            try {
                const result = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    progressBar.style.display = 'none';
                    const tempLink = document.createElement('a');
                    tempLink.href = result.downloadUrl;
                    tempLink.setAttribute('download', '');
                    document.body.appendChild(tempLink);
                    tempLink.click();
                    document.body.removeChild(tempLink);
                    sessionHistory.unshift({ sourceFiles: uploadedFiles.map(f => f.name) });
                    updateHistoryList();
                    await validateLicenseWithRetries(licenseKey, true);
                    
                    if (isLicenseValid) {
                        updateProgress(100, 'Download success! Please remove the old files before starting a new conversion.');
                        convertButton.textContent = 'Convert New Files';
                        // After a successful conversion, the button should remain active
                        // to invite the user to upload new files for the next conversion.
                        convertButton.disabled = false; 
                    } else {
                        updateProgress(100, 'Final conversion successful!');
                        // If there are no credits left, the button will be disabled by checkLicenseAndToggleUI.
                    }

                } else {
                    showError(result.message || 'An unknown error occurred.');
                    await validateLicenseWithRetries(licenseKey);
                }
            } catch (e) {
                showError('An unexpected server response was received.');
                checkLicenseAndToggleUI();
            }
        };

        xhr.onerror = () => { showError('A network error occurred. Please check your connection and try again.'); licenseKeyInput.disabled = false; checkLicenseAndToggleUI(); };
        updateProgress(10, 'Validating and preparing upload...');
        xhr.send(formData);
    };

    // --- HELPER FUNCTIONS ---
    const updateProgress = (percentage, message) => { progressFill.style.width = `${percentage}%`; statusMessage.textContent = message;
