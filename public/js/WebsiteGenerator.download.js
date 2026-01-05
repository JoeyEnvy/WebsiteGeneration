// ===========================
// Download as ZIP
// ===========================

WebsiteGenerator.prototype.downloadGeneratedSite = function () {
  if (!this.userHasPaid) {
    alert("Please purchase access to download your website.");
    return;
  }

  if (!this.generatedPages.length) {
    alert("No website generated yet.");
    return;
  }

  const zip = new JSZip();
  this.generatedPages.forEach((html, i) => {
    zip.file(`page${i + 1}.html`, html);
  });

  zip.generateAsync({ type: "blob" }).then((blob) => {
    saveAs(blob, "my-website.zip");
  });
};
