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

    get normalizedExtruderName() {
        return this.normalizeExtruderName(this.name)
    }

    get activeLaneExtruderCandidates(): string[] {
        const candidates: string[] = []
        const lane = this.afcCurrentLane as Record<string, unknown> | null
        if (!lane) return candidates

        const addCandidate = (value: unknown) => {
            this.normalizeExtruderCandidate(candidates, value)
            if (value && typeof value === 'object') {
                const typed = value as Record<string, unknown>
                this.normalizeExtruderCandidate(candidates, typed['name'])
            }
        }

        addCandidate(lane['extruder'])
        addCandidate(lane['extruder_name'])
        addCandidate(lane['command_extruder'])
        addCandidate(lane['tool'])
        addCandidate(lane['command_tool'])

        return candidates
    }

    get isActiveExtruder() {
        const normalized = this.normalizedExtruderName
        if (!normalized) return false

        return this.activeLaneExtruderCandidates.includes(normalized)
    }

    get isCurrentLaneLoadedByExtruder() {
        const normalized = this.normalizedExtruderName
        if (!normalized) return false

        const lane = this.afcCurrentLane
        if (!lane || typeof lane !== 'object') return false

        const laneName = typeof lane.name === 'string' ? lane.name.trim() : ''
        if (!laneName) return false

        const loaded = this.afcExtruder.lane_loaded
        if (typeof loaded === 'string' && loaded.trim() && loaded.trim() === laneName) {
            return true
        }

        const laneRecord = lane as Record<string, unknown>
        const laneMap = this.normalizeExtruderName(laneRecord['map'])
        if (laneMap && laneMap === normalized) return true

        const laneExtruder = laneRecord['extruder']
        if (laneExtruder && typeof laneExtruder === 'object') {
            const laneExtruderName = this.normalizeExtruderName((laneExtruder as Record<string, unknown>)['name'])
            if (laneExtruderName && laneExtruderName === normalized) return true
        }

        return false
    }

    get isActiveAmsExtruder() {
        if (!this.isActiveExtruder && !this.isCurrentLaneLoadedByExtruder) return false

        if (this.amsUnitNamesByExtruder.length > 0) return true

        return this.activeAmsUnitCandidates.length > 0
    }

    get printerStateObject() {
        return (this.$store.state.printer ?? {}) as Record<string, unknown>
    }

    get oamsManagerStatus(): Record<string, unknown> | null {
        const manager = this.printerStateObject['oams_manager']
        if (!manager || typeof manager !== 'object') return null

        return manager as Record<string, unknown>
    }

    normalizeGroupName(rawGroup: unknown): string | null {
        if (typeof rawGroup !== 'string') return null

        const normalized = rawGroup.trim().toUpperCase()

        return normalized || null
    }

    normalizeOamsName(rawName: unknown): string | null {
        if (typeof rawName !== 'string') return null

        const trimmed = rawName.trim()
        if (!trimmed) return null

        return trimmed
    }

    extractBaseUnitName(rawUnit: unknown): string | null {
        if (typeof rawUnit !== 'string') return null

        const trimmed = rawUnit.trim()
        if (!trimmed) return null

        const [unit] = trimmed.split(':')
        if (!unit) return null

        const normalized = unit.trim()

        return normalized || null
    }

    get currentLaneUnitName(): string | null {
        const rawUnit = this.afcCurrentLane?.unit
        if (typeof rawUnit !== 'string') return null

        const trimmed = rawUnit.trim()

        return trimmed || null
    }

    get currentLaneUnitObject(): Record<string, unknown> | null {
        const unitName = this.currentLaneUnitName
        if (!unitName) return null

        const direct = this.getAfcUnitObject(unitName)
        if (direct && typeof direct === 'object' && Object.keys(direct).length > 0) {
            return direct as Record<string, unknown>
        }

        const baseUnit = this.extractBaseUnitName(unitName)
        if (!baseUnit || baseUnit === unitName) return null

        const base = this.getAfcUnitObject(baseUnit)
        if (!base || typeof base !== 'object' || Object.keys(base).length === 0) return null

        return base as Record<string, unknown>
    }

    get currentLaneAmsObject(): Record<string, unknown> | null {
        const unitName = this.currentLaneUnitName
        if (!unitName) return null

        const direct = this.getPrinterObject(`AFC_AMS ${unitName}`)
        if (direct && typeof direct === 'object') {
            const typedDirect = direct as Record<string, unknown>
            if (Object.keys(typedDirect).length > 0) return typedDirect
        }

        const baseUnit = this.extractBaseUnitName(unitName)
        if (!baseUnit) return null

        const ams = this.getPrinterObject(`AFC_AMS ${baseUnit}`)
        if (!ams || typeof ams !== 'object') return null

        const typed = ams as Record<string, unknown>
        if (Object.keys(typed).length === 0) return null

        return typed
    }

    normalizeUnitName(rawUnit: unknown): string | null {
        if (typeof rawUnit !== 'string') return null

        const trimmed = rawUnit.trim()

        return trimmed || null
    }

    normalizeExtruderName(rawExtruder: unknown): string | null {
        if (typeof rawExtruder !== 'string') return null

        const trimmed = rawExtruder.trim()
        if (!trimmed) return null

        return trimmed.toUpperCase()
    }

    normalizeExtruderCandidate(targets: string[], rawValue: unknown) {
        const normalized = this.normalizeExtruderName(rawValue)
        if (!normalized) return

        if (!targets.includes(normalized)) targets.push(normalized)
    }

    normalizeOamsCandidate(targets: string[], rawValue: unknown) {
        const normalized = this.normalizeOamsName(rawValue)
        if (!normalized) return

        if (!targets.includes(normalized)) targets.push(normalized)
    }

    get printerAmsUnitEntries(): { name: string; state: Record<string, unknown> }[] {
        const entries: { name: string; state: Record<string, unknown> }[] = []

        for (const [key, value] of Object.entries(this.printerStateObject)) {
            if (!value || typeof value !== 'object') continue

            const normalizedKey = key.trim()
            if (!/^AFC_AMS\s+/i.test(normalizedKey)) continue

            const [, rawName] = normalizedKey.split(/\s+/, 2)
            if (!rawName) continue

            const unitName = rawName.trim()
            if (!unitName) continue

            entries.push({ name: unitName, state: value as Record<string, unknown> })
        }

        return entries
    }

    get amsUnitNamesByExtruder(): string[] {
        const candidates: string[] = []
        const targetExtruder = this.normalizeExtruderName(this.name)
        if (!targetExtruder) return candidates

        for (const entry of this.printerAmsUnitEntries) {
            const extruderCandidates: string[] = []
            this.normalizeExtruderCandidate(extruderCandidates, entry.state['extruder'])
            this.normalizeExtruderCandidate(extruderCandidates, entry.state['extruder_name'])

            if (!extruderCandidates.includes(targetExtruder)) continue

            const baseUnit = this.extractBaseUnitName(entry.name) ?? this.normalizeUnitName(entry.name)
            if (!baseUnit) continue

            if (!candidates.includes(baseUnit)) candidates.push(baseUnit)
        }

        return candidates
    }

    get activeAmsUnitCandidates(): string[] {
        const candidates: string[] = []

        const normalizedKnownAmsUnits = new Set<string>()
        for (const entry of this.printerAmsUnitEntries) {
            const normalizedName = this.normalizeUnitName(entry.name)
            if (normalizedName) normalizedKnownAmsUnits.add(normalizedName)

            const base = this.extractBaseUnitName(entry.name)
            if (base) {
                const normalizedBase = this.normalizeUnitName(base)
                if (normalizedBase) normalizedKnownAmsUnits.add(normalizedBase)
            }
        }

        const normalizedAssignedUnits = new Set<string>()
        const pushCandidate = (unit: string | null) => {
            if (!unit) return

            if (!candidates.includes(unit)) candidates.push(unit)
        }

        for (const unitName of this.amsUnitNamesByExtruder) {
            pushCandidate(unitName)

            const normalized = this.normalizeUnitName(unitName)
            if (normalized) normalizedAssignedUnits.add(normalized)
        }

        if (this.isActiveExtruder || this.isCurrentLaneLoadedByExtruder) {
            const baseUnit = this.extractBaseUnitName(this.currentLaneUnitName)
            if (baseUnit) {
                const normalizedBase = this.normalizeUnitName(baseUnit)
                if (
                    normalizedBase &&
                    (normalizedKnownAmsUnits.has(normalizedBase) || normalizedAssignedUnits.has(normalizedBase))
                ) {
                    const matchingAssigned = this.amsUnitNamesByExtruder.find((candidate) => {
                        const normalizedCandidate = this.normalizeUnitName(candidate)
                        return normalizedCandidate === normalizedBase
                    })

                    pushCandidate(matchingAssigned ?? baseUnit)
                }
            }
        }

        return candidates
    }

    get activeAmsGroupCandidates(): string[] {
        if (!this.isActiveAmsExtruder) return []

        const groups: string[] = []

        const addGroup = (rawGroup: unknown) => {
            const normalized = this.normalizeGroupName(rawGroup)
            if (!normalized) return

            if (!groups.includes(normalized)) groups.push(normalized)
        }

        addGroup(this.afcCurrentLane?.map)

        const lane = this.afcCurrentLane as Record<string, unknown> | null
        if (lane) addGroup(lane['map'])

        const unit = this.currentLaneUnitObject
        if (unit) {
            addGroup(unit['map'])
            addGroup(unit['group'])
            addGroup(unit['default_group'])
        }

        const ams = this.currentLaneAmsObject
        if (ams) {
            addGroup(ams['map'])
            addGroup(ams['group'])
            addGroup(ams['default_group'])
        }

        for (const unitName of this.activeAmsUnitCandidates) {
            const unitObject = this.getAfcUnitObject(unitName)
            if (unitObject && typeof unitObject === 'object') {
                const typed = unitObject as Record<string, unknown>
                addGroup(typed['map'])
                addGroup(typed['group'])
                addGroup(typed['default_group'])
            }

            const amsObject = this.getPrinterObject(`AFC_AMS ${unitName}`)
            if (amsObject && typeof amsObject === 'object') {
                const typedAms = amsObject as Record<string, unknown>
                addGroup(typedAms['map'])
                addGroup(typedAms['group'])
                addGroup(typedAms['default_group'])
                addGroup(typedAms['current_group'])
            }
        }

        return groups
    }

    get activeAmsOamsCandidates(): string[] {
        if (!this.isActiveAmsExtruder) return []

        const candidates: string[] = []

        const addFromRecord = (record: Record<string, unknown> | null | undefined) => {
            if (!record) return

            this.normalizeOamsCandidate(candidates, record['oams_name'])
            this.normalizeOamsCandidate(candidates, record['oams'])
        }

        addFromRecord(this.currentLaneUnitObject)
        addFromRecord(this.currentLaneAmsObject)

        const lane = this.afcCurrentLane as Record<string, unknown> | null
        if (lane) this.normalizeOamsCandidate(candidates, lane['oams'])

        const extruder = this.afcExtruder as unknown
        if (extruder && typeof extruder === 'object') {
            const typedExtruder = extruder as Record<string, unknown>
            addFromRecord(typedExtruder)
        }

        for (const unitName of this.activeAmsUnitCandidates) {
            const unitObject = this.getAfcUnitObject(unitName)
            if (unitObject && typeof unitObject === 'object') {
                addFromRecord(unitObject as Record<string, unknown>)
            }

            const amsObject = this.getPrinterObject(`AFC_AMS ${unitName}`)
            if (amsObject && typeof amsObject === 'object') {
                addFromRecord(amsObject as Record<string, unknown>)
            }
        }

        return candidates
    }

    get activeAmsOamsName(): string | null {
        const [first] = this.activeAmsOamsCandidates

        return first ?? null
    }

    extractGroupFromKey(rawKey: string): string | null {
        const key = rawKey.trim()
        if (!key) return null

        const segments = key.split(/\s+/)
        const suffix = segments[segments.length - 1]

        return this.normalizeGroupName(suffix)
    }

    resolveOamsStatusKeys(rawName: string): string[] {
        const keys = new Set<string>()
        const base = this.normalizeOamsName(rawName)
        if (!base) return []

        const normalizedBase = base.trim()
        const normalizedLower = normalizedBase.toLowerCase()
        const normalizedUpper = normalizedBase.toUpperCase()

        keys.add(normalizedBase)
        keys.add(normalizedLower)
        keys.add(normalizedUpper)
        keys.add(`oams ${normalizedBase}`)
        keys.add(`oams ${normalizedLower}`)
        keys.add(`oams ${normalizedUpper}`)
        keys.add(`OAMS ${normalizedBase}`)
        keys.add(`OAMS ${normalizedLower}`)
        keys.add(`OAMS ${normalizedUpper}`)

        const suffix = normalizedBase.replace(/^oams\s+/i, '').trim()
        if (suffix) {
            const suffixLower = suffix.toLowerCase()
            const suffixUpper = suffix.toUpperCase()

            keys.add(suffix)
            keys.add(suffixLower)
            keys.add(suffixUpper)
            keys.add(`oams ${suffix}`)
            keys.add(`oams ${suffixLower}`)
            keys.add(`oams ${suffixUpper}`)
            keys.add(`OAMS ${suffix}`)
            keys.add(`OAMS ${suffixLower}`)
            keys.add(`OAMS ${suffixUpper}`)
        }

        return Array.from(keys)
    }

    get currentFpsStatus(): Record<string, unknown> | null {
        if (!this.isActiveAmsExtruder) return null

        const groupCandidates = this.activeAmsGroupCandidates
        const oamsCandidates = this.activeAmsOamsCandidates
        const normalizedOamsCandidates = new Set(oamsCandidates.map((candidate) => candidate.toUpperCase()))
        const oamsManager = this.oamsManagerStatus
        if (!oamsManager) return null

        let fallbackByOams: Record<string, unknown> | null = null
        let fallbackByKeyGroup: Record<string, unknown> | null = null

        for (const [key, value] of Object.entries(oamsManager)) {
            if (key === 'oams') continue
            if (!value || typeof value !== 'object') continue

            const status = value as Record<string, unknown>

            const currentGroup = this.normalizeGroupName(status['current_group'])
            if (currentGroup && groupCandidates.includes(currentGroup)) return status

            if (!fallbackByOams && normalizedOamsCandidates.size > 0) {
                const statusOams = this.normalizeOamsName(status['current_oams'])
                if (statusOams) {
                    const normalizedStatusOams = statusOams.toUpperCase()
                    if (normalizedOamsCandidates.has(normalizedStatusOams)) {
                        fallbackByOams = status
                        continue
                    }
                }
            }

            if (!fallbackByKeyGroup && groupCandidates.length > 0) {
                const keyGroup = this.extractGroupFromKey(key)
                if (keyGroup && groupCandidates.includes(keyGroup)) {
                    fallbackByKeyGroup = status
                }
            }
        }

        return fallbackByOams ?? fallbackByKeyGroup
    }

    get currentOamsName(): string | null {
        const status = this.currentFpsStatus
        if (status) {
            const name = status['current_oams']
            if (typeof name === 'string') {
                const normalized = this.normalizeOamsName(name)
                if (normalized) return normalized
            }
        }

        return this.activeAmsOamsName
    }

    get currentOamsStatus(): Record<string, unknown> | null {
        const oamsName = this.currentOamsName
        if (!oamsName) return null

        const keys = this.resolveOamsStatusKeys(oamsName)

        for (const key of keys) {
            const candidate = this.printerStateObject[key]
            if (!candidate || typeof candidate !== 'object') continue

            return candidate as Record<string, unknown>
        }

        return null
    }

    get fpsStatusKeyCandidates(): string[] {
        const keys = new Set<string>()

        const pushKey = (value: string | null) => {
            if (!value) return
            const normalized = value.trim()
            if (!normalized) return
            keys.add(normalized)
        }

        const baseName = typeof this.name === 'string' ? this.name.trim() : ''
        if (baseName) {
            const lower = baseName.toLowerCase()
            const upper = baseName.toUpperCase()

            pushKey(`fps ${baseName}`)
            pushKey(`fps ${lower}`)
            pushKey(`fps ${upper}`)
            pushKey(`FPS ${baseName}`)
            pushKey(`FPS ${lower}`)
            pushKey(`FPS ${upper}`)
        }

        const normalizedExtruder = this.normalizeExtruderName(this.name)
        if (normalizedExtruder && normalizedExtruder !== baseName.toUpperCase()) {
            const lower = normalizedExtruder.toLowerCase()
            const upper = normalizedExtruder.toUpperCase()

            pushKey(`fps ${normalizedExtruder}`)
            pushKey(`fps ${lower}`)
            pushKey(`fps ${upper}`)
            pushKey(`FPS ${normalizedExtruder}`)
            pushKey(`FPS ${lower}`)
            pushKey(`FPS ${upper}`)
        }

        return Array.from(keys)
    }

    get fallbackFpsStatus(): Record<string, unknown> | null {
        if (!this.isActiveAmsExtruder) return null

        for (const key of this.fpsStatusKeyCandidates) {
            const candidate = this.printerStateObject[key]
            if (!candidate || typeof candidate !== 'object') continue

            const typed = candidate as Record<string, unknown>
            if (!('fps_value' in typed)) continue

            return typed
        }

        return null
    }

    get currentFpsValue(): number | null {
        const sources: (Record<string, unknown> | null)[] = [this.currentOamsStatus, this.fallbackFpsStatus]

        for (const status of sources) {
            if (!status) continue

            const rawValue = status['fps_value']
            const value = typeof rawValue === 'number' ? rawValue : Number(rawValue)

            if (!Number.isFinite(value)) continue

            return value
        }

        return null
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
