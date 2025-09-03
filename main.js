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
    // ... other selectors are not relevant to the core bug

    // --- STATE MANAGEMENT ---
    const appState = {
        isLicenseValid: false,
        filesToUpload: [] // The array of file wrappers { id, fileObject }
    };

    // --- THE ONE FUNCTION TO RULE THEM ALL ---
    // This single function is responsible for making the UI match the state.
    function refreshUI() {
        // 1. Update Button State
        const licenseOk = appState.isLicenseValid;
        const filesPresent = appState.filesToUpload.length > 0;
        convertButton.disabled = !(licenseOk && filesPresent);

        // 2. Update Drop Zone State
        dropZone.classList.toggle('disabled', !licenseOk);
        dropZone.title = licenseOk ? '' : 'Please enter a valid license key to upload files.';
        
        // 3. Update File List DOM
        fileList.innerHTML = ''; // Always clear first
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
    }

    // --- STATE-MODIFYING FUNCTIONS (Now brutally simple) ---

    function addFiles(incomingFiles) {
        const newFiles = Array.from(incomingFiles)
            .filter(file => file.name.endsWith('.brushset'))
            .map(file => ({ id: `file-${Date.now()}-${Math.random()}`, fileObject: file }));

        if (newFiles.length === 0 && incomingFiles.length > 0) {
            alert("Invalid file type. Please upload only .brushset files.");
            return; // Do not change state
        }

        // Create a new array, don't just push
        const updatedFiles = [...appState.filesToUpload, ...newFiles];
        
        // Enforce the limit
        appState.filesToUpload = updatedFiles.slice(0, 3);

        // ALWAYS refresh the entire UI after changing state
        refreshUI();
    }

    function removeFile(fileId) {
        // Create a new array by filtering
        appState.filesToUpload = appState.filesToUpload.filter(f => f.id !== fileId);
        
        // ALWAYS refresh the entire UI after changing state
        refreshUI();
    }

    function setLicenseValidity(isValid) {
        appState.isLicenseValid = isValid;
        
        // Update license-specific text
        if (isValid) {
            licenseStatus.innerHTML = 'License Valid'; // Simplified
            licenseStatus.className = 'license-status-message valid';
            activationNotice.textContent = 'This tool extracts stamp images (min 1024px).';
        } else {
            licenseStatus.innerHTML = 'Invalid License'; // Simplified
            licenseStatus.className = 'license-status-message invalid';
            activationNotice.textContent = 'Converter locked – enter license key above.';
        }

        // ALWAYS refresh the entire UI after changing state
        refreshUI();
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        // License Input
        licenseKeyInput.addEventListener('input', (e) => {
            // Simplified for this fix: any key > 5 chars is valid
            setLicenseValidity(e.target.value.trim().length > 5);
        });

        // File Input (Click, Drop, etc.)
        dropZone.addEventListener('click', () => { if (!dropZone.classList.contains('disabled')) fileInput.click(); });
        fileInput.addEventListener('change', (e) => {
            addFiles(e.target.files);
            e.target.value = null; // CRITICAL: Reset the input
        });
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (dropZone.classList.contains('disabled')) return;
            addFiles(e.dataTransfer.files);
        });

        // File List (Remove button)
        fileList.addEventListener('click', (event) => {
            if (event.target.classList.contains('remove-file-btn')) {
                const idToRemove = event.target.getAttribute('data-id');
                removeFile(idToRemove);
            }
        });
    }

    // --- INITIALIZATION ---
    if (currentYearSpan) currentYearSpan.textContent = new Date().getFullYear();
    setupEventListeners();
    refreshUI(); // Initial call to set the correct initial state
});
