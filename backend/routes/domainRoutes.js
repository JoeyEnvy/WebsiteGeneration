export async function setGitHubPagesDNS_Namecheap(domain, githubUsername) {
  if (!domain) throw new Error("Domain is required");
  if (!githubUsername) throw new Error("GitHub username is required for CNAME target");

  const { DOMAIN_BUYER_URL, INTERNAL_SECRET } = process.env;
  if (!DOMAIN_BUYER_URL || !INTERNAL_SECRET) {
    throw new Error("Domain buyer service not configured (missing env vars)");
  }

  const githubPagesTarget = `${githubUsername.toLowerCase()}.github.io`;
  const githubPagesA = [
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153",
  ];

  const maxProxyRetries = 3;
  let proxyAttempt = 0;
  let proxySuccess = false;

  while (proxyAttempt < maxProxyRetries) {
    try {
      console.log(`Sending DNS setup request for ${domain} → CNAME to ${githubPagesTarget} (attempt ${proxyAttempt + 1})`);

      const res = await fetch(`${DOMAIN_BUYER_URL}/internal/namecheap/set-dns`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": INTERNAL_SECRET,
        },
        body: JSON.stringify({
          domain,
          githubPagesA,
          githubPagesCNAME: githubPagesTarget,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        const txt = await res.text();
        data = { success: false, message: txt || "Invalid JSON from proxy" };
      }

      console.log(`Proxy response: HTTP ${res.status}, data: ${JSON.stringify(data)}`);

      if (res.ok && data.success === true) {
        console.log(`✅ DNS PROXY REQUEST ACCEPTED → ${domain}`);
        proxySuccess = true;
        break;
      } else {
        console.error("DNS proxy failed:", res.status, data.message || data);
        proxyAttempt++;
        await new Promise(r => setTimeout(r, 5000 * proxyAttempt));  // Backoff 5s, 10s, 15s
      }
    } catch (err) {
      console.error("DNS proxy attempt error:", err.message);
      proxyAttempt++;
      await new Promise(r => setTimeout(r, 5000 * proxyAttempt));
    }
  }

  if (!proxySuccess) {
    console.warn("Proxy failed all retries – falling back to direct Namecheap DNS set (if creds available)");

    const API_USER = process.env.NAMECHEAP_API_USER;
    const API_KEY = process.env.NAMECHEAP_API_KEY;
    const CLIENT_IP = process.env.NAMECHEAP_CLIENT_IP;

    if (!API_USER || !API_KEY || !CLIENT_IP) {
      throw new Error("Direct Namecheap fallback failed – creds missing");
    }

    const { sld, tld } = domain.split('.').reduce((acc, part, i, arr) => {
      if (i === 0) acc.sld = part;
      else acc.tld += (i > 1 ? '.' : '') + part;
      return acc;
    }, { sld: '', tld: '' });

    const setHostsUrl = `https://api.namecheap.com/xml.response?ApiUser=${API_USER}&ApiKey=${API_KEY}&UserName=${API_USER}&Command=namecheap.domains.dns.setHosts&ClientIp=${CLIENT_IP}&SLD=${encodeURIComponent(sld)}&TLD=${encodeURIComponent(tld)}&HostName1=@&RecordType1=A&Address1=185.199.108.153&TTL1=Automatic&HostName2=@&RecordType2=A&Address2=185.199.109.153&TTL2=Automatic&HostName3=@&RecordType3=A&Address3=185.199.110.153&TTL3=Automatic&HostName4=@&RecordType4=A&Address4=185.199.111.153&TTL4=Automatic&HostName5=www&RecordType5=CNAME&Address5=${githubPagesTarget}&TTL5=Automatic`;

    const setRes = await fetch(setHostsUrl);
    const setText = await setRes.text();
    const setJson = parser.parse(setText);

    if (setJson.ApiResponse['@Status'] !== 'OK') {
      throw new Error(`Direct Namecheap DNS set failed: ${JSON.stringify(setJson.ApiResponse.Errors)}`);
    }

    console.log(`✅ Direct Namecheap DNS set succeeded for ${domain}`);
  }

  // ... (rest of the function for polling propagation remains the same)
}