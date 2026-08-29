const express = require("express");
const path = require("path");
const { Readable } = require("stream");
const { pool, initSchema } = require("./db");
const navidrome = require("./navidrome");
const discogs = require("./discogs");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..")));

const SORT_COLUMNS = {
  added_at: "added_at",
  year: "data->>'year'",
  artist: "artist",
  title: "title",
};

function splitTitle(title) {
  const idx = title.indexOf(" - ");
  if (idx === -1) return { artist: null, album: null };
  return {
    artist: title.slice(0, idx).trim(),
    album: title.slice(idx + 3).trim(),
  };
}

app.get("/api/discogs/search", async (req, res) => {
  const params = new URLSearchParams(req.query);
  const result = await discogs.search(params);
  res.status(result.status).json(result.body);
});

app.get("/api/vinyls", async (req, res) => {
  const sortColumn = SORT_COLUMNS[req.query.sort] || SORT_COLUMNS.added_at;
  const order = req.query.order === "asc" ? "ASC" : "DESC";
  const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);

  const [{ rows }, { rows: countRows }] = await Promise.all([
    pool.query(
      `SELECT data FROM vinyls ORDER BY ${sortColumn} ${order} NULLS LAST LIMIT $1 OFFSET $2`,
      [limit, offset]
    ),
    pool.query("SELECT COUNT(*) FROM vinyls"),
  ]);

  res.json({ items: rows.map(row => row.data), total: Number(countRows[0].count) });
});

app.get("/api/vinyls/ids", async (req, res) => {
  const { rows } = await pool.query("SELECT discogs_id FROM vinyls");
  res.json(rows.map(row => Number(row.discogs_id)));
});

app.post("/api/vinyls", async (req, res) => {
  const record = req.body;
  if (!record || typeof record.id === "undefined" || !record.title) {
    return res.status(400).json({ error: "Neplatný záznam." });
  }

  const { artist, album } = splitTitle(record.title);
  const { rows } = await pool.query(
    `INSERT INTO vinyls (discogs_id, title, artist, album, data)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (discogs_id) DO NOTHING
     RETURNING data`,
    [record.id, record.title, artist, album, record]
  );

  if (rows.length === 0) {
    return res.json({ added: false, message: "Už ve sbírce." });
  }
  res.status(201).json({ added: true, record: rows[0].data });
});

app.delete("/api/vinyls/:discogsId", async (req, res) => {
  const discogsId = Number(req.params.discogsId);
  if (!Number.isFinite(discogsId)) {
    return res.status(400).json({ error: "Neplatné ID." });
  }

  const { rowCount } = await pool.query("DELETE FROM vinyls WHERE discogs_id = $1", [discogsId]);
  res.json({ removed: rowCount > 0 });
});

app.get("/api/vinyls/:discogsId/playback", async (req, res) => {
  if (!navidrome.isConfigured()) {
    return res.json({ available: false });
  }

  const discogsId = Number(req.params.discogsId);
  if (!Number.isFinite(discogsId)) {
    return res.status(400).json({ error: "Neplatné ID." });
  }

  const { rows } = await pool.query("SELECT title, artist, album FROM vinyls WHERE discogs_id = $1", [discogsId]);
  if (rows.length === 0) {
    return res.status(404).json({ error: "Nenalezeno." });
  }

  const { title, artist, album: albumName } = rows[0];
  const albums = await navidrome.searchAlbum(albumName || title);
  if (albums.length === 0) {
    return res.json({ available: false });
  }

  const album = artist
    ? albums.find(a => matchesArtist(a.artist, artist)) || albums[0]
    : albums[0];
  const tracks = await navidrome.getAlbumTracks(album.id);

  res.json({
    available: true,
    album: {
      id: album.id,
      name: album.name,
      artist: album.artist,
      coverArtUrl: album.coverArt ? `/api/navidrome/cover/${album.coverArt}` : null,
    },
    tracks: tracks.map(t => ({
      id: t.id,
      title: t.title,
      track: t.track,
      duration: t.duration,
      streamUrl: `/api/navidrome/stream/${t.id}`,
    })),
  });
});

function matchesArtist(a, b) {
  if (!a || !b) return false;
  const na = a.toLowerCase();
  const nb = b.toLowerCase();
  return na.includes(nb) || nb.includes(na);
}

app.get("/api/navidrome/stream/:songId", async (req, res) => {
  if (!navidrome.isConfigured()) {
    return res.status(404).end();
  }

  const upstream = await fetch(navidrome.streamUrl(req.params.songId));
  if (!upstream.ok || !upstream.body) {
    return res.status(502).end();
  }

  res.set("Content-Type", upstream.headers.get("content-type") || "audio/mpeg");
  Readable.fromWeb(upstream.body).pipe(res);
});

app.get("/api/navidrome/cover/:coverArtId", async (req, res) => {
  if (!navidrome.isConfigured()) {
    return res.status(404).end();
  }

  const upstream = await fetch(navidrome.coverArtUrl(req.params.coverArtId));
  if (!upstream.ok || !upstream.body) {
    return res.status(502).end();
  }

  res.set("Content-Type", upstream.headers.get("content-type") || "image/jpeg");
  Readable.fromWeb(upstream.body).pipe(res);
});

const port = process.env.PORT || 3000;
initSchema()
  .then(() => {
    app.listen(port, () => console.log(`Vinyl Depot listening on port ${port}`));
  })
  .catch(err => {
    console.error("Failed to initialize database schema:", err);
    process.exit(1);
  });
