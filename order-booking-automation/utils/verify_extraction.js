import { chromium } from 'playwright';

async function verify() {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    // Set content to user provided HTML snippets
    const htmlContent = `
        <div class="flex items-center justify-between" data-v-2819e7aa="">
            <div class="utility-label" data-v-2819e7aa="">AWB No</div>
            <div class="body-body-one-liner" data-v-2819e7aa="">20886710014851 <div class="ap-popper ml-1 inline ap-popper--theme-undefined"><span class="ap-icon cursor-pointer text-cta-primary" data-v-2819e7aa=""><i class="fal fa-copy"></i></span></div></div>
        </div>
        
        <li class="ap-steps__list__item ap-steps__list__item--circles ap-steps__list__item--circles--not-last-step pointer-events-none" name="ap-steps-step">
            <a class="relative flex items-center group" aria-current="false">
                <span class="ml-4 min-w-0 flex flex-col flex-grow">
                    <span class="flex items-center">
                        <span class="ap-steps__list__item--circles__name">Order Received</span>
                    </span>
                    <span class="ap-steps__list__item--circles__description">
                        <span title="14 Jan 2026, 09:54 am" class="text-xs line-clamp-2 pointer-events-auto text-font-label">14 Jan 2026, 09:54 am</span>
                    </span>
                </span>
            </a>
        </li>
    `;

    await page.setContent(htmlContent);

    console.log("🔎 Testing AWB Extraction...");
    let awbNumber = null;
    try {
        const awbLabel = page.locator('.utility-label').filter({ hasText: 'AWB No' }).first();
        const awbContainer = page.locator('.flex.items-center.justify-between', { has: awbLabel });
        const awbValueEl = awbContainer.locator('.body-body-one-liner').first();
        const awbFullText = await awbValueEl.innerText();
        awbNumber = awbFullText.replace(/\D/g, '').trim();
        console.log(`   ✅ AWB Extracted: ${awbNumber}`);
    } catch (err) {
        console.log("   ❌ AWB Extraction Failed: " + err.message);
    }

    console.log("📅 Testing Booking Date Extraction...");
    let bookingDate = null;
    try {
        const orderReceivedLabel = page.locator('.ap-steps__list__item--circles__name').filter({ hasText: 'Order Received' }).first();
        const stepItem = page.locator('.ap-steps__list__item', { has: orderReceivedLabel });
        const dateEl = stepItem.locator('.ap-steps__list__item--circles__description span[title]').first();
        bookingDate = await dateEl.getAttribute('title');
        if (!bookingDate) {
            bookingDate = await dateEl.innerText();
        }
        console.log(`   ✅ Booking Date Extracted: ${bookingDate}`);
    } catch (err) {
        console.log("   ❌ Booking Date Extraction Failed: " + err.message);
    }

    await browser.close();

    if (awbNumber === '20886710014851' && bookingDate === '14 Jan 2026, 09:54 am') {
        console.log("\n✨ ALL EXTRACTION TESTS PASSED! ✨");
    } else {
        console.log("\n❌ SOME TESTS FAILED. Check output above.");
        process.exit(1);
    }
}

verify();
