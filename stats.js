document.addEventListener("DOMContentLoaded", async () => {
    const statsContainers = document.querySelectorAll('.stats');
    if (!statsContainers || statsContainers.length === 0) return;

    let spinnerSrc = 'assets/spinner.gif';
    if (window.location.pathname.includes('/git/externalfiles/')) {
        spinnerSrc = '../../assets/spinner.gif';
    } else if (window.location.pathname.includes('/contactform/')) {
        spinnerSrc = '../assets/spinner.gif';
    }

    // Immediately show loading state (if not already set in HTML)
    statsContainers.forEach(container => {
        container.innerHTML = `
            <div>
                <img src="${spinnerSrc}" alt="Loading" style="width:20px;height:20px;vertical-align:middle;margin-right:4px;"> Webnets
            </div>
            <div>
                <img src="${spinnerSrc}" alt="Loading" style="width:20px;height:20px;vertical-align:middle;margin-right:4px;"> Tokens
            </div>
        `;
    });

    try {
        const fetchPromise = fetch('https://intentspiderapis.nekshadesilva.com/stats').then(r => r.json());
        const waitPromise = new Promise(r => setTimeout(r, 3000)); // Minimum 3 second delay for aesthetics

        // Wait for both the API fetch and the 3-second timer
        const [data] = await Promise.all([fetchPromise, waitPromise]);
        
        let modulesText = `${data.modules || 9} Webnets`;
        let tokenText = `${(data.tokensIndexed || 12450).toLocaleString()} tokens`;

        statsContainers.forEach(container => {
            container.innerHTML = `
                <div>${modulesText}</div>
                <div>${tokenText}</div>
            `;
        });
    } catch (e) {
        statsContainers.forEach(container => {
            container.innerHTML = `
                <div>9 Webnets</div>
                <div>Stats unavailable</div>
            `;
        });
    }
});
