document.addEventListener("DOMContentLoaded", async () => {
    const statsContainers = document.querySelectorAll('.stats');
    if (!statsContainers || statsContainers.length === 0) return;

    // Show loading spinner in two rows for all stats containers
    statsContainers.forEach(container => {
        container.innerHTML = `
            <div style="margin-bottom: 4px;">
                <img src="assets/spinner.gif" alt="Loading" style="width:18px;height:18px;vertical-align:middle;"> Loading modules...
            </div>
            <div>
                <img src="assets/spinner.gif" alt="Loading" style="width:18px;height:18px;vertical-align:middle;"> Loading index...
            </div>
        `;
    });

    try {
        const resp = await fetch('https://intentspiderapis.nekshadesilva.com/stats');
        const data = await resp.json();
        
        let modulesText = `${data.modules} modules`;
        let tokenText = `${(data.tokensIndexed || 12450).toLocaleString()} tokens indexed`;

        statsContainers.forEach(container => {
            container.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 4px; color: #4facfe;">${modulesText}</div>
                <div style="color: #a0a5b1;">${tokenText}</div>
            `;
        });
    } catch (e) {
        statsContainers.forEach(container => {
            container.innerHTML = `
                <div style="font-weight: bold; margin-bottom: 4px; color: #4facfe;">9 modules</div>
                <div style="color: #a0a5b1;">Stats unavailable</div>
            `;
        });
    }
});
