// ===========================
// webgen.submit.js — Vercel-ready
// ===========================

const API_BASE = "https://website-generation.vercel.app/api";

WebsiteGenerator.prototype.handleSubmit = async function () {
  this.goToStep(5);
  this.showLoading();

  try {
    const formData = new FormData(this.form);
    const finalPrompt = this.buildFinalPrompt(formData);

    // ✅ Store businessName for later use (e.g., Stripe checkout)
    localStorage.setItem('businessName', formData.get('businessName') || '');

    // ✅ Ensure sessionId exists
    if (!localStorage.getItem('sessionId')) {
      localStorage.setItem('sessionId', crypto.randomUUID());
    }

    // ✅ Call /generate via Vercel backend
    const response = await fetch(`${API_BASE}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: finalPrompt,
        pageCount: formData.get('pageCount') || '1'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Generate failed: ${response.status} ${response.statusText} — ${text.slice(0, 200)}`);
    }

    const data = await response.json();

    if (data.success) {
      this.generatedPages = data.pages;
      localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));
      this.currentPage = 0;

      const sessionId = localStorage.getItem('sessionId');

      // ✅ Store step data for backend persistence
      const storeRes = await fetch(`${API_BASE}/store-step`, {
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
        console.warn(`⚠️ Store-step failed: ${storeRes.status} ${storeRes.statusText} — ${text.slice(0, 200)}`);
      }

      this.updatePreview();
      this.showSuccess('✅ Website generated successfully!');
    } else {
      throw new Error(data.error || 'Unknown error from server.');
    }
  } catch (error) {
    this.showError('❌ Failed to generate website: ' + error.message);
  } finally {
    this.hideLoading();
  }
};

// ===========================
// buildFinalPrompt()
// ===========================
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
Each page must be a complete, self-contained HTML5 document with internal <style> and <script> tags only.
Do not include explanations or comments.

✅ Design & Structure:
- Use semantic HTML5 (<header>, <nav>, <main>, <section>, <footer>).
- Layout with Flexbox or CSS Grid.
- Include responsive media queries for 1024px, 768px, 480px, and 360px.
- Modern, aesthetic, and professional style by default.

📦 Project Details:
- Website Type: ${websiteType}
- Business: "${businessName}" (${businessType})
- Pages: ${pages}
- Features: ${features}
- Design: ${colorScheme} theme, ${fontStyle} fonts, ${layoutPreference} layout.

📝 Business Description:
"${businessDescription}" — expand this into 2–3 rich paragraphs (300–500 words) describing the business goals, tone, and purpose. Add 4–6 bullet points presented in columns or a styled grid.

🎨 Visual Requirements:
- Minimum 3 unique images per page from Unsplash, Pexels, or Pixabay.
- Minimum 3 FontAwesome icons per page.
- Style all images with shadows, rounded corners, and spacing.
- Alternate section backgrounds for rhythm.

🎭 Layout & Style Randomization:
- Randomize one or more per page: font pairing, navbar layout, section order, animation style, or theme accent.
- Example variations: glassmorphism, brutalist, minimalist, or retro vaporwave.

🧱 Mandatory Sections (at least 6–8):
1. Hero / Intro Section
2. About or Overview
3. Features or Services Grid
4. Testimonials or Reviews
5. Gallery or Showcase
6. Contact or Call-to-Action
7. Footer with business info and links.

📋 Content Rules:
- No “Lorem Ipsum”.
- Use clear CTAs, icon bullets, styled quotes, and engaging headlines.
- Maintain realism and variety across pages.

Goal: produce visually distinct, high-quality, production-ready HTML pages.
`.trim();
};
