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
        if (!this.isActiveExtruder && !this.isCurrentLaneLoadedByExtruder) {
            return this.$t('Panels.AfcPanel.BufferDisabled')
        }

        if (this.currentFpsOutput) return this.currentFpsOutput

        return `${this.afcCurrentLane?.buffer ?? '--'}: ${this.afcCurrentBuffer?.state ?? '--'}`
    }

    get normalizedExtruderName(): string | null {
        if (typeof this.name !== 'string') return null

        const trimmed = this.name.trim()
        if (!trimmed) return null

        return trimmed.toUpperCase()
    }

    normalizeExtruderCandidate(value: unknown): string | null {
        if (typeof value !== 'string') return null

        const trimmed = value.trim()
        if (!trimmed) return null

        return trimmed.toUpperCase()
    }

    get normalizedActiveToolheadExtruder(): string | null {
        const active = this.$store.state.printer?.toolhead?.extruder
        return this.normalizeExtruderCandidate(active)
    }

    get activeLaneExtruderCandidates(): string[] {
        const candidates: string[] = []
        const lane = this.afcCurrentLane as Record<string, unknown> | null
        if (!lane) return candidates

        const pushCandidate = (value: unknown) => {
            const normalized = this.normalizeExtruderCandidate(value)
            if (!normalized) return
            if (!candidates.includes(normalized)) candidates.push(normalized)
        }

        pushCandidate(lane['extruder'])
        pushCandidate(lane['extruder_name'])
        pushCandidate(lane['command_extruder'])

        const laneExtruder = lane['extruder']
        if (laneExtruder && typeof laneExtruder === 'object') {
            const laneExtruderRecord = laneExtruder as Record<string, unknown>
            pushCandidate(laneExtruderRecord['name'])
        }

        return candidates
    }

    get isActiveExtruder() {
        const normalized = this.normalizedExtruderName
        if (!normalized) return false

        if (this.activeLaneExtruderCandidates.includes(normalized)) return true

        return this.normalizedActiveToolheadExtruder === normalized
    }

    get isCurrentLaneLoadedByExtruder() {
        const normalized = this.normalizedExtruderName
        if (!normalized) return false

        const loadedLane = this.normalizeUnitName(this.afcExtruder.lane_loaded)
        const activeLane = this.normalizeUnitName(this.afcCurrentLane?.name)

        if (loadedLane && activeLane && loadedLane === activeLane) return true

        return false
    }

    normalizeUnitName(value: unknown): string | null {
        if (typeof value !== 'string') return null

        const trimmed = value.trim()
        return trimmed || null
    }

    get printerStateObject(): Record<string, unknown> {
        return (this.$store.state.printer ?? {}) as Record<string, unknown>
    }

    get oamsManager(): Record<string, unknown> | null {
        const manager = this.printerStateObject['oams_manager']
        if (!manager || typeof manager !== 'object') return null

        return manager as Record<string, unknown>
    }

    normalizeOamsName(value: unknown): string | null {
        if (typeof value !== 'string') return null

        const trimmed = value.trim()
        if (!trimmed) return null

        return trimmed.replace(/^oams\s+/i, '').trim().toUpperCase() || null
    }

    normalizeGroupName(value: unknown): string | null {
        if (typeof value !== 'string') return null

        const trimmed = value.trim()
        if (!trimmed) return null

        return trimmed.toUpperCase()
    }

    extractBaseUnitName(value: unknown): string | null {
        if (typeof value !== 'string') return null

        const trimmed = value.trim()
        if (!trimmed) return null

        const [unit] = trimmed.split(':')
        if (!unit) return null

        return unit.trim() || null
    }

    get extruderLaneObjects(): Record<string, unknown>[] {
        const lanes: Record<string, unknown>[] = []
        const laneNames = (this.afcExtruder.lanes ?? []) as unknown[]

        for (const laneName of laneNames) {
            if (typeof laneName !== 'string') continue

            const lane = this.getAfcLaneObject(laneName)
            if (!lane || typeof lane !== 'object') continue

            lanes.push(lane as Record<string, unknown>)
        }

        return lanes
    }

    get extruderAmsEntries(): Record<string, unknown>[] {
        const entries: Record<string, unknown>[] = []
        const normalizedExtruder = this.normalizedExtruderName
        if (!normalizedExtruder) return entries

        for (const [key, value] of Object.entries(this.printerStateObject)) {
            if (!/^AFC_AMS\s+/i.test(key)) continue
            if (!value || typeof value !== 'object') continue

            const record = value as Record<string, unknown>
            const candidates = [record['extruder'], record['extruder_name']]

            if (candidates.some((candidate) => this.normalizeExtruderCandidate(candidate) === normalizedExtruder)) {
                entries.push(record)
            }
        }

        return entries
    }

    get oamsNameCandidates(): string[] {
        const candidates: string[] = []
        const pushCandidate = (value: unknown) => {
            const normalized = this.normalizeOamsName(value)
            if (!normalized) return
            if (!candidates.includes(normalized)) candidates.push(normalized)
        }

        const sources: Record<string, unknown>[] = [
            this.afcExtruder as Record<string, unknown>,
            ...this.extruderAmsEntries,
            ...this.extruderLaneObjects,
        ]

        for (const source of sources) {
            pushCandidate(source['oams'])
            pushCandidate(source['oams_name'])
        }

        const lane = this.afcCurrentLane as Record<string, unknown> | null
        if (lane) pushCandidate(lane['oams'])

        const unitName = this.extractBaseUnitName(this.afcCurrentLane?.unit)
        if (unitName) {
            const ams = this.getPrinterObject(`AFC_AMS ${unitName}`)
            if (ams && typeof ams === 'object') {
                const record = ams as Record<string, unknown>
                pushCandidate(record['oams'])
                pushCandidate(record['oams_name'])
            }
        }

        return candidates
    }

    get groupNameCandidates(): string[] {
        const groups: string[] = []
        const pushGroup = (value: unknown) => {
            const normalized = this.normalizeGroupName(value)
            if (!normalized) return
            if (!groups.includes(normalized)) groups.push(normalized)
        }

        const sources: Record<string, unknown>[] = [
            this.afcExtruder as Record<string, unknown>,
            ...this.extruderAmsEntries,
            ...this.extruderLaneObjects,
        ]

        for (const source of sources) {
            pushGroup(source['group'])
            pushGroup(source['map'])
            pushGroup(source['default_group'])
        }

        const lane = this.afcCurrentLane as Record<string, unknown> | null
        if (lane) {
            pushGroup(lane['group'])
            pushGroup(lane['map'])
        }

        const unitName = this.extractBaseUnitName(this.afcCurrentLane?.unit)
        if (unitName) {
            const unitObject = this.getAfcUnitObject(unitName)
            if (unitObject && typeof unitObject === 'object') {
                const record = unitObject as Record<string, unknown>
                pushGroup(record['group'])
                pushGroup(record['map'])
                pushGroup(record['default_group'])
            }
        }

        return groups
    }

    get oamsStatusCandidates(): Record<string, unknown>[] {
        const statuses: Record<string, unknown>[] = []
        const manager = this.oamsManager
        if (!manager) return statuses

        const normalizedOams = new Set(this.oamsNameCandidates)
        const normalizedGroups = new Set(this.groupNameCandidates)

        for (const [key, value] of Object.entries(manager)) {
            if (!value || typeof value !== 'object') continue

            const record = value as Record<string, unknown>

            const normalizedKey = this.normalizeOamsName(key)
            if (normalizedKey && normalizedOams.has(normalizedKey)) {
                statuses.push(record)
                continue
            }

            const currentOams = this.normalizeOamsName(record['current_oams'])
            if (currentOams && normalizedOams.has(currentOams)) {
                statuses.push(record)
                continue
            }

            const currentGroup = this.normalizeGroupName(record['current_group'])
            if (currentGroup && normalizedGroups.has(currentGroup)) {
                statuses.push(record)
            }
        }

        return statuses
    }

    get fpsStatusKeyCandidates(): string[] {
        const keys = new Set<string>()

        const pushKey = (value: unknown) => {
            if (typeof value !== 'string') return

            const trimmed = value.trim()
            if (!trimmed) return

            keys.add(trimmed)
        }

        const pushNameVariants = (base: string) => {
            const lower = base.toLowerCase()
            const upper = base.toUpperCase()

            pushKey(`fps ${base}`)
            pushKey(`fps ${lower}`)
            pushKey(`fps ${upper}`)
            pushKey(`FPS ${base}`)
            pushKey(`FPS ${lower}`)
            pushKey(`FPS ${upper}`)
        }

        if (typeof this.name === 'string') {
            const trimmed = this.name.trim()
            if (trimmed) pushNameVariants(trimmed)
        }

        const normalized = this.normalizedExtruderName
        if (normalized) pushNameVariants(normalized)

        for (const lane of this.extruderLaneObjects) {
            const laneName = typeof lane['name'] === 'string' ? lane['name'] : null
            if (laneName) pushNameVariants(laneName)
        }

        return Array.from(keys)
    }

    get fpsStatusRecords(): Record<string, unknown>[] {
        const records: Record<string, unknown>[] = []

        for (const key of this.fpsStatusKeyCandidates) {
            const candidate = this.printerStateObject[key]
            if (!candidate || typeof candidate !== 'object') continue

            const record = candidate as Record<string, unknown>
            if (!records.includes(record)) records.push(record)
        }

        return records
    }

    readFpsValue(record: Record<string, unknown> | null): number | null {
        if (!record) return null

        const rawValue = record['fps_value']
        if (typeof rawValue === 'number') return Number.isFinite(rawValue) ? rawValue : null

        if (typeof rawValue === 'string' && rawValue.trim()) {
            const parsed = Number(rawValue)
            return Number.isFinite(parsed) ? parsed : null
        }

        return null
    }

    get currentFpsValue(): number | null {
        const sources: (Record<string, unknown> | null)[] = [
            ...this.oamsStatusCandidates,
            ...this.fpsStatusRecords,
        ]

        for (const record of sources) {
            const value = this.readFpsValue(record)
            if (typeof value === 'number') return value
        }

        return null
    }

    get currentFpsOutput(): string | null {
        const value = this.currentFpsValue
        if (typeof value !== 'number') return null

        return `fps_value: ${value.toFixed(2)}`
    }

    get state() {
        if (this.isActiveExtruder) {
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
