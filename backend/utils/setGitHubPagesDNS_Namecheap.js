import fetch from "node-fetch";

/**
 * Set Namecheap DNS records for GitHub Pages
 * - Apex (@): A records → GitHub Pages IPs
 * - www: CNAME → username.github.io
 *
 * REQUIRES:
 * NAMECHEAP_API_KEY
 * NAMECHEAP_USERNAME
 * NAMECHEAP_CLIENT_IP
 */

export async function setGitHubPagesDNS_Namecheap(domain) {
  if (!domain) throw new Error("Domain is required");

const {
  NAMECHEAP_API_KEY,
  NAMECHEAP_API_USER,
  NAMECHEAP_CLIENT_IP,
  GITHUB_USERNAME
} = process.env;

const NAMECHEAP_USERNAME = NAMECHEAP_API_USER;


  if (!NAMECHEAP_API_KEY || !NAMECHEAP_USERNAME || !NAMECHEAP_CLIENT_IP) {
    throw new Error("Missing Namecheap API credentials");
  }

  if (!GITHUB_USERNAME) {
    throw new Error("GITHUB_USERNAME not set");
  }

  const githubIPs = [
    "185.199.108.153",
    "185.199.109.153",
    "185.199.110.153",
    "185.199.111.153"
  ];

  const params = new URLSearchParams({
    ApiUser: NAMECHEAP_USERNAME,
    ApiKey: NAMECHEAP_API_KEY,
    UserName: NAMECHEAP_USERNAME,
    ClientIp: NAMECHEAP_CLIENT_IP,
    Command: "namecheap.domains.dns.setHosts",
    SLD: domain.split(".")[0],
    TLD: domain.split(".").slice(1).join("."),
  });

  let hostIndex = 1;

  // A records for apex
  for (const ip of githubIPs) {
    params.append(`HostName${hostIndex}`, "@");
    params.append(`RecordType${hostIndex}`, "A");
    params.append(`Address${hostIndex}`, ip);
    params.append(`TTL${hostIndex}`, "600");
    hostIndex++;
  }

  // www CNAME
  params.append(`HostName${hostIndex}`, "www");
  params.append(`RecordType${hostIndex}`, "CNAME");
  params.append(`Address${hostIndex}`, `${GITHUB_USERNAME}.github.io`);
  params.append(`TTL${hostIndex}`, "600");

  const url = `https://api.namecheap.com/xml.response?${params.toString()}`;

  const res = await fetch(url);
  const text = await res.text();

  if (!text.includes("<IsSuccess>true</IsSuccess>")) {
    throw new Error(`Namecheap DNS update failed:\n${text}`);
  }

  console.log(`✅ Namecheap DNS set for ${domain} → GitHub Pages`);
}
