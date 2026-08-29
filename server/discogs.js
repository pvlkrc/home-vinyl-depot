const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN;

async function search(params) {
  const url = new URL("https://api.discogs.com/database/search");
  for (const [key, value] of params.entries()) {
    url.searchParams.set(key, value);
  }

  const headers = { "User-Agent": "VinylDepot/1.0" };
  if (DISCOGS_TOKEN) {
    headers.Authorization = `Discogs token=${DISCOGS_TOKEN}`;
  }

  const res = await fetch(url, { headers });
  const body = await res.json();
  return { ok: res.ok, status: res.status, body };
}

module.exports = { search };
