import { EditorShell } from '@/editor/editor-shell'
import { PlotScene } from '@/scene/plot-scene'

export default function Home() {
  return <EditorShell view3d={<PlotScene envelope={[]} designs={[]} />} />
}
