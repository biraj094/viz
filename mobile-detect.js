// Function to check if the device is mobile
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
           (window.innerWidth <= 768 && 'ontouchstart' in window && !/Windows NT|Macintosh|Linux/i.test(navigator.userAgent));
}

// Function to create and show mobile notice
function handleMobileNotice() {
    if (!isMobileDevice()) return;

    const notice = document.createElement('div');
    notice.id = 'mobileNotice';
    notice.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #2c3e50;
        color: white;
        padding: 10px 15px;
        text-align: center;
        font-size: 14px;
        z-index: 1000;
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 10px;
    `;
    
    notice.innerHTML = `
        <span>📱 For the best experience, please use a desktop browser</span>
        <button onclick="this.parentElement.remove()" style="
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 0 5px;
            font-size: 16px;
        ">×</button>
    `;
    
    document.body.prepend(notice);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', handleMobileNotice); 