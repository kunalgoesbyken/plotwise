import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import './style.css'

new maplibregl.Map({
  container: 'app',
  style: 'https://tiles.openfreemap.org/styles/liberty',
  center: [100.5018, 13.7563],
  zoom: 14,
  pitch: 45,
})
