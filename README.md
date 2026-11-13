# Individual Sheet Background

A lightweight Foundry Virtual Tabletop module that lets each **D&D 5e character** use a different sheet background, with per-character image framing and a smooth fade into the sheet.

> **Development status:** v0.5.4 — tested in a Foundry VTT v14 world running the D&D 5e system v6.0.6. This is a development build, not yet an official Foundry package listing. Other versions and sheet layouts have not yet been verified.

## Features

- **Per-character backgrounds:** Assign an image to one character without changing other character sheets.
- **Built-in image picker:** Choose an image using Foundry's file picker.
- **Live appearance preview:** Adjust image zoom, horizontal position, vertical position, and gradient strength using sliders.
- **Save or cancel:** Save a character's appearance, or close the editor to revert unsaved changes.
- **Reset to default:** Restore the system's original sheet background.
- **Missing-image fallback:** Display the default appearance if a selected image is unavailable when the sheet is rendered.
- **Owner-only editing:** Only users with Owner permission for a character can access the background controls.

## Compatibility

| Component | Tested version |
| --- | --- |
| Foundry Virtual Tabletop | v14 |
| D&D 5e game system | v6.0.6 |
| Sheet | Default D&D 5e character sheet (`.dnd5e2.sheet.actor.character`) |

Only D&D 5e **character** sheets are targeted. NPCs, other game systems, and alternative sheet modules are not currently supported. Compatibility with third-party modules is not guaranteed.

## Installation (development build)

Until a release manifest is published, install manually:

1. Obtain this project's `module.json`, `scripts/main.js`, and `styles/main.css` files.
2. Create a folder named `individual-sheet-background` inside your Foundry **User Data** directory at `Data/modules/`.
3. Place the files in that folder, preserving the `scripts/` and `styles/` subdirectories.
4. Restart Foundry VTT.
5. Open your world and enable **Individual Sheet Background** in **Manage Modules**.

The folder path should contain `Data/modules/individual-sheet-background/module.json` directly. Do not nest the module folder twice.

> The Foundry host installs the module. Players only need a browser to use it after the host enables it.

**Manifest-based installation** will be documented after the first public GitHub Release is published and its download URLs are verified.

## Usage

1. Open a character sheet you own.
2. Open the sheet's header controls menu (`⋮`).
3. Choose **Change Background** to select an image from Foundry's file picker.
4. Choose **Adjust Background** to configure:
   - **Image Zoom:** 100–200%.
   - **Horizontal Position:** 0–100%.
   - **Vertical Position:** 0–100%.
   - **Gradient Strength:** 0–100%.
5. Use **Save Appearance** to keep the settings. Use **Cancel** or close the window to discard unsaved changes.
6. Choose **Reset Background** to return to the system's default background.

Appearance settings are stored on each Actor using Foundry document flags. They persist when the character sheet closes or the browser reloads.

## Recommended image setup

- Use images you have permission to use.
- Prefer images uploaded to Foundry's User Data storage, such as a dedicated `backgrounds/` directory.
- Prefer web-friendly formats such as `.webp` and `.jpg`.
- Avoid moving or deleting an image after assigning it. If the image becomes unavailable, the sheet falls back to its default appearance; the saved path is retained.

## Known limitations

- The module currently targets a specific official D&D 5e character sheet structure. System updates may require CSS adjustments.
- Third-party modules that change the sheet DOM or styling can conflict with its appearance.
- A removed image is checked again when a sheet is rendered or its background is refreshed; there is no continuous monitoring of server files while a sheet is open.
- This development version has not been certified for every Foundry v14 build or every D&D 5e release.

## Project layout

```text
individual-sheet-background/
├── module.json
├── scripts/
│   └── main.js
├── styles/
│   └── main.css
├── README.md
├── CHANGELOG.md
├── LICENSE
└── .gitignore
```

## Troubleshooting

**The module does not appear in Foundry:** Check that `module.json` is directly inside `Data/modules/individual-sheet-background/`, and restart the Foundry server.

**My image does not load:** Confirm that the image is accessible from the Foundry server and that its path is correct. Check the browser developer console for file-loading errors.

**Background options are missing:** Confirm that you have **Owner** permission for the character and are using the default D&D 5e character sheet.

**A different module's button disappears:** Test with the other module disabled and then with this module disabled to isolate the conflict. Keep the console error and both module versions for an issue report.

## Contributing and reporting issues

Bug reports should include the Foundry version, D&D 5e system version, module version, active sheet-related modules, reproduction steps, and relevant console errors. Please avoid posting private world URLs or access tokens.

## License

Released under the [MIT License](LICENSE). Foundry Virtual Tabletop and D&D are trademarks of their respective owners. This project is an independent community module and is not affiliated with or endorsed by them.
