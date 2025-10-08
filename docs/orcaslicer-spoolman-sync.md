# Using Moonraker lane data in OrcaSlicer

Mainsail now relies entirely on the live AFC lane objects exposed by Moonraker to
figure out which Spoolman spool is loaded where. No extra metadata is written
back to Spoolman; instead, the UI repeats the same lookup that powers the
"Loaded in Lane" badge.

## How Mainsail detects loaded lanes

- `AfcMixin.lanesData` builds a list of AFC lane objects pulled from the Moonraker
  `printer` state, keeping each lane's `name`, numeric `lane` index, and
  associated `spool_id` ready for consumers. 【F:src/components/mixins/afc.ts†L24-L40】
- `AfcChangeSpoolDialog.checkLoadedSpool` walks those lane records and matches a
  Spoolman spool's numeric ID against each lane's `spool_id` string to decide if
  the dialog should show the green "Loaded in Lane" badge. 【F:src/components/dialogs/AfcChangeSpoolDialog.vue†L248-L263】

Any consumer that can request the same AFC lane list from Moonraker can recreate
this mapping without touching Spoolman's `extra` payloads.

## What OrcaSlicer should do

1. **Query Moonraker for the AFC lanes.** Use the existing HTTP client to call
   `printer.objects.query` for the `AFC_lane` objects and cache their `name`,
   numeric index, and `spool_id` values.
2. **Build a spool-to-lane map.** Convert the response into a dictionary keyed by
   spool ID so AMS trays (or other UI elements) can quickly determine where a
   spool is currently loaded.
3. **Annotate the UI.** Use that dictionary to label trays as "Loaded in Lane" in
   the sidebar and anywhere else OrcaSlicer mirrors the AMS view.
4. **Send lane updates via macros only.** When OrcaSlicer reassigns a spool,
   continue issuing the `SET_SPOOL_ID LANE=<lane> SPOOL_ID=<id>` macro through
   Moonraker. No additional PATCH request to Spoolman is required.

## Request text for the OrcaSlicer repo

```
Please update OrcaSlicer so it mirrors Mainsail's AFC lane detection:

- Fetch the AFC lane objects from Moonraker (the `printer.objects.query` API) and
  cache each lane's `name`, numeric `lane` index, and `spool_id`.
- Build a map keyed by Spoolman spool ID so we can identify which lane currently
  holds a given spool.
- Use that map when syncing AMS trays and rendering "Loaded in Lane" badges in
  the UI.
- Continue to call the `SET_SPOOL_ID` macro to change assignments; stop reading
  or writing the `extra.loaded_lane` field in Spoolman because Moonraker no
  longer updates it.
```
