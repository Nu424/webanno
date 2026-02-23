import { AnnotationBox, AnnotationBoxManager } from "./AnnnotationBox";
import { LabelMe } from "./LabelMe";
import JSZip from "jszip";

const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const csvInput = document.getElementById("csvInput") as HTMLInputElement;
const imageElement = document.getElementById("image") as HTMLImageElement;
const imageDiv = document.getElementById("imageDiv") as HTMLDivElement;
const annotationLayer = getOrCreateAnnotationLayer(imageDiv);

function getOrCreateAnnotationLayer(container: HTMLDivElement): HTMLDivElement {
    const existingLayer = document.getElementById("annotationLayer") as HTMLDivElement | null;
    if (existingLayer) {
        return existingLayer;
    }
    const newLayer = document.createElement("div");
    newLayer.id = "annotationLayer";
    container.appendChild(newLayer);
    return newLayer;
}

const fileInfoSpan = document.getElementById("fileInfoSpan") as HTMLSpanElement;
const csvInfoSpan = document.getElementById("csvInfoSpan") as HTMLSpanElement;

/**
 * LabelMe形式のJSONを作成してダウンロードする
*/
const exportButton = document.getElementById("exportButton") as HTMLButtonElement;
exportButton.addEventListener("click", (e) => {
    // ---labelme形式のJSONを作成
    const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
    if (!currentAnnotationBoxManager) return;
    exportABM(currentAnnotationBoxManager);
});

function exportABM(exportAnnotationBoxManager: AnnotationBoxManager) {
    // ---labelme形式のJSONを作成
    if (exportAnnotationBoxManager.annotationBoxes.length === 0) return; // アノテーションボックスがない場合は何もしない
    const labelme = exportAnnotationBoxManager.convertLabelme();
    const labelmeText = labelme.exportToJSON();

    // ---JSONファイルとしてダウンロード
    const downloadFilename = resolveExportFilename(exportAnnotationBoxManager);
    downloadJson(labelmeText, downloadFilename);
}

function resolveExportFilename(exportAnnotationBoxManager: AnnotationBoxManager): string {
    // ---元JSONファイル名がある場合はそれを優先する
    const sourceJsonFilename = exportAnnotationBoxManager.sourceJsonFilename?.trim();
    if (sourceJsonFilename) return sourceJsonFilename;
    // ---画像由来の場合は画像ファイル名からJSON名を作る
    const imageFileName = exportAnnotationBoxManager.imageFilename.split(".")[0];
    return `${imageFileName}.json`;
}

function downloadJson(jsonText: string, downloadFilename: string) {
    // ---JSONの単体ダウンロード
    const sanitizedFilename = sanitizeFilename(downloadFilename, "annotation.json");
    const blob = new Blob([jsonText], { type: "application/json" });
    downloadBlob(blob, sanitizedFilename);
}

