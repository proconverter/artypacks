document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = window.env.VITE_CONVERT_API_ENDPOINT;
    const VITE_CHECK_API_ENDPOINT = window.env.VITE_CHECK_API_ENDPOINT;
    const ETSY_STORE_LINK = 'https://www.etsy.com/shop/artypacks';

    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key'      );
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
        newConversionButton.addEventListener('click', resetForNewConversion);
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

    // --- TIERED & RANDOMIZED CREDIT MESSAGES ---
    const getCreditsMessage = (credits) => {
        let messages = [];
        if (credits >= 7) { // Studio Pack
            messages = [ `<strong>Studio power!</strong> You have ${credits} conversions ready to go.`, `<strong>Looking great!</strong> You have ${credits} conversions available.`, `<strong>You’re all set</strong> with ${credits} conversions.` ];
        } else if (credits >= 4) { // Premium Pack
            messages = [ `You’ve got ${credits} conversions left. Keep up the great work!`, `Still going strong with ${credits} conversions remaining.`, `You have ${credits} conversions left in your Premium Pack.` ];
        } else if (credits >= 1) { // Starter Pack / Low credits
            messages = [ `You have ${credits} conversion${credits === 1 ? '' : 's'} left. Make it count!`, `<strong>Heads up</strong>—only ${credits} conversion${credits === 1 ? '' : 's'} remaining.`, `Your final ${credits} conversion${credits === 1 ? '' : 's'}. Let’s do this!` ];
        } else { // No credits
            messages = [ `You’ve used all your conversions. <a href="${ETSY_STORE_LINK}" target="_blank">Time for a new pack?</a>`, `Out of conversions. <a href="${ETSY_STORE_LINK}" target="_blank">Get more credits here.</a>`, `No conversions left. <a href="${ETSY_STORE_LINK}" target="_blank">Reload your credits.</a>` ];
        }
        return messages[Math.floor(Math.random() * messages.length)];
    };

    // --- VALIDATION LOGIC (UNCHANGED) ---
    async function validateLicenseWithRetries(key, isPostConversion = false) {
        validationController = new AbortController();
        const signal = validationController.signal;

        const coldStartMessages = [
            "Initializing connection...", "Waking up the servers...", "Establishing secure link...", "Authenticating...", "Just a moment...", "Checking credentials...", "Cross-referencing database...", "Almost there...", "Finalizing verification...", "Unlocking converter...", "Hold tight...", "Confirming details..."
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
                } else {
                    isLicenseValid = false;
                    licenseStatus.className = 'license-status-message invalid';
                    if (result.message && result.message.toLowerCase().includes("credits")) {
                        licenseStatus.innerHTML = getCreditsMessage(0);
                    } else {
                        licenseStatus.innerHTML = result.message || 'Invalid license key.';
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
                    licenseStatus.textContent = 'Unable to connect to the validation server. Please try again in a minute.';
                    checkLicenseAndToggleUI();
                    return;
                }
                await new Promise(resolve => setTimeout(resolve, 2500));
            }
        }
    }

    // --- FILE HANDLING & UI (UNCHANGED) ---
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
        let newFiles = Array.from(files).filter(file => file.name.endsWith('.brushset'));
        if (newFiles.length === 0 && files.length > 0) {
            alert("Invalid file type. Please upload only .brushset files.");
            return;
        }
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
            listItem.innerHTML = `<span>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>`;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file-btn';
            removeBtn.title = 'Remove file';
            removeBtn.onclick = () => removeFile(index);
            listItem.appendChild(removeBtn);
            list.appendChild(listItem);
        });
        fileList.appendChild(list);
    };

    const removeFile = (index) => {
        uploadedFiles.splice(index, 1);
        updateFileList();
        checkLicenseAndToggleUI();
    };

    // --- CONVERSION PROCESS (UNCHANGED) ---
    const handleConversion = () => {
        const licenseKey = licenseKeyInput.value.trim();
        if (!licenseKey || uploadedFiles.length === 0) return;

        const originalFilesForHistory = [...uploadedFiles];
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

        xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
                const uploadProgress = 10 + (event.loaded / event.total) * 80; // Progress from 10% to 90%
                updateProgress(uploadProgress, 'Uploading and converting...');
            }
        };

        xhr.onload = async () => {
            try {
                const result = JSON.parse(xhr.responseText);

                if (xhr.status >= 200 && xhr.status < 300) {
                    updateProgress(100, 'Conversion successful! Your download will begin automatically.');
                    
                    const tempLink = document.createElement('a');
                    tempLink.href = result.downloadUrl;
                    tempLink.setAttribute('download', '');
                    document.body.appendChild(tempLink);
                    tempLink.click();
                    document.body.removeChild(tempLink);

                    sessionHistory.unshift({ sourceFiles: originalFilesForHistory.map(f => f.name) });
                    updateHistoryList();

                    newConversionButton.style.display = 'block';
                    progressBar.style.display = 'none';
                    
                    // The problematic line is commented out.
                    // await validateLicenseWithRetries(licenseKey, true);

                } else {
                    licenseKeyInput.disabled = false;
                    await validateLicenseWithRetries(licenseKey);
                    showError(result.message || 'An unknown error occurred.');
                    if (!licenseKeyInput.disabled) {
                        checkLicenseAndToggleUI();
                    }
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
    
    // --- RESET FUNCTION (UNCHANGED) ---
    const resetForNewConversion = () => {
        uploadedFiles = [];
        updateFileList();
        resetStatusUI();
        licenseKeyInput.disabled = false;
        checkLicenseAndToggleUI();
    };

    // --- HISTORY "RECEIPT" FUNCTIONS (UNCHANGED) ---
    const updateHistoryList = () => {
        historyList.innerHTML = '';
        if (sessionHistory.length === 0) {
            historySection.style.display = 'none';
            return;
        }

        historySection.style.display = 'block';
        sessionHistory.forEach((item, index) => {
            const listItem = document.createElement('li');
            listItem.className = 'history-item';
            const infoDiv = document.createElement('div');
            infoDiv.className = 'history-item-info';
            const titleSpan = document.createElement('span');
            titleSpan.textContent = `Conversion #${sessionHistory.length - index}`;
            const filesP = document.createElement('p');
            filesP.textContent = item.sourceFiles.join(', ');
            infoDiv.appendChild(titleSpan);
            infoDiv.appendChild(filesP);
            listItem.appendChild(infoDiv);
            historyList.appendChild(listItem);
        });
    };

    // --- HELPER FUNCTIONS (UNCHANGED) ---
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
        newConversionButton.style.display = 'none';
    };

    // --- ACCORDION & CONTACT FORM (MODIFIED) ---
    const setupAccordion = () => {
        document.querySelectorAll('.accordion-question, .footer-accordion-trigger').forEach(trigger => {
            trigger.addEventListener('click', () => {
                // MODIFIED: Use .closest() to find the correct parent item reliably
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

    // --- START THE APP ---
    initializeApp();
});
