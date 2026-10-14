import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const src = path.join(root, "src", "assets");
const res = path.join(root, "android", "app", "src", "main", "res");

const BRAND = "#4f46e5"; // indigo-600 used across the app
const FOREGROUND_SCALE = 0.62; // crest inside adaptive-icon safe zone

const densities = {
  mdpi: 1,
  hdpi: 1.5,
  xhdpi: 2,
  xxhdpi: 3,
  xxxhdpi: 4,
};

async function square(source, size) {
  const meta = await sharp(source).metadata();
  const side = Math.min(meta.width, meta.height);
  return sharp(source)
    .extract({ left: Math.floor((meta.width - side) / 2), top: Math.floor((meta.height - side) / 2), width: side, height: side })
    .resize(size, size)
    .toBuffer();
}

async function main() {
  const crest = path.join(src, "crest.jpg");

  for (const [dpi, scale] of Object.entries(densities)) {
    const legacySize = 48 * scale;
    const fgSize = 108 * scale;

    // Legacy square launcher icon: crest on brand background.
    const solid = await sharp({
      create: { width: legacySize, height: legacySize, channels: 3, background: "#4f46e5" },
    }).png().toBuffer();
    const legacy = await sharp(solid).composite([
      { input: await square(crest, Math.round(legacySize * 0.72)), gravity: "center" },
    ]).png().toBuffer();
    await sharp(legacy).toFile(path.join(res, `mipmap-${dpi}`, "ic_launcher.png"));
    await sharp(legacy).toFile(path.join(res, `mipmap-${dpi}`, "ic_launcher_round.png"));

    // Adaptive foreground: transparent canvas, crest in the safe zone.
    const fg = await sharp({ create: { width: fgSize, height: fgSize, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: await square(crest, Math.round(fgSize * FOREGROUND_SCALE)), gravity: "center" }])
      .png().toBuffer();
    await sharp(fg).toFile(path.join(res, `mipmap-${dpi}`, "ic_launcher_foreground.png"));
  }

  // Adaptive icon background color -> brand indigo.
  const bgXml = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#${BRAND.replace("#", "")}</color>\n</resources>\n`;
  await import("fs/promises").then((fs) =>
    fs.writeFile(path.join(res, "values", "ic_launcher_background.xml"), bgXml)
  );

  // Branded splash: indigo background with centered crest.
  const splashSize = 1200;
  const splash = await sharp({
    create: { width: splashSize, height: splashSize, channels: 3, background: "#4f46e5" },
  }).composite([
    { input: await square(crest, Math.round(splashSize * 0.4)), gravity: "center" },
  ]).png().toBuffer();
  await sharp(splash).toFile(path.join(res, "drawable", "splash.png"));

  // Android 12+ splash customization (v31).
  const v31Dir = path.join(res, "values-v31");
  await import("fs/promises").then((fs) => fs.mkdir(v31Dir, { recursive: true }));
  const v31 = `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">\n        <item name="windowSplashScreenBackground">#4f46e5</item>\n        <item name="windowSplashScreenAnimatedIcon">@drawable/splash</item>\n        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>\n    </style>\n</resources>\n`;
  await import("fs/promises").then((fs) =>
    fs.writeFile(path.join(v31Dir, "styles.xml"), v31)
  );

  console.log("Icons generated for all densities.");

  // PWA icons for web manifest
  const pwaDir = path.join(root, "public", "icons");
  await import("fs/promises").then((fs) => fs.mkdir(pwaDir, { recursive: true }));
  for (const size of [192, 512]) {
    const bg = await sharp({
      create: { width: size, height: size, channels: 3, background: BRAND },
    }).png().toBuffer();
    const icon = await sharp(bg).composite([
      { input: await square(crest, Math.round(size * 0.55)), gravity: "center" },
    ]).png().toBuffer();
    await sharp(icon).toFile(path.join(pwaDir, `icon-${size}.png`));
  }
  console.log("PWA icons generated (192, 512).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});