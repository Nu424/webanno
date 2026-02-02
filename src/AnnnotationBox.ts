import interact from "interactjs"; // tsconfig.json > compilerOptions > module: "commonjs" にするっぽい
import { LabelMe, Shape } from "./LabelMe";

export class AnnotationBox {
    /*
    TODO
    🙆要素作る
    🙆イベント設定する
        選択更新
        削除
    🙆表示更新する
    🙆値セットする
    🙆annoboxのラベル変更
    */
    annotationBoxManager: AnnotationBoxManager;
    annotationBoxElements: {
        box: HTMLDivElement;
        label: HTMLSpanElement
    }
    // AnnotationBoxの座標は、annotationBoxContainerElement内の座標系となる。offsetが加わった値となっている
    x: number = 0;
    y: number = 0;
    width: number = 100;
    height: number = 100;
    // image(X|Y)は、画像内の座標系となる。
    imageX: number = 0;
    imageY: number = 0;
    imageW: number = 100;
    imageH: number = 100;

    label: string = "label";
    constructor(
        parentManager: AnnotationBoxManager,
        x: number,
        y: number,
        width: number = 100,
        height: number = 100,
        label: string = "label"
    ) {
        this.annotationBoxManager = parentManager;
        this.label = label;
        this.annotationBoxElements = this.createElement(x, y, width, height);
        this.setValue({});
    }
    createElement(x: number, y: number, width: number = 100, height: number = 100): { box: HTMLDivElement, label: HTMLSpanElement } {
        // ---値の更新
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;

        // ---要素の作成
        const newObject = document.createElement("div");
        newObject.style.cssText = `
        position: absolute;
        width: ${this.width}px;
        height: ${this.height}px;
        background-color: rgba(255, 0, 0, 0.3);
        border: 2px solid red;
        touch-action: none;
        user-select: none;
        left: ${this.x}px;
        top: ${this.y}px;
        `
        newObject.setAttribute("data-x", this.x.toString());
        newObject.setAttribute("data-y", this.y.toString());

        const labelElement = document.createElement("span");
        labelElement.style.cssText = `
        position: absolute;
        bottom: 0;
        left: 0;
        background-color: rgba(0, 0, 0, 0.5);
        color: white;
        font-size: 12px;
        overflow-x: hidden;
        white-space: nowrap;
        `

        labelElement.textContent = this.annotationBoxManager.resolveLabelDisplay(this.label);
        newObject.appendChild(labelElement);


        // ---イベントの作成
        newObject.addEventListener("click", (e) => {
            this.annotationBoxManager.updateSelectedAnnotationBox(this);
            if (e.altKey) {
                // ---ctrlキーが押されているときは、削除
                this.annotationBoxManager.deleteAnnotationBox(this);
            }
        });
        newObject.addEventListener("dblclick", (e) => {
            this.annotationBoxManager.deleteAnnotationBox(this);
        });

        // ---interactjsの設定
        const moveListener = (x: number, y: number) => {
            this.setValue({ x, y });
        }
        const resizeListener = (x: number, y: number, width: number, height: number) => {
            this.setValue({ x, y, width, height });
        }
        interact(newObject)
            .draggable({
                listeners: {
                    move(event: any) { // TODO anyを適切な型に変更
                        const target = event.target;
                        const x = (parseFloat(target.getAttribute("data-x")) || 0) + event.dx;
                        const y = (parseFloat(target.getAttribute("data-y")) || 0) + event.dy;

                        // newObject.style.left = `${x}px`;
                        // newObject.style.top = `${y}px`;

                        // target.setAttribute("data-x", x);
                        // target.setAttribute("data-y", y);

                        moveListener(x, y);
                    }
                }
            })
            .resizable({
                edges: { left: true, right: true, bottom: true, top: true },
                invert: "reposition",
                listeners: {
                    move(event: any) {
                        const target = event.target;
                        let x = (parseFloat(target.getAttribute("data-x")) || 0);
                        let y = (parseFloat(target.getAttribute("data-y")) || 0);

                        const newWidth = event.rect.width;
                        const newHeight = event.rect.height;

                        x += event.deltaRect.left;
                        y += event.deltaRect.top;

                        // target.style.width = `${newWidth}px`;
                        // target.style.height = `${newHeight}px`;

                        // newObject.style.left = `${x}px`;
                        // newObject.style.top = `${y}px`;

                        // target.setAttribute("data-x", x);
                        // target.setAttribute("data-y", y);

                        resizeListener(x, y, newWidth, newHeight);
                    }
                }
            });

        return {
            box: newObject,
            label: labelElement
        }
    }

