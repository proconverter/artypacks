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
    let validationController;
    let messageIntervalId;

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
        if (validationController) validationController.abort();
        clearInterval(messageIntervalId);
        isLicenseValid = false;
        checkLicenseAndToggleUI();
        const key = licenseKeyInput.value.trim();
        if (key.length > 5) {
            validateLicenseWithRetries(key);
        } else {
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
            messages = [ `You’ve used all your conversions. <a href="${ETSY_STORE_LINK}" target="_blank">Pick up a new pack here.</a>`, `Out of conversions
