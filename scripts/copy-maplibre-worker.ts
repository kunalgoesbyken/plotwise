import { copyFileSync, mkdirSync } from 'node:fs'

const WORKER_FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-worker.mjs.map']

mkdirSync('public', { recursive: true })
for (const file of WORKER_FILES) copyFileSync(`node_modules/maplibre-gl/dist/${file}`, `public/${file}`)
