function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, ch => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

function formatCategory(formats) {
  const joined = (formats || []).join(" ").toLowerCase();
  if (joined.includes("cassette")) return "cassette";
  if (joined.includes("cd")) return "cd";
  if (joined.includes("vinyl")) return "vinyl";
  return "other";
}

function thumbHtml(url, category, sizeClass) {
  const img = url
    ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : "";
  return `<span class="thumb-slot ${sizeClass || ""} format-${category}">${img}</span>`;
}

function resultsListHtml(results) {
  return results.map((r, i) => {
    const format = (r.format || []).slice(0, 3).join(", ");
    const label = (r.label && r.label[0]) || "";
    return `<button type="button" class="result-item" data-index="${i}">
      ${thumbHtml(r.thumb, formatCategory(r.format))}
      <span class="result-text">
        <span class="result-title">${escapeHtml(r.title || "Bez názvu")}</span>
        <span class="result-meta">${escapeHtml([r.year, r.country, format, label].filter(Boolean).join(" · "))}</span>
      </span>
      <span class="result-chevron" aria-hidden="true">&rsaquo;</span>
    </button>`;
  }).join("");
}

function detailHtml(r, { inCollection = false } = {}) {
  const f = (r.formats && r.formats[0]) || {};
  const formatText = [f.text, ...(f.descriptions || [])].filter(Boolean).join(", ") || (r.format || []).join(", ");
  const labels = [...new Set(r.label || [])].join(" / ");
  const styles = (r.style || []).map(s => `<span class="pill">${escapeHtml(s)}</span>`).join("");
  const barcodes = (r.barcode || []).map(b => `<div class="code-line">${escapeHtml(b)}</div>`).join("") || "<div class=\"code-line\">—</div>";
  const masterUrl = r.master_id ? `https://www.discogs.com/master/${r.master_id}` : null;
  const want = (r.community && r.community.want) || 0;
  const have = (r.community && r.community.have) || 0;
  const saveBtnHtml = inCollection
    ? `<button type="button" class="save-btn remove-btn" id="save-btn" data-action="remove">Odebrat ze sbírky</button>`
    : `<button type="button" class="save-btn" id="save-btn" data-action="add">Přidat do sbírky</button>`;

  return `
    <button type="button" class="back-btn" id="back-btn">&larr; zpět na výsledky</button>
    <div class="card">
      <div class="detail-header">
        ${thumbHtml(r.cover_image || r.thumb, formatCategory(r.format), "thumb-slot--large")}
        <div class="detail-heading">
          <h2>${escapeHtml(r.title || "Bez názvu")}</h2>
          <p class="subline"><strong>${escapeHtml(r.catno || "—")}</strong> &middot; ${escapeHtml(r.year || "?")} &middot; ${escapeHtml(r.country || "?")}</p>
        </div>
        <div class="detail-actions">
          ${saveBtnHtml}
        </div>
      </div>
      <p class="save-status" id="save-status"></p>

      <dl class="facts">
        <div class="fact"><dt>Format</dt><dd>${escapeHtml(formatText || "—")}</dd></div>
        <div class="fact"><dt>Label</dt><dd>${escapeHtml(labels || "—")}</dd></div>
        <div class="fact"><dt>Genre</dt><dd>${escapeHtml((r.genre || []).join(", ") || "—")}</dd></div>
        <div class="fact"><dt>Master</dt><dd>${masterUrl ? `<a href="${masterUrl}" target="_blank" rel="noopener">#${r.master_id}</a>` : "—"}</dd></div>
      </dl>

      ${styles ? `<dl class="tag-group"><dt>Style</dt><dd>${styles}</dd></dl>` : ""}

      <dl class="codes">
        <dt>Barcode &amp; matrix</dt>
        <dd>${barcodes}</dd>
      </dl>

      <div class="stats">
        <div class="stat"><b>${want.toLocaleString()}</b><span>Want</span></div>
        <div class="stat"><b>${have.toLocaleString()}</b><span>Have</span></div>
        <div class="stat"><b>${r.id ?? "—"}</b><span>Release ID</span></div>
      </div>

      <div class="playback" id="playback"></div>
    </div>
  `;
}

function formatDuration(seconds) {
  if (typeof seconds !== "number") return "";
  const m = Math.floor(seconds / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

function playbackHtml(data) {
  const tracks = data.tracks.map((t, i) => `
    <button type="button" class="track-item" data-index="${i}" data-src="${escapeHtml(t.streamUrl)}">
      <span class="track-num">${t.track ?? i + 1}</span>
      <span class="track-title">${escapeHtml(t.title || "Bez názvu")}</span>
      <span class="track-duration">${formatDuration(t.duration)}</span>
    </button>
  `).join("");

  const cover = data.album.coverArtUrl
    ? `<img class="playback-cover" src="${escapeHtml(data.album.coverArtUrl)}" alt="" loading="lazy" onerror="this.remove()">`
    : "";

  return `
    <div class="playback-heading-row">
      ${cover}
      <p class="playback-heading">Přehrát &middot; ${escapeHtml(data.album.name || "")}</p>
    </div>
    <audio id="player" controls></audio>
    <div class="track-list">${tracks}</div>
  `;
}
