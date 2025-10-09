import fetch from "node-fetch";

/**
 * Set DNS records for a domain to point to GitHub Pages.
 * Deletes any existing A/AAAA/CNAME records, then applies
 * the correct GitHub A, AAAA, and www CNAME records.
 */
export async function setGitHubDNS(domain) {
  if (!domain) throw new Error("Domain is required");

  const ghOwner = process.env.GITHUB_USERNAME;
  if (!ghOwner) throw new Error("GITHUB_USERNAME not set");

  const cnameTarget = `${ghOwner}.github.io`;

  const githubIPs = [
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
  ];

  const githubIPv6 = [
    "2606:50c0:8000::153",
    "2606:50c0:8001::153",
    "2606:50c0:8002::153",
    "2606:50c0:8003::153",
  ];

  const creds = {
    apikey: process.env.PORKBUN_API_KEY,
    secretapikey: process.env.PORKBUN_SECRET_KEY,
  };

  if (!creds.apikey || !creds.secretapikey) {
    throw new Error("❌ Missing Porkbun API credentials");
  }

  console.log(`🔧 Updating DNS records for ${domain} via Porkbun API...`);

  // 🧹 Step 1: Fetch existing records
  const getRes = await fetch(
    "https://api.porkbun.com/api/json/v3/dns/retrieve/" + domain,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(creds),
    }
  );

  const existing = await getRes.json();
  if (existing.status !== "SUCCESS") {
    console.warn("⚠️ Could not retrieve DNS records:", existing);
  }

  // 🧼 Step 2: Delete all old A, AAAA, and CNAME records for @ and www
  const toDelete = ["A", "AAAA", "CNAME"];
  if (existing.records?.length) {
    for (const rec of existing.records) {
      if (
        toDelete.includes(rec.type) &&
        (rec.name === "@" || rec.name === "www")
      ) {
        try {
          const delRes = await fetch(
            "https://api.porkbun.com/api/json/v3/dns/delete/" +
              domain +
              "/" +
              rec.id,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(creds),
            }
          );
          const delData = await delRes.json();
          if (delData.status !== "SUCCESS") {
            console.warn(
              `⚠️ Failed to delete record ${rec.type} ${rec.name}:`,
              delData
            );
          }
        } catch (e) {
          console.warn(`⚠️ Error deleting ${rec.type} ${rec.name}: ${e.message}`);
        }
      }
    }
  }

  // ✅ Step 3: Add GitHub A/AAAA + CNAME (www)
  const newRecords = [
    ...githubIPs.map((ip) => ({
      type: "A",
      name: "@",
      content: ip,
      ttl: "600",
    })),
    ...githubIPv6.map((ip6) => ({
      type: "AAAA",
      name: "@",
      content: ip6,
      ttl: "600",
    })),
    { type: "CNAME", name: "www", content: cnameTarget, ttl: "600" },
  ];

  for (const record of newRecords) {
    try {
      const addRes = await fetch(
        "https://api.porkbun.com/api/json/v3/dns/create/" + domain,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...creds, ...record }),
        }
      );
      const addData = await addRes.json();
      if (addData.status !== "SUCCESS") {
        console.warn(
          `⚠️ Failed to add ${record.type} ${record.name}:`,
          addData
        );
      }
    } catch (e) {
      console.warn(`⚠️ Error adding ${record.type} ${record.name}: ${e.message}`);
    }
  }

  console.log(
    `✅ DNS set for ${domain}: A/AAAA (apex) + CNAME www → ${cnameTarget}`
  );
}
