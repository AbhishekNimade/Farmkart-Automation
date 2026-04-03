const injectVisualCursor = async (page) => {
    await page.addInitScript(() => {
        const cursor = document.createElement('div');
        cursor.id = 'playwright-cursor';

        // Professional SVG mouse pointer
        const cursorSvg = `data:image/svg+xml;utf8,<svg width="24" height="36" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.33235 1.58398L9.20524 29.539L13.1729 18.0069L22.9565 18.0069L1.33235 1.58398Z" fill="black" stroke="white" stroke-width="2" stroke-linejoin="round"/></svg>`;

        Object.assign(cursor.style, {
            position: 'absolute',
            top: '0',
            left: '0',
            width: '24px',
            height: '36px',
            backgroundImage: `url('${cursorSvg}')`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            pointerEvents: 'none',
            zIndex: '2147483647',
            transition: 'top 0.5s cubic-bezier(0.19, 1, 0.22, 1), left 0.5s cubic-bezier(0.19, 1, 0.22, 1)',
            transform: 'translate(-2px, -2px)', // Align tip with actual coordinates
            filter: 'drop-shadow(1px 2px 3px rgba(0,0,0,0.4))'
        });
        document.documentElement.appendChild(cursor);

        document.addEventListener('mousemove', (e) => {
            cursor.style.left = e.pageX + 'px';
            cursor.style.top = e.pageY + 'px';
        });

        document.addEventListener('mousedown', (e) => {
            cursor.style.transform = 'translate(-2px, -2px) scale(0.9)';

            // Subtle, professional pulse effect (blue)
            const ripple = document.createElement('div');
            Object.assign(ripple.style, {
                position: 'absolute',
                top: e.pageY + 'px',
                left: e.pageX + 'px',
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                backgroundColor: 'rgba(59, 130, 246, 0.3)', // Tailwind blue-500
                border: '2px solid rgba(59, 130, 246, 0.8)',
                pointerEvents: 'none',
                zIndex: '2147483646',
                transform: 'translate(-50%, -50%) scale(0.2)',
                transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease',
                opacity: '1'
            });
            document.documentElement.appendChild(ripple);

            requestAnimationFrame(() => {
                ripple.style.transform = 'translate(-50%, -50%) scale(1.5)';
                ripple.style.opacity = '0';
            });

            setTimeout(() => {
                if (ripple.parentNode) ripple.parentNode.removeChild(ripple);
            }, 500);
        });

        document.addEventListener('mouseup', () => {
            cursor.style.transform = 'translate(-2px, -2px) scale(1)';
        });
    });
};

const clickAndHighlight = async (page, selector) => {
    try {
        // Ensure the element is present and visible
        const el = await page.waitForSelector(selector, { state: 'visible', timeout: 5000 }).catch(() => null);
        
        if (!el) {
            console.log(`⚠️ Visual Click: Selector "${selector}" not visible. Falling back to direct click.`);
            await page.click(selector).catch(() => null);
            return;
        }

        // Inject a subtle but visible highlight
        await page.evaluate((sel) => {
            try {
                const element = document.querySelector(sel);
                if (element) {
                    element.setAttribute('data-orig-outline', element.style.outline);
                    element.setAttribute('data-orig-box-shadow', element.style.boxShadow);
                    element.setAttribute('data-orig-transition', element.style.transition);

                    // Professional blue highlight
                    element.style.transition = 'all 0.2s ease-in-out';
                    element.style.outline = '3px solid #3b82f6'; // Blue
                    element.style.outlineOffset = '2px';
                    element.style.boxShadow = '0 0 10px rgba(59, 130, 246, 0.5)';

                    // Move the fake cursor to the element immediately before the click
                    const cur = document.getElementById('playwright-cursor');
                    if (cur) {
                        const rect = element.getBoundingClientRect();
                        const centerX = rect.left + rect.width / 2 + window.scrollX;
                        const centerY = rect.top + rect.height / 2 + window.scrollY;
                        cur.style.left = centerX + 'px';
                        cur.style.top = centerY + 'px';
                        cur.style.display = 'block'; // Ensure it's visible
                    }
                }
            } catch (e) { }
        }, selector);

        // Wait a bit for the user to see the highlight
        await new Promise(r => setTimeout(r, 600));

        // Remove highlight right before clicking to be clean
        await page.evaluate((sel) => {
            try {
                const element = document.querySelector(sel);
                if (element) {
                    element.style.outline = element.getAttribute('data-orig-outline') || '';
                    element.style.boxShadow = element.getAttribute('data-orig-box-shadow') || '';
                    element.style.transition = element.getAttribute('data-orig-transition') || '';
                }
            } catch (e) { }
        }, selector);

        // Perform the actual click
        await page.click(selector);

    } catch (err) {
        console.log(`⚠️ Visual Click Error: ${err.message}. Falling back to normal click.`);
        await page.click(selector).catch(() => null);
    }
};

export { injectVisualCursor, clickAndHighlight };