    updateElement() {
        const { box, label } = this.annotationBoxElements;
        box.style.left = `${this.x}px`;
        box.style.top = `${this.y}px`;
        box.style.width = `${this.width}px`;
        box.style.height = `${this.height}px`;

        box.setAttribute("data-x", this.x.toString());
        box.setAttribute("data-y", this.y.toString());

        label.textContent = this.annotationBoxManager.resolveLabelDisplay(this.label);
    }

    setValue(parameters: { x?: number, y?: number, width?: number, height?: number, label?: string }) {
        this.x = parameters.x ?? this.x;
        this.y = parameters.y ?? this.y;
        this.width = parameters.width ?? this.width;
        this.height = parameters.height ?? this.height;
        this.label = parameters.label ?? this.label;

        this.imageX = (this.x - this.annotationBoxManager.imgOffset.x) / this.annotationBoxManager.rate;
        this.imageY = (this.y - this.annotationBoxManager.imgOffset.y) / this.annotationBoxManager.rate;
        this.imageW = this.width / this.annotationBoxManager.rate;
        this.imageH = this.height / this.annotationBoxManager.rate;

        this.updateElement();
    }

    convertLabelmeShape(imgOffset: { x: number, y: number }, rate: number): Shape {
        return {
            label: this.label,
            points: [
                [(this.x - imgOffset.x) / rate, (this.y - imgOffset.y) / rate],
                [(this.x - imgOffset.x + this.width) / rate, (this.y - imgOffset.y + this.height) / rate]
            ],
            group_id: null,
            description: "",
            shape_type: "rectangle",
            flags: {},
            mask: null
        }
    }

    clone(): AnnotationBox {
        return new AnnotationBox(this.annotationBoxManager, this.x, this.y, this.width, this.height, this.label);
    }
}


export class AnnotationBoxManager {
    /*
    TODO
    🙆annobox追加する
    ？選択しているannoboxの管理
    🙆annoboxの削除
    annoboxリスト出力(labelme形式で)
    🙆コールバック作る
        選択が更新されたとき
    */
    imageFilename: string; // 画像ファイル名
    imageData: string; // 画像データ(base64)
    imageHeight: number; // 画像の高さ
    imageWidth: number; // 画像の幅

    annotationBoxContainerElement: HTMLElement;
    imageElement: HTMLImageElement;
    annotationBoxes: AnnotationBox[] = [];
    rate: number;
    imgOffset: { x: number, y: number };
    selectedAnnotationBox: AnnotationBox | undefined = undefined;
    onSelectedAnnotationBoxChanged?: (annotationBox: AnnotationBox, isSelectedDifferent?: boolean) => void;
    labelResolver?: (label: string) => string;

    constructor(
        elementsParameters: {
            annotationBoxContainerElement: HTMLElement,
            imageElement: HTMLImageElement
        },
        imageParameters: {
            filename: string,
            data: string,
            height: number,
            width: number
        },
        imageDisplayParameters?: {
            rate?: number,
            imgOffset?: { x: number, y: number }
        }
    ) {
        this.annotationBoxContainerElement = elementsParameters.annotationBoxContainerElement;
        this.imageElement = elementsParameters.imageElement;

        this.imageFilename = imageParameters.filename;
        this.imageData = imageParameters.data;
        this.imageHeight = imageParameters.height;
        this.imageWidth = imageParameters.width;

        this.rate = imageDisplayParameters?.rate ?? 1;
        this.imgOffset = imageDisplayParameters?.imgOffset ?? { x: 0, y: 0 };
    }

    calculateRateAndOffset() {
        // ---AnnotationBoxが入るコンテナDivのサイズ取得
        const annotationBoxContainerSize = {
            width: this.annotationBoxContainerElement.clientWidth,
            height: this.annotationBoxContainerElement.clientHeight
        }
        annotationBoxContainerSize.width = orgRound(annotationBoxContainerSize.width, 100);
        annotationBoxContainerSize.height = orgRound(annotationBoxContainerSize.height, 100);

        // ---*リサイズレートの計算
        this.rate = Math.min(
            annotationBoxContainerSize.width / this.imageWidth,
            annotationBoxContainerSize.height / this.imageHeight
        );
        this.rate = orgRound(this.rate, 100);

        // ---*imgOffsetの計算
        // this.image(width|height)は、画像の元のサイズ。表示用にrateをかけている
        this.imgOffset = {
            x: (annotationBoxContainerSize.width - this.imageWidth * this.rate) / 2,
            y: (annotationBoxContainerSize.height - this.imageHeight * this.rate) / 2
        }
        this.imgOffset.x = orgRound(this.imgOffset.x, 100);
        this.imgOffset.y = orgRound(this.imgOffset.y, 100);

        // ---[デバッグ用]各値の表示
        // console.log(`annotationBoxContainerSize: ${annotationBoxContainerSize.width}, ${annotationBoxContainerSize.height}`);
        // console.log(`imageSize: ${this.imageWidth}, ${this.imageHeight}`);
        // console.log(`rate: ${this.rate}`);
        // console.log(`imgOffset: ${this.imgOffset.x}, ${this.imgOffset.y}`);
    }

