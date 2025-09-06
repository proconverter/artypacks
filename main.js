document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = window.env.VITE_CONVERT_API_ENDPOINT;
    const VITE_CHECK_API_ENDPOINT = window.env.VITE_CHECK_API_ENDPOINT;
    const VITE_RECOVER_API_ENDPOINT = window.env.VITE_RECOVER_API_ENDPOINT;
    const ETSY_STORE_LINK = 'https://www.etsy.com/shop/artypacks';

    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key' );
    const licenseStatus = document.getElementById('license-status');
    const licenseCtaText = document.getElementById('license-cta-text');
    const licenseCtaContainer = document.getElementById('license-cta-container');
    const convertButton = document.getElementById('convert-button');
    const activationNotice = document.getElementById('activation-notice');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const appStatus = document.getElementById('app-status');
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const statusMessage = document.getElementById('status-message');
    const nextStepNotice = document.getElementById('next-step-notice');
    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    const currentYearSpan = document.getElementById('current-year');

    // --- STATE MANAGEMENT ---
    let uploadedFile = null;
    let isLicenseValid = false;
    let isFileConverted = false;
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
            licenseCtaText.textContent = 'Need a conversion credit?';
            licenseCtaContainer.style.display = 'block';
            historySection.style.display = 'none';
        }
    };

    // --- NEW CREDIT MESSAGING (SIMPLIFIED) ---
    const getCreditsMessage = (credits) => {
        if (credits > 0) {
            return `<strong>Credit is valid.</strong> You're ready to convert!`;
        } else {
            return `This license has been used. <a href="${ETSY_STORE_LINK}" target="_blank"><strong>Get a new conversion credit.</strong></a>`;
        }
    };

    // --- VALIDATION & RECOVERY LOGIC (UPDATED) ---
    async function validateLicenseWithRetries(key, isPostConversion = false) {
        validationController = new AbortController();
        const signal = validationController.signal;

        const coldStartMessages = [
            "Initializing connection...", "Waking up the servers...", "Establishing secure link...", "Authenticating...", "Just a moment...", "Checking credentials...", "Almost there...", "Finalizing verification..."
        ];
        let messageIndex = 0;

        if (!isPostConversion) {
            licenseStatus.className = 'license-status-message checking';
            const showNextMessage = () => {
                licenseStatus.innerHTML = coldStartMessages[messageIndex % coldStartMessages.length];
                messageIndex++;
            };
            showNextMessage();
            messageIntervalId = setInterval(showNextMessage, 3000);
        }

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
                licenseStatus.className = 'license-status-message valid';
                licenseStatus.innerHTML = getCreditsMessage(result.credits);
                if (result.credits > 0) {
                    licenseCtaContainer.style.display = 'none'; // Hide CTA if credit is valid
                } else {
                    licenseCtaText.textContent = 'That license has been used. Need another?';
                    licenseCtaContainer.style.display = 'block';
                }
                fetchHistory(key); // Fetch history for valid keys
            } else {
                isLicenseValid = false;
                licenseStatus.className = 'license-status-message invalid';
                licenseStatus.innerHTML = result.message || 'Invalid license key.';
                licenseCtaText.textContent = "That license wasn't found. Need one?";
                licenseCtaContainer.style.display = 'block';
                historySection.style.display = 'none';
            }
            checkLicenseAndToggleUI();

        } catch (error) {
            if (signal.aborted) return;
            clearInterval(messageIntervalId);
            isLicenseValid = false;
            licenseStatus.className = 'license-status-message invalid';
            licenseStatus.textContent = 'Unable to connect. Please try again in a minute.';
            checkLicenseAndToggleUI();
        }
    }

    // --- NEW: FETCH DOWNLOAD HISTORY ---
    async function fetchHistory(licenseKey) {
        try {
            const response = await fetch(VITE_RECOVER_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey })
            });
            if (response.ok) {
                const historyData = await response.json();
                updateHistoryList(historyData);
            }
        } catch (error) {
            console.error("Could not fetch history:", error);
        }
    }

    // --- FILE HANDLING & UI (UPDATED FOR SINGLE FILE) ---
    const handleDrop = (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); };
    const handleFileSelect = (e) => processFiles(e.target.files);

    const checkLicenseAndToggleUI = () => {
        const isReadyToUpload = isLicenseValid && !uploadedFile;
        dropZone.classList.toggle('disabled', !isReadyToUpload);
        dropZone.title = isReadyToUpload ? '' : 'Please enter a valid license key to upload a file.';
        convertButton.disabled = !(isLicenseValid && uploadedFile && !isFileConverted);
        activationNotice.style.display = uploadedFile ? 'none' : 'block';
    };

    const processFiles = (files) => {
        if (uploadedFile) {
            alert("You can only process one file at a time. Please remove the current file to upload another.");
            return;
        }
        if (files.length > 1) {
            alert("Please upload only one .brushset file at a time.");
            return;
        }
        const file = Array.from(files).find(f => f.name.endsWith('.brushset'));
        if (!file) {
            if (files.length > 0) alert("Invalid file type. Please upload only .brushset files.");
            return;
        }
        uploadedFile = file;
        updateFileList();
        checkLicenseAndToggleUI();
    };

    const updateFileList = () => {
        fileList.innerHTML = '';
        if (!uploadedFile) {
            fileList.classList.add('hidden');
            return;
        }
        fileList.classList.remove('hidden');
        const listItem = document.createElement('li');
        const fileSize = (uploadedFile.size / 1024 / 1024).toFixed(2);
        
        let content = `<span>${uploadedFile.name} (${fileSize} MB)</span>`;
        
        if (isFileConverted) {
            listItem.classList.add('converted');
            content += `<span class="checkmark">&#10003;</span>`;
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove file';
        removeBtn.onclick = () => removeFile();
        
        listItem.innerHTML = content;
        listItem.appendChild(removeBtn);
        fileList.appendChild(listItem);
    };

    const removeFile = () => {
        uploadedFile = null;
        isFileConverted = false;
        resetStatusUI();
        updateFileList();
        checkLicenseAndToggleUI();
        const key = licenseKeyInput.value.trim();
        if (key) validateLicenseWithRetries(key); // Re-validate to reset UI state
    };

    // --- CONVERSION PROCESS (UPDATED) ---
    const handleConversion = () => {
        const licenseKey = licenseKeyInput.value.trim();
        if (!licenseKey || !uploadedFile) return;

        resetStatusUI();
        appStatus.style.display = 'block';
        progressBar.style.display = 'block';
        convertButton.disabled = true;
        licenseKeyInput.disabled = true;
        
        const formData = new FormData();
        formData.append('licenseKey', licenseKey);
        formData.append('file', uploadedFile);
        formData.append('originalFilename', uploadedFile.name);

        const xhr = new XMLHttpRequest();
        xhr.open('POST', VITE_CONVERT_API_ENDPOINT, true);

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const uploadProgress = 10 + (event.loaded / event.total) * 80;
                updateProgress(uploadProgress, 'Uploading and converting...');
            }
        };

        xhr.onload = async () => {
            licenseKeyInput.disabled = false;
            try {
                const result = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    updateProgress(100, '');
                    progressBar.style.display = 'none';
                    statusMessage.innerHTML = `<a href="${result.downloadUrl}" download><strong>Conversion Successful! Click Here to Download.</strong></a>`;
                    nextStepNotice.textContent = "To convert another file, remove the completed one above.";
                    isFileConverted = true;
                    updateFileList();
                    fetchHistory(licenseKey); // Refresh history
                } else {
                    showError(result.message || 'An unknown error occurred.');
                }
            } catch (e) {
                showError('An unexpected server response was received.');
            }
            validateLicenseWithRetries(licenseKey, true); // Re-validate to get latest credit count
        };

        xhr.onerror = () => {
            licenseKeyInput.disabled = false;
            showError('A network error occurred. Please check your connection and try again.');
        };

        updateProgress(10, 'Validating and preparing upload...');
        xhr.send(formData);
    };
    
    // --- HISTORY & HELPER FUNCTIONS (UPDATED) ---
    const updateHistoryList = (historyData) => {
        historyList.innerHTML = '';
        if (!historyData || historyData.length === 0) {
            historySection.style.display = 'none';
            return;
        }
        historySection.style.display = 'block';
        historyData.forEach(item => {
            const listItem = document.createElement('li');
            listItem.className = 'history-item';
            
            const infoDiv = document.createElement('div');
            infoDiv.className = 'history-item-info';
            const titleSpan = document.createElement('span');
            titleSpan.textContent = item.original_filename;
            const dateP = document.createElement('p');
            dateP.textContent = `Converted on: ${new Date(item.created_at).toLocaleString()}`;
            infoDiv.appendChild(titleSpan);
            infoDiv.appendChild(dateP);

            const downloadLink = document.createElement('a');
            downloadLink.href = item.download_url;
            downloadLink.className = 'history-download-btn';
            downloadLink.textContent = 'Download';
            downloadLink.setAttribute('download', '');

            listItem.appendChild(infoDiv);
            listItem.appendChild(downloadLink);
            historyList.appendChild(listItem);
        });
    };

    const updateProgress = (percentage, message) => {
        progressFill.style.width = `${percentage}%`;
        statusMessage.textContent = message;
    };

    const showError = (message) => {
        statusMessage.textContent = `Error: ${message}`;
        statusMessage.style.color = '#dc2626';
        progressBar.style.display = 'none';
    };

    const resetStatusUI = () => {
        appStatus.style.display = 'none';
        progressFill.style.width = '0%';
        statusMessage.textContent = '';
        statusMessage.style.color = '';
        nextStepNotice.textContent = '';
    };

    // --- ACCORDION & CONTACT FORM (UNCHANGED) ---
    const setupAccordion = () => {
        document.querySelectorAll('.accordion-question, .footer-accordion-trigger').forEach(trigger => {
            trigger.addEventListener('click', () => {
                const item = trigger.closest('.accordion-item, .footer-accordion-item');
                if (item) {
                    item.classList.toggle('open');
                }
            });
        });
    };

    const setupContactForm = () => {
        if (!contactForm) return;
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(contactForm);
            try {
                const response = await fetch(contactForm.action, { method: 'POST', body: formData, headers: { 'Accept': 'application/json' } });
                if (response.ok) {
                    formStatus.style.display = 'flex';
                    contactForm.reset();
                    setTimeout(() => { formStatus.style.display = 'none'; }, 5000);
                } else {
                    throw new Error('Form submission failed.');
                }
            } catch (error) {
                console.error('Contact form error:', error);
                alert('Sorry, there was an issue sending your message. Please try again later.');
            }
        });
    };

    initializeApp();
});
