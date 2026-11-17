# Oscar Caux · Portfolio

Engineering student at ESILV × Institute for Future Technologies (IFT), looking for a 5th-year internship in AI, embedded systems and computer vision.

Live site: [oscarcaux7.github.io/portfolio](https://oscarcaux7.github.io/portfolio/)

## Projects on the site

* **Camera T-1**: a handheld camera that retrieves archival photographs of the exact place where you stand. Paper published in the Extended Abstracts of ACM CHI 2026 ([PDF](assets/Camera-T1_CHI-EA-2026.pdf), [DOI](https://doi.org/10.1145/3772363.3799317)). [Source](https://github.com/oscarcaux7/Camera_T-1_OS)
* **Raw2Event**: my reproduction, on a Raspberry Pi Zero, of the KU Leuven paper by Z. Ning, E. Lin, S. R. Iyengar and P. Vandewalle that converts a raw frame camera into an event camera. The page adds an interactive simulation of detection delay and a one-pixel explainer, both built for this site.
* **TinyGrad MNIST classifier**: in-browser inference with TinyGrad and WebGPU. [Demo](https://oscarcaux7.github.io/TinyGrad-MNIST-Classifier/)
* **Synapse**: privacy-first, browser-native RAG engine. [Demo](https://oscarcaux7.github.io/Browser-Native-Multi-Document-RAG-Engine-for-Systematic-Review/)
* **WebGPU ray-marching editor**: interactive SDF scene editor. [Demo](https://oscarcaux7.github.io/WebGPU-Project-Interactive-Ray-Marching-Scene-Editor/)

## Structure

```text
index.html   English page
style.css    shared styles, light and dark themes
main.js      theme, sound, event camera simulations (hero, road scenario, one pixel)
assets/      images and resume
```

Plain HTML, CSS and JavaScript, no build step and no dependencies.

## Run locally

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000. The YouTube embeds need an `http` origin, so opening `index.html` as a file shows links instead of players.

With Docker:

```bash
docker build -t portfolio . && docker run -p 8080:80 portfolio
```
