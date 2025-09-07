document.addEventListener('DOMContentLoaded', ( ) => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = "https://artypacks-converter-backend-sandbox.onrender.com/convert";
    const VITE_CHECK_API_ENDPOINT = "https://artypacks-converter-backend-sandbox.onrender.com/check-license";
    const VITE_RECOVER_API_ENDPOINT = "https://artypacks-converter-backend-sandbox.onrender.com/recover-link";
    const ETSY_STORE_LINK = 'https://www.etsy.com/shop/artypacks';

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

    // --- STATE MANAGEMENT ---
    let uploadedFile = null;
    let isLicenseValid = false;
    // ==================================================================
    // THIS IS THE FIRST PART OF THE FIX
    // ==================================================================
    // We need to track credits on the frontend now.
    let creditsRemaining = 0;
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
        isLicenseValid = false;
        creditsRemaining = 0; // Reset credits on new input
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

        const coldStartMessages = [
            "Initializing connection...", "Waking up the servers...", "Establishing secure link...", "Authenticating...", "Just a moment...", "Checking credentials...", "Almost there...", "Finalizing verification..."
        ];
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
                // ==================================================================
                // THIS IS THE SECOND PART OF THE FIX
                // ==================================================================
                // Store the number of credits from the server response.
                creditsRemaining = result.sessions_remaining;
                licenseStatus.className = 'license-status-message valid';
                licenseStatus.innerHTML = getCreditsMessage(creditsRemaining);

                if (creditsRemaining <= 0) {
                    try {
                        const recoveryResponse = await fetch(VITE_RECOVER_API_ENDPOINT, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ licenseKey: key })
                        });
                        
                        if (recoveryResponse.ok) {
                            const recoveryData = await recoveryResponse.json();
                            showDownloadView(recoveryData.download_url, recoveryData.original_filename);
                            return;
                        }
                    } catch (e) {
                        console.error("Recovery check failed:", e);
                    }
                }
            } else {
                isLicenseValid = false;
                creditsRemaining = 0;
                licenseStatus.className = 'license-status-message invalid';
                licenseStatus.innerHTML = result.message || 'Invalid license key.';
            }
        } catch (error) {
            if (signal.aborted) return;
            clearInterval(messageIntervalId);
            isLicenseValid = false;
            creditsRemaining = 0;
            licenseStatus.className = 'license-status-message invalid';
            licenseStatus.textContent = 'Unable to connect. Please try again in a minute.';
        } finally {
            checkLicenseAndToggleUI();
        }
    }

    const handleDrop = (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); };
    const handleFileSelect = (e) => processFiles(e.target.files);

    // ==================================================================
    // THIS FUNCTION CONTAINS THE FINAL, SMARTER UI LOCK LOGIC
    // ==================================================================
    const checkLicenseAndToggleUI = () => {
        // The drop zone is locked if the license isn't valid, OR if credits are zero, OR if a file is already uploaded.
        const isDropZoneLocked = !isLicenseValid || creditsRemaining <= 0 || !!uploadedFile;
        dropZone.classList.toggle('disabled', isDropZoneLocked);
        dropZone.title = isLicenseValid ? (uploadedFile ? 'A file is already uploaded. Remove it to add another.' : '') : 'Please enter a valid license key to upload files.';
        
        // You can convert if the license is valid, AND you have credits, AND a file is uploaded, AND it hasn't been converted yet.
        const canConvert = isLicenseValid && creditsRemaining > 0 && uploadedFile && !isFileConverted;
        convertButton.disabled = !canConvert;
        
        activationNotice.style.display = canConvert ? 'none' : 'block';

        if (isLicenseValid && licenseStatus.textContent.includes("has been used")) {
            getLicenseLinkContainer.classList.add('hidden');
        } else {
            getLicenseLinkContainer.classList.remove('hidden');
        }
    };

    const processFiles = (files) => {
        if (uploadedFile) {
            alert("A file has already been uploaded. Please remove the current file before adding a new one.");
            return;
        }
        if (files.length > 1) {
            alert("Please upload only one .brushset file at a time.");
            return;
        }
        const file = files[0];
        if (file && file.name.endsWith('.brushset')) {
            uploadedFile = file;
            updateFileList();
        } else if (file) {
            alert("Invalid file type. Please upload only .brushset files.");
        }
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
        isFileConverted = false;
        fileInput.value = '';
        updateFileList();
        resetStatusUI();
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
        activationNotice.style.display = 'none';

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
                    isFileConverted = true;
                    await validateLicenseWithRetries(licenseKey);
                    showDownloadView(result.downloadUrl, result.originalFilename);
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

    const showDownloadView = (url, filename) => {
        appTool.classList.add('hidden');
        downloadView.classList.remove('hidden');
        downloadFilename.textContent = filename;
        
        downloadFileButton.onclick = () => {
            if (typeof filename !== 'string') {
                console.error("Download error: filename is not a string.", filename);
                alert("Could not create a download filename due to an error.");
                return;
            }
            
            const link = document.createElement('a');
            link.href = url;

            const baseName = filename.replace('.brushset', '');
            link.download = `ArtyPacks.app_${baseName}.zip`; 

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };
    };

    const resetApp = () => {
        downloadView.classList.add('hidden');
        appTool.classList.remove('hidden');
        licenseKeyInput.disabled = false;
        removeFile();
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
