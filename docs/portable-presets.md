# Portable graph presets

UAVLogViewer continues to keep locally saved presets in browser storage for convenience.
The **Export Preset** and **Import Preset** actions in **Plot Setup** provide the portable,
shareable format.

Files use JSON and the recommended extension is `.uavlog-preset.json`.

```json
{
  "schema_version": 1,
  "name": "Loiter velocity analysis",
  "plots": [
    {
      "title": "Loiter velocity analysis",
      "traces": [
        {
          "expression": "(SA.MVelX**2 + SA.MVelY**2)**0.5",
          "axis": 0,
          "color": "#1f77b4",
          "function": 1
        }
      ]
    }
  ]
}
```

`expression`, `axis`, `color`, and `function` map directly to the established viewer
plot configuration. Version 1 intentionally contains exactly one plot because the
upstream viewer currently renders one plot panel. Imported presets are added to local
browser storage and appear alongside other user presets; importing does not alter an
open plot.
