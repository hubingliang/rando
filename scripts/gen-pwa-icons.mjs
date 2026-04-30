#!/usr/bin/env node
import { mkdirSync } from "node:fs"
import sharp from "sharp"

mkdirSync("public/icons", { recursive: true })

/** Dice-inspired marks on zinc tile — readable at small sizes */
const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#18181b"/>
  <circle cx="172" cy="172" r="40" fill="#fafafa"/>
  <circle cx="256" cy="256" r="40" fill="#fafafa"/>
  <circle cx="340" cy="340" r="40" fill="#fafafa"/>
</svg>`

const buf = Buffer.from(svg)

await sharp(buf).resize(192, 192).png().toFile("public/icons/icon-192.png")
await sharp(buf).resize(512, 512).png().toFile("public/icons/icon-512.png")
await sharp(buf).resize(180, 180).png().toFile("public/icons/apple-touch-icon.png")

console.log("Wrote public/icons/icon-192.png, icon-512.png, apple-touch-icon.png")
