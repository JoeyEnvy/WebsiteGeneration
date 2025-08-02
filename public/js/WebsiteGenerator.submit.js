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
    const selectedFeatures = formData.getAll('features');
    let contactEmail = null;

    if (selectedFeatures.includes('contact form')) {
      contactEmail = formData.get('contactEmail')?.trim();
      if (contactEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
        localStorage.setItem('contactEmail', contactEmail);
      } else {
        contactEmail = null;
      }
    }

    const finalPrompt = this.buildFinalPrompt(formData);
    const pageCount = formData.get('pageCount') || '1';
    const sessionId = localStorage.getItem('sessionId') || crypto.randomUUID();

    localStorage.setItem('sessionId', sessionId);
    localStorage.setItem('businessName', formData.get('businessName') || '');

    console.log('🚀 FINAL PROMPT:', finalPrompt);
    console.log('📦 Sending to /generate →', { query: finalPrompt, pageCount });

    const generateResponse = await fetch('https://websitegeneration.onrender.com/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: finalPrompt, pageCount })
    });

    const data = await generateResponse.json();
    if (!data.success || !Array.isArray(data.pages)) {
      throw new Error(data.error || 'Server did not return valid pages.');
    }

    this.generatedPages = data.pages;
    this.currentPage = 0;
    localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));

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

    if (selectedFeatures.includes('contact form') && contactEmail) {
      try {
        const scriptRes = await fetch('https://websitegeneration.onrender.com/create-contact-script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: contactEmail })
        });

        const { scriptUrl } = await scriptRes.json();
        const injectContactForm = (html, url) =>
          html.replace(/<form[\s\S]*?<\/form>/i, `
            <form action="${url}" method="POST">
              <input name="name" required placeholder="Your name">
              <input name="email" type="email" required placeholder="Your email">
              <textarea name="message" required placeholder="Message"></textarea>
              <button type="submit">Send</button>
            </form>`);

        this.generatedPages = this.generatedPages.map(page => {
          if (page.filename === 'contact.html') {
            page.content = injectContactForm(page.content, scriptUrl);
          }
          return page;
        });

        localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));
      } catch (err) {
        console.error('❌ Failed to inject contact form:', err);
      }
    }

    const knownSections = ['home', 'about', 'services', 'contact', 'faq', 'features', 'gallery', 'testimonials'];
    const isSinglePage = this.generatedPages.length === 1;

    this.generatedPages = this.generatedPages.map(page => {
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
Each page must be a complete, fully working HTML5 document using <style> and <script> (no external CSS or JS).
No comments or explanations.

✅ Core Design Guidelines:
- Each website must use semantic HTML5 with <header>, <nav>, <main>, <section>, <footer>.
- Structure layout with flexbox or CSS grid, with balanced spacing and good typography hierarchy.
- Add full responsive design with breakpoints for 1024px, 768px, 480px, and 360px.
- Ensure a clean, professional, modern style — unless otherwise varied below.

📦 Input Details:
- Website Type: ${websiteType}
- Business: "${businessName}" (${businessType})
- Pages: ${pages}
- Features: ${features}
- Design: ${colorScheme} color scheme, ${fontStyle} fonts, ${layoutPreference} layout

📝 Business Description:
"${businessDescription}" — expand this into 2–3 descriptive paragraphs (300–500 words), using a realistic tone. Then list 4–6 bullet points in columns or grids.

🎨 Required Visual Variation:
- Must not reuse any images between pages.
- Each page must include at least 3 images, pulled from different public sources (e.g. Unsplash, Pexels, Pixabay).
- Include at least 3 FontAwesome icons on every page.
- Use image styling: soft drop shadows, border-radius, padding.

🎭 Layout & Aesthetic Randomization:
- For each site or page, vary one or more of the following:
  - Font pairings using Google Fonts (random, but aesthetic combinations).
  - Navbar styles: top, side, vertical, floating, full-width.
  - Unconventional layouts: mobile-style UIs on desktop, vertical scrolling cards, grid-based panels.
  - Section separators: use SVG curves, slants, or clip-path effects.
  - Transitions and animations: fade-ins, slide-ups, zoom-ins (on load or scroll).
  - Themes: occasionally apply styles like brutalist, retro vaporwave, glassmorphism, neon, or Apple-style minimalism.

🧱 Required Sections:
Each page must include 6–8 sections, for example:
1. Hero Banner
2. Business Overview or About
3. Features or Services Grid
4. Testimonials or Reviews
5. Image Gallery or Showcase
6. Call-to-Action or Signup Panel
7. Contact Form
8. Footer with business details

📋 Content Notes:
- All content must be realistic and relevant.
- No Lorem Ipsum. No placeholder content.
- Include strong CTAs, icon-enhanced bullet lists, headings, and styled quotes.

Ensure maximum visual uniqueness and modern appeal for each website.
`.trim();
};