    loadImageFile() {
        // ---rate, imgOffsetの計算
        this.calculateRateAndOffset();

        // ---imageElementを、annotationBoxContainerElementのサイズに合わせてリサイズ
        this.imageElement.style.width = `${this.imageWidth * this.rate}px`;
        this.imageElement.style.height = `${this.imageHeight * this.rate}px`;

        // ---画像の表示
        this.imageElement.src = this.imageData;
    }

    loadAnnotationBoxes() {
        this.annotationBoxes.forEach((annotationBox) => {
            // rate, offsetを元に、annotationBoxの座標を再計算する
            // 1. リサイズされる
            // 2. rate, offset更新される
            // 3. imageX, rate, offset から、新しいxを作る
            // 4. 新しいxを設定する
            // 5. imageX更新される (…imageXが、prevXみたいな感じの役割を果たす)

            const newX = annotationBox.imageX * this.rate + this.imgOffset.x;
            const newY = annotationBox.imageY * this.rate + this.imgOffset.y;
            annotationBox.setValue({
                x: newX,
                y: newY,
                width: annotationBox.imageW * this.rate,
                height: annotationBox.imageH * this.rate
            });
            this.annotationBoxContainerElement.appendChild(annotationBox.annotationBoxElements.box);
        });
    }

    createAnnotationBox(x: number, y: number, width: number = 100, height: number = 100, label: string = "label"): AnnotationBox {
        const newAnnotationBox = new AnnotationBox(this, x, y, width, height, label);
        this.annotationBoxContainerElement.appendChild(newAnnotationBox.annotationBoxElements.box);

        this.annotationBoxes.push(newAnnotationBox);
        this.updateSelectedAnnotationBox(newAnnotationBox);
        return newAnnotationBox;
    }

    updateSelectedAnnotationBox(annotationBox: AnnotationBox) {
        const isSelectedDifferent = this.selectedAnnotationBox !== annotationBox;
        this.selectedAnnotationBox = annotationBox;
        this.onSelectedAnnotationBoxChanged?.(annotationBox, isSelectedDifferent);
    }

    deleteAnnotationBox(annotationBox: AnnotationBox) {
        // 子要素かどうか確認してから削除
        if (this.annotationBoxContainerElement.contains(annotationBox.annotationBoxElements.box)) {
            this.annotationBoxContainerElement.removeChild(annotationBox.annotationBoxElements.box);
            this.annotationBoxes = this.annotationBoxes.filter((box) => box !== annotationBox);
            // console.log(this.annotationBoxes);
        }
    }

    resolveLabelDisplay(label: string): string {
        return this.labelResolver ? this.labelResolver(label) : label;
    }

    updateLabelDisplays() {
        this.annotationBoxes.forEach((annotationBox) => {
            annotationBox.updateElement();
        });
    }

    convertLabelme(): LabelMe {
        const labelme = new LabelMe();

        const shapes = this.annotationBoxes.map((annotationBox) => annotationBox.convertLabelmeShape(this.imgOffset, this.rate));
        labelme.shapes = shapes;

        labelme.imagePath = this.imageFilename;
        const imageData = this.imageData.split(",")[1];
        labelme.imageData = imageData;
        labelme.imageHeight = this.imageHeight;
        labelme.imageWidth = this.imageWidth;

        return labelme;
    }

    hideAllAnnotationBoxes() {
        this.annotationBoxes.forEach((annotationBox) => {
            if (this.annotationBoxContainerElement.contains(annotationBox.annotationBoxElements.box)) {
                this.annotationBoxContainerElement.removeChild(annotationBox.annotationBoxElements.box);
            }
        });
    }
}

function orgRound(value: number, base: number) {
    return Math.round(value * base) / base;
}
