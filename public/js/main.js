class WebsiteGenerator {
    constructor() {
        this.form = document.getElementById('websiteGeneratorForm');
        this.previewFrame = document.getElementById('previewFrame');
        this.currentPage = 0;
        this.generatedPages = [];
        this.currentStep = 1;
        this.userHasPaid = false;

        const savedPages = localStorage.getItem('generatedPages');
        if (savedPages) {
            this.generatedPages = JSON.parse(savedPages);
        }

        this.initializeEventListeners();  // <== calling it here
        this.highlightStep(this.currentStep);
    }

    // ✅ Add this method to handle all the event listeners
    initializeEventListeners() {
        document.getElementById('nextStep1').addEventListener('click', () => {
            if (this.validateStep('step1')) this.goToStep(2);
        });
        document.getElementById('nextStep2').addEventListener('click', () => {
            if (this.validateStep('step2')) this.goToStep(3);
        });
        document.getElementById('nextStep3').addEventListener('click', () => {
            if (this.validateStep('step3')) this.goToStep(4);
        });
        document.getElementById('nextStep4')?.addEventListener('click', () => {
            if (this.validateStep('step4')) this.goToStep(5);
        });

        document.getElementById('prevStep2').addEventListener('click', () => this.goToStep(1));
        document.getElementById('prevStep3').addEventListener('click', () => this.goToStep(2));
        document.getElementById('prevStep4')?.addEventListener('click', () => this.goToStep(3));

        document.querySelectorAll('.preview-controls button').forEach(button => {
            button.addEventListener('click', () => {
                this.changePreviewDevice(button.id.replace('Preview', ''));
            });
        });

        document.getElementById('prevPage').addEventListener('click', () => this.changePage(-1));
        document.getElementById('nextPage').addEventListener('click', () => this.changePage(1));

        this.form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit();
        });

        const purchaseBtn = document.getElementById('purchaseBtn');
        const downloadBtn = document.getElementById('downloadSiteBtn');

        if (purchaseBtn) {
            purchaseBtn.addEventListener('click', () => {
                const confirmed = confirm("Simulated payment: Proceed to pay £X?");
                if (confirmed) {
                    this.userHasPaid = true;
                    purchaseBtn.style.display = 'none';
                    if (downloadBtn) downloadBtn.style.display = 'inline-block';
                    alert('Payment successful. You can now download your website.');
                }
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => this.downloadGeneratedSite());
        }

        // ✅ Regenerate Modal Logic
        const closeModal = document.getElementById('closeRegenerateModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                document.getElementById('regenerateModal').style.display = 'none';
            });
        }

        const confirmBtn = document.getElementById('confirmRegeneratePageBtn');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                const pageIndex = parseInt(document.getElementById('regeneratePageSelect').value);
                if (!isNaN(pageIndex)) {
                    this.currentPage = pageIndex;
                    this.updatePreview();

                    // ✅ Show customization tools
                    const panel = document.getElementById('customizationPanel');
                    if (panel) panel.style.display = 'block';

                    document.getElementById('regenerateModal').style.display = 'none';
                }
            });
        }

        this.initializeCustomizationPanel();  // <-- Make sure this is called here
    }

    // Update preview in iframe and handle page generation
    updatePreview() {
        if (this.generatedPages.length === 0) return;

        const currentPageContent = this.generatedPages[this.currentPage];
        const scrollY = window.scrollY;

        const iframe = document.createElement('iframe');
        iframe.style.width = '100%';
        iframe.style.height = '500px';
        iframe.style.border = 'none';

        this.previewFrame.innerHTML = '';
        this.previewFrame.appendChild(iframe);

        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(currentPageContent);
        iframe.contentWindow.document.close();

        iframe.onload = () => {
            const doc = iframe.contentDocument || iframe.contentWindow.document;
            const style = doc.createElement('style');
            style.innerHTML = `
                .single-column {
                    display: flex !important;
                    flex-direction: column !important;
                    align-items: center !important;
                    gap: 32px !important;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                    box-sizing: border-box;
                }
                #backToTop {
                    position: fixed;
                    bottom: 20px;
                    right: 20px;
                    padding: 10px;
                    background: #007bff;
                    color: #fff;
                    border: none;
                    border-radius: 5px;
                    cursor: pointer;
                }
            `;
            doc.head.appendChild(style);
        };

        window.scrollTo({ top: scrollY, behavior: 'auto' });
        this.updatePageNavigation();
        this.showPostGenerationOptions();
    }

    updatePageNavigation() {
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        const pageIndicator = document.getElementById('pageIndicator');

        prevButton.disabled = this.currentPage === 0;
        nextButton.disabled = this.currentPage === this.generatedPages.length - 1;
        pageIndicator.textContent = `Page ${this.currentPage + 1} of ${this.generatedPages.length}`;
    }

    showPostGenerationOptions() {
        const previewControls = document.querySelector('.preview-controls');
        if (!previewControls || document.getElementById('postGenActions')) return;

        const panel = document.createElement('div');
        panel.id = 'postGenActions';
        panel.className = 'post-gen-panel';
        panel.innerHTML = `
            <h3>✅ Your site is ready! What would you like to do next?</h3>
            <div class="action-buttons">
                <button class="btn btn-outline" id="regeneratePageBtn">🔄 Regenerate a Specific Page</button>
                <button class="btn btn-outline" id="addBrandingBtn">✏️ Add Branding</button>
                <button class="btn btn-outline" id="deploymentHelpBtn">🌍 Deployment Instructions</button>
            </div>
        `;

        previewControls.appendChild(panel);

        document.getElementById('regeneratePageBtn').addEventListener('click', () => {
            const modal = document.getElementById('regenerateModal');
            const select = document.getElementById('regeneratePageSelect');

            if (modal && select) {
                modal.style.display = 'block';
                select.selectedIndex = this.currentPage; // Show current page by default
            }
        });

        document.getElementById('addBrandingBtn').addEventListener('click', () => {
            alert('Add Branding (scaffolded) — logo, favicon, email insertion UI coming soon.');
        });

        document.getElementById('deploymentHelpBtn').addEventListener('click', () => {
            alert('Deployment Instructions (GitHub Pages, Netlify, custom domain)');
        });

        this.initializeCustomizationPanel();  // Make sure to call it here as well
    }

    initializeCustomizationPanel() {
        const iframe = this.previewFrame.querySelector('iframe');
        if (!iframe) return;

        const getIframeDoc = () => iframe.contentDocument || iframe.contentWindow.document;

        const attachHandler = (id, handler) => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', handler);
        };

        attachHandler('randomFontBtn', () => {
            const fonts = ['Arial', 'Georgia', 'Verdana', 'Courier New', 'Trebuchet MS'];
            const selected = fonts[Math.floor(Math.random() * fonts.length)];
            getIframeDoc().body.style.fontFamily = selected;
        });

        attachHandler('randomNavBtn', () => {
            const nav = getIframeDoc().querySelector('nav');
            if (nav) {
                const styles = [
                    'background: #000; color: white; padding: 10px;',
                    'background: #f8f9fa; color: #333; padding: 20px;',
                    'background: linear-gradient(to right, #4b6cb7, #182848); color: white; padding: 15px;'
                ];
                nav.style.cssText = styles[Math.floor(Math.random() * styles.length)];
            }
        });

        attachHandler('randomColorsBtn', () => {
            const colors = ['#f0f8ff', '#fffbe6', '#e3fcef', '#f9e2e2', '#e8f0fe'];
            getIframeDoc().querySelectorAll('section').forEach(sec => {
                sec.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            });
        });

        attachHandler('toggleLayoutBtn', () => {
            const main = getIframeDoc().querySelector('main');
            if (main) main.classList.toggle('single-column');
        });

        attachHandler('editTextBtn', () => {
            const doc = getIframeDoc();
            const textEls = doc.querySelectorAll('h1, h2, h3, p');
            document.getElementById('editNotice').style.display = 'block';
            textEls.forEach(el => {
                el.contentEditable = true;
                el.style.outline = '1px dashed #00b894';
            });
            doc.body.addEventListener('click', () => {
                document.getElementById('editNotice').style.display = 'none';
            }, { once: true });
        });

        attachHandler('swapHeroImageBtn', () => {
            document.getElementById('imageModal').style.display = 'block';
        });

        attachHandler('applyHeroImageBtn', () => {
            const url = document.getElementById('newHeroImageUrl').value;
            const img = getIframeDoc().querySelector('section img, header img');
            if (img && url) {
                img.src = url;
                document.getElementById('imageModal').style.display = 'none';
            }
        });

        attachHandler('closeImageModal', () => {
            document.getElementById('imageModal').style.display = 'none';
        });

        attachHandler('addBackToTopBtn', () => {
            const doc = getIframeDoc();
            if (!doc.getElementById('backToTop')) {
                const btn = doc.createElement('button');
                btn.id = 'backToTop';
                btn.textContent = '⬆️ Top';
                btn.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:10px;background:#007bff;color:#fff;border:none;border-radius:5px;cursor:pointer;';
                btn.onclick = () => doc.documentElement.scrollTop = 0;
                doc.body.appendChild(btn);
            }
        });

        attachHandler('insertLinksBtn', () => {
            getIframeDoc().querySelectorAll('a[href^=\"#\"], button').forEach((el, i) => {
                if (el.tagName === 'A') el.href = `https://example.com/link-${i}`;
                el.textContent += ' 🔗';
            });
        });
    }

    // Placeholder methods
    goToStep(stepNumber) {
        // Your implementation here
    }

    handleSubmit() {
        // Your implementation here
    }

    validateStep(stepId) {
        // Your implementation here
    }

    downloadGeneratedSite() {
        // Your implementation here
    }

    highlightStep(stepNumber) {
        // Your implementation here
    }

    showError(message) {
        // Your implementation here
    }

    showSuccess(message) {
        // Your implementation here
    }

    showLoading() {
        // Your implementation here
    }

    hideLoading() {
        // Your implementation here
    }


    showSuccess(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-success';
        alert.innerHTML = message;
        this.form.insertBefore(alert, this.form.firstChild);
        setTimeout(() => alert.remove(), 5000);
    }

    showError(message) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-error';
        alert.innerHTML = message;
        this.form.insertBefore(alert, this.form.firstChild);
        setTimeout(() => alert.remove(), 5000);
    }

    changePage(direction) {
        this.currentPage += direction;
        this.currentPage = Math.max(0, Math.min(this.currentPage, this.generatedPages.length - 1));
        this.updatePreview();
    }

    changePreviewDevice(device) {
        const sizes = {
            mobile: '375px',
            tablet: '768px',
            desktop: '100%'
        };

        const iframe = this.previewFrame.querySelector('iframe');
        if (iframe) {
            iframe.style.width = sizes[device];
        }

        document.querySelectorAll('.preview-controls button').forEach(button => {
            button.classList.toggle('active', button.id === `${device}Preview`);
        });
    }

    downloadGeneratedSite() {
        if (!this.userHasPaid) {
            alert('Please purchase access to download your website.');
            return;
        }

        if (!this.generatedPages.length) {
            alert('No website generated yet.');
            return;
        }

        const zip = new JSZip();
        this.generatedPages.forEach((html, i) => {
            zip.file(`page${i + 1}.html`, html);
        });

        zip.generateAsync({ type: 'blob' }).then(blob => {
            saveAs(blob, "my-website.zip");
        });
    }

