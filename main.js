// Wait for the entire HTML document to be loaded and parsed
document.addEventListener('DOMContentLoaded', () => {

    // --- Accordion Functionality ---
    const accordionItems = document.querySelectorAll('.accordion-item');

    accordionItems.forEach(item => {
        const question = item.querySelector('.accordion-question');

        question.addEventListener('click', () => {
            // Check if the clicked item is already open
            const isAlreadyOpen = item.classList.contains('open');

            // If it wasn't already open, open it. Otherwise, just close it.
            if (!isAlreadyOpen) {
                item.classList.add('open');
            } else {
                item.classList.remove('open');
            }
        });
    });

    // --- Contact Form Submission ---
    const contactForm = document.getElementById('contact-form');
    const formStatus = document.getElementById('form-status');

    if (contactForm) {
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent the default form submission

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
                    // Success! Hide the form and show the status message.
                    contactForm.style.display = 'none';
                    formStatus.style.display = 'block';
                    formStatus.textContent = 'Thank you! Your message has been sent.';
                } else {
                    // Handle server errors (e.g., Formspree issue)
                    formStatus.style.display = 'block';
                    formStatus.textContent = 'Oops! There was a problem submitting your form.';
                    formStatus.style.color = 'red';
                }
            } catch (error) {
                // Handle network errors
                formStatus.style.display = 'block';
                formStatus.textContent = 'Oops! There was a network error.';
                formStatus.style.color = 'red';
            }
        });
    }

    // --- Dynamic Year in Footer ---
    const yearSpan = document.getElementById('current-year');
    if (yearSpan) {
        yearSpan.textContent = new Date().getFullYear();
    }

    // --- App Logic (to be built out next) ---
    // We will add the code for the license key check, file drop,
    // and conversion process here in our next step.
    console.log('Artypacks UI is ready. App logic will be connected next.');

});
