import * as esbuild from 'esbuild';
import process from 'node:process';
import console from 'node:console';
import { readdirSync, copyFileSync } from 'node:fs';

const BuildType = {
    debug: 0,
    release: 1
};

const requested = (process.argv[2] ?? '').toLocaleLowerCase();
let type = BuildType.debug;
if (requested === 'release')
    type = BuildType.release;

// Every geometry is a directory with index.css, every palette is a single file.
// Each becomes its own stylesheet, so a consumer can pick the combination.
const entryPoints = {
    theme: './src/theme.css',
    icon: './src/icon.css',
    general: './src/general.js'
};

for (const entry of readdirSync('./src/geometry', { withFileTypes: true }))
    if (entry.isDirectory())
        entryPoints[`geometry/${entry.name}`] = `./src/geometry/${entry.name}/index.css`;

for (const entry of readdirSync('./src/palette'))
    if (entry.endsWith('.css'))
        entryPoints[`palette/${entry.slice(0, -4)}`] = `./src/palette/${entry}`;

const result = await esbuild.build({
    entryPoints,
    bundle: true,
    outdir: './dist',
    platform: 'browser',
    format: 'iife',
    loader: { '.woff2': 'file' },
    assetNames: 'font/[name]',
    sourcemap: true,
    sourcesContent: false,
    minify: type === BuildType.release,
    metafile: true
});

// The fonts are under SIL OFL, their licenses have to travel with them
for (const entry of readdirSync('./src/font'))
    if (entry.endsWith('.OFL.txt'))
        copyFileSync(`./src/font/${entry}`, `./dist/font/${entry}`);

console.log(await esbuild.analyzeMetafile(result.metafile));
