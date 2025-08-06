export function normalizePages(pages, fallbackNames = []) {
  return pages.map((raw, i) => {
    let content = typeof raw === 'string'
      ? raw
      : (typeof raw?.content === 'string' ? raw.content : '');

    const filename = `${fallbackNames[i] || `page${i + 1}`}.html`;

    const isGarbage = content.includes('Page') && content.toLowerCase().includes('failed to generate');

    if (!content.trim().startsWith('<html')) {
      content = `<html><head><meta charset="UTF-8"><title>${filename}</title></head><body>${content}`;
    }
    if (!content.trim().endsWith('</html>')) {
      content = `${content}</body></html>`;
    }

    return {
      filename,
      content: !content || isGarbage
        ? `<html><head><meta charset="UTF-8"><title>${filename} (Failed)</title></head><body style="font-family:sans-serif;padding:3rem;">
             <h1 style="color:red;">❌ ${filename} failed to generate.</h1>
             <p>Try simplifying your prompt, reducing features, or shortening your description.</p>
           </body></html>`
        : content
    };
  });
}
