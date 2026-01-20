// WebsiteGenerator.submit.js — FIXED (Render-safe, no race conditions)

WebsiteGenerator.prototype.handleSubmit = async function () {
  this.goToStep(5);
  this.showLoading();

  try {
    const formData = new FormData(this.form);
    const finalPrompt = this.buildFinalPrompt(formData);

    // ---- HARD REQUIRE sessionId EARLY ----
    let sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("sessionId", sessionId);
    }

    // Save business name for Stripe + backend
    const businessName = formData.get("businessName") || "";
    localStorage.setItem("businessName", businessName);

    const API = "https://websitegeneration.onrender.com/api";

    // ---- GENERATE PAGES ----
    const response = await fetch(`${API}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: finalPrompt,
        pageCount: formData.get("pageCount") || "1",
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Generate failed: ${response.status} — ${text.slice(0, 200)}`
      );
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.pages) || !data.pages.length) {
      throw new Error("Page generation failed or returned empty pages");
    }

    // ---- STORE LOCALLY ----
    this.generatedPages = data.pages;
    localStorage.setItem(
      "generatedPages",
      JSON.stringify(this.generatedPages)
    );
    this.currentPage = 0;

    // ---- CRITICAL FIX: AWAIT SERVER PERSISTENCE ----
    const storeRes = await fetch(`${API}/store-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        step: "pages",
        content: data.pages,
        businessName,
      }),
    });

    if (!storeRes.ok) {
      const text = await storeRes.text();
      throw new Error(
        `Failed to persist pages on server — ${storeRes.status}: ${text.slice(
          0,
          200
        )}`
      );
    }

    // ---- UI ----
    this.updatePreview();
    this.showSuccess("Website generated successfully!");
  } catch (error) {
    console.error(error);
    this.showError("Failed to generate: " + error.message);
  } finally {
    this.hideLoading();
  }
};

// =======================================================
// buildFinalPrompt (UNCHANGED)
// =======================================================
WebsiteGenerator.prototype.buildFinalPrompt = function (formData) {
  const websiteType = formData.get("websiteType");
  const pageCount = formData.get("pageCount");
  const pages = Array.from(formData.getAll("pages")).join(", ");
  const businessName = formData.get("businessName");
  const businessType = formData.get("businessType");
  const businessDescription = formData.get("businessDescription");
  const features = Array.from(formData.getAll("features")).join(", ");
  const colorScheme = formData.get("colorScheme");
  const fontStyle = formData.get("fontStyle");
  const layoutPreference = formData.get("layoutPreference");
  const enhancements = Array.from(formData.getAll("enhancements")).join(", ");

  return `
You are a professional website developer.
Generate exactly ${pageCount} fully standalone HTML pages: ${pages}.
Each page must be a complete, self-contained HTML5 document with internal <style> and <script> tags only.
Do not include explanations or comments.

Design:
- Semantic HTML5
- Flexbox or Grid
- Fully responsive (1024px, 768px, 480px, 360px)

Details:
- Type: ${websiteType}
- Business: "${businessName}" (${businessType})
- Features: ${features}
- Design: ${colorScheme}, ${fontStyle}, ${layoutPreference}
- Enhancements: ${enhancements}

Business Description:
"${businessDescription}"

Content:
- 6–8 sections per page
- No Lorem Ipsum
- Real images + FontAwesome icons
- Clear CTAs
`.trim();
};
