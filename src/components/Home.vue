<template>
    <div id='vuewrapper' class="viewer-layout" :class="{ 'pane-resizing': sidebarResizing }"
         style="height: 100%;">
        <template v-if="(state.mapLoading && !state.mapError) || state.plotLoading">
            <div id="waiting">
                <atom-spinner
                    :animation-duration="1000"
                    :color="'#64e9ff'"
                    :size="300"
                />
            </div>
        </template>
        <TxInputs fixed-aspect-ratio v-if="state.mapAvailable && state.showMap && state.showRadio"></TxInputs>
        <ParamViewer    @close="state.showParams = false" v-if="state.showParams"></ParamViewer>
        <MessageViewer  @close="state.showMessages = false" v-if="state.showMessages"></MessageViewer>
        <DeviceIDViewer @close="state.showDeviceIDs = false" v-if="state.showDeviceIDs"></DeviceIDViewer>
        <AttitudeViewer @close="state.showAttitude = false" v-if="state.showAttitude"></AttitudeViewer>
        <MagFitTool     :resizeable="false" @close="state.showMagfit = false" v-if="state.showMagfit"></MagFitTool>
        <EkfHelperTool  @close="state.showEkfHelper = false" v-if="state.showEkfHelper"></EkfHelperTool>
        <div class="container-fluid" style="height: 100%; overflow: hidden;">

            <sidebar :style="sidebarStyle">
                <div slot="resizer" ref="sidebarResizer" class="sidebar-resizer"
                     role="separator" aria-label="Resize settings pane" aria-orientation="vertical"
                     :aria-valuemin="Math.round(sidebarAriaMinimum)"
                     :aria-valuemax="Math.round(sidebarWidthBounds.maximum)"
                     :aria-valuenow="Math.round(sidebarWidth)" tabindex="0"
                     title="Drag to resize the settings pane; double-click to reset"
                     @pointerdown="startSidebarResize" @pointermove="moveSidebarResize"
                     @pointerup="finishSidebarResize" @pointercancel="finishSidebarResize"
                     @keydown="resizeSidebarWithKeyboard" @dblclick="resetSidebarWidth">
                    <span class="sidebar-resizer-grip" aria-hidden="true">⋮</span>
                </div>
            </sidebar>

            <main class="viewer-main flex-column d-flex" :style="mainStyle" role="main">

                <div class="row"
                     v-bind:class="[state.showMap ? 'plot-with-map' : 'h-100']"
                     v-if="state.plotOn">
                    <div class="col-12 plot-panels">
                        <Plotly v-for="panel in state.plotCount" :key="panel" :panel-index="panel - 1"/>
                    </div>
                </div>
                <div class="row" v-bind:class="[state.plotOn ? 'map-with-plot' : 'h-100']"
                     v-if="state.showMap">
                    <div class="col-12 noPadding">
                        <CesiumViewer v-if="state.mapAvailable && mapOk && !state.mapError" ref="cesiumViewer"/>
                        <div v-if="state.mapError" class="map-error-container">
                            <i class="fas fa-exclamation-triangle"></i>
                            <h3>Map Initialization Failed</h3>
                            <p>{{ state.mapError }}</p>
                            <button
                                @click="state.mapError = null; state.showMap = false"
                                class="btn btn-outline-info btn-sm">Dismiss</button>
                        </div>
                        <div v-else-if="!(state.mapAvailable && mapOk)" class="map-error-container">
                             <i class="fas fa-map-marked-alt"></i>
                             <h3>No Map Data</h3>
                             <p>This log file does not contain enough GPS or trajectory data to display on the map.</p>
                             <button
                                 @click="state.showMap = false"
                                 class="btn btn-outline-info btn-sm">Close Map</button>
                        </div>
                    </div>
                </div>
            </main>

        </div>
    </div>
</template>

<script>
import Plotly from '@/components/Plotly.vue'
import CesiumViewer from '@/components/CesiumViewer.vue'
import Sidebar from '@/components/Sidebar.vue'
import TxInputs from '@/components/widgets/TxInputs.vue'
import ParamViewer from '@/components/widgets/ParamViewer.vue'
import MessageViewer from '@/components/widgets/MessageViewer.vue'
import DeviceIDViewer from '@/components/widgets/DeviceIDViewer.vue'
import AttitudeViewer from '@/components/widgets/AttitudeWidget.vue'
import { store } from '@/components/Globals.js'
import { AtomSpinner } from 'epic-spinners'
import { Color } from 'cesium'
import colormap from 'colormap'
import { DataflashDataExtractor } from '../tools/dataflashDataExtractor'
import { MavlinkDataExtractor } from '../tools/mavlinkDataExtractor'
import { DjiDataExtractor } from '../tools/djiDataExtractor'
import MagFitTool from '@/components/widgets/MagFitTool.vue'
import EkfHelperTool from '@/components/widgets/EkfHelperTool.vue'
import Vue from 'vue'
import tzlookup from 'tz-lookup'
import {
    getSidebarWidth, getSidebarWidthBounds, isSidebarOverlay, parseStoredSidebarWidth, sidebarWidthStorageKey
} from '../tools/sidebarLayout.js'

