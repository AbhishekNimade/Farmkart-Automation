// =====================================================
// File Name : playwright.config.js
// Project   : Order Booking Automation (Farmkart)
// Author    : Abhishek Nimade
// Purpose   : Playwright global configuration
// =====================================================

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
    use: {
        headless: false,                 // Browser visible (automation debugging)
        viewport: { width: 1280, height: 720 },
        ignoreHTTPSErrors: true,         // Farmkart HTTPS warnings ignore
        actionTimeout: 30000,            // 30 sec per action
        navigationTimeout: 60000,        // 60 sec navigation
    },
};

export default config;
