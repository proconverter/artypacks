document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = window.env.VITE_CONVERT_API_ENDPOINT;
    const VITE_CHECK_API_ENDPOINT = window.env.VITE_CHECK_API_ENDPOINT;

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
    const historySection = document.getElementById('history-section');
    const historyList = document.getElementById('history-list');
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    const currentYearSpan = document.getElementById('current-year');
    const newConversionButton = document.getElementById('new-conversion-button');

    // --- STATE MANAGEMENT ---
    const appState = {
        isLicenseValid: false,
        filesToUpload: []
    };
    let validationController;
    let messageIntervalId;
    let sessionHistory = [];
    let debounceTimeout;

    // --- CORE UI LOGIC ---
    function updateUIState() {
        convertButton.disabled = !appState.isLicenseValid;
        dropZone.classList.toggle('disabled', !appState.isLicenseValid);
        dropZone.title = appState.isLicenseValid ? '' : 'Please enter a valid license key to upload files.';
        
        fileList.innerHTML = '';
        if (appState.filesToUpload.length > 0) {
            fileList.classList.remove('hidden');
            appState.filesToUpload.forEach(fileWrapper => {
                const listItem = document.createElement('li');
                listItem.innerHTML = `
                    <span>${fileWrapper.fileObject.name}</span>
                    <button class="remove-file-btn" data-id="${fileWrapper.id}">×</button>
                `;
                fileList.appendChild(listItem);
            });
        } else {
            fileList.classList.add('hidden');
        }
        
        if (!appState.isLicenseValid) {
            activationNotice.textContent = 'Converter locked – enter license key above.';
        } else {
            if (appState.filesToUpload.length === 0) {
                 activationNotice.textContent = 'Ready. Please add one or more .brushset files.';
            } else {
                 activationNotice.textContent = `Ready to convert ${appState.filesToUpload.length} file(s).`;
            }
        }
    }

    // --- STATE-MODIFYING FUNCTIONS ---
    function addFiles(incomingFiles) {
        const newFiles = Array.from(incomingFiles)
            .filter(file => file.name.endsWith('.brushset'))
            .map(file => ({ id: `file-${Date.now()}-${Math.random()}`, fileObject: file }));

        if (newFiles.length === 0 && incomingFiles.length > 0) {
            alert("Invalid file type. Please upload only .brushset files.");
            return;
        }
        
        const updatedFiles = [...appState.filesToUpload, ...newFiles];
        appState.filesToUpload = updatedFiles.slice(0, 3);
        updateUIState();
    }

    function removeFile(fileId) {
        appState.filesToUpload = appState.filesToUpload.filter(f => f.id !== fileId);
        updateUIState();
    }

    async function validateLicense(key, isPostConversion = false) {
        if (validationController) validationController.abort();
        clearInterval(messageIntervalId);
        
        validationController = new AbortController();
        const signal = validationController.signal;

        try {
            const response = await fetch(VITE_CHECK_API_ENDPOINT, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ licenseKey: key }), 
                signal 
            });
            
            const result = await response.json();
            
            if (response.ok && result.isValid) {
                appState.isLicenseValid = true;
                licenseStatus.className = 'license-status-message valid';
                licenseStatus.innerHTML = `You have ${result.credits} conversion${result.credits === 1 ? '' : 's'} left.`;
            } else {
                appState.isLicenseValid = false;
                licenseStatus.className = 'license-status-message invalid';
                licenseStatus.innerHTML = result.message || 'Invalid license key.';
            }
        } catch (error) {
            if (error.name === 'AbortError') return;
            appState.isLicenseValid = false;
            licenseStatus.className = 'license-status-message invalid';
            licenseStatus.innerHTML = 'Could not connect to validation server.';
        }
        
        updateUIState();
    }

    // --- EVENT LISTENERS AND HANDLERS ---
    function setupEventListeners() {
        licenseKeyInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimeout);
            const key = e.target.value.trim();

            if (key.length > 10) {
                debounceTimeout = setTimeout(() => {
                    validateLicense(key);
                }, 500);
            } else {
                appState.isLicenseValid = false;
                licenseStatus.innerHTML = '';
                updateUIState();
            }
        });

        dropZone.addEventListener('click', () => { if (!dropZone.classList.contains('disabled')) fileInput.click(); });
        fileInput.addEventListener('change', (e) => {
            addFiles(e.target.files);
            e.target.value = null;
        });
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dropZone.classList.contains('disabled')) return;
            addFiles(e.dataTransfer.files);
        });

        fileList.addEventListener('click', (event) => {
            if (event.target.classList.contains('remove-file-btn')) {
                removeFile(event.target.getAttribute('data-id'));
            }
        });
        
        convertButton.addEventListener('click', handleConversion);
        newConversionButton.addEventListener('click', resetForNewConversion);
        
        // --- ACCORDION LOGIC (CORRECTED) ---
        // This is the corrected section. It uses the same reliable logic as before.
        document.querySelectorAll('.accordion-question, .footer-accordion-trigger').forEach(trigger => {
            trigger.addEventListener('click', () => {
                // The .closest() method is the key to making this work for both
                // the main FAQ and the special footer structure.
                const item = trigger.closest('.accordion-item, .footer-accordion-item');
                if (item) {
                    item.classList.toggle('open');
                }
            });
        });
    }

    // --- FULL CONVERSION LOGIC ---
    function handleConversion() {
        if (appState.filesToUpload.length === 0) {
            alert('Please add one or more .brushset files to convert.');
            return;
        }

        const licenseKey = licenseKeyInput.value.trim();
        convertButton.disabled = true;
        licenseKeyInput.disabled = true;
        dropZone.classList.add('disabled');
        appStatus.style.display = 'block';
        progressBar.style.display = 'block';
        progressFill.style.width = '0%';
        statusMessage.textContent = '';

        const formData = new FormData();
        formData.append('licenseKey', licenseKey);
        appState.filesToUpload.forEach(fileWrapper => { formData.append('files', fileWrapper.fileObject); });

        const xhr = new XMLHttpRequest();
        xhr.open('POST', VITE_CONVERT_API_ENDPOINT, true);

        xhr.upload.onprogress = (event) => { 
            if (event.lengthComputable) { 
                const percentage = 10 + (event.loaded / event.total) * 80;
                progressFill.style.width = `${percentage}%`;
                statusMessage.textContent = 'Uploading and converting...';
            } 
        };

        xhr.onload = async () => {
            try {
                const result = JSON.parse(xhr.responseText);
                if (xhr.status >= 200 && xhr.status < 300) {
                    progressBar.style.display = 'none';
                    const tempLink = document.createElement('a');
                    tempLink.href = result.downloadUrl;
                    tempLink.setAttribute('download', '');
                    document.body.appendChild(tempLink);
                    tempLink.click();
                    document.body.removeChild(tempLink);
                    
                    appState.filesToUpload = [];
                    await validateLicense(licenseKey, true);
                    statusMessage.textContent = 'Download success!';
                    newConversionButton.style.display = 'block';
                    convertButton.style.display = 'none';
                } else {
                    showError(result.message || 'An unknown error occurred.');
                }
            } catch (e) {
                showError('An unexpected server response was received.');
            }
        };

        xhr.onerror = () => {
            showError('A network error occurred. Please check your connection and try again.');
        };

        progressFill.style.width = '10%';
        statusMessage.textContent = 'Validating and preparing upload...';
        xhr.send(formData);
    }

    function showError(message) {
        statusMessage.textContent = `Error: ${message}`;
        statusMessage.style.color = '#dc2626';
        progressBar.style.display = 'none';
        licenseKeyInput.disabled = false;
        convertButton.disabled = false;
        updateUIState();
    }

    function resetForNewConversion() {
        appStatus.style.display = 'none';
        newConversionButton.style.display = 'none';
        convertButton.style.display = 'block';
        licenseKeyInput.disabled = false;
        updateUIState();
    }

    // --- INITIALIZATION ---
    if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    setupEventListeners();
    updateUIState();
});
