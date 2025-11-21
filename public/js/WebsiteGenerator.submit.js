// WebsiteGenerator.submit.js — works with Render (and Vercel if you ever go back)

WebsiteGenerator.prototype.handleSubmit = async function () {
  this.goToStep(5);
  this.showLoading();

  try {
    const formData = new FormData(this.form);
    const finalPrompt = this.buildFinalPrompt(formData);

    // Save business name for Stripe later
    localStorage.setItem('businessName', formData.get('businessName') || '');

    // Make sure we have a session ID
    if (!localStorage.getItem('sessionId')) {
      localStorage.setItem('sessionId', crypto.randomUUID());
    }

    // USE RENDER URL — THIS IS THE ONLY CHANGE YOU NEED
    const API = "https://websitegeneration.onrender.com/api";

    const response = await fetch(`${API}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: finalPrompt,
        pageCount: formData.get('pageCount') || '1'
      })
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Generate failed: ${response.status} — ${text.slice(0, 200)}`);
    }

    const data = await response.json();

    if (data.success) {
      this.generatedPages = data.pages;
      localStorage.setItem('generatedPages', JSON.stringify(this.generatedPages));
      this.currentPage = 0;

      // Store pages in session (optional)
      const sessionId = localStorage.getItem('sessionId');
      await fetch(`${API}/store-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          step: 'pages',
          content: data.pages
        })
      }).catch(() => {}); // ignore if fails

      this.updatePreview();
      this.showSuccess('Website generated successfully!');
    } else {
      throw new Error(data.error || 'Unknown server error');
    }
  } catch (error) {
    console.error(error);
    this.showError('Failed to generate: ' + error.message);
  } finally {
    this.hideLoading();
  }
};

// buildFinalPrompt – unchanged, just kept here for full file
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
Design & Structure:
- Use semantic HTML5
- Layout with Flexbox or CSS Grid
- Fully responsive (1024px, 768px, 480px, 360px)
- Modern, professional style
Project Details:
- Type: ${websiteType}
- Business: "${businessName}" (${businessType})
- Pages: ${pages}
- Features: ${features}
- Design: ${colorScheme} theme, ${fontStyle} fonts, ${layoutPreference} layout
Business Description:
"${businessDescription}"
Visuals:
- At least 3 real images per page (Unsplash/Pexels/Pixabay)
- At least 3 FontAwesome icons per page
- Styled images with shadows/rounded corners
Mandatory Sections (6–8):
1. Hero / Intro
2. About / Overview
3. Features / Services Grid
4. Testimonials
5. Gallery / Showcase
6. Contact / CTA
7. Footer
Content Rules:
- No Lorem Ipsum
- Clear CTAs, styled quotes, engaging headlines
- Randomize layout, fonts, or accent colors per page for variety
Goal: high-quality, production-ready HTML pages.
`.trim();
};