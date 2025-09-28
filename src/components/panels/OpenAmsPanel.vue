<template>
    <panel :title="panelTitle" :icon="mdiFactory" :collapsible="true" card-class="openams-panel">
        <v-container>
            <v-row>
                <v-col cols="12">
                    <div class="openams-panel__section-title">{{ statusHeading }}</div>
                    <v-simple-table v-if="statusList.length">
                        <thead>
                            <tr>
                                <th>{{ fpsLabel }}</th>
                                <th>{{ laneLabel }}</th>
                                <th>{{ stateLabel }}</th>
                                <th>{{ messageLabel }}</th>
                                <th class="text-right">{{ updatedLabel }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="status in statusList" :key="status.id" :class="statusRowClass(status)">
                                <td>{{ status.fps ?? status.id }}</td>
                                <td>{{ status.lane ?? placeholder }}</td>
                                <td>
                                    <v-chip
                                        v-if="status.status"
                                        :color="status.isError ? 'error' : 'success'"
                                        small
                                        dark
                                        class="font-weight-medium text-uppercase">
                                        {{ status.status }}
                                    </v-chip>
                                    <span v-else>{{ status.isError ? errorLabel : placeholder }}</span>
                                </td>
                                <td>
                                    <div>{{ status.message ?? placeholder }}</div>
                                    <div v-if="status.reason" class="openams-panel__reason">{{ readableReason(status.reason) }}</div>
                                </td>
                                <td class="text-right text-no-wrap">{{ formatTimestamp(status.updatedAt) }}</td>
                            </tr>
                        </tbody>
                    </v-simple-table>
                    <div v-else class="text--disabled">{{ emptyStatusLabel }}</div>
                </v-col>
            </v-row>
            <v-divider class="my-4" />
            <v-row>
                <v-col cols="12">
                    <div class="openams-panel__section-title">{{ errorHeading }}</div>
                    <div v-if="!pendingPauses.length" class="text--disabled">{{ emptyErrorsLabel }}</div>
                    <v-alert
                        v-for="pause in pendingPauses"
                        :key="pause.params.event_id"
                        type="error"
                        dense
                        border="left"
                        color="error"
                        class="mb-4">
                        <div class="font-weight-medium text-subtitle-1 mb-2">{{ pause.params.message }}</div>
                        <v-row class="text-body-2">
                            <v-col cols="12" md="4">
                                <strong>{{ laneLabel }}:</strong>
                                <span>{{ pause.params.lane ?? placeholder }}</span>
                            </v-col>
                            <v-col v-if="pause.params.fps" cols="12" md="4">
                                <strong>{{ fpsLabel }}:</strong>
                                <span>{{ pause.params.fps }}</span>
                            </v-col>
                            <v-col cols="12" md="4">
                                <strong>{{ reasonLabel }}:</strong>
                                <span>{{ readableReason(pause.params.reason) }}</span>
                            </v-col>
                        </v-row>
                        <div v-if="hasDetails(pause)" class="openams-panel__details">
                            <div class="openams-panel__details-title">{{ detailsLabel }}</div>
                            <div class="openams-panel__details-grid">
                                <div v-for="(value, key) in pause.params.details" :key="key">
                                    <strong>{{ key }}:</strong>
                                    <span>{{ formatDetail(value) }}</span>
                                </div>
                            </div>
                        </div>
                        <div class="text-right mt-3">
                            <v-btn text color="error" @click="acknowledgePause(pause, false)">
                                {{ cancelLabel }}
                            </v-btn>
                            <v-btn text color="primary" @click="acknowledgePause(pause, true)">
                                {{ continueLabel }}
                            </v-btn>
                        </div>
                    </v-alert>
                </v-col>
            </v-row>
        </v-container>
    </panel>
</template>

<script lang="ts">
import Component from 'vue-class-component'
import { Mixins } from 'vue-property-decorator'
import Panel from '@/components/ui/Panel.vue'
import BaseMixin from '@/components/mixins/base'
import { FpsStatus, PauseEvent } from '@/store/oams'
import { mdiFactory } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class OpenAmsPanel extends Mixins(BaseMixin) {
    mdiFactory = mdiFactory

    get panelTitle(): string {
        return this.translateOrDefault('Panels.OpenAms.Title', 'OpenAMS')
    }

    get statusHeading(): string {
        return this.translateOrDefault('Panels.OpenAms.StatusHeading', 'Feeder Status')
    }

    get errorHeading(): string {
        return this.translateOrDefault('Panels.OpenAms.ErrorsHeading', 'Active Errors')
    }

    get emptyStatusLabel(): string {
        return this.translateOrDefault('Panels.OpenAms.NoStatus', 'No feeder status reported.')
    }

    get emptyErrorsLabel(): string {
        return this.translateOrDefault('Panels.OpenAms.NoErrors', 'No active OpenAMS errors.')
    }

    get cancelLabel(): string {
        return this.translateOrDefault('JobQueue.Cancel', 'Cancel Print')
    }

    get continueLabel(): string {
        return this.translateOrDefault('General.Continue', 'Continue')
    }

    get laneLabel(): string {
        return this.translateOrDefault('General.Lane', 'Lane')
    }

    get reasonLabel(): string {
        return this.translateOrDefault('General.Reason', 'Reason')
    }

    get detailsLabel(): string {
        return this.translateOrDefault('General.Details', 'Details')
    }

    get fpsLabel(): string {
        return this.translateOrDefault('Panels.OpenAms.Fps', 'FPS')
    }

    get messageLabel(): string {
        return this.translateOrDefault('General.Message', 'Message')
    }

    get stateLabel(): string {
        return this.translateOrDefault('General.Status', 'Status')
    }

    get updatedLabel(): string {
        return this.translateOrDefault('Panels.OpenAms.Updated', 'Updated')
    }

    get errorLabel(): string {
        return this.translateOrDefault('General.Error', 'Error')
    }

    get placeholder(): string {
        return '-'
    }

    get statusList(): FpsStatus[] {
        return this.$store.getters['oams/statusList'] ?? []
    }

    get pendingPauses(): PauseEvent[] {
        return this.$store.getters['oams/pendingList'] ?? []
    }

    statusRowClass(status: FpsStatus): Record<string, boolean> {
        return {
            'openams-panel__status-row--error': status.isError,
        }
    }

    readableReason(reason?: string | null): string {
        if (!reason) return this.placeholder
        return reason.replace(/_/g, ' ')
    }

    hasDetails(pause: PauseEvent): boolean {
        const details = pause.params.details
        return details && typeof details === 'object' && !Array.isArray(details) && Object.keys(details).length > 0
    }

    formatDetail(value: unknown): string {
        if (value === null || value === undefined) return this.placeholder
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value)
            } catch (e) {
                return String(value)
            }
        }
        return String(value)
    }

    formatTimestamp(timestamp: number): string {
        if (!timestamp) return this.placeholder
        try {
            const date = new Date(timestamp)
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        } catch (e) {
            return this.placeholder
        }
    }

    acknowledgePause(pause: PauseEvent, resume: boolean) {
        if (!pause?.params?.event_id) return

        const body: Record<string, unknown> = {
            event_id: pause.params.event_id,
            acknowledged: true,
        }

        let method = 'oams.pause_ack'
        if (resume) {
            method = 'oams.stuck_spool_resume'
            body.resume_follow = true
        }

        this.$socket.emit('printer.remote_method', {
            method,
            params: body,
        })

        this.$store.commit('oams/clear', pause.params.event_id)
    }

    private translateOrDefault(key: string, fallback: string): string {
        const translated = this.$t(key)?.toString?.() ?? ''
        if (!translated || translated === key) {
            return fallback
        }

        return translated
    }
}
</script>

<style scoped>
.openams-panel__section-title {
    font-weight: 600;
    font-size: 0.95rem;
    text-transform: uppercase;
    opacity: 0.7;
    margin-bottom: 0.75rem;
}

.openams-panel__status-row--error {
    background: rgba(244, 67, 54, 0.05);
}

.openams-panel__reason {
    font-size: 0.75rem;
    opacity: 0.7;
}

.openams-panel__details {
    margin-top: 0.5rem;
}

.openams-panel__details-title {
    font-weight: 600;
    font-size: 0.8rem;
    text-transform: uppercase;
    margin-bottom: 0.25rem;
}

.openams-panel__details-grid {
    display: grid;
    gap: 0.25rem;
    font-size: 0.8rem;
}
</style>