function downloadBlob(blob: Blob, downloadFilename: string) {
    // ---Blobをブラウザダウンロードする共通処理
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = downloadFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFilename(filename: string, fallback: string): string {
    // ---ファイル名に使えない文字を置換
    const normalized = filename
        .trim()
        .replace(/[\/\\?%*:|"<>]/g, "_")
        .replace(/[\u0000-\u001f]/g, "_");
    return normalized.length === 0 ? fallback : normalized;
}

function dedupeFilename(filename: string, usedFilenames: Set<string>): string {
    // ---ZIP内の重複ファイル名を回避する
    if (!usedFilenames.has(filename)) {
        usedFilenames.add(filename);
        return filename;
    }

    const dotIndex = filename.lastIndexOf(".");
    const hasExtension = dotIndex > 0;
    const base = hasExtension ? filename.slice(0, dotIndex) : filename;
    const extension = hasExtension ? filename.slice(dotIndex) : "";

    let suffix = 2;
    while (true) {
        const candidate = `${base}_${suffix}${extension}`;
        if (!usedFilenames.has(candidate)) {
            usedFilenames.add(candidate);
            return candidate;
        }
        suffix++;
    }
}

function buildZipFilename(now: Date): string {
    // ---ZIP名: all_YYYYMMDD_HHmmss.zip
    const yyyy = now.getFullYear().toString();
    const mm = (now.getMonth() + 1).toString().padStart(2, "0");
    const dd = now.getDate().toString().padStart(2, "0");
    const hh = now.getHours().toString().padStart(2, "0");
    const min = now.getMinutes().toString().padStart(2, "0");
    const ss = now.getSeconds().toString().padStart(2, "0");
    return `all_${yyyy}${mm}${dd}_${hh}${min}${ss}.zip`;
}

const exportAllButton = document.getElementById("exportAllButton") as HTMLButtonElement;
exportAllButton.addEventListener("click", async (e) => {
    // ---アノテーションがあるものだけをまとめて出力する
    const exportTargets = annotationFiles
        .filter((annotationBoxManager) => annotationBoxManager.annotationBoxes.length !== 0);
    if (exportTargets.length === 0) {
        alert("出力対象のアノテーションがありません。");
        return;
    }

    try {
        // ---ZIPを作成して、各JSONを追加する
        const zip = new JSZip();
        const usedFilenames = new Set<string>();
        exportTargets.forEach((annotationBoxManager) => {
            const jsonText = annotationBoxManager.convertLabelme().exportToJSON();
            const filename = resolveExportFilename(annotationBoxManager);
            const sanitizedFilename = sanitizeFilename(filename, "annotation.json");
            const dedupedFilename = dedupeFilename(sanitizedFilename, usedFilenames);
            zip.file(dedupedFilename, jsonText);
        });
        // ---ZIPを1ファイルとしてダウンロード
        const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
        downloadBlob(zipBlob, buildZipFilename(new Date()));
    } catch (error) {
        // ---ZIP生成失敗時の通知
        console.error("JSON ZIP出力に失敗しました", error);
        alert("JSON ZIP出力に失敗しました。ブラウザのコンソールを確認してください。");
    }
});

/**
 * アノテーション対象をリセットする
 */
const resetButton = document.getElementById("resetButton") as HTMLButtonElement;
resetButton.addEventListener("click", (e) => {
    // ---リセット確認
    if (annotationFiles.length === 0) return;
    if (!window.confirm("リセットしますか？")) return;

    // ---画像表示のリセット
    resetImageDisplay();

    // ---リセット
    annotationFiles = [];
    annotationFilesIndex = 0;

    // ---ファイル情報の表示
    fileInfoSpan.textContent = "0/0 : ";

    // ---ファイルインプットのリセット
    fileInput.value = "";

});

/**
 * ラベルの自由入力
 */
const labelForm = document.getElementById("labelForm") as HTMLFormElement;
const labelInput = document.getElementById("labelInput") as HTMLInputElement;
labelForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
    if (!currentAnnotationBoxManager) return;
    const label = labelInput.value;
    console.log(currentAnnotationBoxManager.selectedAnnotationBox)
    currentAnnotationBoxManager.selectedAnnotationBox?.setValue({ label: label });
});

/**
 * ラベルを項目から選ぶ
 */
const labelListDiv = document.getElementById("labelListDiv") as HTMLDivElement;
type LabelData = { displayName: string, label: string };
let labelData: LabelData[] = [];
let labelDisplayMap = new Map<string, string>();

function resolveLabelDisplay(label: string): string {
    return labelDisplayMap.get(label) ?? label;
}

function formatLabelForList(displayName: string, label: string): string {
    if (!displayName || displayName === label) {
        return label;
    }
    return `${displayName} (${label})`;
}

function renderLabelList() {
    labelListDiv.innerHTML = "";
    if (labelData.length === 0) {
        const emptyDiv = document.createElement("div");
        emptyDiv.textContent = "CSVを読み込むとラベルが表示されます";
        labelListDiv.appendChild(emptyDiv);
        return;
    }
    labelData.forEach((data, index) => {
        const labelDiv = document.createElement("div");
        labelDiv.textContent = `${0 <= index && index <= 8 ? `${index + 1} ` : ""}${formatLabelForList(data.displayName, data.label)}`;
        labelDiv.addEventListener("click", (e) => {
            const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
            if (!currentAnnotationBoxManager) return;
            currentAnnotationBoxManager.selectedAnnotationBox?.setValue({ label: data.label });
        });
        labelListDiv.appendChild(labelDiv);
    });
}

function applyLabelResolverToManagers() {
    annotationFiles.forEach((annotationBoxManager) => {
        annotationBoxManager.labelResolver = resolveLabelDisplay;
        annotationBoxManager.updateLabelDisplays();
    });
}

document.addEventListener("DOMContentLoaded", async (e) => {
    renderLabelList();
});

/**
 * CSV読み込み
 */
csvInput.addEventListener("change", async (e) => {
    if (!csvInput.files || csvInput.files.length === 0) return;
    const file = csvInput.files[0];
    const csvText = await loadTextFile(file);
    const parsed = parseLabelDataFromCsv(csvText);
    if (parsed.error) {
        csvInfoSpan.textContent = `CSV読み込み失敗: ${parsed.error}`;
        return;
    }
    labelData = parsed.data;
    labelDisplayMap = parsed.map;
    csvInfoSpan.textContent = `CSV: ${file.name} (${labelData.length}件)`;
    renderLabelList();
    applyLabelResolverToManagers();
});


/**
 * AnnotationBoxManagerをリストにして、画像・アノテーションを管理する
 */
let annotationFiles: AnnotationBoxManager[] = [];
let annotationFilesIndex = 0;

function getCurrentAnnotationBoxManager(): AnnotationBoxManager | undefined {
    return annotationFiles[annotationFilesIndex];
}

/**
 * キーボード操作(画像の切り替え)
 */
document.addEventListener("keydown", (e) => {

    if (document.activeElement === labelInput) { // ラベル入力中は、フォーカス外しだけ受ける
        // escapeでフォーカスを外す
        if (e.key === "Escape") {
            labelInput.blur();
        }
    } else { // ラベル入力以外の場合は、キーボード操作を受け付ける
        if (e.key === "ArrowLeft" || e.key === "a") {
            // ---前の画像を表示
            resetImageDisplay();
            annotationFilesIndex = Math.max(0, annotationFilesIndex - 1);
            loadImageDisplay();
        } else if (e.key === "ArrowRight" || e.key === "d") {
            e.preventDefault();
            const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
            if (!currentAnnotationBoxManager) return;
            // ---Ctrlが押されていて、最後の画像じゃない場合、1つ前のアノテーションをコピーする
            let copyAnnotationBoxes: AnnotationBox[] = [];
            if (e.ctrlKey && annotationFilesIndex !== annotationFiles.length - 1) {
                copyAnnotationBoxes = currentAnnotationBoxManager.annotationBoxes.map((annotationBox) => annotationBox.clone());
            }

            // ---次の画像を表示
            resetImageDisplay();
            annotationFilesIndex = Math.min(annotationFiles.length - 1, annotationFilesIndex + 1);
            loadImageDisplay();

            if (copyAnnotationBoxes.length !== 0) {
                const nextAnnotationBoxManager = getCurrentAnnotationBoxManager();
                if (!nextAnnotationBoxManager) return;
                // ---コピーしたアノテーションボックスを次の画像に追加
                copyAnnotationBoxes.forEach((annotationBox) => {
                    // 親を変更
                    annotationBox.annotationBoxManager = nextAnnotationBoxManager;
                });
                nextAnnotationBoxManager.annotationBoxes.push(...copyAnnotationBoxes);
                nextAnnotationBoxManager.hideAllAnnotationBoxes();
                nextAnnotationBoxManager.loadAnnotationBoxes();
            }
        } else if (e.key === "ArrowUp" || e.key === "w") {
            // フォーカスを切り替える
            e.preventDefault();
            labelInput.select();
        }
        // 数字キーの処理
        else if (e.key.match(/[1-9]/)) {
            const number = Number(e.key) - 1;
            // 選択したアノテーションボックスに、数字番目のラベルをセット
            const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
            if (!currentAnnotationBoxManager) return;
            const label = labelData[number]?.label;
            if (!label) return;
            currentAnnotationBoxManager.selectedAnnotationBox?.setValue({ label: label });
        } else if (e.key === "g") {
            // ---すべての範囲選択を削除する
            const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
            if (!currentAnnotationBoxManager) return;
            for (const annotationBox of currentAnnotationBoxManager.annotationBoxes) {
                currentAnnotationBoxManager.deleteAnnotationBox(annotationBox);
            }
        }
    }
});

// ---画面を閉じようとしたときの処理
window.addEventListener('beforeunload', function (event) {
    event.preventDefault();
    event.returnValue = '';
})

// ---画面サイズが変わったときの処理
window.addEventListener("resize", (e) => {
    const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
    if (!currentAnnotationBoxManager) return;
    window.requestAnimationFrame(() => {
        currentAnnotationBoxManager.updateAnnotationLayerLayout();
        currentAnnotationBoxManager.loadAnnotationBoxes();
    });
});

// ----------
// ---処理まとめたやつ(画像表示の読み込み・リセット)
// ----------
function loadImageDisplay() {
    const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
    if (!currentAnnotationBoxManager) return;
    currentAnnotationBoxManager.loadImageFile();
    window.requestAnimationFrame(() => {
        currentAnnotationBoxManager.updateAnnotationLayerLayout();
        currentAnnotationBoxManager.loadAnnotationBoxes();
    });

    // ---ファイル情報の表示
    fileInfoSpan.textContent = `${annotationFilesIndex + 1}/${annotationFiles.length} : ${currentAnnotationBoxManager.imageFilename}`;
}

function resetImageDisplay() {
    const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
    if (!currentAnnotationBoxManager) return;
    currentAnnotationBoxManager.hideAllAnnotationBoxes();
    imageElement.src = "";
}


/**
 * ファイルを読み込んだときの処理
 */
fileInput.addEventListener("change", async (e) => {
    if (!fileInput.files) return;
    const files = Array.from(fileInput.files);

    // ---各ファイルをannotaitonBoxManagerに処理する
    const promises: Promise<void>[] = [];
    for (const file of files) {
        promises.push(new Promise(async (resolve, reject) => {
            const fileName = file.name;
            const mimeType = file.type;

            if (mimeType.startsWith("image/")) { // ---画像の場合
                // ---画像のサイズ・base64の取得
                const { width, height } = await getImageProperties(file);
                const base64 = await getImageBase64(file);

                // ---AnnotationBoxManagerの作成 -> 画像の読み込み
                const newAnnotationBoxManager = new AnnotationBoxManager(
                    { imageContainerElement: imageDiv, annotationLayerElement: annotationLayer, imageElement: imageElement },
                    { filename: fileName, width: width, height: height, data: base64 }
                );
                newAnnotationBoxManager.labelResolver = resolveLabelDisplay;
                newAnnotationBoxManager.onSelectedAnnotationBoxChanged = (selectedAnnotationBox, isSelectedDifferent) => {
                    if (!isSelectedDifferent) return; // 選択が変わっていない場合は何もしない
                    // ---選択したアノテーションボックスが変更されたときの処理
                    const label = selectedAnnotationBox.label
                    labelInput.value = label;

                    // ---選択したボックスの色を変える
                    selectedAnnotationBox.annotationBoxElements.box.style.borderColor = "green";
                    selectedAnnotationBox.annotationBoxElements.box.style.backgroundColor = "rgba(0, 255, 0, 0.3)";

                    // ---選択していないボックスの色を元に戻す
                    newAnnotationBoxManager.annotationBoxes
                        .filter((annotationBox) => annotationBox !== selectedAnnotationBox)
                        .forEach((annotationBox) => {
                            annotationBox.annotationBoxElements.box.style.borderColor = "red";
                            annotationBox.annotationBoxElements.box.style.backgroundColor = "rgba(255, 0, 0, 0.3)";
                        });
                }

                // ---画像の読み込み・リストに追加
                // newAnnotationBoxManager.loadImageFile();
                annotationFiles.push(newAnnotationBoxManager);
            } else if (mimeType === "application/json") { // ---jsonの場合
                // ---jsonの読み込み
                const json = await loadTextFile(file)
                const labelme = new LabelMe();
                labelme.importFromJSON(json);
                // ---画像の読み込み
                const newImageData = `data:image/${LabelMe.getExtension(labelme.imagePath)};base64,${labelme.imageData}`;
                const newAnnotationBoxManager = new AnnotationBoxManager(
                    { imageContainerElement: imageDiv, annotationLayerElement: annotationLayer, imageElement: imageElement },
                    { filename: labelme.imagePath, width: labelme.imageWidth, height: labelme.imageHeight, data: newImageData }
                );
                newAnnotationBoxManager.sourceJsonFilename = fileName;
                newAnnotationBoxManager.labelResolver = resolveLabelDisplay;
                newAnnotationBoxManager.onSelectedAnnotationBoxChanged = (selectedAnnotationBox, isSelectedDifferent) => {
                    if (!isSelectedDifferent) return; // 選択が変わっていない場合は何もしない
                    // ---選択したアノテーションボックスが変更されたときの処理
                    const label = selectedAnnotationBox.label
                    labelInput.value = label;
                    // ---選択したボックスの色を変える
                    selectedAnnotationBox.annotationBoxElements.box.style.borderColor = "green";
                    selectedAnnotationBox.annotationBoxElements.box.style.backgroundColor = "rgba(0, 255, 0, 0.3)";

                    // ---選択していないボックスの色を元に戻す
                    newAnnotationBoxManager.annotationBoxes
                        .filter((annotationBox) => annotationBox !== selectedAnnotationBox)
                        .forEach((annotationBox) => {
                            annotationBox.annotationBoxElements.box.style.borderColor = "red";
                            annotationBox.annotationBoxElements.box.style.backgroundColor = "rgba(255, 0, 0, 0.3)";
                        });
                }
                newAnnotationBoxManager.updateAnnotationLayerLayout(); // ここでrateとかが更新される

                // ---shapeの読み込み
                for (const shape of labelme.shapes) {
                    const rate = newAnnotationBoxManager.rate;
                    const x = shape.points[0][0] * rate;
                    const y = shape.points[0][1] * rate;
                    const width = (shape.points[1][0] - shape.points[0][0]) * rate;
                    const height = (shape.points[1][1] - shape.points[0][1]) * rate;
                    const label = shape.label;
                    newAnnotationBoxManager.createAnnotationBox(x, y, width, height, label);
                }
                newAnnotationBoxManager.loadImageFile();

                newAnnotationBoxManager.hideAllAnnotationBoxes();
                annotationFiles.push(newAnnotationBoxManager);
            }
            resolve();
        }));
    }
    await Promise.all(promises);

    // ---annotationFilesを画像ファイル名順にソート
    annotationFiles = annotationFiles.sort((a, b) => a.imageFilename.localeCompare(b.imageFilename));

    // ---最初の画像を表示
    resetImageDisplay();
    loadImageDisplay();
    // const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
    // if (!currentAnnotationBoxManager) return;
    // currentAnnotationBoxManager.loadImageFile();
    // currentAnnotationBoxManager.loadAnnotationBoxes();
});

/**
 * 画像上でクリックしたときの処理
 */
annotationLayer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
    if (!currentAnnotationBoxManager) return;
    if (e.target !== annotationLayer) return;

    const annoboxPosition = {
        x: e.offsetX,
        y: e.offsetY
    }

    // ---アノテーションボックスの作成
    currentAnnotationBoxManager.createAnnotationBox(annoboxPosition.x, annoboxPosition.y);
});

