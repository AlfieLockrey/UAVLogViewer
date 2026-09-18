<template>
    <div id="line" ref="line" style="width:100%;height: 100%"></div>
</template>

<script>
import Plotly from 'plotly.js'
import { store } from './Globals.js'
import * as d3 from 'd3'
import { faWindowRestore } from '@fortawesome/free-solid-svg-icons'
import Vue from 'vue'
import { isNumber } from 'underscore'
import { getAxisTitle, getTraceLabel } from '../tools/plotLabels.js'
import { getElapsedOrigin, getPlotHoverTemplate, getPlotHoverValues, getPlotTimeAxis } from '../tools/plotTimeAxis.js'
import { getPlotStatistics } from '../tools/plotStatistics.js'
import {
    annotationSources, combineAnnotationSets, createTextMessageAnnotations
} from '../tools/plotAnnotations.js'

const Color = require('color')

const timeformat = ':02,2f'
let annotationsEvents = []
let annotationsModes = []
let annotationsParams = []
let annotationsMsg = []
let annotationsStatusText = []

const plotOptions = {
    legend: {
        x: 0.1,
        y: 1,
        traceorder: 'normal',
        borderwidth: 1
    },
    showlegend: false,
    // eslint-disable-next-line
    plot_bgcolor: '#f8f8f8',
    // eslint-disable-next-line
    paper_bgcolor: 'white',
    // autosize: true,
    margin: { t: 20, l: 0, b: 30, r: 10 },
    xaxis: {
        title: 'Time since boot',
        domain: [0.15, 0.85],
        rangeslider: {},
        tickformat: timeformat
    },
    yaxis: {
        // title: 'axis1',
        titlefont: {
            color: '#1f77b4'
        },
        tickfont: {
            color: '#1f77b4', size: 12
        },
        anchor: 'free',
        position: 0.03,
        autotick: true,
        showline: true,
        ticklen: 3,
        tickangle: 45
    },
    yaxis2: {
        // title: 'yaxis2 title',
        titlefont: { color: '#ff7f0e' },
        tickfont: { color: '#ff7f0e', size: 12 },
        anchor: 'free',
        overlaying: 'y',
        side: 'left',
        position: 0.07,
        autotick: true,
        showline: true,
        ticklen: 3,
        tickangle: 45
    },
    yaxis3: {
        // title: 'yaxis4 title',
        titlefont: { color: '#2ca02c' },
        tickfont: { color: '#2ca02c' },
        anchor: 'free',
        overlaying: 'y',
        side: 'left',
        position: 0.11,
        autotick: true,
        showline: true,
        ticklen: 3,
        tickangle: 45
    },
    yaxis4: {
        // title: 'yaxis5 title',
        titlefont: { color: '#d62728' },
        tickfont: { color: '#d62728' },
        anchor: 'free',
        overlaying: 'y',
        side: 'left',
        position: 0.92,
        autotick: true,
        showline: true,
        ticklen: 3,
        tickangle: 45
    },
    yaxis5: {
        // title: 'yaxis5 title',
        titlefont: { color: '#9467BD' },
        tickfont: { color: '#9467BD' },
        anchor: 'free',
        overlaying: 'y',
        side: 'left',
        position: 0.96,
        autotick: true,
        showline: true,
        ticklen: 3,
        tickangle: 45
    },
    yaxis6: {
        // title: 'yaxis5 title',
        titlefont: { color: '#8C564B' },
        tickfont: { color: '#8C564B' },
        anchor: 'free',
        overlaying: 'y',
        side: 'left',
        position: 1.0,
        autotick: true,
        showline: true,
        ticklen: 3,
        tickangle: 45
    }

}

