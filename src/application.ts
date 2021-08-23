import { Fourier } from "./fourier";
import { round2 } from "./math";

const ImageGithub = "github.png";
const ImagePaimon = "paimon.png";
const ImageFantastic = "fantastic.png";
const ImageGirl = "girl.png";
const ImageRingo = "ringo.webp";

const AlignUnit = 50;
const cc = 9e-3;

interface ImageDataObject {
    imageData: ImageData;
    rw: number;
    rh: number;
    ow?: number;
    oh?: number;
}

class Application {
    private bitmap!: ImageBitmap;
    private bitmapModified!: ImageBitmap;
    private ctx: CanvasRenderingContext2D;

    private tmpCanvas!: OffscreenCanvas;
    private tmpCtx!: OffscreenCanvasRenderingContext2D;

    private originRes?: ImageResource;
    private resultRes?: ImageResource;
    private invertedRes?: ImageResource;

    private tmpFftedArray?: Array<any>;

    constructor(private canvas: HTMLCanvasElement) {
        this.ctx = canvas.getContext("2d")!;
        this.tmpCanvas = new OffscreenCanvas(1, 1);
        this.tmpCtx = this.tmpCanvas.getContext('2d')!;
    }

    async initialize() {
        this.setCanvasProps()
        window.addEventListener('resize', () => {
            this.setCanvasProps()
            this.draw()
        });
    }

    finalize() {
    }

    draw() {

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        if (this.originRes) {
            let ratio = 1;
            let w2 = this.originRes.rw * 2
            if (w2 > (this.canvas.width - 3 * AlignUnit)) {
                ratio = (this.canvas.width - 3 * AlignUnit) / w2;
            }
            this.ctx.drawImage(this.originRes.bitmap, AlignUnit, AlignUnit, this.originRes.ow * ratio, this.originRes.oh * ratio);
            if (this.resultRes) {
                this.ctx.drawImage(this.resultRes.bitmap, this.originRes.ow * ratio + 2 * AlignUnit, AlignUnit, this.resultRes.ow * ratio, this.resultRes.oh * ratio);
            } else {
                console.error('resultRes invalid!');
            }
            if (this.invertedRes) {
                this.ctx.drawImage(this.invertedRes.bitmap, AlignUnit, this.originRes.oh + 2 * AlignUnit, this.invertedRes.ow * ratio, this.invertedRes.oh * ratio);
            } else {
                console.error('invertedRes invalid!');
            }
        } else {
            console.error('originRes invalid!');
        }
    }

    private setCanvasProps() {
        this.canvas.style.position = "absolute";
        this.canvas.style.top = "0px";
        this.canvas.style.left = "0px";
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    async prepareImageResource(url: string, low: number = 0, high: number = 0) {

        // clear invertedRes
        this.invertedRes = undefined;

        // origin image res
        this.originRes = await ImageResource.loadUrl(url);

        // get only gray info array
        let inputArray: Array<number> = this.originRes.grayArray;
        let fftedArray: Array<any> = [];
        // fft
        Fourier.transform(inputArray, fftedArray);
        // shift origin cord
        fftedArray = Fourier.shift(fftedArray, [this.originRes.rw, this.originRes.rh]);
        // get max magnitude and log value
        let maxMagnitude = 0;
        let logOfMaxMagnitude = 0;
        for (let i = 0; i < fftedArray.length; i++) {
            const mag = fftedArray[i].magnitude();
            if (mag > maxMagnitude) {
                maxMagnitude = mag;
            }
        }
        logOfMaxMagnitude = Math.log(cc * maxMagnitude + 1);

        const w = this.originRes.rw;
        const h = this.originRes.rh;
        const r = Math.sqrt(2) * w / 2;
        Fourier.filter(fftedArray, [w, h], r * (100 - low) / 100, r * high / 100);

        this.tmpFftedArray = fftedArray;

        // create new ImageData
        const modifiedImageData = new ImageData(w, h);
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                let pixelIdx = 4 * (w * i + j);
                modifiedImageData.data[pixelIdx + 3] = 255;
                let color = Math.log(cc * fftedArray[w * i + j].magnitude() + 1);
                color = Math.round(255 * color / logOfMaxMagnitude);
                for (let c = 0; c < 3; c++) {
                    modifiedImageData.data[pixelIdx + c] = color;
                }
            }
        }

