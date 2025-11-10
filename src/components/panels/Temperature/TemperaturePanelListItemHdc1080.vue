<template>
    <tr>
        <td class="icon">
            <v-icon :color="iconColor" class="_no-focus-style cursor-pointer" tabindex="-1" @click="showEditDialog = true">
                {{ mdiThermometerLines }}
            </v-icon>
        </td>
        <td class="name">
            <span class="cursor-pointer" @click="showEditDialog = true">{{ formatName }}</span>
        </td>
        <td class="text-no-wrap text-center" colspan="3">
            <temperature-panel-list-item-hdc1080-value
                v-for="keyName in hdc1080Values"
                :key="keyName"
                :printer-object="printerObject"
                :object-name="objectName"
                :key-name="keyName" />
        </td>
        <temperature-panel-list-item-edit
            :bool-show="showEditDialog"
            :object-name="objectName"
            :name="name"
            :format-name="formatName"
            additional-sensor-name="hdc1080"
            :icon="mdiThermometerLines"
            :color="color"
            @close-dialog="showEditDialog = false" />
    </tr>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins, Prop } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import { convertName } from '@/plugins/helpers'
import { mdiThermometerLines } from '@mdi/js'
import { opacityHeaterActive, opacityHeaterInactive } from '@/store/variables'
import TemperaturePanelListItemHdc1080Value from '@/components/panels/Temperature/TemperaturePanelListItemHdc1080Value.vue'

@Component({
    components: { TemperaturePanelListItemHdc1080Value },
})
export default class TemperaturePanelListItemHdc1080 extends Mixins(BaseMixin) {
    mdiThermometerLines = mdiThermometerLines

    @Prop({ type: String, required: true }) readonly objectName!: string
    @Prop({ type: Boolean, required: true }) readonly isResponsiveMobile!: boolean

    showEditDialog = false
    hdc1080Values = ['temperature', 'humidity']

    get printerObject() {
        return this.$store.state.printer[this.objectName] ?? {}
    }

    get name() {
        const splits = this.objectName.split(' ')
        return splits.length === 1 ? splits[0] : splits[1]
    }

    get formatName() {
        return convertName(this.name)
    }

    get color() {
        return this.$store.state.gui?.view?.tempchart?.datasetSettings?.[this.objectName]?.color ?? '#ffffff'
    }

    get iconColor() {
        // set icon color to active opacity for temperature sensors
        return `${this.color}${opacityHeaterActive}`
    }
}
</script>

<style scoped>
::v-deep .v-icon._no-focus-style:focus::after {
    opacity: 0 !important;
}

::v-deep .cursor-pointer {
    cursor: pointer;
}
</style>
