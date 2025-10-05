// previewManager.js
class PreviewManager {
    constructor() {
        this.previewFrame = document.getElementById('previewFrame');
        this.currentView = 'desktop';
    }

    updatePreview(data) {
        // Generate preview HTML based on form data
        const previewHTML = this.generatePreviewHTML(data);
        
        // Update preview frame
        this.previewFrame.innerHTML = previewHTML;
    }

    changeView(device) {
        this.currentView = device;
        
        // Update preview frame size
        switch(device) {
            case 'mobile':
                this.previewFrame.style.width = '375px';
                break;
            case 'tablet':
                this.previewFrame.style.width = '768px';
                break;
            case 'desktop':
                this.previewFrame.style.width = '100%';
                break;
        }

        // Update active button state
        this.updateViewButtons(device);
    }

    updateViewButtons(activeDevice) {
        document.querySelectorAll('.preview-controls button').forEach(button => {
            button.classList.remove('active');
            if (button.id === `${activeDevice}Preview`) {
                button.classList.add('active');
            }
        });
    }

    generatePreviewHTML(data) {
        // Generate preview HTML based on form data
        // This is a simplified version - you'll need to expand this
        return `
            <div class="preview-website">
                <header>
                    <h1>${data.get('businessName') || 'Your Business Name'}</h1>
                </header>
                <main>
                    <section>
                        <p>${data.get('businessDescription') || 'Your business description'}</p>
                    </section>
                </main>
            </div>
        `;
    }
}