export default {
    name: 'Home',
    created () {
        this.$eventHub.$on('messagesDoneLoading', this.extractFlightData)
        this.state.messages = {}
        this.state.timeAttitude = []
        this.state.timeAttitudeQ = []
        this.state.currentTrajectory = []
        this.state.metadata = null
        this.state.worldTimeAvailable = false
        this.state.worldTimeZone = ''
        this.state.plotTimeMode = 'elapsed'
        this.updateOnlineStatus = () => { this.state.isOnline = navigator.onLine !== false }
        this.updateOnlineStatus()
        window.addEventListener('online', this.updateOnlineStatus)
        window.addEventListener('offline', this.updateOnlineStatus)
        this.onViewportResize = () => { this.viewportWidth = window.innerWidth }
        window.addEventListener('resize', this.onViewportResize)
        this.restoreSidebarWidth()
        this.$eventHub.$on('reset-sidebar-width', this.resetSidebarWidth)
    },
    beforeDestroy () {
        this.$eventHub.$off('messages')
        window.removeEventListener('online', this.updateOnlineStatus)
        window.removeEventListener('offline', this.updateOnlineStatus)
        window.removeEventListener('resize', this.onViewportResize)
        this.$eventHub.$off('reset-sidebar-width', this.resetSidebarWidth)
        if (this.sidebarResizeFrame !== null) cancelAnimationFrame(this.sidebarResizeFrame)
        if (this.viewerResizeFrame !== null) cancelAnimationFrame(this.viewerResizeFrame)
    },
    data () {
        return {
            state: store,
            dataExtractor: null,
            viewportWidth: window.innerWidth,
            requestedSidebarWidth: null,
            pendingSidebarWidth: null,
            sidebarPointerId: null,
            sidebarResizing: false,
            sidebarResizeFrame: null,
            viewerResizeFrame: null
        }
    },
    methods: {
        restoreSidebarWidth () {
            try {
                this.requestedSidebarWidth = parseStoredSidebarWidth(
                    window.localStorage.getItem(sidebarWidthStorageKey)
                )
            } catch (error) {
                this.requestedSidebarWidth = null
            }
        },
        persistSidebarWidth () {
            if (this.requestedSidebarWidth === null) return
            try {
                window.localStorage.setItem(sidebarWidthStorageKey, String(this.requestedSidebarWidth))
            } catch (error) {
                console.warn('Unable to save pane width:', error)
            }
        },
        queueSidebarWidth (clientX) {
            this.pendingSidebarWidth = Math.max(Number(clientX) || 0, 0)
            if (this.sidebarResizeFrame !== null) return
            this.sidebarResizeFrame = requestAnimationFrame(() => {
                this.sidebarResizeFrame = null
                this.applyPendingSidebarWidth()
            })
        },
        applyPendingSidebarWidth () {
            if (this.pendingSidebarWidth === null) return
            this.requestedSidebarWidth = this.pendingSidebarWidth
            this.pendingSidebarWidth = null
        },
        startSidebarResize (event) {
            if (event.button !== undefined && event.button !== 0) return
            this.sidebarPointerId = event.pointerId
            this.sidebarResizing = true
            event.currentTarget.setPointerCapture(event.pointerId)
            this.queueSidebarWidth(event.clientX)
            event.preventDefault()
        },
        moveSidebarResize (event) {
            if (!this.sidebarResizing || event.pointerId !== this.sidebarPointerId) return
            this.queueSidebarWidth(event.clientX)
            event.preventDefault()
        },
        finishSidebarResize (event) {
            if (!this.sidebarResizing || event.pointerId !== this.sidebarPointerId) return
            if (this.sidebarResizeFrame !== null) {
                cancelAnimationFrame(this.sidebarResizeFrame)
                this.sidebarResizeFrame = null
            }
            this.pendingSidebarWidth = Math.max(Number(event.clientX) || 0, 0)
            this.applyPendingSidebarWidth()
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId)
            }
            this.sidebarPointerId = null
            this.sidebarResizing = false
            this.persistSidebarWidth()
            this.completeViewerResize()
            event.preventDefault()
        },
        resizeSidebarWithKeyboard (event) {
            if (!['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) return
            event.preventDefault()
            if (event.key === 'Home') {
                this.resetSidebarWidth()
                return
            }
            const step = event.shiftKey ? 64 : 16
            const direction = event.key === 'ArrowLeft' ? -1 : 1
            const startingWidth = this.sidebarWidth
            this.requestedSidebarWidth = Math.max(startingWidth + direction * step, 0)
            this.persistSidebarWidth()
            this.completeViewerResize()
        },
        resetSidebarWidth () {
            this.requestedSidebarWidth = null
            this.pendingSidebarWidth = null
            try {
                window.localStorage.removeItem(sidebarWidthStorageKey)
            } catch (error) {
                console.warn('Unable to reset pane width:', error)
            }
            this.completeViewerResize()
        },
        completeViewerResize () {
            this.$nextTick(() => {
                if (this.viewerResizeFrame !== null) cancelAnimationFrame(this.viewerResizeFrame)
                this.viewerResizeFrame = requestAnimationFrame(() => {
                    this.viewerResizeFrame = null
                    if (this.state.plotOn) this.$eventHub.$emit('force-resize-plotly')
                    const cesium = this.$refs.cesiumViewer
                    if (cesium && cesium.viewer && !cesium.viewer.isDestroyed()) cesium.viewer.resize()
                })
            })
        },
        extractFlightData () {
            if (this.dataExtractor === null) {
                if (this.state.logType === 'tlog') {
                    this.dataExtractor = MavlinkDataExtractor
                } else if (this.state.logType === 'dji') {
                    this.dataExtractor = DjiDataExtractor
                } else {
                    this.dataExtractor = DataflashDataExtractor
                }
            }
            if ('FMTU' in this.state.messages && this.state.messages.FMTU.length === 0) {
                this.state.processStatus = 'ERROR PARSING?'
            }

            if (this.state.flightModeChanges.length === 0) {
                this.state.flightModeChanges = this.dataExtractor.extractFlightModes(this.state.messages)
            }
            Vue.delete(this.state.messages, 'MODE')

            if (this.state.events.length === 0) {
                this.state.events = this.dataExtractor.extractEvents(this.state.messages)
            }
            Vue.delete(this.state.messages, 'STAT')
            Vue.delete(this.state.messages, 'EV')

            if (this.state.mission.length === 0) {
                this.state.mission = this.dataExtractor.extractMission(this.state.messages)
            }

            Vue.delete(this.state.messages, 'CMD')

            this.state.vehicle = this.dataExtractor.extractVehicleType(this.state.messages)
            if (this.state.params === undefined) {
                this.state.params = this.dataExtractor.extractParams(this.state.messages)
                if (this.state.params !== undefined) {
                    this.state.defaultParams = this.dataExtractor.extractDefaultParams(this.state.messages)
                    if (this.state.params !== undefined) {
                        this.$eventHub.$on('cesium-time-changed', (time) => {
                            this.state.params.seek(time)
                        })
                    }
                }
            }
            if (this.state.vehicle === 'quadcopter') {
                if (this.state.params?.get('FRAME_TYPE') === 0) {
                    this.state.vehicle += '+'
                } else {
                    this.state.vehicle += 'x'
                }
            }
            if (this.state.textMessages.length === 0) {
                this.state.textMessages = this.dataExtractor.extractTextMessages(this.state.messages)
            }
            Vue.delete(this.state.messages, 'MSG')

            if (this.state.colors.length === 0) {
                this.generateColorMMap()
            }
            this.state.attitudeSources = this.dataExtractor.extractAttitudeSources(this.state.messages)
            if (this.state.attitudeSources.quaternions.length > 0) {
                const source = this.state.attitudeSources.quaternions[0]
                this.state.attitudeSource = source
                this.state.timeAttitudeQ = this.dataExtractor.extractAttitudeQ(this.state.messages, source)
            } else if (this.state.attitudeSources.eulers.length > 0) {
                const source = this.state.attitudeSources.eulers[0]
                this.state.attitudeSource = source
                this.state.timeAttitude = this.dataExtractor.extractAttitude(this.state.messages, source)
            }

            const list = Object.keys(this.state.timeAttitude)
            this.state.lastTime = parseInt(list[list.length - 1])

            this.state.trajectorySources = this.dataExtractor.extractTrajectorySources(this.state.messages)
            if (this.state.trajectorySources.length > 0) {
                const first = this.state.trajectorySources[0]
                this.state.trajectorySource = first
                this.state.trajectories = this.dataExtractor.extractTrajectory(
                    this.state.messages,
                    first
                )
                try {
                    this.state.currentTrajectory = this.state.trajectories[first].trajectory
                    this.state.timeTrajectory = this.state.trajectories[first].timeTrajectory
                } catch {
                    console.log('unable to load trajectory')
                }
            }
            try {
                if (this.state.messages?.GPS?.time_boot_ms) {
                    this.state.metadata = { startTime: this.dataExtractor.extractStartTime(this.state.messages.GPS) }
                } else {
                    this.state.metadata = {
                        startTime: this.dataExtractor.extractStartTime(this.state.messages['GPS[0]'])
                    }
                }
            } catch (error) {
                console.log('unable to load metadata')
                console.log(error)
            }
            this.setWorldTimeContext()
            try {
                this.state.namedFloats = this.dataExtractor.extractNamedValueFloatNames(this.state.messages)
                console.log(this.state.namedFloats)
            } catch (error) {
                console.log('unable to load named floats')
                console.log(error)
            }
            Vue.delete(this.state.messages, 'AHR2')
            Vue.delete(this.state.messages, 'POS')
            Vue.delete(this.state.messages, 'GPS')

            this.state.fences = this.dataExtractor.extractFences(this.state.messages)

            this.state.processStatus = 'Processed!'
            this.state.processDone = true
            // Change to plot view after 2 seconds so the Processed status is readable
            setTimeout(() => { this.$eventHub.$emit('set-selected', 'plot') }, 2000)

            // Only set showMap to true if it is available and was previously unavailable
            if (!this.state.mapAvailable) {
                this.state.mapAvailable = this.state.currentTrajectory.length > 0
                if (this.state.mapAvailable) {
                    this.state.showMap = true
                }
            }
        },

        generateColorMMap () {
            const colorMapOptions = {
                colormap: 'hsv',
                nshades: Math.max(11, this.setOfModes.length),
                format: 'rgbaString',
                alpha: 1
            }
            // colormap used on legend.
            this.state.cssColors = colormap(colorMapOptions)

            // colormap used on Cesium
            colorMapOptions.format = 'float'
            this.state.colors = []
            // this.translucentColors = []
            for (const rgba of colormap(colorMapOptions)) {
                this.state.colors.push(new Color(rgba[0], rgba[1], rgba[2]))
                // this.translucentColors.push(new Cesium.Color(rgba[0], rgba[1], rgba[2], 0.1))
            }
        },
        setWorldTimeContext () {
            const trajectory = this.state.currentTrajectory
            const startTime = this.state.metadata && this.state.metadata.startTime
            if (!trajectory || trajectory.length === 0 || !(startTime instanceof Date) || isNaN(startTime)) {
                this.state.worldTimeAvailable = false
                this.state.plotTimeMode = 'elapsed'
                return
            }
            const trajectoryTimes = trajectory.map(point => Number(point[3])).filter(Number.isFinite)
            if (trajectoryTimes.length === 0) {
                this.state.worldTimeAvailable = false
                this.state.plotTimeMode = 'elapsed'
                return
            }
            const firstPoint = trajectory[0]
            this.state.worldTimeStartMs = Math.min(...trajectoryTimes)
            this.state.worldTimeZone = tzlookup(firstPoint[1], firstPoint[0])
            this.state.worldTimeAvailable = true
        }
    },
    components: {
        Sidebar,
        Plotly,
        CesiumViewer,
        AtomSpinner,
        TxInputs,
        ParamViewer,
        MessageViewer,
        DeviceIDViewer,
        AttitudeViewer,
        MagFitTool,
        EkfHelperTool
    },
    watch: {
        'state.showMap' () {
            // The plot's container changes height when the map is hidden or
            // restored.  Plotly needs one measurement after Vue has applied
            // that layout change before it can use the reclaimed space.
            this.$nextTick(() => {
                if (this.state.plotOn) this.$eventHub.$emit('force-resize-plotly')
            })
        },
        'state.plotCount' () {
            this.$nextTick(() => {
                if (this.state.plotOn) this.$eventHub.$emit('force-resize-plotly')
            })
        }
    },
    computed: {
        sidebarWidthBounds () {
            return getSidebarWidthBounds(this.viewportWidth)
        },
        sidebarWidth () {
            return getSidebarWidth(this.viewportWidth, this.requestedSidebarWidth)
        },
        sidebarAriaMinimum () {
            return Math.min(this.sidebarWidthBounds.minimum, this.sidebarWidth)
        },
        sidebarOverlay () {
            return isSidebarOverlay(this.viewportWidth)
        },
        sidebarStyle () {
            return {
                width: `${this.sidebarWidth}px`,
                maxWidth: 'none',
                flexBasis: `${this.sidebarWidth}px`
            }
        },
        mainStyle () {
            if (this.sidebarOverlay) {
                return { width: '100%', maxWidth: 'none', marginLeft: '0' }
            }
            return {
                width: `calc(100% - ${this.sidebarWidth}px)`,
                maxWidth: 'none',
                marginLeft: `${this.sidebarWidth}px`
            }
        },
        mapOk () {
            return (this.state.flightModeChanges !== undefined &&
                    this.state.currentTrajectory !== undefined &&
                    this.state.currentTrajectory.length > 0 &&
                    (Object.keys(this.state.timeAttitude).length > 0 ||
                        Object.keys(this.state.timeAttitudeQ).length > 0))
        },
        setOfModes () {
            const set = []
            if (!this.state.flightModeChanges) {
                return []
            }
            for (const mode of this.state.flightModeChanges) {
                if (!set.includes(mode[1])) {
                    set.push(mode[1])
                }
            }
            return set
        }
    }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

    .viewer-layout {
        overflow: hidden;
    }

    .viewer-main {
        position: relative;
        height: 100%;
        min-width: 0;
        padding: 0;
    }

    .sidebar-resizer {
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        z-index: 1003;
        width: 16px;
        cursor: col-resize;
        touch-action: none;
        outline: none;
    }

    .sidebar-resizer::before {
        position: absolute;
        top: 0;
        bottom: 0;
        right: 0;
        width: 2px;
        background: rgba(100, 233, 255, 0.28);
        content: '';
    }

    .sidebar-resizer:hover::before,
    .sidebar-resizer:focus::before,
    .pane-resizing .sidebar-resizer::before {
        background: #64e9ff;
    }

    .sidebar-resizer-grip {
        position: absolute;
        top: 50%;
        right: 1px;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 14px;
        height: 54px;
        border: 1px solid rgba(100, 233, 255, 0.6);
        border-radius: 7px;
        background: rgb(29, 36, 52);
        color: #64e9ff;
        font-size: 22px;
        line-height: 1;
        transform: translateY(-50%);
    }

    .pane-resizing,
    .pane-resizing * {
        cursor: col-resize !important;
        user-select: none !important;
    }

    .global-token-warning {
        position: fixed;
        top: 8px;
        left: 8px;
        right: 8px;
        z-index: 1200;
        padding: 10px 12px;
        border: 1px solid #f2b000;
        border-radius: 4px;
        background: rgba(44, 33, 10, 0.95);
        color: #ffd75e;
        font-family: 'Montserrat', sans-serif;
        font-size: 12px;
    }

    .nav-side-menu ul :not(collapsed) .arrow:before,
    .nav-side-menu li :not(collapsed) .arrow:before {
        font-family: 'Montserrat', sans-serif;
        content: "\f078";
        display: inline-block;
        padding-left: 10px;
        padding-right: 10px;
        vertical-align: middle;
        float: right;
    }

    body {
        margin: 0;
        padding: 0;
    }

    .container-fluid {
        padding-left: 0;
        padding-right: 0;
    }

    div .col-12 {
        padding-left: 0;
        padding-right: 0;
    }

    i {
        margin: 10px;
    }

    i .dropdown {
        float: right;
    }

    .noPadding {
        padding-left: 4px;
        padding-right: 6px;
        max-height: 100%;
    }

    .plot-with-map {
        height: 66.666667% !important;
    }

    .map-with-plot {
        height: 33.333333% !important;
    }

    .plot-panels {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
    }

    .plot-panels > div {
        flex: 1 1 0;
        min-height: 0;
    }

    div #waiting {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000;
        display: block;
        background-color: black;
        opacity: 0.75;
        text-align: center;
    }

    @media only screen and (max-width: 991px) {
        .viewer-main {
            height: 93%;
            margin-top: 45px !important;
        }
    }

    .map-error-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        background-color: #1a1e24;
        color: #e0e6ed;
        text-align: center;
        padding: 2rem;
        border: 1px solid #3d4450;
        border-radius: 8px;
        margin: 10px;
    }

    .map-error-container i {
        font-size: 3rem;
        color: #ffcc00;
        margin-bottom: 1rem;
    }

    .map-error-container h3 {
        margin-bottom: 0.5rem;
        color: #64e9ff;
    }

    .map-error-container p {
        max-width: 500px;
        margin-bottom: 1.5rem;
        color: #acb6c2;
    }

    /* ATOM SPINNER */

      div .atom-spinner {
        margin: auto;
        margin-top: 15%;
    }

</style>
<style>
a {
    color: #ffffff !important;
}
</style>
