class DashboardManager {
    constructor() {
        this.initializeDashboard();
        this.loadStatistics();
        this.loadWebsites();
    }

    async initializeDashboard() {
        try {
            const stats = await this.fetchDashboardStats();
            this.updateDashboardStats(stats);
        } catch (error) {
            ErrorHandler.show('Failed to load dashboard statistics');
        }
    }

    async fetchDashboardStats() {
        const response = await fetch(`${CONFIG.API_URL}/dashboard/stats`, {
            headers: {
                'Authorization': `Bearer ${auth.token}`,
            },
        });

        if (!response.ok) throw new Error('Failed to fetch statistics');
        return await response.json();
    }

    async loadWebsites() {
        try {
            const websites = await this.fetchWebsites();
            this.renderWebsites(websites);
        } catch (error) {
            ErrorHandler.show('Failed to load websites');
        }
    }

    renderWebsites(websites) {
        const container = document.querySelector('.websites-grid');
        if (!container) return;

        container.innerHTML = websites.map(website => `
            <div class="website-card">
                <img src="${website.screenshot}" alt="${website.name}">
                <h3>${website.name}</h3>
                <p>${website.url}</p>
                <div class="website-actions">
                    <button onclick="editWebsite('${website.id}')">Edit</button>
                    <button onclick="deleteWebsite('${website.id}')">Delete</button>
                </div>
            </div>
        `).join('');
    }
}