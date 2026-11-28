/* Folder tagging, scoped to the directories granted by the browser. */
(() => {
  "use strict";
  const imageExtension = /\.(?:png|jpe?g|webp)$/i;
  const readAccess = {mode: "read"};
  const writeAccess = {mode: "readwrite"};
  const terminal = new Set(["done", "failed", "cancelled"]);
  const imageErrors = new Set(["bad_image", "image_size", "animated_image", "transparent_image", "analysis_failed", "lm_no_output", "lm_levels"]);
  const issueLimit = 50;
  const batchHelp = {
    en: {
      choose: "Choose the folder that contains the images to analyze.",
      destination: "Choose a separate folder for saving text files.",
      reset: "Save the text files in the image folder.",
      format: "Choose the content of each text file.",
      prefix: "Add these comma-separated tags at the beginning of each tag output.",
      exclude: "Enter comma-separated tags to exclude from each output.",
      replace: "Replace existing text files after confirming the overwrite count.",
      start: "Analyze the eligible images and write their text files.",
      stop: "Stop processing the folder.",
      preview: "Analyze up to three images for an on-screen preview only.",
      "reopen-preview": "Open the last preview.",
      review: "Open and edit the .txt files in the selected save folder.",
      issues: "See the reasons for skipped images and processing failures.",
      "dialog-close": "Close the results dialog.",
      "dialog-filter": "Filter by part of a filename or by an exact tag.",
      "dialog-files": "Choose an image and its matching text to display.",
      "dialog-text": "Review this image's text. In saved results, you can also edit it.",
      "dialog-save-batch": "Analyze the folder and save the results as .txt files.",
      "dialog-save": "Save the edited text for the selected image.",
    },
    ja: {
      choose: "解析したい画像が入っているフォルダーを選びます。",
      destination: "テキストファイルを保存する別のフォルダーを選びます。",
      reset: "画像と同じフォルダーにテキストファイルを保存します。",
      format: "テキストファイルに保存する出力内容を選びます。",
      prefix: "カンマで区切って入力したタグを、各画像のタグの先頭に加えます。",
      exclude: "各画像の出力から除外するタグをカンマで区切って入力します。",
      replace: "上書き件数を確認してから、既存のテキストファイルを置き換えます。",
      start: "対象の画像を解析し、結果をテキストファイルに書き出します。",
      stop: "フォルダーの一括処理を停止します。",
      preview: "最大3枚を解析し、画面上で出力を確認します。",
      "reopen-preview": "直前のプレビューを開きます。",
      review: "保存先フォルダーの .txt ファイルを開いて編集できます。",
      issues: "画像のスキップや処理の失敗の理由を確認できます。",
      "dialog-close": "結果の画面を閉じます。",
      "dialog-filter": "ファイル名の一部やタグの完全一致で絞り込みます。",
      "dialog-files": "表示する画像と対応するテキストを選びます。",
      "dialog-text": "この画像の出力を確認できます。保存済みの結果はここで編集できます。",
      "dialog-save-batch": "フォルダー内の画像を一括解析し、結果を .txt に保存します。",
      "dialog-save": "選択中の画像のテキストに編集内容を保存します。",
    },
  };

  function addCaption(captions, handle) {
    if (!/\.txt$/i.test(handle.name)) return;
    const key = handle.name.toLowerCase();
    captions.set(key, captions.has(key) ? null : handle);
  }

  async function scanFolder(folder, run) {
    const files = [], captions = new Map(), nameCounts = new Map();
    for await (const handle of folder.values()) {
      if (run.stopped) break;
      addCaption(captions, handle);
      if (handle.kind !== "file" || !imageExtension.test(handle.name)) continue;
      const textName = handle.name.replace(imageExtension, ".txt");
      const key = textName.toLowerCase();
      nameCounts.set(key, (nameCounts.get(key) || 0) + 1);
      files.push({handle, textName, key});
    }
    files.sort((a, b) => a.handle.name.localeCompare(b.handle.name, undefined, {numeric: true}));
    return {files, captions, nameCounts};
  }

  async function savedCaptions(folder, run) {
    const captions = new Map();
    for await (const handle of folder.values()) {
      if (run.stopped) break;
      addCaption(captions, handle);
    }
    return captions;
  }

  async function captionHash(file) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()));
  }

  async function matchesFile(handle, before) {
    if (!handle || !await handle.isSameEntry(before.handle)) return false;
    const current = await handle.getFile();
    if (current.lastModified !== before.file.lastModified || current.size !== before.file.size) return false;
    if (before.hash) {
      const hash = await captionHash(current);
      return hash.every((byte, i) => byte === before.hash[i]);
    }
    return before.text === undefined || await current.text() === before.text;
  }

  function writeText(folder, name, text, {run, before} = {}) {
    // Serialise the version check and write across Image Tagger tabs.
    return navigator.locks.request("forge-hybrid-tagger-caption-write", async () => {
      if (run?.stopped) return "stopped";
      let handle;
      try {
        handle = await folder.getFileHandle(name);
      } catch (error) {
        if (error.name === "TypeMismatchError") return before ? "changed" : "exists";
        if (error.name !== "NotFoundError") throw error;
      }
      let created;
      if (before) {
        if (!await matchesFile(handle, before)) return "changed";
      } else {
        if (handle) return "exists";
        if (run?.stopped) return "stopped";
        handle = await folder.getFileHandle(name, {create: true});
        created = await handle.getFile();
        if (created.size) return "exists";
      }
      let writer;
      try {
        writer = await handle.createWritable({mode: "exclusive"});
        await writer.write(text);
        if (before && !await matchesFile(await folder.getFileHandle(name), before)) {
          await writer.abort();
          return "changed";
        }
        await writer.close();
      } catch (error) {
        if (writer) await writer.abort().catch(() => {});
        if (created && error.name !== "NoModificationAllowedError") {
          // Creation can leave a placeholder if the write fails. Remove only that entry.
          try {
            const current = await folder.getFileHandle(name);
            const file = await current.getFile();
            if (file.size === 0 && file.lastModified === created.lastModified && await current.isSameEntry(handle)) {
              await folder.removeEntry(name);
            }
          } catch {}
        }
        throw error;
      }
      return "saved";
    });
  }

  window.forgeHybridTaggerBatch = function mountBatch(panel, options) {
    const {msg, locale, compileRules, splitPrompt, tagKey, settings, settingsLabel, readModels, startAnalysis, analysisStatus, deleteJob,
      makeText, refreshAnalysisIndicators} = options;
    const byId = name => panel.querySelector("#fhit-batch-" + name);
    const choose = byId("choose"), start = byId("start"), stop = byId("stop");
    const singleView = byId("single-view"), batchView = byId("folder-view");
    const preview = byId("preview"), reopenPreview = byId("reopen-preview"), review = byId("review");
    const chooseDestination = byId("destination"), resetDestination = byId("reset");
    const folderName = byId("folder"), status = byId("status");
    const saveFolderName = byId("save-folder"), format = byId("format");
    const prefix = byId("prefix"), exclude = byId("exclude"), replace = byId("replace");
    const rules = () => compileRules(prefix.value, exclude.value);
    const openReview = window.forgeHybridTaggerReview(panel, {
      msg, splitPrompt, tagKey, writeText, savePreview: () => runFolder(false)
    });
    const issues = byId("issues"), issueList = byId("issue-list");
    const summaries = {
      issues: issues.querySelector(":scope > summary"),
    };
    const supported = typeof window.showDirectoryPicker === "function";
    const section = byId("workspace");
    const outputControls = byId("output-controls");
    const errorMessage = options.errorMessage || msg;
    const lmResults = new Map();
    let cacheScope = "", imageCount = null;
    let folder = null, destination = null, choosing = false, active = null, result = null, showFolder = false;
    let previewRows = [];
    let previewSettings;
    let issueResult = null, issueCount = 0, issueLanguage = "";
    let helpLanguage;

    function render() {
      const language = locale?.() === "ja" ? "ja" : "en";
      const current = settings();
      const isLM = current.mode === "lm";
      const shown = active?.settings || current;
      const textOnly = isLM && current.kind === "expand" && !active;
      if (textOnly && showFolder) {
        showFolder = false;
        if (section.contains(document.activeElement)) singleView.focus();
      }
      section.hidden = !showFolder;
      panel.classList.toggle("folder-active", showFolder);
      options.showBatchOutput?.(showFolder ? outputControls : null, isLM);
      outputControls.inert = Boolean(active);
      singleView.setAttribute("aria-pressed", String(!showFolder));
      batchView.setAttribute("aria-pressed", String(showFolder));
      batchView.disabled = textOnly;
      batchView.title = msg(textOnly ? "batchImageOnly" : "batchFolderViewHint");
      format.closest("label").hidden = isLM;
      prefix.closest("label").hidden = exclude.closest("label").hidden = isLM;
      if (helpLanguage !== language) {
        for (const [name, hint] of Object.entries(batchHelp[language])) (summaries[name] || byId(name)).title = hint;
        helpLanguage = language;
      }
      const fileCount = imageCount === null ? "" :
        msg(imageCount === 1 ? "batchOneImage" : "batchImageCount").replace("{n}", imageCount);
      folderName.textContent = folderName.title = folder ? [folder.name, fileCount].filter(Boolean).join(" · ") : msg("batchNoFolder");
      saveFolderName.textContent = saveFolderName.title =
        destination?.name || [msg("batchSameFolder"), folder?.name].filter(Boolean).join(" · ");
      choose.classList.toggle("primary", !folder);
      choose.classList.toggle("quiet", Boolean(folder));
      choose.disabled = chooseDestination.disabled = !supported || choosing || Boolean(active);
      resetDestination.hidden = !destination;
      resetDestination.disabled = choosing || Boolean(active);
      review.disabled = !folder || choosing || Boolean(active);
      reopenPreview.hidden = !previewRows.length;
      reopenPreview.disabled = review.disabled;
      start.disabled = preview.disabled = review.disabled || current.ready === false;
      format.disabled = prefix.disabled = exclude.disabled = replace.disabled = !supported || Boolean(active);
      start.hidden = Boolean(active);
      stop.hidden = !active;
      stop.disabled = Boolean(active?.stopped);
      byId("settings").textContent = settingsLabel(shown);
      options.batchActivity?.(active);

      byId("hint").textContent = msg(replace.checked ? "batchReplaceHint" : "batchHint");

      const state = active || result;
      const parts = [];
      if (!supported) {
        parts.push(msg("batchUnsupported"));
      } else if (state) {
        parts.push(errorMessage(state.phase));
        if (active?.file) parts.push(active.index + "/" + active.progressTotal + " · " + active.file);
        if (state.total) {
          parts.push([[state.purpose === "preview" ? "batchPreviewed" : "batchSaved", "saved"],
            ["batchSkipped", "skipped"], ["batchFailed", "failed"]]
            .map(([key, count]) => msg(key).replace("{n}", state[count])).join(" · "));
        }
        if (state.reused) parts.push(msg("batchReused").replace("{n}", state.reused));
      } else if (!folder) {
        parts.push(msg("batchSelectInput"));
      } else if (isLM && current.ready === false) {
        parts.push(msg(!current.model ? "batchSelectModel" :
          !current.sections.length ? "batchSelectTopics" : "batchLMUnavailable"));
      } else if (imageCount === 0) {
        parts.push(msg("batchEmpty"));
      }
      const notice = parts.join(" · ");
      if (status.textContent !== notice) status.textContent = notice;
      status.hidden = !notice;
      status.classList.toggle("failure", Boolean(state?.error));

      const count = state?.issueCount || 0;
      issues.hidden = count === 0;
      if (!count) issues.open = false;
      if (issueResult === state && issueCount === count && issueLanguage === panel.lang) return;
      issueResult = state;
      issueCount = count;
      issueLanguage = panel.lang;
      issueList.replaceChildren();
      for (const item of state?.issues || []) addIssueLine(item.file + " — " + errorMessage(item.key));
      if (count > issueLimit) addIssueLine(msg("batchMoreIssues").replace("{n}", count - issueLimit));
    }

    function addIssueLine(text) {
      const item = document.createElement("li");
      item.textContent = text;
      issueList.append(item);
    }

    function addIssue(run, file, key) {
      run.issueCount += 1;
      if (run.issues.length < issueLimit) run.issues.push({file, key});
    }

    function cancelJob(run) {
      if (run.jobId) {
        deleteJob(run.jobId);
        run.jobId = null;
      }
    }

    async function analyzeFile(run, file) {
      if (run.settings.mode === "lm") {
        const s = run.settings;
        if (file.size > 64 * 1024 * 1024) throw new Error("image_size");
        const hash = await captionHash(file);
        if (run.stopped) return;
        const key = Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
        const cached = lmResults.get(key);
        if (cached) {
          run.reused += 1;
          return settings => options.lmText(cached, settings);
        }
        const response = await options.lmGenerate(s.config, file, s.url);
        if (response.releaseError) run.releaseError = response.releaseError;
        if (options.lmText(response, s)) lmResults.set(key, response);
        return settings => options.lmText(response, settings);
      }
      const started = await startAnalysis(file, run.settings);
      run.jobId = started.id;
      if (!run.started) {
        run.started = true;
        refreshAnalysisIndicators();
      }
      try {
        while (!run.stopped) {
          const current = await analysisStatus(started.id);
          if (run.stopped) break;
          if (terminal.has(current.state)) {
            run.jobId = null;
            if (current.state !== "done") throw new Error(current.error || current.state);
            if (current.results.length && current.results.every(outcome => outcome.cached)) run.reused += 1;
            const models = run.models;
            return settings => makeText(current.results, models, settings);
          }
          if (run.phase !== current.state) {
            run.phase = current.state;
            render();
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } finally {
        cancelJob(run);
      }
    }

    function openPreview() {
      const current = settings();
      const layout = current.mode === previewSettings.mode ?
        {...previewSettings, level: current.level, formatted: current.formatted} : previewSettings;
      openReview(previewRows.map(({handle, imageFile, renderText}) => ({
        handle, imageFile, text: renderText(layout)
      })));
    }

    async function chooseFolder(saveFolder) {
      choosing = true;
      render();
      try {
        const selected = await window.showDirectoryPicker(saveFolder ? writeAccess : readAccess);
        if (saveFolder) destination = selected;
        else {
          let count = 0;
          for await (const handle of selected.values()) {
            if (handle.kind === "file" && imageExtension.test(handle.name)) count += 1;
          }
          if (folder !== selected && (!folder || !await selected.isSameEntry(folder))) lmResults.clear();
          folder = selected;
          imageCount = count;
        }
        result = null;
        previewRows = [];
      } catch (error) {
        if (error.name !== "AbortError") {
          result = {phase: saveFolder ? "batchDestinationError" : "batchFolderError", error: true};
        }
      } finally {
        choosing = false;
        render();
      }
    }

    function begin(purpose, selected = settings()) {
      const run = {
        purpose, settings: {...selected, rules: rules()}, replace: replace.checked,
        phase: "batchScanning", total: 0, progressTotal: 0, saved: 0, skipped: 0, failed: 0, reused: 0,
        issueCount: 0, issues: [], stopped: false
      };
      active = run;
      render();
      stop.focus();
      return run;
    }

    function finish(run) {
      const restoreFocus = document.activeElement === stop || document.activeElement === document.body;
      if (run.purpose !== "review" || run.error || run.stopped) result = run;
      active = null;
      render();
      if (restoreFocus) {
        const button = {preview, review, save: start}[run.purpose];
        button.focus();
      }
      if (run.started) refreshAnalysisIndicators();
    }

    async function scan(target, run) {
      const {files, captions, nameCounts} = await scanFolder(folder, run).catch(() => { throw new Error("batchFolderError"); });
      const sameFolder = target === folder || await target.isSameEntry(folder);
      const existing = sameFolder || !files.length ? captions :
        await savedCaptions(target, run).catch(() => { throw new Error("batchDestinationError"); });
      return {files, existing, nameCounts};
    }

    function failedRun(run, error) {
      run.phase = run.stopped ? "batchStopped" :
        errorMessage(error.message) !== error.message ? error.message : "batchFolderError";
      run.error = !run.stopped;
    }

    async function browseSaved() {
      if (!folder || active) return;
      const target = destination || folder;
      const run = begin("review");
      let rows;
      try {
        if (await target.requestPermission(readAccess) !== "granted") throw new Error("batchReadPermission");
        const {files, existing, nameCounts} = await scan(target, run);
        rows = files.filter(entry => nameCounts.get(entry.key) === 1 && existing.get(entry.key)?.kind === "file")
          .map(entry => ({...entry, caption: existing.get(entry.key)}));
      } catch (error) {
        failedRun(run, error);
      } finally {
        if (run.stopped) run.phase = "batchStopped";
        finish(run);
      }
      if (!run.stopped && rows && showFolder) openReview(rows, target);
    }

    async function runFolder(tryOnly) {
      if (!folder || active) return;
      const target = destination || folder;
      let selected;
      try {
        selected = settings(true);
      } catch (error) {
        result = {phase:error.message, error:true};
        render();
        return;
      }
      if (selected.ready === false) return;
      if (selected.mode === "lm") {
        const {memory, ...generation} = selected.config;
        const scope = JSON.stringify([selected.url, generation]);
        if (scope !== cacheScope) lmResults.clear();
        cacheScope = scope;
      }
      const run = begin(tryOnly ? "preview" : "save", selected);
      const samples = [];
      const written = [];
      try {
        if (await target.requestPermission(tryOnly ? readAccess : writeAccess) !== "granted") {
          throw new Error(tryOnly ? "batchReadPermission" : "batchPermission");
        }
        const {files, existing, nameCounts} = await scan(target, run);
        run.total = files.length;
        imageCount = files.length;
        const targets = [];
        for (const entry of files) {
          if (run.stopped) break;
          const caption = existing.get(entry.key);
          if (nameCounts.get(entry.key) > 1) {
            run.skipped += 1;
            addIssue(run, entry.handle.name, "batchCollision");
          } else if (existing.has(entry.key) && (!run.replace || caption?.kind !== "file")) {
            run.skipped += 1;
          } else {
            const targetEntry = {...entry, caption};
            // Snapshot each existing caption before confirming the overwrite list.
            if (!tryOnly && caption) {
              try {
                const file = await caption.getFile();
                targetEntry.before = {handle: caption, file, hash: await captionHash(file)};
              } catch (error) {
                if (error.name === "NotAllowedError") throw new Error("batchPermission");
                if (error.name === "NotFoundError") {
                  run.skipped += 1;
                  addIssue(run, entry.handle.name, "batchCaptionChanged");
                } else {
                  run.failed += 1;
                  addIssue(run, entry.handle.name, "batchReadError");
                }
                continue;
              }
            }
            targets.push(targetEntry);
          }
        }
        const work = tryOnly ? targets.slice(0, 3) : targets;
        run.progressTotal = work.length;
        const overwrites = !tryOnly && run.replace ? work.filter(entry => entry.caption).length : 0;
        if (!run.stopped && overwrites && !window.confirm(msg("batchConfirmReplace").replace("{n}", overwrites))) {
          run.stopped = true;
        }
        for (const [index, entry] of work.entries()) {
          if (run.releaseError) break;
          if (run.stopped) break;
          const {handle, textName, caption, before} = entry;
          run.index = index + 1;
          run.file = handle.name;
          run.phase = "batchReading";
          render();
          let stage = "batchReadError";
          try {
            const file = await handle.getFile();
            if (run.stopped) break;
            stage = "batchAnalyzeError";
            if (run.settings.mode !== "lm" && !run.models) run.models = await readModels(run.settings);
            if (run.stopped) break;
            run.phase = tryOnly ? "batchPreviewing" : run.settings.mode === "lm" ? "analyzing" : "queued";
            render();
            const renderText = await analyzeFile(run, file);
            if (run.stopped) break;
            const text = renderText(run.settings);
            if (!text && (run.settings.mode === "lm" || run.settings.format === "description")) {
              run.skipped += 1;
              addIssue(run, handle.name, run.settings.mode === "lm" ? "batchNoPrompt" : "batchNoDescription");
              continue;
            }
            if (tryOnly) {
              samples.push({handle, imageFile: file, renderText});
              run.saved += 1;
              continue;
            }
            stage = "batchWriteError";
            run.phase = "batchWriting";
            render();
            const outputName = caption?.name || textName;
            const outcome = await writeText(target, outputName, text ? text + "\n" : "", {run, before});
            if (outcome === "saved") {
              run.saved += 1;
              written.push({handle, outputName});
            }
            else if (outcome === "exists") run.skipped += 1;
            else if (outcome === "changed") {
              run.skipped += 1;
              addIssue(run, handle.name, "batchCaptionChanged");
            }
          } catch (error) {
            if (run.stopped) break;
            run.failed += 1;
            const reason = stage === "batchAnalyzeError" && error.message !== errorMessage(error.message) ?
              error.message : stage;
            addIssue(run, handle.name, reason);
            if (error.name === "NotAllowedError") throw new Error("batchPermission");
            if (stage === "batchAnalyzeError" && !imageErrors.has(reason)) throw new Error(reason);
          }
        }
        if (run.releaseError) throw new Error(run.releaseError);
        if (run.stopped) run.phase = "batchStopped";
        else if (!run.total) run.phase = "batchEmpty";
        else if (tryOnly) run.phase = samples.length ? "batchPreviewDone" : "batchPreviewEmpty";
        else run.phase = "batchDone";
      } catch (error) {
        failedRun(run, error);
      } finally {
        if (tryOnly && !run.stopped) {
          previewRows = samples;
          previewSettings = run.settings;
        }
        finish(run);
      }
      if (run.stopped || run.error || !showFolder || !section.getClientRects().length) return;
      if (samples.length) {
        openPreview();
      } else if (written.length) {
        const rows = await Promise.allSettled(written.map(async ({handle, outputName}) => ({
          handle, caption: await target.getFileHandle(outputName)
        })));
        if (!active && result === run && showFolder && section.getClientRects().length) {
          const saved = rows.filter(row => row.status === "fulfilled").map(row => row.value);
          if (saved.length) openReview(saved, target);
        }
      }
    }

    singleView.addEventListener("click", () => { showFolder = false; render(); });
    batchView.addEventListener("click", () => { showFolder = true; render(); });
    choose.addEventListener("click", () => void chooseFolder(false));
    chooseDestination.addEventListener("click", () => void chooseFolder(true));
    resetDestination.addEventListener("click", () => {
      destination = null;
      result = null;
      previewRows = [];
      render();
      chooseDestination.focus();
    });
    start.addEventListener("click", () => void runFolder(false));
    preview.addEventListener("click", () => void runFolder(true));
    review.addEventListener("click", () => void browseSaved());
    reopenPreview.addEventListener("click", openPreview);
    prefix.addEventListener("input", render);
    exclude.addEventListener("input", render);
    replace.addEventListener("change", render);
    stop.addEventListener("click", () => {
      if (!active) return;
      active.stopped = true;
      active.phase = "batchStopping";
      cancelJob(active);
      render();
    });
    return render;
  };
})();
