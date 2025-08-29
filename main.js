document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const SUPABASE_URL = 'https://grajrxurqeojuvrvzstz.supabase.co'; 
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyYWpyeHVycWVvanV2cnZ6c3R6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTYzNDQ4MTIsImV4cCI6MjA3MTkyMDgxMn0.jPKh3z18iik94ToRazHgkx3_R5BE51H4ws6Wh_sgKOo';
    const CONVERT_API_ENDPOINT = 'https://artypacks-converter-backend.onrender.com/convert';
    const CHECK_API_ENDPOINT = 'https://artypacks-converter-backend.onrender.com/check-license';
    const ETSY_STORE_LINK = 'https://www.etsy.com/shop/artypacks'; // Your Etsy store link

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
    const downloadLink = document.getElementById('download-link');
    const newConversionButton = document.getElementById('new-conversion-button');
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    const currentYearSpan = document.getElementById('current-year');

    // --- STATE MANAGEMENT ---
    let uploadedFiles = [];
    let debounceTimer;
    let isLicenseValid = false;

    // --- INITIALIZATION ---
    const initializeApp = () => {
        if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
        setupEventListeners();
        checkLicenseAndToggleUI();
    };

    // --- UI LOGIC & EVENT LISTENERS ---
    const setupEventListeners = () => {
        licenseKeyInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            licenseStatus.innerHTML = ''; // Use innerHTML to clear potential links
            licenseStatus.className = 'license-status-message';
            isLicenseValid = false;
            checkLicenseAndToggleUI();
            debounceTimer = setTimeout(() => {
                const key = licenseKeyInput.value.trim();
                if (key.length > 5) validateLicenseOnServer(key);
            }, 500);
        });
        
        dropZone.addEventListener('click', () => !dropZone.classList.contains('disabled') && fileInput.click());
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); if (!dropZone.classList.contains('disabled')) dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dropZone.classList.contains('disabled')) return;
            dropZone.classList.remove('dragover');
            processFiles(e.dataTransfer.files);
        });
        fileInput.addEventListener('change', (e) => processFiles(e.target.files));
        convertButton.addEventListener('click', handleConversion);
        newConversionButton.addEventListener('click', resetForNewConversion);
        setupAccordion();
        setupContactForm();
    };

    const checkLicenseAndToggleUI = () => {
        const hasLicense = licenseKeyInput.value.trim().length > 0;
        
        dropZone.classList.toggle('disabled', !isLicenseValid);
        dropZone.title = isLicenseValid ? '' : 'Please enter a valid license key to upload files.';

        const canConvert = isLicenseValid && uploadedFiles.length > 0;
        convertButton.disabled = !canConvert;
        
        activationNotice.style.display = 'block';
        if (!hasLicense) {
            activationNotice.textContent = 'Converter locked – enter license key above.';
        } else if (!isLicenseValid && licenseStatus.textContent.includes('Invalid')) {
             activationNotice.textContent = 'Please enter a valid license key.';
        } else if (!isLicenseValid) {
            activationNotice.textContent = 'Validating key...';
        } else {
            activationNotice.textContent = 'This tool extracts stamp images (min 1024px). It does not convert complex brush textures.';
        }
    };

    async function validateLicenseOnServer(key) {
        try {
            licenseStatus.innerHTML = 'Checking...';
            licenseStatus.className = 'license-status-message';
            isLicenseValid = false;
            checkLicenseAndToggleUI();

            const response = await fetch(CHECK_API_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ licenseKey: key }) });
            const result = await response.json();

            if (response.ok && result.isValid) {
                if (result.credits > 0) {
                    licenseStatus.innerHTML = `Valid Key! You have ${result.credits} conversions remaining.`;
                    isLicenseValid = true;
                } else {
                    licenseStatus.innerHTML = `This license has no conversions left. <a href="${ETSY_STORE_LINK}" target="_blank">Top up your credits here.</a>`;
                    isLicenseValid = false; // No credits, so can't convert
                }
                licenseStatus.className = 'license-status-message valid';
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

        resetStatusUI();
        appStatus.style.display = 'block';
        progressBar.style.display = 'block';
        convertButton.disabled = true;
        licenseKeyInput.disabled = true;
        dropZone.classList.add('disabled');

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
            newConversionButton.style.display = 'block';
            progressBar.style.display = 'none';
            
            validateLicenseOnServer(licenseKey);

        } catch (error) {
            console.error('Conversion Error:', error);
            showError(error
