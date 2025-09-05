document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = window.env.VITE_CONVERT_API_ENDPOINT;
    const VITE_CHECK_API_ENDPOINT = window.env.VITE_CHECK_API_ENDPOINT;
    const ETSY_STORE_LINK = 'https://www.etsy.com/shop/artypacks';

    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key' );
    const licenseStatus = document.getElementById('license-status');
    const convertButton = document.getElementById('convert-button');
    const convertStep = document.getElementById('convert-step');
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
    let sessionHistory = [];
    let isLicenseValid = false;
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

    const getCreditsMessage = (credits) => {
        let messages = [];
        if (credits >= 7) {
            messages = [`<strong>Studio power!</strong> You have ${credits} conversions ready to go.`, `<strong>Looking great!</strong> You have ${credits} conversions available.`, `<strong>You’re all set</strong> with ${credits} conversions.`];
        } else if (credits >= 4) {
            messages = [`You’ve got ${credits} conversions left. Keep up the great work!`, `Still going strong with ${credits} conversions remaining.`, `You have ${credits} conversions left in your Premium Pack.`];
        } else if (credits >= 1) {
            messages = [`You have ${credits} conversion${credits === 1 ? '' : 's'} left. Make it count!`, `<strong>Heads up</strong>—only ${credits} conversion${credits === 1 ? '' : 's'} remaining.`, `Your final ${credits} conversion${credits === 1 ? '' : 's'}. Let’s do this!`];
        } else {
            messages = [`You’ve used all your conversions. <a href="${ETSY_STORE_LINK}" target="_blank">Time for a new pack?</a>`, `Out of conversions. <a href="${ETSY_STORE_LINK}" target="_blank">Get more credits here.</a>`, `No conversions left. <a href="${ETSY_STORE_LINK}" target="_blank">Reload your credits.</a>`];
        }
        return messages[Math.floor(Math.random() * messages.length)];
    };

    async function validateLicenseWithRetries(key, isPostConversion = false) {
        validationController = new AbortController();
        const signal = validationController.signal;
        const coldStartMessages = ["Initializing connection...", "Waking up the servers...", "Establishing secure link...", "Authenticating...", "Just a moment...", "Checking credentials...", "Cross-referencing database...", "Almost there...", "Finalizing verification...", "Unlocking converter...", "Hold tight...", "Confirming details..."];
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
                    licenseStatus.innerHTML = (result.message && result.message.toLowerCase().includes("credits")) ? getCreditsMessage(0) : (result.message || 'Invalid license key.');
                }
                checkLicenseAndToggleUI();
                return;
            } catch (error) {
                if (signal.aborted) { clearInterval(messageIntervalId); return; }
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

    const handleDrop = (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); };
    const handleFileSelect = (e) => processFiles(e.target.files);

    const checkLicenseAndToggleUI = () => {
        const isDropZoneDisabled = !isLicenseValid || uploadedFile !== null;
        dropZone.classList.toggle('disabled', isDropZoneDisabled);
        dropZone.title = !isLicenseValid ? 'Please enter a valid license key to upload files.' : (uploadedFile !== null ? 'Remove the current file to upload a new one.' : '');

        convertButton.disabled = !(isLicenseValid && uploadedFile && !isFileConverted);
        activationNotice.textContent = isLicenseValid ? 'This tool extracts stamp images (min 1024px). It does not convert complex brush textures.' : 'Converter locked – enter license key above.';
    };

    const processFiles = (files) => {
        const file = Array.from(files).find(f => f.name.endsWith('.brushset'));
        if (!file && files.length > 0) {
            alert("Invalid file type. Please upload a single .brushset file.");
            return;
        }
        if (file) {
            uploadedFile = file;
            resetUIForNewUpload();
        }
    };
    
    const resetUIForNewUpload = () => {
        isFileConverted = false;
        resetStatusUI();
        convertStep.style.display = 'flex';
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
        
        if (isFileConverted) {
            listItem.classList.add('converted');
            const checkmark = document.createElement('span');
            checkmark.innerHTML = ' ✔';
            checkmark.style.color = '#16a34a';
            listItem.firstChild.appendChild(checkmark);
        } else {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'Remove file';
            removeBtn.onclick = () => removeFile();
            listItem.appendChild(removeBtn);
        }
        fileList.appendChild(listItem);
    };

    const removeFile = () => {
        uploadedFile = null;
        fileInput.value = '';
        resetUIForNewUpload();
    };

    // --- CONVERSION PROCESS (REBUILT FOR STATELESS OPERATION) ---
    const handleConversion = async () => {
        const licenseKey = licenseKeyInput.value.trim();
        if (!licenseKey || !uploadedFile) return;

        // 1. Setup UI for processing state
        const originalFileForHistory = uploadedFile;
        resetStatusUI();
        appStatus.style.display = 'block';
        progressBar.style.display = 'block';
        updateProgress(50, 'Uploading and converting...'); // Simplified progress
        convertButton.disabled = true;
        licenseKeyInput.disabled = true;
        dropZone.classList.add('disabled');

        // 2. Prepare form data
        const formData = new FormData();
        formData.append('licenseKey', licenseKey);
        formData.append('file', uploadedFile);

        try {
            // 3. Send file and license key in a single request
            const response = await fetch(VITE_CONVERT_API_ENDPOINT, {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();

            if (response.ok) {
                // 4. Handle success
                updateProgress(100, 'Conversion successful! Download will begin shortly.');
                convertStep.style.display = 'none';
                progressBar.style.display = 'none';
                isFileConverted = true;
                updateFileList();

                setTimeout(() => {
                    const tempLink = document.createElement('a');
                    tempLink.href = result.downloadUrl;
                    tempLink.setAttribute('download', '');
                    document.body.appendChild(tempLink);
                    tempLink.click();
                    document.body.removeChild(tempLink);
                }, 1000);

                sessionHistory.unshift({ sourceFile: originalFileForHistory.name });
                updateHistoryList();
                await validateLicenseWithRetries(licenseKey, true);

            } else {
                // 5. Handle server-side errors (e.g., no credits, invalid key)
                showError(result.message || 'An unknown error occurred.');
                licenseKeyInput.disabled = false;
                checkLicenseAndToggleUI();
                await validateLicenseWithRetries(licenseKey); // Re-check credits to show correct status
            }
        } catch (error) {
            // 6. Handle network errors
            console.error('Conversion failed:', error);
            showError('A network error occurred. Please check your connection and try again.');
            licenseKeyInput.disabled = false;
            checkLicenseAndToggleUI();
        }
    };

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
            filesP.textContent = item.sourceFile;
            infoDiv.appendChild(titleSpan);
            infoDiv.appendChild(filesP);
            listItem.appendChild(infoDiv);
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
