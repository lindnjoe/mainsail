<template>
    <div class="rounded-lg grey border-1" :class="containerClasses">
        <v-row>
            <v-col class="pl-6 py-4 text-no-wrap">
                <v-tooltip top>
                    <template #activator="{ on, attr }">
                        <span
                            v-bind="attr"
                            class="sensor-status rounded-circle d-inline-block mr-2"
                            :class="preSensorClasses"
                            v-on="on" />
                    </template>
                    <span>{{ preSensorOutput }}</span>
                </v-tooltip>
                <span>{{ name }}</span>
                <v-tooltip v-if="hasPostSensor" top>
                    <template #activator="{ on, attr }">
                        <span
                            v-bind="attr"
                            class="sensor-status rounded-circle d-inline-block ml-2"
                            :class="postSensorClasses"
                            v-on="on" />
                    </template>
                    <span>{{ postSensorOutput }}</span>
                </v-tooltip>
            </v-col>
            <v-col class="py-4 text-center">{{ bufferOutput }}</v-col>
            <v-col class="py-4 pr-6 text-right">
                {{ state }}:
                <span :class="stateLaneClasses">{{ stateLane }}</span>
            </v-col>
        </v-row>
    </div>
</template>
<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import AfcMixin from '@/components/mixins/afc'

@Component
export default class AfcPanelExtruder extends Mixins(BaseMixin, AfcMixin) {
    @Prop({ type: String, required: true }) readonly name!: string

    get afcExtruder() {
        return this.getAfcExtruderObject(this.name)
    }

    get settings() {
        return this.getAfcExtruderSettings(this.name)
    }

    get useRamming() {
        const toolStart = this.afcExtruder.tool_start ?? ''

        return toolStart === 'buffer'
    }

    get hasActiveLane() {
        if (this.afcCurrentLane === null) return false

        const lanes = this.afcExtruder.lanes ?? []
        return lanes.includes(this.afcCurrentLane?.name)
    }

    get containerClasses() {
        return {
            'border-primary': this.hasActiveLane,
            'border-error': this.hasActiveLane && this.afcErrorState,
            'darken-3': this.$vuetify.theme.dark,
            'lighten-2': !this.$vuetify.theme.dark,
        }
    }

    get rammingState() {
        if (!this.useRamming) return false

        const extruder = this.afcCurrentLane?.extruder ?? ''
        const bufferState = (this.afcCurrentBuffer?.state ?? '').toLowerCase()

        return extruder === this.name && bufferState === 'trailing'
    }

    get laneLoaded() {
        return this.afcExtruder.lane_loaded ?? ''
    }

    get preSensorStatus() {
        return this.afcExtruder.tool_start_status ?? false
    }

    get preSensorClasses() {
        if (this.useRamming) {
            return {
                success: !this.laneLoaded && this.rammingState,
                error: !this.laneLoaded && !this.rammingState,
                'grey lighten4': this.laneLoaded,
            }
        }

        return {
            success: this.preSensorStatus,
            error: !this.preSensorStatus,
        }
    }

    get preSensorOutput() {
        if (this.useRamming) {
            if (this.laneLoaded) return `${this.$t('Panels.AfcPanel.RammingSensor')}`

            const status = this.rammingState ? this.$t('Panels.AfcPanel.Detected') : this.$t('Panels.AfcPanel.Empty')
            return `${this.$t('Panels.AfcPanel.RammingSensor')} - ${status}`
        }

        const status = this.preSensorStatus ? this.$t('Panels.AfcPanel.Detected') : this.$t('Panels.AfcPanel.Empty')

        return `${this.$t('Panels.AfcPanel.PreExtruderSensor')} - ${status}`
    }

    get hasPostSensor() {
        return 'pin_tool_end' in this.settings
    }

    get postSensorStatus() {
        return this.afcExtruder.tool_end_status ?? false
    }

    get postSensorClasses() {
        return {
            success: this.postSensorStatus,
            error: !this.postSensorStatus,
        }
    }

    get postSensorOutput() {
        const status = this.postSensorStatus ? this.$t('Panels.AfcPanel.Detected') : this.$t('Panels.AfcPanel.Empty')

        return `${this.$t('Panels.AfcPanel.PostExtruderSensor')} - ${status}`
    }

