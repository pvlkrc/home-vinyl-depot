async function searchDiscogs(params) {
  const res = await fetch(`/api/discogs/search?${params.toString()}`);

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Discogs dočasně odmítá požadavky (rate limit). Zkus to za chvíli.");
    }
    throw new Error(`Discogs vrátil chybu (${res.status}).`);
  }

  return res.json();
}

async function addToCollection(record) {
  const res = await fetch("/api/vinyls", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });
  return res.json();
}

async function fetchCollection(params) {
  const query = new URLSearchParams(params);
  const res = await fetch(`/api/vinyls?${query.toString()}`);
  if (!res.ok) throw new Error(`Nepodařilo se načíst sbírku (${res.status}).`);
  return res.json();
}

async function fetchCollectionIds() {
  const res = await fetch("/api/vinyls/ids");
  if (!res.ok) throw new Error(`Nepodařilo se načíst sbírku (${res.status}).`);
  return res.json();
}

async function removeFromCollection(discogsId) {
  const res = await fetch(`/api/vinyls/${discogsId}`, { method: "DELETE" });
  if (!res.ok) throw new Error(`Nepodařilo se odebrat záznam (${res.status}).`);
  return res.json();
}

async function fetchPlayback(discogsId) {
  const res = await fetch(`/api/vinyls/${discogsId}/playback`);
  if (!res.ok) throw new Error(`Nepodařilo se ověřit přehrávání (${res.status}).`);
  return res.json();
}
