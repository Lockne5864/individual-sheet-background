const MODULE_ID = "individual-sheet-background";
const BACKGROUND_FLAG = "backgroundPath";
const APPEARANCE_FLAG = "appearance";
const SHEET_SELECTOR = ".dnd5e2.sheet.actor.character";

// Track pending image checks so stale responses cannot change newer sheet state.
const sheetRevisions = new WeakMap();

const DEFAULT_APPEARANCE = Object.freeze({
    zoom: 100,
    positionX: 50,
    positionY: 50,
    gradient: 60
});

const STYLE_PROPERTIES = [
    "--dnd5e-character-header-image",
    "--dnd5e-character-background-image",
    "--dnd5e-character-background-content",
    "--isb-image",
    "--isb-scale",
    "--isb-x",
    "--isb-y",
    "--isb-gradient",
    "--isb-clip-top",
    "--isb-clip-right",
    "--isb-clip-bottom",
    "--isb-clip-left",
    // Clean up experimental properties used by previous versions.
    "--isb-background-image",
    "--isb-background-size",
    "--isb-background-position-x",
    "--isb-background-position-y",
    "--isb-zoom",
    "--isb-position-x",
    "--isb-position-y"
];

/** Keep a numeric value within its allowed range. */
function clamp(value, min, max, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    const number = Number(value);
    return Number.isFinite(number)
        ? Math.min(max, Math.max(min, number))
        : fallback;
}

/** Return the Actor for a D&D 5e character sheet. */
function getCharacterActor(application) {
    if (game.system.id !== "dnd5e") return null;

    const actor = application.actor ?? application.document;
    if (actor?.documentName !== "Actor" || actor.type !== "character") return null;
    return actor;
}

/** Locate the root HTML element for a character sheet. */
function getSheetElement(element) {
    if (!(element instanceof HTMLElement)) return null;
    return element.matches(SHEET_SELECTOR)
        ? element
        : element.querySelector(SHEET_SELECTOR);
}

/** Read appearance settings saved on this specific character. */
function getAppearance(actor) {
    const saved = actor.getFlag(MODULE_ID, APPEARANCE_FLAG) ?? {};
    return {
        zoom: clamp(saved.zoom, 100, 200, DEFAULT_APPEARANCE.zoom),
        positionX: clamp(saved.positionX, 0, 100, DEFAULT_APPEARANCE.positionX),
        positionY: clamp(saved.positionY, 0, 100, DEFAULT_APPEARANCE.positionY),
        gradient: clamp(saved.gradient, 0, 100, DEFAULT_APPEARANCE.gradient)
    };
}