initializeCustomizationPanel() {
    const iframe = this.previewFrame.querySelector('iframe');
    if (!iframe) return;

    const getIframeDoc = () => iframe.contentDocument || iframe.contentWindow.document;

    const attachHandler = (id, handler) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', handler);
    };

    attachHandler('randomFontBtn', () => {
        const fonts = ['Arial', 'Georgia', 'Verdana', 'Courier New', 'Trebuchet MS'];
        const selected = fonts[Math.floor(Math.random() * fonts.length)];
        getIframeDoc().body.style.fontFamily = selected;
    });

    attachHandler('randomNavBtn', () => {
        const nav = getIframeDoc().querySelector('nav');
        if (nav) {
            const styles = [
                'background: #000; color: white; padding: 10px;',
                'background: #f8f9fa; color: #333; padding: 20px;',
                'background: linear-gradient(to right, #4b6cb7, #182848); color: white; padding: 15px;'
            ];
            nav.style.cssText = styles[Math.floor(Math.random() * styles.length)];
        }
    });

    attachHandler('randomColorsBtn', () => {
        const colors = ['#f0f8ff', '#fffbe6', '#e3fcef', '#f9e2e2', '#e8f0fe'];
        getIframeDoc().querySelectorAll('section').forEach(sec => {
            sec.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        });
    });

    attachHandler('toggleLayoutBtn', () => {
        const main = getIframeDoc().querySelector('main');
        if (main) main.classList.toggle('single-column');
    });

    attachHandler('editTextBtn', () => {
        const doc = getIframeDoc();
        const textEls = doc.querySelectorAll('h1, h2, h3, p');
        document.getElementById('editNotice').style.display = 'block';
        textEls.forEach(el => {
            el.contentEditable = true;
            el.style.outline = '1px dashed #00b894';
        });
        doc.body.addEventListener('click', () => {
            document.getElementById('editNotice').style.display = 'none';
        }, { once: true });
    });

    attachHandler('swapHeroImageBtn', () => {
        document.getElementById('imageModal').style.display = 'block';
    });

    attachHandler('applyHeroImageBtn', () => {
        const url = document.getElementById('newHeroImageUrl').value;
        const img = getIframeDoc().querySelector('section img, header img');
        if (img && url) {
            img.src = url;
            document.getElementById('imageModal').style.display = 'none';
        }
    });

    attachHandler('closeImageModal', () => {
        document.getElementById('imageModal').style.display = 'none';
    });

    attachHandler('addBackToTopBtn', () => {
        const doc = getIframeDoc();
        if (!doc.getElementById('backToTop')) {
            const btn = doc.createElement('button');
            btn.id = 'backToTop';
            btn.textContent = '⬆️ Top';
            btn.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:10px;background:#007bff;color:#fff;border:none;border-radius:5px;cursor:pointer;';
            btn.onclick = () => doc.documentElement.scrollTop = 0;
            doc.body.appendChild(btn);
        }
    });

    attachHandler('insertLinksBtn', () => {
        getIframeDoc().querySelectorAll('a[href^=\"#\"], button').forEach((el, i) => {
            if (el.tagName === 'A') el.href = `https://example.com/link-${i}`;
            el.textContent += ' 🔗';
        });
    });
}





