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
      "y_axes": [
        { "axis": 0, "min": 0, "max": 30 }
      ],
      "traces": [
        {
          "expression": "(SA.MVelX**2 + SA.MVelY**2)**0.5",
          "axis": 0,
          "color": "#1f77b4",
          "function": 1,
          "axis_label": "Velocity (m/s)",
          "opacity": 1,
          "line_style": "solid",
          "visible": true
        }
      ]
    }
  ]
}
```

`expression`, `axis`, `color`, `function`, and optional `axis_label`, `opacity`, `line_style`, and `visible` map directly to the established viewer
plot configuration. Version 1 intentionally contains exactly one plot because the
upstream viewer currently renders one plot panel. Imported presets are added to local
browser storage and appear alongside other user presets; importing does not alter an
open plot. An `axis_label` replaces its trace's legend text; when multiple traces share an
axis, the first non-empty axis label in plot order is used as the axis title.
Opacity is a number from 0 to 1. Line style is one of `solid`, `dash`, `dot`, or `dashdot`.
`visible` is a boolean and defaults to `true`; `false` keeps the trace in the preset but hides it from the plot.
`y_axes` is optional and stores an axis number with its minimum and maximum. X-axis limits are not saved.
