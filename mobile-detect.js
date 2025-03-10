// Function to check if the device is mobile
function isMobileDevice() {
    // Check if device is mobile based on user agent
    const isMobileUserAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Check if it's a narrow screen (typical for mobile)
    const isNarrowScreen = window.innerWidth <= 768;
    
    // Check if it's a touch device but not a laptop with touch screen
    const isTouchOnly = ('ontouchstart' in window) && 
                       // Exclude Windows Touch Devices (laptops/desktops with touch)
                       !(/Windows NT/i.test(navigator.userAgent)) &&
                       // Exclude macOS Touch Devices (laptops with touch bar)
                       !(/Macintosh/i.test(navigator.userAgent));

    // Device is considered mobile if it has a mobile user agent OR
    // if it's both a narrow screen AND touch-only device
    return isMobileUserAgent || (isNarrowScreen && isTouchOnly);
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