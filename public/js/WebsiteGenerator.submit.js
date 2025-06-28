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
      this.currentPage = 0;

      const sessionId = localStorage.getItem('sessionId');
      await fetch('https://websitegeneration.onrender.com/store-step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionId,
          step: 'pages',
          content: data.pages
        })
      });

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
};

