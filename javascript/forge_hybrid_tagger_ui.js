/* Native Forge Neo tab controller. */
(() => {
  "use strict";
  const controlHelp = [
    ['[data-action="mode"][data-value="wd"]', "Analyze images with the WD tagger.", "WD で画像のタグを読み取ります。"],
    ['[data-action="mode"][data-value="pixai"]', "Analyze images with the PixAI tagger.", "PixAI で画像のタグを読み取ります。"],
    ['[data-action="mode"][data-value="lm"]', "Open local LM Studio image analysis and prompt expansion.", "ローカルの LM Studio で画像の解析や短文の補完を行います。"],
    ['[data-action="language"][data-value="en"]', "Display the Image Tagger interface in English.", "Image Tagger の画面を英語で表示します。"],
    ['[data-action="language"][data-value="ja"]', "Display the Image Tagger interface in Japanese.", "Image Tagger の画面を日本語で表示します。"],
    [".model-strip > summary", "Show model files, download status, and memory settings.", "モデルの保存先、ダウンロード状況、メモリ設定を表示します。"],
    ["#fhit-auto-download", "Download missing tagger files when you need them.", "解析に必要なモデルがなければ自動で取得します。"],
    ['[data-action="check-models"]', "Check which model files are available locally.", "必要なモデルファイルがそろっているか確認します。"],
    ["#fhit-memory-policy", "Choose when the analysis models are released from memory.", "解析モデルをメモリから解放するタイミングを選びます。"],
    ["#fhit-idle-seconds", "Set how long a model stays in memory after its last use.", "解析モデルを最後に使ってから解放するまでの秒数です。"],
    ["#fhit-unload", "Release loaded tagger and OCR models from memory.", "読み込まれているタグ付け・OCR モデルをメモリから解放します。"],
    ["#fhit-image-well", "Drop an image here, paste one, or choose a file.", "画像をドロップ、貼り付け、またはファイルから選びます。"],
    ['[data-action="choose"][data-i18n="chooseImage"]', "Choose a PNG, JPEG, or WebP reference image.", "参照画像を PNG、JPEG、WebP から選びます。"],
    ['[data-action="choose"][data-i18n="replace"]', "Choose a different reference image.", "参照画像を別のファイルに差し替えます。"],
    ["#fhit-edit-tags", "Edit the adopted tag list as text.", "採用タグの一覧をテキストで編集します。"],
    ["#fhit-new-tag", "Enter a tag to add to the prompt.", "プロンプトに追加するタグを入力します。"],
    ["#fhit-add-tag", "Add the typed tag to the adopted list.", "入力したタグを採用一覧に追加します。"],
    ["#fhit-tag-text", "Edit the tags as a comma-separated list.", "カンマで区切ってタグを編集します。"],
    ['[data-action="apply-tags"]', "Apply the edited tag list to the prompt.", "編集したタグ一覧をプロンプトに反映します。"],
    ['[data-action="cancel-tags"]', "Close the tag editor and discard these edits.", "この編集を取り消してタグ編集を閉じます。"],
    ['summary:has([data-i18n="candidates"])', "Show tags you can add to the prompt.", "プロンプトに追加できるタグ候補を表示します。"],
    ["#fhit-search-tags", "Filter candidate tags by name.", "候補タグを名前で絞り込みます。"],
    ["#fhit-category-filter", "Show only candidate tags in the selected category.", "選んだカテゴリの候補タグだけを表示します。"],
    ['[data-action="format"][data-value="tags"]', "Use the adopted tags as the output.", "採用タグを出力します。"],
    ['[data-action="format"][data-value="mixed"]', "Combine tags with a description.", "タグと説明文を組み合わせて出力します。"],
    ['[data-action="format"][data-value="description"]', "Use the description as the output.", "説明文を出力します。"],
    ['[data-action="level"][data-value="standard"]', "Use the main tags and recognizable details.", "主なタグと特徴を出力します。"],
    ['[data-action="level"][data-value="detailed"]', "Include more detected appearance and scene details.", "外見や情景のタグを標準より多く含めます。"],
    ["#fhit-single-preview .preview-text", "Read the prompt that will be copied or sent.", "コピーや送信に使うプロンプトを確認できます。"],
    ["#fhit-description-title", "Open the editor for the description at the selected detail level.", "選択中の詳しさで使う説明文の編集欄を開きます。"],
    ["#fhit-description-text", "Edit the description used in the output.", "出力に使う説明文を編集します。"],
    ['[data-action="reset-description"]', "Replace the edited description with one built from the tags.", "タグから説明文を作り直します。"],
    ["#fhit-copy", "Copy the currently selected prompt to the clipboard.", "選択中のプロンプトをクリップボードにコピーします。"],
    ["#fhit-send-txt", "Send the selected prompt to the Positive field in txt2img.", "選択中のプロンプトを txt2img の Positive 欄に送ります。"],
    ["#fhit-send-img", "Send the selected prompt to the Positive field in img2img.", "選択中のプロンプトを img2img の Positive 欄に送ります。"],
    [".advanced > summary", "Show analysis device and tag detection thresholds.", "解析デバイスとタグ検出の閾値を表示します。"],
    ["#fhit-device", "Choose automatic selection, CPU, or CUDA for tag analysis.", "タグ解析に使うデバイスを自動・CPU・CUDA から選びます。"],
    ["#fhit-p-general, #fhit-w-general", "Set the minimum confidence for adopting general tags.", "一般タグを採用する最低スコアを設定します。"],
    ["#fhit-p-character, #fhit-w-character", "Set the minimum confidence for adopting character names.", "キャラクター名のタグを採用する最低スコアを設定します。"],
    ['[data-action="reset-thresholds"]', "Restore the default general and character thresholds.", "一般タグとキャラクター名の閾値を初期値に戻します。"]
  ];
  const actionHelp = {
    analyze: ["Analyze the reference image with the selected tagger.", "選択中のタガーで参照画像を解析します。"],
    cancel: ["Cancel the current analysis.", "実行中の解析を取り消します。"],
    downloadAnalyze: ["Download the required tagger files and start analysis.", "必要なモデルファイルを取得してから解析します。"],
    openCompare: ["Compare all three detail levels from the current result.", "同じ解析結果を3段階の詳しさで比較します。"],
    closeCompare: ["Return to the single prompt preview.", "通常のプロンプト欄に戻ります。"],
    pickLevel: ["Use this detail level for copying and sending.", "この詳しさのプロンプトをコピー・送信に使います。"],
    readPrompt: ["Read the prompt at this detail level.", "この詳しさのプロンプトを確認できます。"],
    more: ["Show more entries in this list.", "一覧の続きを表示します。"],
    adopt: ["Add this candidate tag to the prompt.", "この候補タグをプロンプトに追加します。"],
    openFolder: ["Open this model's folder on this computer.", "このモデルの保存先を開きます。"],
    download: ["Download the model files needed for analysis.", "解析に必要なモデルファイルを取得します。"],
    retry: ["Retry downloading the model files.", "モデルファイルのダウンロードをやり直します。"],
    deleteModel: ["Remove this tagger's installed model files.", "このタガーのインストール済みモデルファイルを削除します。"],
    deleteLocalCopy: ["Remove this tagger's local copy.", "このタガーのローカルコピーを削除します。"]
  };
  const translations = {
    "en": {
      "mode": "Mode",
      "language": "Display language",
      "batch": "Folder batch",
      "batchChoose": "Choose image folder",
      "batchDestination": "Choose save folder",
      "batchSameFolder": "Same as images",
      "batchReset": "Use image folder",
      "batchStart": "Save .txt files",
      "batchStop": "Stop",
      "batchRules": "Common tags and saving",
      "batchPrefix": "Add before detected tags",
      "batchPrefixHint": "e.g. trigger_name, blue hair",
      "batchExclude": "Exclude tags",
      "batchExcludeHint": "e.g. watermark, signature",
      "batchAdded": "{n} added",
      "batchExcluded": "{n} excluded",
      "batchReplacing": "Replace existing",
      "batchReplace": "Replace existing .txt files",
      "batchReplaceHint": "Existing text will be replaced after you confirm.",
      "batchConfirmReplace": "Replace {n} existing .txt files with the new output?",
      "batchPreview": "Try 3",
      "batchPreviewTitle": "Preview before saving",
      "batchPreviewDone": "Preview complete",
      "batchPreviewEmpty": "No files to preview with these save settings.",
      "batchPreviewed": "{n} previewed",
      "batchReused": "{n} analyses reused",
      "batchSavingOptions": "Saving options",
      "batchImageCount": "{n} images",
      "lm_connection_changed": "The LM Studio server changed. Start the batch again.",
      "batchNoPrompt": "No prompt at the selected level for this image.",
      "batchReview": "View results",
      "batchClose": "Close",
      "batchFilter": "Filter by filename or exact tag",
      "batchSelectImage": "Select image",
      "batchCaption": "Saved text or trial output",
      "batchSaveEdit": "Save changes",
      "batchReviewCount": "{shown} of {total} images",
      "batchNoMatches": "No matching images.",
      "batchNoSaved": "No images with matching .txt files.",
      "batchFiltering": "Finding matching images",
      "batchEditSaved": "Changes saved.",
      "batchReadPermission": "Allow access to the save folder to read its files.",
      "batchCaptionChanged": "This file changed. Open the results again before saving.",
      "batchDiscardEdits": "Close and discard unsaved edits?",
      "batchHint": "Existing .txt files are skipped.",
      "batchFormatted": "Grouped",
      "batchUnsupported": "Open Forge on localhost or HTTPS in a browser with folder access, such as Edge or Chrome.",
      "batchIssues": "View issues",
      "batchMoreIssues": "{n} more entries",
      "batchScanning": "Scanning folder",
      "batchReading": "Reading image",
      "batchWriting": "Saving text",
      "batchStopping": "Stopping",
      "batchStopped": "Stopped",
      "batchDone": "Finished",
      "batchEmpty": "No PNG, JPEG or WebP images in this folder.",
      "batchSaved": "{n} saved",
      "batchSkipped": "{n} skipped",
      "batchFailed": "{n} failed",
      "batchPermission": "Allow write access to the save folder.",
      "batchFolderError": "Could not open the folder. Choose it again.",
      "batchDestinationError": "Could not open the save folder. Choose it again.",
      "batchCollision": "Multiple images match the same .txt name.",
      "batchNoDescription": "No description could be made from the detected tags.",
      "batchReadError": "Could not read this file.",
      "batchAnalyzeError": "Could not finish analysis. Try again.",
      "batchWriteError": "Could not save this .txt file.",
      "models": "Models",
      "ready": "Ready",
      "autoDownload": "Auto-download",
      "image": "Reference image",
      "ocrSpeech": "Text & Dialogue",
      "ocrAuto": "Read automatically",
      "ocrCrop": "Read selected area",
      "ocrManual": "Enter text",
      "ocrLocation": "Draw position",
      "ocrInferSpeakers": "Infer speakers",
      "ocrSpeaker": "Speaker",
      "ocrSpeakerCandidate": "Candidate: {person}",
      "ocrSpeakerUnset": "Unspecified",
      "ocrSpeakerOffscreen": "Off-screen",
      "ocrSpeakerChoose": "Choose on image",
      "ocrSpeakerDraw": "Draw person",
      "ocrSpeakerRedraw": "Redraw person",
      "ocrSpeakerPickHint": "Select a numbered person on the image.",
      "ocrSpeakerDragHint": "Drag a box around the person.",
      "ocrSpeakerCount": "{n} speaker candidates",
      "ocrSpeakerNone": "No speaker candidates. You can select or draw a person.",
      "ocrSpeakerFailed": "Speaker inference failed. You can still set speakers manually.",
      "ocr_speaker_loading": "Loading speaker model",
      "ocr_speaker_infer": "Inferring speakers",
      "ocr_speaker_runtime": "The speaker model could not start.",
      "ocrPerson": "Person {n} ({side})",
      "ocrPersonMarker": "P{n}",
      "ocrSideLeft": "left",
      "ocrSideCenter": "center",
      "ocrSideRight": "right",
      "ocrCanvas": "Generation size",
      "ocrWidth": "Width",
      "ocrHeight": "Height",
      "ocrLayoutClose": "Close",
      "ocrLayoutPreview": "Layout JSON",
      "ocrLayoutSave": "Save JSON",
      "ocrLayoutSaved": "JSON downloaded",
      "ocrLayoutSize": "Width and height must be positive multiples of 16.",
      "ocrLayoutRounded": "Source {original}. Suggested canvas {canvas}.",
      "ocrLayoutAspect": "The new aspect ratio changes the shape of the boxes.",
      "ocrLayoutMissing": "Draw a position for: {rows}.",
      "ocrLayoutPending": "{n} lines will be exported with unspecified speakers.",
      "ocrAdoptAll": "Use all",
      "ocrUse": "Use",
      "ocrUseFree": "Use outside text",
      "ocrFreeText": "Outside text",
      "ocrMoveUp": "Move up",
      "ocrMoveDown": "Move down",
      "ocrRemove": "Remove reading",
      "ocrUsedCount": "{n} used",
      "ocrReadCount": "{n} readings",
      "ocrNothing": "No text detected. You can select an area to read.",
      "ocrDrag": "Drag over the area you want to read.",
      "ocrDragLocation": "Drag over the dialogue position.",
      "ocrManga": "Manga OCR",
      "ocrDetector": "Bubble detector",
      "ocrMissing": "Not downloaded",
      "ocrFailed": "Could not read the image text.",
      "ocr_preparing": "Preparing model",
      "ocr_detecting": "Detecting text and speech bubbles",
      "ocr_loading": "Loading Manga OCR",
      "ocr_reading": "Reading text",
      "ocr_bad_box": "Select an area inside the image.",
      "ocr_runtime_missing": "The Manga OCR runtime could not start.",
      "ocr_gpu_busy": "CUDA is busy",
      "dropImage": "Drop or paste an image",
      "chooseImage": "Choose image",
      "replace": "Replace",
      "clearImage": "Remove image",
      "analyze": "Analyze",
      "analyzeCharacter": "Character Only",
      "analyzeCharacterHint": "Extract visible appearance, clothing, and accessories.",
      "characterScope": "Character only",
      "activityProgress": "Processing progress",
      "cancel": "Cancel",
      "analyzing": "Analyzing",
      "imageRequired": "Choose an image to start.",
      "unsupported": "Choose a PNG, JPEG or WebP image that can be opened.",
      "stale": "Analyze to get results for this model and device.",
      "adopted": "Adopted tags",
      "editTags": "Edit as text",
      "tagPlaceholder": "Add a tag",
      "add": "Add",
      "apply": "Apply",
      "remove": "Remove",
      "candidates": "Candidates",
      "all": "All",
      "noCandidates": "No candidates to show.",
      "format": "Output format",
      "tags": "Tags",
      "mixed": "Tags + Description",
      "description": "Description",
      "formatPrompt": "Group prompt by subject",
      "formatPromptHint": "Separate people, outfits, actions and settings into lines in the preview, copy, send and folder output.",
      "compare": "Compare prompts",
      "closeCompare": "Close comparison",
      "level": "Detail level",
      "standard": "Standard",
      "detailed": "Detailed",
      "full": "Full",
      "fullHint": "Include additional visual details from the detected scores",
      "fullOnly": "Included at Full level",
      "previousResult": "Previous result",
      "cuda_memory": "Not enough free VRAM",
      "cuda_oom": "CUDA ran out of memory",
      "resizePanels": "Resize the image and tags panels",
      "resizeImage": "Resize the image preview",
      "resizeOutput": "Resize the output preview vertically",
      "resizeLMResult": "Resize the generated prompt vertically",
      "resizeLMComparison": "Resize all prompt comparison columns vertically",
      "memory": "Model memory",
      "unloadAfter": "Unload after analysis",
      "unloadIdle": "Unload after idle",
      "keepLoaded": "Keep loaded",
      "unloadNow": "Unload now",
      "idleSeconds": "Idle time in seconds",
      "seconds": "sec",
      "noSession": "No models loaded",
      "sessionLoaded": "Loaded",
      "sessionReused": "Model reused",
      "sessionActive": "Analyzing",
      "sessionIdle": "Unload in",
      "pendingRelease": "Unloading after the current analysis",
      "releaseManual": "Models unloaded",
      "releaseIdle": "Unloaded after idle",
      "releaseForge": "Unloaded for Forge generation",
      "releasePressure": "Unloaded to free VRAM",
      "sessionError": "Could not update model memory status.",
      "preview": "Preview",
      "empty": "The output will appear here.",
      "selected": "Selected",
      "using": "Using",
      "tagsOnly": "Tags only",
      "descriptionOnly": "Description only",
      "fromTags": "From tags",
      "edited": "Manually edited",
      "checkEdited": "Tags changed. Review the edited description.",
      "rebuild": "Rebuild from tags",
      "copy": "Copy",
      "copied": "Copied.",
      "copyError": "Select the output text to copy it manually.",
      "sendTxt": "Send to txt2img",
      "sendImg": "Send to img2img",
      "sendMode": "How to send to Positive",
      "sendAdd": "Add",
      "sendReplace": "Replace",
      "sendAddHint": "Append to the existing Positive prompt",
      "sendReplaceHint": "Replace the entire Positive prompt",
      "appended": "Appended to Positive.",
      "replaced": "Replaced the Positive prompt.",
      "already": "Already in Positive.",
      "advanced": "Advanced",
      "device": "Analysis device",
      "auto": "Auto",
      "waiting": "Analyze an image to see its tags.",
      "both": "PixAI + WD",
      "manual": "Manually selected",
      "checkModels": "Check files",
      "checking": "Checking",
      "missing": "Not downloaded",
      "incomplete": "File missing",
      "downloading": "Downloading",
      "verifying": "Verifying",
      "download_failed": "Download failed",
      "verification_failed": "Verification failed",
      "download": "Download",
      "retry": "Retry",
      "downloadAnalyze": "Download & Analyze",
      "shared": "Shared",
      "search": "Search tags",
      "category": "Category",
      "general": "General",
      "character": "Character",
      "style": "Style",
      "copyright": "Series",
      "meta": "Meta",
      "rating": "Rating",
      "more": "Show more",
      "model_needed": "Download the selected model in Models.",
      "runtime_missing": "Install a compatible ONNX Runtime in the Forge environment.",
      "cuda_unavailable": "CUDA execution is unavailable in this Forge environment.",
      "analysis_failed": "Analysis failed. See the Forge console for details.",
      "incompatible_model": "The model's input or output does not match its specification.",
      "bad_image": "This image could not be read.",
      "image_size": "This image exceeds the supported upload or pixel size.",
      "transparent_image": "The image is completely transparent.",
      "animated_image": "Choose a still image.",
      "busy": "The analysis queue is full. Try again when it clears.",
      "expired": "This analysis expired. Analyze again.",
      "queued": "Waiting for analysis",
      "waiting_gpu": "Waiting for GPU",
      "cancelled": "Analysis cancelled",
      "done": "Ready for output",
      "disk_space": "Not enough disk space",
      "status_error": "Could not check model files.",
      "downloadPath": "Download location",
      "sharedPath": "Shared model location",
      "openFolder": "Open folder",
      "deleteModel": "Delete",
      "deleteLocalCopy": "Delete local copy",
      "deleteQuestion": "Delete the local model files?",
      "deleteRecovery": "You can download this model again.",
      "modelRemoved": "Local files deleted.",
      "modelAlreadyMissing": "The local files are already missing.",
      "model_busy": "Wait for analysis or download to finish before deleting.",
      "model_path_protected": "This location is protected from changes.",
      "model_management_local": "Manage model files from the computer running Forge.",
      "model_folder_error": "Could not open this folder.",
      "model_delete_error": "Some model files could not be deleted.",
      "network": "Could not connect to Image Tagger.",
      "cannotSend": "The Forge Positive prompt field could not be found.",
      "resetThresholds": "Reset thresholds",
      "noVocabulary": "Not in vocabulary",
      "belowThreshold": "Below threshold",
      "cpuFallback": "CPU fallback",
      "cache": "cached",
      "noRuntime": "ONNX Runtime is unavailable."
    },
    "ja": {
      "mode": "解析モード",
      "language": "表示言語",
      "batch": "フォルダー一括",
      "batchChoose": "画像フォルダーを選ぶ",
      "batchDestination": "保存先を選ぶ",
      "batchSameFolder": "画像と同じ場所",
      "batchReset": "同じ場所に戻す",
      "batchStart": ".txt を保存",
      "batchStop": "停止",
      "batchRules": "共通タグと保存設定",
      "batchPrefix": "タグの先頭に追加",
      "batchPrefixHint": "例  trigger_name, blue hair",
      "batchExclude": "除外するタグ",
      "batchExcludeHint": "例  watermark, signature",
      "batchAdded": "追加 {n} 件",
      "batchExcluded": "除外 {n} 件",
      "batchReplacing": "既存を更新",
      "batchReplace": "既存の .txt を更新",
      "batchReplaceHint": "確認後、既存の .txt を書き換えます。",
      "batchConfirmReplace": "既存の .txt {n} 件を新しい出力で更新しますか？",
      "batchPreview": "3枚で試す",
      "batchPreviewTitle": "書き出し前のプレビュー",
      "batchPreviewDone": "試し出力が完了",
      "batchPreviewEmpty": "この保存設定で試せる画像がありません。",
      "batchPreviewed": "プレビュー {n} 件",
      "batchReused": "解析結果を再利用 {n} 件",
      "batchSavingOptions": "保存設定",
      "batchImageCount": "{n} 枚",
      "lm_connection_changed": "LM Studioの接続先が変わりました。バッチを再開してください。",
      "batchNoPrompt": "この画像では選択した詳しさの出力が空でした。",
      "batchReview": "結果を見る",
      "batchClose": "閉じる",
      "batchFilter": "ファイル名・タグで絞り込む",
      "batchSelectImage": "画像を選ぶ",
      "batchCaption": "保存したテキストまたは試し出力",
      "batchSaveEdit": "変更を保存",
      "batchReviewCount": "{shown} / {total} 枚",
      "batchNoMatches": "一致する画像がありません。",
      "batchNoSaved": "対応する .txt がある画像がありません。",
      "batchFiltering": "画像を絞り込み中",
      "batchEditSaved": "変更を保存しました。",
      "batchReadPermission": "保存先のファイルを読み込むには、フォルダーへのアクセスを許可してください。",
      "batchCaptionChanged": "ファイルが変更されています。結果を開き直してから保存してください。",
      "batchDiscardEdits": "未保存の変更を破棄して閉じますか？",
      "batchHint": "既存の .txt はスキップします。",
      "batchFormatted": "整形あり",
      "batchUnsupported": "Edge や Chrome など、フォルダーへの書き込みに対応したブラウザーで、ローカルの Forge または HTTPS を開いてください。",
      "batchIssues": "内訳を表示",
      "batchMoreIssues": "ほか {n} 件",
      "batchScanning": "フォルダーを確認中",
      "batchReading": "画像を読み込み中",
      "batchWriting": "テキストを保存中",
      "batchStopping": "停止処理中",
      "batchStopped": "停止しました",
      "batchDone": "完了",
      "batchEmpty": "このフォルダーに PNG・JPEG・WebP の画像がありません。",
      "batchSaved": "保存 {n} 件",
      "batchSkipped": "スキップ {n} 件",
      "batchFailed": "失敗 {n} 件",
      "batchPermission": "保存先フォルダーへの書き込みを許可してください。",
      "batchFolderError": "フォルダーを開けませんでした。選び直してください。",
      "batchDestinationError": "保存先フォルダーを開けませんでした。選び直してください。",
      "batchCollision": "同じ .txt 名になる画像が複数あります。",
      "batchNoDescription": "検出タグから説明文を作れませんでした。",
      "batchReadError": "ファイルを読み込めませんでした。",
      "batchAnalyzeError": "解析を完了できませんでした。再試行してください。",
      "batchWriteError": ".txt を保存できませんでした。",
      "models": "モデル",
      "ready": "準備完了",
      "autoDownload": "自動ダウンロード",
      "image": "参照画像",
      "ocrSpeech": "文字・セリフ",
      "ocrAuto": "自動で読む",
      "ocrCrop": "囲って読む",
      "ocrManual": "手入力",
      "ocrLocation": "位置を囲む",
      "ocrInferSpeakers": "話者を推定",
      "ocrSpeaker": "話者",
      "ocrSpeakerCandidate": "候補：{person}",
      "ocrSpeakerUnset": "未指定",
      "ocrSpeakerOffscreen": "画面外",
      "ocrSpeakerChoose": "画像で選ぶ",
      "ocrSpeakerDraw": "人物を囲む",
      "ocrSpeakerRedraw": "人物枠を直す",
      "ocrSpeakerPickHint": "画像上の番号を目印に人物を選んでください。",
      "ocrSpeakerDragHint": "画像上で人物をドラッグして囲んでください。",
      "ocrSpeakerCount": "話者候補 {n} 件",
      "ocrSpeakerNone": "話者候補が見つかりませんでした。人物を選ぶか、囲って指定できます。",
      "ocrSpeakerFailed": "話者を推定できませんでした。手動で指定できます。",
      "ocr_speaker_loading": "話者モデルを読み込み中",
      "ocr_speaker_infer": "話者を推定中",
      "ocr_speaker_runtime": "話者推定の実行環境を起動できませんでした。",
      "ocrPerson": "人物 {n}（{side}）",
      "ocrPersonMarker": "人{n}",
      "ocrSideLeft": "左",
      "ocrSideCenter": "中央",
      "ocrSideRight": "右",
      "ocrCanvas": "生成サイズ",
      "ocrWidth": "幅",
      "ocrHeight": "高さ",
      "ocrLayoutClose": "閉じる",
      "ocrLayoutPreview": "レイアウト JSON",
      "ocrLayoutSave": "JSON を保存",
      "ocrLayoutSaved": "JSON をダウンロードしました",
      "ocrLayoutSize": "幅と高さは正の16の倍数にしてください。",
      "ocrLayoutRounded": "元画像 {original}。生成サイズの候補は {canvas} です。",
      "ocrLayoutAspect": "縦横比が異なるため、枠の縦横比も変わります。",
      "ocrLayoutMissing": "位置を囲んでください（{rows}）。",
      "ocrLayoutPending": "未確定の話者 {n} 件は話者を指定せずに出力します。",
      "ocrAdoptAll": "まとめて採用",
      "ocrUse": "採用",
      "ocrUseFree": "枠外の文字を採用",
      "ocrFreeText": "枠外の文字",
      "ocrMoveUp": "上へ移動",
      "ocrMoveDown": "下へ移動",
      "ocrRemove": "候補を削除",
      "ocrUsedCount": "採用 {n} 件",
      "ocrReadCount": "読み取り {n} 件",
      "ocrNothing": "文字が見つかりませんでした。範囲を囲って読み取れます。",
      "ocrDrag": "画像上で読みたい範囲をドラッグしてください。",
      "ocrDragLocation": "画像上でセリフの位置をドラッグして囲んでください。",
      "ocrManga": "Manga OCR",
      "ocrDetector": "吹き出し検出器",
      "ocrMissing": "未取得",
      "ocrFailed": "文字を読み取れませんでした。",
      "ocr_preparing": "モデルを準備中",
      "ocr_detecting": "文字と吹き出しを検出中",
      "ocr_loading": "Manga OCR を読み込み中",
      "ocr_reading": "文字を読み取り中",
      "ocr_bad_box": "画像内で読みたい範囲を囲んでください。",
      "ocr_runtime_missing": "Manga OCR の実行環境を起動できませんでした。",
      "ocr_gpu_busy": "CUDA は使用中",
      "dropImage": "画像をドロップまたは貼り付け",
      "chooseImage": "画像を選ぶ",
      "replace": "差し替え",
      "clearImage": "画像を外す",
      "analyze": "解析",
      "analyzeCharacter": "キャラクターだけ解析",
      "analyzeCharacterHint": "顔・髪・服装・身につけた小物を抽出します。",
      "characterScope": "キャラクターのみ",
      "activityProgress": "処理の進捗",
      "cancel": "取消",
      "analyzing": "解析中",
      "imageRequired": "画像を選んでください。",
      "unsupported": "開ける PNG、JPEG、WebP 画像を選んでください。",
      "stale": "このモードとデバイスの結果を表示するには「解析」を押してください。",
      "adopted": "採用タグ",
      "editTags": "テキストで編集",
      "tagPlaceholder": "タグを追加",
      "add": "追加",
      "apply": "反映",
      "remove": "削除",
      "candidates": "候補",
      "all": "すべて",
      "noCandidates": "表示する候補がありません。",
      "format": "出力形式",
      "tags": "タグ",
      "mixed": "タグ＋説明文",
      "description": "説明文",
      "formatPrompt": "読みやすく整形",
      "formatPromptHint": "人物・服装・動作・情景などを改行で分けます。プレビュー、コピー、送信、一括保存に適用されます。",
      "compare": "プロンプト比較",
      "closeCompare": "比較を閉じる",
      "level": "詳しさ",
      "standard": "標準",
      "detailed": "詳細",
      "full": "最詳細",
      "fullHint": "検出スコアの範囲を広げて描写を追加する",
      "fullOnly": "最詳細で追加",
      "previousResult": "前回の結果",
      "cuda_memory": "空き VRAM 不足",
      "cuda_oom": "CUDA メモリ不足",
      "resizePanels": "画像欄とタグ欄の幅を調整",
      "resizeImage": "画像のサイズを調整",
      "resizeOutput": "出力プレビューの高さを調整",
      "resizeLMResult": "生成プロンプトの高さを調整",
      "resizeLMComparison": "プロンプト比較欄の高さをまとめて調整",
      "memory": "モデルの保持",
      "unloadAfter": "解析後に解放",
      "unloadIdle": "時間で解放",
      "keepLoaded": "保持する",
      "unloadNow": "今すぐ解放",
      "idleSeconds": "解放までの秒数",
      "seconds": "秒",
      "noSession": "モデルは未ロード",
      "sessionLoaded": "保持中",
      "sessionReused": "モデル再利用",
      "sessionActive": "解析中",
      "sessionIdle": "解放まで",
      "pendingRelease": "解析終了後に解放します",
      "releaseManual": "モデルを解放しました",
      "releaseIdle": "無操作時間で解放しました",
      "releaseForge": "Forge の生成前に解放しました",
      "releasePressure": "VRAM を確保するため解放しました",
      "sessionError": "モデルの保持状態を確認できませんでした。",
      "preview": "出力プレビュー",
      "empty": "ここに出力が表示されます。",
      "selected": "選択中",
      "using": "出力対象",
      "tagsOnly": "タグのみ",
      "descriptionOnly": "説明文のみ",
      "fromTags": "タグから作成",
      "edited": "編集済み",
      "checkEdited": "タグを変更しました。編集済みの説明文を確認してください。",
      "rebuild": "タグから作り直す",
      "copy": "コピー",
      "copied": "コピーしました。",
      "copyError": "出力テキストを選択してコピーしてください。",
      "sendTxt": "txt2img に送る",
      "sendImg": "img2img に送る",
      "sendMode": "Positive への送信方法",
      "sendAdd": "追記",
      "sendReplace": "置換",
      "sendAddHint": "既存の Positive の末尾に追加",
      "sendReplaceHint": "Positive の内容をすべて置き換える",
      "appended": "Positive に追記しました。",
      "replaced": "Positive を置き換えました。",
      "already": "Positive に含まれています。",
      "advanced": "詳細設定",
      "device": "解析デバイス",
      "auto": "自動",
      "waiting": "画像を解析するとタグが表示されます。",
      "both": "PixAI ＋ WD",
      "manual": "手動で採用",
      "checkModels": "ファイルを再確認",
      "checking": "確認中",
      "missing": "未取得",
      "incomplete": "ファイル不足",
      "downloading": "ダウンロード中",
      "verifying": "検証中",
      "download_failed": "取得失敗",
      "verification_failed": "検証失敗",
      "download": "ダウンロード",
      "retry": "再試行",
      "downloadAnalyze": "取得して解析",
      "shared": "共有",
      "search": "タグを検索",
      "category": "カテゴリ",
      "general": "一般",
      "character": "キャラクター",
      "style": "画風",
      "copyright": "作品",
      "meta": "メタ",
      "rating": "レーティング",
      "more": "さらに表示",
      "model_needed": "モデル欄で選択したモデルをダウンロードしてください。",
      "runtime_missing": "Forge の環境に対応する ONNX Runtime を導入してください。",
      "cuda_unavailable": "この Forge 環境では CUDA で解析できません。",
      "analysis_failed": "解析に失敗しました。詳しくは Forge のコンソールを確認してください。",
      "incompatible_model": "モデルの入出力が仕様と一致しません。",
      "bad_image": "この画像を開けません。",
      "image_size": "対応するファイルサイズまたは画素数の上限を超えています。",
      "transparent_image": "画像が完全に透明です。",
      "animated_image": "静止画を選んでください。",
      "busy": "解析の待機枠が埋まっています。処理が終わってから再試行してください。",
      "expired": "解析結果の有効期間が過ぎました。再度解析してください。",
      "queued": "解析待ち",
      "waiting_gpu": "GPU 待ち",
      "cancelled": "解析を取り消しました",
      "done": "出力できます",
      "disk_space": "空き容量が不足しています",
      "status_error": "モデルの状態を確認できませんでした。",
      "downloadPath": "ダウンロード先",
      "sharedPath": "読み込み先（共有）",
      "openFolder": "フォルダーを開く",
      "deleteModel": "削除",
      "deleteLocalCopy": "ローカルコピーを削除",
      "deleteQuestion": "ローカルのモデルファイルを削除しますか？",
      "deleteRecovery": "削除後は再ダウンロードできます。",
      "modelRemoved": "ローカルのファイルを削除しました。",
      "modelAlreadyMissing": "ローカルに削除できるファイルはありません。",
      "model_busy": "解析またはダウンロードが完了してから削除してください。",
      "model_path_protected": "この場所のファイルは変更できません。",
      "model_management_local": "モデルの管理は Forge を起動している PC で行えます。",
      "model_folder_error": "フォルダーを開けませんでした。",
      "model_delete_error": "削除できなかったモデルファイルがあります。",
      "network": "Image Tagger に接続できませんでした。",
      "cannotSend": "Forge の Positive 入力欄が見つかりません。",
      "resetThresholds": "閾値を初期値に戻す",
      "noVocabulary": "語彙なし",
      "belowThreshold": "閾値未満",
      "cpuFallback": "CPUに切替",
      "cache": "再利用",
      "noRuntime": "ONNX Runtime を利用できません。"
    }
  };

  function mount(panel, C) {
    const byId = id => panel.querySelector("#fhit-" + id);
    const {pixai, wd} = C.modes;
    const modelNames = {[pixai]: "PixAI", [wd]: "WD", "manga-ocr": "Manga OCR",
      "bubble-detector": "Bubble detector", "magi-v2": "MAGI v2"};
    const thresholdDefaults = {p: {general: 0.17, character: 0.27}, w: {general: 0.35, character: 0.85}};
    const activeModels = new Set(["checking", "downloading", "verifying"]);
    const maxVisible = 120;
    const api = location.pathname.replace(/\/+$/, "") + "/forge-hybrid-image-tagger/v1/";
    const storageKey = "forge-hybrid-tagger-v1:" + api;
    let preferences = {};
    try { preferences = JSON.parse(localStorage.getItem(storageKey) || "{}") || {}; } catch {}
    const option = (name, values, fallback) => values.includes(preferences[name]) ? preferences[name] : fallback;
    const formats = ["tags", "mixed", "description"];
    const newTagDraft = () => ({manual: new Map(), excluded: new Set(), order: null, revision: 0});
    const newDrafts = () => ({image: newTagDraft(), character: newTagDraft()});
    const state = {
      language: option("language", ["en", "ja"], "en"),
      mode: option("mode", Object.keys(C.modes), "wd"),
      lmActive: preferences.lmActive === true && Boolean(byId("lm-run") && window.forgeHybridTaggerLM),
      format: option("format", formats, "tags"),
      sendMode: option("sendMode", ["append", "replace"], "append"),
      batchFormat: option("batchFormat", formats, "tags"),
      formatted: preferences.formatted === true,
      level: preferences.level === "simple" ? "standard" : option("level", C.levels, "detailed"),
      device: option("device", ["auto", "cpu", "cuda"], "auto"),
      auto: preferences.auto !== false,
      thresholds: {p: {...thresholdDefaults.p}, w: {...thresholdDefaults.w}},
      sizes: {...preferences.sizes},
      sessions: null, sessionError: false, sessionPending: false, sessionRequest: 0, sessionTimer: null,
      models: {}, modelError: null, runtime: null, transferPending: new Set(),
      deletingModels: new Set(), modelNotice: null, analysisBusy: false, manageLocal: false,
      statusTask: null, statusTimer: null, asset: null, imageVersion: 0,
      displayed: null, job: null, jobStatus: null, analysisError: null, ocrProgress: null,
      comparison: preferences.comparison === true, tagVersion: 0, drafts: newDrafts(),
      captions: new Map(), tagEdit: null, actionStatus: "",
      visibleTags: maxVisible, visibleCandidates: maxVisible,
      detected: {adopted: [], full: [], candidates: [], byKey: new Map()}
    };

    const msg = key => translations[state.language][key] || key;
    const escapeHtml = value => String(value).replace(/[&<>"']/g, c =>
      ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"})[c]);
    const actionHint = key => actionHelp[key][state.language === "ja" ? 1 : 0];
    const titleAttr = key => ' title="' + escapeHtml(actionHint(key)) + '"';
    const ready = () => Boolean(state.asset && state.displayed);
    const currentResult = () => ready() && state.displayed.mode === state.mode && state.displayed.device === state.device;
    const resultScope = () => state.displayed?.scope ?? "image";
    const characterOnly = () => resultScope() === "character";
    const canSwitchScope = scope => currentResult() && resultScope() !== scope;
    const draft = () => state.drafts[resultScope()];
    const captionVersion = () => state.tagVersion + ":" + draft().revision;
    const modeName = mode => modelNames[C.modes[mode]];
    const tagCount = count => state.language === "ja" ? count + " タグ" : count + (count === 1 ? " tag" : " tags");
    const size = bytes => bytes >= 1e9 ? (bytes / 1e9).toFixed(2) + " GB" :
      bytes >= 1e6 ? (bytes / 1e6).toFixed(bytes < 1e7 ? 1 : 0) + " MB" : Math.ceil(bytes / 1000) + " KB";
    const setStatus = key => { state.actionStatus = key; byId("action-status").textContent = key && msg(key); };

    for (const alias of ["p", "w"]) {
      for (const group of ["general", "character"]) {
        const value = preferences.thresholds?.[alias]?.[group];
        if (typeof value === "number" && value >= 0 && value <= 1) state.thresholds[alias][group] = value;
      }
    }

    function save() {
      const {language, mode, format, sendMode, batchFormat, formatted, comparison, level, device, auto, thresholds, sizes} = state;
      try {
        localStorage.setItem(storageKey, JSON.stringify({language, mode, lmActive: state.lmActive, format, sendMode, batchFormat, formatted, comparison, level, device, auto, thresholds, sizes}));
      } catch {}
    }

    async function call(path, options) {
      const response = await fetch(api + path, {cache: "no-store", ...options});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(typeof data?.detail === "string" ? data.detail : "network");
        error.status = response.status;
        throw error;
      }
      return data;
    }

    function startAnalysis(file, {mode, device, auto}, reuse = false) {
      const params = new URLSearchParams({mode, device, auto: String(auto)});
      if (reuse) params.set("reuse", "true");
      return call("analysis?" + params, {
        method: "POST", headers: {"Content-Type": "application/octet-stream"}, body: file
      });
    }

    async function analysisStatus(id) {
      for (let retry = 0; ; retry += 1) {
        try {
          const status = await call("analysis/" + id, {signal: AbortSignal.timeout?.(5000)});
          if (typeof status?.state !== "string") throw new Error("network");
          return status;
        } catch (error) {
          if (retry >= 2 || (error.status < 500 && error.status !== 408)) throw error;
          await new Promise(resolve => setTimeout(resolve, 350 * (retry + 1)));
        }
      }
    }

    let lm;
    const renderBatch = window.forgeHybridTaggerBatch(panel, {
      msg, locale: () => state.language,
      compileRules: C.compileRules,
      splitPrompt: C.splitPrompt,
      tagKey: C.tagKey,
      settings: snapshot => {
        if (state.lmActive && lm) return lm.batchSettings(snapshot);
        const {mode, device, auto, level, batchFormat, formatted, thresholds} = state;
        return {mode, device, auto, level, format: batchFormat, formatted, thresholds: {p: {...thresholds.p}, w: {...thresholds.w}}};
      },
      settingsLabel: s => s.mode === "lm" ? lm.batchLabel(s) :
        [modeName(s.mode), msg(s.level), ...(s.formatted ? [msg("batchFormatted")] : [])].join(" · "),
      lmGenerate: (config, file, url) => lm.generate(config, file, url),
      lmText: (response, s) => lm.batchText(response, s),
      errorMessage: key => lm?.translateError(key) || msg(key),
      batchActivity(run) {
        state.lmBatch = run?.settings.mode === "lm" && run.purpose !== "review" ? run : null;
        lm?.setBatchBusy(Boolean(state.lmBatch));
        renderProgress();
      },
      async readModels({mode}) {
        const id = C.modes[mode];
        if (!state.models[id]) await refreshModels();
        if (!state.models[id]) throw new Error(state.modelError || "status_error");
        return state.models;
      },
      startAnalysis: (file, settings) => startAnalysis(file, settings, true),
      analysisStatus,
      deleteJob,
      makeText([outcome], models, {thresholds, level, format, formatted, rules}) {
        const detected = C.detect(outcome, models[outcome.id], thresholds);
        const selected = level === "full" ? [...detected.adopted, ...detected.full] : detected.adopted;
        return C.makeOutput(selected, level, format, undefined, formatted, rules).text;
      },
      refreshAnalysisIndicators() {
        void refreshModels();
        void refreshSessions();
      }
    });

    lm = byId("lm-run") && window.forgeHybridTaggerLM?.(panel, {
      byId, call, asset: () => state.asset, locale: () => state.language, msg,
      storageKey: storageKey + ":lm", splitPrompt: C.splitPrompt, splitPromptLines: C.splitPromptLines, tagKey: C.tagKey, composeLM: C.composeLM,
      batchChanged() { if (lm) renderBatch(); },
      notify() { renderProgress(); renderOutput(); if (lm) renderBatch(); }
    });

    const ocr = window.forgeHybridTaggerOCR?.(panel, {
      msg, locale: () => state.language, call, analysisStatus,
      getAsset: () => state.asset,
      getDevice: () => state.device,
      getCaption: () => ready() ? state.captions.get(captionKey(state.level, "image"))?.text : undefined,
      copyText,
      onOutput() { state.actionStatus = ""; renderOutput(); },
      onProgress(activity) { state.ocrProgress = activity; renderProgress(); },
      onJobChange() { void refreshModels(); void refreshSessions(); }
    });

    function renderLocale() {
      lm?.translate();
      panel.lang = state.language;
      for (const element of panel.querySelectorAll("[data-i18n]")) element.textContent = msg(element.dataset.i18n);
      for (const element of panel.querySelectorAll("[data-aria]")) element.setAttribute("aria-label", msg(element.dataset.aria));
      for (const element of panel.querySelectorAll("[data-title]")) element.title = msg(element.dataset.title);
      for (const element of panel.querySelectorAll("[data-placeholder]")) element.placeholder = msg(element.dataset.placeholder);
      for (const [selector, english, japanese] of controlHelp) {
        for (const element of panel.querySelectorAll(selector)) element.title = state.language === "ja" ? japanese : english;
      }
    }

    function pressed(action, value) {
      for (const button of panel.querySelectorAll('button[data-action="' + action + '"]')) {
        button.setAttribute("aria-pressed", String(button.dataset.value === value));
      }
    }

    function renderModelNotice() {
      const notice = state.modelNotice;
      const element = byId("model-file-status");
      element.textContent = notice ? modelNames[notice.id] + " · " + msg(notice.key) : "";
      element.classList.toggle("failure", Boolean(notice?.error));
    }

    function modelPath(model, path, label, source) {
      const open = state.manageLocal ?
        '<button type="button" class="quiet small" data-action="open-model-folder" data-model="' + model.id +
          '" data-source="' + source + '" aria-label="' + escapeHtml(msg("openFolder") + " · " + modelNames[model.id] +
          " · " + msg(label)) + '"' + titleAttr("openFolder") + '>' + escapeHtml(msg("openFolder")) + '</button>' : "";
      return '<div class="model-path"><span class="muted">' + escapeHtml(msg(label)) +
        '</span><code dir="ltr" title="' + escapeHtml(path) + '">' + escapeHtml(path) + '</code>' + open + '</div>';
    }

    function renderModels() {
      byId("auto-download").checked = state.auto;
      const models = [pixai, wd].map(id => state.models[id] || {id, label: modelNames[id], state: "checking"});
      byId("model-badges").innerHTML = models.map(model => {
        const label = state.modelError ? msg(state.modelError) : msg(model.state);
        return '<span class="status-pill">' + modelNames[model.id] + ' <span class="' +
          (model.state === "ready" ? "ready" : "") + '">' + escapeHtml(label) + '</span></span>';
      }).join("");
      const selected = panel.querySelector('.model-details button[data-model]:focus');
      byId("model-entries").innerHTML = models.map(model => {
        const transferring = state.transferPending.has(model.id) || activeModels.has(model.state);
        const deleting = state.deletingModels.has(model.id);
        const failure = model.state.endsWith("_failed");
        const details = [model.totalBytes ? size(model.totalBytes) : "", msg(model.state), model.shared ? msg("shared") : ""];
        if (model.needed?.length) details.push(model.needed.join(", "));
        if (model.detail) details.push(msg(model.detail));
        if (model.file) details.push(model.file);
        if (model.state === "downloading" && model.totalBytes) details.push(size(model.bytes) + " / " + size(model.totalBytes));
        const progress = model.state === "downloading"
          ? '<progress max="' + model.totalBytes + '" value="' + model.bytes + '" aria-label="' + escapeHtml(msg("downloading")) + '"></progress>' : "";
        const download = model.state === "ready" || transferring ? "" :
          '<button type="button" class="small" data-action="download" data-model="' + model.id + '"' +
            titleAttr(failure ? "retry" : "download") + (deleting ? " disabled" : "") + '>' +
            escapeHtml(msg(failure ? "retry" : "download")) + '</button>';
        const deleteLabel = msg(model.shared ? "deleteLocalCopy" : "deleteModel");
        const remove = state.manageLocal && model.localFiles ?
          '<button type="button" class="quiet small model-delete" data-action="delete-model" data-model="' + model.id +
            '" aria-label="' + escapeHtml(deleteLabel + " · " + modelNames[model.id]) + '"' +
            titleAttr(model.shared ? "deleteLocalCopy" : "deleteModel") +
            (deleting || transferring || state.analysisBusy || state.job ? " disabled" : "") + '>' +
            escapeHtml(deleteLabel) + '</button>' : "";
        const sharedPath = model.shared && model.path ?
          modelPath(model, model.path, "sharedPath", "shared") : "";
        const localPath = model.downloadPath && (!model.shared || model.downloadPath !== model.path) ?
          modelPath(model, model.downloadPath, "downloadPath", "download") : "";
        if (model.localProtected && state.manageLocal) details.push(msg("model_path_protected"));
        return '<div class="model-entry"><div class="model-heading"><div class="model-description"><span>' +
          escapeHtml(model.label) + '</span><small class="' + (failure ? "failure" : "") + '">' +
          escapeHtml(details.filter(Boolean).join(" · ")) + '</small></div><div class="model-actions">' +
          progress + download + remove + '</div></div>' + sharedPath + localPath + '</div>';
      }).join("");
      if (selected) {
        const buttons = [...byId("model-entries").querySelectorAll("button[data-model]:not(:disabled)")];
        const match = buttons.find(button => button.dataset.model === selected.dataset.model &&
          button.dataset.action === selected.dataset.action && button.dataset.source === selected.dataset.source);
        (match ?? buttons.find(button => button.dataset.model === selected.dataset.model))?.focus({preventScroll: true});
      }
      renderModelNotice();
    }

    async function refreshModels() {
      clearTimeout(state.statusTimer);
      if (state.statusTask) return state.statusTask;
      state.statusTask = (async () => {
        try {
          const data = await call("status");
          state.models = Object.fromEntries(data.models.map(model => [model.id, model]));
          state.runtime = data.runtime;
          state.analysisBusy = data.analysisBusy;
          state.manageLocal = data.manageLocal === true;
          state.modelError = null;
          rebuildDetections();
        } catch {
          state.modelError = "status_error";
        } finally {
          state.statusTask = null;
          renderModels();
          renderImage();
          if (state.job || state.analysisBusy || state.transferPending.size ||
              Object.values(state.models).some(model => activeModels.has(model.state))) {
            state.statusTimer = setTimeout(refreshModels, 550);
          }
        }
      })();
      return state.statusTask;
    }

    const releaseLabels = {
      manual: "releaseManual", idle: "releaseIdle", forge: "releaseForge", pressure: "releasePressure", deleted: "modelRemoved"
    };

    function renderSessions() {
      const status = state.sessions;
      const policy = byId("memory-policy");
      const seconds = byId("idle-seconds");
      policy.disabled = seconds.disabled = state.sessionPending || !status;
      byId("unload").disabled = state.sessionPending || !(status?.loaded.length || status?.active);
      if (status && !state.sessionPending) {
        policy.value = status.policy;
        if (!seconds.matches(":focus")) seconds.value = status.idleSeconds;
      }
      byId("idle-control").hidden = policy.value !== "idle";
      const describe = model => (model.id === "bubble-detector" ? msg("ocrDetector") : modelNames[model.id] || model.id) +
        " · " + model.device.toUpperCase();
      const loaded = status?.loaded.map(describe).join(" / ") || "";
      let message = "";
      if (state.sessionError) message = msg("sessionError");
      else if (status?.pendingRelease) message = msg("pendingRelease");
      else if (status?.active) message = msg("sessionActive") + " · " + describe(status.active);
      else if (loaded) {
        message = msg("sessionLoaded") + " · " + loaded;
        if (status.remainingSeconds !== null) message += " · " + msg("sessionIdle") + " " + status.remainingSeconds + " " + msg("seconds");
      } else if (status) {
        message = msg(releaseLabels[status.lastRelease] || "noSession");
      }
      const output = byId("session-status");
      if (output.textContent !== message) output.textContent = message;
    }

    async function refreshSessions(path = "sessions", method) {
      if (!method && state.sessionPending) return;
      clearTimeout(state.sessionTimer);
      const request = ++state.sessionRequest;
      if (method) state.sessionPending = true;
      renderSessions();
      try {
        const data = await call(path, method ? {method} : undefined);
        if (request !== state.sessionRequest) return;
        if (!Array.isArray(data?.loaded)) throw new Error("network");
        state.sessions = data;
        state.sessionError = false;
      } catch {
        if (request === state.sessionRequest) state.sessionError = true;
      } finally {
        if (request === state.sessionRequest) {
          state.sessionPending = false;
          renderSessions();
          if (state.job || state.sessions?.active || state.sessions?.loaded.length) {
            state.sessionTimer = setTimeout(refreshSessions, state.sessions?.remainingSeconds != null ? 900 : 1500);
          }
        }
      }
    }

    function changeSessionPolicy() {
      const seconds = byId("idle-seconds");
      const idle = seconds.valueAsNumber;
      if (!seconds.checkValidity() || !Number.isInteger(idle) || idle < 1) {
        seconds.value = state.sessions.idleSeconds;
        return;
      }
      const params = new URLSearchParams({policy: byId("memory-policy").value, idle_seconds: String(idle)});
      void refreshSessions("sessions?" + params, "PUT");
    }

    async function openModelFolder(id, source) {
      if (!state.manageLocal) return;
      state.modelNotice = null;
      renderModelNotice();
      try {
        const params = new URLSearchParams({source});
        await call("models/" + id + "/folder?" + params, {method: "POST"});
      } catch (error) {
        const key = translations.en[error.message] ? error.message : "model_folder_error";
        state.modelNotice = {id, key, error: true};
        renderModelNotice();
      }
    }

    async function deleteModel(id) {
      const model = state.models[id];
      if (!state.manageLocal || !model?.localFiles || state.analysisBusy || state.job ||
          state.deletingModels.has(id) || state.transferPending.has(id) || activeModels.has(model.state)) return;
      const details = [msg("deleteQuestion"), model.label, model.downloadPath, size(model.localBytes), msg("deleteRecovery")];
      if (!window.confirm(details.join("\n"))) return;
      state.deletingModels.add(id);
      state.modelNotice = null;
      renderModels();
      renderImage();
      try {
        const data = await call("models/" + id, {method: "DELETE"});
        state.modelNotice = {id, key: data.removed ? "modelRemoved" : "modelAlreadyMissing"};
      } catch (error) {
        const key = translations.en[error.message] ? error.message : "model_delete_error";
        state.modelNotice = {id, key, error: true};
      } finally {
        // Apply a fresh file check after any status request that predated the removal.
        await state.statusTask;
        await refreshModels();
        state.deletingModels.delete(id);
        renderModels();
        renderImage();
        void refreshSessions();
      }
    }

    async function download(id) {
      if (state.transferPending.has(id) || state.deletingModels.has(id)) return;
      state.modelNotice = null;
      state.transferPending.add(id);
      renderModels();
      renderProgress();
      try {
        await call("models/" + id + "/download", {method: "POST"});
      } catch (error) {
        const key = translations.en[error.message] ? error.message : "download_failed";
        state.modelNotice = {id, key, error: true};
      } finally {
        // Any in-flight check may have started before the download request.
        await state.statusTask;
        state.transferPending.delete(id);
        void refreshModels();
      }
    }

    function renderProgress() {
      const line = byId("progress");
      if (!line) return;
      const job = state.job && state.jobStatus;
      let activity = job ? {state: job.state, model: state.models[job.model]} : state.ocrProgress;
      if (state.lmActive && lm?.busy()) activity = {state: "lm"};
      if (state.lmBatch) activity = {state: "lm"};
      if (!activity) {
        const transfers = Object.values(state.models).filter(model => activeModels.has(model.state));
        const transfer = transfers.find(model => model.state === "downloading") || transfers[0];
        if (transfer || state.transferPending.size) activity = {state: transfer?.state || "checking", model: transfer};
      }
      line.hidden = !activity;
      if (!activity) return;
      if (state.lmBatch?.index > 1 && state.lmBatch.progressTotal) {
        const run = state.lmBatch;
        const percent = Math.round(100 * ((run.index || 1) - 1) / run.progressTotal);
        line.dataset.indeterminate = "false";
        line.style.setProperty("--progress-width", percent + "%");
        line.setAttribute("aria-valuenow", String(percent));
        line.setAttribute("aria-valuetext", (run.index || 1) + "/" + run.progressTotal + " · " + (run.file || ""));
        return;
      }
      const {state: phase, model} = activity;
      const hasBytes = (phase === "downloading" || phase === "ocr_preparing") &&
        model?.state === "downloading" && model.totalBytes > 0 && Number.isFinite(model.bytes);
      line.dataset.indeterminate = String(!hasBytes);
      if (hasBytes) {
        const percent = Math.round(100 * Math.max(0, Math.min(1, model.bytes / model.totalBytes)));
        line.style.setProperty("--progress-width", percent + "%");
        line.setAttribute("aria-valuenow", String(percent));
        line.setAttribute("aria-valuetext", msg("downloading") + " · " + model.label + " · " + percent + "%");
      } else {
        line.style.removeProperty("--progress-width");
        line.removeAttribute("aria-valuenow");
        line.setAttribute("aria-valuetext", phase === "lm" ? "LM Studio" : msg(phase));
      }
    }

    function renderImage() {
      renderProgress();
      const image = byId("reference");
      const asset = state.asset;
      image.hidden = !asset;
      byId("image-placeholder").hidden = Boolean(asset);
      byId("asset-bar").hidden = !asset;
      if (asset && image.getAttribute("src") !== asset.url) image.src = asset.url;
      if (!asset) image.removeAttribute("src");
      image.alt = asset?.name || "";
      byId("filename").textContent = image.alt;
      byId("image-size").textContent = asset?.dimensions || "";
      const chosen = state.models[C.modes[state.mode]];
      const missing = chosen && chosen.state !== "ready";
      const left = missing ? chosen.totalBytes - chosen.bytes || 0 : 0;
      const canDownload = !missing || state.auto || activeModels.has(chosen.state);
      const action = byId("analyze");
      const character = byId("analyze-character");
      const canRun = asset && chosen && state.runtime?.available && canDownload && !state.deletingModels.size;
      action.disabled = !state.job && !(canRun || canSwitchScope("image"));
      character.disabled = Boolean(state.job) || !(canRun || canSwitchScope("character"));
      character.setAttribute("aria-pressed", String(characterOnly()));
      const needsDownload = !state.job && !canSwitchScope("image") && left && state.auto;
      const actionLabel = state.job ? "cancel" : needsDownload ? "downloadAnalyze" : "analyze";
      action.textContent = msg(actionLabel);
      action.title = actionHint(actionLabel);
      if (needsDownload) action.textContent += " · " + size(left);

      let status = "";
      const job = state.jobStatus;
      const error = state.job ? null : state.analysisError;
      if (error) {
        status = [modelNames[error.model], msg(error.error), error.detail && msg(error.detail)].filter(Boolean).join(" · ");
      } else if (state.job && job) {
        status = [state.job.scope === "character" && msg("characterScope"), msg(job.state),
          modeName(state.job.mode)].filter(Boolean).join(" · ");
      } else if (job?.state === "cancelled") {
        status = msg("cancelled");
      } else if (state.runtime && !state.runtime.available) {
        status = msg("noRuntime");
      } else if (!asset) {
        status = msg("imageRequired");
      } else if (ready() && (currentResult() || job?.state === "done")) {
        const outcome = state.displayed.outcome;
        const badges = outcome.cached ? [msg("cache")] : [
          outcome.fallback ? msg("cpuFallback") : "",
          outcome.fallbackReason && outcome.fallbackReason !== "cuda_unavailable" ? msg(outcome.fallbackReason) : "",
          outcome.sessionReused ? msg("sessionReused") : ""
        ].filter(Boolean);
        status = [modelNames[outcome.id], outcome.device.toUpperCase(), ...badges].join(" · ");
      } else if (!canDownload) {
        status = msg("model_needed");
      } else {
        status = msg("stale");
      }
      const live = byId("run-status");
      if (live.textContent !== status) live.textContent = status;
      live.classList.toggle("failure", Boolean(error));
    }

    function rebuildDetections() {
      const outcome = state.displayed?.outcome;
      const model = outcome && state.models[outcome.id];
      if (ready() && model) {
        const thresholds = JSON.stringify(state.thresholds);
        if (state.lastOutcome === outcome && state.lastThresholds === thresholds) return;
        state.lastOutcome = outcome;
        state.lastThresholds = thresholds;
        state.detected = C.detect(outcome, model, state.thresholds);
      } else {
        state.lastOutcome = null;
        state.detected = {adopted: [], full: [], candidates: [], byKey: new Map()};
      }
      state.visibleTags = maxVisible;
      state.visibleCandidates = maxVisible;
      renderTagsAndOutput();
    }

    function replaceAsset(file) {
      const version = ++state.imageVersion;
      if (!file) { clearAsset(null); return; }
      if (file.size > 64 * 1024 * 1024 || !/\.(png|jpe?g|webp)$/i.test(file.name) &&
          !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        state.analysisError = {error: file.size > 64 * 1024 * 1024 ? "image_size" : "bad_image"};
        renderImage();
        return;
      }
      const url = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        if (version !== state.imageVersion) { URL.revokeObjectURL(url); return; }
        clearAsset({file, url, name: file.name, dimensions: image.naturalWidth + " × " + image.naturalHeight});
      };
      image.onerror = () => {
        URL.revokeObjectURL(url);
        if (version !== state.imageVersion) return;
        state.analysisError = {error: "bad_image"};
        renderImage();
      };
      image.src = url;
    }

    function clearAsset(asset) {
      cancel(false);
      if (state.asset) URL.revokeObjectURL(state.asset.url);
      state.asset = asset;
      lm?.assetChanged();
      ocr?.reset();
      state.displayed = null;
      state.drafts = newDrafts();
      state.captions.clear();
      state.tagVersion += 1;
      state.tagEdit = null;
      state.analysisError = null;
      state.jobStatus = null;
      state.actionStatus = "";
      rebuildDetections();
      renderImage();
    }

    function deleteJob(id) {
      if (id) void call("analysis/" + id, {method: "DELETE"}).catch(() => {});
    }

    function cancel(show) {
      if (state.job) deleteJob(state.job.id);
      state.job = null;
      state.jobStatus = show ? {state: "cancelled"} : null;
      if (show) { renderImage(); renderOutput(); }
    }

    async function analyze(scope = "image") {
      if (state.job) {
        if (scope === "image") cancel(true);
        return;
      }
      if (!state.asset || byId(scope === "character" ? "analyze-character" : "analyze").disabled) return;
      if (canSwitchScope(scope)) {
        state.displayed.scope = scope;
        state.analysisError = null;
        state.jobStatus = null;
        state.actionStatus = "";
        state.tagEdit = null;
        state.visibleTags = state.visibleCandidates = maxVisible;
        renderImage();
        renderTagsAndOutput();
        return;
      }
      const job = {id: null, mode: state.mode, device: state.device, auto: state.auto, scope};
      state.job = job;
      state.jobStatus = {state: "queued"};
      state.analysisError = null;
      state.actionStatus = "";
      renderImage();
      renderOutput();
      try {
        const started = await startAnalysis(state.asset.file, job);
        if (typeof started?.id !== "string" || !started.id) throw new Error("network");
        job.id = started.id;
        if (state.job !== job) { deleteJob(job.id); return; }
        void refreshModels();
        void refreshSessions();
        while (state.job === job) {
          const status = await analysisStatus(job.id);
          if (state.job !== job) return;
          state.jobStatus = status;
          if (["done", "failed", "cancelled"].includes(status.state)) {
            const outcome = status.results?.[0];
            if (status.state === "done" && !Array.isArray(outcome?.rows)) throw new Error("network");
            state.job = null;
            if (status.state === "failed") state.analysisError = status;
            if (status.state === "done") {
              if (resultScope() !== job.scope) state.tagEdit = null;
              state.displayed = {mode: job.mode, device: job.device, scope: job.scope, outcome};
              state.tagVersion += 1;
            }
            rebuildDetections();
            renderImage();
            renderOutput();
            void refreshModels();
            void refreshSessions();
            return;
          }
          renderImage();
          await new Promise(resolve => setTimeout(resolve, state.sessions?.loaded.length ? 175 : 430));
        }
      } catch (error) {
        if (state.job === job) {
          if (error.status !== 404) deleteJob(job.id);
          state.job = null;
          state.analysisError = {error: translations.en[error.message] ? error.message : "network"};
          renderImage();
          renderOutput();
        }
      }
    }

    function adopted(level = state.level) {
      if (!ready()) return [];
      const detected = level === "full" ? [...state.detected.adopted, ...state.detected.full] : state.detected.adopted;
      const {manual, excluded, order} = draft();
      const tags = [
        ...detected.filter(tag => {
          const key = C.tagKey(tag.name);
          return !excluded.has(key) && !manual.has(key) && (!characterOnly() || C.isCharacterTag(tag));
        }),
        ...manual.values()
      ];
      if (!order) return tags;
      const positions = new Map(order.map((key, index) => [key, index]));
      const position = tag => positions.get(C.tagKey(tag.name)) ?? tags.length + 1;
      return tags.sort((a, b) => position(a) - position(b));
    }

    function candidates() {
      if (!ready()) return [];
      const {excluded} = draft();
      const extras = new Map(state.detected.full.map(tag => [tag.key, tag]));
      const filtered = new Map(state.detected.candidates.map(tag => [tag.key, tag]));
      for (const tag of [...state.detected.adopted, ...extras.values()]) {
        if (excluded.has(C.tagKey(tag.name))) filtered.set(tag.key, tag);
      }
      const used = new Set(adopted().map(tag => C.tagKey(tag.name)));
      return [...filtered.values()].filter(tag => !used.has(C.tagKey(tag.name)) &&
        (!characterOnly() || C.isCharacterTag(tag)));
    }

    function evidence(tag) {
      const detected = tag.manual ? state.detected.byKey.get(tag.key) : tag;
      const score = detected?.score;
      const source = tag.detected || !tag.manual ? modeName(state.displayed.mode) + " " + (score == null
        ? msg("noVocabulary")
        : (score * 100).toFixed(1) + "%" + (detected.selected ? "" : " · " + msg("belowThreshold"))) : "";
      return [tag.name, msg(tag.category), tag.manual ? msg("manual") : (tag.depth === 4 ? msg("fullOnly") : ""),
        source]
        .filter(Boolean).join("\n");
    }

    function renderCandidates() {
      const available = candidates();
      const category = byId("category-filter").value;
      const search = C.nameKey(byId("search-tags").value);
      const filtered = available.filter(tag => (category === "all" || tag.category === category) &&
        C.nameKey(tag.name).includes(search));
      byId("candidate-count").textContent = String(available.length);
      byId("candidate-list").innerHTML = filtered.length ? filtered.slice(0, state.visibleCandidates).map(tag =>
        '<button type="button" data-action="candidate" data-key="' + escapeHtml(tag.key) + '" title="' +
        escapeHtml([actionHint("adopt"), evidence(tag)].filter(Boolean).join("\n")) + '"' +
          (state.tagEdit ? " disabled" : "") + '>+ ' + escapeHtml(tag.name) + '</button>'
      ).join("") + moreButton(filtered.length, state.visibleCandidates, "more-candidates") :
        '<span class="muted">' + escapeHtml(msg("noCandidates")) + '</span>';
    }

    function moreButton(total, visible, action) {
      return total > visible ? '<button type="button" class="small more" data-action="' + action +
        '"' + titleAttr("more") + '>' + escapeHtml(msg("more")) + ' · ' + (total - visible) + '</button>' : "";
    }

    function renderTags(tags) {
      const editing = Boolean(state.tagEdit);
      byId("adopted-count").textContent = String(tags.length);
      byId("tag-list").hidden = editing;
      byId("add-tag-form").hidden = editing;
      byId("tag-text-panel").hidden = !editing;
      byId("edit-tags").setAttribute("aria-expanded", String(editing));
      for (const id of ["add-tag", "new-tag", "edit-tags"]) byId(id).disabled = !ready();
      byId("tag-list").innerHTML = tags.length ? tags.slice(0, state.visibleTags).map(tag => {
        const remove = msg("remove") + " " + tag.name;
        return '<span class="tag"><span title="' + escapeHtml(evidence(tag)) + '">' + escapeHtml(tag.name) +
          '</span><button type="button" data-action="remove-tag" data-key="' + escapeHtml(C.tagKey(tag.name)) +
          '" aria-label="' + escapeHtml(remove) + '" title="' + escapeHtml(remove) + '">×</button></span>';
      }).join("") + moreButton(tags.length, state.visibleTags, "more-tags") :
        '<span class="muted">' + escapeHtml(msg(ready() ? "empty" : "waiting")) + '</span>';
      renderCandidates();
    }

    function tagChoice(name) {
      const key = C.tagKey(name);
      const recognized = state.detected.byKey.get("general:" + key);
      return recognized && recognized.name === name.trim()
        ? {...recognized, manual: true, detected: true}
        : {key: "manual:" + key, name: name.trim(), category: "general", depth: 1, manual: true};
    }

    function editChanged() {
      draft().revision += 1;
      state.actionStatus = "";
      renderTagsAndOutput();
    }

    function addTag(tag) {
      const key = C.tagKey(tag.name);
      if (!ready() || !key || adopted().some(item => C.tagKey(item.name) === key)) return;
      draft().manual.set(key, {...tag, manual: true});
      editChanged();
    }

    function removeTag(key) {
      const {manual, excluded} = draft();
      manual.delete(key);
      excluded.add(key);
      editChanged();
      byId("new-tag").focus({preventScroll: true});
    }

    function applyTagText() {
      const original = state.tagEdit;
      if (!original) return;
      const requested = new Map(C.splitPrompt(byId("tag-text").value).map(name => [C.tagKey(name), name]));
      const edits = draft();
      for (const key of original.keys()) {
        if (!requested.has(key)) {
          edits.excluded.add(key);
          edits.manual.delete(key);
        }
      }
      for (const [key, name] of requested) {
        if (original.get(key) !== name) edits.manual.set(key, tagChoice(name));
      }
      edits.order = [...requested.keys()];
      state.tagEdit = null;
      editChanged();
      byId("edit-tags").focus({preventScroll: true});
    }

    const captionKey = (level, scope = resultScope()) => state.displayed
      ? [state.displayed.mode, state.displayed.device, scope, level].join(":") : level;

    function output(level, tags = adopted(level)) {
      const caption = ready() ? state.captions.get(captionKey(level))?.text : "";
      const result = C.makeOutput(tags, level, state.format, caption, state.formatted, undefined, resultScope());
      const dialogue = state.format === "tags" || characterOnly() ? [] : ocr?.lines() || [];
      if (!dialogue.length) return result;
      const descriptionParts = [result.description, ...dialogue].filter(Boolean);
      const description = descriptionParts.join("\n\n");
      return {...result, baseDescription: result.description, descriptionParts, description,
        text: [result.tags, description].filter(Boolean).join("\n\n")};
    }

    function previewMarkup(value) {
      if (!value.text) return '<p class="muted">' + escapeHtml(msg("empty")) + '</p>';
      return (value.tags ? '<p class="preview-tags">' + escapeHtml(value.tags) + '</p>' : "") +
        (value.description ? '<p class="preview-description">' + escapeHtml(value.description) + '</p>' : "");
    }

    function renderOutput(tags = adopted()) {
      if (state.lmActive && lm) {
        const value = lm.value();
        for (const id of ["copy", "send-txt", "send-img"]) byId(id).disabled = !value.text;
        byId("action-status").textContent = state.actionStatus ? msg(state.actionStatus) : "";
        return;
      }
      const editing = Boolean(state.tagEdit);
      pressed("level", state.level);
      for (const button of panel.querySelectorAll('button[data-action="level"]')) button.disabled = editing;
      pressed("format", state.format);
      const result = output(state.level, tags);
      const compare = byId("compare");
      compare.setAttribute("aria-pressed", String(state.comparison));
      compare.setAttribute("aria-expanded", String(state.comparison));
      compare.textContent = msg(state.comparison ? "closeCompare" : "compare");
      compare.title = actionHint(state.comparison ? "closeCompare" : "openCompare");
      byId("single-preview").hidden = state.comparison;
      const compareGrid = byId("comparison");
      compareGrid.hidden = !state.comparison;
      if (state.comparison) {
        const active = compareGrid.querySelector('button[data-action="compare-level"]:focus');
        compareGrid.innerHTML = C.levels.map(level => {
          const value = output(level, level === state.level ? tags : adopted(level));
          const current = level === state.level;
          return '<section class="comparison-card' + (current ? ' is-current' : '') + '" data-level="' +
            level + '"><button type="button" data-action="compare-level" data-value="' + level +
            '" aria-pressed="' + current + '"' + titleAttr("pickLevel") + (editing ? ' disabled' : '') + '><span>' +
            escapeHtml(msg(level)) + '</span><small>' +
            escapeHtml(tagCount(value.count) + (current ? " · " + msg("selected") : "")) +
            '</small></button><div class="preview-text" tabindex="0"' + titleAttr("readPrompt") +
            '>' + previewMarkup(value) + '</div></section>';
        }).join("");
        if (active) compareGrid.querySelector('button[data-value="' + active.dataset.value + '"]')?.focus({preventScroll: true});
      }
      byId("preview-text").innerHTML = previewMarkup(result);
      const only = state.format === "mixed" && result.text && (!result.tags || !result.description);
      byId("preview-count").textContent = tagCount(result.count) + (only ? " · " + msg(result.tags ? "tagsOnly" : "descriptionOnly") : "");
      const previous = ready() && !currentResult() ? " · " + msg("previousResult") + " · " + modeName(state.displayed.mode) : "";
      const scope = characterOnly() ? " · " + msg("characterScope") : "";
      byId("target-level").textContent = msg("using") + " · " + msg(state.level) + scope + previous;
      byId("description-panel").hidden = !ready() || state.format === "tags";
      byId("description-title").textContent = msg("description") + " · " + msg(state.level);
      const editor = byId("description-text");
      const caption = state.captions.get(captionKey(state.level));
      const editableDescription = result.baseDescription ?? result.description;
      if (!editor.matches(":focus") && editor.value !== editableDescription) editor.value = editableDescription;
      byId("description-note").textContent = msg(!caption ? "fromTags" : caption.version === captionVersion() ? "edited" : "checkEdited");
      for (const id of ["copy", "send-txt", "send-img"]) byId(id).disabled = editing || Boolean(state.job) || !result.text;
      byId("action-status").textContent = state.actionStatus ? msg(state.actionStatus) : "";
      outputGrip.update();
    }

    function renderTagsAndOutput() {
      const tags = adopted();
      renderTags(tags);
      renderOutput(tags);
    }

    function renderOptions() {
      byId("device").value = state.device;
      byId("format-prompt").checked = state.formatted;
      byId("batch-format").value = state.batchFormat;
      for (const [alias, values] of Object.entries(state.thresholds)) {
        for (const [category, value] of Object.entries(values)) byId(alias + "-" + category).value = value;
      }
    }

    function selectMode(mode) {
      const active = mode === "lm";
      if (active && !lm) return;
      if (state.lmActive === active && (active || mode === state.mode)) return;
      state.lmActive = active;
      if (!active) state.mode = mode;
      lm?.select(active);
      state.tagEdit = null;
      if (!state.job) {
        state.jobStatus = null;
        state.analysisError = null;
      }
      state.actionStatus = "";
      save();
      pressed("mode", mode);
      renderImage();
      renderTagsAndOutput();
    }

    async function copyText(value, container = panel) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch {
        const focus = container.querySelector(":focus");
        const field = document.createElement("textarea");
        field.style.cssText = "position:fixed;left:-10000px";
        field.value = value;
        container.append(field);
        field.select();
        let copied = false;
        try { copied = document.execCommand("copy"); } catch {}
        field.remove();
        focus?.focus({preventScroll: true});
        return copied;
      }
    }

    async function copy() {
      const value = (state.lmActive ? lm.value() : output(state.level)).text;
      if (value) setStatus(await copyText(value) ? "copied" : "copyError");
    }

    function send(target) {
      const value = state.lmActive ? lm.value() : output(state.level);
      if (!value.text) return;
      const app = gradioApp();
      const input = app.querySelector("#" + target + "_prompt textarea");
      const buttons = [...app.querySelectorAll("#tabs > .tab-nav > button")];
      const tab = buttons.find(button => button.getAttribute("aria-controls") === "tab_" + target) ??
        buttons.find(button => button.textContent.trim() === target) ?? buttons[target === "txt2img" ? 0 : 1];
      if (!input || !tab) { setStatus("cannotSend"); return; }
      const previous = input.value;
      const replace = state.sendMode === "replace";
      const updated = replace ? value.text : C.appendPrompt(previous, value);
      if (previous !== updated) {
        input.value = updated;
        if (typeof updateInput === "function") updateInput(input);
        else input.dispatchEvent(new Event("input", {bubbles: true}));
        setStatus(replace ? "replaced" : "appended");
      } else {
        setStatus("already");
      }
      tab.click();
      requestAnimationFrame(() => app.querySelector("#" + target + "_prompt textarea")?.focus({preventScroll: true}));
    }

    panel.addEventListener("click", event => {
      const button = event.target.closest("button[data-action]");
      if (!button || button.disabled) return;
      const {action, value, key} = button.dataset;
      switch (action) {
        case "language":
          state.language = value;
          save(); renderLocale(); pressed("language", value); renderModels(); renderSessions(); renderImage(); renderTagsAndOutput(); renderBatch();
          ocr?.render();
          break;
        case "send-mode":
          state.sendMode = value;
          save();
          pressed("send-mode", value);
          setStatus("");
          break;
        case "mode":
          selectMode(value); renderBatch();
          break;
        case "choose": byId("choose-file").click(); break;
        case "clear-image": replaceAsset(null); break;
        case "analyze": void analyze(); break;
        case "analyze-character": void analyze("character"); break;
        case "download": void download(button.dataset.model); break;
        case "open-model-folder": void openModelFolder(button.dataset.model, button.dataset.source); break;
        case "delete-model": void deleteModel(button.dataset.model); break;
        case "check-models": void refreshModels(); void refreshSessions(); break;
        case "unload": void refreshSessions("sessions", "DELETE"); break;
        case "level":
        case "compare-level":
          state.level = value; state.actionStatus = ""; save(); renderTagsAndOutput(); renderBatch(); break;
        case "format":
          state.format = value; state.actionStatus = ""; save(); renderOutput(); break;
        case "compare": state.comparison = !state.comparison; save(); renderOutput(); break;
        case "copy": void copy(); break;
        case "send": send(value); break;
        case "candidate": {
          const tag = state.detected.byKey.get(key);
          if (tag) addTag({...tag, detected: true});
          break;
        }
        case "remove-tag": removeTag(key); break;
        case "more-tags": state.visibleTags += maxVisible; renderTags(adopted()); break;
        case "more-candidates": state.visibleCandidates += maxVisible; renderCandidates(); break;
        case "edit-tags":
          if (state.tagEdit) {
            state.tagEdit = null;
          } else {
            const names = adopted().map(tag => tag.name);
            state.tagEdit = new Map(names.map(name => [C.tagKey(name), name]));
            byId("tag-text").value = names.join(", ");
          }
          renderTagsAndOutput();
          if (state.tagEdit) byId("tag-text").focus();
          break;
        case "cancel-tags": state.tagEdit = null; renderTagsAndOutput(); byId("edit-tags").focus(); break;
        case "apply-tags": applyTagText(); break;
        case "reset-description": state.captions.delete(captionKey(state.level)); renderOutput(); break;
        case "reset-thresholds":
          state.thresholds = {p: {...thresholdDefaults.p}, w: {...thresholdDefaults.w}};
          state.tagVersion += 1;
          save(); renderOptions(); rebuildDetections();
          break;
      }
    });

    byId("format-prompt").addEventListener("change", event => {
      state.formatted = event.target.checked;
      state.actionStatus = "";
      save(); renderOutput(); renderBatch();
    });
    byId("batch-format").addEventListener("change", event => {
      state.batchFormat = event.target.value;
      save();
    });
    byId("memory-policy").addEventListener("change", changeSessionPolicy);
    byId("idle-seconds").addEventListener("change", changeSessionPolicy);
    panel.querySelector(".model-strip").addEventListener("toggle", event => {
      if (event.currentTarget.open) {
        void refreshModels();
        void refreshSessions();
      }
    });
    byId("device").addEventListener("change", event => {
      cancel(false);
      state.device = event.target.value; state.analysisError = null;
      save(); renderImage(); renderTagsAndOutput();
    });
    byId("auto-download").addEventListener("change", event => {
      state.auto = event.target.checked; save(); renderImage();
    });
    for (const alias of ["p", "w"]) {
      for (const category of ["general", "character"]) {
        byId(alias + "-" + category).addEventListener("change", event => {
          const value = event.target.valueAsNumber;
          if (!Number.isFinite(value) || value < 0 || value > 1) { renderOptions(); return; }
          state.thresholds[alias][category] = value;
          state.tagVersion += 1;
          save(); rebuildDetections();
        });
      }
    }
    byId("description-text").addEventListener("input", event => {
      state.captions.set(captionKey(state.level), {text: event.target.value, version: captionVersion()});
      state.actionStatus = ""; renderOutput();
    });
    for (const id of ["category-filter", "search-tags"]) {
      byId(id).addEventListener(id === "search-tags" ? "input" : "change", () => {
        state.visibleCandidates = maxVisible; renderCandidates();
      });
    }
    byId("add-tag-form").addEventListener("submit", event => {
      event.preventDefault();
      const input = byId("new-tag");
      addTag(tagChoice(input.value)); input.value = "";
    });
    byId("choose-file").addEventListener("change", event => {
      const file = event.target.files[0];
      if (file) replaceAsset(file);
      event.target.value = "";
    });

    const imageWell = byId("image-well");
    for (const type of ["dragenter", "dragover", "drop", "dragleave"]) {
      imageWell.addEventListener(type, event => {
        event.preventDefault();
        imageWell.classList.toggle("is-dragover", type === "dragenter" || type === "dragover");
        if (type === "drop" && event.dataTransfer.files[0]) replaceAsset(event.dataTransfer.files[0]);
      });
    }
    imageWell.addEventListener("paste", event => {
      const file = [...(event.clipboardData?.files || [])].find(file => file.type.startsWith("image/"));
      if (file) { event.preventDefault(); replaceAsset(file); }
    });

    function resizeGrip(id, variable, measure, limits, axis, widthGrip) {
      const grip = byId(id);
      const horizontal = axis === "x";
      const coordinate = event => horizontal ? event.clientX : event.clientY;
      const decrease = horizontal ? "ArrowLeft" : "ArrowUp";
      const increase = horizontal ? "ArrowRight" : "ArrowDown";
      const stored = state.sizes[id];
      const canResizeWidth = () => Boolean(widthGrip?.element.getClientRects().length);
      let drag = null;

      function update() {
        if (!grip.getClientRects().length) return;
        const [min, max] = limits();
        grip.setAttribute("aria-valuemin", min);
        grip.setAttribute("aria-valuemax", max);
        grip.setAttribute("aria-valuenow", Math.min(max, Math.max(min, Math.round(measure()))));
      }

      function apply(value) {
        if (value === null) {
          panel.style.removeProperty(variable);
          delete state.sizes[id];
        } else {
          const [min, max] = limits();
          const size = Math.round(Math.min(max, Math.max(min, value)));
          panel.style.setProperty(variable, size + "px");
          state.sizes[id] = size;
        }
        update();
      }

      function reset() {
        apply(null);
        if (canResizeWidth()) widthGrip.apply(null);
      }

      grip.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        grip.setPointerCapture(event.pointerId);
        drag = {
          id: event.pointerId, origin: coordinate(event), size: measure(),
          x: event.clientX, width: canResizeWidth() ? widthGrip.measure() : null
        };
        grip.focus({preventScroll: true});
        event.preventDefault();
      });
      grip.addEventListener("pointermove", event => {
        if (drag?.id !== event.pointerId) return;
        const delta = coordinate(event) - drag.origin;
        if (delta || state.sizes[id] !== undefined) apply(drag.size + delta);
        if (drag.width !== null && canResizeWidth()) {
          widthGrip.apply(drag.width + event.clientX - drag.x);
        }
      });
      grip.addEventListener("lostpointercapture", () => { drag = null; save(); });
      grip.addEventListener("dblclick", () => { reset(); save(); });
      grip.addEventListener("keydown", event => {
        const [min, max] = limits();
        const current = measure();
        const sizes = {[decrease]: current - 16, [increase]: current + 16, Home: min, End: max};
        if (canResizeWidth() && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
          widthGrip.apply(widthGrip.measure() + (event.key === "ArrowRight" ? 16 : -16));
        } else if (event.key === "Escape") {
          reset();
        } else if (Object.hasOwn(sizes, event.key)) {
          apply(sizes[event.key]);
        } else {
          return;
        }
        event.preventDefault();
        save();
      });
      if (Number.isInteger(stored)) panel.style.setProperty(variable, stored + "px");
      update();
      return {element: grip, measure, apply, update};
    }

    const columnGrip = resizeGrip("column-resize", "--source-width",
      () => byId("source-panel").getBoundingClientRect().width,
      () => [256, Math.max(256, Math.min(680, Math.floor(byId("workspace").clientWidth * 0.6)))], "x");
    const imageGrip = resizeGrip("image-resize", "--image-height",
      () => byId("image-well").getBoundingClientRect().height, () => [192, 768], "y", columnGrip);
    const outputGrip = resizeGrip("output-resize", "--output-height",
      () => (state.comparison ? byId("comparison").querySelector(".preview-text") :
        byId("preview-text"))?.getBoundingClientRect().height ?? 0, () => [32, 540], "y");
    const resizeGrips = [columnGrip, imageGrip, outputGrip];
    const resizeObserver = new ResizeObserver(() => {
      for (const grip of resizeGrips) grip.update();
    });
    resizeObserver.observe(panel);
    for (const key of ["result", "comparison"]) {
      const id = "lm-" + key + "-resize";
      if (!byId(id)) continue;
      const target = byId("lm-" + key);
      const boxes = key === "result" ? [target] : [...target.querySelectorAll(".preview-text")];
      const grip = resizeGrip(id, "--lm-" + key + "-height",
        () => Math.max(...boxes.map(box => box.getBoundingClientRect().height)),
        () => [58, Math.max(window.innerHeight, ...boxes.map(box => box.scrollHeight + box.offsetHeight - box.clientHeight))], "y");
      grip.element.addEventListener("focus", grip.update);
      resizeGrips.push(grip);
      resizeObserver.observe(target);
    }

    // A running Forge can still serve the panel markup from before the update.
    panel.querySelector('button[data-action="level"][data-value="simple"]')?.remove();
    const sendModes = document.createElement("div");
    sendModes.className = "segments";
    sendModes.setAttribute("role", "group");
    sendModes.dataset.aria = "sendMode";
    sendModes.innerHTML =
      '<button type="button" data-action="send-mode" data-value="append" data-i18n="sendAdd" data-title="sendAddHint" aria-pressed="true">Add</button>' +
      '<button type="button" data-action="send-mode" data-value="replace" data-i18n="sendReplace" data-title="sendReplaceHint" aria-pressed="false">Replace</button>';
    byId("send-txt").before(sendModes);
    pressed("send-mode", state.sendMode);
    renderLocale();
    pressed("language", state.language);
    pressed("mode", state.lmActive ? "lm" : state.mode);
    lm?.select(state.lmActive);
    renderOptions(); renderModels(); renderImage(); renderTagsAndOutput(); renderBatch();
    void refreshModels();
    void refreshSessions();
  }

  function attach() {
    const panel = gradioApp().querySelector("#forge-hybrid-tagger");
    const core = window.forgeHybridTaggerCore;
    if (!core || !window.forgeHybridTaggerBatch || !window.forgeHybridTaggerReview || !panel || panel.dataset.mounted) return;
    if (panel.querySelector("#fhit-lm-run") && !window.forgeHybridTaggerLM) return;
    panel.dataset.mounted = "true";
    mount(panel, core);
  }

  onUiLoaded(attach);
  onUiTabChange(attach);
})();