/** Convert a Foundry file path into a root-relative or absolute URL. */
function resolveImageUrl(path) {
    const value = path.trim();
    if (/^https?:\/\//i.test(value)) return value;
    return foundry.utils.getRoute(value.replace(/^\/+/, ""));
}

/** Adjust only CSS variables, without rebuilding the HTML layer. */
function applyAppearance(sheet, appearance) {
    if (!sheet) return;

    const scale = appearance.zoom / 100;
    const cut = 1 - 1 / scale;

    // Crop the transformed artwork back to its original 360px viewport.
    // The clipping distances are calculated in pre-transform coordinates.
    // This avoids clipping native sheet elements or changing their scroll behavior.
    const left = cut * appearance.positionX;
    const right = cut * (100 - appearance.positionX);
    const top = cut * appearance.positionY;
    const bottom = cut * (100 - appearance.positionY);

    sheet.style.setProperty("--isb-scale", String(scale));
    sheet.style.setProperty("--isb-x", `${appearance.positionX}%`);
    sheet.style.setProperty("--isb-y", `${appearance.positionY}%`);
    sheet.style.setProperty("--isb-gradient", `${appearance.gradient}%`);
    sheet.style.setProperty("--isb-clip-top", `${top}%`);
    sheet.style.setProperty("--isb-clip-right", `${right}%`);
    sheet.style.setProperty("--isb-clip-bottom", `${bottom}%`);
    sheet.style.setProperty("--isb-clip-left", `${left}%`);
}

/**
 * Check image availability without downloading an entire local file.
 * A no-cache HEAD request detects deleted Foundry assets even if the browser
 * still holds an old image in its cache. Other hosts fall back to Image loading.
 */
async function canLoadImage(imageUrl) {
    const url = new URL(imageUrl, window.location.href);

    if (url.origin === window.location.origin) {
        try {
            const response = await fetch(url.href, {
                method: "HEAD",
                cache: "no-store"
            });

            if (response.ok) {
                const contentType = response.headers.get("Content-Type") ?? "";
                return !/^text\/html/i.test(contentType);
            }

            if ([401, 403, 404, 410].includes(response.status)) return false;
        } catch (error) {
            console.debug(`[${MODULE_ID}] HEAD check unavailable:`, error);
        }
    }

    // HEAD can be unsupported or unavailable for external image hosts.
    return new Promise(resolve => {
        const image = new Image();
        image.onload = () => resolve(true);
        image.onerror = () => resolve(false);
        image.src = url.href;
    });
}

/** Remove only our own styles and leftover layers from older module versions. */
function clearBackground(sheet) {
    sheet.classList.remove("isb-custom-background");
    sheet.querySelectorAll(".isb-artwork, .isb-header-image-layer")
        .forEach(layer => layer.remove());

    for (const property of STYLE_PROPERTIES) {
        sheet.style.removeProperty(property);
    }
}

/**
 * Apply a single continuous background without inserting new HTML elements.
 * This minimizes conflicts with modules that inspect the native sheet DOM.
 */
function updateBackground(sheet, actor) {
    if (!sheet) return;

    const revision = (sheetRevisions.get(sheet) ?? 0) + 1;
    sheetRevisions.set(sheet, revision);
    clearBackground(sheet);

    const backgroundPath = actor.getFlag(MODULE_ID, BACKGROUND_FLAG);
    if (typeof backgroundPath !== "string" || !backgroundPath.trim()) return;
    if (!sheet.querySelector(".window-content")) return;

    const checkAndApply = async () => {
        const imageUrl = resolveImageUrl(backgroundPath);
        const available = await canLoadImage(imageUrl);

        // A new render, Reset, or Change Background may have happened during
        // the request. Ignore results from an outdated request.
        if (sheetRevisions.get(sheet) !== revision) return;
        if (actor.getFlag(MODULE_ID, BACKGROUND_FLAG) !== backgroundPath) return;

        if (!available) {
            console.warn(
                `[${MODULE_ID}] Background unavailable; using default for ${actor.name}:`,
                backgroundPath
            );
            return;
        }

        sheet.style.setProperty("--isb-image", `url(${JSON.stringify(imageUrl)})`);

        // Disable the two native renderings. Our single illustration is painted
        // by CSS on .window-content::after without changing the sheet DOM.
        sheet.style.setProperty("--dnd5e-character-header-image", "none");
        sheet.style.setProperty("--dnd5e-character-background-image", "none");
        sheet.style.setProperty("--dnd5e-character-background-content", "none");
        applyAppearance(sheet, getAppearance(actor));
        sheet.classList.add("isb-custom-background");
    };

    void checkAndApply().catch(error => {
        if (sheetRevisions.get(sheet) === revision) clearBackground(sheet);
        console.error(`[${MODULE_ID}] Failed to load character background:`, error);
    });
}

/** Synchronize an open sheet with its saved character settings. */
function refreshBackground(application, actor) {
    if (!application.rendered) return;
    updateBackground(getSheetElement(application.element), actor);
}

/** Open the image browser supplied by Foundry. */
function openBackgroundPicker(application, actor) {
    if (!actor.isOwner) return;

    const FilePicker = foundry.applications.apps.FilePicker.implementation;
    const picker = new FilePicker({
        type: "image",
        current: actor.getFlag(MODULE_ID, BACKGROUND_FLAG) ?? "",
        callback: async path => {
            if (!path) return;

            try {
                const imageUrl = resolveImageUrl(path);
                if (!(await canLoadImage(imageUrl))) {
                    ui.notifications.error("The selected background image could not be loaded.");
                    return;
                }

                await actor.setFlag(MODULE_ID, BACKGROUND_FLAG, path);
                refreshBackground(application, actor);
                ui.notifications.info("Character background updated successfully.");
            } catch (error) {
                console.error(`[${MODULE_ID}]`, error);
                ui.notifications.error("Failed to update character background.");
            }
        }
    });

    picker.render({ force: true });
}

/** Read slider values directly from the dialog's rendered HTML. */
function readSliderValues(root) {
    const read = name => root.querySelector(`[name="${name}"]`)?.value;
    return {
        zoom: clamp(read("zoom"), 100, 200, 100),
        positionX: clamp(read("positionX"), 0, 100, 50),
        positionY: clamp(read("positionY"), 0, 100, 50),
        gradient: clamp(read("gradient"), 0, 100, 60)
    };
}

/** Show sliders with live preview; persist only when Save is clicked. */
async function openAppearanceSettings(application, actor) {
    if (!actor.isOwner) return;

    const backgroundPath = actor.getFlag(MODULE_ID, BACKGROUND_FLAG);
    if (!backgroundPath) {
        ui.notifications.warn("Select a background image first.");
        return;
    }

    const settings = getAppearance(actor);
    const content = `
        <div class="isb-settings">
            <label class="isb-control">
                <span>Image Zoom</span>
                <input type="range" name="zoom" min="100" max="200" step="5" value="${settings.zoom}">
                <output data-value-for="zoom">${settings.zoom}%</output>
            </label>
            <label class="isb-control">
                <span>Horizontal Position</span>
                <input type="range" name="positionX" min="0" max="100" step="5" value="${settings.positionX}">
                <output data-value-for="positionX">${settings.positionX}%</output>
            </label>
            <label class="isb-control">
                <span>Vertical Position</span>
                <input type="range" name="positionY" min="0" max="100" step="5" value="${settings.positionY}">
                <output data-value-for="positionY">${settings.positionY}%</output>
            </label>
            <label class="isb-control">
                <span>Gradient Strength</span>
                <input type="range" name="gradient" min="0" max="100" step="5" value="${settings.gradient}">
                <output data-value-for="gradient">${settings.gradient}%</output>
            </label>
            <p class="hint">Preview changes instantly. Save to keep them, or Cancel to revert.</p>
        </div>
    `;

    try {
        await foundry.applications.api.DialogV2.wait({
            window: { title: "Adjust Background" },
            content,
            rejectClose: false,
            buttons: [
                {
                    action: "save",
                    label: "Save Appearance",
                    default: true,
                    callback: async (_event, _button, dialog) => {
                        const root = dialog.element.querySelector(".isb-settings");
                        if (!root) return;
                        await actor.setFlag(
                            MODULE_ID,
                            APPEARANCE_FLAG,
                            readSliderValues(root)
                        );
                        ui.notifications.info("Background appearance saved successfully.");
                        return "saved";
                    }
                },
                { action: "cancel", label: "Cancel" }
            ],
            render: (_event, dialog) => {
                const root = dialog.element.querySelector(".isb-settings");
                if (!root) return;

                root.addEventListener("input", event => {
                    if (!event.target.matches('input[type="range"]')) return;

                    const appearance = readSliderValues(root);
                    for (const input of root.querySelectorAll('input[type="range"]')) {
                        const output = root.querySelector(`[data-value-for="${input.name}"]`);
                        if (output) output.textContent = `${input.value}%`;
                    }

                    const sheet = getSheetElement(application.element);
                    applyAppearance(sheet, appearance);
                });
            }
        });
    } catch (error) {
        console.error(`[${MODULE_ID}]`, error);
        ui.notifications.error("Failed to save background appearance.");
    } finally {
        // This runs after Save, Cancel, and X: restore the actual saved state.
        refreshBackground(application, actor);
    }
}

/** Remove the character-specific image and appearance settings. */
async function resetBackground(application, actor) {
    if (!actor.isOwner) return;

    try {
        await actor.unsetFlag(MODULE_ID, BACKGROUND_FLAG);
        await actor.unsetFlag(MODULE_ID, APPEARANCE_FLAG);
        refreshBackground(application, actor);
        ui.notifications.info("Character background restored.");
    } catch (error) {
        console.error(`[${MODULE_ID}]`, error);
        ui.notifications.error("Failed to reset character background.");
    }
}

Hooks.once("init", () => {
    console.log(`[${MODULE_ID}] Initializing module...`);
});

Hooks.once("ready", () => {
    console.log(`[${MODULE_ID}] Module loaded successfully!`);
});

Hooks.on("getHeaderControlsApplicationV2", (application, controls) => {
    const actor = getCharacterActor(application);
    if (!actor?.isOwner) return;

    controls.unshift(
        {
            action: "isb-change-background",
            icon: "fa-solid fa-image",
            label: "Change Background",
            onClick: () => openBackgroundPicker(application, actor)
        },
        {
            action: "isb-adjust-background",
            icon: "fa-solid fa-sliders",
            label: "Adjust Background",
            onClick: () => openAppearanceSettings(application, actor)
        },
        {
            action: "isb-reset-background",
            icon: "fa-solid fa-rotate-left",
            label: "Reset Background",
            onClick: () => resetBackground(application, actor)
        }
    );
});

Hooks.on("renderApplicationV2", (application, element) => {
    const actor = getCharacterActor(application);
    if (!actor) return;

    updateBackground(getSheetElement(element), actor);
});
