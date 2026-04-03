import { chromium } from 'playwright';

/**
 * MOCK TEST: Simulate Delhivery Box Selection UI
 */
async function testBoxSelectionLogic() {
    console.log("🚀 Starting Local Box Selection Mock Test...");
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // 1. Setup Mock HTML
    // We simulate a dropdown list that shows 5 items initially, then has a "Load More" button.
    const htmlContent = `
        <style>
            #dropdown-container { width: 300px; height: 200px; border: 1px solid #ccc; overflow-y: auto; }
            .ap-menu-item { padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; }
            #load-more { width: 100%; padding: 10px; background: #f0f0f0; border: none; cursor: pointer; display: block; }
            .hidden { display: none; }
        </style>
        <div class="ap-meta-label">Select Shipping Package</div>
        <div class="ap-menu-trigger-root">Click Me</div>
        
        <ul id="dropdown-container" class="scrollbar ap-menu-items hidden">
            <li class="ap-menu-item">Box 10 10 10</li>
            <li class="ap-menu-item">Box 12 12 12</li>
            <li class="ap-menu-item">Box 14 14 14</li>
            <li class="ap-menu-item">Box 15 15 15</li>
            <li class="ap-menu-item">Box 16 16 16</li>
            <button id="load-more">Load More</button>
        </ul>

        <script>
            let clickCount = 0;
            const container = document.getElementById('dropdown-container');
            const trigger = document.querySelector('.ap-menu-trigger-root');
            const loadMore = document.getElementById('load-more');

            trigger.onclick = () => container.classList.toggle('hidden');

            loadMore.onclick = () => {
                clickCount++;
                const startIndex = 5 + (clickCount - 1) * 5;
                for (let i = 1; i <= 5; i++) {
                    const li = document.createElement('li');
                    li.className = 'ap-menu-item';
                    const size = startIndex + i + 10;
                    li.innerText = 'Box ' + size + ' ' + size + ' ' + size;
                    container.insertBefore(li, loadMore);
                }
                if (clickCount >= 3) {
                    // Finally add the target
                    const target = document.createElement('li');
                    target.className = 'ap-menu-item';
                    target.innerText = 'Box 18 10 10';
                    container.insertBefore(target, loadMore);
                    loadMore.style.display = 'none';
                }
            };
        </script>
    `;

    await page.setContent(htmlContent);

    // --- LOGIC TO TEST (MAPPING TO NEW PRODUCTION LOGIC) ---
    
    const targetBoxRaw = "18 10 10"; 
    
    const normalize = (s) => {
        if (!s) return "";
        return s.toLowerCase()
            .replace(/cms/g, '')     
            .replace(/x/g, ' ')      
            .split(/\s+/)            
            .filter(v => v.length > 0) 
            .join('x');              
    };

    const targetBoxNormalized = normalize(targetBoxRaw);
    console.log(`🔍 Target Box: "${targetBoxRaw}" (Normalized: ${targetBoxNormalized})`);

    // Open Dropdown
    await page.click('.ap-menu-trigger-root');
    await page.waitForTimeout(500);

    let matchFound = false;
    let checkedItems = new Set();
    let totalScanned = 0;

    for (let attempt = 0; attempt < 10; attempt++) {
        const options = page.locator('.ap-menu-item');
        const count = await options.count();
        let newFoundBatch = 0;

        for (let i = 0; i < count; i++) {
            const opt = options.nth(i);
            const text = await opt.innerText();
            const normalizedUI = normalize(text);

            if (checkedItems.has(text)) continue;
            checkedItems.add(text);
            newFoundBatch++;
            totalScanned++;

            console.log(`      📦 [${totalScanned}] Scanned: "${text}"`);

            if (normalizedUI === targetBoxNormalized || text.toLowerCase().includes(targetBoxRaw.toLowerCase())) {
                console.log(`   ✨ MATCH FOUND: "${text}"`);
                await opt.click();
                matchFound = true;
                break;
            }
        }

        if (matchFound) break;

        const loadBtn = page.locator('#load-more');
        if (await loadBtn.isVisible()) {
            console.log("   🔄 Clicking 'Load More'...");
            await loadBtn.click();
            await page.waitForTimeout(1000); 
        } else {
            if (newFoundBatch === 0) {
                console.log("   ⏹️ End of list.");
                break;
            }
        }
    }

    if (matchFound) {
        console.log("✨ TEST PASSED: Match found after scrolling/loading.");
    } else {
        console.log("❌ TEST FAILED: Match not found.");
    }

    await browser.close();
}

testBoxSelectionLogic().catch(console.error);
