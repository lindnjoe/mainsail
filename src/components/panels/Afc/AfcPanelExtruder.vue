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
        if (this.isActiveExtruder) {
            const amsOutput = this.activeAmsFpsOutput
            if (amsOutput) return amsOutput
        }

        const extruder = this.afcCurrentLane?.extruder ?? ''
        if (extruder !== this.name) return this.$t('Panels.AfcPanel.BufferDisabled')

        return `${this.afcCurrentLane?.buffer ?? '--'}: ${this.afcCurrentBuffer?.state ?? '--'}`
    }

    get normalizedExtruderName(): string | null {
        return this.normalizeExtruderName(this.name)
    }

    normalizeExtruderName(value: unknown): string | null {
        if (typeof value !== 'string') return null

        const trimmed = value.trim()
        if (!trimmed) return null

        return trimmed.replace(/\s+/g, '').toUpperCase()
    }

    get normalizedActiveToolheadExtruder(): string | null {
        const active = this.$store.state.printer?.toolhead?.extruder
        return this.normalizeExtruderName(active)
    }

    get isActiveExtruder() {
        const normalized = this.normalizedExtruderName
        if (!normalized) return false

        if (this.normalizeExtruderName(this.afcCurrentLane?.extruder) === normalized) return true

        return this.normalizedActiveToolheadExtruder === normalized
    }

    get printerStateObject(): Record<string, unknown> {
        return (this.$store.state.printer ?? {}) as Record<string, unknown>
    }

    get printerSettingsObject(): Record<string, unknown> {
        return (this.$store.state.printer?.configfile?.settings ?? {}) as Record<string, unknown>
    }

    get amsAssignments(): Record<string, unknown>[] {
        const assignments: Record<string, unknown>[] = []
        const normalized = this.normalizedExtruderName
        if (!normalized) return assignments

        for (const [key, value] of Object.entries(this.printerStateObject)) {
            if (!/^AFC_AMS\s+/i.test(key)) continue
            if (!value || typeof value !== 'object') continue

            const record = value as Record<string, unknown>
            const candidates = [record['extruder'], record['extruder_name']]

            if (candidates.some((candidate) => this.normalizeExtruderName(candidate) === normalized)) {
                assignments.push(record)
            }
        }

        return assignments
    }

    get isAmsExtruder() {
        if (this.amsAssignments.length > 0) return true

        return this.extruderFpsConfigKeys.length > 0
    }

    get extruderFpsConfigKeys(): string[] {
        const keys: string[] = []
        const normalized = this.normalizedExtruderName
        if (!normalized) return keys

        for (const [key, value] of Object.entries(this.printerSettingsObject)) {
            if (!this.isFpsConfigKey(key)) continue
            if (!value || typeof value !== 'object') continue

            const record = value as Record<string, unknown>
            const candidate = this.normalizeExtruderName(record['extruder'])
            if (candidate && candidate === normalized) keys.push(key)
        }

        return keys
    }

    get extruderFpsStatusRecords(): Record<string, unknown>[] {
        const records: Record<string, unknown>[] = []

        for (const key of this.extruderFpsConfigKeys) {
            const candidate = this.getFpsStatusRecord(key)
            if (candidate) records.push(candidate)

            const oamsRecord = this.getOamsStatusRecord(key)
            if (oamsRecord) records.push(oamsRecord)
        }

        return records
    }


    isFpsConfigKey(key: string): boolean {
        return /^fps(?:\s+.+|_buffer\d+)$/i.test(key)
    }

    normalizeFpsStatusKey(configKey: string): string {
        return configKey.replace(/^fps(?:\s+|_)/i, '').trim()
    }

    getFpsStatusRecord(configKey: string): Record<string, unknown> | null {
        const keyCandidates = [configKey, `AFC_FPS ${configKey}`]
        const shortName = this.normalizeFpsStatusKey(configKey)

        if (shortName && shortName !== configKey) {
            keyCandidates.push(shortName, `AFC_FPS ${shortName}`)
        }

        for (const key of keyCandidates) {
            const candidate = this.getPrinterObject(key)
            if (candidate && typeof candidate === 'object') return candidate as Record<string, unknown>
        }

        return null
    }

    getOamsStatusRecord(configKey: string): Record<string, unknown> | null {
        const config = this.printerSettingsObject[configKey]
        if (!config || typeof config !== 'object') return null

        const oamsName = `${(config as Record<string, unknown>)['oams'] ?? ''}`.trim()
        if (!oamsName) return null

        const oamsKeyCandidates = [`oams ${oamsName}`, oamsName]
        for (const key of oamsKeyCandidates) {
            const candidate = this.getPrinterObject(key)
            if (candidate && typeof candidate === 'object') return candidate as Record<string, unknown>
        }

        return null
    }

    readFpsValue(record: Record<string, unknown> | null): number | null {
        if (!record) return null

        const rawValue = record['fps_value'] ?? record['value']
        if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : null

        if (typeof rawValue === 'string') {
            const trimmed = rawValue.trim()
            if (!trimmed) return null

            const parsed = Number(trimmed)
            return Number.isFinite(parsed) ? parsed : null
        }

        return null
    }

    getActiveBufferFpsStatusRecord(): Record<string, unknown> | null {
        const bufferName = `${this.afcCurrentLane?.buffer ?? ''}`.trim()
        if (!bufferName) return null

        const keyCandidates = [`AFC_FPS ${bufferName}`, bufferName]
        for (const key of keyCandidates) {
            const candidate = this.getPrinterObject(key)
            if (candidate && typeof candidate === 'object') return candidate as Record<string, unknown>
        }

        return null
    }

    get activeAmsFpsValue(): number | null {
        if (!this.isActiveExtruder || !this.isAmsExtruder) return null

        const activeBufferRecord = this.getActiveBufferFpsStatusRecord()
        const activeBufferValue = this.readFpsValue(activeBufferRecord)
        if (typeof activeBufferValue === 'number') return activeBufferValue

        for (const record of this.extruderFpsStatusRecords) {
            const value = this.readFpsValue(record)
            if (typeof value === 'number') return value
        }

        return null
    }

    get activeAmsFpsOutput(): string | null {
        const value = this.activeAmsFpsValue

        if (typeof value !== 'number') return null

        return `Fps: ${value.toFixed(2)}`
    }

    get state() {
        if (this.isActiveExtruder) {
            if (this.printerIsPrintingOnly) return this.$t('Panels.AfcPanel.Printing')

            return this.$t(`Panels.AfcPanel.${this.afcCurrentState}`)
        }

        return this.$t('Panels.AfcPanel.Idle')
    }

    get stateLane() {
        const laneLoaded = this.afcExtruder.lane_loaded
        if (laneLoaded) return laneLoaded
        if (this.isActiveExtruder && this.afcCurrentLane) return this.afcCurrentLane.name

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
