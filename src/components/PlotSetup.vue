<template>
  <div>
    <li class="type">
      <div v-b-toggle.plotsetupcontent>
        <a class="section">
          Plots Setup
          <i class="expand fas fa-caret-down"></i>
        </a>
      </div>
    </li>
    <b-collapse id="plotsetupcontent" class="menu-content collapse out instant-collapse" visible>
      <ul class="colorpicker plot-wrapper">
        <template v-if="state.expressions.length">
          <template v-for="(field, index) in state.expressions">
            <li class="field plotsetup" :key="'field' + index">
              <expression-editor v-model.lazy="field.name" v-debounce="1000" :suggestions="completionOptions" />
              <input v-model.lazy="field.axisLabel" class="axis-label" type="text" placeholder="Axis label">
              <select v-model.number="field.axis">
                <option v-for="axis in state.allAxis" :key="'axisnumber' + axis" :value="axis">{{ axis }}</option>
              </select>
              <select v-model="field.color" :style="{ color: field.color }">
                <option v-for="color in state.allColors" :key="'axisColor' + color" :value="color"
                  :style="{ color: color }">■
                </option>
              </select>
              <select v-model.number="field.opacity" :disabled="field.visible === false" title="Trace opacity">
                <option :value="1">100%</option>
                <option :value="0.75">75%</option>
                <option :value="0.5">50%</option>
                <option :value="0.25">25%</option>
              </select>
              <select v-model="field.lineStyle" title="Line style">
                <option value="solid">Solid</option>
                <option value="dash">Dashed</option>
                <option value="dot">Dotted</option>
                <option value="dashdot">Dash dot</option>
              </select>
              <input class="trace-visible" :checked="field.visible !== false" type="checkbox"
                title="Show this trace on the plot" @change="field.visible = $event.target.checked">
              <a class="remove-button" @click="$eventHub.$emit('togglePlot', field.name)">
                <i class="expand fas fa-trash" title="Remove data"></i>
              </a>
            </li>
            <li v-if="state.expressionErrors[index]" :key="'field' + index + 'err'" class="error">
              <i class="fas fa-exclamation-circle error" :title="state.expressionErrors[index]"></i>
              {{ state.expressionErrors[index] }}
            </li>
          </template>
        </template>
        <li v-else>Please plot something first.</li>
      </ul>
      <!-- BUTTONS -->
      <div class="btns-wrapper">
        <button class="add-expression" @click="createNewExpression">
          <i class="fa fa-plus" aria-hidden="true"></i>Add Expression
        </button>
        <button v-if="state.expressions.length > 0" class="save-preset" v-b-modal.modal-prevent-closing>
          <i class="fa fa-check-circle" aria-hidden="true"></i>Save Preset
        </button>
        <button v-if="state.expressions.length > 0" class="save-preset" @click="exportPreset">
          <i class="fa fa-download" aria-hidden="true"></i>Export Preset
        </button>
        <button class="save-preset" @click="$refs.presetFile.click()">
          <i class="fa fa-upload" aria-hidden="true"></i>Import Preset
        </button>
        <button v-if="sharedPresetSupported" class="save-preset" @click="chooseSharedPresetFolder">
          <i class="fa fa-folder-open" aria-hidden="true"></i>Preset Folder
        </button>
        <input ref="presetFile" class="preset-file-input" type="file" accept="application/json,.json"
          @change="importPreset">
        <button class="save-preset" v-if="state.expressions.length > 0" v-b-modal.modal-prevent-closing
          @click="$eventHub.$emit('clearPlot')">
          <i class="fa fa-ban" aria-hidden="true"></i>
          clear
        </button>
      </div>
      <small v-if="sharedPresetFolderName" class="shared-preset-folder">
        Shared presets: {{ sharedPresetFolderName }}
      </small>
      <li class="type axis-limits-toggle">
        <div v-b-toggle.axislimitscontent>
          <a class="section">Axis limits <i class="expand fas fa-caret-down"></i></a>
        </div>
      </li>
      <b-collapse id="axislimitscontent" class="menu-content collapse out instant-collapse">
        <div class="axis-limits">
          <div v-for="axis in state.allAxis" :key="'axis-limit-' + axis" class="axis-limit-row">
            <label>Axis {{ axis }}</label>
            <input v-model.number="axisLimits[axis].min" type="number" step="any" placeholder="Min"
              @change="setAxisLimits(axis)">
            <input v-model.number="axisLimits[axis].max" type="number" step="any" placeholder="Max"
              @change="setAxisLimits(axis)">
          </div>
        </div>
      </b-collapse>
    </b-collapse>
    <!-- MODAL -->
    <b-modal id="modal-prevent-closing" ref="modal" @show="resetModal" @hidden="resetModal" @ok="handleOk">
      <form ref="form" @submit.stop.prevent="handleOk">
        <b-form-group label="New Preset Name" label-for="name-input">
          <b-form-input id="name-input" v-model="name" placeholder="Attitude/OtherRoll" required></b-form-input>
        </b-form-group>
      </form>
    </b-modal>
  </div>
