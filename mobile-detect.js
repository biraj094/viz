// Function to check if the device is mobile
function isMobileDevice() {
    return (window.innerWidth <= 768) || 
           (navigator.maxTouchPoints > 0 && navigator.maxTouchPoints !== 256) ||
           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Function to handle the mobile notice modal
function handleMobileNotice() {
    const modal = document.getElementById('mobileNoticeModal');
    const closeButton = modal.querySelector('.close-button');

    // Show modal if it's a mobile device
    if (isMobileDevice()) {
        modal.style.display = 'block';
    }

    // Close modal when clicking the close button
    closeButton.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', handleMobileNotice); 