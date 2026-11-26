import { chromium } from "playwright";
import "dotenv/config";

(async () => {
    console.log("Starting test...");
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    try {
        await page.goto("https://kart.farm:8443/Farmkart/index.jsp?status=logout");
        console.log("Loaded login page.");
        
        await page.fill('input[name="username"]', process.env.FK_USERNAME);
        await page.fill('input[name="password"]', process.env.FK_PASSWORD);
        await page.click('button:has-text("Login")');
        console.log("Clicked login.");
        
        await page.waitForTimeout(5000); // wait 5 seconds
        console.log("Current URL after 5s: " + page.url());
        
        const text = await page.innerText("body");
        console.log("Page text snippet: " + text.substring(0, 300).replace(/\n/g, ' '));
        
        await page.screenshot({ path: "debug_login.png", fullPage: true });
        console.log("Saved debug_login.png");
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
