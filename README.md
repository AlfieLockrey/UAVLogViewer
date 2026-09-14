# UAV Log Viewer

![log seeking](preview.gif "Logo Title Text 1")

 This is a Javascript based log viewer for Mavlink telemetry and dataflash logs.
 [Live demo here](http://plot.ardupilot.org).

## prebuilt Docker

To run the prebuilt Docker image, simply run the following command. Make sure to replace `<Your cesium ion token>` with your actual Cesium ion token. You can obtain a Cesium ion token by signing up for a free account at [Cesium ion](https://cesium.com/ion/). More information can be found [here](https://cesium.com/learn/ion/cesium-ion-access-tokens/)

``` bash
docker run -e VUE_APP_CESIUM_TOKEN=<Your cesium ion token> -p 8080:8080 -d ghcr.io/ardupilot/uavlogviewer:latest
```
## local Build Setup

``` bash
# initialize submodules
git submodule update --init --recursive

# install dependencies
npm install

# enter Cesium token
export VUE_APP_CESIUM_TOKEN=<your token>

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build

# run production build locally
npm start

# run unit tests
npm run unit

# run e2e tests
npm run e2e

# run all tests
npm test
```

### Local/offline Windows use

Use a Node.js 20 LTS toolchain for this older Webpack 5 / Jest 24 project. From
PowerShell, install dependencies and start the local server:

```powershell
npm ci
npm run dev
```

Open the localhost address printed by Webpack, then select a DataFlash `.BIN` file from
the local file picker. The log is parsed in the browser and is not uploaded by the viewer.

Portable graph presets are available from **Plot Setup**. See
[docs/portable-presets.md](docs/portable-presets.md) for the versioned exchange format.

## deployment of static files to a server
To build a static version of the application and deploy it to a server, you can use the following commands. Make sure to replace `<your token>` with your actual Cesium ion token. The built files will be located in the `dist` directory, which you can then upload to your server.
``` bash
git submodule update --init --recursive

npm install

export VUE_APP_CESIUM_TOKEN=<your token>

npm run build
```

## build local Docker image

``` bash

# Build Docker Image
docker build -t <your username>/uavlogviewer .

# Run Docker Image (token is read at container startup)
docker run -e VUE_APP_CESIUM_TOKEN=<Your cesium ion token> -it -p 8080:8080 -v ${PWD}:/usr/src/app <your username>/uavlogviewer

# Navigate to localhost:8080 in your web browser

# changes should automatically be applied to the viewer

```
