# UAV Log Viewer

![log seeking](preview.gif "Logo Title Text 1")

 This is a Javascript based log viewer for Mavlink telemetry and dataflash logs.
 [Live demo here](http://plot.ardupilot.org).

## Requirements

- Node.js 20 LTS (npm 9 or 10) for CI, Docker, and non-Windows development; see the
  Windows note below for its Node 16 compatibility requirement.
- Git, including access to the `JsDataflashParser` submodule.
- A modern browser with WebGL for the 3D map.

The viewer parses logs and handles portable presets entirely in the browser. An internet
connection is needed to install dependencies and to load the default map imagery; it is
not needed to upload or process a log. A Cesium ion token is not required by the current
self-hosted-terrain configuration.

## Prebuilt Docker

```bash
docker run -p 8080:8080 -d ghcr.io/ardupilot/uavlogviewer:latest
```
## local Build Setup

```bash
# initialize submodules
git submodule update --init --recursive

# install the locked dependency set
npm ci

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build

# run production build locally
npm start

# run unit tests
npm run unit

# legacy e2e tests (see note below)
npm run e2e

# run the unit and legacy e2e tests
npm test
```

### Local/offline Windows use

The locked `vue-jest` dependency uses a Windows binary supplied only through Node 16.
Use Node.js 16.20.2 with npm 8 for local Windows development; newer Node releases need a
separate native `node-gyp` setup for this legacy dependency. Add the Node 16 directory to
the current PowerShell session, then install dependencies and start the local server:

```powershell
$env:Path = "$env:LOCALAPPDATA\UAVLogViewer\node-v16.20.2-win-x64;$env:Path"
npm ci
npm run dev
```

Open the localhost address printed by Webpack, then select a DataFlash `.BIN` file from
the local file picker. The log is parsed in the browser and is not uploaded by the viewer.

Portable graph presets are available from **Plot Setup**. See
[docs/portable-presets.md](docs/portable-presets.md) for the versioned exchange format.

`npm run unit` is supported on Windows. The legacy `npm run e2e` runner is not currently
reproducible from the lockfile: it uses Unix-only `python3` and `pkill` commands and
requires a manually supplied `chromedriver`. Run unit tests locally;
repair the e2e harness separately before relying on `npm test`.

## Deployment of static files to a server

To build a static version of the application, run the following commands. The generated
files are in `dist` and can be uploaded to a static host.

```bash
git submodule update --init --recursive

npm ci

npm run build
```

## build local Docker image

```bash

# Build Docker Image
docker build -t <your username>/uavlogviewer .

# Run Docker Image
docker run -it -p 8080:8080 -v ${PWD}:/usr/src/app <your username>/uavlogviewer

# Navigate to localhost:8080 in your web browser

# changes should automatically be applied to the viewer

```
