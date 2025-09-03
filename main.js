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
    const fileListContainer = document.getElementById('file-list');
    const appStatus = document.getElementById('app-status');
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const statusMessage = document.getElementById('status-message');
    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    const currentYearSpan = document.getElementById('current-year');

    // --- STATE MANAGEMENT ---
    const appState = {
        isLicenseValid: false,
        filesToUpload: [] // Will now store objects like { id, fileObject }
    };
    let validationController;
    let messageIntervalId;

    // --- CORE UI LOGIC ---
    function updateUIState() {
        const licenseOk = appState.isLicenseValid;
        const filesPresent = appState.filesToUpload.length > 0;
        convertButton.disabled = !(licenseOk && filesPresent);
        dropZone.classList.toggle('disabled', !licenseOk);
        dropZone.title = licenseOk ? '' : 'Please enter a valid license key to upload files.';
        if (licenseOk) {
            activationNotice.textContent = 'This tool extracts stamp images (min 1024px). It does not convert complex brush textures.';
        } else {
            activationNotice.textContent = 'Converter locked – enter license key above.';
        }
    }

    // --- INITIALIZATION ---
    const initializeApp = () => {
        if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
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
        
        // Event Delegation for Remove Buttons (using data-id)
        fileListContainer.addEventListener('click', (event) => {
            if (event.target && event.target.classList.contains('remove-file-btn')) {
                const idToRemove = event.target.getAttribute('data-id');
                removeFileById(idToRemove);
            }
        });

        setupAccordion();
        setupContactForm();
    };

    // --- STATE-MODIFYING FUNCTIONS ---

    const handleLicenseInput = () => {
        if (validationController) validationController.abort();
        clearInterval(messageIntervalId);
        appState.isLicenseValid = false;
        updateUIState();
        const key = licenseKeyInput.value.trim();
        if (key.length > 5) {
            validateLicenseWithRetries(key);
        } else {
            licenseStatus.innerHTML = '';
            licenseStatus.className = 'license-status-message';
        }
    };

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
                    appState.isLicenseValid = true;
                    licenseStatus.className = 'license-status-message valid';
                    licenseStatus.innerHTML = `You have ${result.credits} conversion${result.credits === 1 ? '' : 's'} left.`;
                } else {
                    appState.isLicenseValid = false;
                    licenseStatus.className = 'license-status-message invalid';
                    licenseStatus.innerHTML = result.message || 'Invalid license key.';
                }
                updateUIState();
                return;
            } catch (error) {
                if (signal.aborted) { clearInterval(messageIntervalId); return; }
                if (attempt === 20) {
                    clearInterval(messageIntervalId);
                    appState.isLicenseValid = false;
                    licenseStatus.className = 'license-status-message invalid';
                    licenseStatus.innerHTML = 'Unable to connect to the validation server. Please try again in a minute.';
                    updateUIState();
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 2500));
            }
        }
    }

    const handleDrop = (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); };
    const handleFileSelect = (e) => processFiles(e.target.files);

    // MODIFIED to add unique IDs
    const processFiles = (files) => {
        resetStatusUI();
        let newFiles = Array.from(files)
            .filter(file => file.name.endsWith('.brushset'))
            .map(file => ({
                id: `file-${Date.now()}-${Math.random()}`,
                fileObject: file
            }));

        if (newFiles.length === 0 && files.length > 0) {
            alert("Invalid file type. Please upload only .brushset files.");
            return;
        }
        
        appState.filesToUpload = [...appState.filesToUpload, ...newFiles].slice(0, 3);
        
        renderFileList();
        updateUIState();
    };

    // NEW function that replaces the old removeFile(index)
    const removeFileById = (id) => {
        // Use filter() for a safe, immutable update
        appState.filesToUpload = appState.filesToUpload.filter(fileWrapper => fileWrapper.id !== id);
        
        if (appState.filesToUpload.length === 0) {
            resetStatusUI();
        }

        renderFileList();
        updateUIState();
    };

    // MODIFIED to use the unique ID
    const renderFileList = () => {
        fileListContainer.innerHTML = '';
        if (appState.filesToUpload.length === 0) return;

        const list = document.createElement('ul');
        list.className = 'file-list-container';
        
        appState.filesToUpload.forEach(fileWrapper => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `
                <span>${fileWrapper.fileObject.name} (${(fileWrapper.fileObject.size / 1024 / 1024).toFixed(2)} MB)</span>
                <button class="remove-file-btn" data-id="${fileWrapper.id}">×</button>
            `;
            list.appendChild(listItem);
        });
        fileListContainer.appendChild(list);
    };

    const handleConversion = () => {
        const licenseKey = licenseKeyInput.value.trim();
        if (!licenseKey || appState.filesToUpload.length === 0) return;

        resetStatusUI();
        appStatus.style.display = 'block';
        progressBar.style.display = 'block';
        convertButton.disabled = true;
        licenseKeyInput.disabled = true;
        dropZone.classList.add('disabled');

        const formData = new FormData();
        formData.append('licenseKey', licenseKey);
        appState.filesToUpload.forEach(fileWrapper => {
            formData.append('files', fileWrapper.fileObject);
        });

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
                    sessionHistory.unshift({ sourceFiles: appState.filesToUpload.map(fw => fw.fileObject.name) });
                    updateHistoryList();
                    
                    await validateLicenseWithRetries(licenseKey, true);
                    
                    if (appState.isLicenseValid) {
                        updateProgress(100, 'Download success! Please remove the old files before starting a new conversion.');
                        convertButton.textContent = 'Convert New Files';
                    } else {
                        updateProgress(100, 'Final conversion successful!');
                    }

                } else {
                    showError(result.message || 'An unknown error occurred.');
                    await validateLicenseWithRetries(licenseKey);
                }
            } catch (e) {
                showError('An unexpected server response was received.');
                updateUIState();
            }
        };

        xhr.onerror = () => { showError('A network error occurred. Please check your connection and try again.'); licenseKeyInput.disabled = false; updateUIState(); };
        updateProgress(10, 'Validating and preparing upload...');
        xhr.send(formData);
    };

    // --- HELPER FUNCTIONS ---
    const updateProgress = (percentage, message) => { progressFill.style.width = `${percentage}%`; statusMessage.textContent = message; };
    const showError = (message) => { statusMessage.textContent = `Error: ${message}`; statusMessage.style.color = '#dc2626'; progressBar.style.display = 'none'; };

    const resetStatusUI = () => {
        appStatus.style.display = 'none';
        progressFill.style.width = '0%';
        statusMessage.textContent = '';
        statusMessage.style.color = '';
        convertButton.textContent = 'Convert Your Brushsets';
    };

    // --- HISTORY & ACCORDION (Unchanged) ---
    const updateHistoryList = () => {
        historyList.innerHTML = '';
        if (sessionHistory.length === 0) { historySection.style.display = 'none'; return; }
        historySection.style.display = 'block';
        sessionHistory.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'history-item';
            listItem.innerHTML = `<div class="history-item-info"><span>Conversion #${sessionHistory.length - index}</span><p>${item.sourceFiles.join(', ')}</p></div>`;
            historyList.appendChild(listItem);
        });
    };

    const setupAccordion = () => { document.querySelectorAll('.accordion-question, .footer-accordion-trigger').forEach(trigger => { trigger.addEventListener('click', () => { const item = trigger.closest('.accordion-item, .footer-accordion-item'); if (item) item.classList.toggle('open'); }); }); };
    const setupContactForm = () => { if (!contactForm) return; contactForm.addEventListener('submit', async (e) => { e.preventDefault(); const formData = new FormData(contactForm); try { const response = await fetch(contactForm.action, { method: 'POST', body: formData, headers: { 'Accept': 'application/json' } }); if (response.ok) { formStatus.style.display = 'flex'; contactForm.reset(); setTimeout(() => { formStatus.style.display = 'none'; }, 5000); } else { throw new Error('Form submission failed.'); } } catch (error) { console.error('Contact form error:', error); alert('Sorry, there was an issue sending your message. Please try again later.'); } }); };

    // --- START THE APP ---
    initializeApp();
});
