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

Generate exactly ${pageCount} fully standalone HTML pages named: ${pages}.
Each page must:
- Be a complete HTML5 document, starting with <html> and ending with </html>
- Contain <head> and <body> sections
- Embed all <style> and <script> inline — no external files
- Include a <title> matching the page's name
- Be fully viewable when opened directly in a browser
- Never include Markdown, explanations, or raw text — ONLY HTML

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
