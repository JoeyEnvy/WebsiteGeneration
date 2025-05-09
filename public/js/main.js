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

    // ✅ ADD THIS FULL METHOD BELOW THE CONSTRUCTOR:
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
}


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

        // Inject dynamic style
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

        // ✅ INIT customization only once iframe is ready
        const panel = document.getElementById('customizationPanel');
        if (panel) panel.style.display = 'block';
        this.initializeCustomizationPanel();
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
    }






    goToStep(stepNumber) {
        document.querySelectorAll('.form-step').forEach(step => step.style.display = 'none');
        document.getElementById(`step${stepNumber}`).style.display = 'block';
        this.currentStep = stepNumber;
        this.highlightStep(stepNumber);
    }

    highlightStep(stepNumber) {
        document.querySelectorAll('.step-progress-bar .step').forEach((el, index) => {
            el.classList.toggle('active', index === stepNumber - 1);
        });
    }

    validateStep(stepId) {
        const step = document.getElementById(stepId);
        const requiredFields = step.querySelectorAll('[required]');
        let isValid = true;

        requiredFields.forEach(field => {
            if (!field.value.trim()) {
                this.showFieldError(field, 'This field is required');
                isValid = false;
            } else {
                this.clearFieldError(field);
            }
        });

        const checkboxes = step.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length) {
            const anyChecked = Array.from(checkboxes).some(cb => cb.checked);
            if (!anyChecked) {
                this.showCheckboxError(checkboxes[0], 'Select at least one option');
                isValid = false;
            } else {
                this.clearCheckboxError(checkboxes[0]);
            }
        }

        return isValid;
    }

    showFieldError(field, message) {
        this.clearFieldError(field);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.innerHTML = message;
        field.parentNode.appendChild(errorDiv);
        field.classList.add('error');
    }

    clearFieldError(field) {
        const errorDiv = field.parentNode.querySelector('.field-error');
        if (errorDiv) errorDiv.remove();
        field.classList.remove('error');
    }

    showCheckboxError(field, message) {
        const group = field.closest('.checkbox-group');
        if (group && !group.querySelector('.field-error')) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'field-error';
            errorDiv.innerHTML = message;
            group.appendChild(errorDiv);
        }
    }

    clearCheckboxError(field) {
        const group = field.closest('.checkbox-group');
        const errorDiv = group?.querySelector('.field-error');
        if (errorDiv) errorDiv.remove();
    }

    async handleSubmit() {
        this.goToStep(5);
        this.showLoading();

        try {
            const formData = new FormData(this.form);
            const finalPrompt = this.buildFinalPrompt(formData);

            const response = await fetch('https://websitegeneration.onrender.com/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: finalPrompt,
                    pageCount: formData.get('pageCount') || '1'
                })
            });

            const data = await response.json();

            if (data.success) {
                this.generatedPages = data.pages;
                localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));
                this.updatePreview();
                this.showSuccess('Website generated successfully!');
            } else {
                throw new Error(data.error || 'Unknown error from server.');
            }
        } catch (error) {
            this.showError('Failed to generate website: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    buildFinalPrompt(formData) {
        const websiteType = formData.get('websiteType');
        const pageCount = formData.get('pageCount');
        const pages = Array.from(formData.getAll('pages')).join(', ');
        const businessName = formData.get('businessName');
        const businessType = formData.get('businessType');
        const businessDescription = formData.get('businessDescription');
        const features = Array.from(formData.getAll('features')).join(', ');
        const colorScheme = formData.get('colorScheme');
        const fontStyle = formData.get('fontStyle');
        const layoutPreference = formData.get('layoutPreference');
        const enhancements = Array.from(formData.getAll('enhancements')).join(', ');

        return `
You are a professional website developer.

Generate exactly ${pageCount} fully standalone HTML pages: ${pages}.
Each page must be a complete HTML5 document using embedded <style> and <script> only.
Do not explain or comment anything.

✅ Design Requirements:
- Use a clean, modern, professional layout.
- Use responsive design with media queries for 1024px, 768px, 480px, and 320px breakpoints.
- Structure pages using semantic HTML5 elements: <header>, <nav>, <main>, <section>, <footer>.
- Use grid or flex layout systems to organize content into responsive rows and columns.
- Prioritize good spacing, font hierarchy, and visual balance.
- Style all images with soft shadows, borders, and proper padding.

📦 Details:
- Website Type: ${websiteType}
- Business: "${businessName}" (${businessType})
- Pages: ${pages}
- Features: ${features}
- Design: ${colorScheme} theme, ${fontStyle} font, ${layoutPreference} layout

📝 Business Description:
"${businessDescription}" — expand this into 2–3 rich paragraphs (300–500 words total) that describe the business purpose, audience, and mission. Also include 4–6 bullet points in one or more columns.

📐 Section Structure:
- Each page must include at least 5 clearly labeled sections such as:
  1. Hero Section
  2. About/Description
  3. Services Grid
  4. Testimonials
  5. Contact Section
- Randomize some page layouts: e.g. navbar on top or side, hero image left or right, or full-width banner.

🎨 Visuals & Variation:
- Use different font pairings for headers and body text.
- Mix content alignment (left-aligned, centered, or justified)
- Add alternating section backgrounds for visual rhythm.

🖼️ Images & Icons:
- Pull at least 2–3 relevant images per page from public sources online (Unsplash, Pexels, Pixabay).
- Include at least 3 icons per page using FontAwesome CDN.
- Style images with borders, drop shadows, and spacing.

📋 Content Notes:
- Never use "Lorem Ipsum".
- Use context-aware, realistic, varied content.
- Include clear CTAs, subheadings, bullet lists, and quotes.
        `.trim();
    }

    showLoading() {
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.innerHTML = 'Generating website...';
        this.form.appendChild(loader);
        const submitBtn = this.form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = true;
    }

    hideLoading() {
        const loader = this.form.querySelector('.loader');
        if (loader) loader.remove();
        const submitBtn = this.form.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.disabled = false;
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
            <button class="btn btn-outline" id="editPagesBtn">🛠️ Edit Pages</button>
            <button class="btn btn-outline" id="addBrandingBtn">✏️ Add Branding</button>
            <button class="btn btn-outline" id="deploymentHelpBtn">🌍 Deployment Instructions</button>
        </div>
    `;

    previewControls.appendChild(panel);

    const self = this;
    document.getElementById('editPagesBtn').addEventListener('click', function () {
        const panel = document.getElementById('customizationPanel');
        if (panel) panel.style.display = 'block';
        self.initializeCustomizationPanel(); // ensures buttons are re-hooked
    });

    document.getElementById('addBrandingBtn').addEventListener('click', () => {
        alert('Add Branding (coming soon) — logo, favicon, email options.');
    });

    document.getElementById('deploymentHelpBtn').addEventListener('click', () => {
        alert('Deployment Instructions (GitHub Pages, Netlify, ZIP download).');
    });
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