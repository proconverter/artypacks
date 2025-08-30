document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const VITE_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
    const VITE_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
    const VITE_CONVERT_API_ENDPOINT = import.meta.env.VITE_CONVERT_API_ENDPOINT;
    const VITE_CHECK_API_ENDPOINT = import.meta.env.VITE_CHECK_API_ENDPOINT;
    const ETSY_STORE_LINK = 'https://www.etsy.com/shop/artypacks';

    // --- SUPABASE INITIALIZATION ---
    let supabaseClient; // Using a different name for clarity, as you wisely suggested.
    try {
        if (!VITE_SUPABASE_URL || !VITE_SUPABASE_ANON_KEY ) {
            throw new Error("Supabase URL or Anon Key is missing from environment variables.");
        }
        // CORRECT INITIALIZATION, as you pointed out.
        // Calls createClient on the global 'supabase' object from the library.
        supabaseClient = supabase.createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

    } catch (error) {
        console.error("CRITICAL: Supabase initialization failed.", error);
        const dropZone = document.getElementById('drop-zone');
        if(dropZone) {
            dropZone.innerHTML = '<p style="color: red; font-weight: bold;">Application failed to load. Please contact support.</p>';
            dropZone.classList.add('disabled');
        }
        return; // Stop the rest of the script from running
    }

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
    let debounceTimer;
    let isLicenseValid = false;

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
        clearTimeout(debounceTimer);
        licenseStatus.innerHTML = '';
        licenseStatus.className = 'license-status-message';
        isLicenseValid = false;
        checkLicenseAndToggleUI();
        debounceTimer = setTimeout(() => {
            const key = licenseKeyInput.value.trim();
            if (key.length > 5) {
                validateLicenseWithRetries(key);
            }
        }, 500);
    };
    
    // --- ROBUST LICENSE VALIDATION WITH RETRIES ---
    async function validateLicenseWithRetries(key, attempt = 1) {
        if (attempt === 1) {
            licenseStatus.innerHTML = 'Checking...';
            licenseStatus.className = 'license-status-message';
            isLicenseValid = false;
        }

        let response;
        try {
            if (!VITE_CHECK_API_ENDPOINT) {
                throw new Error("Check API endpoint is not configured.");
            }
            response = await fetch(VITE_CHECK_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: key })
            });

            if (response.status >= 500 && attempt < 3) {
                throw new Error('Server not ready, retrying...');
            }

            const result = await response.json();

            if (response.ok && result.isValid) {
                if (result.credits > 0) {
                    licenseStatus.innerHTML = `Valid Key! You have ${result.credits} conversions remaining.`;
                    isLicenseValid = true;
                } else {
                    licenseStatus.innerHTML = `This license has no conversions left. <a href="${ETSY_STORE_LINK}" target="_blank">Top up your credits here.</a>`;
                    isLicenseValid = false;
                }
                licenseStatus.className = 'license-status-message valid';
            } else {
                licenseStatus.textContent = result.message || 'Invalid license key.';
                licenseStatus.className = 'license-status-message invalid';
                isLicenseValid = false;
            }
        } catch (error) {
            console.error(`License validation attempt ${attempt} failed:`, error);
            if (attempt < 3) {
                const delay = Math.pow(2, attempt) * 1000;
                setTimeout(() => validateLicenseWithRetries(key, attempt + 1), delay);
                return;
            }
            licenseStatus.textContent = 'Unable to verify key right now. Please try again in a moment.';
            licenseStatus.className = 'license-status-message invalid';
            isLicenseValid = false;
        } finally {
            if ((response && response.ok) || attempt >= 3 || isLicenseValid) {
                 checkLicenseAndToggleUI();
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

    // --- CONVERSION PROCESS ---
    const handleConversion = async () => {
        const licenseKey = licenseKeyInput.value.trim();
        if (!licenseKey || uploadedFiles.length === 0) return;

        const originalFilesForHistory = [...uploadedFiles];
        resetStatusUI();
        appStatus.style.display = 'block';
        progressBar.style.display = 'block';
        convertButton.disabled = true;
        licenseKeyInput.disabled = true;
        dropZone.classList.add('disabled');

        try {
            if (!VITE_CONVERT_API_ENDPOINT) {
                throw new Error("Convert API endpoint is not configured.");
            }
            updateProgress(10, 'Validating and preparing upload...');
            const formData = new FormData();
            formData.append('licenseKey', licenseKey);
            uploadedFiles.forEach(file => { formData.append('files', file); });

            updateProgress(30, 'Uploading and converting...');
            const response = await fetch(VITE_CONVERT_API_ENDPOINT, { method: 'POST', body: formData });
            const result = await response.json();

            if (!response.ok) throw new Error(result.message || 'An unknown error occurred.');

            updateProgress(100, 'Conversion successful! Your download will begin automatically.');
            
            const tempLink = document.createElement('a');
            tempLink.href = result.downloadUrl;
            tempLink.setAttribute('download', '');
            document.body.appendChild(tempLink);
            tempLink.click();
            document.body.removeChild(tempLink);

            sessionHistory.unshift({
                sourceFiles: originalFilesForHistory.map(f => f.name)
            });
            updateHistoryList();

            newConversionButton.style.display = 'block';
            progressBar.style.display = 'none';
            
            validateLicenseWithRetries(licenseKey);

        } catch (error) {
            console.error('Conversion Error:', error);
            showError(error.message);
            licenseKeyInput.disabled = false;
            checkLicenseAndToggleUI();
        }
    };
    
    const resetForNewConversion = () => {
        uploadedFiles = [];
        updateFileList();
        resetStatusUI();
        licenseKeyInput.disabled = false;
        checkLicenseAndToggleUI();
    };

    // --- HISTORY "RECEIPT" FUNCTIONS ---
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

    // --- HELPER FUNCTIONS ---
    const updateProgress = (percentage, message) => {
        progressFill.style.width = `${percentage}%`;
        statusMessage.textContent = message;
    };

    const showError = (message) => {
        statusMessage.textContent = `Error: ${message}`;
        statusMessage.style.color = '#dc3545';
        progressBar.style.display = 'none';
    };

    const resetStatusUI = () => {
        appStatus.style.display = 'none';
        progressFill.style.width = '0%';
        statusMessage.textContent = '';
        statusMessage.style.color = '';
        newConversionButton.style.display = 'none';
    };

    // --- ACCORDION & CONTACT FORM ---
    const setupAccordion = () => {
        document.querySelectorAll('.accordion-question').forEach(question => {
            question.addEventListener('click', () => {
                const item = question.parentElement;
                item.classList.toggle('open');
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
