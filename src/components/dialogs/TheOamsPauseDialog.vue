<template>
    <v-dialog :value="dialogVisible" width="480" persistent :fullscreen="isMobile">
        <panel
            v-if="activePause"
            :title="dialogTitle"
            :icon="mdiAlert"
            card-class="oams-pause-dialog"
            :margin-bottom="false">
            <v-container>
                <v-row>
                    <v-col cols="12" class="text-subtitle-1 font-weight-medium">
                        {{ activePause.params.message }}
                    </v-col>
                </v-row>
                <v-row>
                    <v-col cols="12" md="6">
                        <div class="oams-pause-dialog__label">{{ laneLabel }}</div>
                        <div class="oams-pause-dialog__value">{{ activePause.params.lane || '-' }}</div>
                    </v-col>
                    <v-col cols="12" md="6">
                        <div class="oams-pause-dialog__label">{{ reasonLabel }}</div>
                        <div class="oams-pause-dialog__value">{{ readableReason }}</div>
                    </v-col>
                </v-row>
                <v-row v-if="activePause.params.fps || activePause.params.details">
                    <v-col v-if="activePause.params.fps" cols="12" md="6">
                        <div class="oams-pause-dialog__label">FPS</div>
                        <div class="oams-pause-dialog__value">{{ activePause.params.fps }}</div>
                    </v-col>
                    <v-col v-if="activePause.params.details" cols="12" md="6">
                        <div class="oams-pause-dialog__label">{{ detailsLabel }}</div>
                        <div class="oams-pause-dialog__details">
                            <div v-for="(value, key) in activePause.params.details" :key="key">
                                <strong>{{ key }}:</strong>
                                <span>{{ formatDetail(value) }}</span>
                            </div>
                        </div>
                    </v-col>
                </v-row>
            </v-container>
            <v-card-actions>
                <v-spacer />
                <v-btn text color="error" @click="acknowledgePause(false)">
                    {{ cancelLabel }}
                </v-btn>
                <v-btn color="primary" text @click="acknowledgePause(true)">
                    {{ continueLabel }}
                </v-btn>
            </v-card-actions>
        </panel>
    </v-dialog>
</template>

<script lang="ts">
import { Component, Mixins, Watch } from 'vue-property-decorator'
import BaseMixin from '@/components/mixins/base'
import Panel from '@/components/ui/Panel.vue'
import { PauseEvent } from '@/store/oams'
import { mdiAlertCircleOutline } from '@mdi/js'

@Component({
    components: { Panel },
})
export default class TheOamsPauseDialog extends Mixins(BaseMixin) {
    mdiAlert = mdiAlertCircleOutline

    dialogVisible = false

    get dialogTitle(): string {
        return this.translateOrDefault('App.Dialogs.PauseEvent', 'Pause Event')
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

    get activePause(): PauseEvent | null {
        return this.$store.getters['oams/active'] ?? null
    }

    get readableReason(): string {
        const reason = this.activePause?.params.reason
        if (!reason) return '-'
        return reason.replace(/_/g, ' ')
    }

    @Watch('activePause', { immediate: true })
    onActivePauseChanged(value: PauseEvent | null): void {
        this.dialogVisible = !!value
    }

    formatDetail(value: unknown): string {
        if (value === null || value === undefined) return '-'
        if (typeof value === 'object') {
            try {
                return JSON.stringify(value)
            } catch (e) {
                return String(value)
            }
        }
        return String(value)
    }

    private translateOrDefault(key: string, fallback: string): string {
        const translated = this.$t(key)?.toString?.() ?? ''
        if (!translated || translated === key) {
            return fallback
        }

        return translated
    }

    acknowledgePause(resume: boolean) {
        const pause = this.activePause
        if (!pause) return

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
        this.dialogVisible = false
    }
}
</script>

<style scoped>
.oams-pause-dialog__label {
    font-size: 0.75rem;
    text-transform: uppercase;
    opacity: 0.7;
}

.oams-pause-dialog__value {
    font-size: 1rem;
    word-break: break-word;
}

.oams-pause-dialog__details {
    font-size: 0.9rem;
    display: grid;
    gap: 0.25rem;
}
</style>
