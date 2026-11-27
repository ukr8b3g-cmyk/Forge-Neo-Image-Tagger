/* Match MAGI detections to Manga OCR lines and compile MOSS pixel layouts. */
(() => {
  "use strict";

  const placement = entry => entry.placement || entry.box;
  const adopted = entries => entries.filter(entry => entry.adopted && entry.text.trim());
  const validBox = box => Array.isArray(box) && box.length === 4 && box.every(Number.isFinite) &&
    box[0] < box[2] && box[1] < box[3];
  const area = box => (box[2] - box[0]) * (box[3] - box[1]);
  const xCenter = box => (box[0] + box[2]) / 2;
  const yCenter = box => (box[1] + box[3]) / 2;

  function contains(box, x, y) {
    return validBox(box) && x >= box[0] && x <= box[2] && y >= box[1] && y <= box[3];
  }

  function matchText(box, text) {
    if (!contains(box, xCenter(text), yCenter(text))) return false;
    const overlap = (Math.min(box[2], text[2]) - Math.max(box[0], text[0])) *
      (Math.min(box[3], text[3]) - Math.max(box[1], text[1]));
    return overlap / area(text) >= 0.60;
  }

  function candidates(entries, prediction) {
    const {people, texts, panels, essential, links} = prediction;
    const speech = entries.filter(entry => entry.kind === "bubble" && entry.text.trim());
    const matches = new Map(), ambiguous = new Set(), linked = new Map(links);
    const orderedPanels = panels.filter(validBox).sort((a, b) => area(a) - area(b));
    const panelOf = box => orderedPanels.find(panel => contains(panel, xCenter(box), yCenter(box)));
    texts.forEach((text, index) => {
      if (!validBox(text)) return;
      // Manga lettering can look like free text to MAGI. A detected bubble
      // outline also establishes that the row is dialogue.
      const rows = speech.filter(entry => (essential[index] || entry.bubbleDetected) &&
        matchText(entry.crop || entry.box || placement(entry), text));
      if (rows.length !== 1) {
        rows.forEach(entry => ambiguous.add(entry.id));
        return;
      }
      const id = rows[0].id, person = linked.get(index);
      const personBox = people[person];
      const textPanel = panelOf(text), personPanel = validBox(personBox) && panelOf(personBox);
      if (!validBox(personBox) || (textPanel && personPanel && textPanel !== personPanel) ||
          (matches.has(id) && matches.get(id) !== person)) {
        ambiguous.add(id);
      } else {
        matches.set(id, person);
      }
    });
    for (const id of ambiguous) matches.delete(id);
    return matches;
  }

  const multipleOf16 = value => Number.isSafeInteger(value) && value > 0 && value % 16 === 0;

  function centeredBox(box, width, height, sourceWidth, sourceHeight) {
    if (!validBox(box) || sourceWidth <= 0 || sourceHeight <= 0) return null;
    // Match the official compiler's pixel enclosure, including fractional scaling.
    const scale = (value, output, source) =>
      Math.round(Math.min(output, Math.max(0, value * output / source)) * 1e9) / 1e9;
    const [left, top, right, bottom] = [scale(box[0], width, sourceWidth), scale(box[1], height, sourceHeight),
      scale(box[2], width, sourceWidth), scale(box[3], height, sourceHeight)];
    if (right <= left || bottom <= top) return null;
    return [Math.floor(top) - height / 2, Math.floor(left) - width / 2,
      Math.ceil(bottom) - height / 2, Math.ceil(right) - width / 2];
  }

  const column = (box, width) => Math.min(2, Math.floor(3 * xCenter(box) / width));

  function speakerName(person, speakers, width) {
    const side = column(person.box, width);
    const group = speakers.filter(other => column(other.box, width) === side);
    if (group.length === 1) return ["the person on the left", "the person near the center", "the person on the right"][side];
    const ordered = speakers.slice().sort((a, b) => xCenter(b.box) - xCenter(a.box) || yCenter(a.box) - yCenter(b.box));
    return "person " + (ordered.indexOf(person) + 1) + " counting from the right";
  }

  function compile(entries, people, [sourceWidth, sourceHeight], [width, height], caption) {
    const rows = adopted(entries);
    const invalidSize = !multipleOf16(width) || !multipleOf16(height);
    if (invalidSize) [width, height] = [sourceWidth, sourceHeight];
    const missing = [], items = [], used = new Map();
    const boxAtSize = box => centeredBox(box, width, height, sourceWidth, sourceHeight);
    const speakers = people.filter(person => rows.some(entry => entry.speaker === person.id) && boxAtSize(person.box));
    for (const [index, entry] of entries.entries()) {
      if (!entry.adopted || !entry.text.trim()) continue;
      const bbox = boxAtSize(placement(entry));
      if (!bbox) missing.push(index + 1);
      const speaker = speakers.find(person => person.id === entry.speaker);
      let note = entry.kind === "text" ? "Visible text" : "A speech bubble";
      if (speaker) {
        const name = speakerName(speaker, speakers, sourceWidth);
        note += " from " + name;
        used.set(speaker, name);
      } else if (entry.speaker === "offscreen") {
        note += " from an off-screen speaker";
      }
      items.push({label: "text", caption: note + ".", text: entry.text, bbox});
    }
    for (const [person, name] of used) {
      items.push({label: "character", caption: name[0].toUpperCase() + name.slice(1) + ".",
        bbox: boxAtSize(person.box)});
    }
    const text = !rows.length || invalidSize || missing.length ? "" : JSON.stringify({
      summary: {canvas: "single", caption: caption?.trim() || "An image with placed text."},
      items, bbox_coord_space: "abs_centralized", bbox_format: "yxyx"
    });
    return {text, missing, invalidSize, used: rows.length,
      pending: rows.filter(entry => entry.speaker === undefined && entry.candidate != null).length};
  }

  globalThis.forgeHybridTaggerLayout = {placement, adopted, contains, area, column, candidates, compile};
})();
