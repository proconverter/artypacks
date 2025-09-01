document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = window.env.VITE_CONVERT_API_ENDPOINT;
    const VITE_CHECK_API_ENDPOINT = window.env.VITE_CHECK_API_ENDPOINT;
    const ETSY_STORE_LINK = 'https://www.etsy.com/shop/artypacks';

    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key'    );
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
    let validationController; // Will be managed explicitly
    let messageIntervalId;
    let debounceTimer;

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
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('dragleave'); });
        dropZone.addEventListener('drop', handleDrop);
        fileInput.addEventListener('change', handleFileSelect);
        convertButton.addEventListener('click', handleConversion);
        newConversionButton.addEventListener('click', resetForNewConversion);
        setupAccordion();
        setupContactForm();
    };

    // --- DEBOUNCED LICENSE INPUT HANDLER ---
    const handleLicenseInput = () => {
        clearTimeout(debounceTimer);
        // Explicitly abort any previous validation request
        if (validationController) {
            validationController.abort();
        }
        clearInterval(messageIntervalId);
        
        const key = licenseKeyInput.value.trim();
        
        if (key.length > 5) {
            licenseStatus.className = 'license-status-message checking';
            licenseStatus.textContent = 'Checking...';
            
            debounceTimer = setTimeout(() => {
                validateLicenseWithRetries(key);
            }, 500);
        } else {
            isLicenseValid = false;
            checkLicenseAndToggleUI();
            licenseStatus.innerHTML = '';
            licenseStatus.className = 'license-status-message';
        }
    };

    // --- TIERED & RANDOMIZED CREDIT MESSAGES ---
    const getCreditsMessage = (credits) => {
        let messages = [];
        if (credits >= 11) {
            messages = [ `You’re all set—${credits} conversions ready for you!`, `Nice! You’ve got ${credits} conversions waiting.`, `${credits} conversions available. Dive in!` ];
        } else if (credits >= 6) {
            messages = [ `Still going strong—${credits} conversions remain.`, `Looking good! ${credits} conversions left to use.`, `You’ve got ${credits} conversions remaining—keep creating.` ];
        } else if (credits >= 2) {
            messages = [ `Heads up—you’ve got ${credits} conversions left.`, `You've got ${credits} conversions to use.`, `Make them count—only ${credits} left.` ];
        } else if (credits === 1) {
            messages = [ `Last one! You have 1 conversion left—make it your best.`, `Almost out—just 1 conversion remains.`, `Final call: 1 conversion left.` ];
        } else {
            messages = [ `You’ve used all your conversions. <a href="${ETSY_STORE_LINK}" target="_blank">Pick up a new pack here.</a>`, `Out of conversions? <a href="${ETSY_STORE_LINK}" target="_blank">Add more credits in just a click.</a>`, `No conversions left. <a href="${ETSY_STORE_LINK}" target="_blank">Get more credits to unlock new ones.</a>` ];
        }
        return messages[Math.floor(Math.random() * messages.length)];
    };

    // --- VALIDATION LOGIC WITH EXPLICIT ABORTCONTROLLER ---
    async function validateLicenseWithRetries(key, isPostConversion = false) {
        // Create a new controller for this specific validation attempt.
        validationController = new AbortController();
        const signal = validationController.signal;

        const coldStartMessages = [
            "Initializing connection...", "Waking up the servers...", "Establishing secure link...", "Authenticating...", "Just a moment...", "Checking credentials...", "Almost there...", "Finalizing verification..."
        ];
        let messageIndex = 0;

        if (!isPostConversion) {
            clearInterval(messageIntervalId);
            const showNextMessage = () => {
                if (signal.aborted) {
                    clearInterval(messageIntervalId);
                    return;
                }
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
                signal // Pass the signal to the fetch request
            });

            const result = await response.json();

            if (response.ok && result.isValid) {
                isLicenseValid = true;
                licenseStatus.className = 'license-status-message valid';
                licenseStatus.innerHTML = isPostConversion ? getCreditsMessage(result.credits) : `Welcome aboard. You’ve got ${result.credits} conversions remaining. Let’s upload your files below.`;
            } else {
                isLicenseValid = false;
                licenseStatus.className = 'license-status-message invalid';
                licenseStatus.innerHTML = result.message && result.message.toLowerCase().includes("credits") ? getCreditsMessage(0) : (result.message || 'Invalid license key.');
            }
            checkLicenseAndToggleUI();

        } catch (error) {
            // Only show error if it wasn't an intentional abort
            if (signal.aborted) {
                console.log("Fetch aborted.");
                return;
            }
            isLicenseValid = false;
            licenseStatus.className = 'license-status-message invalid';
            licenseStatus.textContent = 'Unable to connect to the validation server. Please try again in a minute.';
            checkLicenseAndToggleUI();
        } finally {
            clearInterval(messageIntervalId);
        }
    }

    // --- FILE HANDLING & UI ---
    const handleDrop = (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); };
    const handleFileSelect = (e) => processFiles(e.target.files);

    const checkLicenseAndToggleUI = () => {
        dropZone.classList.toggle('disabled', !isLicenseValid);
        dropZone.title = isLicenseValid ? '' : 'Please enter a valid license key to upload files.';
        convertButton.disabled = !(isLicenseValid && uploadedFiles.length > 0);
        activationNotice.textContent = isLicenseValid ? 'This tool extracts stamp images (min 1024px). It does not convert complex brush textures.' : 'Converter locked – enter license key above.';
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
            removeBtn.innerHTML = '&times;';
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

    // --- CONVERSION PROCESS WITH REAL PROGRESS BAR ---
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
                const uploadProgress = 10 + (event.loaded / event.total) * 80;
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
                    
                    await validateLicenseWithRetries(licenseKey, true);
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
    
    // --- FINAL, ROBUST RESET FUNCTION ---
    const resetForNewConversion = () => {
        // Explicitly abort any validation request that might be in-flight.
        if (validationController) {
            validationController.abort();
        }
        
        // Clear the file list from the UI and state
        uploadedFiles = [];
        updateFileList();
        
        // Hide the progress bar and "Conversion successful" message
        resetStatusUI();
        
        // Re-enable the license key input field
        licenseKeyInput.disabled = false;
        
        // The post-conversion validation has already set the correct final status message.
        // We leave it on screen so the user knows their key has no credits.
        // If the user wants to clear it, they can just start typing a new key.
        
        // The license is now invalid, so update the state and disable the UI
        isLicenseValid = false;
        checkLicenseAndToggleUI();
    };

    // --- HISTORY "RECEIPT" FUNCTIONS ---
    const updateHistoryList = () => {
        historyList.innerHTML = '';
        if (sessionHistory.length === t.addEventListener('submit', async (e) => {
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
