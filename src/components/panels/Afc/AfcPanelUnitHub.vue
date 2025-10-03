<template>
    <div class="ml-3">
        <v-tooltip top>
            <template #activator="{ on, attr }">
                <span
                    v-bind="attr"
                    class="sensor-status rounded-circle d-inline-block mr-2"
                    :class="sensorClass"
                    v-on="on" />
            </template>
            <span>{{ sensorOutput }}</span>
        </v-tooltip>
        <span class="text-body-1">{{ $t('Panels.AfcPanel.Hub') }}</span>
    </div>
</template>
<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import AfcMixin from '@/components/mixins/afc'

@Component
export default class AfcPanelUnitHub extends Mixins(BaseMixin, AfcMixin) {
    @Prop({ type: String, required: true }) readonly name!: string
    @Prop({ type: String, default: '' }) readonly unitType!: string
    @Prop({ type: Array, default: () => [] }) readonly lanes!: string[]

    get hub() {
        return this.getAfcHubObject(this.name)
    }

    get sensorStatus() {
        if (this.directLaneLoaded) return true

        return this.hub.state ?? false
    }

    get sensorOutput() {
        const status = this.sensorStatus ? this.$t('Panels.AfcPanel.Detected') : this.$t('Panels.AfcPanel.Empty')

        return `${this.name} ${this.$t('Panels.AfcPanel.HubLoad')} - ${status}`
    }

    get sensorClass() {
        return {
            success: this.sensorStatus,
            error: !this.sensorStatus,
        }
    }

    get directLaneLoaded() {
        if (this.unitType.toLowerCase() !== 'boxturtle') return false

        return this.lanesForHub.some((laneName) => {
            const laneSettings = this.getLaneSettings(laneName)
            const hubSetting = this.normalizeHubName(laneSettings?.hub)
            if (!['direct', 'direct_load'].includes(hubSetting)) return false

            const lane = this.getLaneObject(laneName)

            return Boolean(lane?.tool_loaded)
        })
    }

    get lanesForHub(): string[] {
        const hubName = this.normalizeHubName(this.name)
        if (!hubName) return []

        return this.lanes.filter((laneName) => {
            const lane = this.getLaneObject(laneName)
            const laneHub = this.normalizeHubName(lane?.hub) || this.normalizeHubName(lane?.hub_name)
            if (laneHub === hubName) return true

            const laneSettings = this.getLaneSettings(laneName)
            const settingsHub = this.normalizeHubName(laneSettings?.hub)

            return settingsHub === hubName
        })
    }

    getLaneObject(laneName: string) {
        return (this.getAfcLaneObject(laneName) ?? {}) as Record<string, any>
    }

    getLaneSettings(laneName: string) {
        return (this.getAfcLaneSettings(laneName) ?? {}) as Record<string, any>
    }

    normalizeHubName(value: unknown) {
        if (!value) return ''

        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase()
            if (normalized.startsWith('hub:')) {
                return normalized.slice(4).trim()
            }

            return normalized
        }

        if (typeof value === 'object') {
            const record = value as Record<string, unknown>
            const nameValue = record?.name
            if (typeof nameValue === 'string') {
                return this.normalizeHubName(nameValue)
            }
        }

        return ''
    }
}
</script>

<style scoped>
.sensor-status {
    width: 10px;
    height: 10px;
}
</style>
