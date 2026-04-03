/**
 * Learning Mode Utilities
 * Captures user interactions to build automation templates.
 */

const injectTracker = async (page, onAction) => {
    // Expose the reportAction function to the browser
    await page.exposeFunction('reportAction', (data) => {
        onAction(data);
    });

    // Inject listener and Visual indicator
    await page.addInitScript(() => {
        // Create REC Indicator
        const rec = document.createElement('div');
        rec.id = 'ai-learning-indicator';
        rec.innerHTML = `
            <div style="position:fixed; top:20px; right:20px; z-index:999999; background:rgba(0,0,0,0.8); color:white; padding:15px; border-radius:12px; border:2px solid #ff4444; font-family:sans-serif; display:flex; align-items:center; gap:10px; box-shadow:0 10px 30px rgba(0,0,0,0.5); pointer-events:none;">
                <div style="width:12px; height:12px; background:#ff4444; border-radius:50%; animation: blink 1s infinite;"></div>
                <div>
                    <div style="font-weight:bold; color:#ff4444; font-size:14px;">REC: LEARNING MODE</div>
                    <div style="font-size:11px; opacity:0.8;">Perform the task manually. I am watching...</div>
                </div>
            </div>
            <style>
                @keyframes blink { 0% { opacity:1; } 50% { opacity:0.3; } 100% { opacity:1; } }
                .ai-click-ripple {
                    position: fixed;
                    width: 40px;
                    height: 40px;
                    background: rgba(255, 68, 68, 0.4);
                    border: 2px solid #ff4444;
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 999998;
                    animation: ripple 0.6s ease-out forwards;
                }
                @keyframes ripple {
                    from { transform: scale(0.5); opacity: 1; }
                    to { transform: scale(2); opacity: 0; }
                }
            </style>
        `;
        document.body.appendChild(rec);

        document.addEventListener('click', (e) => {
            const el = e.target;
            
            // Show click ripple
            const ripple = document.createElement('div');
            ripple.className = 'ai-click-ripple';
            ripple.style.left = (e.clientX - 20) + 'px';
            ripple.style.top = (e.clientY - 20) + 'px';
            document.body.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
            
            // Simple logic to find a good selector
            let selector = "";
            if (el.id) selector = `#${el.id}`;
            else if (el.name) selector = `[name="${el.name}"]`;
            else if (el.tagName === 'A' || el.tagName === 'BUTTON') {
                // Use tag and text for buttons/links
                selector = `${el.tagName.toLowerCase()}:has-text("${el.innerText.trim().slice(0, 20)}")`;
            } else {
                // Generic path-like selector
                selector = el.className ? `.${el.className.split(' ').join('.')}` : el.tagName.toLowerCase();
            }

            window.reportAction({
                type: 'click',
                selector: selector,
                text: el.innerText.trim().slice(0, 30),
                url: window.location.href,
                tag: el.tagName
            });
        }, true); // Use capture to catch events before they are stopped
    });
};

export { injectTracker };
