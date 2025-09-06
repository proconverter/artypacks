document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = window.env.VITE_CONVERT_API_ENDPOINT;
    const VITE_CHECK_API_ENDPOINT = window.env.VITE_CHECK_API_ENDPOINT;
    const VITE_RECOVER_API_ENDPOINT = "https://artypacks-converter-backend-SANDBOX.onrender.com/recover-link";
    const ETSY_STORE_LINK = 'https://www.etsy.com/shop/artypacks';

    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key' );
    const licenseStatus = document.getElementById('license-status');
    const getLicenseCTA = document.querySelector('.get-license-link');
    const convertButton = document.getElementById('convert-button');
    const activationNotice = document.getElementById('activation-notice');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
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
    let uploadedFile = null;
    let isFileConverted = false;
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
            fetchHistory(key);
        } else {
            licenseStatus.innerHTML = '';
            licenseStatus.className = 'license-status-message';
            historySection.style.display = 'none';
            if (getLicenseCTA) {
                getLicenseCTA.innerHTML = `Need a license? <a href="${ETSY_STORE_LINK}" target="_blank">Get one here.</a>`;
            }
        }
    };

    const getCreditsMessage = (credits) => {
        if (credits > 0) {
            return `<strong>Credit is valid.</strong> You're ready to convert!`;
        } else {
            return `<strong>This license has 0 credits left.</strong>`;
        }
    };

    async function validateLicenseWithRetries(key, isPostConversion = false) {
        validationController = new AbortController();
        const signal = validationController.signal;
        const coldStartMessages = ["Initializing...", "Waking servers...", "Authenticating..."];
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

        for (let attempt = 1; attempt <= 20; attempt++) {
            try {
                const response = await fetch(VITE_CHECK_API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ licenseKey: key }),
                    signal
                });

                clearInterval(messageIntervalId);
                const result = await response.json();

                if (response.ok && result.is_valid) {
                    isLicenseValid = true;
                    licenseStatus.className = 'license-status-message valid';
                    licenseStatus.innerHTML = getCreditsMessage(result.sessions_remaining);
                    if (getLicenseCTA) {
                        getLicenseCTA.innerHTML = `This license is valid. <a href="${ETSY_STORE_LINK}" target="_blank">Get another one here.</a>`;
                    }
                } else {
                    isLicenseValid = false;
                    licenseStatus.className = 'license-status-message invalid';
                    licenseStatus.innerHTML = result.message || 'Invalid license key.';
                    if (getLicenseCTA) {
                        if (result.message && result.message.toLowerCase().includes("credits")) {
                            getLicenseCTA.innerHTML = `This license has been used. <a href="${ETSY_STORE_LINK}" target="_blank">Get a new one to continue.</a>`;
                        } else {
                            getLicenseCTA.innerHTML = `Need a license? <a href="${ETSY_STORE_LINK}" target="_blank">Get one here.</a>`;
                        }
                    }
                }
                checkLicenseAndToggleUI();
                return;

            } catch (error) {
                if (signal.aborted) {
                    clearInterval(messageIntervalId);
                    return;
                }
                if (attempt === 20) {
                    clearInterval(messageIntervalId);
                    isLicenseValid = false;
                    licenseStatus.className = 'license-status-message invalid';
                    licenseStatus.textContent = 'Unable to connect. Please try again in a minute.';
                    checkLicenseAndToggleUI();
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 2500));
            }
        }
    }

    const processFiles = (files) => {
        if (uploadedFile) {
            alert("A file is already loaded. Please remove the existing file to upload a new one.");
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

    const handleDrop = (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); };
    const handleFileSelect = (e) => { processFiles(e.target.files); fileInput.value = ''; };

    const checkLicenseAndToggleUI = () => {
        const hasValidFile = uploadedFile && !isFileConverted;
        const isDropZoneLocked = !isLicenseValid || (uploadedFile !== null);
        dropZone.classList.toggle('disabled', isDropZoneLocked);
        dropZone.title = isLicenseValid ? '' : 'Please enter a valid license key to upload files.';
        convertButton.disabled = !(isLicenseValid && hasValidFile);
        activationNotice.textContent = isLicenseValid ? 'This tool extracts stamp images (min 1024px). It does not convert complex brush textures.' : 'Converter locked – enter license key above.';
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
        let checkmark = isFileConverted ? '<span class="checkmark">✓</span>' : '';
        listItem.innerHTML = `<span>${uploadedFile.name} (${fileSize} MB)</span>${checkmark}`;
        if (isFileConverted) listItem.classList.add('converted');

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Remove file';
        removeBtn.onclick = () => removeFile();
        listItem.appendChild(removeBtn);
        fileList.appendChild(listItem);
    };

    const removeFile = () => {
        uploadedFile = null;
        isFileConverted = false;
        resetStatusUI();
        updateFileList();
        const key = licenseKeyInput.value.trim();
        if (key) {
            validateLicenseWithRetries(key);
        } else {
            checkLicenseAndToggleUI();
        }
    };

    const handleConversion = () => {
        const licenseKey = licenseKeyInput.value.trim();
        if (!licenseKey || !uploadedFile) return;

        resetStatusUI();
        appStatus.style.display = 'block';
        progressBar.style.display = 'block';
        convertButton.disabled = true;
        licenseKeyInput.disabled = true;
        dropZone.classList.add('disabled');

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
            try {
                const result = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    progressBar.style.display = 'none';
                    const suggestedFilename = uploadedFile.name.replace('.brushset', '.zip');
                    // *** THIS IS THE FIX FOR THE DIALOG BOX ***
                    statusMessage.innerHTML = `<strong>Conversion Successful!</strong> <a href="${result.downloadUrl}" download="${suggestedFilename}" class="download-link">Click Here to Download.</a><p class="post-conversion-note">To convert another file, remove the completed one above.</p>`;
                    isFileConverted = true;
                    updateFileList();
                    fetchHistory(licenseKey);
                    validateLicenseWithRetries(licenseKey, true);
                } else {
                    showError(result.message || 'An unknown error occurred.');
                    licenseKeyInput.disabled = false;
                }
            } catch (e) {
                showError('An unexpected server response was received.');
                licenseKeyInput.disabled = false;
            }
            checkLicenseAndToggleUI();
        };

        xhr.onerror = () => {
            showError('A network error occurred. Please check your connection and try again.');
            licenseKeyInput.disabled = false;
            checkLicenseAndToggleUI();
        };

        updateProgress(10, 'Validating and preparing upload...');
        xhr.send(formData);
    };

    const resetStatusUI = () => {
        appStatus.style.display = 'none';
        progressFill.style.width = '0%';
        statusMessage.innerHTML = '';
        statusMessage.style.color = '';
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

    async function fetchHistory(licenseKey) {
        try {
            const response = await fetch(VITE_RECOVER_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey })
            });
            const historyData = await response.json();
            updateHistoryList(historyData);
        } catch (error) {
            console.error("Failed to fetch history:", error);
            historySection.style.display = 'none';
        }
    }

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
            const date = new Date(item.created_at);
            const formattedDate = `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            const suggestedFilename = item.original_filename.replace('.brushset', '.zip');
            // *** THIS IS THE FIX FOR THE DIALOG BOX ***
            listItem.innerHTML = `
                <div class="history-item-info">
                    <span>${item.original_filename}</span>
                    <p>Converted on: ${formattedDate}</p>
                </div>
                <a href="${item.download_url}" class="history-download-btn" download="${suggestedFilename}">Download</a>
            `;
            historyList.appendChild(listItem);
        });
    };

    const setupAccordion = () => {
        document.querySelectorAll('.accordion-question, .footer-accordion-trigger').forEach(trigger => {
            trigger.addEventListener('click', () => {
                const item = trigger.closest('.accordion-item, .footer-accordion-item');
                if (item) item.classList.toggle('open');
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
