<template>
    <div>
        <v-row>
            <v-col class="pb-0 d-flex flex-row justify-space-between align-center">
                <h3 class="text-h6">
                    <v-icon v-if="modulIcon" left>{{ modulIcon }}</v-icon>
                    {{ unitNameOutput }}
                </h3>
                <v-spacer />
                <afc-panel-unit-hub
                    v-for="hub in hubIndicators"
                    :key="hub.key"
                    :name="hub.name"
                    :unit-type="type"
                    :lanes="hub.lanes"
                    :display-name="hub.displayName"
                    :label="hub.label" />
            </v-col>
        </v-row>
        <v-row>
            <v-col class="d-flex flex-row flex-wrap afc-unit-container">
                <afc-panel-unit-lane v-for="lane in lanes" :key="lane" :name="lane" />
            </v-col>
        </v-row>
    </div>
</template>
<script lang="ts">
import { Component, Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import AfcMixin from '@/components/mixins/afc'
import { afcIconBoxTurtle, afcIconHtlf, afcIconNightOwl, afcIconQuattroBox, afcIconAMS } from '@/plugins/afcIcons'
import { convertName } from '@/plugins/helpers'

@Component
export default class AfcPanelUnit extends Mixins(BaseMixin, AfcMixin) {
    @Prop({ type: String, required: true }) readonly name!: string

    private readonly directHubNames = ['direct', 'direct_load']

    get hubIndicators(): HubIndicator[] {
        const baseIndicators = this.hubs.map((hubName) => ({
            key: `hub-${hubName}`,
            name: hubName,
            lanes: this.lanes,
        }))

        if (this.type.toLowerCase() !== 'boxturtle') {
            return baseIndicators
        }

        const filteredBase = baseIndicators.filter(
            (indicator) => !this.directHubNames.includes(this.normalizeHubName(indicator.name))
        )

        const directIndicators = this.lanes.reduce<HubIndicator[]>((acc, laneName) => {
            const laneHubName = this.normalizeHubName(this.getLaneHubValue(laneName))
            if (!laneHubName || !this.directHubNames.includes(laneHubName)) {
                return acc
            }

            const hubDisplay = convertName(laneHubName)
            const laneDisplay = convertName(laneName)

            acc.push({
                key: `hub-${laneHubName}-${laneName}`,
                name: laneHubName,
                lanes: [laneName],
                displayName: `${hubDisplay} - ${laneDisplay}`,
                label: `${hubDisplay} - ${laneDisplay}`,
            })

            return acc
        }, [])

        return [...filteredBase, ...directIndicators]
    }

    get unitName() {
        return this.name.substring(this.name.indexOf(' ') + 1)
    }

    get unitNameOutput() {
        return convertName(this.unitName)
    }

    get unit() {
        const printer = this.$store.state.printer ?? {}
        const moduleName = this.name.substring(0, this.name.indexOf(' ')).replaceAll('_', '')
        const unitObjectName = `AFC_${moduleName} ${this.unitName}`.toLowerCase()
        const objectName = Object.keys(printer).find((key) => key.toLowerCase() === unitObjectName) ?? ''

        return printer[objectName] ?? {}
    }

    get hubs() {
        return this.unit.hubs ?? []
    }

    get lanes() {
        return this.unit.lanes ?? []
    }

    get type() {
        const moduleName = this.name.substring(0, this.name.indexOf(' ')).replaceAll('_', '')

        return moduleName.toLowerCase()
    }

    get modulIcon() {
        if (!this.afcShowUnitIcons) return null

        switch (this.type) {
            case 'boxturtle':
                return afcIconBoxTurtle
            case 'htlf':
                return afcIconHtlf
            case 'nightowl':
                return afcIconNightOwl
            case 'quattrobox':
                return afcIconQuattroBox
            case 'ams':
                return afcIconAMS
            default:
                return null
        }
    }

    getLaneHubValue(laneName: string) {
        const lane = this.getLaneObject(laneName)
        const laneHub = lane?.hub ?? lane?.hub_name
        if (laneHub) return laneHub

        const settingsHub = this.getLaneSettings(laneName)?.hub

        return settingsHub ?? ''
    }

    getLaneObject(laneName: string) {
        return (this.getAfcLaneObject(laneName) ?? {}) as Record<string, any>
    }

    getLaneSettings(laneName: string) {
        return (this.getAfcLaneSettings(laneName) ?? {}) as Record<string, any>
    }

    normalizeHubName(value: unknown): string {
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

interface HubIndicator {
    key: string
    name: string
    lanes: string[]
    displayName?: string
    label?: string
}
</script>

<style scoped>
.afc-unit-container {
    gap: 16px;
}
</style>
