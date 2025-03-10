// Modal functionality
const instructionModal = document.getElementById('instructionModal');
const mobileNoticeModal = document.getElementById('mobileNoticeModal');
const infoButton = document.getElementById('infoButton');

// Handle all close buttons
document.querySelectorAll('.close-button').forEach(button => {
    button.addEventListener('click', (event) => {
        event.stopPropagation();
        const modal = button.closest('.modal');
        if (modal) {
            modal.style.display = 'none';
        }
    });
});

infoButton.addEventListener('click', (event) => {
    event.stopPropagation();
    instructionModal.style.display = 'block';
});

// Close modals when clicking outside
window.addEventListener('click', (event) => {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// Show instruction modal on first visit
if (!localStorage.getItem('hasVisitedBefore')) {
    instructionModal.style.display = 'block';
    localStorage.setItem('hasVisitedBefore', 'true');
}

// Add keydown listener for escape key to close all modals
document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
}); 