export default {
    created () {
        this.$eventHub.$on('cesium-time-changed', this.setCursorTime)
        this.$eventHub.$on('hoveredTime', this.setCursorTime)
        this.$eventHub.$on('force-resize-plotly', this.resize)
        this.$eventHub.$on('child-zoomed', this.onTimeRangeChanged)
        this.zoomInterval = null
    },
    mounted () {
        const WIDTH_IN_PERCENT_OF_PARENT = 90
        d3.select('#line')
            .append('div')
            .style({
                width: '100%',
                'margin-left': (100 - WIDTH_IN_PERCENT_OF_PARENT) / 2 + '%',
                height: '100%'
            })

        this.gd = d3.select('#line').node()
        const _this = this
        this.$nextTick(function () {
            if (this.$route.query.ranges) {
                const ranges = []
                for (const field of this.$route.query.ranges.split(',')) {
                    ranges.push(parseFloat(field))
                }
                if (ranges.length > 0) {
                    plotOptions.xaxis.range = [ranges[0], ranges[1]]
                }
                if (ranges.length >= 4) {
                    plotOptions.yaxis.range = [ranges[2], ranges[3]]
                }
                if (ranges.length >= 6) {
                    plotOptions.yaxis2.range = [ranges[4], ranges[5]]
                }
                if (ranges.length >= 8) {
                    plotOptions.yaxis3.range = [ranges[6], ranges[7]]
                }
                if (ranges.length >= 10) {
                    plotOptions.yaxis4.range = [ranges[8], ranges[9]]
                }
            }
            if (this.$route.query.plots) {
                for (const field of this.$route.query.plots.split(',')) {
                    _this.addPlots([field])
                }
            }
        })
        this.instruction = ''
        this.$eventHub.$on('togglePlot', this.togglePlot)
        this.$eventHub.$on('removeExpression', this.removeExpression)
        this.$eventHub.$on('addPlots', this.addPlots)
        this.$eventHub.$on('plot', this.plot)
        this.$eventHub.$on('clearPlot', this.clearPlot)
        this.$eventHub.$on('setPresetYAxisRanges', this.setPresetYAxisRanges)
        this.$eventHub.$on('setPresetYAxisLabels', this.setPresetYAxisLabels)
    },
    beforeDestroy () {
        this.$eventHub.$off('animation-changed')
        this.$eventHub.$off('cesium-time-changed')
        this.$eventHub.$off('addPlots')
        this.$eventHub.$off('hidePlot')
        this.$eventHub.$off('togglePlot')
        this.$eventHub.$off('removeExpression')
        this.$eventHub.$off('clearPlot')
        this.$eventHub.$off('setPresetYAxisRanges')
        this.$eventHub.$off('setPresetYAxisLabels')
        if (this.statisticsUpdateTimer !== null) clearTimeout(this.statisticsUpdateTimer)
        clearInterval(this.interval)
    },
    data () {
        return {
            gd: null,
            plotInstance: null,
            state: store,
            timeAxisContext: null,
            waitingForMessages: false,
            unavailableMessages: new Set(),
            loadingPresetYAxisRanges: false,
            plotGeneration: 0,
            statisticsUpdateTimer: null,
            expressionTraceIndexes: [],
            cursorTime: null
        }
    },
    methods: {
        popupButton () {
            return {
                name: 'Open in new window',
                icon: {
                    title: 'test',
                    name: 'iconFS',
                    width: 600,
                    height: 600,
                    path: faWindowRestore.icon[4]
                }, // Use any icon available
                click: (gd) => {
                    // const plotData = JSON.parse(JSON.stringify(gd.data))
                    // const plotLayout = JSON.parse(JSON.stringify(gd.layout))
                    // const plotConfig = { showLink: false, displayModeBar: true }

                    // Open a new window
                    const newWindow = window.open(
                        '/#/plot', '_blank',
                        'toolbar=no,scrollbars=yes,resizable=yes,top=500,left=500,width=800,height=400,allow-scripts'
                    )
                    const externalPlotInterval = setInterval(() => {
                        try {
                            console.log(newWindow)
                            console.log(newWindow.setPlotData)
                            newWindow.setPlotData(gd.data)
                            newWindow.setPlotOptions(gd.layout)
                            newWindow.setPlotTimeAxis(this.timeAxisContext)
                            newWindow.setCssColors(this.state.cssColors)
                            newWindow.setFlightModeChanges(this.state.flightModeChanges)
                            newWindow.setAnnotationData(this.getAnnotationSets())
                            console.log(this.$eventHub)
                            newWindow.setEventHub(this.$eventHub)
                            newWindow.plot()
                            clearInterval(externalPlotInterval)
                        } catch (e) {
                            console.log(e)
                        }
                    }, 1000)
                    this.state.childPlots.push(newWindow)
                    console.log(newWindow)
                }
            }
        },
        csvButton () {
            return {
                name: 'downloadCsv',
                title: 'Download data as csv',
                icon: Plotly.Icons.disk,
                click: () => {
                    console.log(this.gd.data)
                    const data = this.gd.data
                    const header = ['timestamp(ms)']
                    for (const series of data) {
                        header.push(series.name.split(' |')[0])
                    }

                    const indexes = []

                    const interval = 100
                    let currentTime = Infinity
                    let finaltime = 0

                    for (const series in data) {
                        indexes.push(0)
                        const x = data[series].x
                        currentTime = Math.min(currentTime, x[0])
                        finaltime = Math.max(finaltime, x[x.length - 1])
                    }
                    finaltime = Math.min(finaltime, this.state.timeRange[1])
                    currentTime = Math.max(currentTime, this.state.timeRange[0])
                    // replace commas with semicolons so csv headers dont break, check #412
                    const csv = [header.map(e => e.replace(',', ';'))]
                    while (currentTime < finaltime - interval) {
                        const line = [currentTime]
                        for (const series in data) {
                            let index = indexes[series]
                            let x = data[series].x[index]
                            while (x < currentTime) {
                                indexes[series] += 1
                                index = indexes[series]
                                x = data[series].x[index]
                            }
                            const y = data[series].y[index]
                            const prevX = data[series].x[index - 1]
                            const prevY = data[series].y[index - 1]
                            const interpolatedY = this.interpolateY(prevY, y, prevX, x, currentTime)
                            line.push(interpolatedY)
                        }
                        csv.push(line)
                        currentTime = currentTime + interval
                    }
                    const csvContent = csv.map(e => e.join(',')).join('\n')
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
                    const link = document.createElement('a')
                    const url = URL.createObjectURL(blob)
                    link.setAttribute('href', url)
                    link.setAttribute('download', 'data.csv')
                    link.style.visibility = 'hidden'
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                }
            }
        },
        interpolateY (y1, y2, x1, x2, x) {
            const dx = x2 - x1
            if (dx <= 0) {
                throw new Error('x2 must be greater than x1')
            }
            const dy = y2 - y1
            const slope = dy / dx
            const interpolatedY = y1 + slope * dx
            return interpolatedY
        },
        resize () {
            Promise.resolve(Plotly.Plots.resize(this.gd)).then(() => this.updateCursor())
        },
        updateCursor (time = this.cursorTime) {
            if (!this.cursor || !this.gd) return
            const bglayer = this.gd.getElementsByClassName('bglayer')[0]
            const rect = bglayer && bglayer.childNodes[0]
            const range = this.gd.layout && this.gd.layout.xaxis && this.gd.layout.xaxis.range
            if (!rect || !range) return

            const x = parseFloat(rect.getAttribute('x'))
            const y = parseFloat(rect.getAttribute('y'))
            const width = parseFloat(rect.getAttribute('width'))
            const height = parseFloat(rect.getAttribute('height'))
            if (![x, y, width, height].every(Number.isFinite)) return

            const cursorX = Number.isFinite(time)
                ? x + width * (time - range[0]) / (range[1] - range[0])
                : x
            this.cursor.setAttribute('x1', cursorX)
            this.cursor.setAttribute('x2', cursorX)
            this.cursor.setAttribute('y1', y)
            this.cursor.setAttribute('y2', y + height)
        },
        waitForMessages (messages, generation = this.plotGeneration) {
            for (const message of messages) {
                this.$eventHub.$emit('loadType', message)
            }
            let interval
            const _this = this
            let counter = 0
            return new Promise((resolve, reject) => {
                interval = setInterval(function () {
                    if (generation !== _this.plotGeneration) {
                        clearInterval(interval)
                        resolve(false)
                        return
                    }
                    for (const message of messages) {
                        if (!_this.loadedMessages().includes(message)) {
                            counter += 1
                            if (counter > 30) { // 30 * 300ms = 9 s timeout
                                console.log('not resolving')
                                clearInterval(interval)
                                reject(new Error(`Could not load messageType ${message}`))
                            }
                            return
                        }
                    }
                    clearInterval(interval)
                    resolve(true)
                }, 300)
            })
        },
        onRangeChanged (event) {
            const eventXRange = event && (event['xaxis.range'] ||
                (Number.isFinite(event['xaxis.range[0]']) && Number.isFinite(event['xaxis.range[1]'])
                    ? [event['xaxis.range[0]'], event['xaxis.range[1]']]
                    : null))
            this.scheduleExpressionStatsUpdate(eventXRange)
            // The relayout payload is the exact range produced by a drag or
            // scroll gesture.  Prefer it over a later layout read so the axis
            // limits controls follow the plot without accumulating tiny
            // floating-point differences during redraws.
            this.captureYAxisRanges(event)
            if (event !== undefined) {
                // this.$router.push({query: query})
                if (event['xaxis.range']) {
                    this.state.timeRange = event['xaxis.range']
                    this.updatChildrenTimeRange(this.state.timeRange)
                }
                if (Number.isFinite(event['xaxis.range[0]']) && Number.isFinite(event['xaxis.range[1]'])) {
                    this.state.timeRange = [event['xaxis.range[0]'], event['xaxis.range[1]']]
                    this.updatChildrenTimeRange(this.state.timeRange)
                }
                if (event['xaxis.autorange']) {
                    this.state.timeRange = [this.gd.layout.xaxis.range[0], this.gd.layout.xaxis.range[1]]
                    this.updatChildrenTimeRange(this.state.timeRange)
                }
            }
        },
        scheduleExpressionStatsUpdate (eventRange) {
            if (this.statisticsUpdateTimer !== null) clearTimeout(this.statisticsUpdateTimer)
            this.statisticsUpdateTimer = setTimeout(() => {
                this.statisticsUpdateTimer = null
                const layout = this.gd && (this.gd._fullLayout || this.gd.layout)
                const finalRange = layout && layout.xaxis && layout.xaxis.range
                this.updateExpressionStats(finalRange || eventRange)
            }, 0)
        },

        onTimeRangeChanged (timeRange) {
            // check if it actually changed, with a delta tolarance
            this.state.timeRange = timeRange

            this.updatChildrenTimeRange(this.state.timeRange)
        },
        updatChildrenTimeRange (timeRange) {
            for (const child of this.state.childPlots) {
                child.setTimeRange(timeRange)
            }
        },
        updateExpressionStats (range) {
            const gd = this.gd
            const xRange = range || gd.layout.xaxis.range

            const statistics = {}
            for (const [traceIndex, expressionIndex] of this.expressionTraceIndexes.entries()) {
                const trace = gd.data[traceIndex]
                if (trace) statistics[expressionIndex] = getPlotStatistics(trace.x, trace.y, xRange)
            }
            this.state.expressionStats = statistics
        },
        isPlotted (fieldname) {
            for (const field of this.state.expressions) {
                if (field.name === fieldname) {
                    return true
                }
            }
            return false
        },
        getFirstFreeAxis () {
            // get free axis number
            for (const i of this.state.allAxis) {
                let taken = false
                for (const field of this.state.expressions) {
                    // eslint-disable-next-line
                    if (field.axis == i) {
                        taken = true
                    }
                }
                if (!taken) {
                    return i
                }
            }
            return this.state.allAxis.length - 1
        },
        getFirstFreeColor () {
            // get free color
            for (const i of this.state.allColors) {
                let taken = false
                for (const field of this.state.expressions) {
                    // eslint-disable-next-line
                    if (field.color == i) {
                        taken = true
                    }
                }
                if (!taken) {
                    return i
                }
            }
            return this.state.allColors[this.state.expressions.length % this.state.allColors.length]
        },
        createNewField (fieldname, axis, color, functionValue, seriesName, opacity, lineStyle, visible) {
            if (color === undefined) {
                color = this.getFirstFreeColor()
            } else if (!isNaN(color)) {
                color = this.state.allColors[color]
            }
            if (axis === undefined) {
                axis = this.getFirstFreeAxis()
            }
            return {
                name: fieldname,
                color: color,
                axis: axis,
                function: functionValue,
                seriesName: typeof seriesName === 'string' ? seriesName : '',
                opacity: typeof opacity === 'number' ? opacity : 1,
                lineStyle: typeof lineStyle === 'string' ? lineStyle : 'solid',
                visible: visible !== false
            }
        },

        addPlots (plots) {
            this.state.plotLoading = true
            const newplots = []
            for (const plot of plots) {
                const expression = plot[0]
                const axis = plot[1]
                const color = plot[2]
                const functionValue = plot[3]
                const seriesName = plot[4]
                const opacity = plot[5]
                const lineStyle = plot[6]
                const visible = plot[8]
                if (!this.isPlotted(expression)) {
                    newplots.push(this.createNewField(
                        expression, axis, color, functionValue, seriesName, opacity, lineStyle, visible
                    ))
                }
            }
            this.state.expressions.push(...newplots)
        },
        removeExpression (index) {
            const expression = this.state.expressions[index]
            if (!expression) return
            this.resetAxis(expression.axis)
            this.state.expressions.splice(index, 1)
            if (this.state.expressions.length === 0) {
                this.state.plotOn = false
            }
            this.onRangeChanged()
        },
        clearPlot () {
            this.plotGeneration += 1
            this.waitingForMessages = false
            this.loadingPresetYAxisRanges = false
            this.state.expressions = []
            this.state.expressionErrors = []
            this.state.expressionStats = {}
            this.state.currentYAxisRanges = {}
            this.state.currentYAxisLabels = {}
            this.state.plotLoading = false
            this.setPresetYAxisRanges(null)
        },
        setPresetYAxisRanges (ranges, loadingPreset = false) {
            this.state.pendingYAxisRanges = ranges
            this.loadingPresetYAxisRanges = loadingPreset
            this.state.currentYAxisRanges = ranges ? { ...ranges } : {}
            if (this.plotInstance !== null) {
                this.applyPresetYAxisRanges()
                Plotly.relayout(this.gd, this.getYAxisLayout())
            }
        },
        setPresetYAxisLabels (labels) {
            this.state.currentYAxisLabels = labels ? { ...labels } : {}
        },
        getYAxisLayout () {
            return this.state.allAxis.reduce((layout, axis) => {
                const key = axis === 0 ? 'yaxis' : `yaxis${axis + 1}`
                layout[key] = plotOptions[key]
                return layout
            }, {})
        },
        captureYAxisRanges (event) {
            const layout = this.gd && (this.gd._fullLayout || this.gd.layout)
            if (!layout) return
            const ranges = { ...this.state.currentYAxisRanges }
            for (const axis of this.state.allAxis) {
                if (!this.state.expressions.some(field => field.axis === axis) && !ranges[axis]) continue
                const key = axis === 0 ? 'yaxis' : `yaxis${axis + 1}`
                const eventRange = event && event[`${key}.range`]
                const eventLower = event && event[`${key}.range[0]`]
                const eventUpper = event && event[`${key}.range[1]`]
                const layoutRange = layout[key] && layout[key].range
                const range = eventRange ||
                    (Number.isFinite(eventLower) && Number.isFinite(eventUpper)
                        ? [eventLower, eventUpper]
                        : layoutRange)
                if (range && Number.isFinite(range[0]) && Number.isFinite(range[1])) {
                    ranges[axis] = [range[0], range[1]]
                }
            }
            this.state.currentYAxisRanges = ranges
        },
        applyPresetYAxisRanges (ranges = this.state.currentYAxisRanges) {
            ranges = ranges || {}
            for (const axis of this.state.allAxis) {
                const key = axis === 0 ? 'yaxis' : `yaxis${axis + 1}`
                const range = ranges[axis]
                if (range && Number.isFinite(range[0]) && Number.isFinite(range[1]) && range[0] < range[1]) {
                    // Keep stored ranges independent of Plotly's mutable layout
                    // objects, which prevents repeated plot creation drifting a
                    // saved range by a small amount.
                    plotOptions[key].range = [range[0], range[1]]
                    plotOptions[key].autorange = false
                } else {
                    delete plotOptions[key].range
                    plotOptions[key].autorange = true
                }
            }
        },
        resetAxis (index) {
            // Resets the Y axis so that the next plot autoranges
            // unfortunately the axis are named yaxis, yaxis2, yaxis3... and so on
            let suffix = ''
            suffix = index === 0 ? suffix : parseInt(index) + 1
            const key = 'yaxis' + suffix
            const obj = {}
            // Use older dict and set autorange to true
            obj[key] = plotOptions[key]
            obj[key].autorange = true
            Plotly.relayout(this.gd, obj)
        },
        togglePlot (fieldname, axis, color, silent) {
            if (this.isPlotted((fieldname))) {
                let index
                for (const i in this.state.expressions) {
                    if (this.state.expressions[i].name === fieldname) {
                        index = i
                    }
                }
                this.removeExpression(Number(index))
            } else {
                this.addPlots([[fieldname, axis, color]])
            }
            console.log(this.state.expressions)
            // if (silent !== true) {
            //     this.plot()
            //     this.state.plotLoading = false
            // }
        },
        calculateXAxisDomain () {
            let start = 0.02
            let end = 0.98
            for (const field of this.state.expressions) {
                if (field.axis === 0) {
                    start = Math.max(start, 0.03)
                } else if (field.axis === 1) {
                    start = Math.max(start, 0.07)
                } else if (field.axis === 2) {
                    start = Math.max(start, 0.11)
                } else if (field.axis === 5) {
                    end = Math.min(end, 0.96)
                } else if (field.axis === 4) {
                    end = Math.min(end, 0.92)
                } else if (field.axis === 3) {
                    end = Math.min(end, 0.88)
                }
            }
            return [start, end]
        },
        getTimeAxisContext (traces) {
            const mode = this.state.plotTimeMode === 'world' && this.state.worldTimeAvailable ? 'world' : 'elapsed'
            return {
                mode,
                elapsedOrigin: getElapsedOrigin(this.state.events, traces),
                worldStart: this.state.metadata && this.state.metadata.startTime,
                worldStartMs: this.state.worldTimeStartMs,
                worldTimeZone: this.state.worldTimeZone
            }
        },
        getTimeAxis (range) {
            if (!this.timeAxisContext) return {}
            return getPlotTimeAxis(
                range, this.timeAxisContext, this.calculateXAxisDomain(), this.state.showRangeSlider
            )
        },
        getAnnotationSets () {
            return {
                events: annotationsEvents,
                params: annotationsParams,
                msg: annotationsMsg,
                statusText: annotationsStatusText,
                modes: annotationsModes
            }
        },
        getAnnotationMenu () {
            return [{
                active: -1,
                buttons: annotationSources.map(source => ({
                    args: [source],
                    label: `${this.state.annotationVisibility[source] ? '[x]' : '[ ]'} ${this.annotationLabel(source)}`,
                    method: 'skip'
                })),
                direction: 'right',
                pad: { r: 10, t: 10 },
                showactive: false,
                type: 'buttons',
                x: 0.1,
                xanchor: 'left',
                y: 1.2,
                yanchor: 'top'
            }]
        },
        annotationLabel (source) {
            return { events: 'Events', params: 'Params', msg: 'MSG', statusText: 'STATUSTEXT' }[source]
        },
        onAnnotationButtonClicked (event) {
            const source = event.button && event.button.args && event.button.args[0]
            if (!annotationSources.includes(source)) return
            this.state.annotationVisibility[source] = !this.state.annotationVisibility[source]
            this.applyAnnotations()
        },
        applyAnnotations () {
            if (!this.gd) return
            Plotly.relayout(this.gd, {
                annotations: combineAnnotationSets(this.getAnnotationSets(), this.state.annotationVisibility),
                updatemenus: this.getAnnotationMenu()
            })
        },
        getDataRange (traces) {
            let start = Infinity
            let end = -Infinity
            for (const trace of traces) {
                if (!trace.x || trace.x.length === 0 ||
                    !Number.isFinite(trace.x[0]) || !Number.isFinite(trace.x[trace.x.length - 1])) continue
                start = Math.min(start, trace.x[0])
                end = Math.max(end, trace.x[trace.x.length - 1])
            }
            return Number.isFinite(start) && Number.isFinite(end) ? [start, end] : null
        },
        updateChildTimeAxes () {
            for (const child of this.state.childPlots) {
                if (child && child.setPlotTimeAxis) child.setPlotTimeAxis(this.timeAxisContext)
            }
        },
        getAxisTitle (fieldAxis) {
            return getAxisTitle(this.state.expressions, fieldAxis, this.state.currentYAxisLabels)
        },
        findMessagesInExpression (expression) {
            const RE = /(?<message>[A-Z][A-Z0-9_]+(\[[A-Za-z0-9_.%]+\])?)(\.(?<field>[A-Za-z0-9_]+))?/g
            const match = []
            for (const m of expression.matchAll(RE)) {
                match.push([m.groups.message, m.groups.field])
            }
            return match
        },
        expressionCanBePlotted (expression, reask = false) {
            // TODO: USE this regex with lookahead once firefox supports it
            // let RE = /(?<!\.)\b[A-Z][A-Z0-9_]+\b/g
            // let fields = expression.name.match(RE)
            const messages = this.findMessagesInExpression(expression.name)

            if (messages === null) {
                return [true, '']
            }
            for (const [message, field] of messages) {
                if (!(this.messagesInLog.includes(message))) {
                    console.log('ERROR: attempted to plot unavailable message: ' + message)
                    this.state.plotLoading = false
                    if (reask) {
                        this.$eventHub.$emit('loadType', message)
                    }
                    return [false, `invalid message: ${message}`]
                }
                if (field !== undefined) {
                    if (field !== 'time_boot_ms' && this.state.messageTypes[message].expressions.indexOf(field) < 0) {
                        console.log('ERROR: attempted to plot unavailable field: ' + field)
                        return [false, `invalid field: ${message}.${field}`]
                    }
                }
                console.log(message + ' is plottable')
            }
            return [true, '']
        },
        messagesAreAvailable (messages) {
            // TODO: USE this regex with lookahead once firefox supports it
            // let RE = /(?<!\.)\b[A-Z][A-Z0-9_]+\b/g
            // let fields = expression.name.match(RE)
            for (const message of messages) {
                if (!(message in this.state.messages) || this.state.messages[message].length === 0) {
                    if (!((message) in this.state.messages) ||
                        this.state.messages[message].length === 0) {
                        return false
                    }
                }
            }
            return true
        },
        evaluateExpression (expression1) {
            const start = new Date()
            if (expression1 in this.state.plotCache) {
                console.log('HIT: ' + expression1)
                return this.state.plotCache[expression1]
            }
            console.log('MISS! evaluating : ' + expression1)
            // TODO: USE this regex with lookahead once firefox supports it
            // let RE = /(?<!\.)\b[A-Z][A-Z0-9_]+\b/g
            let fields = this.findMessagesInExpression(expression1).map(field => field[0])
            console.log(fields)
            fields = fields === null ? [] : fields
            const messages = fields.length !== 0 ? (fields) : []
            // use time of first message for now
            let x
            if (messages.length > 0) {
                if (this.state.messages[messages[0]] === undefined) {
                    console.log('ERROR: message ' + messages[0] + ' not found')
                    return { error: 'message ' + messages[0] + ' not found' }
                }
                x = this.state.messages[messages[0]].time_boot_ms
            } else {
                try {
                    x = this.state.messages.ATT.time_boot_ms
                } catch {
                    try {
                        x = this.state.messages.ATTITUDE.time_boot_ms
                    } catch {
                        x = this.state.messages.osd.time_boot_ms
                    }
                }
            }
            // used to find the corresponding time indexes between messages
            const timeIndexes = new Array(fields.length).fill(0)
            const y = []
            let expression = expression1
            // eslint-disable-next-line
            for (let field in fields) {
                if (isNaN(field)) {
                    break
                }
                // first looks for fields in the expression
                if (expression.includes(`${fields[field]}.`)) {
                    expression = expression.replaceAll(`${fields[field]}.`, 'a[' + field + '].')
                    continue
                }
                // fallback to replacing message name instead
                expression = expression.replaceAll(`${fields[field]}`, 'a[' + field + ']')
            }
            let f
            try {
                // eslint-disable-next-line
                f = new Function('a', 'return ' + expression)
            } catch (e) {
                return { error: e }
            }
            for (const time of x) {
                const vals = []
                for (const fieldIndex in timeIndexes) { // array of indexes, one for each field
                    const messageData = this.state.messages[messages[fieldIndex]]
                    const lastIndex = messageData.time_boot_ms.length - 1
                    while (timeIndexes[fieldIndex] < lastIndex &&
                        messageData.time_boot_ms[timeIndexes[fieldIndex]] < time) {
                        timeIndexes[fieldIndex] += 1
                    }
                    const newobj = {}
                    for (const key of Object.keys(messageData)) {
                        newobj[key] = messageData[key][timeIndexes[fieldIndex]]
                    }
                    vals.push(newobj)
                }
                try {
                    const val = f(vals)
                    if (!isNumber(val)) {
                        console.log(val)
                        throw new Error('Expression does not result in a number')
                    } else if (val !== null) {
                        y.push(val)
                    }
                } catch (e) {
                    return { error: e }
                }
            }
            console.log('evaluated ' + expression)
            const data = this.addGaps({
                x: x,
                y: y
            })
            Vue.set(this.state.plotCache, expression1, data)
            // this.state.plotCache[expression1] = data
            console.log('Evaluation took ' + (new Date() - start) + 'ms')
            this.cleanupCache()
            return data
        },
        cleanupCache () {
            const keys = Object.keys(this.state.plotCache)
            for (const key of keys) {
                if (this.state.expressions.map(e => e.name).indexOf(key) < 0) {
                    delete this.state.plotCache[key]
                }
            }
        },
        addGaps (data) {
            // Creates artifical gaps in order to break lines in plot when messages are not being received
            const newData = { x: [], y: [], isSwissCheese: false }
            let lastx = data.x[0]
            const totalPoints = data.x.length
            let totalGaps = 0
            for (let i = 0; i < data.x.length; i++) {
                if ((data.x[i] - lastx) > 3000) {
                    newData.x.push(data.x[i] - 1)
                    newData.y.push(null)
                    totalGaps += 1
                }
                newData.x.push(data.x[i])
                newData.y.push(data.y[i])
                lastx = data.x[i]
            }
            if (totalGaps > (totalPoints / 2) || totalPoints < 100) {
                newData.isSwissCheese = true
            }
            return newData
        },
        plot () {
            console.log('plot()')
            const generation = this.plotGeneration
            if (this.state.expressions.length === 0) {
                console.log('no expressions to plot')
                if (generation === this.plotGeneration) this.state.plotLoading = false
                return
            }
            this.state.plotLoading = true
            plotOptions.title = this.state.file
            const datasets = []
            const expressionTraceIndexes = []
            for (const message of this.unavailableMessages) {
                if (message in this.state.messages) this.unavailableMessages.delete(message)
            }
            for (const axis of this.state.allAxis) {
                const axisName = axis > 0 ? `yaxis${axis + 1}` : 'yaxis'
                plotOptions[axisName].title = ''
            }
            const entries = this.state.expressions.map((expression, index) => {
                const [canPlot, error] = this.expressionCanBePlotted(expression, false)
                const messages = this.findMessagesInExpression(expression.name).map(message => message[0])
                const unavailable = messages.find(message => this.unavailableMessages.has(message))
                return {
                    expression,
                    index,
                    canPlot: canPlot && unavailable === undefined,
                    error: unavailable === undefined ? error : `Could not load message: ${unavailable}`,
                    messages
                }
            })
            this.state.expressionErrors = entries.map(entry => entry.error)
            const messages = [...new Set(entries.filter(entry => entry.canPlot).flatMap(entry => entry.messages))]
            const missingMessages = messages.filter(message => !(message in this.state.messages) ||
                this.state.messages[message].length === 0)
            if (missingMessages.length > 0) {
                if (this.waitingForMessages === generation) return
                this.waitingForMessages = generation
                this.waitForMessages(missingMessages, generation).then((loaded) => {
                    if (generation !== this.plotGeneration || !loaded) return
                    this.waitingForMessages = false
                    this.plot()
                }).catch((error) => {
                    if (generation !== this.plotGeneration) return
                    this.waitingForMessages = false
                    for (const message of missingMessages) this.unavailableMessages.add(message)
                    console.error(error)
                    this.plot()
                })
                return
            }
            for (const entry of entries) {
                if (!entry.canPlot) continue
                const { expression, index } = entry
                const data = this.evaluateExpression(expression.name)
                if ('error' in data) {
                    this.$set(this.state.expressionErrors, index, data.error)
                    continue
                }
                console.log(data)
                const mode = data.isSwissCheese ? 'lines+markers' : 'lines'

                const regularMarker = {
                    size: 4,
                    color: expression.color
                }

                const crossMarker = {
                    size: 5,
                    symbol: 'cross-thin',
                    color: expression.color,
                    line: {
                        color: expression.color,
                        width: 1
                    }
                }
                const marker = data.isSwissCheese ? crossMarker : regularMarker
                datasets.push({
                    name: getTraceLabel(expression),
                    meta: getTraceLabel(expression),
                    hovertemplate: '',
                    // type: 'scattergl',
                    mode: mode,
                    x: data.x,
                    y: data.y,
                    yaxis: 'y' + (expression.axis + 1),
                    opacity: expression.visible === false ? 0 : expression.opacity,
                    line: {
                        color: expression.color,
                        dash: expression.lineStyle,
                        width: 1.5
                    },
                    marker: marker
                })
                expressionTraceIndexes.push(index)
                const axisname = expression.axis > 0 ? ('yaxis' + (expression.axis + 1)) : 'yaxis'

                if (expression.axis <= 6) {
                    plotOptions[axisname].title = {
                        text: this.getAxisTitle(expression.axis),
                        font: {
                            color: expression.color
                        }
                    }
                    plotOptions[axisname].tickfont.color = expression.color
                    /* if (this.state.messageTypes[msgtype].complexFields[msgfield].units !== '?') {
                         plotOptions[axisname].title.text +=
                            ' (' + this.state.messageTypes[msgtype].complexFields[msgfield].units + ')'
                    } */
                }
            }
            this.timeAxisContext = this.getTimeAxisContext(datasets)
            for (const trace of datasets) {
                trace.customdata = getPlotHoverValues(trace.x, this.timeAxisContext)
                trace.hovertemplate = getPlotHoverTemplate(this.timeAxisContext)
            }
            let start = new Date()
            console.log('starting plotting itself...')

            const plotData = datasets
            this.expressionTraceIndexes = expressionTraceIndexes

            if (!this.loadingPresetYAxisRanges) this.captureYAxisRanges()
            this.applyPresetYAxisRanges(
                this.loadingPresetYAxisRanges ? this.state.pendingYAxisRanges : this.state.currentYAxisRanges
            )

            const xRange = this.plotInstance !== null && this.gd && this.gd._fullLayout.xaxis.range
                ? this.gd._fullLayout.xaxis.range
                : this.getDataRange(datasets)
            plotOptions.xaxis = this.getTimeAxis(xRange)
            if (xRange !== null) plotOptions.xaxis.range = xRange
            if (this.plotInstance !== null) {
                this.plotInstance = Plotly.newPlot(
                    this.gd, plotData, plotOptions, { scrollZoom: true, responsive: true }
                )
            } else {
                this.plotInstance = Plotly.newPlot(
                    this.gd,
                    plotData,
                    plotOptions,
                    {
                        modeBarButtonsToAdd: [this.csvButton(), this.popupButton()],
                        scrollZoom: true,
                        editable: true,
                        responsive: true
                    }
                )
            }
            console.log('plotting done in ' + (new Date() - start) + 'ms')
            Promise.resolve(this.plotInstance).then(() => {
                if (generation !== this.plotGeneration) return null
                // Plotly can perform a final autorange while completing newPlot.  Apply
                // a loaded preset once more after that pass so its saved limits win.
                if (this.loadingPresetYAxisRanges && this.state.pendingYAxisRanges &&
                    Object.keys(this.state.pendingYAxisRanges).length) {
                    this.applyPresetYAxisRanges(this.state.pendingYAxisRanges)
                    return Plotly.relayout(this.gd, this.getYAxisLayout())
                }
                return null
            }).then(() => {
                if (generation !== this.plotGeneration) return
                this.captureYAxisRanges()
                if (this.loadingPresetYAxisRanges) {
                    this.loadingPresetYAxisRanges = false
                    this.state.pendingYAxisRanges = null
                }
            })
            start = new Date()
            // Plotly.newPlot() purges every listener on the graph div, so these
            // handlers must be attached again after every plot recreation.
            this.gd.on('plotly_relayout', this.onRangeChanged)
            this.gd.on('plotly_hover', (data) => {
                this.$eventHub.$emit('hoveredTime', data.points[0].x)
            })
            this.gd.on('plotly_buttonclicked', this.onAnnotationButtonClicked)
            this.updateExpressionStats()

            this.addModeShapes()
            this.addEvents()
            this.addParamChanges()
            this.addTextMessageAnnotations()

            if (generation === this.plotGeneration) this.state.plotLoading = false
            this.updateChildTimeAxes()

            const bglayer = this.gd.getElementsByClassName('bglayer')[0]
            this.cursor = document.createElementNS('http://www.w3.org/2000/svg', 'line')
            this.cursor.setAttribute('id', 'batata')
            this.cursor.setAttribute('stroke-width', 1)
            this.cursor.setAttribute('stroke', 'black')
            bglayer.append(this.cursor)
            this.updateCursor()
            console.log('layout done in ' + (new Date() - start) + 'ms')
        },
        setCursorTime (time) {
            console.log('master got hover event at ' + time + 'ms')
            this.cursorTime = time
            this.updateCursor()
        },
        getMode (time) {
            for (const mode in this.state.flightModeChanges) {
                if (this.state.flightModeChanges[mode][0] > time) {
                    if (mode - 1 < 0) {
                        return this.state.flightModeChanges[0][1]
                    }
                    return this.state.flightModeChanges[mode - 1][1]
                }
            }
            return this.state.flightModeChanges[this.state.flightModeChanges.length - 1][1]
        },
        getModeColor (time) {
            return this.state.cssColors[this.setOfModes.indexOf(this.getMode(time))]
        },
        darker (color) {
            return Color(color).darken(0.2).string()
        },
        addModeShapes () {
            const shapes = []
            const modeChanges = [...this.state.flightModeChanges]
            modeChanges.push([this.gd.layout.xaxis.range[1], null])

            for (let i = 0; i < modeChanges.length - 1; i++) {
                shapes.push(
                    {
                        type: 'rect',
                        // x-reference is assigned to the x-values
                        xref: 'x',
                        // y-reference is assigned to the plot paper [0,1]
                        yref: 'paper',
                        x0: modeChanges[i][0],
                        y0: 0,
                        x1: modeChanges[i + 1][0],
                        y1: 1,
                        fillcolor: this.getModeColor(modeChanges[i][0] + 1),
                        opacity: 0.15,
                        line: {
                            width: 0
                        }
                    }
                )
            }
            Plotly.relayout(this.gd, {
                shapes: shapes
            })
        },
        addEvents () {
            annotationsEvents = []
            annotationsModes = []
            let i = -300
            for (const event of this.state.events) {
                annotationsEvents.push(
                    {
                        xref: 'x',
                        yref: 'paper',
                        x: event[0],
                        y: 0,
                        yanchor: 'bottom',
                        text: event[1].toLowerCase(),
                        showarrow: true,
                        arrowwidth: 1,
                        arrowcolor: '#999999',
                        ay: i,
                        ax: 0
                    }
                )
                i += 23
                if (i > 0) {
                    i = -300
                }
            }
            const modeChanges = [...this.state.flightModeChanges]
            modeChanges.push([this.gd.layout.xaxis.range[1], null])
            for (let i = 0; i < modeChanges.length - 1; i++) {
                annotationsModes.push(
                    {
                        xref: 'x',
                        // y-reference is assigned to the plot paper [0,1]
                        yref: 'paper',
                        x: modeChanges[i][0],
                        xanchor: 'left',
                        y: 0,
                        textangle: 90,
                        text: '<b>' + modeChanges[i][1] + '</b>',
                        showarrow: false,
                        font: {
                            color: this.darker(this.getModeColor(modeChanges[i][0] + 1))
                        },
                        opacity: 1
                    }
                )
            }
            this.applyAnnotations()
        },
        addParamChanges () {
            if (!this.state.params) {
                return
            }
            let i = -300
            annotationsParams = []
            const firstFetch = new Set()
            let startAt = null
            for (const change of this.state.params.changeArray) {
                if (!firstFetch.has(change[1])) {
                    firstFetch.add(change[1])
                } else {
                    startAt = change[0]
                    break
                }
            }
            let last = [0, 0]
            for (const change of this.state.params.changeArray) {
                if (change[0] < startAt) {
                    continue
                }
                // This takes care of repeated param changed logs we get for some reason
                if (change[2] === last[2] && change[1] === last[1]) {
                    continue
                }
                // Filter some "noisy" parameters
                if (['STAT_FLTTIME', 'STAT_RUNTIME'].includes(change[1])) {
                    continue
                }
                last = change
                annotationsParams.push(
                    {
                        xref: 'x',
                        yref: 'paper',
                        x: change[0],
                        y: 0,
                        yanchor: 'bottom',
                        text: change[1] + '->' + change[2].toFixed(4),
                        showarrow: true,
                        arrowwidth: 1,
                        arrowcolor: '#999999',
                        ay: i,
                        ax: 0
                    }
                )
                i += 23
                if (i > 0) {
                    i = -300
                }
            }
            this.applyAnnotations()
        },
        addTextMessageAnnotations () {
            annotationsMsg = createTextMessageAnnotations(this.state.textMessages, 'MSG')
            annotationsStatusText = createTextMessageAnnotations(this.state.textMessages, 'STATUSTEXT')
            this.applyAnnotations()
        },
        loadedMessages () {
            return Object.keys(this.state.messages)
        }
    },
    computed: {
        setOfModes () {
            const set = []
            for (const mode of this.state.flightModeChanges) {
                if (!set.includes(mode[1])) {
                    set.push(mode[1])
                }
            }
            return set
        },
        timeRange () {
            if (this.state.timeRange != null) {
                return this.state.timeRange
            }
            return undefined
        },
        expressions () {
            return this.state.expressions
        },
        messagesInLog () {
            return Object.keys(this.state.messageTypes)
        }
    },
    watch: {
        timeRange (range) {
            if (this.zoomInterval !== null) {
                clearTimeout(this.zoomInterval)
            }
            this.updatChildrenTimeRange(this.state.timeRange)
            this.zoomInterval = setTimeout(() => {
                Plotly.relayout(this.gd, {
                    xaxis: {
                        range: range,
                        ...this.getTimeAxis(range)
                    }
                })
            }, 500)
            return range // make linter happy, it says this is a computed property(?)
        },
        expressions: {
            deep: true,
            handler () {
                this.plot()
            }
        },
        'state.plotTimeMode' (mode) {
            if (mode === 'world' && !this.state.worldTimeAvailable) {
                this.state.plotTimeMode = 'elapsed'
                return
            }
            this.plot()
        },
        'state.currentYAxisLabels' () {
            this.plot()
        },
        'state.showRangeSlider' () {
            this.plot()
        }
    }
}

</script>
<style>
    .js-plotly-plot {
        margin-left: 0 !important;
    }

    .shapelayer path {
        pointer-events: none !important;
    }
</style>