// ----------
// ---便利関数群(asyncにしたやつら)
// ----------

/**
 * テキストファイルを読み込む
 * @param file 読み込むファイル
 * @returns 文字列
 */
async function loadTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as string);
        }
        reader.readAsText(file);
    });
}

/**
 * CSV文字列を配列にする
 * @param text CSV文字列
 * @returns 2次元配列
 */
function parseCsv(text: string): string[][] {
    const normalizedText = text.replace(/^\uFEFF/, "");
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < normalizedText.length; i++) {
        const char = normalizedText[i];

        if (inQuotes) {
            if (char === "\"") {
                if (normalizedText[i + 1] === "\"") {
                    field += "\"";
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += char;
            }
            continue;
        }

        if (char === "\"") {
            inQuotes = true;
            continue;
        }

        if (char === ",") {
            row.push(field);
            field = "";
            continue;
        }

        if (char === "\n" || char === "\r") {
            if (char === "\r" && normalizedText[i + 1] === "\n") {
                i++;
            }
            row.push(field);
            if (row.length > 1 || row[0] !== "") {
                rows.push(row);
            }
            row = [];
            field = "";
            continue;
        }

        field += char;
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows;
}

/**
 * CSVからラベルデータを生成
 */
function parseLabelDataFromCsv(csvText: string): { data: LabelData[], map: Map<string, string>, error?: string } {
    const rows = parseCsv(csvText);
    if (rows.length === 0) {
        return { data: [], map: new Map(), error: "CSVが空です" };
    }

    const header = rows[0].map((cell) => cell.trim());
    const codeIndex = header.indexOf("料理コード");
    const nameIndex = header.indexOf("お客様向け名称");

    if (codeIndex === -1 || nameIndex === -1) {
        return { data: [], map: new Map(), error: "ヘッダーに「料理コード」または「お客様向け名称」が見つかりません" };
    }

    const map = new Map<string, string>();
    const data: LabelData[] = [];

    for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (row.length <= Math.max(codeIndex, nameIndex)) {
            continue;
        }
        const label = row[codeIndex]?.trim() ?? "";
        if (!label) {
            continue;
        }
        const displayName = row[nameIndex]?.trim() ?? "";
        if (map.has(label)) {
            const existingName = map.get(label);
            const newName = displayName || label;
            if (existingName !== newName) {
                console.warn(
                    `CSVに重複した料理コードが見つかりました: '${label}'。` +
                    ` 最初の「お客様向け名称」='${existingName}' を使用し、` +
                    `後の「お客様向け名称」='${newName}' は無視します。`
                );
            }
            continue;
        }
        const resolvedName = displayName || label;
        map.set(label, resolvedName);
        data.push({ label, displayName: resolvedName });
    }

    if (data.length === 0) {
        return { data, map, error: "有効なデータが見つかりません" };
    }

    return { data, map };
}

/**
 * 画像の幅・高さを取得する
 * @param file 画像ファイル
 * @returns 画像の幅・高さ
 */
async function getImageProperties(file: File): Promise<{ width: number, height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({
                width: img.width,
                height: img.height
            });
        }
        img.src = URL.createObjectURL(file);
    });
}

/**
 * 画像ファイルをbase64に変換する
 * @param file 画像ファイル
 * @returns base64文字列
 */
async function getImageBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as string);
        }
        reader.readAsDataURL(file);
    });
}
