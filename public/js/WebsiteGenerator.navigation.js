// =======================
// ✅ Smart Navigation Injection
// =======================
export function injectSmartNavigation(pages, knownSections) {
  const isSinglePage = pages.length === 1;

  return pages.map(page => {
    if (!page || typeof page.content !== 'string') return page;

    // Find anchors in known sections
    const anchors = knownSections.filter(id =>
      page.content.includes(`id="${id}"`) || page.content.includes(`id='${id}'`)
    );

    // Only inject if single page OR enough sections exist
    if (isSinglePage || anchors.length > 3) {
      const navHTML = `
        <nav style="position: sticky; top: 0; background: #111; z-index: 999; padding: 10px 20px;">
          <ul style="display: flex; gap: 20px; list-style: none; justify-content: center; margin: 0;">
            ${anchors.map(id => `<li><a href="#${id}" style="color: #fff; text-decoration: none;">${id}</a></li>`).join('')}
          </ul>
        </nav>`;

      // Replace an existing nav or inject at the top of <body>
      if (/<nav[\s\S]*?<\/nav>/i.test(page.content)) {
        page.content = page.content.replace(/<nav[\s\S]*?<\/nav>/i, navHTML);
      } else {
        page.content = page.content.replace(/<body[^>]*>/i, match => `${match}\n${navHTML}`);
      }

      // Always inject smooth scroll + active link styling
      const enhancements = `
        <style>
          html { scroll-behavior: smooth; }
          nav a.active { color: #ff8800 !important; border-bottom: 2px solid #ff8800; }
        </style>
        <script>
          document.addEventListener('DOMContentLoaded', () => {
            const links = document.querySelectorAll('nav a');
            const sections = Array.from(links).map(link => 
              document.querySelector(link.getAttribute('href'))
            );
            function activateLink() {
              let index = sections.findIndex(section => 
                section && section.getBoundingClientRect().top < window.innerHeight / 2
              );
              links.forEach(link => link.classList.remove('active'));
              if (index !== -1 && links[index]) links[index].classList.add('active');
            }
            window.addEventListener('scroll', activateLink);
            activateLink();
          });
        </script>
      `;

      page.content = page.content.replace(/<\/body>/i, `${enhancements}\n</body>`);
    }

    return page;
  });
}
