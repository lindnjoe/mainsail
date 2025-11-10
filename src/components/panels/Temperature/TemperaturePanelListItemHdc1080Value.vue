<template>
    <div v-if="isVisible">
        <v-tooltip top :disabled="disableTooltip">
            <template #activator="{ on, attrs }">
                <span :style="cssStyle" v-bind="attrs" v-on="on">{{ formatValue }}</span>
            </template>
            <span>
                {{ $t('Panels.TemperaturePanel.Max') }}: {{ formatValue_max }}
                <br />
                {{ $t('Panels.TemperaturePanel.Min') }}: {{ formatValue_min }}
            </span>
        </v-tooltip>
    </div>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'

@Component
export default class TemperaturePanelListItemHdc1080Value extends Mixins(BaseMixin) {
    @Prop({ type: Object, required: true }) readonly printerObject!: { [key: string]: number }
    @Prop({ type: String, required: true }) readonly objectName!: string
    @Prop({ type: String, required: true }) readonly keyName!: string
    @Prop({ type: Boolean, required: false, default: true }) readonly small!: boolean

    get cssStyle() {
        let style = { cursor: 'default', fontSize: '1em' }
        if (this.small) style.fontSize = '0.8em'

        return style
    }

    get value() {
        const value = this.printerObject[this.keyName] ?? null
        if (value === null || isNaN(value)) return null

        return value
    }

    get value_min(): number | null {
        const name = `measured_min_${this.keyName}`
        return this.printerObject[name] ?? null
    }

    get value_max(): number | null {
        const name = `measured_max_${this.keyName}`
        return this.printerObject[name] ?? null
    }

    get unit(): string | null {
        switch (this.keyName) {
            case 'temperature':
                return '°C'
            case 'humidity':
                return '%'
        }

        return null
    }

    get digits() {
        return 1
    }

    get formatValue() {
        if (this.value === null) return '--'

        const formattedValue = this.value.toFixed(this.digits)
        if (this.unit === null) return formattedValue

        return `${formattedValue} ${this.unit}`
    }

    get formatValue_min() {
        if (this.value_min === null) return '--'

        const formattedValue = this.value_min.toFixed(this.digits)
        if (this.unit === null) return formattedValue

        return `${formattedValue} ${this.unit}`
    }

    get formatValue_max() {
        if (this.value_max === null) return '--'

        const formattedValue = this.value_max.toFixed(this.digits)
        if (this.unit === null) return formattedValue

        return `${formattedValue} ${this.unit}`
    }

    get disableTooltip() {
        return this.value_min === null || this.value_max === null
    }

    get guiSetting() {
        return this.$store.getters['gui/getDatasetAdditionalSensorValue']({
            name: this.objectName,
            sensor: this.keyName,
        })
    }

    get isVisible() {
        if (this.value === null) return false

        // Default to visible if GUI setting is undefined, otherwise use the setting
        return this.guiSetting ?? true
    }
}
</script>
