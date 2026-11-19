'use client'

import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useState } from 'react'
import { Object3D, type DirectionalLight } from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { LngLat } from '@/geo/projection'
import { cameraPosition, type Framing } from './framing'
import type { Palette } from './palette'
import { solarMorning, sunDirection } from './sun'

const SUN_DISTANCE_M = 1500
const SHADOW_REACH_PER_RADIUS = 4.5
const SHADOW_MAP_PX = 2048
const MAX_POLAR_RAD = Math.PI * 0.47

export function Orbit({ framing }: { framing: Framing }) {
  const camera = useThree((state) => state.camera)
  const element = useThree((state) => state.events.connected as HTMLElement | null)
  const invalidate = useThree((state) => state.invalidate)
  const controls = useMemo(() => {
    const orbit = new OrbitControls(camera)
    orbit.enableDamping = true
    orbit.screenSpacePanning = false
    orbit.maxPolarAngle = MAX_POLAR_RAD
    orbit.minDistance = 10
    orbit.maxDistance = 3000
    return orbit
  }, [camera])

  useEffect(() => {
    if (!element) return
    const render = () => invalidate()
    controls.connect(element)
    controls.listenToKeyEvents(element)
    controls.addEventListener('change', render)
    return () => {
      controls.removeEventListener('change', render)
      controls.dispose()
    }
  }, [controls, element, invalidate])

  useEffect(() => {
    camera.position.set(...cameraPosition(framing))
    controls.target.set(...framing.target)
    controls.update()
    invalidate()
  }, [camera, controls, framing, invalidate])

  useFrame(() => controls.update())
  return null
}

export function Sun({ framing, at, palette }: { framing: Framing; at: LngLat; palette: Palette }) {
  const [day] = useState(() => new Date())
  const [target] = useState(() => new Object3D())
  const [dx, dy, dz] = sunDirection(solarMorning(day, at), at)
  const [x, y] = framing.target
  const reach = framing.radiusM * SHADOW_REACH_PER_RADIUS
  return (
    <>
      <hemisphereLight args={[palette.paper, palette.rule, 1.6]} />
      <primitive object={target} position={[x, y, 0]} />
      <directionalLight
        target={target}
        position={[x + dx * SUN_DISTANCE_M, y + dy * SUN_DISTANCE_M, dz * SUN_DISTANCE_M]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[SHADOW_MAP_PX, SHADOW_MAP_PX]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.2}
        shadow-camera-left={-reach}
        shadow-camera-right={reach}
        shadow-camera-top={reach}
        shadow-camera-bottom={-reach}
        shadow-camera-near={1}
        shadow-camera-far={2 * SUN_DISTANCE_M}
        onUpdate={(light: DirectionalLight) => light.shadow.camera.updateProjectionMatrix()}
      />
    </>
  )
}
