import { normalizePages } from './utils/normalizePages.js';
import { injectSmartNavigation } from './WebsiteGenerator.navigation.js';

WebsiteGenerator.prototype.handleSubmit = async function () {
  console.log('🔥 handleSubmit() triggered');

  this.goToStep(5);
  this.showLoading();

  try {
    const formData = new FormData(this.form);
    const selectedFeatures = formData.getAll('features') || [];
    const sessionId = localStorage.getItem('sessionId') || crypto.randomUUID();
    const pageCount = formData.get('pageCount') || '1';
    const businessName = formData.get('businessName') || '';

    localStorage.setItem('sessionId', sessionId);
    localStorage.setItem('businessName', businessName);

    let contactEmail = null;
    const wantsContactForm = selectedFeatures.some(f => f?.toLowerCase().includes('contact form'));

    if (wantsContactForm) {
      contactEmail = formData.get('contactEmail')?.trim();
      if (contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        localStorage.setItem('contactEmail', contactEmail);
      } else {
        contactEmail = null;
      }
    }

    const finalPrompt = this.buildFinalPrompt(formData);
    console.log('📋 Raw FormData:', Object.fromEntries(formData.entries()));
    console.log('🚀 FINAL PROMPT:', finalPrompt);

    // 🔁 Step 1: Generate HTML
    const generateResponse = await fetch('https://websitegeneration.onrender.com/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: finalPrompt, pageCount })
    });

    const data = await generateResponse.json();
    if (!data.success || !Array.isArray(data.pages)) {
      throw new Error(data.error || 'Server did not return valid pages.');
    }

    // ✨ Step 2: Enhance content
    let enhancedPages = [];
    try {
      const enhanceResponse = await fetch('https://websitegeneration.onrender.com/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pages: data.pages })
      });
      const enhanceData = await enhanceResponse.json();
      enhancedPages = (enhanceData.success && Array.isArray(enhanceData.pages)) ? enhanceData.pages : data.pages;
    } catch (err) {
      console.warn('⚠️ Enhancement failed:', err);
      enhancedPages = data.pages;
    }

    // 📄 Step 3: Normalize filenames
    const logicalPageNames = ['home', 'about', 'services', 'contact', 'faq'];
    this.generatedPages = normalizePages(enhancedPages, logicalPageNames);
    this.currentPage = 0;
    localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));

    // 💾 Step 4: Store session data
    await fetch('https://websitegeneration.onrender.com/store-step', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, step: 'pages', content: this.generatedPages })
    }).catch(err => console.warn('❌ Failed to store step:', err));

    // 📨 Step 5: Inject contact form (if applicable)
    if (wantsContactForm && contactEmail) {
      try {
        const res = await fetch('https://websitegeneration.onrender.com/create-contact-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: contactEmail })
        });
        const { scriptUrl } = await res.json();
        if (scriptUrl) {
          const inject = html =>
            html.replace(/<form[\s\S]*?<\/form>/i, `
              <form action="${scriptUrl}" method="POST">
                <input name="name" required placeholder="Your name">
                <input name="email" type="email" required placeholder="Your email">
                <textarea name="message" required placeholder="Message"></textarea>
                <button type="submit">Send</button>
              </form>`);
          this.generatedPages = this.generatedPages.map(p => {
            if (p.filename === 'contact.html') p.content = inject(p.content);
            return p;
          });
          localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));
        }
      } catch (err) {
        console.error('❌ Contact form injection failed:', err);
      }
    }

    // 🧠 Step 6: Smart navigation
    const knownSections = ['home', 'about', 'services', 'contact', 'faq', 'features', 'gallery', 'testimonials'];
    this.generatedPages = injectSmartNavigation(this.generatedPages, knownSections);

    // 👁️ Step 7: Render preview
    const previewCandidate = this.generatedPages[this.currentPage];
    const pageHtml = previewCandidate?.content?.trim() || '';

    if (
      !previewCandidate ||
      !pageHtml.startsWith('<html') ||
      !pageHtml.endsWith('</html>') ||
      !pageHtml.includes('<body')
    ) {
      console.error('❌ Page HTML is malformed or missing.');
      this.showError('Preview failed: Invalid HTML content.');
      return;
    }

    this.updatePreview();
    this.showSuccess('Website generated successfully!');
  } catch (error) {
    console.error('❌ Website generation failed:', error);
    this.showError('Failed to generate website: ' + error.message);
  } finally {
    this.hideLoading();
  }
};
