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
    onRun: () => {
        loadResAndRun();
    }
}

async function loadResAndRun() {
    await app.prepareImageResource(`images/${configs.imageUrl}`, configs.lowPass, configs.highPass);
    app.run();
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

controls.add(configs, "onRun").name("Run");


app.initialize().then(() => {
    loadResAndRun();
});