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

        // Use Playwright `:visible` pseudo-class INSIDE the selector string so it filters hidden elements out
        // instead of picking the first hidden element and waiting for it to become visible forever.
        const passwordSelector = 'input[placeholder="Enter your password"]:visible';
        await page.waitForTimeout(3000); // Give time for navigation if any
        await page.waitForSelector(passwordSelector, { timeout: 30000 });

        // Sometimes it asks for Email AGAIN. Check if any empty email/username field is present
        const ssoEmailSelector = 'input[name="username"], input[name="email"], input[type="email"]';
        const ssoEmailInput = await page.$(ssoEmailSelector);
        if (ssoEmailInput) {
            const isVisible = await ssoEmailInput.isVisible();
            if (isVisible) {
                const ssoEmailValue = await page.inputValue(ssoEmailSelector);
                if (!ssoEmailValue) {
                    console.log("   - Entering email on SSO page...");
                    await page.fill(ssoEmailSelector, process.env.DELHIVERY_EMAIL);
                }
            }
        }

        await page.waitForTimeout(1000);
        // Fill the password using the precise visible locator. 
        // We use locator().first() to avoid strict mode errors if multiple visible fields appear somehow.
        await page.locator('input[type="password"]:visible').first().fill(process.env.DELHIVERY_PASSWORD);

        console.log("   - Clicking Sign In...");

        // Try multiple selectors for the login button based on user info
        try {
            // New UI Login button (typically a button element with text "Login")
            await page.locator('button:has-text("Login"):visible').first().click({ timeout: 5000 });
        } catch (e) {
            console.log("   ⚠️ button:has-text('Login') not found, trying fallback selectors...");
            try {
                // Primary target: ID from old UI
                await page.locator('#kc-login:visible').first().click({ timeout: 5000 });
            } catch (e2) {
                // Last resort
                await page.locator('input[value="Login"]:visible, button:has-text("Sign in"):visible, input[type="submit"]:visible').first().click({ timeout: 5000 });
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
