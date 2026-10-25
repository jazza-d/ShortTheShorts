# 🧠💡 Short the Shorts

<img src="public/icons/icon-128.png" alt="Short the Shorts icon: a brain with a light bulb switching on" width="96" />

A Chrome extension (Manifest V3) that adds a quick puzzle gate between YouTube Shorts and Instagram Reels, turning mindless swiping back into a conscious choice. Runs 100% locally; no accounts, no tracking. Free, forever.

- UX spec: [`docs/user_design_specification.md`](docs/user_design_specification.md)
- Tech spec: [`docs/tech_spec.md`](docs/tech_spec.md)
- Privacy policy: [`PRIVACY.md`](PRIVACY.md)

## Getting started

```bash
npm install
npm run dev     # dev build with HMR into dist/
npm test
npm run build   # typecheck + production build into dist/
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load unpacked**, and select `dist/`.

## Icons

`assets/icon-source.png` is the master artwork. To regenerate the toolbar and store icons in `public/icons/` after replacing it:

```bash
python3 scripts/make-icons.py   # requires Pillow
```
