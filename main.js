document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const SUPABASE_URL = 'https://grajrxurqeojuvrvzstz.supabase.co'; 
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyYWpyeHVycWVvanV2cnZ6c3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNDQ4MTIsImV4cCI6MjA3MTkyMDgxMn0.jPKh3z18iik94ToRazHgkx3_R5BE51H4ws6Wh_sgKOo';
    const CONVERT_API_ENDPOINT = 'https://artypacks-converter-backend.onrender.com/convert';
    const CHECK_API_ENDPOINT = 'https://artypacks-converter-backend.onrender.com/check-license';

    let supabaseClient;
    try {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY );
    } catch (error) {
        console.error("Supabase client could not be initialized.", error);
    }

    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key');
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
    const downloadLink = document.getElementById('download-link');
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    const currentYearSpan = document.getElementById('current-year');

    // --- STATE MANAGEMENT ---
    let uploadedFiles = [];
    let debounceTimer;
    let isLicenseValid = false; // Track license validity state

    // --- INITIALIZATION ---
    const initializeApp = () => {
        updateYear();
        setupEventListeners();
        checkLicenseAndToggleUI();
    };

    const updateYear = () => {
        if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    };

    // --- UI LOGIC & EVENT LISTENERS ---
    const setupEventListeners = () => {
        licenseKeyInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            licenseStatus.textContent = '';
            licenseStatus.className = 'license-status-message';
            isLicenseValid = false; // Reset validity on input change
            checkLicenseAndToggleUI();

            debounceTimer = setTimeout(() => {
                const key = licenseKeyInput.value.trim();
                if (key.length > 5) {
                    validateLicenseOnServer(key);
                }
            }, 500);
        });
        
        dropZone.addEventListener('click', () => !dropZone.classList.contains('disabled') && fileInput.click());
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('dragleave', handleDragLeave);
        dropZone.addEventListener('drop', handleDrop);
        fileInput.addEventListener('change', handleFileSelect);
        convertButton.addEventListener('click', handleConversion);
        setupAccordion();
        setupContactForm();
    };

    const checkLicenseAndToggleUI = () => {
        const hasLicense = licenseKeyInput.value.trim().length > 0;
        
        dropZone.classList.toggle('disabled', !isLicenseValid);
        dropZone.title = isLicenseValid ? '' : 'Please enter a valid license key to upload files.';

        const canConvert = isLicenseValid && uploadedFiles.length > 0;
        convertButton.disabled = !canConvert;
        
        // **FIX #4: DYNAMIC ACTIVATION NOTICE**
        activationNotice.style.display = 'block'; // Always show it
        if (!hasLicense) {
            activationNotice.textContent = 'Converter locked – enter license key above.';
        } else if (!isLicenseValid) {
            activationNotice.textContent = 'Validating key...';
        } else {
            activationNotice.textContent = 'This tool extracts stamp images (min 1024px). It does not convert complex brush textures.';
        }
    };

    async function validateLicenseOnServer(key) {
        try {
            licenseStatus.textContent = 'Checking...';
            licenseStatus.className = 'license-status-message';
            isLicenseValid = false;
            checkLicenseAndToggleUI();

            const response = await fetch(CHECK_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: key })
            });

            const result = await response.json();

            if (response.ok && result.isValid) {
                licenseStatus.textContent = `Valid Key! You have ${result.credits} conversions remaining.`;
                licenseStatus.className = 'license-status-message valid';
                isLicenseValid = true;
            } else {
                licenseStatus.textContent = result.message || 'Invalid license key.';
                licenseStatus.className = 'license-status-message invalid';
                isLicenseValid = false;
            }

        } catch (error) {
            console.error('License validation request failed:', error);
            licenseStatus.textContent = 'Unable to verify key right now.';
            licenseStatus.className = 'license-status-message invalid';
            isLicenseValid = false;
        } finally {
            checkLicenseAndToggleUI();
        }
    }

    // --- FILE HANDLING ---
    const handleDragOver = (e) => { e.preventDefault(); if (!dropZone.classList.contains('disabled')) dropZone.classList.add('dragover'); };
    const handleDragLeave = (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); };
    const handleDrop = (e) => {
        e.preventDefault();
        if (dropZone.classList.contains('disabled')) return;
        dropZone.classList.remove('dragover');
        processFiles(e.dataTransfer.files);
    };
    const handleFileSelect = (e) => { processFiles(e.target.files); };

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
        list.className = 'file-list-container'; // Add a class for styling
        uploadedFiles.forEach((file, index) => {
            const listItem = document.createElement('li');
            listItem.innerHTML = `<span>${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</span>`;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file-btn'; // Add class for styling
            removeBtn.innerHTML = '&times;'; // Use HTML entity for a better 'x'
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

        resetStatusUI();
        appStatus.style.display = 'block';
        progressBar.style.display = 'block';
        convertButton.disabled = true;
        statusMessage.textContent = 'Preparing your files...';

        try {
            updateProgress(10, 'Validating and preparing upload...');
            const formData = new FormData();
            formData.append('licenseKey', licenseKey);
            uploadedFiles.forEach(file => { formData.append('brushsets', file); });

            updateProgress(30, 'Uploading and converting...');
            const response = await fetch(CONVERT_API_ENDPOINT, { method: 'POST', body: formData });
            const result = await response.json();

            if (!response.ok) throw new Error(result.message || 'An unknown error occurred.');

            updateProgress(100, 'Conversion successful! Your download is ready.');
            downloadLink.href = result.downloadUrl;
            downloadLink.style.display = 'block';
            progressBar.style.display = 'none';

            // **FIX #1 & #2: RE-VALIDATE AND CLEAR LIST**
            // After a successful conversion, re-check the license to get the new credit count
            // and clear the file list for the next job.
            validateLicenseOnServer(licenseKey);
            uploadedFiles = []; // Clear the internal file array
            setTimeout(() => {
                updateFileList(); // Clear the UI file list after a short delay
                checkLicenseAndToggleUI();
            }, 1000);


        } catch (error) {
            console.error('Conversion Error:', error);
            showError(error.message);
            convertButton.disabled = false; // Re-enable button on error
        }
    };

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
        downloadLink.style.display = 'none';
        downloadLink.href = '#';
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
                alert('Sorry, there was an issue sending your message.');
            }
        });
    };

    // --- START THE APP ---
    initializeApp();
});