</template>
<script>
import { store } from './Globals.js'
import debounce from 'v-debounce'
import ExpressionEditor from './ExpressionEditor.vue'
import { createPortablePreset, parsePortablePreset } from '../tools/presetFormat.js'
import {
    loadSharedPresets, saveSharedPreset, selectSharedPresetDirectory, supportsSharedPresets
} from '../tools/sharedPresets.js'

export default {
    name: 'PlotSetup',
    components: {
        ExpressionEditor
    },
    directives: {
        debounce
    },
    data () {
        return {
            state: store,
            name: '',
            sharedPresetDirectory: null,
            sharedPresetFolderName: '',
            sharedPresetSupported: supportsSharedPresets(),
            axisLimits: {
                0: {
                    min: null,
                    max: null
                },
                1: {
                    min: null,
                    max: null
                },
                2: {
                    min: null,
                    max: null
                },
                3: {
                    min: null,
                    max: null
                },
                4: {
                    min: null,
                    max: null
                },
                5: {
                    min: null,
                    max: null
                }
            }
        }
    },
    mounted () {
        this.refreshSharedPresets()
        this.refreshAxisLimits()
    },
    computed: {
        additionalCompletionItems () {
            const additionalCompletionItems = [
                'mag_heading_df(MAG[0],ATT)',
                'mag_heading(RAW_IMU,ATTITUDE)',
                'max(x,y)',
                'min(x,y)'
            ]
            for (const name of this.state.namedFloats) {
                additionalCompletionItems.push(`named(NAMED_VALUE_FLOAT,"${name}")`)
            }
            return additionalCompletionItems
        },
        completionOptions () {
            const messageOptions = Object.keys(this.state.messageTypes).flatMap(key => {
                const fields = this.state.messageTypes[key].expressions.map(field => `${key}.${field}`)
                return [key, ...fields]
            })
            return [...this.additionalCompletionItems, ...messageOptions]
        }
    },
    methods: {
        createNewExpression () {
            this.state.plotOn = true
            this.$nextTick(() => {
                this.state.expressions.push({
                    name: '1+1',
                    color: this.getFirstFreeColor(),
                    axis: this.getFirstFreeAxis(),
                    axisLabel: '',
                    opacity: 1,
                    lineStyle: 'solid',
                    visible: true
                })
            })
        },
        // TODO: this is duplicated in Plotly.vue, refactor it out!
        getFirstFreeAxis () {
            return this.state.allAxis.find(axis =>
                !this.state.expressions.some(field => field.axis === axis)
            ) || this.state.allAxis[this.state.allAxis.length - 1]
        },
        getFirstFreeColor () {
            return this.state.allColors.find(color =>
                !this.state.expressions.some(field => field.color === color)
            ) || this.state.allColors[this.state.expressions.length % this.state.allColors.length]
        },
        async refreshSharedPresets () {
            if (!this.sharedPresetSupported) return
            try {
                const shared = await loadSharedPresets()
                this.sharedPresetDirectory = shared.directory
                this.sharedPresetFolderName = shared.permission ? shared.directory.name : ''
                this.$eventHub.$emit('sharedPresetsChanged', shared.presets, shared.yAxisRanges)
            } catch (error) {
                console.warn('Unable to load shared presets:', error)
            }
        },
        refreshAxisLimits () {
            for (const axis of this.state.allAxis) {
                const limits = this.state.currentYAxisRanges[axis]
                this.axisLimits[axis].min = limits ? limits[0] : null
                this.axisLimits[axis].max = limits ? limits[1] : null
            }
        },
        setAxisLimits (axis) {
            const limits = this.axisLimits[axis]
            if (!Number.isFinite(limits.min) || !Number.isFinite(limits.max) || limits.min >= limits.max) return
            const ranges = { ...this.state.currentYAxisRanges }
            ranges[axis] = [limits.min, limits.max]
            this.$eventHub.$emit('setPresetYAxisRanges', ranges)
        },
        async chooseSharedPresetFolder () {
            try {
                const directory = await selectSharedPresetDirectory()
                this.sharedPresetDirectory = directory
                this.sharedPresetFolderName = directory.name
                await this.refreshSharedPresets()
            } catch (error) {
                if (error.name !== 'AbortError') window.alert(`Could not use preset folder: ${error.message}`)
            }
        },
        async savePreset (name) {
            const myStorage = window.localStorage
            const saved = JSON.parse(myStorage.getItem('savedFields')) || {}
            saved[name] = this.state.expressions.map(field =>
                [field.name, field.axis, field.color, field.function, field.axisLabel || '',
                    typeof field.opacity === 'number' ? field.opacity : 1, field.lineStyle || 'solid', 'local',
                    field.visible !== false]
            )
            myStorage.setItem('savedFields', JSON.stringify(saved))
            const savedAxisRanges = JSON.parse(myStorage.getItem('savedAxisRanges')) || {}
            savedAxisRanges[name] = this.state.currentYAxisRanges
            myStorage.setItem('savedAxisRanges', JSON.stringify(savedAxisRanges))
            this.$eventHub.$emit('presetsChanged')
            if (this.sharedPresetDirectory) {
                try {
                    let result = await saveSharedPreset(
                        this.sharedPresetDirectory, name, this.state.expressions, false, this.state.currentYAxisRanges
                    )
                    if (result.exists &&
                        window.confirm(`"${name}" already exists in the shared preset folder. Overwrite it?`)) {
                        result = await saveSharedPreset(
                            this.sharedPresetDirectory, name, this.state.expressions, true,
                            this.state.currentYAxisRanges
                        )
                    }
                    if (!result.exists) await this.refreshSharedPresets()
                } catch (error) {
                    window.alert(`Saved locally, but could not save to the shared folder: ${error.message}`)
                }
            }
        },
        exportPreset () {
            const name = window.prompt('Preset file name', this.state.file || 'UAVLogViewer preset')
            if (!name || !name.trim()) return
            const preset = createPortablePreset(name.trim(), this.state.expressions, this.state.currentYAxisRanges)
            const blob = new Blob([JSON.stringify(preset, null, 2) + '\n'], { type: 'application/json' })
            const link = document.createElement('a')
            link.href = URL.createObjectURL(blob)
            link.download = `${name.trim().replace(/[\\/:*?"<>|]/g, '_')}.uavlog-preset.json`
            document.body.appendChild(link)
            link.click()
            link.remove()
            URL.revokeObjectURL(link.href)
        },
        importPreset (event) {
            const file = event.target.files[0]
            event.target.value = ''
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
                try {
                    const preset = parsePortablePreset(reader.result)
                    const saved = JSON.parse(window.localStorage.getItem('savedFields')) || {}
                    saved[preset.name] = preset.fields
                    window.localStorage.setItem('savedFields', JSON.stringify(saved))
                    const savedAxisRanges = JSON.parse(window.localStorage.getItem('savedAxisRanges')) || {}
                    savedAxisRanges[preset.name] = preset.yAxisRanges
                    window.localStorage.setItem('savedAxisRanges', JSON.stringify(savedAxisRanges))
                    this.$eventHub.$emit('presetsChanged')
                    window.alert(`Imported preset: ${preset.name}`)
                } catch (error) {
                    window.alert(`Could not import preset: ${error.message}`)
                }
            }
            reader.readAsText(file)
        },

        resetModal () {
            this.name = ''
        },
        async handleOk (bvModalEvt) {
            // Prevent modal from closing
            bvModalEvt.preventDefault()
            if (this.name.length > 0) {
                await this.savePreset(this.name)

                // Hide the modal manually
                this.$nextTick(() => {
                    this.$refs.modal.hide()
                })
            }
        }
    },
    watch: {
        'state.currentYAxisRanges': {
            deep: true,
            handler () {
                this.refreshAxisLimits()
            }
        }
    }
}
</script>
<style>
/* MAIN */
.plot-wrapper {
  min-height: 160px;
  overflow: hidden;
  overflow-y: scroll;
}

