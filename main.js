// Wait for the entire HTML document to be loaded and parsed
document.addEventListener('DOMContentLoaded', () => {

    // --- ACTION REQUIRED: Add your Supabase credentials here ---
    const SUPABASE_URL = 'YOUR_SUPABASE_URL'; // Find this in your Supabase project settings
    const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // Find this in your Supabase project settings

    // Initialize Supabase client
    let supabase;
    try {
        supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } catch (error) {
        console.error("Error initializing Supabase:", error);
        // If Supabase fails to init, we can't proceed.
        // You might want to show an error message to the user here.
    }

    // --- Element Selectors ---
    const licenseKeyInput = document.getElementById('license-key');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const convertButton = document.getElementById('convert-button');
    const activationNotice = document.getElementById('activation-notice');
    
    // --- Initial State Setup ---
    // Start with the converter disabled
    function setConverterDisabled(isDisabled) {
        if (isDisabled) {
            dropZone.classList.add('disabled');
            fileInput.disabled = true;
            convertButton.disabled = true;
            activationNotice.style.display = 'block';
        } else {
            dropZone.classList.remove('disabled');
            fileInput.disabled = false;
            // Note: Convert button is handled separately based on file selection
            activationNotice.style.display = 'none';
        }
    }
    
    // Set the initial disabled state on page load
    setConverterDisabled(true);

    // --- License Key Validation Logic ---
    licenseKeyInput.addEventListener('input', async () => {
        const key = licenseKeyInput.value.trim();

        // Basic check: if key is empty, disable everything and return
        if (key.length === 0) {
            setConverterDisabled(true);
            return;
        }

        // This is a simple check. For real validation, you'd call Supabase.
        // Let's simulate the Supabase check.
        try {
            // **This is where you query your Supabase table**
            // Example: Check a 'licenses' table for a matching key
            const { data, error } = await supabase
                .from('licenses') // IMPORTANT: Replace 'licenses' with your actual table name
                .select('key, uses_left') // Select the columns you need
                .eq('key', key) // Find the row where the 'key' column matches the input
                .single(); // We expect only one result

            if (error && error.code !== 'PGRST116') {
                // PGRST116 means no rows were found, which is not a server error.
                // Any other error is a real problem.
                throw error;
            }

            if (data && data.uses_left > 0) {
                // Key is valid and has uses left!
                console.log('License key is valid!');
                setConverterDisabled(false);
                licenseKeyInput.style.borderColor = 'green';
            } else {
                // Key is invalid or has no uses left
                console.log('License key is invalid or has no uses left.');
                setConverterDisabled(true);
                licenseKeyInput.style.borderColor = 'red';
            }
        } catch (err) {
            console.error('Error validating license key:', err);
            setConverterDisabled(true);
            licenseKeyInput.style.borderColor = 'red';
        }
    });

    // --- Accordion Functionality ---
    const accordionItems = document.querySelectorAll('.accordion-item');
    accordionItems.forEach(item => {
        const question = item.querySelector('.accordion-question');
        question.addEventListener('click', () => {
            item.classList.toggle('open');
        });
    });

    // --- Contact Form Submission ---
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');
    if (contactForm) {
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
                    contactForm.style.display = 'none';
                    formStatus.style.display = 'block';
                    formStatus.textContent = 'Thank you! Your message has been sent.';
                } else {
                    throw new Error('Form submission failed');
                }
            } catch (error) {
                formStatus.style.display = 'block';
                formStatus.textContent = 'Oops! There was a problem.';
                formStatus.style.color = 'red';
            }
        });
    }

    // --- Dynamic Year in Footer ---
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }
    
    // --- File Handling & App Logic (to be built out next) ---
    // We will add the file drop, selection, and conversion logic here.
    console.log('Artypacks UI is ready. App logic will be connected next.');
});
