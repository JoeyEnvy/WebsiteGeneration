// ✅ Handle dynamic contact email field
document.addEventListener('DOMContentLoaded', function () {
  const checkbox = document.getElementById('contactFormCheckbox');
  const emailInput = document.getElementById('contactEmail');
  const container = document.getElementById('contactEmailContainer');

  checkbox.addEventListener('change', function () {
    if (this.checked) {
      container.style.display = 'block';
      emailInput.setAttribute('required', 'required');
    } else {
      container.style.display = 'none';
      emailInput.removeAttribute('required');
      emailInput.value = '';
    }
  });
});

// ✅ Submit handler
WebsiteGenerator.prototype.handleSubmit = async function () {
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
    console.log('🌐 FINAL FETCH PAYLOAD:', JSON.stringify({ query: finalPrompt, pageCount }));

    const generateResponse = await fetch('https://websitegeneration.onrender.com/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: finalPrompt, pageCount })
    });

    const data = await generateResponse.json();
    console.log('✅ /generate response:', data);

    if (!data.success || !Array.isArray(data.pages)) {
      throw new Error(data.error || 'Server did not return valid pages.');
    }

    // Normalize response (either string pages or {filename, content} objects)
    this.generatedPages = data.pages.map((page, i) => {
      const content = typeof page === 'string' ? page : page?.content || '';
      const filename = typeof page === 'object' && page.filename ? page.filename : `page${i + 1}.html`;
      const isValid = typeof content === 'string' && content.includes('<html');
      return {
        filename,
        content: isValid
          ? content
          : `<html><body><h1>Page ${i + 1} failed to generate.</h1></body></html>`
      };
    });

    this.currentPage = 0;
    localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));

    // ✅ Store session pages
    try {
      const storeRes = await fetch('https://websitegeneration.onrender.com/store-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          step: 'pages',
          content: this.generatedPages
        })
      });

      if (!storeRes.ok) {
        const err = await storeRes.text();
        console.warn('❌ Failed to store step data:', err);
      }
    } catch (err) {
      console.error('❌ /store-step fetch failed:', err);
    }

    // ✅ Inject contact form if needed
    if (wantsContactForm && contactEmail) {
      try {
        const scriptRes = await fetch('https://websitegeneration.onrender.com/create-contact-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: contactEmail })
        });

        const { scriptUrl } = await scriptRes.json();

        if (scriptUrl) {
          const injectContactForm = (html, url) =>
            html.replace(/<form[\s\S]*?<\/form>/i, `
              <form action="${url}" method="POST">
                <input name="name" required placeholder="Your name">
                <input name="email" type="email" required placeholder="Your email">
                <textarea name="message" required placeholder="Message"></textarea>
                <button type="submit">Send</button>
              </form>`);

          this.generatedPages = this.generatedPages.map(page => {
            if (page?.filename === 'contact.html' && typeof page.content === 'string') {
              page.content = injectContactForm(page.content, scriptUrl);
            }
            return page;
          });

          localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));
        }
      } catch (err) {
        console.error('❌ Failed to inject contact form:', err);
      }
    }

    // ✅ Inject smart navigation
    const knownSections = ['home', 'about', 'services', 'contact', 'faq', 'features', 'gallery', 'testimonials'];
    const isSinglePage = this.generatedPages.length === 1;

    this.generatedPages = this.generatedPages.map(page => {
      if (!page || typeof page.content !== 'string') return page;

      const availableAnchors = knownSections.filter(id =>
        page.content.includes(`id="${id}"`) || page.content.includes(`id='${id}'`)
      );

      const navHTML = () => {
        let nav = `<nav style="position: sticky; top: 0; background: #111; z-index: 999; padding: 10px 20px;">
          <ul style="display: flex; gap: 20px; list-style: none; justify-content: center;">`;
        for (const id of availableAnchors) {
          nav += `<li><a href="#${id}" style="color: #fff; text-decoration: none;">${id.charAt(0).toUpperCase() + id.slice(1)}</a></li>`;
        }
        nav += `</ul></nav>`;
        return nav;
      };

      if (isSinglePage || availableAnchors.length > 3) {
        page.content = page.content.replace(/<nav[\s\S]*?<\/nav>/i, navHTML());
        page.content = page.content.replace('</body>', `
          <style>
            html { scroll-behavior: smooth; }
            nav a.active {
              color: #ff8800 !important;
              border-bottom: 2px solid #ff8800;
            }
          </style>
          <script>
            document.addEventListener('DOMContentLoaded', () => {
              const links = document.querySelectorAll('nav a');
              const sections = Array.from(links).map(link => document.querySelector(link.getAttribute('href')));
              function activateLink() {
                let index = sections.findIndex(section => section && section.getBoundingClientRect().top >= 0);
                links.forEach(link => link.classList.remove('active'));
                if (index !== -1 && links[index]) {
                  links[index].classList.add('active');
                }
              }
              window.addEventListener('scroll', activateLink);
              activateLink();
            });
          </script>
        </body>`);
      }

      return page;
    });

    // ✅ Final check before preview
    const previewCandidate = this.generatedPages[this.currentPage];
    if (!previewCandidate || !previewCandidate.content.includes('<html')) {
      console.error('❌ currentPageContent is invalid:', this.currentPage);
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

// ✅ Final prompt builder
WebsiteGenerator.prototype.buildFinalPrompt = function (formData) {
  const websiteType = formData.get('websiteType') || '';
  const pageCount = formData.get('pageCount') || '1';
  const pages = Array.from(formData.getAll('pages')).join(', ') || '';
  const businessName = formData.get('businessName') || '';
  const businessType = formData.get('businessType') || '';
  const businessDescription = formData.get('businessDescription') || '';
  const features = Array.from(formData.getAll('features')).join(', ') || '';
  const colorScheme = formData.get('colorScheme') || '';
  const fontStyle = formData.get('fontStyle') || '';
  const layoutPreference = formData.get('layoutPreference') || '';
  const enhancements = Array.from(formData.getAll('enhancements')).join(', ') || '';

  return `
You are a professional website developer.

Generate exactly ${pageCount} fully standalone HTML pages: ${pages}.
Each page must be a complete, fully working HTML5 document using <style> and <script> (no external CSS or JS).
No comments or explanations.

✅ Core Design Guidelines:
- Use semantic HTML5 with <header>, <nav>, <main>, <section>, <footer>.
- Fully responsive using CSS grid/flexbox with breakpoints for 1024px, 768px, 480px, 360px.
- Style using clean, modern design principles and accessible color contrast.

📦 Project Details:
- Website Type: ${websiteType}
- Business: "${businessName}" (${businessType})
- Pages: ${pages}
- Features: ${features}
- Visuals: ${colorScheme} color scheme, ${fontStyle} fonts, ${layoutPreference} layout

📣 Expand on Description:
"${businessDescription}" — Expand this into a 2–3 paragraph About section (300–500 words), realistic tone, followed by a grid of 4–6 bullet point highlights.

🎯 Required Features:
- Newsletter signup form on homepage
- Testimonial slider (JS)
- Image gallery (lightbox optional)
- FAQ accordion with smooth toggle
- Pricing table
- Floating call-to-action button
- Modal popup (triggered on click)
- Contact form if requested

🎨 Visual Variation:
- Must not reuse images between pages
- 3+ public domain images per page
- Use FontAwesome icons, unique styling (shadows, border-radius, overlays)

🧠 Smart Variation:
- Vary font pairings using Google Fonts
- Vary navbar types: top, side, floating, pill tabs, full-width
- Use animations (fade-in, scroll-reveal, zoom-in)
- Apply random visual themes per site: glassmorphism, brutalist, minimal, vaporwave, etc.
- At least one section must use SVG separators or CSS clip-paths

🧱 Required Sections (per page):
- Hero Banner
- About or Business Overview
- Services / Features Grid
- Pricing or Plans Table
- Image Showcase or Gallery
- Testimonials or Quotes
- Newsletter Signup or Contact Form
- Footer with location, socials, copyright

Make the website feel premium, original, and fully functional. Avoid repetition. No lorem ipsum.
`.trim();
};