/* Avoid repeatedly reflowing the sizeable Plot Setup form during Bootstrap's
   height transition. */
.instant-collapse.collapsing {
  transition: none;
}

/* COLOR PICKER */

ul.colorpicker {
  font-family: 'Montserrat', sans-serif;
}

ul.colorpicker li {
  text-align: center;
  cursor: default;
  font-size: 13px;
  padding-top: 1px;
}

ul.colorpicker li:hover {
  background-color: #1E2536;
  border-left: 3px solid #1E2536;
}

ul.colorpicker li a {
  cursor: pointer;
}

li.field {
  line-height: 26px;
  padding-left: 20px;
  font-size: 90%;
}

li.plotsetup {
  display: block;
}

i {
  margin: 5px;
  padding: 0;
}

.plotname {
  display: inline-block;
  line-height: 15px;
  margin-bottom: 0;
  font-size: 13px;
  width: 100%;
  border: 1px solid grey;
  padding: 4.5px;
  border-radius: 20px;
}

.plotname:focus {
  background-color: rgba(241, 248, 255, 0.966);
  outline: none;
}

.axis-label {
  width: 22%;
  margin-left: 4px;
  border: 1px solid grey;
  border-radius: 20px;
  padding: 4.5px;
  color: black;
  font-family: monospace;
  line-height: 15px;
  margin-bottom: 0;
  font-size: 13px;
}

