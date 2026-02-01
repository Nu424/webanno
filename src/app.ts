import { AnnotationBox, AnnotationBoxManager } from "./AnnnotationBox";
import { LabelMe } from "./LabelMe";

const inputDiv = document.getElementById("inputDiv"); // TODO 画像のドラッグアンドドロップ、ペーストへの対応
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
const imageElement = document.getElementById("image") as HTMLImageElement;
const imageDiv = document.getElementById("imageDiv") as HTMLDivElement;

const fileInfoSpan = document.getElementById("fileInfoSpan") as HTMLSpanElement;

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

    // ---ダウンロード
    const blob = new Blob([labelmeText], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const imageFileName = exportAnnotationBoxManager.imageFilename.split(".")[0];
    a.download = `${imageFileName}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

const exportAllButton = document.getElementById("exportAllButton") as HTMLButtonElement;
exportAllButton.addEventListener("click", (e) => {
    // ---なんかうまくダウンロードできなかった
    // for (const annotationBoxManager of annotationFiles) {
    //     exportABM(annotationBoxManager);
    // }

    // ---一つのファイルにまとめる方法
    // あとでファイルをバラバラにしてください。。。
    const labelmeTexts = annotationFiles
        .filter((annotationBoxManager) => annotationBoxManager.annotationBoxes.length !== 0)
        .map((annotationBoxManager) => annotationBoxManager.convertLabelme().exportToJSON());
    const labelmeTextAll = `[${labelmeTexts.join(",")}]`;
    const blob = new Blob([labelmeTextAll], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `all.json`;
    a.click();
    URL.revokeObjectURL(url);
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
let labelData: { displayName: string, label: string }[] = [];

document.addEventListener("DOMContentLoaded", async (e) => {
    labelData = [
        { displayName: "ライス", label: "rice" },
        { displayName: "味噌汁", label: "miso_soup" },
    ];

    // console.log(labelData);

    labelData.forEach((data, index) => {
        const labelDiv = document.createElement("div");
        labelDiv.textContent = `${0 <= index && index <= 8 ? `${index + 1} ` : ""}${data.displayName}(${data.label})`;
        labelDiv.addEventListener("click", (e) => {
            const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
            if (!currentAnnotationBoxManager) return;
            currentAnnotationBoxManager.selectedAnnotationBox?.setValue({ label: data.label });
        });
        labelListDiv.appendChild(labelDiv);
    });
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
        }else if (e.key==="g"){
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
    loadImageDisplay();
});

// ----------
// ---処理まとめたやつ(画像表示の読み込み・リセット)
// ----------
function loadImageDisplay() {
    const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
    if (!currentAnnotationBoxManager) return;
    currentAnnotationBoxManager.loadImageFile();
    currentAnnotationBoxManager.loadAnnotationBoxes();

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
                    { annotationBoxContainerElement: imageDiv, imageElement: imageElement },
                    { filename: fileName, width: width, height: height, data: base64 }
                );
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
                const json = await loadJsonFile(file)
                const labelme = new LabelMe();
                labelme.importFromJSON(json);
                // ---画像の読み込み
                const newImageData = `data:image/${LabelMe.getExtension(labelme.imagePath)};base64,${labelme.imageData}`;
                const newAnnotationBoxManager = new AnnotationBoxManager(
                    { annotationBoxContainerElement: imageDiv, imageElement: imageElement },
                    { filename: labelme.imagePath, width: labelme.imageWidth, height: labelme.imageHeight, data: newImageData }
                );
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
                newAnnotationBoxManager.calculateRateAndOffset(); // ここでrateとかが更新される

                // ---shapeの読み込み
                for (const shape of labelme.shapes) {
                    const imgOffset = newAnnotationBoxManager.imgOffset;
                    const rate = newAnnotationBoxManager.rate;
                    const x = (shape.points[0][0] * rate + imgOffset.x);
                    const y = (shape.points[0][1] * rate + imgOffset.y);
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
imageElement.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const currentAnnotationBoxManager = getCurrentAnnotationBoxManager();
    if (!currentAnnotationBoxManager) return;

    // ---AnnotationBoxManagerを作成したときのimgOffsetを使って、画像上の座標を計算する
    const imgOffset = currentAnnotationBoxManager.imgOffset;
    const annoboxPosition = {
        x: e.offsetX + imgOffset.x,
        y: e.offsetY + imgOffset.y
    }

    // ---アノテーションボックスの作成
    currentAnnotationBoxManager.createAnnotationBox(annoboxPosition.x, annoboxPosition.y);
});

// ----------
// ---便利関数群(asyncにしたやつら)
// ----------

/**
 * ファイルを読み込んでJSONを返す
 * @param file 読み込むファイル
 * @returns JSON文字列
 */
async function loadJsonFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result as string);
        }
        reader.readAsText(file);
    });
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

