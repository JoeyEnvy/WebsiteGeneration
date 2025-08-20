// init.js
const auth = new AuthManager();
const generator = new WebsiteGenerator();

// Protect routes
function checkAuth() {
    const publicPages = ['/login.html', '/signup.html', '/index.html', '/'];
    const currentPage = window.location.pathname;
    
    if (!publicPages.includes(currentPage) && !auth.isAuthenticated()) {
        window.location.href = '/login.html';
    }
}

// Initialize dashboard if on dashboard page
if (window.location.pathname.includes('dashboard')) {
    const dashboard = new DashboardManager();
}

// Add event listeners for navigation
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const path = e.target.getAttribute('href');
        navigateTo(path);
    });
});