export interface ILabelMe {
    version: string;
    flags: object;
    shapes: Shape[];
    imagePath: string;
    imageData: string;
    imageHeight: number;
    imageWidth: number;
}

export interface Shape {
    label: string;
    points: [number, number][];
    group_id: number | null
    description: string;
    shape_type: string;
    flags: object;
    mask: any;
}

export class LabelMe implements ILabelMe {
    version: string;
    flags: object;
    shapes: Shape[];
    imagePath: string;
    imageData: string;
    imageHeight: number;
    imageWidth: number;

    constructor() {
        this.version = "5.5.0";
        this.flags = {};
        this.shapes = [];
        this.imagePath = "";
        this.imageData = "";
        this.imageHeight = 0;
        this.imageWidth = 0;
    }

    importFromJSON(json: string) {
        const data = JSON.parse(json);
        this.version = data.version;
        this.flags = data.flags;
        this.shapes = data.shapes;
        this.imagePath = data.imagePath;
        this.imageData = data.imageData;
        this.imageHeight = data.imageHeight;
        this.imageWidth = data.imageWidth;
    }

    exportToJSON(): string {
        return JSON.stringify(this, null, 4);
    }

    static imageToBase64(image: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                resolve(reader.result as string);
            }
            reader.onerror = (error) => {
                reject(error);
            }
            reader.readAsDataURL(image);
        });
    }

    static getExtension(filename: string): string {
        return filename.split('.').pop() as string;
    }
}