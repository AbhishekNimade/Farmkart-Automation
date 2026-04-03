// =====================================================
// File Name : delhiveryLogin.js
// Project   : Order Booking Automation (Farmkart)
// Author    : Abhishek Nimade
// Purpose   :
//  - Login to Delhivery using 2-step email flow
// =====================================================

const DELHIVERY_HOME = "https://one.delhivery.com/home";

/**
 * Login to Delhivery portal
 */
export async function loginDelhivery(page) {
    if (!process.env.DELHIVERY_EMAIL || !process.env.DELHIVERY_PASSWORD) {
        throw new Error("❌ DELHIVERY credentials missing in .env file");
    }

    console.log("🔐 Logging into Delhivery...");

    await page.goto("https://one.delhivery.com/home", {
        waitUntil: "domcontentloaded",
        timeout: 60000
    });

    // Email Step
    try {
        console.log("   - Waiting for Email input...");
        // User provided specific placeholder
        const emailSelector = 'input[placeholder="Enter your email ID"]';
        await page.waitForSelector(emailSelector, { state: 'visible', timeout: 30000 });

        // Use click + type to ensure React events fire
        await page.click(emailSelector);
        await page.keyboard.type(process.env.DELHIVERY_EMAIL, { delay: 100 });

        // Verify input
        await page.waitForTimeout(500);
        const filledEmail = await page.inputValue(emailSelector);
        console.log(`   - Email field value: "${filledEmail}"`);

        if (filledEmail !== process.env.DELHIVERY_EMAIL) {
            console.log("   ⚠️ Email fill mismatch, retrying with fill...");
            await page.fill(emailSelector, process.env.DELHIVERY_EMAIL);
        }

        console.log("   - Clicking Continue...");
        // Fix: Force click on the VISIBLE button using pseudo-class
        await page.click('button:has-text("Continue"):visible', { timeout: 10000 });
    } catch (e) {
        console.error("   - Error during email step:", e.message);
        throw e;
    }

    // Password Step
    // Transition can change URL to ucp-auth...
    try {
        console.log("   - Waiting for Password input...");

        // Wait specifically for password field
        await page.waitForSelector('input[type="password"]', { state: 'visible', timeout: 30000 });

        // User said "email paswords dono" -> Check if we need to re-enter email in a new field?
        // Sometimes the UI changes to show Email (readonly) + Password.
        // Or sometimes it asks for Email AGAIN.

        // Let's check if the email input is still there and empty.
        const emailSelector = 'input[placeholder="Enter your email ID"]'; // Re-use if present
        if (await page.$(emailSelector)) {
            const emailValue = await page.inputValue(emailSelector);
            if (!emailValue) {
                console.log("   - Re-entering email (if required)...");
                await page.fill(emailSelector, process.env.DELHIVERY_EMAIL);
            }
        }

        await page.waitForTimeout(1000);
        await page.fill('input[type="password"]', process.env.DELHIVERY_PASSWORD);

        console.log("   - Clicking Sign In...");

        // Try multiple selectors for the login button based on user info
        // User provided: <input ... id="kc-login" ... value="Login">
        // It's an INPUT type="submit", not a BUTTON tag.

        try {
            // Primary target: ID
            await page.click('#kc-login', { timeout: 5000 });
        } catch (e) {
            console.log("   ⚠️ #kc-login not found, trying fallback selectors...");
            // Fallback: value="Login" or text
            try {
                await page.click('input[value="Login"]', { timeout: 5000 });
            } catch (e2) {
                // Last resort: standard text
                await page.click('button:has-text("Sign in"), input[type="submit"]', { timeout: 5000 });
            }
        }

        // Wait for navigation after click
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => console.log("   - Navigation wait timeout (might be staying on SPA)"));

        // Verify we are logged in (e.g. check for dashboard element)
        // await page.waitForTimeout(3000); // Removed unnecessary wait to improve speed

    } catch (e) {
        console.error("   - Error during password step:", e.message);
        throw e;
    }

    console.log("✅ Delhivery login successful");
}
