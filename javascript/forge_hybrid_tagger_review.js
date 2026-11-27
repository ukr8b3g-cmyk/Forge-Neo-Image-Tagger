/* Inspect trial results or edit sidecars in the browser-granted save folder. */
(() => {
  "use strict";
  window.forgeHybridTaggerReview = function mountReview(panel, {msg, splitPrompt, tagKey, writeText}) {
    const byId = name => panel.querySelector("#fhit-batch-dialog" + (name ? "-" + name : ""));
    const dialog = byId(), close = byId("close"), filter = byId("filter"), files = byId("files");
    const editor = byId("text"), image = byId("image"), save = byId("save");
    const drafts = new Map();
    let entries = [], target = null, imageURL = null, current = null, writing = false;
    let selectionVersion = 0, filterVersion = 0;

    function notice(key = "", error = false) {
      byId("status").textContent = key ? msg(key) : "";
      byId("status").classList.toggle("failure", error);
    }

    function clearImage() {
      if (imageURL) URL.revokeObjectURL(imageURL);
      imageURL = null;
      image.removeAttribute("src");
      image.hidden = true;
    }

    function saveState() {
      save.disabled = writing || !current || !drafts.has(current.entry);
    }

    async function select(entry) {
      const version = ++selectionVersion;
      clearImage();
      current = null;
      editor.value = "";
      editor.disabled = true;
      byId("content").hidden = !entry;
      saveState();
      notice();
      if (!entry) {
        notice(entries.length ? "batchNoMatches" : "batchNoSaved");
        return;
      }

      const imageFile = entry.imageFile ? Promise.resolve(entry.imageFile) : entry.handle.getFile();
      void imageFile.then(file => {
        if (version !== selectionVersion || !dialog.open) return;
        imageURL = URL.createObjectURL(file);
        image.alt = entry.handle.name;
        image.src = imageURL;
        image.hidden = false;
      }).catch(() => {});

      if (!target) {
        editor.value = entry.text;
        editor.disabled = false;
        return;
      }

      notice("batchReading");
      try {
        let draft = drafts.get(entry);
        if (!draft) {
          const file = await entry.caption.getFile();
          const text = await file.text();
          draft = {before: {handle: entry.caption, file, text}, text};
        }
        if (version !== selectionVersion || !dialog.open) return;
        editor.value = draft.text;
        current = {entry, before: draft.before, original: draft.before.text.replace(/\r\n?/g, "\n")};
        editor.disabled = false;
        saveState();
        notice();
      } catch {
        if (version === selectionVersion && dialog.open) notice("batchReadError", true);
      }
    }

    function updateChoices(matches) {
      const selection = current && matches.includes(current.entry) ? current.entry : matches[0];
      const options = document.createDocumentFragment();
      for (const entry of matches) options.append(new Option(entry.handle.name, String(entry.index)));
      files.replaceChildren(options);
      files.disabled = !matches.length;
      files.value = selection ? String(selection.index) : "";
      byId("count").textContent = msg("batchReviewCount")
        .replace("{shown}", matches.length).replace("{total}", entries.length);
      if (!selection || selection !== current?.entry) void select(selection);
      else notice();
    }

    async function filterEntries() {
      const version = ++filterVersion;
      const query = filter.value.trim().toLowerCase();
      if (!query) {
        updateChoices(entries);
        return;
      }
      const key = tagKey(query);
      const matches = [];
      notice("batchFiltering");
      for (const entry of entries) {
        if (version !== filterVersion || !dialog.open) return;
        if (entry.handle.name.toLowerCase().includes(query)) {
          matches.push(entry);
          continue;
        }
        if (!entry.tags) {
          try {
            const text = await (await entry.caption.getFile()).text();
            entry.tags = new Set(splitPrompt(text.split(/\r?\n[ \t]*\r?\n/, 1)[0]).map(tagKey));
          } catch { continue; }
        }
        if (entry.tags.has(key)) matches.push(entry);
      }
      if (version === filterVersion && dialog.open) updateChoices(matches);
    }

    async function saveEdit() {
      if (writing || !current || !drafts.has(current.entry)) return;
      const {entry} = current;
      const draft = drafts.get(entry);
      writing = true;
      ++filterVersion;
      close.disabled = filter.disabled = files.disabled = editor.disabled = true;
      saveState();
      notice("batchWriting");
      try {
        if (await target.requestPermission({mode: "readwrite"}) !== "granted") {
          notice("batchPermission", true);
          return;
        }
        const outcome = await writeText(target, entry.caption.name, draft.text, {before: draft.before});
        if (outcome !== "saved") {
          notice("batchCaptionChanged", true);
          return;
        }
        drafts.delete(entry);
        delete entry.tags;
        await select(entry);
        notice("batchEditSaved");
      } catch {
        notice("batchWriteError", true);
      } finally {
        writing = false;
        close.disabled = filter.disabled = files.disabled = false;
        editor.disabled = !current;
        saveState();
      }
    }

    function mayClose() {
      return !writing && (!drafts.size || window.confirm(msg("batchDiscardEdits")));
    }

    close.addEventListener("click", () => { if (mayClose()) dialog.close(); });
    dialog.addEventListener("cancel", event => { if (!mayClose()) event.preventDefault(); });
    dialog.addEventListener("close", () => {
      ++selectionVersion;
      ++filterVersion;
      clearImage();
      drafts.clear();
      entries = [];
      target = current = null;
    });
    filter.addEventListener("input", () => void filterEntries());
    files.addEventListener("change", () => void select(entries[Number(files.value)]));
    editor.addEventListener("input", () => {
      if (!current) return;
      if (editor.value === current.original) drafts.delete(current.entry);
      else drafts.set(current.entry, {text: editor.value, before: current.before});
      saveState();
    });
    save.addEventListener("click", () => void saveEdit());

    return function openReview(rows, saveFolder = null) {
      entries = rows.map((row, index) => ({...row, index}));
      target = saveFolder;
      byId("title").textContent = msg(target ? "batchReview" : "batchPreviewTitle");
      filter.value = "";
      filter.hidden = !target || !entries.length;
      save.hidden = !target;
      editor.readOnly = !target;
      dialog.showModal();
      updateChoices(entries);
    };
  };
})();