    get bufferOutput() {
        if (!this.isActiveExtruder) return this.$t('Panels.AfcPanel.BufferDisabled')

        if (this.currentFpsOutput) return this.currentFpsOutput

        return `${this.afcCurrentLane?.buffer ?? '--'}: ${this.afcCurrentBuffer?.state ?? '--'}`
    }

    get isActiveExtruder() {
        const extruder = this.afcCurrentLane?.extruder ?? ''

        return extruder === this.name
    }

    get isCurrentLaneAms() {
        if (!this.isActiveExtruder) return false

        const unitName = this.afcCurrentLane?.unit ?? ''
        if (!unitName) return false

        const unit = this.getAfcUnitObject(unitName)
        const unitType = (unit?.type ?? '').toString().toUpperCase()

        return unitType === 'AMS'
    }

    get printerStateObject() {
        return (this.$store.state.printer ?? {}) as Record<string, unknown>
    }

    get oamsManagerStatus(): Record<string, unknown> | null {
        const manager = this.printerStateObject['oams_manager']
        if (!manager || typeof manager !== 'object') return null

        return manager as Record<string, unknown>
    }

    get currentFpsStatus(): Record<string, unknown> | null {
        if (!this.isCurrentLaneAms) return null

        const laneMapRaw = this.afcCurrentLane?.map
        if (!laneMapRaw) return null

        const laneMap = laneMapRaw.toString().toUpperCase()
        const oamsManager = this.oamsManagerStatus
        if (!oamsManager) return null

        for (const [key, value] of Object.entries(oamsManager)) {
            if (key === 'oams') continue
            if (!value || typeof value !== 'object') continue

            const currentGroup = (value as Record<string, unknown>)['current_group']
            if (typeof currentGroup !== 'string') continue

            if (currentGroup.toUpperCase() === laneMap) return value as Record<string, unknown>
        }

        return null
    }

    get currentOamsName(): string | null {
        const status = this.currentFpsStatus
        if (!status) return null

        const name = status['current_oams']
        if (typeof name !== 'string' || !name.trim()) return null

        return name
    }

    get currentOamsStatus(): Record<string, unknown> | null {
        const oamsName = this.currentOamsName
        if (!oamsName) return null

        const possibleKeys = new Set<string>([
            oamsName,
            `oams ${oamsName}`,
            `oams ${oamsName.toLowerCase()}`,
            `oams ${oamsName.toUpperCase()}`,
        ])

        for (const key of possibleKeys) {
            const candidate = this.printerStateObject[key]
            if (!candidate || typeof candidate !== 'object') continue

            return candidate as Record<string, unknown>
        }

        return null
    }

    get currentFpsValue(): number | null {
        const oamsStatus = this.currentOamsStatus
        if (!oamsStatus) return null

        const rawValue = oamsStatus['fps_value']
        const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)

        if (!Number.isFinite(value)) return null

        return value
    }

    get currentFpsOutput() {
        const value = this.currentFpsValue
        if (typeof value !== 'number') return null

        return `fps_value: ${value.toFixed(2)}`
    }

    get state() {
        const extruder = this.afcCurrentLane?.extruder ?? ''
        if (extruder === this.name) {
            if (this.printerIsPrintingOnly) return this.$t('Panels.AfcPanel.Printing')

            return this.$t(`Panels.AfcPanel.${this.afcCurrentState}`)
        }

        return this.$t('Panels.AfcPanel.Idle')
    }

    get stateLane() {
        if (this.afcExtruder.lane_loaded) return this.afcExtruder.lane_loaded
        if (this.afcCurrentLane) return this.afcCurrentLane.name

        return this.$t('Panels.AfcPanel.LaneLoadedNone')
    }

    get stateLaneClasses() {
        return {
            'primary--text': this.hasActiveLane,
            'error--text': this.hasActiveLane && this.afcErrorState,
        }
    }
}
</script>

<style scoped>
.sensor-status {
    width: 10px;
    height: 10px;
}

.border-1 {
    border-width: 1px;
    border-style: solid;
}

.v-application .border-primary {
    border-color: var(--v-primary-base) !important;
}

.v-application .border-error {
    border-color: var(--v-error-base) !important;
}
</style>
