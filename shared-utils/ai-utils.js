/**
 * AI Utilities for Farmkart Automation
 * Provides "Self-Healing" and "Failure Reasoning" capabilities.
 */

const analyzePage = async (page) => {
    try {
        // Capture a summary of the page context
        const title = await page.title();
        const url = page.url();
        
        // Scan for common "Blockers" or "Popups"
        const blockers = await page.evaluate(() => {
            const results = [];
            const modal = document.querySelector('.modal.show, .modal-backdrop, .sweet-alert, .swal2-container');
            if (modal) results.push('VISIBLE_MODAL_OR_BACKDROP');
            
            const toast = document.querySelector('.toast-error, .alert-danger');
            if (toast) results.push(`ERR_TOAST: ${toast.innerText.trim()}`);
            
            const loginInput = document.querySelector('input[name="username"]');
            if (loginInput) results.push('SESSION_EXPIRED_LOGIN_REQUIRED');
            
            return results;
        });

        return { title, url, blockers };
    } catch (e) {
        return { error: e.message };
    }
};

const attemptSelfHealing = async (page, goal) => {
    const analysis = await analyzePage(page);
    console.log(`🤖 AI Analysis for goal "${goal}":`, analysis);

    if (analysis.blockers.includes('VISIBLE_MODAL_OR_BACKDROP')) {
        console.log("🤖 AI Strategy: Found a modal/backdrop. Attempting to click 'Cancel' or 'Close'...");
        const closeSelectors = ['button:has-text("Cancel")', 'button:has-text("Close")', '.modal-header .close', '.swal2-confirm'];
        for (const sel of closeSelectors) {
            const btn = page.locator(sel).filter({ visible: true }).first();
            if (await btn.count() > 0) {
                await btn.click().catch(() => null);
                await new Promise(r => setTimeout(r, 1000));
                return true;
            }
        }
    }

    if (analysis.blockers.includes('SESSION_EXPIRED_LOGIN_REQUIRED')) {
        console.log("🤖 AI Strategy: Session seems expired. This will trigger a re-login in the main loop.");
        return false; // Let the main loop handle re-login
    }

    // Heuristic: If we are on the wrong page, try to jump back to a known stable point
    if (goal === 'extract_products' && !analysis.url.includes('orderdetails.jsp')) {
        console.log("🤖 AI Strategy: Incorrect page for product extraction. Re-navigating...");
        return 'RENAVIGATE';
    }

    return false;
};

export { analyzePage, attemptSelfHealing };
