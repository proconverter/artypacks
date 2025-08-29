document.addEventListener('DOMContentLoaded', () => {
    // --- SUPABASE & API CONFIGURATION ---
    // IMPORTANT: Replace with your actual Supabase URL and Anon Key.
    // It's recommended to use environment variables for this in a real-world scenario.
    const SUPABASE_URL = 'YOUR_SUPABASE_URL'; 
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
    const API_ENDPOINT = 'YOUR_CONVERSION_API_ENDPOINT'; // e.g., your serverless function URL

    let supabase;
    try {
        supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
        console.error("Supabase initialization failed. Please check your URL and Key.", error);
    }

    // --- DOM ELEMENT SELECTORS ---
    const licenseKeyInput = document.getElementById('license-key');
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
        licenseKeyInput.addEventListener('input', checkLicenseAndToggleUI);
        
        dropZone.addEventListener('click', () => fileInput.click());
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
        
        // Toggle Drop Zone
        if (hasLicense) {
            dropZone.classList.remove('disabled');
            dropZone.title = '';
        } else {
            dropZone.classList.add('disabled');
            dropZone.title = 'Please enter a license key to upload files.';
        }

        // Toggle Convert Button
        const canConvert = hasLicense && uploadedFiles.length > 0;
        convertButton.disabled = !canConvert;
        
        // Toggle Activation Notice
        activationNotice.style.display = canConvert ? 'none' : 'block';
    };

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
        dropZone.classList.remove('dragover');
        if (!dropZone.classList.contains('disabled')) {
            const files = e.dataTransfer.files;
            processFiles(files);
        }
    };

    const handleFileSelect = (e) => {
        const files = e.target.files;
        processFiles(files);
    };

    const processFiles = (files) => {
        let newFiles = Array.from(files).filter(file => file.name.endsWith('.brushset'));
        
        // Simple validation feedback
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

        // 1. Reset UI
        resetStatusUI();
        appStatus.style.display = 'block';
        progressBar.style.display = 'block';
        convertButton.disabled = true;
        statusMessage.textContent = 'Preparing your files...';

        try {
            // 2. Validate License Key (Example with Supabase)
            updateProgress(10, 'Validating your license key...');
            if (!supabase) throw new Error("Database client is not available.");

            const { data, error } = await supabase
                .from('licenses')
                .select('credits')
                .eq('key', licenseKey)
                .single();

            if (error || !data || data.credits < 1) {
                throw new Error('Invalid or expired license key. Please check your key or purchase new credits.');
            }
            
            // 3. Upload files and get download URL
            updateProgress(30, 'Uploading and converting...');
            
            const formData = new FormData();
            formData.append('licenseKey', licenseKey);
            uploadedFiles.forEach(file => {
                formData.append('brushsets', file);
            });

            // This is where you call your backend API (e.g., a serverless function)
            const response = await fetch(API_ENDPOINT, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Conversion failed on the server.');
            }

            const result = await response.json();

            // 4. Show success and download link
            updateProgress(100, 'Conversion successful! Your download is ready.');
            downloadLink.href = result.downloadUrl;
            downloadLink.style.display = 'block';
            progressBar.style.display = 'none'; // Hide progress bar on completion

        } catch (error) {
            console.error('Conversion Error:', error);
            showError(error.message);
        } finally {
            // Re-enable button unless successful
            if (downloadLink.style.display !== 'block') {
                convertButton.disabled = false;
            }
        }
    };

    const updateProgress = (percentage, message) => {
        progressFill.style.width = `${percentage}%`;
        statusMessage.textContent = message;
    };

    const showError = (message) => {
        statusMessage.textContent = `Error: ${message}`;
        statusMessage.style.color = '#dc3545'; // A standard error color
        progressBar.style.display = 'none';
    };


    const resetStatusUI = () => {
        appStatus.style.display = 'none';
        progressBar.style.display = 'none';
        progressFill.style.width = '0%';
        statusMessage.textContent = '';
        statusMessage.style.color = ''; // Reset color
        downloadLink.style.display = 'none';
        downloadLink.href = '#';
    };

    // --- ACCORDION ---
    const setupAccordion = () => {
        const accordionItems = document.querySelectorAll('.accordion-item');
        accordionItems.forEach(item => {
            const question = item.querySelector('.accordion-question');
            question.addEventListener('click', () => {
                const isOpen = item.classList.contains('open');
                // Optional: Close all others
                // accordionItems.forEach(other => other.classList.remove('open'));
                if (!isOpen) {
                    item.classList.add('open');
                } else {
                    item.classList.remove('open');
                }
            });
        });
    };

    // --- CONTACT FORM ---
    const setupContactForm = () => {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(contactForm);
            
            try {
                const response = await fetch(contactForm.action, {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
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

    // --- START THE APP ---
    initializeApp();
});
