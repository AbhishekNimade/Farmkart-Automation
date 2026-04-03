import { chromium } from 'playwright';
import dotenv from 'dotenv';
dotenv.config({ path: '../order-booking-automation/.env' });

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("https://kart.farm:8443/Farmkart/index.jsp");
    await page.fill('input[name="username"]', process.env.FARMKART_USERNAME);
    await page.fill('input[name="password"]', process.env.FARMKART_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation();

    await page.goto("https://kart.farm:8443/Farmkart/inventoryList.jsp");
    await page.fill('input[type="search"]', "Fellow, Fertilizer, 1 kg");
    await page.click('button:has-text("Search"), input[type="submit"][value="Search"], .btn-search, i.fa-search');
    await page.waitForTimeout(2000);

    await page.click('a:has-text("History")');
    await page.waitForTimeout(2000);

    const outerHTML = await page.$eval('a:has-text("PRINT HERE")', el => el.outerHTML).catch(e => e.message);
    console.log("OUTER HTML IS:", outerHTML);

    await browser.close();
})();
