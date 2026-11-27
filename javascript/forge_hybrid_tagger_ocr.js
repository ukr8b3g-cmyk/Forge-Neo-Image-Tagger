/* Review speech readings separately from tag inference. Boxes use the original image pixels. */
(() => {
  "use strict";
  const modelLabels = {"manga-ocr": "ocrManga", "bubble-detector": "ocrDetector"};
  const modelName = (msg, id) => modelLabels[id] ? msg(modelLabels[id]) : id === "magi-v2" ? "MAGI v2" : id;
  const ending = new Set(["done", "failed", "cancelled"]);
  const ocrHelp = {
    en: {
      section: "Read, edit, and export text from the reference image.",
      controls: {
        auto: "Find dialogue and other text in the reference image.",
        crop: "Drag over the part of the image you want to read.",
        manual: "Add a line of text by hand.",
        speakers: "Suggest a speaker for each dialogue line with a position.",
        stop: "Cancel the current text or speaker analysis.",
        "adopt-all": "Include every line that has text in the output.",
        layout: "Open the MOSS JSON export for the selected text.",
        "layout-close": "Return to the text and dialogue list.",
        "layout-width": "Set the width of the MOSS canvas in pixels.",
        "layout-height": "Set the height of the MOSS canvas in pixels.",
        "layout-preview": "Review the generated MOSS layout JSON.",
        "layout-copy": "Copy the MOSS layout JSON to the clipboard.",
        "layout-save": "Download the MOSS layout as a JSON file.",
      },
      row: {
        inspect: "Show this text's position on the reference image.",
        edit: "Correct the text, then select Use again.",
        adopt: "Include this text in the description and MOSS JSON.",
        speaker: "Confirm a speaker, or select or draw one on the image.",
        up: "Move this text one step earlier in the output.",
        down: "Move this text one step later in the output.",
        remove: "Remove this reading from the list and output.",
        position: "Drag on the reference image to set the text area for output.",
      },
    },
    ja: {
      section: "参照画像の文字を読み取り、修正して出力できます。",
      controls: {
        auto: "参照画像のセリフや枠外の文字を読み取ります。",
        crop: "参照画像上をドラッグし、読み取りたい範囲を囲みます。",
        manual: "文字を手入力する行を追加します。",
        speakers: "位置が指定されているセリフの話者を推定します。",
        stop: "実行中の文字読み取りや話者推定を取り消します。",
        "adopt-all": "本文がある行をすべて出力に使います。",
        layout: "採用した文字の MOSS JSON 出力画面を開きます。",
        "layout-close": "文字・セリフの一覧に戻ります。",
        "layout-width": "MOSS の生成画像の幅をピクセル単位で指定します。",
        "layout-height": "MOSS の生成画像の高さをピクセル単位で指定します。",
        "layout-preview": "出力される MOSS レイアウト JSON を確認できます。",
        "layout-copy": "MOSS レイアウト JSON をクリップボードにコピーします。",
        "layout-save": "MOSS レイアウトを JSON ファイルとして保存します。",
      },
      row: {
        inspect: "参照画像でこの文字の位置を確認します。",
        edit: "本文を修正したら、再度「採用」を付けます。",
        adopt: "この文字を説明文と MOSS JSON に使います。",
        speaker: "話者を確定します。参照画像で選ぶか、人物を囲って指定することもできます。",
        up: "この文字の出力順を1つ前に移動します。",
        down: "この文字の出力順を1つ後ろに移動します。",
        remove: "この読み取り結果を一覧と出力から削除します。",
        position: "参照画像上をドラッグし、出力する文字の位置と範囲を指定します。",
      },
    },
  };

  function boxBetween(a, b) {
    return [Math.min(a.x, b.x), Math.min(a.y, b.y), Math.max(a.x, b.x), Math.max(a.y, b.y)];
  }

  function overlaps(a, b) {
    if (!a || !b) return false;
    const area = box => (box[2] - box[0]) * (box[3] - box[1]);
    const intersection = Math.max(0, Math.min(a[2], b[2]) - Math.max(a[0], b[0])) *
      Math.max(0, Math.min(a[3], b[3]) - Math.max(a[1], b[1]));
    return intersection / (area(a) + area(b) - intersection) > 0.55;
  }

  const readingKey = text => text.normalize().trim().replace(/\s+/g, " ");

  function locationText(box, width, height) {
    if (!box || !width || !height) return "";
    const x = (box[0] + box[2]) / (2 * width), y = (box[1] + box[3]) / (2 * height);
    const row = y < 1 / 3 ? 0 : y > 2 / 3 ? 2 : 1;
    const column = x < 1 / 3 ? 0 : x > 2 / 3 ? 2 : 1;
    return [
      [" at the upper left", " at the upper center", " at the upper right"],
      [" on the left", " near the center", " on the right"],
      [" at the lower left", " at the lower center", " at the lower right"]
    ][row][column];
  }

  window.forgeHybridTaggerOCR = function mountOCR(panel, options) {
    const {msg, locale, call, analysisStatus, getAsset, getDevice, getCaption, copyText, onOutput, onProgress, onJobChange} = options;
    const layout = window.forgeHybridTaggerLayout;
    const byId = suffix => panel.querySelector("#fhit-ocr" + (suffix ? "-" + suffix : ""));
    const root = byId();
    if (!root) return null;
    const well = panel.querySelector("#fhit-image-well");
    const image = panel.querySelector("#fhit-reference");
    const overlay = byId("overlay"), list = byId("list");
    const dialog = byId("layout-dialog"), widthInput = byId("layout-width"), heightInput = byId("layout-height");
    let entries = [], nextId = 0, selected = null, job = null, mode = null, drag = null;
    let notice = null, models = [], modelRequest = null, modelCheckedAt = 0;
    let people = [], nextPersonId = 0, showPeople = false, editPerson = null, returnFocus = null;
    let sourceSize = null;
    const imageSize = () => sourceSize || [image.naturalWidth, image.naturalHeight];
    const currentPerson = entry => people.find(person => person.id === (entry?.speaker === undefined
      ? entry?.candidate : entry.speaker));
    const help = () => ocrHelp[locale?.() === "ja" ? "ja" : "en"];

    function renderHelp() {
      const hints = help();
      root.querySelector(":scope > summary").title = hints.section;
      for (const [name, hint] of Object.entries(hints.controls)) byId(name).title = hint;
    }

    function imageBounds() {
      const frame = image.getBoundingClientRect();
      if (image.hidden || !image.naturalWidth || !image.naturalHeight || !frame.width || !frame.height) return null;
      const scale = Math.min(frame.width / image.naturalWidth, frame.height / image.naturalHeight);
      const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
      return {left: frame.left + (frame.width - width) / 2, top: frame.top + (frame.height - height) / 2,
        width, height, scale};
    }

    function drawPoint(event, mustBeInside = false) {
      const bounds = imageBounds();
      if (!bounds) return null;
      const [width, height] = imageSize();
      const x = (event.clientX - bounds.left) * width / bounds.width;
      const y = (event.clientY - bounds.top) * height / bounds.height;
      if (mustBeInside && (x < 0 || x > width || y < 0 || y > height)) return null;
      return {x: Math.round(Math.max(0, Math.min(width, x))), y: Math.round(Math.max(0, Math.min(height, y)))};
    }

    function paint() {
      const bounds = imageBounds();
      const box = selected && layout.placement(selected);
      overlay.hidden = !root.open || !bounds || (!drag && !box && !(showPeople && people.length));
      if (overlay.hidden) return;
      const frame = well.getBoundingClientRect();
      overlay.style.left = bounds.left - frame.left - well.clientLeft + "px";
      overlay.style.top = bounds.top - frame.top - well.clientTop + "px";
      overlay.style.width = bounds.width + "px";
      overlay.style.height = bounds.height + "px";
      overlay.replaceChildren();

      const [width, height] = imageSize();
      function add(box, label, highlighted, person = false) {
        const [x0, y0, x1, y1] = box;
        const frame = document.createElement("div");
        frame.className = label ? "ocr-box" : "ocr-box dragging";
        if (person) frame.classList.add("ocr-person");
        frame.dataset.selected = String(highlighted);
        frame.style.left = 100 * x0 / width + "%";
        frame.style.top = 100 * y0 / height + "%";
        frame.style.width = 100 * (x1 - x0) / width + "%";
        frame.style.height = 100 * (y1 - y0) / height + "%";
        if (label) {
          const badge = document.createElement("span");
          badge.textContent = label;
          frame.append(badge);
        }
        overlay.append(frame);
      }
      if (box) add(box, entries.indexOf(selected) + 1, true);
      if (showPeople) {
        const person = currentPerson(selected);
        for (const other of people) {
          add(other.box, msg("ocrPersonMarker").replace("{n}", other.id), other === person, true);
        }
      }
      if (drag) add(boxBetween(drag.start, drag.end), "", false);
    }

    function renderStatus() {
      const element = byId("status"), modelsElement = byId("models");
      const current = job?.status || notice;
      const model = models.find(item => item.id === current?.model);
      let status = "";
      if (!getAsset()) status = msg("imageRequired");
      else if (mode) status = msg({crop: "ocrDrag", position: "ocrDragLocation",
        person: "ocrSpeakerDragHint", pick: "ocrSpeakerPickHint"}[mode]);
      else if (current?.error) status = msg(current.kind === "speakers" && current.error === "analysis_failed"
        ? "ocrSpeakerFailed" : current.error);
      else if (current?.state === "done") {
        const summary = current.kind === "speakers"
          ? (current.candidateCount ? msg("ocrSpeakerCount").replace("{n}", current.candidateCount) : msg("ocrSpeakerNone"))
          : (current.results.length ? msg("ocrReadCount").replace("{n}", current.results.length) : msg("ocrNothing"));
        status = [summary, current.device?.toUpperCase(), current.metrics && current.metrics.seconds.toFixed(2) + " s"]
          .filter(Boolean).join(" · ");
      } else if (current) {
        const progress = current.state === "ocr_preparing" && model &&
          ["downloading", "verifying"].includes(model.state);
        const title = current.model && modelName(msg, current.model);
        status = progress
          ? [title, msg(model.state), Math.round(100 * model.bytes / model.totalBytes) + "%"].join(" · ")
          : [msg(current.state), title, current.device?.toUpperCase()].filter(Boolean).join(" · ");
      }
      if (element.textContent !== status) element.textContent = status;
      element.hidden = !status;
      element.classList.toggle("failure", Boolean(current?.error));
      modelsElement.hidden = !models.length || !getAsset() || Boolean(job);
      modelsElement.textContent = models.map(model => modelName(msg, model.id) + " " +
        msg(model.state === "missing" ? "ocrMissing" : model.state)).join(" · ");
      modelsElement.title = models.map(model => model.downloadPath).join("\n");
      onProgress?.(job ? {state: job.status.state, model} : null);
    }

    function renderControls() {
      const enabled = Boolean(getAsset());
      byId("auto").disabled = byId("crop").disabled = !enabled || Boolean(job);
      byId("manual").disabled = !enabled || Boolean(job);
      byId("speakers").disabled = !enabled || Boolean(job) ||
        !entries.some(entry => entry.kind === "bubble" && entry.text.trim() && layout.placement(entry));
      byId("stop").hidden = !job;
      byId("crop").setAttribute("aria-pressed", String(mode === "crop"));
      for (const row of list.children) {
        const action = row.querySelector(".ocr-location");
        const active = row.dataset.entry === String(selected?.id);
        action.id = active ? "fhit-ocr-location" : "";
        action.setAttribute("aria-pressed", String(active && mode === "position"));
      }
      byId("adopt-all").disabled = !entries.some(entry => entry.text.trim() && !entry.adopted);
      byId("controls").hidden = list.hidden = !entries.length;
      const used = layout.adopted(entries).length;
      const count = used ? msg("ocrUsedCount").replace("{n}", used) : "";
      byId("count").textContent = count;
      byId("export").hidden = !entries.length;
      byId("export-count").textContent = count;
      byId("layout").disabled = !used || !enabled;
      well.classList.toggle("ocr-selecting", Boolean(mode));
      renderStatus();
    }

    function button(label, text, title, listener) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "quiet small";
      item.textContent = text;
      item.setAttribute("aria-label", label);
      item.title = title;
      item.addEventListener("click", listener);
      return item;
    }

    function highlight(entry, speaker = false) {
      if (entry !== selected) mode = drag = editPerson = null;
      selected = entry;
      showPeople = speaker;
      for (const row of list.children) row.dataset.selected = String(row.dataset.entry === String(entry?.id));
      paint();
      renderControls();
    }

    function change() {
      renderControls();
      if (dialog.open) renderLayout();
      onOutput();
    }

    function personLabel(person) {
      const side = ["ocrSideLeft", "ocrSideCenter", "ocrSideRight"][layout.column(person.box, imageSize()[0])];
      return msg("ocrPerson").replace("{n}", person.id).replace("{side}", msg(side));
    }

    function speakerField(entry, label, title) {
      const field = document.createElement("label");
      field.className = "ocr-speaker-field";
      const select = document.createElement("select");
      select.setAttribute("aria-label", msg("ocrSpeaker") + " · " + label);
      select.title = title;
      select.dataset.ocrSpeaker = "";
      const person = currentPerson(entry);
      const pending = entry.speaker === undefined && Boolean(person);
      if (pending) {
        const candidate = new Option(msg("ocrSpeakerCandidate").replace("{person}", personLabel(person)), "candidate");
        candidate.disabled = true;
        select.add(candidate);
      }
      select.add(new Option(msg("ocrSpeakerUnset"), "unset"));
      select.add(new Option(msg("ocrSpeakerOffscreen"), "offscreen"));
      for (const other of people) select.add(new Option(personLabel(other), "person:" + other.id));
      if (people.length) select.add(new Option(msg("ocrSpeakerChoose"), "pick"));
      select.add(new Option(msg("ocrSpeakerDraw"), "draw"));
      if (person) select.add(new Option(msg("ocrSpeakerRedraw"), "redraw"));
      const current = pending ? "candidate" : person ? "person:" + person.id : entry.speaker || "unset";
      select.value = current;
      select.addEventListener("focus", () => highlight(entry, true));
      select.addEventListener("blur", () => {
        if (!mode) { showPeople = false; paint(); }
      });
      select.addEventListener("change", () => {
        const value = select.value;
        highlight(entry, true);
        if (["pick", "draw", "redraw"].includes(value)) {
          select.value = current;
          selectMode(value === "pick" ? "pick" : "person", select, value === "redraw" ? person : null);
        } else {
          entry.speaker = value === "unset" ? null : value === "offscreen" ? value : Number(value.split(":")[1]);
          drawRows();
          list.querySelector('[data-entry="' + entry.id + '"] select')?.focus({preventScroll: true});
          change();
        }
      });
      field.append(document.createTextNode(msg("ocrSpeaker")), select);
      return field;
    }

    function drawRows(focusEntry = null) {
      const hints = help().row;
      list.replaceChildren();
      entries.forEach((entry, index) => {
        const row = document.createElement("li");
        row.className = "ocr-row";
        row.dataset.entry = entry.id;
        row.dataset.selected = String(selected === entry);
        const actions = document.createElement("div");
        actions.className = "ocr-row-actions";
        const text = document.createElement("textarea");
        text.rows = 2;
        text.value = entry.text;
        const kind = msg(entry.kind === "text" ? "ocrFreeText" : "ocrSpeech");
        const label = (index + 1) + " · " + kind;
        text.setAttribute("aria-label", label);
        text.title = hints.edit;
        const open = button(label, String(index + 1), hints.inspect, () => highlight(entry));
        const adoptLabel = document.createElement("label");
        adoptLabel.className = "checkbox";
        const adopt = document.createElement("input");
        adopt.type = "checkbox";
        adopt.checked = entry.adopted;
        adopt.disabled = !entry.text.trim();
        adopt.title = adoptLabel.title = hints.adopt;
        adoptLabel.append(adopt, document.createTextNode(entry.kind === "text" ? msg("ocrUseFree") : msg("ocrUse")));
        adopt.addEventListener("change", () => { entry.adopted = adopt.checked; highlight(entry); change(); });
        text.addEventListener("focus", () => highlight(entry));
        text.addEventListener("input", () => {
          entry.text = text.value;
          entry.edited = true;
          entry.adopted = adopt.checked = false;
          adopt.disabled = !entry.text.trim();
          change();
        });
        const move = offset => {
          entries.splice(index, 1);
          entries.splice(index + offset, 0, entry);
          selected = entry;
          drawRows(entry);
          change();
        };
        const up = button(msg("ocrMoveUp"), "↑", hints.up, () => move(-1));
        up.disabled = index === 0;
        const down = button(msg("ocrMoveDown"), "↓", hints.down, () => move(1));
        down.disabled = index === entries.length - 1;
        const remove = button(msg("ocrRemove"), "×", hints.remove, () => {
          entries.splice(index, 1);
          if (selected === entry) {
            selected = entries[Math.min(index, entries.length - 1)] || null;
            mode = drag = editPerson = null;
            showPeople = false;
          }
          drawRows(selected);
          if (!selected) byId("manual").focus();
          change();
        });
        const details = document.createElement("div");
        details.className = "ocr-row-actions ocr-row-layout";
        const position = button(msg("ocrLocation"), msg("ocrLocation"), hints.position, () => {
          highlight(entry);
          selectMode("position", position);
        });
        position.classList.add("ocr-location");
        details.append(speakerField(entry, label, hints.speaker), position);
        actions.append(open, adoptLabel, up, down, remove);
        row.append(actions, text, details);
        list.append(row);
        if (focusEntry === entry) text.focus({preventScroll: true});
      });
      renderControls();
      paint();
    }

    function refreshModels() {
      if (modelRequest || Date.now() - modelCheckedAt < 550) return;
      modelCheckedAt = Date.now();
      modelRequest = call("ocr/status").then(data => {
        models = data.models;
        renderStatus();
      }).catch(() => {}).finally(() => { modelRequest = null; });
    }

    function cancel() {
      const old = job;
      job = null;
      if (old?.id) void call("analysis/" + old.id, {method: "DELETE"}).catch(() => {});
      if (old) onJobChange();
    }

    function addResults(result, requestMode) {
      if (requestMode === "auto") entries = entries.filter(entry =>
        entry.origin !== "auto" || entry.edited || entry.adopted || entry.speaker !== undefined ||
        (mode && entry === selected));
      const preserved = entries.length;
      let firstAdded = null;
      for (const row of result.results) {
        const key = readingKey(row.text);
        const duplicate = entries.some((entry, index) =>
          (requestMode === "auto" && index < preserved && overlaps(entry.box, row.box)) ||
          (readingKey(entry.text) === key &&
            (overlaps(entry.box || entry.placement, row.box) || overlaps(entry.crop, row.crop))));
        if (duplicate) continue;
        const entry = {...row, id: ++nextId, origin: requestMode, adopted: false};
        entries.push(entry);
        firstAdded ??= entry;
      }
      if (!entries.includes(selected)) selected = firstAdded || entries[0] || null;
      drawRows();
      change();
    }

    function applySpeakers(result) {
      const reused = new Set();
      const detected = result.prediction.people.map(box => {
        let person = people.find(other => !reused.has(other) && overlaps(other.detectedBox, box));
        if (!person) person = {id: ++nextPersonId, box};
        person.detectedBox = box;
        if (!person.edited) person.box = box;
        reused.add(person);
        return person;
      });
      const kept = people.filter(person => !reused.has(person) &&
        (person.edited || person === editPerson || entries.some(entry => entry.speaker === person.id)));
      people = [...detected, ...kept].sort((a, b) => a.id - b.id);
      const candidates = layout.candidates(entries, result.prediction);
      for (const entry of entries) entry.candidate = detected[candidates.get(entry.id)]?.id;
      result.candidateCount = entries.filter(entry => entry.speaker === undefined && entry.candidate != null).length;
      if (!mode) {
        if (!currentPerson(selected)) selected = entries.find(entry => currentPerson(entry)) || selected;
        showPeople = Boolean(currentPerson(selected));
      }
      drawRows();
      change();
    }

    async function read(requestMode, box) {
      const asset = getAsset();
      if (!asset || job) return;
      const speakers = requestMode === "speakers";
      mode = drag = editPerson = null;
      showPeople = false;
      const request = {id: null, status: {state: "queued", kind: speakers ? "speakers" : "ocr"}};
      job = request;
      renderControls();
      paint();
      try {
        const params = new URLSearchParams({device: getDevice()});
        if (!speakers) params.set("mode", requestMode);
        if (box) params.set("box", box.join(","));
        const started = await call((speakers ? "ocr/speakers?" : "ocr?") + params, {
          method: "POST", headers: {"Content-Type": "application/octet-stream"}, body: asset.file
        });
        request.id = started.id;
        if (job !== request) {
          void call("analysis/" + request.id, {method: "DELETE"}).catch(() => {});
          return;
        }
        onJobChange();
        while (job === request) {
          const current = await analysisStatus(request.id);
          if (job !== request) return;
          request.status = current;
          if (ending.has(current.state)) {
            job = null;
            notice = current;
            if (current.state === "done") {
              sourceSize = [current.width, current.height];
              if (speakers) applySpeakers(current);
              else addResults(current, requestMode);
            }
            break;
          }
          if (current.state === "ocr_preparing") refreshModels();
          renderStatus();
          await new Promise(resolve => setTimeout(resolve, 220));
        }
      } catch (error) {
        if (job === request) {
          cancel();
          notice = {error: msg(error.message) !== error.message ? error.message
            : speakers ? "ocrSpeakerFailed" : "ocrFailed"};
        }
      } finally {
        modelCheckedAt = 0;
        if (root.open) refreshModels();
        renderControls();
        onJobChange();
      }
    }

    function selectMode(kind, origin, person = null) {
      mode = mode === kind ? null : kind;
      drag = null;
      editPerson = mode ? person : null;
      returnFocus = mode ? origin : null;
      if (mode) {
        well.scrollIntoView({block: "nearest"});
        well.focus({preventScroll: true});
      }
      renderControls();
      paint();
    }

    function renderLayout() {
      const preview = byId("layout-preview");
      const size = imageSize(), target = [widthInput.valueAsNumber, heightInput.valueAsNumber];
      const output = layout.compile(entries, people, size, target, getCaption());
      const notes = [msg("ocrUsedCount").replace("{n}", output.used)];
      const suggested = size.map(value => Math.ceil(value / 16) * 16);
      if (size.some((value, index) => value !== suggested[index])) {
        notes.push(msg("ocrLayoutRounded").replace("{original}", size.join(" × ")).replace("{canvas}", suggested.join(" × ")));
      }
      if (output.invalidSize) notes.push(msg("ocrLayoutSize"));
      else if (size[0] * target[1] !== size[1] * target[0]) notes.push(msg("ocrLayoutAspect"));
      if (output.missing.length) notes.push(msg("ocrLayoutMissing").replace("{rows}", output.missing.map(n => "#" + n).join(", ")));
      if (output.pending) notes.push(msg("ocrLayoutPending").replace("{n}", output.pending));
      byId("layout-note").textContent = notes.join(" · ");
      byId("layout-feedback").textContent = "";
      preview.value = output.text;
      byId("layout-copy").disabled = byId("layout-save").disabled = !output.text;
    }

    byId("layout").addEventListener("click", () => {
      if (!widthInput.value || !heightInput.value) {
        const [width, height] = imageSize().map(value => Math.ceil(value / 16) * 16);
        widthInput.value = width;
        heightInput.value = height;
      }
      renderLayout();
      dialog.showModal();
    });
    byId("layout-close").addEventListener("click", () => dialog.close());
    for (const input of [widthInput, heightInput]) input.addEventListener("input", renderLayout);
    byId("layout-copy").addEventListener("click", async () => {
      const value = byId("layout-preview").value;
      if (value) byId("layout-feedback").textContent = msg(await copyText(value, dialog) ? "copied" : "copyError");
    });
    byId("layout-save").addEventListener("click", () => {
      const value = byId("layout-preview").value;
      if (!value) return;
      const filename = getAsset().file.name.replace(/\.[^.]+$/, "") || "image";
      const url = URL.createObjectURL(new Blob([value], {type: "application/json;charset=utf-8"}));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename + "-moss-layout.json";
      dialog.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      byId("layout-feedback").textContent = msg("ocrLayoutSaved");
    });

    byId("auto").addEventListener("click", () => void read("auto"));
    byId("crop").addEventListener("click", event => selectMode("crop", event.currentTarget));
    byId("speakers").addEventListener("click", () => void read("speakers"));
    byId("manual").addEventListener("click", () => {
      mode = drag = editPerson = null;
      selected = {id: ++nextId, text: "", box: null, kind: "bubble", origin: "manual", adopted: false};
      entries.push(selected);
      drawRows(selected);
    });
    byId("adopt-all").addEventListener("click", () => {
      for (const entry of entries) entry.adopted = Boolean(entry.text.trim());
      drawRows();
      change();
    });
    byId("stop").addEventListener("click", () => {
      const wasSpeakers = job?.status.kind === "speakers";
      cancel();
      notice = {state: "cancelled"};
      renderControls();
      byId(wasSpeakers ? "speakers" : "auto").focus();
    });
    root.addEventListener("toggle", () => {
      if (root.open) refreshModels();
      else {
        mode = drag = editPerson = null;
        showPeople = false;
      }
      renderControls();
      paint();
    });
    well.addEventListener("pointerdown", event => {
      if (!mode || event.button !== 0 || event.target.closest(".resize-grip")) return;
      const point = drawPoint(event, true);
      if (!point) return;
      if (mode === "pick") {
        const matching = people.filter(person => layout.contains(person.box, point.x, point.y));
        if (matching.length && selected) {
          const smallest = matching.reduce((a, b) => layout.area(a.box) <= layout.area(b.box) ? a : b);
          selected.speaker = smallest.id;
          mode = null;
          notice = null;
          drawRows();
          change();
        }
        event.preventDefault();
        return;
      }
      drag = {id: event.pointerId, start: point, end: point};
      well.setPointerCapture(event.pointerId);
      event.preventDefault();
      paint();
    });
    well.addEventListener("pointermove", event => {
      if (drag?.id !== event.pointerId) return;
      const point = drawPoint(event);
      if (point) drag.end = point;
      paint();
    });
    well.addEventListener("pointerup", event => {
      if (drag?.id !== event.pointerId) return;
      const box = boxBetween(drag.start, drawPoint(event) || drag.end);
      const current = mode;
      mode = drag = null;
      if (box[2] - box[0] < 2 || box[3] - box[1] < 2) notice = {error: "ocr_bad_box"};
      else if (current === "crop") void read("crop", box);
      else if (current === "person" && selected) {
        const person = editPerson || {id: ++nextPersonId};
        if (!editPerson) people.push(person);
        person.box = box;
        person.edited = true;
        selected.speaker = person.id;
        notice = null;
        drawRows();
        change();
      } else if (current === "position" && selected) {
        selected.placement = box;
        selected.edited = true;
        notice = null;
        drawRows();
        change();
      }
      editPerson = null;
      renderControls();
      paint();
    });
    well.addEventListener("lostpointercapture", () => { drag = null; paint(); });
    panel.addEventListener("keydown", event => {
      if (event.key !== "Escape" || (!mode && !dialog.open)) return;
      event.stopPropagation();
      if (dialog.open) return;
      event.preventDefault();
      mode = drag = editPerson = null;
      showPeople = false;
      renderControls();
      paint();
      returnFocus?.focus({preventScroll: true});
    });
    image.addEventListener("load", paint);
    new ResizeObserver(paint).observe(well);
    renderHelp();
    renderControls();

    return {
      reset() {
        cancel();
        entries = [];
        people = [];
        nextPersonId = 0;
        selected = notice = mode = drag = sourceSize = editPerson = returnFocus = null;
        showPeople = false;
        if (dialog.open) dialog.close();
        widthInput.value = heightInput.value = "";
        drawRows();
      },
      render() { renderHelp(); drawRows(); if (dialog.open) renderLayout(); },
      lines() {
        return layout.adopted(entries).map(entry => {
          const subject = entry.kind === "text" ? "The text" : "The speech bubble";
          const place = locationText(layout.placement(entry), ...imageSize());
          const text = entry.text.replace(/["\\]/g, "\\$&");
          return subject + place + ' reads "' + text + '".';
        });
      }
    };
  };
})();
