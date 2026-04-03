import "dotenv/config";
import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const storagePath = path.join(process.cwd(), "auth.json");

(async () => {
    let browser;
    try {
        browser = await chromium.launch({
            headless: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            ]
        });

        // Load existing session if available
        const contextOptions = {
            viewport: { width: 1920, height: 1080 },
            ...(fs.existsSync(storagePath) ? { storageState: storagePath } : {})
        };
        const context = await browser.newContext(contextOptions);

        // Stealth: remove automation header
        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        const page = await context.newPage();

        // Listen for browser logs
        page.on('console', msg => {
            const text = msg.text();
            if (!text.includes("Failed to load resource") && !text.includes("JQMIGRATE")) {
                console.log(`[PAGE LOG]: ${text}`);
            }
        });
        page.on('pageerror', err => console.log(`[PAGE ERROR]: ${err.message}`));

        const goToDashboard = async () => {
            console.log("[Stats Scraper] Navigating to dashboard...");
            await page.goto("https://kart.farm:8443/Farmkart/dashboard.jsp", { waitUntil: 'load', timeout: 60000 });
            await page.waitForLoadState('networkidle').catch(() => { });
        };

        await goToDashboard();
        console.log("[Stats Scraper] Current URL:", page.url());

        // Robust Login Check: presence of #user or other dashboard elements
        const isLoggedIn = await page.locator("#user, .nav-header, .ibox").first().isVisible({ timeout: 10000 }).catch(() => false);

        if (!isLoggedIn) {
            console.log("[Stats Scraper] Not logged in or dashboard empty. Performing/Retrying login...");
            await page.goto("https://kart.farm:8443/Farmkart/index.jsp", { waitUntil: 'domcontentloaded' });
            await page.fill('input[name="username"]', String(process.env.FK_USERNAME));
            await page.fill('input[name="password"]', String(process.env.FK_PASSWORD));
            await page.click('button:has-text("Login")');
            await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {
                console.log("[Stats Scraper] Login navigation timeout, checking for element presence...");
            });

            // Save session
            const state = await context.storageState();
            fs.writeFileSync(storagePath, JSON.stringify(state));
            console.log("[Stats Scraper] Session updated.");
            await goToDashboard();
        }

        // Verify we are on the right page
        if (!page.url().includes("dashboard.jsp")) {
            throw new Error(`Failed to reach dashboard. Current URL: ${page.url()}`);
        }

        // Scrape Stats - Wait specifically for the elements
        console.log("[Stats Scraper] Waiting for stats elements...");
        try {
            await page.waitForSelector("#user", { timeout: 30000 });
        } catch (e) {
            console.log("[Stats Scraper] STATS TIMEOUT. Capturing Deep Debug Info...");
            const frames = page.frames();
            for (let i = 0; i < frames.length; i++) {
                const f = frames[i];
                const html = await f.evaluate(() => document.documentElement.outerHTML).catch(() => "ERROR");
                console.log(`[Frame ${i}] URL: ${f.url()} | Length: ${html.length}`);
                if (html.length < 2000) console.log(`[Frame ${i}] HTML:`, html);
                else console.log(`[Frame ${i}] HTML Start:`, html.substring(0, 1000));
            }
            throw e;
        }

        const customers = await page.locator("#user").innerText().catch(() => "N/A");
        const products = await page.locator("div.ibox:has-text('Products') h1").first().innerText().catch(() => "N/A");
        const pending = await page.locator("div.ibox:has-text('Pending') h1").first().innerText().catch(() => "N/A");
        const completed = await page.locator("div.ibox:has-text('Completed') h1").first().innerText().catch(() => "N/A");

        const stats = {
            customers: customers.trim(),
            products: products.trim(),
            pending: pending.trim(),
            completed: completed.trim(),
            timestamp: new Date().toISOString()
        };

        console.log(JSON.stringify(stats));

    } catch (error) {
        console.error("Error scraping stats:", error.message);
        if (typeof page !== 'undefined') {
            await page.screenshot({ path: "error-debug.png", fullPage: true }).catch(() => { });
            console.log("[Stats Scraper] Saved error-debug.png");
        }
        console.log(JSON.stringify({ error: true, message: error.message }));
    } finally {
        if (browser) await browser.close();
    }
})();
