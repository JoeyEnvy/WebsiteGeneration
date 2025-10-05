WebsiteGenerator.prototype.handleSubmit = async function () {
  this.goToStep(5);
  this.showLoading();

  try {
    const formData = new FormData(this.form);
    const finalPrompt = this.buildFinalPrompt(formData);

    // ✅ Store businessName for later use (e.g., full-hosting checkout)
    localStorage.setItem('businessName', formData.get('businessName') || '');

    if (!localStorage.getItem('sessionId')) {
      localStorage.setItem('sessionId', crypto.randomUUID());
    }

    // ✅ Detect backend base URL (same as domainChecker.js)
    const backendHost =
      window.PUBLIC_BACKEND_URL ||
      (window.location.protocol.startsWith('http')
        ? `${window.location.protocol}//${window.location.host}`
        : 'http://localhost:3000');

    // ✅ Call /generate on backend
    const response = await fetch(`${backendHost}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: finalPrompt,
        pageCount: formData.get('pageCount') || '1'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Generate failed: ${response.status} ${response.statusText} — ${text.slice(0,200)}`);
    }

    const data = await response.json();

    if (data.success) {
      this.generatedPages = data.pages;
      localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));
      this.currentPage = 0;

      const sessionId = localStorage.getItem('sessionId');

      // ✅ Call /store-step on backend
      const storeRes = await fetch(`${backendHost}/store-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          step: 'pages',
          content: data.pages
        })
      });

      if (!storeRes.ok) {
        const text = await storeRes.text();
        console.warn(`⚠️ Store-step failed: ${storeRes.status} ${storeRes.statusText} — ${text.slice(0,200)}`);
      }

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
};

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