.axis-label:focus {
  background-color: rgba(241, 248, 255, 0.966);
  outline: none;
}

.axis-limits {
  padding: 4px 20px;
}

.axis-limit-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 6px 0;
}

.axis-limit-row label {
  margin: 0;
  width: 48px;
}

.axis-limit-row input {
  width: 72px;
  border: 1px solid rgb(156, 156, 156);
  border-radius: 5px;
  padding: 2px 4px;
}

select {
  display: inline;
  border-radius: 5px;
  border: 1px solid rgb(156, 156, 156);
  background-color: rgb(255, 255, 255);
  padding: 2px 2.5px;
  color: #838282;
}

select:focus {
  border: 1.5px solid #d47f00;
  outline: none;
}

select option {
  background-color: rgb(216, 215, 215);
}

select option:hover {
  background-color: #d47f00;
}

.fa-trash {
  margin: 12px 5px 10px 1px !important;
  font-size: 10px;
  float: right;
}

.error {
  color: red;
}

/* BUTTONS */

.btns-wrapper {
  display: flex;
  flex-flow: row wrap;
  justify-content: space-evenly;
  margin: 10px;
}

.preset-file-input {
  display: none;
}

/* SAVE PRESET BUTTON */

.save-preset {
  background-color: rgb(33, 41, 61);
  color: #fff;
  border-radius: 15px;
  padding: 0px 10px 0px 0px;
  border: 1px solid rgba(91, 100, 117, 0.76);
  font-size: 13px;
}

.save-preset:hover {
  background-color: rgb(47, 58, 87);
  box-shadow: 0px 0px 12px 0px rgba(37, 78, 133, 0.55);
  transition: all 0.5s ease;
}

.save-preset:focus {
  outline: none;
}

/* ADD EXPRESSION BUTTON */

.add-expression {
  background-color: rgb(33, 41, 61);
  color: #fff;
  border-radius: 15px;
  padding: 0px 10px 0px 0px;
  border: 1px solid rgba(91, 100, 117, 0.76);
  font-size: 13px;
}

.add-expression:hover {
  background-color: rgb(47, 58, 87);
  box-shadow: 0px 0px 12px 0px rgba(37, 78, 133, 0.55);
  transition: all 0.5s ease;
}

.add-expression:focus {
  outline: none;
}

/* MEDIA QUERIES */

@media (min-width: 1000px) and (max-width: 1440px) {
  p.plotname {
    width: 55%;
  }
}

@media (min-width: 2000px) {
  p.plotname {
    width: 60%;
  }
}
</style>
