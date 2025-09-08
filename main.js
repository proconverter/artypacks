document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const VITE_CONVERT_API_ENDPOINT = "https://artypacks-converter-backend-sandbox.onrender.com/convert";
    const VITE_CHECK_API_ENDPOINT = "https://artypacks-converter-backend-sandbox.onrender.com/check-license";
    const VITE_RECOVER_API_ENDPOINT = "https://artypacks-converter-backend-sandbox.onrender.com/recover-link";
    const ETSY_STORE_LINK = 'https://www.etsy.com/shop/artypacks';
    const MAX_MULTI_UPLOAD = 10;

    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key'  );
    const licenseStatus = document.getElementById('license-status');
    const getLicenseLinkContainer = document.querySelector('.get-license-link');
    const convertButton = document.getElementById('convert-button');
    const activationNotice = document.getElementById('activation-notice');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileList = document.getElementById('file-list');
    const appTool = document.getElementById('app-tool');
    
    const downloadView = document.getElementById('download-view');
    const downloadFilename = document.getElementById('download-filename');
    const downloadFileButton = document.getElementById('download-file-button');
    const convertAnotherButton = document.getElementById('convert-another-button');

    const downloadSessionView = document.getElementById('download-session-view');
    const downloadSessionList = document.getElementById('download-session-list');
    const downloadAllButton = document.getElementById('download-all-button');
    const convertAnotherSessionButton = document.getElementById('convert-another-session-button');

    const dropZoneText = document.getElementById('drop-zone-text');
    const dropZoneLimits = document.getElementById('drop-zone-limits');
    const dropZoneError = document.getElementById('drop-zone-error');
    const fileUploadLabel = document.getElementById('file-upload-label');

    // --- STATE MANAGEMENT ---
    let uploadedFiles = [];
    let isLicenseValid = false;
    let validationController;
    let isConverting = false;
    let allConversionsComplete = false;
    let currentUserState = { type: 'none', credits: 0 };

    // --- INITIALIZATION ---
    const initializeApp = () => {
        document.getElementById('current-year').textContent = new Date().getFullYear();
        setupEventListeners();
        checkLicenseAndToggleUI();
        setupContactForm();
    };

    // --- EVENT LISTENERS ---
    const setupEventListeners = () => {
        licenseKeyInput.addEventListener('input', handleLicenseInput);
        dropZone.addEventListener('click', () => { if (!dropZone.classList.contains('disabled')) fileInput.click(); });
        dropZone.addEventListener('dragover', (e) => { e.preventDefault(); if (!dropZone.classList.contains('disabled')) dropZone.classList.add('dragover'); });
        dropZone.addEventListener('dragleave', (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
        dropZone.addEventListener('drop', handleDrop);
        fileInput.addEventListener('change', handleFileSelect);
        convertButton.addEventListener('click', handleConversionOrNavigation);
        convertAnotherButton.addEventListener('click', resetApp);
        convertAnotherSessionButton.addEventListener('click', resetApp);
        downloadAllButton.addEventListener('click', handleDownloadAll); // <-- **THE FIX IS HERE**
        setupAccordion();
    };

    const handleConversionOrNavigation = () => {
        if (allConversionsComplete) {
            const successfulConversions = uploadedFiles.filter(f => f.status === 'completed');
            if (currentUserState.type === 'single_credit') {
                showDownloadView(successfulConversions[0].downloadUrl, successfulConversions[0].originalFilename);
            } else {
                showDownloadSessionView();
            }
        } else {
            handleBatchConversion();
        }
    };

    // --- NEW: Handler for the "Download All" button ---
    const handleDownloadAll = () => {
        const successfulFiles = uploadedFiles.filter(f => f.status === 'completed');
        if (successfulFiles.length > 1) {
            successfulFiles.forEach(fileData => {
                triggerDownload(fileData.downloadUrl, fileData.originalFilename);
            });
        }
    };
    
    const handleLicenseInput = () => {
        if (validationController) validationController.abort();
        isLicenseValid = false;
        currentUserState = { type: 'none', credits: 0 };
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
        if (credits > 1) return `License is valid. You have <strong>${credits} credits</strong> remaining.`;
        if (credits === 1) return `License is valid. You have <strong>1 credit</strong> remaining.`;
        return `This license has no credits left. <a href="${ETSY_STORE_LINK}" target="_blank">Get a new one to convert another file.</a>`;
    };

    async function validateLicenseWithRetries(key) {
        if (validationController) validationController.abort();
        validationController = new AbortController();
        const signal = validationController.signal;
        
        licenseStatus.className = 'license-status-message checking';
        licenseStatus.textContent = 'Validating...';

        try {
            const response = await fetch(VITE_CHECK_API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ licenseKey: key }),
                signal
            });

            if (signal.aborted) return;

            const result = await response.json();

            if (response.ok && result.isValid) {
                isLicenseValid = true;
                currentUserState.type = result.user_type;
                currentUserState.credits = result.sessions_remaining;
                licenseStatus.className = 'license-status-message valid';
                licenseStatus.innerHTML = getCreditsMessage(result.sessions_remaining);

                if (result.sessions_remaining <= 0) {
                    const recoveryResponse = await fetch(VITE_RECOVER_API_ENDPOINT, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ licenseKey: key })
                    });
                    if (recoveryResponse.ok) {
                        const recoveryData = await recoveryResponse.json();
                        if (recoveryData.download_url) {
                           showDownloadView(recoveryData.download_url, recoveryData.original_filename);
                           return;
                        }
                    }
                }
            } else {
                isLicenseValid = false;
                licenseStatus.className = 'license-status-message invalid';
                licenseStatus.innerHTML = result.message || 'Invalid license key.';
            }
        } catch (error) {
            if (signal.aborted) return;
            isLicenseValid = false;
            licenseStatus.className = 'license-status-message invalid';
            licenseStatus.textContent = 'A server error occurred while validating the license.';
        } finally {
            if (!signal.aborted) {
                checkLicenseAndToggleUI();
            }
        }
    }

    const handleDrop = (e) => { e.preventDefault(); if (dropZone.classList.contains('disabled')) return; dropZone.classList.remove('dragover'); processFiles(e.dataTransfer.files); };
    const handleFileSelect = (e) => processFiles(e.target.files);

    const checkLicenseAndToggleUI = () => {
        const creditsAvailable = currentUserState.credits - uploadedFiles.length;
        const isDropZoneLocked = !isLicenseValid || creditsAvailable <= 0 || isConverting;
        
        dropZone.classList.toggle('disabled', isDropZoneLocked);
        
        if (isLicenseValid && currentUserState.credits <= 0) {
            getLicenseLinkContainer.classList.add('hidden');
        } else {
            getLicenseLinkContainer.classList.remove('hidden');
        }
        
        if (!isLicenseValid) {
            dropZone.title = 'Please enter a valid license key to upload files.';
            activationNotice.style.display = 'block';
            activationNotice.textContent = 'Converter locked – enter license key above.';
        } else if (isConverting) {
            dropZone.title = 'Conversion in progress...';
            activationNotice.style.display = 'none';
        } else if (currentUserState.credits <= 0) {
            dropZone.title = 'This license has no credits remaining.';
            activationNotice.style.display = 'block';
            activationNotice.textContent = 'No credits remaining on this license.';
        } else if (creditsAvailable <= 0) {
            dropZone.title = 'You have used all available slots for your credits. Remove a file to add another.';
            activationNotice.style.display = 'none';
        } else {
            dropZone.title = '';
            activationNotice.style.display = 'none';
        }

        convertButton.disabled = !((isLicenseValid && uploadedFiles.length > 0 && !isConverting) || allConversionsComplete);
        
        if (currentUserState.type === 'multi_credit') {
            fileInput.setAttribute('multiple', 'true');
            const filesLeftInSlot = MAX_MULTI_UPLOAD - uploadedFiles.length;
            const limit = Math.min(creditsAvailable, filesLeftInSlot);
            dropZoneText.innerHTML = `<strong>Drop up to ${limit} more .brushset files</strong>`;
            dropZoneLimits.textContent = `or click to upload (You have ${creditsAvailable} credits remaining)`;
            fileUploadLabel.textContent = 'Upload Your .brushset Files';
        } else {
            fileInput.removeAttribute('multiple');
            dropZoneText.innerHTML = '<strong>Drop a single .brushset file here</strong>';
            dropZoneLimits.textContent = 'or click to upload (1 credit will be used)';
            fileUploadLabel.textContent = 'Upload Your .brushset File';
        }
    };

    const processFiles = (files) => {
        dropZoneError.style.display = 'none';
        dropZoneError.textContent = '';
        const filesToAdd = Array.from(files);
        const totalFilesAfterAdd = uploadedFiles.length + filesToAdd.length;

        if (currentUserState.type === 'single_credit' && totalFilesAfterAdd > 1) {
            dropZoneError.textContent = 'Error: Please upload only one file at a time with a single-credit license.';
            dropZoneError.style.display = 'block';
            return;
        }
        if (currentUserState.type === 'multi_credit') {
            if (totalFilesAfterAdd > MAX_MULTI_UPLOAD) {
                dropZoneError.textContent = `Error: You can only queue a maximum of ${MAX_MULTI_UPLOAD} files at a time.`;
                dropZoneError.style.display = 'block';
                return;
            }
            if (totalFilesAfterAdd > currentUserState.credits) {
                dropZoneError.textContent = `Error: This would exceed your credit limit. You have ${currentUserState.credits} credits and are trying to queue ${totalFilesAfterAdd} files.`;
                dropZoneError.style.display = 'block';
                return;
            }
        }

        for (const file of filesToAdd) {
            if (file.name.endsWith('.brushset')) {
                uploadedFiles.push({ file: file, status: 'queued', downloadUrl: '', originalFilename: '', message: '' });
            } else {
                alert(`Invalid file type: ${file.name}. Only .brushset files are allowed.`);
            }
        }
        
        updateFileList();
        checkLicenseAndToggleUI();
    };

    const updateFileList = () => {
        fileList.innerHTML = '';
        if (uploadedFiles.length === 0) {
            fileList.classList.add('hidden');
            return;
        }
        fileList.classList.remove('hidden');
        
        uploadedFiles.forEach((fileData, index) => {
            const listItem = document.createElement('li');
            listItem.id = `file-item-${index}`;
            
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            const fileSize = (fileData.file.size / 1024 / 1024).toFixed(2);
            fileInfo.innerHTML = `<span>${fileData.file.name} (${fileSize} MB)</span>`;
            
            const statusContainer = document.createElement('div');
            statusContainer.className = 'status-container';

            const statusBadge = document.createElement('span');
            statusBadge.className = `file-status ${fileData.status}`;
            statusBadge.textContent = fileData.status.charAt(0).toUpperCase() + fileData.status.slice(1);
            
            const progressBar = document.createElement('div');
            progressBar.className = 'queue-progress-bar';
            progressBar.innerHTML = `<div class="queue-progress-fill"></div>`;
            
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-file-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'Remove file';
            removeBtn.onclick = () => removeFile(index);
            if (isConverting || allConversionsComplete) removeBtn.style.display = 'none';

            statusContainer.appendChild(statusBadge);
            statusContainer.appendChild(progressBar);

            listItem.appendChild(fileInfo);
            listItem.appendChild(statusContainer);
            listItem.appendChild(removeBtn);
            fileList.appendChild(listItem);
        });
    };

    const removeFile = (indexToRemove) => {
        uploadedFiles.splice(indexToRemove, 1);
        fileInput.value = '';
        updateFileList();
        checkLicenseAndToggleUI();
    };

    async function handleBatchConversion() {
        isConverting = true;
        checkLicenseAndToggleUI();
        updateFileList();
        convertButton.textContent = 'Converting... Please Wait';

        for (let i = 0; i < uploadedFiles.length; i++) {
            const fileData = uploadedFiles[i];
            if (fileData.status !== 'queued') continue;
            
            fileData.status = 'converting';
            updateFileStatusUI(i, 'converting', 0);
            
            try {
                const result = await convertSingleFile(fileData.file, i);
                fileData.status = 'completed';
                fileData.downloadUrl = result.downloadUrl;
                fileData.originalFilename = result.originalFilename;
                
                currentUserState.credits--;
                licenseStatus.innerHTML = getCreditsMessage(currentUserState.credits);
                
                updateFileStatusUI(i, 'completed', 100);

            } catch (error) {
                fileData.status = 'error';
                fileData.message = error.message;
                updateFileStatusUI(i, 'error', 0, error.message);
            }
        }

        isConverting = false;
        const successfulConversions = uploadedFiles.filter(f => f.status === 'completed');
        
        if (successfulConversions.length > 0) {
            allConversionsComplete = true;
            convertButton.textContent = 'Go to Downloads';
            checkLicenseAndToggleUI();
            updateFileList();
        } else {
            alert("All conversions failed. Please check the errors and try again.");
            resetApp();
        }
    }

    function convertSingleFile(file, index) {
        return new Promise((resolve, reject) => {
            const licenseKey = licenseKeyInput.value.trim();
            const formData = new FormData();
            formData.append('licenseKey', licenseKey);
            formData.append('file', file);

            const xhr = new XMLHttpRequest();
            xhr.open('POST', VITE_CONVERT_API_ENDPOINT, true);

            xhr.upload.onprogress = (event) => {
                if (event.lengthComputable) {
                    const uploadProgress = 10 + (event.loaded / event.total) * 80;
                    updateFileStatusUI(index, 'converting', uploadProgress);
                }
            };

            xhr.onload = () => {
                try {
                    const result = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        updateFileStatusUI(index, 'converting', 100);
                        resolve(result);
                    } else {
                        reject(new Error(result.message || 'An unknown error occurred.'));
                    }
                } catch (e) {
                    reject(new Error('An unexpected server response was received.'));
                }
            };

            xhr.onerror = () => {
                reject(new Error('A network error occurred. Please check your connection.'));
            };

            updateFileStatusUI(index, 'converting', 10);
            xhr.send(formData);
        });
    }

    function updateFileStatusUI(index, status, progress, message = '') {
        const listItem = document.getElementById(`file-item-${index}`);
        if (!listItem) return;
        
        const statusBadge = listItem.querySelector('.file-status');
        const progressBar = listItem.querySelector('.queue-progress-bar');
        const progressBarFill = listItem.querySelector('.queue-progress-fill');
        
        statusBadge.className = `file-status ${status}`;
        progressBar.style.display = 'none';

        if (status === 'converting') {
            statusBadge.textContent = 'Converting...';
            progressBar.style.display = 'block';
            progressBarFill.style.width = `${progress}%`;
        } else if (status === 'completed') {
            statusBadge.textContent = 'Ready';
            progressBar.style.display = 'none';
        } else if (status === 'error') {
            statusBadge.textContent = 'Error';
            listItem.title = message;
        } else {
            statusBadge.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        }
    }

    const showDownloadView = (url, filename) => {
        appTool.classList.add('hidden');
        downloadSessionView.classList.add('hidden');
        downloadView.classList.remove('hidden');
        downloadFilename.textContent = filename;
        downloadFileButton.onclick = () => {
            triggerDownload(url, filename);
        };
    };

    const showDownloadSessionView = () => {
        appTool.classList.add('hidden');
        downloadView.classList.add('hidden');
        downloadSessionView.classList.remove('hidden');
        downloadSessionList.innerHTML = '';

        const successfulFiles = uploadedFiles.filter(f => f.status === 'completed');

        successfulFiles.forEach(fileData => {
            const listItem = document.createElement('li');
            
            const filenameSpan = document.createElement('span');
            filenameSpan.className = 'filename';
            filenameSpan.textContent = fileData.originalFilename;
            
            const downloadLink = document.createElement('a');
            downloadLink.className = 'download-link';
            downloadLink.textContent = 'Download';
            downloadLink.onclick = () => {
                triggerDownload(fileData.downloadUrl, fileData.originalFilename);
            };

            listItem.appendChild(filenameSpan);
            listItem.appendChild(downloadLink);
            downloadSessionList.appendChild(listItem);
        });

        downloadAllButton.style.display = successfulFiles.length > 1 ? 'inline-block' : 'none';
    };
    
    const triggerDownload = (url, filename) => {
        const link = document.createElement('a');
        link.href = url;
        const baseName = filename.replace(/\.brushset$/, '');
        link.download = `ArtyPacks.app_${baseName}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const resetApp = () => {
        if (validationController) {
            validationController.abort();
        }

        downloadView.classList.add('hidden');
        downloadSessionView.classList.add('hidden');
        
        uploadedFiles = [];
        isConverting = false;
        allConversionsComplete = false;
        fileInput.value = '';
        
        licenseKeyInput.disabled = false;
        licenseKeyInput.value = '';
        licenseStatus.innerHTML = '';
        
        isLicenseValid = false;
        currentUserState = { type: 'none', credits: 0 };
        
        appTool.classList.remove('hidden');
        
        updateFileList();
        checkLicenseAndToggleUI();
        convertButton.textContent = 'Convert Your Brushset';
    };

    const setupAccordion = () => {
        document.querySelectorAll('.accordion-question, .footer-accordion-trigger').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                const item = e.currentTarget.closest('.accordion-item, .footer-accordion-item');
                if (item) item.classList.toggle('open');
            });
        });
    };

    const setupContactForm = () => {
        const contactForm = document.getElementById('contact-form');
        if (!contactForm) return;
        const formStatus = document.getElementById('form-status');
        
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(contactForm);
            
            try {
                const response = await fetch(contactForm.action, { 
                    method: 'POST', 
                    body: formData, 
                    headers: { 'Accept': 'application/json' } 
                });
                
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
