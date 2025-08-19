// =======================
// ✅ Page Normalization Utility
// =======================
export function normalizePages(pages, fallbackNames = []) {
  return pages.map((raw, i) => {
    // Extract raw content
    let content = '';
    if (typeof raw === 'string') {
      content = raw;
    } else if (raw && typeof raw.content === 'string') {
      content = raw.content;
    }

    // Assign safe filename
    const baseName = fallbackNames[i] || `page${i + 1}`;
    const filename = `${baseName.replace(/\s+/g, '_').toLowerCase()}.html`;

    // Garbage/failure detection
    const isGarbage =
      !content ||
      content.length < 50 || // too short to be real
      /(failed|error|not generated|lorem ipsum)/i.test(content);

    // Ensure full HTML structure
    if (!/^<html[\s\S]*<\/html>$/i.test(content.trim())) {
      content = `
        <html>
          <head>
            <meta charset="UTF-8">
            <title>${baseName}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body>${content || ''}</body>
        </html>
      `.trim();
    }

    // Return normalized page object
    return {
      filename,
      content: isGarbage
        ? `
          <html>
            <head>
              <meta charset="UTF-8">
              <title>${baseName} (Failed)</title>
            </head>
            <body style="font-family:sans-serif;padding:3rem;background:#111;color:#eee;">
              <h1 style="color:#ff4444;">❌ ${baseName} failed to generate.</h1>
              <p>Try simplifying your prompt, reducing features, or shortening your description.</p>
            </body>
          </html>
        `.trim()
        : content
    };
  });
}