showPostGenerationOptions() {
    const previewControls = document.querySelector('.preview-controls');
    if (!previewControls || document.getElementById('postGenActions')) return;

    const panel = document.createElement('div');
    panel.id = 'postGenActions';
    panel.className = 'post-gen-panel';
    panel.innerHTML = `
        <h3>✅ Your site is ready! What would you like to do next?</h3>
        <div class="action-buttons">
            <button class="btn btn-outline" id="regeneratePageBtn">🔄 Regenerate a Specific Page</button>
            <button class="btn btn-outline" id="addBrandingBtn">✏️ Add Branding</button>
            <button class="btn btn-outline" id="deploymentHelpBtn">🌍 Deployment Instructions</button>
        </div>
    `;

    previewControls.appendChild(panel);

document.getElementById('regeneratePageBtn').addEventListener('click', () => {
    const modal = document.getElementById('regenerateModal');
    const select = document.getElementById('regeneratePageSelect');

    if (modal && select) {
        modal.style.display = 'block';
        select.selectedIndex = this.currentPage; // Show current page by default
    }
});



    document.getElementById('addBrandingBtn').addEventListener('click', () => {
        alert('Add Branding (scaffolded) — logo, favicon, email insertion UI coming soon.');
    });

    document.getElementById('deploymentHelpBtn').addEventListener('click', () => {
        alert('Deployment Instructions (GitHub Pages, Netlify, custom domain)');
    });

this.initializeCustomizationPanel();
 
}



}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    new WebsiteGenerator();
});