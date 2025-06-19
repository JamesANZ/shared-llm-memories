const sharp = require("sharp");
const path = require("path");

async function generateIcons() {
  const sizes = [16, 48, 128];
  const svgPath = path.join(__dirname, "icons", "icon.svg");

  for (const size of sizes) {
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, "icons", `icon${size}.png`));

    console.log(`Generated icon${size}.png`);
  }
}

generateIcons().catch(console.error);
