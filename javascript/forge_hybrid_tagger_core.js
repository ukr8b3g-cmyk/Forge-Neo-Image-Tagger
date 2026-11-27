/* Tag selection and prompt composition. No backend calls are made here. */
(() => {
  "use strict";

  const PIXAI = "pixai_v1_fp16";
  const WD = "wd_eva02_large_v3";
  const modes = {wd: WD, pixai: PIXAI};
  const levelDepths = {standard: 2, detailed: 3, full: 4};
  const levels = Object.keys(levelDepths);
  const aliases = {[PIXAI]: "p", [WD]: "w"};
  const emoticons = new Set([
    "0_0", "(o)_(o)", "+_+", "+_-", "._.", "<o>_<o>", "<|>_<|>", "<o>_<|>",
    "|>_<o>", "<o>_<|", "@_@", "^_^", "o_o", "u_u", "x_x", "|_|", "||_||"
  ]);
  const hairColors = "black|blonde|brown|red|blue|green|pink|purple|white|grey|silver|aqua|orange";
  const hairColor = new RegExp("^(" + hairColors + ") hair$");
  const hairLength = /^(short|medium|long|very long) hair$/;
  const eyesColor = /^(blue|brown|green|red|yellow|orange|purple|grey|aqua|pink|black) eyes$/;
  const peopleCount = /^(\d+)(girls?|boys?|others?)$/;
  const subjectCount = /^(\d+(girls?|boys?|others?)|solo|multiple (girls|boys|others))$/;
  const exclusiveVisuals = [subjectCount, hairColor, hairLength, eyesColor,
    /^(indoors|outdoors)$/, /^(open mouth|closed mouth)$/, /^(looking at viewer|looking away)$/];
  const visualGroup = name => exclusiveVisuals.findIndex(group => group.test(nameKey(name)));
  const clothing = /^(?:(black|white|red|blue|green|pink|purple|brown|grey|yellow|orange|teal|beige) )?(shirt|blouse|t-shirt|dress|skirt|sweater|hoodie|jacket|coat|pants|shorts|jeans|sweater vest|vest|suit|robe|kimono|uniform|school uniform|swimsuit|overalls|bikini)$/;
  const framing = {
    "upper body": "An upper-body view",
    "full body": "A full-body view",
    "close-up": "A close-up",
    portrait: "A portrait",
    "cowboy shot": "A view from the thighs up"
  };
  const actions = {
    sitting: "is sitting", standing: "is standing", crouching: "is crouching",
    kneeling: "is kneeling", walking: "is walking", running: "is running",
    "lying down": "is lying down", "indian style": "sits cross-legged",
    smile: "smiles", frown: "frowns", "looking at viewer": "looks at the viewer",
    "looking away": "looks away", "hand on own cheek": "rests a hand against their cheek",
    "hand on hip": "rests a hand on their hip", "arms crossed": "crosses their arms",
    "peace sign": "makes a peace sign", "holding hands": "holds hands"
  };
  const locations = {
    cafe: "a café", street: "a street", beach: "a beach", forest: "a forest",
    school: "a school", classroom: "a classroom", bedroom: "a bedroom",
    garden: "a garden", park: "a park", city: "a city", mountain: "a mountain"
  };
  const scenery = {
    table: "a table", chair: "a chair", cup: "a cup", "coffee cup": "a coffee cup",
    window: "a window", plant: "a plant", "potted plant": "a potted plant",
    bookshelf: "a bookshelf", lamp: "a lamp", sunlight: "sunlight", steam: "steam",
    sky: "the sky", clouds: "clouds", tree: "a tree", flowers: "flowers",
    umbrella: "an umbrella", book: "a book", "wooden table": "a wooden table",
    door: "a door", "blue sky": "a blue sky", ocean: "the ocean", snow: "snow",
    rain: "rain", "night sky": "the night sky", "falling leaves": "falling leaves"
  };
  const standard = new Set([
    "indoors", "outdoors", "blunt bangs", "side swept bangs", "ponytail", "twintails",
    "blush", "open mouth", "closed mouth", "wide eyes", "tears", "wink", "serious",
    "from above", "from below", "from side", "from behind", "profile", "front view",
    "dutch angle", "wide shot", "simple background", "white background", "black background",
    "looking back", "looking down", "looking up", "holding", "between legs",
    ...Object.keys(framing), ...Object.keys(actions), ...Object.keys(locations)
  ]);
  const composition = new Set([
    ...Object.keys(framing), "from above", "from below", "from side", "from behind", "profile",
    "front view", "dutch angle", "wide shot", "depth of field", "blurry background", "backlighting"
  ]);
  const expressions = new Set([
    ...Object.keys(actions), "blush", "open mouth", "closed mouth", "wide eyes", "tears", "wink",
    "serious", "holding", "squatting", "crossed legs", "crossed arms", "bent knees", "head rest", "elbow rest"
  ]);
  const appearancePart = /\b(?:hair|bangs|eyes|eyelashes|eyebrows|pupils|twintails|ponytail|braids?|bob cut|freckles)$/;
  const outfitPart = /\b(?:skirt|shirt|blouse|dress|sweater|vest|jacket|coat|uniform|sleeves|hoodie|pants|shorts|jeans|boots|shoes|stockings|thighhighs|pantyhose|socks|gloves|ribbon|bow|necktie|bowtie|hat|beret|crown|headdress|headband|earrings|jewelry|glasses|brooch|belt|hair ornament|necklace|scarf)$/;
  const sceneryPart = /\b(?:background|windows?|walls?|floors?|rubble|ruins|room|building|sky|clouds|trees?|flowers|leaves|street|road|cityscape|landscape|shadows?|lighting|water|mountains|chairs?|tables?|shelf|shelves|lamps?|hanging lights?|teacups?|saucers?|coffee)$/;
  const facialFeatures = /^(?:smile|grin|frown|blush|tears|wink|serious|pout|crying|angry|closed mouth|open mouth|tongue out|heterochromia|one eye closed|eyes closed|makeup|lipstick)$/;
  const characterFeatures = /\b(?:eyes?|ears?|nose|lips|teeth|fangs?|skin|eyeshadow|eyeliner|face paint|facial mark|beard|mustache|stubble|sideburns|scar|tattoo|mole|birthmark|ahoge|updo|hair bun|hair intakes?|locks|horns?|wings?|tail|breasts|shoulders|collarbones?|cleavage|navel|legs|abs)$/;
  const wornItems = /\b(?:clothes|outfit|costume|apron|camisole|cardigan|tunic|gown|pinafore|corset|bodysuit|leotard|tights|leggings|legwear|armwear|heels|sandals|sneakers|armor|cape|cloak|mask|eyepatch|veil|bonnet|hood|headphones|hairband|hairclip|hairpin|hair flower|tiara|bracelet|wristband|anklet|choker|piercing|backpack|shoulder bag|belt buckle|buttons|collar|cuffs|ruffles|frills|pleats)$/;
  const outfitDetails = /^(?:bare shoulders|off shoulder|off-shoulder|one shoulder|sleeveless|strapless|detached sleeves|rolled up sleeves|frilled|lace|plaid|checkered|striped|polka dot|maid|miko|gothic lolita)$/;

  function nameKey(name) {
    return String(name).trim().toLowerCase().replace(/[\s_]+/g, " ");
  }

  function tagName(name) {
    return emoticons.has(name) || /^score_\d/.test(name) ? name : name.replaceAll("_", " ");
  }

  function tier(name, category) {
    if (category !== "general") return 3;
    const value = nameKey(name);
    if (peopleCount.test(value) || /^multiple (girls|boys|others)$/.test(value) ||
        value === "solo" || hairColor.test(value) || hairLength.test(value) || clothing.test(value)) return 1;
    return standard.has(value) || eyesColor.test(value) ? 2 : 3;
  }

  function detect(outcome, model, overrides) {
    const alias = aliases[outcome.id];
    const defaults = model.thresholds;
    const thresholds = {...defaults, ...overrides[alias]};
    const bestRating = outcome.id === WD
      ? outcome.rows.reduce((best, row) => row[1] === "rating" && row[2] > (best?.[2] ?? -1) ? row : best, null)
      : null;
    const entries = new Map();
    for (const row of outcome.rows) {
      const [original, category, score] = row;
      const name = tagName(original);
      const key = category + ":" + nameKey(name);
      const selected = category === "rating" && outcome.id === WD ? row === bestRating :
        score >= (thresholds[category] ?? defaults.general);
      const entry = entries.get(key) ?? {key, name, category, depth: tier(name, category)};
      entry.score = score;
      entry.selected = selected;
      entries.set(key, entry);
    }

    const adopted = [], candidates = [];
    const countByType = new Map();
    for (const entry of entries.values()) {
      if (!entry.selected) continue;
      if (entry.category === "general") {
        adopted.push(entry);
        const count = peopleCount.exec(nameKey(entry.name));
        if (count) {
          const type = count[2].replace(/s$/, "");
          const group = countByType.get(type) ?? [];
          group.push(entry);
          countByType.set(type, group);
        }
      } else {
        candidates.push(entry);
      }
    }
    const conflicts = new Set([...countByType.values()].filter(group => group.length > 1).flat());
    for (const entry of conflicts) candidates.push(entry);
    const sort = (left, right) => right.score - left.score || left.name.localeCompare(right.name);
    const base = adopted.filter(tag => !conflicts.has(tag)).sort(sort);
    const minimum = outcome.id === WD ? Math.max(0.10, thresholds.general * 0.42) :
      Math.max(0.035, thresholds.general * 0.30);
    const full = fullOnly(entries, base, minimum);
    return {adopted: base, full, candidates: candidates.sort(sort), byKey: entries};
  }

  function fullOnly(entries, base, minimum) {
    const baseKeys = new Set(base.map(tag => tag.key));
    const setGroups = new Set(base.map(tag => visualGroup(tag.name)).filter(group => group >= 0));
    // Full includes lower-scoring tags while handling conflicts with adopted attributes.
    const extra = [];
    for (const entry of entries.values()) {
      if (entry.category !== "general" || baseKeys.has(entry.key)) continue;
      if (!(entry.score >= minimum)) continue;
      const group = visualGroup(entry.name);
      if (group === 0 || setGroups.has(group)) continue;
      extra.push({...entry, depth: 4});
    }
    return extra.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).filter(tag => {
      const group = visualGroup(tag.name);
      if (group < 0) return true;
      if (setGroups.has(group)) return false;
      setGroups.add(group);
      return true;
    });
  }

  function list(values) {
    if (values.length <= 1) return values.join("");
    return values.length === 2 ? values.join(" and ") : values.slice(0, -1).join(", ") + ", and " + values.at(-1);
  }

  function article(value) {
    return (/^[aeiou]/i.test(value) ? "an " : "a ") + value;
  }

  function description(tags, formatted) {
    const names = new Set(tags.filter(tag => tag.category === "general").map(tag => nameKey(tag.name)));
    const has = name => names.has(name);
    const values = [...names];
    const counts = values.map(name => name.match(peopleCount)).filter(Boolean);
    const solo = counts.length === 1 && counts[0][1] === "1" && has("solo") &&
      !values.some(name => /^multiple (girls|boys|others)$/.test(name));
    const sentences = [];
    if (solo) {
      const colors = values.filter(name => hairColor.test(name));
      const lengths = values.filter(name => hairLength.test(name));
      const eyes = values.filter(name => eyesColor.test(name));
      const hair = [lengths.length === 1 && lengths[0].replace(/ hair$/, ""),
        colors.length === 1 && colors[0].replace(/ hair$/, "")].filter(Boolean);
      const appearance = [
        hair.length ? hair.join(" ") + " hair" : "",
        has("blunt bangs") ? "blunt bangs" : "",
        eyes.length === 1 ? eyes[0] : ""
      ].filter(Boolean);
      const clothes = values.filter(name => clothing.test(name)).filter(name => {
        const pieces = clothing.exec(name);
        return pieces[1] || !values.some(other => clothing.exec(other)?.[1] && clothing.exec(other)[2] === pieces[2]);
      }).map(name => /^(pants|shorts|jeans|overalls)$/.test(name.split(" ").at(-1)) ? name : article(name));
      if (has("brooch")) clothes.push("a brooch");
      if (has("glasses")) appearance.push("glasses");
      const shots = Object.keys(framing).filter(has);
      let subject = (shots.length === 1 ? framing[shots[0]] + " shows " : "The image shows ") + "one person";
      if (appearance.length) subject += " with " + list(appearance);
      if (clothes.length) subject += ", wearing " + list(clothes);
      sentences.push(subject + ".");
      const poses = ["sitting", "standing", "crouching", "kneeling", "walking", "running", "lying down", "indian style"]
        .filter(has).filter(name => name !== "sitting" || !has("indian style"));
      const gaze = ["looking at viewer", "looking away"].filter(has);
      const exactActions = Object.keys(actions).filter(name => has(name) &&
        !["sitting", "standing", "crouching", "kneeling", "walking", "running", "lying down", "indian style",
          "looking at viewer", "looking away", "holding hands"].includes(name));
      if (poses.length === 1) exactActions.unshift(poses[0]);
      if (gaze.length === 1) exactActions.push(gaze[0]);
      if (exactActions.length) sentences.push("The person " + list(exactActions.map(name => actions[name])) + ".");
    } else if (!has("solo") && counts.length === 1 && Number(counts[0][1]) > 1 &&
               !values.some(name => /^multiple (girls|boys|others)$/.test(name) && !name.endsWith(counts[0][2]))) {
      const count = Number(counts[0][1]);
      sentences.push((count === 2 ? "Two" : count === 3 ? "Three" : count === 4 ? "Four" : String(count)) + " people are visible.");
    }

    const subject = sentences.join(" ");
    const scene = [];
    const settings = Object.keys(locations).filter(has).map(name => locations[name]);
    const objects = Object.keys(scenery).filter(name => has(name) &&
      !(name === "plant" && has("potted plant")) &&
      !(name === "cup" && has("coffee cup")) &&
      !(name === "table" && has("wooden table")) &&
      !(name === "sky" && (has("blue sky") || has("night sky"))))
      .map(name => scenery[name]);
    if (settings.length === 1) scene.push("The scene is set in " + settings[0] + ".");
    else if (has("indoors") !== has("outdoors")) scene.push("The scene is " + (has("indoors") ? "indoors" : "outdoors") + ".");
    if (objects.length) scene.push("Visible elements include " + list(objects) + ".");
    return [subject, scene.join(" ")].filter(Boolean).join(formatted ? "\n\n" : " ");
  }

  function splitPromptLines(value) {
    const lines = [];
    let line = [];
    const closings = {"(": ")", "[": "]", "<": ">"};
    const nesting = [];
    let start = 0, escaped = false, quote = false;
    for (let i = 0; i <= value.length; i++) {
      const c = value[i];
      if (i < value.length) {
        if (escaped) { escaped = false; continue; }
        if (c === "\\") { escaped = true; continue; }
        if (c === '"') quote = !quote;
        if (quote) continue;
        if (closings[c]) nesting.push(closings[c]);
        else if (c === nesting.at(-1)) nesting.pop();
        if (nesting.length || !/[,\r\n]/.test(c)) continue;
      }
      const token = value.slice(start, i).trim();
      if (token) line.push(token);
      if (c !== "," && line.length) {
        lines.push(line);
        line = [];
      }
      start = i + 1;
    }
    return lines;
  }

  const splitPrompt = value => splitPromptLines(value).flat();
  const tagKey = value => nameKey(value.replace(/\\([\\()[\],<>])/g, "$1"));

  function compileRules(prefix, exclusions) {
    const excluded = new Set(splitPrompt(exclusions).map(tagKey));
    const first = new Map();
    for (const token of splitPrompt(prefix)) {
      const key = tagKey(token);
      if (key && !excluded.has(key) && !first.has(key)) first.set(key, token);
    }
    return {first, excluded};
  }

  function promptGroup(tag) {
    if (tag.category === "character") return "person";
    if (tag.category === "style") return "composition";
    if (tag.category !== "general") return "other";
    const name = nameKey(tag.name);
    if (composition.has(name) || /^pov\b/.test(name)) return "composition";
    if (expressions.has(name) || /^(?:looking |holding |(?:hands?|elbows?) (?:on|in|behind|under) )/.test(name)) return "action";
    if (clothing.test(name) || outfitPart.test(name)) return "clothing";
    if (subjectCount.test(name) || appearancePart.test(name)) return "person";
    if (name === "indoors" || name === "outdoors" || Object.hasOwn(locations, name) ||
        Object.hasOwn(scenery, name) || sceneryPart.test(name)) return "scene";
    return "other";
  }

  function characterGroup(tag) {
    if (tag.category === "character") return "person";
    if (tag.category !== "general") return null;
    const name = nameKey(tag.name);
    const group = promptGroup(tag);
    if (facialFeatures.test(name)) return "person";
    if (group === "person" || group === "clothing") return group;
    if (group !== "other") return null;
    if (wornItems.test(name) || outfitDetails.test(name)) return "clothing";
    return characterFeatures.test(name) ? "person" : null;
  }

  const isCharacterTag = tag => Boolean(characterGroup(tag));

  function characterDescription(tags, formatted) {
    const general = tags.filter(tag => tag.category === "general");
    const appearance = [], outfit = [];
    const counts = general.map(tag => nameKey(tag.name).match(peopleCount)).filter(Boolean);
    const plural = general.some(tag => /^multiple (girls|boys|others)$/.test(nameKey(tag.name)));
    const solo = general.some(tag => nameKey(tag.name) === "solo");
    const count = counts.length === 1 ? Number(counts[0][1]) : 0;
    for (const tag of general) {
      const name = nameKey(tag.name);
      if (subjectCount.test(name)) continue;
      const group = characterGroup(tag);
      if (group === "person") appearance.push(name);
      if (group === "clothing") outfit.push(name);
    }
    const sentences = [];
    if (count === 1 && solo && !plural) sentences.push("One person is visible.");
    if (count > 1 && !solo) sentences.push(count + " people are visible.");
    if ((plural || counts.length > 1) && !solo && count < 2) sentences.push("Multiple people are visible.");
    if (appearance.length) sentences.push("Visible features include " + list(appearance) + ".");
    if (outfit.length) sentences.push("Clothing and accessories include " + list(outfit) + ".");
    return sentences.join(formatted ? "\n\n" : " ");
  }

  function fullDescription(tags, formatted) {
    const summary = description(tags, formatted);
    const mentioned = new Set(summary.toLowerCase().match(/[a-z0-9]+(?:-[a-z0-9]+)*/g) || []);
    const details = tags.filter(tag => tag.category === "general" && tag.depth === 4)
      .map(tag => nameKey(tag.name)).filter(name => !name.split(" ").every(word => mentioned.has(word)));
    const extra = details.length ? "Additional visible details include " + list([...new Set(details)]) + "." : "";
    return [summary, extra].filter(Boolean).join(formatted ? "\n\n" : " ");
  }

  function groupedTagLines(selected, tokens, groupFor = promptGroup) {
    const groups = {person: [], clothing: [], action: [], scene: [], composition: [], other: []};
    selected.forEach((tag, index) => groups[groupFor(tag) || "other"].push(tokens[index]));
    return Object.values(groups).filter(group => group.length);
  }

  const joinTagLines = lines => lines.map(line => line.join(", ")).join(",\n");

  const lmSections = ["subject", "appearance", "action", "scene", "composition", "style"];
  const lmQualityTags = new Set([
    "masterpiece", "best quality", "highest quality", "top quality", "ultra quality",
    "very high quality", "high quality", "good quality", "normal quality", "low quality", "worst quality",
    "highres", "ultrares", "absurdres", "very aesthetic"
  ]);
  const negativePrompt = /^[ \t]*(?:[#*-]+[ \t]*)?(?:negative(?:[ \t]+(?:prompt|tags?))?|ネガティブ(?:プロンプト)?)[ \t]*(?:\*\*)?(?:[:：]|$)/im;
  const positiveHeading = /^[ \t]*(?:[#*-]+[ \t]*)?(?:positive[ \t]+(?:prompt|tags?)|ポジティブ(?:プロンプト)?)[ \t]*(?:\*\*)?[:：][ \t]*/i;

  function composeLM(items, level, formatted, task) {
    const depth = levelDepths[level];
    const groups = new Map(lmSections.map(section => [section, []]));
    const tagMode = task === "tags";
    const selected = items.filter(item => groups.has(item.section) && levelDepths[item.level] <= depth);
    selected.sort((a, b) => levelDepths[a.level] - levelDepths[b.level]);
    for (const item of selected) {
      const text = item.text.split(negativePrompt, 1)[0].replace(positiveHeading, "").trim();
      if (!text) continue;
      const tokens = splitPrompt(text);
      const negative = tokens.findIndex(token => negativePrompt.test(token));
      const positive = negative < 0 ? tokens : tokens.slice(0, negative);
      const clean = positive.filter(token => {
        const key = tagKey(token).replace(/[.。]$/, "");
        return !lmQualityTags.has(key) && !/^score \d+(?: up)?$/.test(key);
      });
      if (!clean.length) continue;
      if (tagMode) groups.get(item.section).push(...clean);
      else groups.get(item.section).push(clean.length === tokens.length ? text : clean.join(", "));
    }
    const known = new Set();
    const lines = [...groups.values()].map(group => group.filter(value => {
      const key = tagMode ? tagKey(value) : nameKey(value);
      if (known.has(key)) return false;
      known.add(key);
      return true;
    })).filter(group => group.length);
    const displayLines = !formatted && lines.length > 1 ? [lines.flat()] : lines;
    if (tagMode) return {text: joinTagLines(displayLines), tagLines: displayLines, description: "", formatted};
    const description = displayLines.map(group => group.reduce((text, part) =>
      text + (/[.!?。！？,，、]$/.test(text) ? " " : ", ") + part)).join("\n");
    return {text: description, tagLines: [], description, formatted};
  }

  function makeOutput(tags, level, format, manualDescription, formatted = false, rules, scope = "image") {
    const depth = levelDepths[level];
    const selected = tags.filter(tag => (tag.manual || tag.depth <= depth) && !rules?.excluded.has(tagKey(tag.name)));
    const tagEntries = rules?.first.size ? selected.filter(tag => !rules.first.has(tagKey(tag.name))) : selected;
    const tokens = format === "description" ? [] : tagEntries.map(tag =>
      tag.manual && !tag.detected ? tag.name : tag.name.replace(/[\\()[\],<>]/g, "\\$&"));
    const tagLines = formatted && tokens.length
      ? groupedTagLines(tagEntries, tokens, scope === "character" ? characterGroup : promptGroup) : [tokens];
    if (format !== "description" && rules?.first.size) {
      const first = [...rules.first.values()];
      if (formatted && tokens.length) tagLines.unshift(first);
      else tagLines[0] = first.concat(tagLines[0]);
    }
    const outputTokens = tagLines.flat();
    const tagText = joinTagLines(tagLines);
    const describe = scope === "character" ? characterDescription : level === "full" ? fullDescription : description;
    const text = format === "tags" ? "" : (manualDescription ?? describe(selected, formatted)).trim();
    return {
      count: format === "description" ? selected.length : outputTokens.length,
      tokens: outputTokens, tagLines, formatted, tags: tagText, description: text,
      text: [tagText, text].filter(Boolean).join("\n\n")
    };
  }

  function hasDescription(previous, description) {
    const normalize = text => text.replace(/\s+/g, " ").trim();
    const expected = normalize(description);
    const parts = previous.split(/\r?\n[ \t]*\r?\n/).map(normalize).filter(Boolean);
    return parts.some((part, index) => {
      let candidate = part;
      for (let next = index + 1; candidate.length < expected.length && next < parts.length; next++) {
        candidate += " " + parts[next];
      }
      return candidate === expected;
    });
  }

  function appendPrompt(previous, output) {
    if (!previous.trim()) return previous + output.text;
    const known = new Set(splitPrompt(previous).map(tagKey));
    const lines = output.tagLines.map(line => line.filter(tag => {
      const key = tagKey(tag);
      if (known.has(key)) return false;
      known.add(key);
      return true;
    })).filter(line => line.length);
    const descriptions = output.descriptionParts ?? [output.description];
    const description = descriptions.filter(text => text && !hasDescription(previous, text)).join("\n\n");
    const added = [joinTagLines(lines), description].filter(Boolean).join("\n\n");
    if (!added) return previous;
    const delimiter = previous.trimEnd().endsWith(",") ? "" : ",";
    const divider = output.description ? "\n\n" : delimiter + (output.formatted ? "\n" : " ");
    return previous + divider + added;
  }

  window.forgeHybridTaggerCore = {modes, levels, nameKey, tagKey, tier, detect, isCharacterTag,
    splitPrompt, splitPromptLines, compileRules, makeOutput, composeLM, appendPrompt};
})();
