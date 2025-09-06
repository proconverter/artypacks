document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = window.env.VITE_CONVERT_API_ENDPOINT;
    const VITE_CHECK_API_ENDPOINT = window.env.VITE_CHECK_API_ENDPOINT;
    const VITE_RECOVER_API_ENDPOINT = window.env.VITE_RECOVER_API_ENDPOINT;
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
    
    // New Download View Selectors
    const appToolView = document.getElementById('app-tool');
    const downloadView = document.getElementById('download-view');
    const downloadFilename = document.getElementById('download-filename');
    const downloadFileButton = document.getElementById('download-file-button');
    const convertAnotherButton = document.getElementById('convert-another-button');


    // --- STATE MANAGEMENT ---
    let uploadedFile = null;
    let isLicenseValid = false;
    let validationController;
    let messageIntervalId;

    // --- INITIALIZATION ---
    const initializeApp = () => {
        if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
        setupEventListeners();
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
        isLicenseValid = false;
        checkLicenseAndToggleUI();
        const key = licenseKeyInput.value.trim();
        if (key.length > 5) {
            validateLicenseWithRetries(key);
        } else {
            licenseStatus.innerHTML = '';
            licenseStatus.className = 'license-status-message';
            if (getLicenseCTA) getLicenseCTA.innerHTML = `Need a license? <a href="${ETSY_STORE_LINK}" target="_blank">Get one here.</a>`;
        }
    };

    const getCreditsMessage = (credits) => {
        if (credits > 0) {
            return `Credit is valid. You're ready to convert!`;
        } else {
            return `This license has no credits left.`;
        }
    };

    async function validateLicenseWithRetries(key, isPostConversion = false) {
        validationController = new AbortController();
        const signal = validationController.signal;

        const coldStartMessages = ["Initializing connection...", "Waking up the servers...", "Establishing secure link...", "Authenticating...", "Just a moment..."];
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

                if (response.ok && result.isValid) {
                    isLicenseValid = true;
                    licenseStatus.className = 'license-status-message valid';
                    licenseStatus.innerHTML = getCreditsMessage(result.credits);
                    if (getLicenseCTA) getLicenseCTA.innerHTML = `This license has ${result.credits} credit${result.credits === 1 ? '' : 's'} remaining.`;
                    if (result.credits <= 0) {
                        isLicenseValid = false;
                        licenseStatus.className = 'license-status-message invalid';
                        if (getLicenseCTA) getLicenseCTA.innerHTML = `Your license has been used. <a href="${ETSY_STORE_LINK}" target="_blank">Get a new one to continue.</a>`;
                    }
                    fetchHistory(key);
                } else {
                    isLicenseValid = false;
                    licenseStatus.className = 'license-status-message invalid';
                    licenseStatus.innerHTML = result.message || 'Invalid license key.';
                    if (getLicenseCTA) getLicenseCTA.innerHTML = `Need a license? <a href="${ETSY_STORE_LINK}" target="_blank">Get one here.</a>`;
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

    const handleDrop = (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); };
    const handleFileSelect = (e) => processFiles(e.target.files);

    const checkLicenseAndToggleUI = () => {
        const canUpload = isLicenseValid && !uploadedFile;
        dropZone.classList.toggle('disabled', !canUpload);
        dropZone.title = canUpload ? '' : 'Please enter a valid license key to upload a file.';
        convertButton.disabled = !(isLicenseValid && uploadedFile);
        activationNotice.textContent = isLicenseValid ? 'This tool extracts stamp images (min 1024px). It does not convert complex brush textures.' : 'Converter locked – enter license key above.';
    };

    const processFiles = (files) => {
        if (uploadedFile) {
            alert("A file has already been uploaded. Please remove it before adding a new one.");
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
        listItem.innerHTML = `<span>${uploadedFile.name} (${fileSize} MB)</span>`;
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
        resetStatusUI();
        updateFileList();
        checkLicenseAndToggleUI();
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
                    showDownloadView(result.downloadUrl, uploadedFile.name);
                    await validateLicenseWithRetries(licenseKey, true);
                } else {
                    showError(result.message || 'An unknown error occurred.');
                    licenseKeyInput.disabled = false;
                    checkLicenseAndToggleUI();
                }
            } catch (e) {
                showError('An unexpected server response was received.');
                licenseKeyInput.disabled = false;
                checkLicenseAndToggleUI();
            }
        };

        xhr.onerror = () => {
            showError('A network error occurred. Please check your connection and try again.');
            licenseKeyInput.disabled = false;
            checkLicenseAndToggleUI();
        };

        updateProgress(10, 'Validating and preparing upload...');
        xhr.send(formData);
    };

    const showDownloadView = (downloadUrl, originalFilename) => {
        const downloadFilename = `ArtyPacks_${originalFilename.replace(/\.brushset$/, '')}.zip`;

        // Hide the main app and show the download view
        appToolView.classList.add('hidden');
        downloadView.classList.remove('hidden');

        // Populate the download view
        downloadFilename.textContent = downloadFilename;
        
        // Set up the download button
        downloadFileButton.onclick = () => {
            forceDownload(downloadUrl, downloadFilename);
        };
    };

    const resetApp = () => {
        // Hide the download view and show the main app
        downloadView.classList.add('hidden');
        appToolView.classList.remove('hidden');

        // Reset all state
        uploadedFile = null;
        resetStatusUI();
        updateFileList();
        checkLicenseAndToggleUI();
        licenseKeyInput.disabled = false;
    };

    const forceDownload = async (url, filename) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            const tempLink = document.createElement('a');
            tempLink.href = blobUrl;
            tempLink.download = filename;
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);
            URL.revokeObjectURL(blobUrl);
        } catch (error) {
            alert('Failed to download the file. Please try again.');
        }
    };

    async function fetchHistory(licenseKey) {
        try {
            const response = await fetch(VITE_RECOVER_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey })
            });
            if (!response.ok) return;
            const history = await response.json();
            updateHistoryList(history);
        } catch (error) {
            console.error("Failed to fetch history:", error);
        }
    }

    const updateHistoryList = (history) => {
        historyList.innerHTML = '';
        if (!history || history.length === 0) {
            historySection.style.display = 'none';
            return;
        }
        historySection.style.display = 'block';
        history.forEach(item => {
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
            const downloadBtn = document.createElement('a');
            downloadBtn.href = '#';
            downloadBtn.className = 'history-download-btn';
            downloadBtn.textContent = 'Download';
            const downloadFilename = `ArtyPacks_${item.original_filename.replace(/\.brushset$/, '')}.zip`;
            downloadBtn.onclick = (e) => {
                e.preventDefault();
                forceDownload(item.download_url, downloadFilename);
            };
            listItem.appendChild(infoDiv);
            listItem.appendChild(downloadBtn);
            historyList.appendChild(listItem);
        });
    };

    const updateProgress = (percentage, message) => {
        progressFill.style.width = `${percentage}%`;
        statusMessage.textContent = message;
    };

    const showError = (message) => {
        let errorMsg = message;
        if (typeof message === 'object') {
            errorMsg = JSON.stringify(message);
        }
        statusMessage.innerHTML = `<span style="color: #dc2626;">Error: ${errorMsg}</span>`;
        progressBar.style.display = 'none';
    };

    const resetStatusUI = () => {
        appStatus.style.display = 'none';
        progressFill.style.width = '0%';
        statusMessage.textContent = '';
        statusMessage.style.color = '';
    };

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
