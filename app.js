const state = {
  view: "collection",
  results: [],
  savedIds: new Set(),
  sort: "added_at",
  order: "desc",
  limit: 25,
  offset: 0,
  total: 0,
};

const viewButtons = document.querySelectorAll(".view-btn");
const form = document.getElementById("search-form");
const searchCard = document.querySelector(".search-panel");
const collectionToolbar = document.getElementById("collection-toolbar");
const sortSelect = document.getElementById("sort-select");
const sortOrderBtn = document.getElementById("sort-order-btn");
const loadMoreBtn = document.getElementById("load-more-btn");
const statusEl = document.getElementById("status");
const resultsEl = document.getElementById("results");
const detailEl = document.getElementById("detail");
const searchBtn = form.querySelector(".search-btn");

async function refreshSavedIds() {
  try {
    state.savedIds = new Set(await fetchCollectionIds());
  } catch (err) {
    // Best-effort — leave savedIds as whatever it already was.
  }
}

function updateLoadMoreVisibility() {
  loadMoreBtn.hidden = !(state.view === "collection" && state.results.length < state.total);
}

async function switchView(view) {
  state.view = view;
  viewButtons.forEach(b => {
    const active = b.dataset.view === view;
    b.classList.toggle("active", active);
    b.setAttribute("aria-pressed", active ? "true" : "false");
  });

  detailEl.hidden = true;
  detailEl.innerHTML = "";
  resultsEl.hidden = true;
  resultsEl.innerHTML = "";
  state.results = [];
  loadMoreBtn.hidden = true;

  if (view === "collection") {
    searchCard.hidden = true;
    collectionToolbar.hidden = false;
    await loadCollectionPage({ reset: true });
  } else {
    searchCard.hidden = false;
    collectionToolbar.hidden = true;
    setStatus("");
  }
}

async function loadCollectionPage({ reset }) {
  if (reset) {
    state.offset = 0;
    state.results = [];
  }

  setStatus("Načítám sbírku…");
  try {
    const { items, total } = await fetchCollection({
      sort: state.sort,
      order: state.order,
      limit: state.limit,
      offset: state.offset,
    });
    state.results = reset ? items : state.results.concat(items);
    state.total = total;
    state.offset = state.results.length;
    setStatus(state.results.length ? `Ve sbírce: ${state.total}.` : "Sbírka je zatím prázdná.");
    showResultsList(state.results);
    updateLoadMoreVisibility();
  } catch (err) {
    setStatus(err.message || "Něco se pokazilo.", true);
  }
}

viewButtons.forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

sortSelect.addEventListener("change", () => {
  state.sort = sortSelect.value;
  loadCollectionPage({ reset: true });
});

sortOrderBtn.addEventListener("click", () => {
  state.order = state.order === "asc" ? "desc" : "asc";
  sortOrderBtn.dataset.order = state.order;
  sortOrderBtn.textContent = state.order === "asc" ? "↑" : "↓";
  loadCollectionPage({ reset: true });
});

loadMoreBtn.addEventListener("click", () => loadCollectionPage({ reset: false }));

refreshSavedIds();
switchView(state.view);

function setStatus(text, isError) {
  statusEl.hidden = !text;
  statusEl.textContent = text || "";
  statusEl.classList.toggle("error", Boolean(isError));
}

function showResultsList(results) {
  detailEl.hidden = true;
  detailEl.innerHTML = "";
  resultsEl.hidden = results.length === 0;
  resultsEl.innerHTML = resultsListHtml(results);

  resultsEl.querySelectorAll(".result-item").forEach(btn => {
    btn.addEventListener("click", () => showDetail(state.results[Number(btn.dataset.index)]));
  });
}

function showDetail(r) {
  resultsEl.hidden = true;
  detailEl.hidden = false;
  detailEl.innerHTML = detailHtml(r, { inCollection: state.savedIds.has(r.id) });

  document.getElementById("back-btn").addEventListener("click", () => {
    showResultsList(state.results);
    updateLoadMoreVisibility();
    if (state.view === "collection") {
      setStatus(state.results.length ? `Ve sbírce: ${state.total}.` : "Sbírka je zatím prázdná.");
    }
  });

  const saveBtn = document.getElementById("save-btn");
  const saveStatus = document.getElementById("save-status");
  saveBtn.addEventListener("click", async () => {
    saveBtn.disabled = true;
    const action = saveBtn.dataset.action;
    saveStatus.textContent = action === "remove" ? "Odebírám…" : "Ukládám…";

    try {
      if (action === "remove") {
        await removeFromCollection(r.id);
        state.savedIds.delete(r.id);
        if (state.view === "collection") {
          state.results = state.results.filter(rec => rec.id !== r.id);
          state.total = Math.max(0, state.total - 1);
          state.offset = state.results.length;
        }
        saveStatus.textContent = "Odebráno ze sbírky.";
        saveBtn.textContent = "Přidat do sbírky";
        saveBtn.dataset.action = "add";
        saveBtn.classList.remove("remove-btn");
      } else {
        const result = await addToCollection(r);
        const added = result.added !== false;
        // Either outcome means the record is now confirmed to be in the collection.
        state.savedIds.add(r.id);
        saveStatus.textContent = added ? "Přidáno do sbírky." : (result.message || "Už ve sbírce.");
        saveBtn.textContent = "Odebrat ze sbírky";
        saveBtn.dataset.action = "remove";
        saveBtn.classList.add("remove-btn");
      }
    } catch (err) {
      saveStatus.textContent = err.message || "Něco se pokazilo.";
    } finally {
      saveBtn.disabled = false;
    }
  });

  loadPlayback(r);
}

async function loadPlayback(r) {
  const playbackEl = document.getElementById("playback");
  if (!playbackEl) return;

  try {
    const data = await fetchPlayback(r.id);
    if (!data.available) return;

    playbackEl.innerHTML = playbackHtml(data);
    const audio = playbackEl.querySelector("#player");
    playbackEl.querySelectorAll(".track-item").forEach(btn => {
      btn.addEventListener("click", () => {
        audio.src = btn.dataset.src;
        audio.play();
        playbackEl.querySelectorAll(".track-item").forEach(b => b.classList.remove("playing"));
        btn.classList.add("playing");
      });
    });
  } catch (err) {
    // Playback is an optional enhancement — a failed lookup just means no player shows up.
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const barcode = document.getElementById("barcode-input").value.trim();
  const artist = document.getElementById("artist-input").value.trim();
  const album = document.getElementById("album-input").value.trim();

  if (!barcode && !artist && !album) {
    setStatus("Zadej aspoň jedno pole.", true);
    return;
  }

  const params = new URLSearchParams({ type: "release" });
  if (barcode) params.set("barcode", barcode);
  if (artist) params.set("artist", artist);
  if (album) params.set("release_title", album);

  searchBtn.disabled = true;
  setStatus("Hledám…");
  resultsEl.hidden = true;
  detailEl.hidden = true;

  try {
    const data = await searchDiscogs(params);
    state.results = data.results || [];

    if (state.results.length === 0) {
      setStatus("Nic nenalezeno.");
      showResultsList([]);
    } else {
      setStatus(`Nalezeno ${data.pagination?.items ?? state.results.length} výsledků (zobrazeno ${state.results.length}).`);
      showResultsList(state.results);
    }
  } catch (err) {
    setStatus(err.message || "Něco se pokazilo.", true);
  } finally {
    searchBtn.disabled = false;
  }
});
