document.addEventListener('DOMContentLoaded', () => {
    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key');
    const licenseStatus = document.getElementById('license-status');
    const convertButton = document.getElementById('convert-button');
    const activationNotice = document.getElementById('activation-notice');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const currentYearSpan = document.getElementById('current-year');
    // Restore full functionality selectors
    const VITE_CHECK_API_ENDPOINT = window.env.VITE_CHECK_API_ENDPOINT;
    let validationController;
    let messageIntervalId;

    // --- STATE MANAGEMENT ---
    const appState = {
        isLicenseValid: false,
        filesToUpload: []
    };

    // --- THE ONE FUNCTION TO RULE THEM ALL ---
    function refreshUI() {
        // 1. Update Button State
        const licenseOk = appState.isLicenseValid;
        const filesPresent = appState.filesToUpload.length > 0;
        convertButton.disabled = !(licenseOk && filesPresent);

        // 2. Update Drop Zone State
        dropZone.classList.toggle('disabled', !licenseOk);
        dropZone.title = licenseOk ? '' : 'Please enter a valid license key to upload files.';
        
        // 3. Update File List DOM
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
        
        // 4. Update Activation Notice
        if (!licenseOk) {
            activationNotice.textContent = 'Converter locked – enter license key above.';
        } else {
            activationNotice.textContent = 'This tool extracts stamp images (min 1024px).';
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
        refreshUI();
    }

    function removeFile(fileId) {
        appState.filesToUpload = appState.filesToUpload.filter(f => f.id !== fileId);
        refreshUI();
    }

    // RESTORED: Full license validation logic
    async function validateLicense(key) {
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
        
        refreshUI();
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        licenseKeyInput.addEventListener('input', (e) => {
            const key = e.target.value.trim();
            if (key.length > 5) {
                validateLicense(key);
            } else {
                appState.isLicenseValid = false;
                licenseStatus.innerHTML = '';
                refreshUI();
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
        
        // Simplified accordion setup
        document.querySelectorAll('.accordion-question, .footer-accordion-trigger').forEach(trigger => {
            trigger.addEventListener('click', () => {
                const item = trigger.closest('.accordion-item, .footer-accordion-item');
                if (item) item.classList.toggle('open');
            });
        });
    }

    // --- INITIALIZATION ---
    if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    setupEventListeners();
    refreshUI();
});
