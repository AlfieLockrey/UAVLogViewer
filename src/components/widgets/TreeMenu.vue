<template>
    <div>
        <li v-b-toggle="cleanName"  :style="{'margin-left': ''+level*15+'px'}">
            <a class="section">
                {{label}}
                <i class="fas fa-caret-down"></i></a>
        </li>
        <template v-if="nodes.length === undefined">
            <b-collapse :id="cleanName">
                <template v-for="(newNode, nodeName) in nodes">
                    <tree-menu
                        v-if="newNode.length === undefined && newNode.messages === undefined"
                        :label="nodeName"
                        :nodes="newNode"
                        :level="level+1"
                        :name="name+nodeName+ '/'"
                        :clean-name="cleanNodeName(nodeName)"
                        :key="cleanNodeName(nodeName)">
                    </tree-menu>
                    <li :style="{'margin-left': ''+(level+1)*15+'px'}"
                        v-if="newNode.messages !== undefined && newNode.messages.length !== undefined"
                        class="type"
                        :key="cleanNodeName(nodeName)">
                        <a
                            @click="openPreset(newNode.messages, name + nodeName)"
                            class="section"
                        >
                            {{nodeName}}
                        </a>
                        <!-- TODO: remove this hacky check when presets use a better data sctructure -->
                        <a @click="deletePreset(name+nodeName)"
                            v-if="newNode[Object.keys(newNode)[0]][0][7] === 'local'">
                            <i class="remove-icon fas fa-trash" title="Delete preset"></i>
                        </a>

                    </li>

                </template>
            </b-collapse>
        </template>

    </div>
</template>

<script>
import { store } from '../Globals.js'

export default {
    props: {
        label: String,
        nodes: Object,
        level: Number,
        name: {
            type: String,
            default: ''
        },
        cleanName: {
            type: String,
            default: ''
        }
    },
    name: 'tree-menu',
    data () {
        return {
            state: store
        }
    },
    methods: {
        cleanNodeName (name) {
            return name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
        },
        deletePreset (preset) {
            const text = `Are you sure you want to delete the preset "${preset}"?`
            if (confirm(text) === false) {
                return
            }
            const myStorage = window.localStorage
            let saved = myStorage.getItem('savedFields')
            if (saved === null) {
                return
            } else {
                saved = JSON.parse(saved)
            }
            delete saved[preset]
            myStorage.setItem('savedFields', JSON.stringify(saved))
            const savedAxisLabels = JSON.parse(myStorage.getItem('savedAxisLabels')) || {}
            delete savedAxisLabels[preset]
            myStorage.setItem('savedAxisLabels', JSON.stringify(savedAxisLabels))
            this.$eventHub.$emit('presetsChanged')
        },
        openPreset (preset, presetName) {
            const savedAxisRanges = JSON.parse(window.localStorage.getItem('savedAxisRanges')) || {}
            const sharedAxisRanges = JSON.parse(window.localStorage.getItem('sharedAxisRanges')) || {}
            const savedAxisLabels = JSON.parse(window.localStorage.getItem('savedAxisLabels')) || {}
            const sharedAxisLabels = JSON.parse(window.localStorage.getItem('sharedAxisLabels')) || {}
            const isShared = preset[0] && preset[0][7] === 'shared'
            const yAxisRanges = (isShared ? sharedAxisRanges : savedAxisRanges)[presetName] || null
            const yAxisLabels = (isShared ? sharedAxisLabels : savedAxisLabels)[presetName] || null
            const msgs = preset.map(msg =>
                [msg[0], msg[1], msg[2], msg[3], msg[4], msg[5], msg[6], msg[7], msg[8]]
            )
            this.state.plotOn = true
            this.$nextTick(function () {
                // Plotly is not mounted until plotOn becomes true on a fresh
                // log, so all preset events must be emitted after that tick.
                this.$eventHub.$emit('clearPlot')
                this.$eventHub.$emit('setPresetYAxisRanges', yAxisRanges, true)
                this.$eventHub.$emit('setPresetYAxisLabels', yAxisLabels)
                this.$eventHub.$emit('addPlots', msgs)
            })
        }
    }
}

</script>

<style scoped>

</style>
