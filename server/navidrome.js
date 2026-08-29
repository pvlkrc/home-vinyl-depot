const crypto = require("crypto");

const NAVIDROME_URL = process.env.NAVIDROME_URL;
const NAVIDROME_USER = process.env.NAVIDROME_USER;
const NAVIDROME_PASSWORD = process.env.NAVIDROME_PASSWORD;

function isConfigured() {
  return Boolean(NAVIDROME_URL && NAVIDROME_USER && NAVIDROME_PASSWORD);
}

function authParams() {
  const salt = crypto.randomBytes(6).toString("hex");
  const token = crypto.createHash("md5").update(NAVIDROME_PASSWORD + salt).digest("hex");
  return new URLSearchParams({
    u: NAVIDROME_USER,
    t: token,
    s: salt,
    v: "1.16.1",
    c: "vinyl-depot",
    f: "json",
  });
}

async function searchAlbum(query) {
  const params = authParams();
  params.set("query", query);
  params.set("albumCount", "5");
  params.set("artistCount", "0");
  params.set("songCount", "0");

  const res = await fetch(`${NAVIDROME_URL}/rest/search3?${params}`);
  const data = await res.json();
  return data["subsonic-response"]?.searchResult3?.album || [];
}

async function getAlbumTracks(albumId) {
  const params = authParams();
  params.set("id", albumId);

  const res = await fetch(`${NAVIDROME_URL}/rest/getAlbum?${params}`);
  const data = await res.json();
  return data["subsonic-response"]?.album?.song || [];
}

function streamUrl(songId) {
  const params = authParams();
  params.set("id", songId);
  return `${NAVIDROME_URL}/rest/stream?${params}`;
}

function coverArtUrl(coverArtId) {
  const params = authParams();
  params.set("id", coverArtId);
  return `${NAVIDROME_URL}/rest/getCoverArt?${params}`;
}

module.exports = { isConfigured, searchAlbum, getAlbumTracks, streamUrl, coverArtUrl };
