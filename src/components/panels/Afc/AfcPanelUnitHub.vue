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
    @Prop({ type: Array, default: () => [] }) readonly laneNames!: string[]

    get hub() {
        return this.getAfcHubObject(this.name)
    }

    get sensorStatus() {
        if (this.hub.state ?? false) return true

        return this.shouldIndicateDirectLoad
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

    get shouldIndicateDirectLoad() {
        if (!this.isBoxTurtleUnit) return false

        return this.lanesUsingHub.some((laneName) => {
            const lane = this.getAfcLaneObject(laneName)
            if (!lane || typeof lane !== 'object') return false

            const laneSettings = this.getAfcLaneSettings(laneName) ?? {}
            const hubValue = this.normalizeHubValue(
                (laneSettings as Record<string, unknown>).hub ?? (lane as Record<string, unknown>).hub
            )

            if (!this.isDirectHub(hubValue)) return false

            const toolLoaded = (lane as Record<string, unknown>).tool_loaded
            return typeof toolLoaded === 'boolean' ? toolLoaded : Boolean(toolLoaded)
        })
    }

    get lanesUsingHub() {
        const normalizedName = this.normalizeHubValue(this.name)
        if (!normalizedName || !Array.isArray(this.laneNames)) return []

        return this.laneNames.filter((laneName) => {
            const lane = this.getAfcLaneObject(laneName)
            if (!lane || typeof lane !== 'object') return false

            const laneHub = this.normalizeHubValue((lane as Record<string, unknown>).hub)
            if (laneHub) return laneHub === normalizedName

            const laneSettings = this.getAfcLaneSettings(laneName) ?? {}
            const configHub = this.normalizeHubValue((laneSettings as Record<string, unknown>).hub)
            return configHub === normalizedName
        })
    }

    get isBoxTurtleUnit() {
        return this.unitType?.toLowerCase() === 'boxturtle'
    }

    normalizeHubValue(value: unknown) {
        if (typeof value === 'string') {
            const trimmed = value.trim().toLowerCase()
            if (trimmed.startsWith('afc_hub ')) return trimmed.slice(8).trim()
            return trimmed
        }

        if (value && typeof value === 'object') {
            const name = (value as Record<string, unknown>).name
            if (typeof name === 'string') return this.normalizeHubValue(name)
        }

        return ''
    }

    isDirectHub(value: string) {
        if (!value) return false
        const normalized = value.replace(/[^a-z0-9]+/g, '_')

        return normalized === 'direct' || normalized === 'direct_load'
    }
}
</script>

<style scoped>
.sensor-status {
    width: 10px;
    height: 10px;
}
</style>
