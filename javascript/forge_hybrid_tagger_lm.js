/* LM Studio workspace inside Image Tagger. */
(() => {
  "use strict";
  const labels = {
    modelDefault: ["Default", "自動"], purpose: ["Preset", "プリセット"], idea: ["Short description", "短い文章"],
    defaultPurpose: ["Default settings", "標準設定"], loadPreset: ["Load", "読み込む"],
    loadPurpose: ["Load generation preset", "生成設定のプリセットを読み込む"],
    loadSystem: ["Load system prompt preset", "システムプロンプトのプリセットを読み込む"],
    resetPreset: ["Reset", "初期値に戻す"],
    resetSystem: ["Reset system prompt", "システムプロンプトを初期値に戻す"],
    modelMemory: ["Model memory", "モデルの解放"], beforeForge: ["Before Forge generation (local server)", "Forgeの画像生成前に解放（ローカル接続）"],
    afterUse: ["After each analysis or completion", "解析・補完のたびに解放"], serverMemory: ["Use LM Studio settings", "LM Studioの設定に従う"],
    unloadSelected: ["Unload selected model now", "選択モデルを今すぐ解放"], unloading: ["Unloading…", "解放を確認中…"],
    released: ["Unloaded", "解放済み"], resident: ["Loaded", "ロード中（常駐）"], notLoaded: ["Not loaded", "未ロード"],
    lm_release_pending: ["Unload could not be verified. Refresh models and retry.", "解放を確認できません。一覧を更新して再試行してください。"],
    settings: ["Model settings", "モデル設定"], model: ["Model (Qwen3-VL 8B recommended)", "モデル（Qwen3-VL 8B 推奨）"],
    refresh: ["Refresh models", "モデル一覧を更新"], server: ["LM Studio server URL", "LM Studio 接続先"],
    system: ["Shared system prompt", "共通システムプロンプト"], task: ["Task", "用途"],
    tags: ["Image Tags", "画像からタグ"], caption: ["Image Caption", "画像から説明文"],
    expand: ["Expand Text", "短文を補完"],
    analysisSections: ["Analysis topics", "解析項目"], selectSection: ["Select a topic to analyze.", "解析する項目を選んでください。"],
    pendingSections: ["Included in the next analysis", "次の解析で反映"],
    noSectionDetails: ["No details were returned for the selected topics.", "選んだ項目に該当する描写はありません。"],
    sectionsInDetailed: ["These details are available at the Detailed level.", "選んだ項目の描写は「詳細」で確認できます。"],
    ungroupedSections: ["Analyze again to apply these topics to this single-text result.", "この結果は項目別に分かれていません。選んだ項目で再解析できます。"],
    textLanguage: ["Output language", "出力言語"], languageAuto: ["Auto", "自動"], languageEnglish: ["English", "英語"],
    parameters: ["Generation settings", "生成設定"], presetName: ["Preset name", "プリセット名"],
    savePreset: ["Save", "保存"], deletePreset: ["Delete", "削除"],
    result: ["Generated prompt", "生成したプロンプト"],
    systemSettings: ["System prompt", "システムプロンプト"], systemPreset: ["Preset", "プリセット"],
    systemDefault: ["Default", "標準"], systemCustom: ["Custom", "カスタム"], systemName: ["Preset name", "プリセット名"],
    systemSave: ["Save", "保存"], systemDelete: ["Delete", "削除"],
    systemUnavailable: ["System prompt presets are unavailable.", "システムプロンプトのプリセットを取得できません。"],
    systemReload: ["Restart Forge to use system prompt presets.", "Forgeを再起動するとプリセットを使えます。"],
    detailed: ["Standard", "標準"], full: ["Detailed", "詳細"],
    legacyResult: ["Only a single result is available.", "この結果は1段階で表示します。"],
    lm_levels: ["Could not read the detail levels. Check the output token limit and try again.", "詳しさ別の出力を読み取れません。最大トークン数を確認して再試行してください。"],
    choose: ["Select a model", "モデルを選択"],
    analyze: ["Analyze image", "画像を解析"], complete: ["Expand prompt", "プロンプトを補完"],
    processing: ["Processing…", "実行中…"], done: ["Done", "完了"], stored: ["Saved", "保存しました"],
    presetLoaded: ["Preset loaded", "プリセットを読み込みました"], presetReset: ["Defaults restored", "初期値に戻しました"],
    removed: ["Deleted", "削除しました"],
    overwrite: ["Overwrite this entry?", "同じ名前の項目を上書きしますか？"], confirmDelete: ["Delete this entry?", "この項目を削除しますか？"],
    lm_empty: ["Enter a name and content.", "名前と内容を入力してください。"],
    lm_text: ["Enter the text you want to expand.", "補完したい文章を入力してください。"],
    lm_image: ["Choose an image.", "画像を選んでください。"], lm_model: ["Choose a model in Model settings.", "モデル設定でモデルを選んでください。"],
    lm_url: ["Enter the LM Studio server URL.", "LM Studioの接続先URLを確認してください。"],
    lm_offline: ["Cannot reach LM Studio. Check its server and URL.", "LM Studioに接続できません。サーバーと接続先を確認してください。"],
    lm_response: ["Invalid response from LM Studio.", "LM Studioの応答を読み取れませんでした。"],
    lm_timeout: ["LM Studio timed out.", "LM Studioの応答がタイムアウトしました。"],
    lm_no_output: ["The model returned no text.", "モデルの応答に本文がありません。"],
    runningModel: ["Running model", "実行中のモデル"], noVision: ["No image-capable models found.", "画像対応のモデルが見つかりません。"],
    noModels: ["No models found.", "モデルが見つかりません。"], invalid_settings: ["Check generation settings.", "生成設定の値を確認してください。"]
  };
  const controlHelp = {
    sections: ["Choose which image details to analyze. You can also filter the current result.", "画像で読み取る項目を選びます。解析済みの項目はその場で表示を切り替えられます。"],
    settings: ["Choose the model, memory policy, and LM Studio server.", "モデル、メモリ解放のタイミング、LM Studioの接続先を設定します。"],
    model: ["Qwen3-VL 8B is recommended. You can select any compatible model from LM Studio.", "Qwen3-VL 8B を推奨しています。LM Studio にある他の対応モデルも選べます。"],
    refresh: ["Reload the list of models from LM Studio.", "LM Studioからモデル一覧を取得し直します。"],
    unload: ["Unload the selected model from LM Studio memory now.", "選択中のモデルをLM Studioのメモリから今すぐ解放します。"],
    "task-caption": ["Describe the reference image in natural language.", "参照画像の人物や情景、構図などを文章で説明します。"],
    "task-tags": ["Describe visible details with Danbooru-style tags.", "画像に写っている特徴をDanbooru形式のタグにします。"],
    "task-expand": ["Turn a short idea into a prompt for image generation.", "短いアイデアから画像生成用のプロンプトを作ります。"],
    idea: ["Enter the subject, scene, or idea you want to expand.", "プロンプトにしたい人物や場面、アイデアを短く入力します。"],
    "text-language-auto": ["Follow the input language or the prompt language requested in your text.", "入力の言語に合わせます。プロンプトの言語を文中で指定した場合は、その指定に従います。"],
    "text-language-english": ["Write the prompt in English and preserve any exact text specified for the image.", "プロンプトを英語で書き、画像に入れると指定した文字は原文のまま残します。"],
    "system-settings": ["Edit the shared system prompt or manage its presets.", "共通システムプロンプトの編集やプリセットの管理ができます。"],
    system: ["Edit the instructions sent to the model. A blank field is remembered too.", "モデルに送る指示を編集します。空欄にした場合もその状態を記憶します。"],
    "system-preset": ["Switch to a saved system prompt or return to the default or custom prompt.", "保存したシステムプロンプト、標準の文、またはカスタムの文に切り替えます。"],
    "system-name": ["Set the name to save this system prompt under.", "このシステムプロンプトを保存するときの名前を入力します。"],
    "system-load": ["Reload the selected system prompt as saved.", "選択したシステムプロンプトを保存時の内容で読み込み直します。"],
    "system-save": ["Save the current system prompt under the entered name.", "現在のシステムプロンプトを入力した名前で保存します。"],
    "system-reset": ["Restore the default system prompt in the editor.", "入力欄を標準のシステムプロンプトに戻します。"],
    "system-delete": ["Delete the selected system prompt preset.", "選択中のシステムプロンプトのプリセットを削除します。"],
    "generation-settings": ["Manage generation presets and adjust how the model generates text.", "生成設定のプリセットや、文章の生成に使うパラメーターを調整します。"],
    purpose: ["Apply saved settings for a task or use its defaults.", "保存した生成設定を適用するか、用途の標準設定に戻します。"],
    "preset-name": ["Set the name to save these generation settings under.", "この生成設定を保存するときの名前を入力します。"],
    "preset-load": ["Reload the selected generation preset as saved.", "選択した生成設定のプリセットを保存時の内容で読み込み直します。"],
    "preset-save": ["Save the current task and generation settings under the entered name.", "現在の用途と生成設定を入力した名前で保存します。"],
    "preset-delete": ["Delete the selected generation preset.", "選択中の生成設定のプリセットを削除します。"],
    temperature: ["Adjust randomness. Leave blank to use the model default.", "値が高いほど表現に幅が出ます。空欄ならモデルの既定値を使います。"],
    top_p: ["Limit the range of words the model can choose. Leave blank to use the model default.", "値が低いほど出力する語の候補を絞ります。空欄ならモデルの既定値を使います。"],
    max_tokens: ["Set the maximum length in tokens. Leave blank to use the model default.", "出力の長さの上限をトークン数で指定します。空欄ならモデルの既定値を使います。"],
    result: ["Edit the generated prompt before copying or sending it.", "コピーや送信の前に生成したプロンプトを編集できます。"],
    "compare-detailed": ["Use the Standard prompt for copying or sending.", "コピーや送信に標準のプロンプトを使います。"],
    "compare-full": ["Use the Detailed prompt for copying or sending.", "コピーや送信に詳細なプロンプトを使います。"]
  };
  const stateHelp = {
    analyze: ["Analyze the reference image with the selected model.", "選択したモデルで参照画像を解析します。"],
    complete: ["Expand the short text with the selected model.", "選択したモデルで短い文章を補完します。"],
    processing: ["Waiting for the selected model to finish.", "選択したモデルの処理が終わるまでお待ちください。"],
    unloading: ["Wait for the model to finish unloading.", "モデルの解放が終わるまでお待ちください。"],
    compare: ["Compare the Standard and Detailed prompts from this result.", "現在の結果から標準と詳細のプロンプトを並べて比較します。"],
    closeCompare: ["Close the comparison and return to the prompt editor.", "比較を閉じ、プロンプトの編集に戻ります。"],
    compareWaiting: ["Generate a prompt to enable comparison.", "プロンプトを生成すると比較できます。"],
    single: ["This result has a single prompt. You can edit, copy, or send it.", "この結果は1種類のプロンプトです。編集、コピー、送信はできます。"],
    formatPrompt: ["Separate subjects, appearance, actions and settings into lines for preview, copy and send.", "人物・外見・動作・情景などを改行で分けます。プレビュー、コピー、送信に適用されます。"],
    detailed: ["Show the Standard prompt with the main details.", "主な特徴を押さえた標準のプロンプトを表示します。"],
    full: ["Show the Detailed prompt with additional information.", "細かな特徴も含めた詳細なプロンプトを表示します。"],
    comparisonPreview: ["Read this preview. Close comparison to edit the selected prompt.", "比較用のプレビューです。選択したプロンプトは比較を閉じると編集できます。"],
    url: ["Enter the base URL shown in LM Studio's server settings.", "LM Studioのサーバー設定に表示される接続先URLを入力します。"],
    fixedUrl: ["The Forge server configuration sets this URL.", "このURLはForgeのサーバー設定で指定されています。"],
    forge: ["Unload models used by this extension before local Forge image generation.", "この拡張が使ったモデルを、ローカルのForgeで画像を生成する前に解放します。"],
    immediate: ["Unload the model after each analysis or text expansion.", "画像解析や文章の補完が終わるたびにモデルを解放します。"],
    server: ["Let LM Studio manage when the model unloads.", "モデルを解放するタイミングはLM Studioの設定に従います。"]
  };
  const taskInstructions = {
    tags: "List the visible features as comma-separated Danbooru-style tags. Return only the tags."
  };
  const imageSections = {
    subject: {label:["Subject", "被写体"], details:["Main subjects or visible forms, and their number when clear.", "画面の主役となる被写体や形を捉え、数が分かる場合はその数も読み取ります。"]},
    appearance: {
      label:["Appearance", "外見・服装"],
      details:["Standard describes the main shapes and which parts carry each color, including clothing and layers when visible. Detailed adds distinctive patterns, textures, accents or accessories.", "標準では主な形と各部分の色を捉え、服が見えるときは種類や重ね方も読み取ります。詳細では、目を引く柄や質感、差し色、装飾を加えます。"],
      instruction:[
        "section=appearance, level=standard: Stay on the main subject itself. Describe its overall form and attach each dominant color to the part that actually carries it. For a dressed figure, name recognizable garments, their colors and visible layering. For an unfamiliar form or an abstract design, its contours and areas of color are the subject.",
        "section=appearance, level=detailed: Add features that distinguish the subject at a glance. These may be the cut of clothing, hair and expression, or characteristic parts and markings of any other subject. Keep each observation with its subject, especially when several share the frame.",
        "section=appearance, level=full: Add the accents, patterns, edges, surface qualities or accessories that stand out at the scale shown. Say where they appear and how their colors relate to the area around them. For blended colors, describe the visible transition. Keep reflections distinct from surface markings when clear. Omit indistinct details and guesses about material or construction.",
        "Use appearance items for the subject's own features. Put separate surroundings, pose, framing and lighting setup only in their respective selected topics."
      ].join("\n")
    },
    action: {label:["Action & pose", "動作・ポーズ"], details:["Visible motion, posture, gaze or interaction when present.", "動きや姿勢、視線、他の被写体との関わりが見えるときに読み取ります。"]},
    scene: {label:["Background", "背景"], details:["Setting and surroundings, including distinctive background colors or shapes.", "周囲の様子や、背景を特徴づける色・形を読み取ります。"]},
    composition: {label:["Composition", "構図"], details:["Framing, arrangement of subjects or shapes, viewpoint, depth and focus where visible.", "画面の切り取り方や被写体・形の配置、視点、奥行き、ピントを読み取ります。"]},
    style: {label:["Light & style", "光・画風"], details:["Visible lighting direction, highlights, shadows, palette, linework or rendering style.", "光の向き、明暗や影、色調、線や塗りの特徴を読み取ります。"]}
  };
  const sectionKeys = Object.keys(imageSections);
  function imageInstruction(kind, sections) {
    return [
      taskInstructions[kind],
      "Use the selected topics that fit this image. Lead with its most recognizable visible features. Each item should add a distinct observation within its topic. Use ordinary visual terms for uncertain forms. Leave inapplicable topics and absent features unmentioned. Keep headings and checklist commentary out of the output.",
      ...sections.map(key => key + ": " + (imageSections[key].instruction || imageSections[key].details[0]))
    ].filter(Boolean).join("\n");
  }
  const expandTask = "Expand the user's short text into an image-generation prompt. Preserve the subject, intent, and stated constraints.";
  const preserveImageText = "If the user explicitly specifies exact text to display in the image, quote that text verbatim in its original language. This includes a character's spoken words, signs and labels, even when the requested prompt language is different.";
  const expandLanguage = {
    auto: "Write the prompt in the predominant language of the input, or in the language the user explicitly requests for the prompt itself.",
    english: "Write the prompt in English, even if the input is in Japanese or another language. Write every part of the prompt in English except verbatim text that will appear in the image."
  };
  const defaultSystemPrompt = "Write a detailed image-generation prompt describing this image. Include appearance, clothing, pose, action, background and composition.";
  const defaultExpandSystemPrompt = [
    "Develop the short idea into one coherent visual scene. Preserve its subject, action, and every explicit visual detail and constraint. Keep the main subject, action, and defining details in the base prompt.",
    "Create a separate item for each applicable row below. Copy the section and level values exactly, and choose concrete details compatible with the idea for the text:",
    "- section=subject, level=standard: the main subject and any essential identifying features.",
    "- section=action, level=standard: the subject's main action or pose.",
    "- section=appearance, level=full: for a person, name a visible garment and give its color and cut.",
    "- section=appearance, level=full: for a person, describe the facial expression that suits the action.",
    "- section=scene, level=full: name one specific setting and describe a recognizable background object or surface with its placement.",
    "- section=composition, level=full: the shot size, camera angle, subject placement, or focus that develops the framing.",
    "- section=style, level=full: the light source, direction, and visible highlights or shadows.",
    "Choose one concrete option for each detail you supply and state it directly as part of the depicted scene. Preserve alternatives explicitly requested by the user.",
    "Honor explicit constraints on any group. Check that the expanded details use level full and that the base remains usable on its own."
  ].join("\n");
  const defaultSystemForTask = task => task === "expand" ? defaultExpandSystemPrompt : defaultSystemPrompt;
  const tasks = ["caption", "tags", "expand"];
  const builtInTask = purpose => tasks.find(key => purpose === "default:" + key) ?? "caption";
  const levels = ["detailed", "full"];
  const numeric = ["temperature", "top_p", "max_tokens"];
  const json = (method, payload) => ({method, headers: {"Content-Type":"application/json"}, body:JSON.stringify(payload)});

  window.forgeHybridTaggerLM = (panel, {byId, call, asset, locale, storageKey, notify, msg, splitPrompt, splitPromptLines, composeLM}) => {
    const el = key => byId("lm-" + key);
    const localized = pair => pair[locale() === "ja" ? 1 : 0];
    const tr = key => labels[key] ? localized(labels[key]) : msg(key);
    // Forge can serve the previous HTML until the running process reloads.
    el("library")?.remove();
    el("instruction")?.closest("label").remove();
    el("task").closest("label").hidden = true;
    const purposeLabel = el("purpose").closest("label");
    purposeLabel.insertAdjacentHTML("beforebegin", '<div class="format-row"><div class="segments" id="fhit-lm-tasks" role="group">' +
      tasks.map(task => '<button type="button" class="small" id="fhit-lm-task-' + task + '" data-lm="' + task + '" aria-pressed="false"></button>').join("") + '</div></div>');
    const generationSettings = el("temperature").closest("details");
    generationSettings.id = "fhit-lm-generation-settings";
    const generationFields = document.createElement("div");
    generationFields.className = "lm-fields";
    const generationActions = el("preset-save").parentElement;
    generationActions.classList.add("lm-system-actions");
    el("preset-save").classList.add("small");
    generationActions.insertAdjacentHTML("afterbegin",
      '<button type="button" class="small" id="fhit-lm-preset-load" data-lm="loadPreset"></button>');
    generationFields.append(purposeLabel, el("preset-name").closest("label"), generationActions,
      el("temperature").closest(".lm-numbers"));
    generationSettings.append(generationFields);
    const modelSettings = el("settings");
    modelSettings.after(generationSettings);
    el("run").insertAdjacentHTML("afterend",
      '<details id="fhit-lm-sections"><summary><span id="fhit-lm-sections-label" data-lm="analysisSections"></span>' +
      '<small class="muted" id="fhit-lm-sections-count"></small></summary>' +
      '<div class="lm-section-options" role="group" aria-labelledby="fhit-lm-sections-label">' +
      sectionKeys.map(key => '<label><input type="checkbox" value="' + key + '" checked><span></span></label>').join("") +
      '</div></details><p class="muted" id="fhit-lm-sections-note" role="status" hidden></p>');
    const sectionPanel = el("sections");
    const sectionInputs = [...sectionPanel.querySelectorAll("input")];
    el("text-field").insertAdjacentHTML("afterend",
      '<div class="control-pair" id="fhit-lm-text-language" hidden>' +
      '<strong class="field-label" id="fhit-lm-text-language-label" data-lm="textLanguage"></strong>' +
      '<div class="segments" role="group" aria-labelledby="fhit-lm-text-language-label">' +
      '<button type="button" id="fhit-lm-text-language-auto" data-lm="languageAuto" aria-pressed="false"></button>' +
      '<button type="button" id="fhit-lm-text-language-english" data-lm="languageEnglish" aria-pressed="false"></button>' +
      '</div></div>');
    const outputLabel = el("result").closest("label");
    const resizeHandle = (target, label) =>
      '<div id="fhit-lm-' + target + '-resize" class="resize-grip horizontal" role="separator" aria-orientation="horizontal"' +
      ' aria-controls="fhit-lm-' + target + '" tabindex="0" data-aria="' + label + '" data-title="' + label + '" hidden></div>';
    el("result").style.height = "var(--lm-result-height, auto)";
    el("result").style.resize = "none";
    outputLabel.insertAdjacentHTML("beforebegin",
      '<div class="format-row lm-output-controls">' +
        '<div class="control-pair"><strong class="field-label" id="fhit-lm-level-label" data-lm="level"></strong>' +
        '<div class="segments" role="group" aria-labelledby="fhit-lm-level-label">' +
        levels.map(level => '<button type="button" id="fhit-lm-level-' + level + '" data-lm="' + level + '" aria-pressed="false"></button>').join("") +
        '</div></div>' +
        '<div class="checkbox prompt-format"><input id="fhit-lm-format-prompt" type="checkbox">' +
        '<label for="fhit-lm-format-prompt" data-i18n="formatPrompt"></label></div>' +
        '<button type="button" class="secondary compare-toggle" id="fhit-lm-compare" aria-pressed="false" aria-expanded="false" aria-controls="fhit-lm-comparison"></button>' +
      '</div>');
    outputLabel.insertAdjacentHTML("afterend",
      resizeHandle("result", "resizeLMResult") +
      '<div class="comparison-grid" id="fhit-lm-comparison" aria-labelledby="fhit-lm-level-label"' +
      ' style="grid-template-columns:repeat(auto-fit,minmax(min(100%,177px),1fr))" hidden>' +
      levels.map(level => '<section class="comparison-card"><button type="button" id="fhit-lm-compare-' + level +
        '" data-lm="' + level + '" aria-pressed="false"></button><div class="preview-text" tabindex="0"' +
        ' style="height:var(--lm-comparison-height,auto);max-height:var(--lm-comparison-height,225px)"><p></p></div></section>').join("") +
      '</div>' + resizeHandle("comparison", "resizeLMComparison"));
    const comparisonCards = [...el("comparison").children];
    const systemLabel = el("system").closest("label");
    generationSettings.insertAdjacentHTML("beforebegin",
      '<details id="fhit-lm-system-settings"><summary data-lm="systemSettings"></summary><div class="lm-fields">' +
      '<label><span data-lm="systemPreset"></span><select id="fhit-lm-system-preset"></select></label>' +
        '<label><span data-lm="systemName"></span><input type="text" id="fhit-lm-system-name"></label>' +
      '<div class="lm-system-actions">' +
        '<button type="button" class="small" id="fhit-lm-system-load" data-lm="loadPreset"></button>' +
        '<button type="button" class="small" id="fhit-lm-system-reset" data-lm="resetPreset"></button>' +
        '<button type="button" class="small" id="fhit-lm-system-save" data-lm="systemSave"></button>' +
        '<button type="button" class="quiet small" id="fhit-lm-system-delete" data-lm="systemDelete"></button>' +
      '</div><p class="muted lm-system-status" id="fhit-lm-system-status" role="status" hidden></p></div></details>');
    el("system-status").before(systemLabel);
    let prefs = {};
    try { prefs = JSON.parse(localStorage.getItem(storageKey) || "{}") || {}; } catch {}
    const savePrefs = () => { try { localStorage.setItem(storageKey, JSON.stringify(prefs)); } catch {} };
    let active = false, busy = false, loaded = false, models = [], presets = [];
    const initialTask = builtInTask(prefs.purpose);
    let purpose = "default:" + initialTask, resultTask = "caption", revision = 0, loadSeq = 0;
    el("task").value = initialTask;
    let message = "", messageModel = "", currentUrl = null, userChangedPurpose = false;
    let systemName = typeof prefs.systemPreset === "string" ? prefs.systemPreset : "";
    const savedSystem = typeof prefs.system === "string" ? prefs.system : null;
    let customSystem = typeof prefs.customSystem === "string" || prefs.customSystem === null ? prefs.customSystem : systemName ? null : savedSystem;
    el("system").value = (systemName ? savedSystem : customSystem) ?? defaultSystemForTask(initialTask);
    let systemPresets = [], systemReady = false, systemBusy = false, systemSeq = 0, systemError = "";
    el("system-name").value = systemName;
    let level = levels.includes(prefs.level) ? prefs.level : "detailed";
    const formatPrompt = el("format-prompt");
    formatPrompt.checked = prefs.formatted !== false;
    let textOutputLanguage = prefs.textOutputLanguage === "auto" ? "auto" : "english";
    let resultItems = null, resultText = "", analyzedSections = null;
    const edits = new Map();
    const visibleLevel = () => resultText ? "detailed" : level;
    let unloading = false, releaseMessage = "";
    el("memory").value = ["forge","immediate","server"].includes(prefs.memory) ? prefs.memory : "forge";
    const task = () => el("task").value;
    function selectedSections(kind) {
      const saved = prefs.sectionsByTask?.[kind];
      if (!Array.isArray(saved)) return sectionKeys;
      const known = sectionKeys.filter(key => saved.includes(key));
      return saved.length && !known.length ? sectionKeys : known;
    }
    const visibleSections = () => analyzedSections && selectedSections(resultTask).filter(key => analyzedSections.includes(key));
    // Keep the editable draft for each combination when filters or levels are switched.
    const editKey = key => analyzedSections ? key + "/" + visibleSections().join(",") : key;
    const selectedPreset = () => presets.find(item => "saved:" + item.name === purpose);
    const setMessage = (key, model = "") => {
      message = key; messageModel = model;
      el("message").textContent = [tr(key), model].filter(Boolean).join(" · ");
    };
    function formatOptions(select, items, value) {
      select.replaceChildren(...items.map(([id, label]) => new Option(label, id)));
      select.value = value;
    }
    function memoryStatus() {
      const model = models.find(item => item.key === el("model").value);
      el("unload").disabled = unloading || !model;
      const key = releaseMessage || (model ? model.instances?.length ? "resident" : "notLoaded" : "");
      el("memory-status").textContent = key ? tr(key) : "";
    }
    async function unload() {
      const model = el("model").value;
      if (!model || unloading) return;
      unloading = true; releaseMessage = "unloading"; memoryStatus(); controls();
      try {
        await call("lm/models?model=" + encodeURIComponent(model), {method:"DELETE"});
        await refreshModels();
        if (el("model").value === model && loaded) releaseMessage = models.find(m => m.key === model)?.instances.length ? "lm_release_pending" : "released";
      } catch (error) { releaseMessage = error.message; }
      finally { unloading = false; if (releaseMessage === "unloading") releaseMessage = ""; memoryStatus(); controls(); }
    }
    let samplingContext = "";
    const editedPresetFields = new Set();
    function samplingScope() {
      return JSON.stringify([currentUrl, el("model").value, task()]);
    }
    function updateSampling(force = false) {
      const model = models.find(item => item.key === el("model").value);
      const scope = samplingScope();
      const context = JSON.stringify([scope, purpose, model?.sampling || null]);
      const restore = force || context !== samplingContext;
      if (restore) editedPresetFields.clear();
      samplingContext = context;
      const preset = selectedPreset();
      const manual = prefs.samplingByModel?.[scope] || {};
      const profile = model?.sampling;
      const textMode = task() === "expand";
      const pair = textMode ? profile?.text : profile?.image;
      for (const [index, key] of numeric.entries()) {
        const field = el(key);
        const userValue = !preset && Object.hasOwn(manual, key);
        const suggested = pair?.[index];
        if (restore) field.value = preset ? (preset[key] ?? "") : userValue ? manual[key] : (suggested ?? "");
        let source = localized(["LM Studio default", "LM Studio の既定値"]);
        if (editedPresetFields.has(key) || userValue) {
          source = localized(["Manual setting", "手動設定"]) + (field.value === "" ? " · " + source : "");
        } else if (preset) {
          source = preset.name + (field.value === "" ? " · " + source : "");
        } else if (suggested != null) {
          source = localized(profile.family ? ["Model family guideline", "モデル系列の目安"] :
            profile.base ? ["Base model recommendation", "ベースモデルの公式推奨値"] :
            ["Model recommendation", "モデルの公式推奨値"]) + " · " + profile.source + " · " +
            localized(textMode ? ["Text", "文章用"] : ["Vision", "画像用"]);
        }
        field.title = source + "\n" + localized(controlHelp[key]);
      }
      const reset = !preset && Object.keys(manual).length > 0;
      const load = el("preset-load");
      load.disabled = !preset && !reset;
      load.textContent = reset ? localized(["Restore defaults", "既定値に戻す"]) : tr("loadPreset");
      load.title = reset ? localized(["Restore automatic values for this model and task.", "このモデル・用途の数値を自動設定に戻します。"]) : localized(controlHelp["preset-load"]);
      load.setAttribute("aria-label", reset ? load.textContent : tr("loadPurpose"));
    }
    function showModels(forceSampling = false) {
      const list = models.filter(item => task() === "expand" || item.vision);
      const empty = loaded && !list.length ? (task() === "expand" ? "noModels" : "noVision") : "choose";
      formatOptions(el("model"), [["",tr(empty)], ...list.map(m => [m.key,m.key])], prefs.model || "");
      if (el("model").selectedIndex < 0) el("model").value = "";
      updateSampling(forceSampling);
      const url = el("url");
      url.title = localized(url.readOnly ? stateHelp.fixedUrl : stateHelp.url);
      memoryStatus();
    }
    function showPurposes() {
      formatOptions(el("purpose"), [["default:" + task(), tr("defaultPurpose")],
        ...presets.map(p => ["saved:" + p.name, p.name])], purpose);
    }
    function saveSystemPrefs() {
      Object.assign(prefs, {system: el("system").value, systemPreset: systemName, customSystem});
      savePrefs();
    }
    function showSystemPresets() {
      const options = [["", tr(customSystem === null ? "systemDefault" : "systemCustom")], ...systemPresets.map(({name}) => [name, name])];
      if (systemName && !systemPresets.some(preset => preset.name === systemName)) options.push([systemName, systemName]);
      formatOptions(el("system-preset"), options, systemName);
      const disabled = systemBusy || !systemReady;
      el("system-preset").disabled = el("system-name").disabled = el("system-save").disabled = disabled;
      el("system-delete").disabled = disabled || !systemName;
      el("system-load").disabled = el("system-delete").disabled;
      el("system-reset").disabled = systemBusy;
      el("system-status").hidden = !systemError;
      el("system-status").textContent = tr(systemError);
    }
    function chooseSystem(name) {
      const preset = systemPresets.find(item => item.name === name);
      systemName = preset?.name || "";
      el("system").value = preset?.text ?? customSystem ?? defaultSystemForTask(task());
      el("system-name").value = systemName;
      revision++;
      saveSystemPrefs();
      showSystemPresets();
    }
    async function refreshSystemPresets() {
      if (systemBusy) return;
      const seq = ++systemSeq;
      try {
        const items = await call("lm/library/systems");
        if (seq !== systemSeq) return;
        if (!Array.isArray(items) || items.some(item => typeof item?.name !== "string" || typeof item.text !== "string")) {
          throw Error("lm_response");
        }
        systemPresets = items;
        systemReady = true; systemError = "";
        if (systemName && !items.some(item => item.name === systemName)) chooseSystem("");
      } catch (e) {
        if (seq !== systemSeq) return;
        systemReady = false;
        systemError = [404, 422].includes(e.status) ? "systemReload" : "systemUnavailable";
      }
      showSystemPresets();
    }
    function renderSections() {
      const kind = task();
      const imageMode = kind !== "expand";
      const selected = imageMode ? selectedSections(kind) : [];
      sectionPanel.hidden = !imageMode;
      let note = "";
      if (imageMode) {
        for (const input of sectionInputs) input.checked = selected.includes(input.value);
        el("sections-count").textContent = selected.length + "/" + sectionKeys.length;
        if (!selected.length) note = tr("selectSection");
        else if (resultTask === kind && analyzedSections) {
          const missing = selected.filter(key => !analyzedSections.includes(key));
          if (resultText && visibleSections().length !== analyzedSections.length) note = tr("ungroupedSections");
          else if (missing.length) note = tr("pendingSections") + " · " + missing.map(key => localized(imageSections[key].label)).join(locale() === "ja" ? "、" : ", ");
          else if (resultItems && !edits.has(editKey(visibleLevel()))) {
            const matches = resultItems.filter(item => selected.includes(item.section));
            if (!matches.length) note = tr("noSectionDetails");
            else if (level !== "full" && matches.every(item => item.level === "full")) note = tr("sectionsInDetailed");
          }
        }
      }
      el("sections-note").textContent = note;
      el("sections-note").hidden = !note;
      el("run").disabled = busy || unloading || (imageMode && !selected.length);
    }
    function controls() {
      const textMode = task() === "expand";
      if (!systemName && customSystem === null) {
        const standard = defaultSystemForTask(task());
        if (el("system").value !== standard) el("system").value = standard;
      }
      panel.classList.toggle("lm-text-input", active && textMode);
      el("text-field").hidden = !textMode;
      el("text-language").hidden = !textMode;
      for (const key of Object.keys(expandLanguage)) {
        el("text-language-" + key).setAttribute("aria-pressed", String(textOutputLanguage === key));
      }
      renderSections();
      const action = busy ? "processing" : textMode ? "complete" : "analyze";
      el("run").textContent = tr(action);
      el("run").title = localized(stateHelp[unloading ? "unloading" : action]);
      el("preset-delete").disabled = !selectedPreset();
      for (const key of tasks) el("task-" + key).setAttribute("aria-pressed", String(key === task()));
    }
    function applyPurpose(id) {
      purpose = id;
      const custom = selectedPreset();
      el("task").value = custom?.task ?? builtInTask(id);
      if (!custom) purpose = "default:" + task();
      el("preset-name").value = custom?.name || "";
      prefs.purpose = purpose; savePrefs();
      revision++; showPurposes(); showModels(true); controls();
    }
    function translate() {
      for (const node of panel.querySelectorAll("[data-lm]")) node.textContent = tr(node.dataset.lm);
      for (const input of sectionInputs) {
        const section = imageSections[input.value];
        input.nextElementSibling.textContent = localized(section.label);
        input.parentElement.title = localized(section.details);
      }
      for (const [id, help] of Object.entries(controlHelp)) {
        const control = el(id);
        const target = control.matches("details") ? control.querySelector("summary") : control;
        target.title = localized(help);
      }
      const memory = el("memory");
      for (const option of memory.options) option.title = localized(stateHelp[option.value]);
      memory.title = localized(stateHelp[memory.value]);
      for (const card of comparisonCards) card.querySelector(".preview-text").title = localized(stateHelp.comparisonPreview);
      for (const id of numeric) el(id).placeholder = tr("modelDefault");
      el("tasks").setAttribute("aria-label", tr("task"));
      el("preset-load").setAttribute("aria-label", tr("loadPurpose"));
      el("system-load").setAttribute("aria-label", tr("loadSystem"));
      el("system-reset").setAttribute("aria-label", tr("resetSystem"));
      showPurposes(); showSystemPresets(); showModels(); controls(); renderDetailControls(); setMessage(message, messageModel);
    }
    async function refreshModels() {
      const seq = ++loadSeq;
      try {
        if (currentUrl === null) {
          const data = await call("lm/connection");
          if (seq !== loadSeq) return;
          currentUrl = data.url; el("url").value = currentUrl; el("url").readOnly = !data.editable;
        } else if (el("url").value.trim().replace(/\/+$/, "") !== currentUrl) {
          const reply = await call("lm/connection", json("PUT", {url: el("url").value}));
          if (seq !== loadSeq) return;
          currentUrl = reply.url; el("url").value = currentUrl;
        }
        const items = await call("lm/models");
        if (seq !== loadSeq) return;
        models = items; loaded = true; showModels();
        if (message === "lm_offline") setMessage("");
      } catch (error) {
        if (seq !== loadSeq) return;
        loaded = false; models = []; showModels(); setMessage(error.message);
      }
    }
    function select(value) {
      active = value; panel.classList.toggle("lm-active", active); controls();
      if (!active) return;
      void refreshModels();
      void refreshSystemPresets();
      void call("lm/library/presets").then(items => {
        presets = items;
        if (!userChangedPurpose && typeof prefs.purpose === "string" && prefs.purpose.startsWith("saved:")) {
          applyPurpose(prefs.purpose);
          userChangedPurpose = true;
        } else {
          showPurposes();
          controls();
        }
      }).catch(e => setMessage(e.message));
    }
    function options() {
      const data = {task:task()};
      for (const key of numeric) {
        const field = el(key);
        if (!field.checkValidity() || key === "top_p" && field.value !== "" && Number(field.value) <= 0) {
          field.focus(); throw Error("invalid_settings");
        }
        if (field.value !== "") data[key] = Number(field.value);
      }
      return data;
    }
    function generatedValue(key) {
      if (!resultItems) return null;
      const selected = visibleSections();
      const items = selected ? resultItems.filter(item => selected.includes(item.section)) : resultItems;
      return composeLM(items, key, formatPrompt.checked, resultTask);
    }
    function textAt(key) {
      const text = edits.get(editKey(key)) ?? generatedValue(key)?.text;
      if (text === undefined && resultText && analyzedSections && visibleSections().length !== analyzedSections.length) return "";
      if (text !== undefined || formatPrompt.checked) return text ?? resultText;
      return resultTask === "tags" ? splitPrompt(resultText).join(", ") : resultText.replace(/\s*[\r\n]+\s*/g, " ");
    }
    function renderDetailControls() {
      const current = visibleLevel();
      const hasItems = Boolean(resultItems?.length);
      const comparing = hasItems && prefs.comparison === true;
      outputLabel.hidden = comparing;
      el("result-resize").hidden = comparing;
      el("comparison").hidden = !comparing;
      el("comparison-resize").hidden = !comparing;
      const compare = el("compare");
      compare.disabled = !hasItems;
      compare.setAttribute("aria-pressed", String(comparing));
      compare.setAttribute("aria-expanded", String(comparing));
      compare.textContent = tr(comparing ? "closeCompare" : "compare");
      const availableHelp = comparing ? stateHelp.closeCompare : stateHelp.compare;
      const unavailableHelp = resultText ? stateHelp.single : stateHelp.compareWaiting;
      compare.title = localized(hasItems ? availableHelp : unavailableHelp);
      formatPrompt.title = formatPrompt.parentElement.title = localized(stateHelp.formatPrompt);
      levels.forEach((key, index) => {
        const selected = current === key;
        const levelButton = el("level-" + key);
        levelButton.disabled = Boolean(resultText) && !selected;
        levelButton.setAttribute("aria-pressed", String(selected));
        levelButton.title = localized(resultText ? stateHelp.single : stateHelp[key]);
        if (!comparing) return;
        const card = comparisonCards[index];
        card.classList.toggle("is-current", selected);
        card.firstElementChild.setAttribute("aria-pressed", String(selected));
        card.querySelector("p").textContent = textAt(key);
      });
    }
    function showOutput() {
      el("result").value = textAt(visibleLevel());
      renderSections();
      renderDetailControls();
      notify();
    }
    function changeOutput(result, kind, sections = null) {
      resultTask = kind;
      analyzedSections = sections;
      const grouped = Array.isArray(result.items) && (result.items.length > 0 || (sections && !result.text));
      resultItems = composeLM && grouped ? result.items : null;
      resultText = resultItems ? "" : result.text || "";
      edits.clear();
      showOutput();
    }
    function selectLevel(key) {
      level = key; prefs.level = key;
      savePrefs(); showOutput();
    }
    async function run() {
      if (busy) return;
      const mode = task(), input = el("idea").value, file = asset()?.file;
      const sections = mode === "expand" ? null : selectedSections(mode);
      if (sections && !sections.length) return;
      if (mode === "expand" && !input.trim()) { setMessage("lm_text"); el("idea").focus(); return; }
      if (mode !== "expand" && !file) { setMessage("lm_image"); byId("image-well").focus(); return; }
      const model = el("model").value;
      if (!model) { modelSettings.open = true; el("model").focus(); setMessage("lm_model"); return; }
      const snapshot = revision;
      try {
        releaseMessage = ""; memoryStatus();
        const settings = options();
        const usesStandard = !systemName && customSystem === null;
        const instruction = mode === "expand" ?
          [usesStandard ? "" : expandTask, expandLanguage[textOutputLanguage], preserveImageText].filter(Boolean).join(" ") :
          imageInstruction(mode, sections);
        const config = {...settings, system:el("system").value, instruction,
          model, memory:el("memory").value,
          text:mode === "expand" ? input : "", tiers:Boolean(composeLM)};
        if (sections) config.sections = sections;
        busy = true; controls(); notify(); setMessage("runningModel", model);
        const form = new FormData();
        form.append("config", JSON.stringify(config));
        if (mode !== "expand") form.append("image",file,file.name);
        const result = await call("lm/generate", {method:"POST",body:form});
        if (revision === snapshot) {
          changeOutput(result, mode, sections);
          setMessage(resultText ? "legacyResult" : "done", model);
        }
        else setMessage("");
        if (result.releaseError) releaseMessage = result.releaseError;
      } catch (e) { setMessage(e.message); }
      finally { busy = false; controls(); notify(); void refreshModels(); }
    }
    async function saveEntry(kind, data) {
      try { await call("lm/library/" + kind,json("POST",data)); }
      catch (e) {
        if (e.status !== 409) throw e;
        if (!confirm(tr("overwrite") + " " + data.name)) return false;
        await call("lm/library/" + kind,json("POST",{...data,overwrite:true}));
      }
      return true;
    }
    async function storePurpose() {
      const name = el("preset-name").value.trim();
      if (!name) { setMessage("lm_empty"); el("preset-name").focus(); return; }
      const before = revision;
      const preset = options();
      const previous = presets.find(item => item.name === name);
      if (previous?.instruction) preset.instruction = previous.instruction;
      if (!await saveEntry("presets", {name, preset})) return;
      presets = await call("lm/library/presets");
      if (revision === before) { userChangedPurpose = true; applyPurpose("saved:" + name); }
      else { showPurposes(); controls(); }
      setMessage("stored");
    }
    async function removePurpose() {
      const name = selectedPreset()?.name;
      if (!name || !confirm(tr("confirmDelete") + " " + name)) return;
      await call("lm/library/presets?name=" + encodeURIComponent(name), {method:"DELETE"});
      presets = await call("lm/library/presets");
      if (purpose === "saved:" + name) applyPurpose("default:" + task());
      else { showPurposes(); controls(); }
      setMessage("removed");
    }
    async function storeSystem() {
      if (!systemReady || systemBusy) return;
      const name = el("system-name").value.trim(), text = el("system").value;
      if (!name || !text.trim()) { setMessage("lm_empty"); el(name ? "system" : "system-name").focus(); return; }
      systemSeq++; systemBusy = true; showSystemPresets();
      try {
        if (!await saveEntry("systems", {name, system:{text}})) return;
        systemPresets = [...systemPresets.filter(item => item.name !== name), {name,text}]
          .sort((a,b) => a.name.localeCompare(b.name, undefined, {sensitivity:"base"}));
        systemName = name;
        el("system-name").value = name;
        saveSystemPrefs();
        setMessage("stored");
      } finally { systemBusy = false; showSystemPresets(); }
    }
    async function removeSystem() {
      if (!systemReady || systemBusy) return;
      const name = systemName;
      if (!name || !confirm(tr("confirmDelete") + " " + name)) return;
      systemSeq++; systemBusy = true; showSystemPresets();
      try {
        await call("lm/library/systems?name=" + encodeURIComponent(name), {method:"DELETE"});
        systemPresets = systemPresets.filter(item => item.name !== name);
        chooseSystem("");
        setMessage("removed");
      } finally { systemBusy = false; showSystemPresets(); }
    }
    const onClick = (id, fn) => el(id).addEventListener("click", () => Promise.resolve().then(fn).catch(e => setMessage(e.message)));
    onClick("run",run); onClick("refresh",() => { releaseMessage = ""; return refreshModels(); });
    onClick("unload",unload);
    el("memory").addEventListener("change", () => {
      const memory = el("memory");
      prefs.memory = memory.value;
      memory.title = localized(stateHelp[memory.value]);
      savePrefs();
    });
    function rememberDisclosure(details, key, onOpen) {
      details.open = prefs[key] === true;
      details.addEventListener("toggle", () => {
        const open = details.open;
        if (open === (prefs[key] === true)) return;
        prefs[key] = open;
        savePrefs();
        if (active && open) onOpen?.();
      });
    }
    rememberDisclosure(modelSettings, "modelSettingsOpen", () => {
      releaseMessage = "";
      void refreshModels();
    });
    rememberDisclosure(el("system-settings"), "systemSettingsOpen", () => {
      if (!systemReady) void refreshSystemPresets();
    });
    rememberDisclosure(generationSettings, "generationSettingsOpen");
    rememberDisclosure(sectionPanel, "analysisSectionsOpen");
    sectionPanel.addEventListener("change", () => {
      if (task() === "expand") return;
      const selected = sectionInputs.filter(input => input.checked).map(input => input.value);
      prefs.sectionsByTask = {...prefs.sectionsByTask, [task()]:selected};
      savePrefs(); showOutput();
    });
    onClick("preset-save",storePurpose); onClick("preset-delete",removePurpose);
    onClick("system-save",storeSystem); onClick("system-delete",removeSystem);
    onClick("preset-load",() => {
      if (!selectedPreset()) {
        delete prefs.samplingByModel?.[samplingScope()];
        savePrefs(); revision++; updateSampling(true); setMessage("presetReset"); return;
      }
      applyPurpose(purpose); setMessage("presetLoaded");
    });
    onClick("system-load",() => {
      if (!systemReady || systemBusy || !systemName) return;
      chooseSystem(systemName); setMessage("presetLoaded");
    });
    onClick("system-reset",() => {
      if (systemBusy) return;
      customSystem = null;
      chooseSystem(""); setMessage("presetReset");
    });
    for (const key of tasks) onClick("task-" + key,() => {
      if (key === task()) return;
      userChangedPurpose = true;
      applyPurpose("default:" + key); setMessage("");
    });
    for (const key of Object.keys(expandLanguage)) onClick("text-language-" + key,() => {
      if (textOutputLanguage === key) return;
      textOutputLanguage = key;
      prefs.textOutputLanguage = key;
      revision++;
      savePrefs(); controls();
    });
    onClick("compare",() => {
      if (!resultItems?.length) return;
      prefs.comparison = prefs.comparison !== true;
      savePrefs();
      renderDetailControls();
      if (!prefs.comparison) el("result").focus({preventScroll:true});
    });
    for (const key of levels) {
      onClick("level-" + key,() => selectLevel(key));
      onClick("compare-" + key,() => selectLevel(key));
    }
    formatPrompt.addEventListener("change", () => {
      prefs.formatted = formatPrompt.checked;
      savePrefs(); showOutput();
    });
    el("system-preset").addEventListener("change", () => chooseSystem(el("system-preset").value));
    el("purpose").addEventListener("change", () => { userChangedPurpose = true; applyPurpose(el("purpose").value); setMessage(""); });
    el("task").addEventListener("change", () => {
      revision++;
      if (!selectedPreset()) {
        purpose = "default:" + task(); prefs.purpose = purpose; savePrefs(); showPurposes();
      }
      showModels(); controls();
    });
    el("model").addEventListener("change", () => { revision++; prefs.model = el("model").value; releaseMessage = ""; updateSampling(); memoryStatus(); savePrefs(); });
    el("system").addEventListener("input", () => {
      revision++;
      if (!systemName) {
        const wasDefault = customSystem === null;
        customSystem = el("system").value;
        if (wasDefault) showSystemPresets();
      }
      saveSystemPrefs();
    });
    el("idea").addEventListener("input", () => { revision++; });
    el("result").addEventListener("input", () => {
      revision++; edits.set(editKey(visibleLevel()), el("result").value); notify();
    });
    for (const key of numeric) el(key).addEventListener("input", () => {
      revision++;
      const field = el(key);
      if (selectedPreset()) editedPresetFields.add(key);
      else if (el("model").value && field.checkValidity() && !(key === "top_p" && field.valueAsNumber <= 0)) {
        const scope = samplingScope();
        prefs.samplingByModel ??= {};
        prefs.samplingByModel[scope] = {...prefs.samplingByModel[scope], [key]: field.value};
        savePrefs();
      }
      updateSampling();
    });
    el("url").addEventListener("change", () => { revision++; void refreshModels(); });
    return {select,translate, busy:() => busy,
      assetChanged() {
        if (task() !== "expand") { revision++; changeOutput({text:""},task()); setMessage(""); }
        else if (analyzedSections) changeOutput({text:""},task());
      },
      value() {
        const key = visibleLevel();
        const original = !edits.has(editKey(key)) && generatedValue(key);
        if (original) return original;
        const text = el("result").value.trim();
        const isTags = resultTask === "tags";
        const formatted = isTags && /[\r\n]/.test(text);
        const tagLines = isTags ? splitPromptLines(text) : [];
        return {text, description:isTags ? "" : text, tagLines, formatted};
      }};
  };
})();
