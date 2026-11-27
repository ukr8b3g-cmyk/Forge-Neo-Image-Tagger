/* Folder tagging, scoped to the directories granted by the browser. */
(() => {
  "use strict";
  const imageExtension = /\.(?:png|jpe?g|webp)$/i;
  const readAccess = {mode: "read"};
  const writeAccess = {mode: "readwrite"};
  const terminal = new Set(["done", "failed", "cancelled"]);
  const imageErrors = new Set(["bad_image", "image_size", "animated_image", "transparent_image", "analysis_failed"]);
  const issueLimit = 50;
  const batchHelp = {
    en: {
      section: "Analyze a folder of images and save a text file for each result.",
      choose: "Choose the folder that contains the images to analyze.",
      destination: "Choose a separate folder for saving text files.",
      reset: "Save the text files in the image folder.",
      format: "Choose the content of each text file.",
      rules: "Set shared tags and the overwrite preference for this batch.",
      prefix: "Add these comma-separated tags at the beginning of each tag output.",
      exclude: "Enter comma-separated tags to exclude from each output.",
      replace: "Replace existing text files after confirming the overwrite count.",
      start: "Analyze the eligible images and write their text files.",
      stop: "Stop processing the folder.",
      preview: "Preview the output for up to three eligible images before saving.",
      review: "Review and edit saved text beside its matching image.",
      issues: "See the reasons for skipped images and processing failures.",
      "dialog-close": "Close the results dialog.",
      "dialog-filter": "Filter by part of a filename or by an exact tag.",
      "dialog-files": "Choose an image and its matching text to display.",
      "dialog-text": "Review this image's text. In saved results, you can also edit it.",
      "dialog-save": "Save the edited text for the selected image.",
    },
    ja: {
      section: "フォルダー内の画像を解析し、結果を画像ごとのテキストファイルに保存します。",
      choose: "解析したい画像が入っているフォルダーを選びます。",
      destination: "テキストファイルを保存する別のフォルダーを選びます。",
      reset: "画像と同じフォルダーにテキストファイルを保存します。",
      format: "テキストファイルに保存する出力内容を選びます。",
      rules: "この一括処理で共通のタグや上書き方法を設定します。",
      prefix: "カンマで区切って入力したタグを、各画像のタグの先頭に加えます。",
      exclude: "各画像の出力から除外するタグをカンマで区切って入力します。",
      replace: "上書き件数を確認してから、既存のテキストファイルを置き換えます。",
      start: "対象の画像を解析し、結果をテキストファイルに書き出します。",
      stop: "フォルダーの一括処理を停止します。",
      preview: "保存前に、対象画像のうち最大3枚の出力を確認します。",
      review: "画像を見ながら、保存したテキストを確認・編集します。",
      issues: "画像のスキップや処理の失敗の理由を確認できます。",
      "dialog-close": "結果の画面を閉じます。",
      "dialog-filter": "ファイル名の一部やタグの完全一致で絞り込みます。",
      "dialog-files": "表示する画像と対応するテキストを選びます。",
      "dialog-text": "この画像の出力を確認できます。保存済みの結果はここで編集できます。",
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
    const preview = byId("preview"), review = byId("review");
    const chooseDestination = byId("destination"), resetDestination = byId("reset");
    const folderName = byId("folder"), status = byId("status");
    const saveFolderName = byId("save-folder"), format = byId("format");
    const prefix = byId("prefix"), exclude = byId("exclude"), replace = byId("replace");
    const rules = () => compileRules(prefix.value, exclude.value);
    const openReview = window.forgeHybridTaggerReview(panel, {msg, splitPrompt, tagKey, writeText});
    const issues = byId("issues"), issueList = byId("issue-list");
    const summaries = {
      section: panel.querySelector(".batch-strip > summary"),
      rules: panel.querySelector(".batch-rules > summary"),
      issues: issues.querySelector(":scope > summary"),
    };
    const supported = typeof window.showDirectoryPicker === "function";
    let folder = null, destination = null, choosing = false, active = null, result = null;
    let issueResult = null, issueCount = 0, issueLanguage = "";
    let helpLanguage;

    function render() {
      const language = locale?.() === "ja" ? "ja" : "en";
      if (helpLanguage !== language) {
        for (const [name, hint] of Object.entries(batchHelp[language])) (summaries[name] || byId(name)).title = hint;
        helpLanguage = language;
      }
      const selection = folder?.name || "";
      folderName.textContent = folderName.title = selection;
      folderName.hidden = !selection;
      saveFolderName.textContent = saveFolderName.title = destination?.name || msg("batchSameFolder");
      choose.disabled = chooseDestination.disabled = !supported || choosing || Boolean(active);
      resetDestination.hidden = !destination;
      resetDestination.disabled = choosing || Boolean(active);
      start.disabled = !folder || choosing || Boolean(active);
      preview.disabled = review.disabled = start.disabled;
      format.disabled = prefix.disabled = exclude.disabled = replace.disabled = !supported || Boolean(active);
      start.hidden = Boolean(active);
      stop.hidden = !active;
      stop.disabled = Boolean(active?.stopped);
      byId("settings").textContent = settingsLabel(active?.settings || settings());

      const selectedRules = active?.settings.rules || rules();
      byId("rule-summary").textContent = [
        selectedRules.first.size && msg("batchAdded").replace("{n}", selectedRules.first.size),
        selectedRules.excluded.size && msg("batchExcluded").replace("{n}", selectedRules.excluded.size),
        replace.checked && msg("batchReplacing")
      ].filter(Boolean).join(" · ");
      byId("hint").textContent = msg(replace.checked ? "batchReplaceHint" : "batchHint");

      const state = active || result;
      const parts = [];
      if (!supported) {
        parts.push(msg("batchUnsupported"));
      } else if (state) {
        parts.push(msg(state.phase));
        if (active?.file) parts.push(active.index + "/" + active.progressTotal + " · " + active.file);
        if (state.total) {
          parts.push([[state.purpose === "preview" ? "batchPreviewed" : "batchSaved", "saved"],
            ["batchSkipped", "skipped"], ["batchFailed", "failed"]]
            .map(([key, count]) => msg(key).replace("{n}", state[count])).join(" · "));
        }
        if (state.reused) parts.push(msg("batchReused").replace("{n}", state.reused));
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
      for (const item of state?.issues || []) addIssueLine(item.file + " — " + msg(item.key));
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
            return makeText(current.results, run.models, run.settings);
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

    async function chooseFolder(saveFolder) {
      choosing = true;
      render();
      try {
        const selected = await window.showDirectoryPicker(saveFolder ? writeAccess : readAccess);
        if (saveFolder) destination = selected;
        else folder = selected;
        result = null;
      } catch (error) {
        if (error.name !== "AbortError") {
          result = {phase: saveFolder ? "batchDestinationError" : "batchFolderError", error: true};
        }
      } finally {
        choosing = false;
        render();
      }
    }

    function begin(purpose) {
      const run = {
        purpose, settings: {...settings(), rules: rules()}, replace: replace.checked,
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
        msg(error.message) !== error.message ? error.message : "batchFolderError";
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
      if (!run.stopped && rows) openReview(rows, target);
    }

    async function runFolder(tryOnly) {
      if (!folder || active) return;
      const target = destination || folder;
      const run = begin(tryOnly ? "preview" : "save");
      const samples = [];
      try {
        if (await target.requestPermission(tryOnly ? readAccess : writeAccess) !== "granted") {
          throw new Error(tryOnly ? "batchReadPermission" : "batchPermission");
        }
        const {files, existing, nameCounts} = await scan(target, run);
        run.total = files.length;
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
            if (!run.models) run.models = await readModels(run.settings);
            if (run.stopped) break;
            run.phase = "queued";
            render();
            const text = await analyzeFile(run, file);
            if (run.stopped) break;
            if (!text && run.settings.format === "description") {
              run.skipped += 1;
              addIssue(run, handle.name, "batchNoDescription");
              continue;
            }
            if (tryOnly) {
              samples.push({handle, imageFile: file, text});
              run.saved += 1;
              continue;
            }
            stage = "batchWriteError";
            run.phase = "batchWriting";
            render();
            const outcome = await writeText(target, caption?.name || textName, text ? text + "\n" : "", {run, before});
            if (outcome === "saved") run.saved += 1;
            else if (outcome === "exists") run.skipped += 1;
            else if (outcome === "changed") {
              run.skipped += 1;
              addIssue(run, handle.name, "batchCaptionChanged");
            }
          } catch (error) {
            if (run.stopped) break;
            run.failed += 1;
            const reason = stage === "batchAnalyzeError" && error.message !== msg(error.message) ?
              error.message : stage;
            addIssue(run, handle.name, reason);
            if (error.name === "NotAllowedError") throw new Error("batchPermission");
            if (stage === "batchAnalyzeError" && !imageErrors.has(reason)) throw new Error(reason);
          }
        }
        if (run.stopped) run.phase = "batchStopped";
        else if (!run.total) run.phase = "batchEmpty";
        else if (tryOnly) run.phase = work.length ? "batchPreviewDone" : "batchPreviewEmpty";
        else run.phase = "batchDone";
      } catch (error) {
        failedRun(run, error);
      } finally {
        finish(run);
      }
      if (!run.stopped && samples.length) openReview(samples);
    }

    choose.addEventListener("click", () => void chooseFolder(false));
    chooseDestination.addEventListener("click", () => void chooseFolder(true));
    resetDestination.addEventListener("click", () => {
      destination = null;
      result = null;
      render();
      chooseDestination.focus();
    });
    start.addEventListener("click", () => void runFolder(false));
    preview.addEventListener("click", () => void runFolder(true));
    review.addEventListener("click", () => void browseSaved());
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