        this.resultRes = await ImageResource.loadImageData(modifiedImageData, w, h);
    }

    async doInvert() {
        if (!this.originRes) {
            return;
        }
        let invertedArray: Array<any> = [];
        this.tmpFftedArray = Fourier.unshift(this.tmpFftedArray, [this.originRes.rw, this.originRes.rh]);
        Fourier.invert(this.tmpFftedArray, invertedArray);
        const w = this.originRes.rw;
        const h = this.originRes.rh;
        // create new ImageData
        const modifiedImageData = new ImageData(w, h);
        for (let i = 0; i < h; i++) {
            for (let j = 0; j < w; j++) {
                let pixelIdx = 4 * (w * i + j);
                modifiedImageData.data[pixelIdx + 3] = 255;
                for (let c = 0; c < 3; c++) {
                    modifiedImageData.data[pixelIdx + c] = invertedArray[w * i + j];
                }
            }
        }
        this.invertedRes = await ImageResource.loadImageData(modifiedImageData, w, h);
    }
}

class ImageResource {
    _canvas?: OffscreenCanvas;
    _ctx?: OffscreenCanvasRenderingContext2D;

    _imageData?: ImageData;

    _bitmap?: ImageBitmap;

    ow: number = 0;
    oh: number = 0;
    rw: number = 0;
    rh: number = 0;

    static async clone(target: ImageResource) {
        let bitmap = await createImageBitmap(target.bitmap);
        return new ImageResource(bitmap);
    }

    static async loadUrl(url: string): Promise<ImageResource> {
        let response = await fetch(url);
        let blob = await response.blob();
        return await this.loadBlob(blob);
    }

    static async loadBlob(blob: Blob): Promise<ImageResource> {
        let bitmap = await createImageBitmap(blob);
        return new ImageResource(bitmap);
    }

    static async loadImageData(imageData: ImageData, w: number, h: number): Promise<ImageResource> {
        // todo low performance, and memory wasted
        let canvas = new OffscreenCanvas(w, h);
        let ctx = canvas.getContext('2d')!;
        ctx.putImageData(imageData, 0, 0);
        let bitmap = await createImageBitmap(canvas);
        return new ImageResource(bitmap);
    }

    constructor(bitmapOrImageData: ImageBitmap) {
        this._bitmap = bitmapOrImageData as ImageBitmap;

        this.ow = this._bitmap.width;
        this.oh = this._bitmap.height;
        this.rw = round2(this.ow);
        this.rh = round2(this.oh);

        this._canvas = new OffscreenCanvas(this.rw, this.rh);
        this._ctx = this._canvas.getContext('2d')!;

        this._ctx.drawImage(this._bitmap, 0, 0, this.ow, this.oh, 0, 0, this.ow, this.ow);

        this._imageData = this._ctx.getImageData(0, 0, this.rw, this.rh);
    }

    release() {
        this._imageData = undefined;
        this._bitmap?.close();
        this._ctx = undefined;
        this._canvas = undefined;
    }

    get bitmap(): ImageBitmap {
        return this._bitmap!;
    }

    get imageData(): ImageData {
        return this._imageData!;
    }

    get canvas(): OffscreenCanvas {
        return this._canvas!;
    }

    get ctx(): OffscreenCanvasRenderingContext2D {
        return this._ctx!;
    }

    get grayArray(): Array<number> {
        let arr: Array<number> = [];
        for (let i = 0; i < this.imageData.data.length; i += 4) {
            arr.push(this.imageData.data[i]);
        }
        return arr;
    }
}

export { Application }