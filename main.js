document.addEventListener('DOMContentLoaded', () => {
    // --- SUPABASE & API CONFIGURATION ---
    const SUPABASE_URL = 'YOUR_SUPABASE_URL'; 
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    const CONVERT_API_ENDPOINT = 'https://artypacks-converter-backend.onrender.com/convert';
    const CHECK_API_ENDPOINT = 'https://artypacks-converter-backend.onrender.com/check-license';

    let supabase;
    try {
        supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY );
    } catch (error) {
        console.error("Supabase client could not be initialized. API calls to Supabase from the frontend will fail.", error);
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
    const MAX_FILES = 3;
    const MAX_SIZE_MB = 50;

    // --- INITIALIZATION ---
    const initializeApp = () => {
        updateYear();
        setupEventListeners();
        checkLicenseAndToggleUI();
    };

    const updateYear = () => {
        if (currentYearSpan) {
            currentYearSpan.textContent = new Date().getFullYear();
        }
    };

    // --- UI LOGIC & EVENT LISTENERS ---
    const setupEventListeners = () => {
        // New listener with real-time validation
        licenseKeyInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            licenseStatus.textContent = '';
            licenseStatus.className = 'license-status-message';
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
        
        if (hasLicense) {
            dropZone.classList.remove('disabled');
            dropZone.title = '';
        } else {
            dropZone.classList.add('disabled');
            dropZone.title = 'Please enter a license key to upload files.';
        }

        const canConvert = hasLicense && uploadedFiles.length > 0;
        convertButton.disabled = !canConvert;
        
        activationNotice.style.display = canConvert ? 'none' : 'block';
    };

    async function validateLicenseOnServer(key) {
        try {
            licenseStatus.textContent = 'Checking...';
            licenseStatus.className = 'license-status-message';

            const response = await fetch(CHECK_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: key })
            });

            const result = await response.json();

            if (response.ok && result.isValid) {
                licenseStatus.textContent = `Valid Key! You have ${result.credits} conversions remaining.`;
                licenseStatus.className = 'license-status-message valid';
            } else {
                licenseStatus.textContent = result.message || 'Invalid license key.';
                licenseStatus.className = 'license-status-message invalid';
            }

        } catch (error) {
            console.error('License validation request failed:', error);
            licenseStatus.textContent = 'Unable to verify key right now.';
            licenseStatus.className = 'license-status-message invalid';
        }
    }

    // --- FILE HANDLING ---
    const handleDragOver = (e) => {
        e.preventDefault();
        if (!dropZone.classList.contains('disabled')) {
            dropZone.classList.add('dragover');
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
    };

    const handleDrop = (e) => {
        e.preventDefault();
        if (dropZone.classList.contains('disabled')) return;
        dropZone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        processFiles(files);
    };

    const handleFileSelect = (e) => {
        const files = e.target.files;
        processFiles(files);
    };

    const processFiles = (files) => {
        let newFiles = Array.from(files).filter(file => file.name.endsWith('.brushset'));
        
        if (newFiles.length === 0 && files.length > 0) {
            alert("Invalid file type. Please upload only .brushset files.");
            return;
        }

        uploadedFiles = [...uploadedFiles, ...newFiles].slice(0, MAX_FILES);
        
        updateFileList();
        checkLicenseAndToggleUI();
    };

    const updateFileList = () => {
        fileList.innerHTML = '';
        if (uploadedFiles.length === 0) return;

        const list = document.createElement('ul');
        uploadedFiles.forEach((file, index) => {
            const listItem = document.createElement('li');
            listItem.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
            
            const removeBtn = document.createElement('button');
            removeBtn.textContent = '×';
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
        convertButton.disabled =
