import { Application } from "./application";
import * as dat from "dat.gui";

const app = new Application(
    document.getElementById('stage') as HTMLCanvasElement
);

// gui configs

const configs = {
    imageUrl: "girl.png",
    lowPass: 100,
    highPass: 100,
    onTransform: async () => {
        await app.prepareImageResource(`images/${configs.imageUrl}`, configs.lowPass, configs.highPass);
        app.draw();
    },
    onInvert: async () => {
        await app.doInvert();
        app.draw();
    },
    onApply: async () => {
        await app.prepareImageResource(`images/${configs.imageUrl}`, configs.lowPass, configs.highPass);
        await app.doInvert();
        app.draw();
    }
}

const controls = new dat.GUI();

const inputsFolder = controls.addFolder("Inputs");
inputsFolder.open();
inputsFolder.add(configs, 'imageUrl', [
    "github.png",
    "paimon.png",
    "fantastic.png",
    "girl.png",
    "ringo.webp"
]);

controls.add(configs, "lowPass", 0, 100);
controls.add(configs, "highPass", 0, 100);

controls.add(configs, "onTransform").name("Transform");
controls.add(configs, "onInvert").name("Invert");
controls.add(configs, "onApply").name("Apply");

app.initialize().then(async () => {
    await app.prepareImageResource(`images/girl.png`, 100, 100);
    await app.doInvert();
    app.draw();
});