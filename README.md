# Circuit Sketcher

A browser-based circuit drawing board. GitHub Pages serves the app as a static site; each visitor's circuits and custom parts stay in that browser unless they export a backup.

## Add a part

Open **Custom part** and choose a name, category, shape, size, color, pin labels, pin side, and pin type. The preview updates as you edit. Select **Create part** to add it to the current circuit. Use **I already have part JSON** for detailed component definitions.

## Publish

This repository is configured for static hosting. In GitHub, open **Settings → Pages**, choose **Deploy from a branch**, select the `main` branch and `/ (root)`, then save. The site will be available at `https://<account>.github.io/<repository>/` after the Pages build completes.