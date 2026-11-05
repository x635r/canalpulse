import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Header } from './components/Header'
import { ChokepointRail } from './components/ChokepointRail'
import { ChartStage } from './components/ChartStage'
import { ConvoyDock } from './components/ConvoyDock'
import { BlockadeReplay } from './components/BlockadeReplay'
import { QueuePanel, ChartProbe, ArchivePanel } from './components/RightRail'
import { TideWindow } from './components/TideWindow'
import { FooterTicker } from './components/FooterTicker'
import { SourcesDrawer } from './components/SourcesDrawer'
import { RailToggle } from './components/RailToggle'
import { ErrorBoundary } from './components/ErrorBoundary'
import { chokepointById, defaultChokepoint, modeMeta, networkPressure } from './data/chokepoints'
import { generateFleet, getLeadVessel } from './data/fleet'
import { useWeather } from './lib/useWeather'
import { useLiveAis } from './lib/useLiveAis'
import { useOceanObservations } from './lib/useOceanObservations'
import { usePortWatch } from './lib/usePortWatch'
import { useTideForecast } from './lib/useTideForecast'
import { BLOCK_COEFFICIENT, squatBarrass, waterwayClassFor } from './lib/nautical'
import { useUrlState } from './lib/useUrlState'
import type { OceanLayerId } from './data/oceanLayers'
import type { ChokepointId, MapMode } from './types'

function App() {
  const { initial: urlState, sync: syncUrl } = useUrlState()

  const [chokepointId, setChokepointId] = useState<ChokepointId>(() => {
    const fromUrl = urlState.gate
    return fromUrl && fromUrl in chokepointById ? (fromUrl as ChokepointId) : defaultChokepoint.id
  })
  const [mode, setMode] = useState<MapMode>(() => {
    const allowed: MapMode[] = ['flow', 'bathymetry', 'anchorages', 'recon', 'world']
    return allowed.includes(urlState.mode as MapMode) ? (urlState.mode as MapMode) : 'flow'
  })
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const [reconProgress, setReconProgress] = useState(0.36)
  const [reconPlaying, setReconPlaying] = useState(false)
  const [selectionByChokepoint, setSelectionByChokepoint] = useState<Partial<Record<ChokepointId, string>>>({})
  const [draftOverride, setDraftOverride] = useState<{ id: string; value: number } | null>(null)
  const [speedOverride, setSpeedOverride] = useState<number | null>(null)
  // The chart is the primary surface, so the sandbox dock starts collapsed and
  // only claims height when the operator opens it.
  const [dockOpen, setDockOpen] = useState(false)
  // Live AIS is only polled while the operator asks for it, so the default page
  // load never depends on a third-party feed being reachable.
  const [liveAisOn, setLiveAisOn] = useState(false)
  // 1x is true real time; the higher steps are for watching flow patterns.
  const [timeScale, setTimeScale] = useState(1)
  // Ocean data layers are opt-in: the base chart should stay light on first load.
  const [oceanLayers, setOceanLayers] = useState<OceanLayerId[]>(() =>
    urlState.layers.length > 0 ? (urlState.layers as OceanLayerId[]) : ['buoys'],
  )
  // Rails float over the chart, so they can be dismissed for a clean full-map view.
  const [leftRailOpen, setLeftRailOpen] = useState(true)
  const [rightRailOpen, setRightRailOpen] = useState(true)

  const chokepoint = chokepointById[chokepointId]
  const fleet = useMemo(() => generateFleet(chokepoint), [chokepoint])
  const selectedVessel =
    fleet.find((vessel) => vessel.id === selectionByChokepoint[chokepoint.id]) ?? getLeadVessel(fleet)
  const probeDraft =
    draftOverride?.id === selectedVessel.id ? draftOverride.value : selectedVessel.draft
  const weather = useWeather(chokepoint)
  const liveAis = useLiveAis(liveAisOn)
  const oceanObservations = useOceanObservations(true)
  const portWatch = usePortWatch()
  const tide = useTideForecast(chokepoint.id)

  const toggleOceanLayer = (id: OceanLayerId) => {
    setOceanLayers((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
    )
  }

  // Respect the operator's explicit choices. Filtering by mode here silently
  // dropped layers the user had just switched on when they changed view.
  const modeOceanLayers = oceanLayers

  const selectVessel = (id: string) => {
    const vessel = fleet.find((entry) => entry.id === id)
    if (!vessel) return
    setSelectionByChokepoint((current) => ({ ...current, [chokepoint.id]: vessel.id }))
    setDraftOverride(null)
    setSpeedOverride(null)
  }

  const cycleVessel = (direction: -1 | 1) => {
    const anchored = fleet.filter((vessel) => vessel.status === 'anchored')
    if (anchored.length === 0) return
    const index = anchored.findIndex((vessel) => vessel.id === selectedVessel.id)
    const next = anchored[(index + direction + anchored.length) % anchored.length]
    setSelectionByChokepoint((current) => ({ ...current, [chokepoint.id]: next.id }))
    setDraftOverride(null)
  }

  const selectChokepoint = (id: ChokepointId) => {
    setChokepointId(id)
    // Picking a gate from the global chart drills into that gate's own view.
    if (mode === 'recon' || mode === 'world') {
      setMode('flow')
      setReconPlaying(false)
    }
  }

  const changeMode = (nextMode: MapMode) => {
    if (nextMode === 'recon') {
      setChokepointId('suez')
      setReconPlaying(false)
    } else {
      setReconPlaying(false)
    }
    setMode(nextMode)
  }

  const openRecon = () => {
    setChokepointId('suez')
    setMode('recon')
    setReconProgress(0)
    setReconPlaying(true)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return

      const modeEntry = modeMeta.find((entry) => entry.shortcut === event.key)
      if (!modeEntry) return
      event.preventDefault()
      if (modeEntry.id === 'recon') setChokepointId('suez')
      setReconPlaying(false)
      setMode(modeEntry.id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Mirror shareable state into the URL so a view can be bookmarked.
  useEffect(() => {
    syncUrl({ gate: chokepointId, mode, layers: oceanLayers })
  }, [chokepointId, mode, oceanLayers, syncUrl])

  // The sandbox dock belongs to a single waterway, so the global chart hides it.
  const showDock = mode !== 'world'

  return (
    <div className={`app ${mode === 'recon' ? 'app--recon' : ''}`}>
      <div className="ambient-layer" aria-hidden="true">
        <div className="ambient-orb ambient-orb--one" />
        <div className="ambient-orb ambient-orb--two" />
        <div className="ambient-scan" />
      </div>

      <Header
        weather={weather}
        pressure={networkPressure}
        onOpenSources={() => setSourcesOpen(true)}
      />

      <main
        className={`workspace ${leftRailOpen ? '' : 'rail-left-hidden'} ${
          rightRailOpen ? '' : 'rail-right-hidden'
        }`}
      >
        <RailToggle
          side="left"
          open={leftRailOpen}
          onToggle={() => setLeftRailOpen((value) => !value)}
          label="咽喉列表"
        />
        <RailToggle
          side="right"
          open={rightRailOpen}
          onToggle={() => setRightRailOpen((value) => !value)}
          label="数据面板"
        />

        <ChokepointRail
          activeId={chokepoint.id}
          onSelect={(entry) => selectChokepoint(entry.id)}
          onOpenSources={() => setSourcesOpen(true)}
          transits={portWatch.transits}
        />

        <div className={`center-stack ${dockOpen ? 'is-dock-open' : ''}`}>
          <ErrorBoundary surface="主海图">
          <ChartStage
            chokepoint={chokepoint}
            mode={mode}
            onModeChange={changeMode}
            onSelectChokepoint={selectChokepoint}
            vessels={fleet}
            selectedVessel={selectedVessel}
            onSelectVessel={selectVessel}
            onCycleVessel={cycleVessel}
            timeScale={timeScale}
            onTimeScale={setTimeScale}
            activeOceanLayers={modeOceanLayers}
            onToggleOceanLayer={toggleOceanLayer}
            oceanObservations={oceanObservations}
            liveAis={liveAis}
            liveAisOn={liveAisOn}
            onToggleLiveAis={() => setLiveAisOn((value) => !value)}
            weather={weather}
            reconProgress={reconProgress}
            onOpenSources={() => setSourcesOpen(true)}
          />
          </ErrorBoundary>

          {!showDock ? null : dockOpen ? (
            <>
              {mode === 'recon' ? (
                <BlockadeReplay
                  progress={reconProgress}
                  onProgress={setReconProgress}
                  playing={reconPlaying}
                  onPlaying={setReconPlaying}
                  onExit={() => changeMode('flow')}
                />
              ) : (
                <ConvoyDock key={chokepoint.id} chokepoint={chokepoint} />
              )}
              <button
                type="button"
                className="dock-collapse"
                onClick={() => setDockOpen(false)}
                aria-label="收起编队沙盒"
              >
                <ChevronDown size={13} />
                COLLAPSE
              </button>
            </>
          ) : (
            <button
              type="button"
              className="dock-expand"
              onClick={() => setDockOpen(true)}
              aria-label="展开编队沙盒"
            >
              <ChevronUp size={13} />
              {mode === 'recon' ? 'BLOCKADE REPLAY' : 'CONVOY SANDBOX'}
            </button>
          )}
        </div>

        <aside className="right-rail">
          <ErrorBoundary surface="数据面板">
          <QueuePanel
            chokepoint={chokepoint}
            transits={portWatch.transits[chokepoint.id]}
            portWatchLive={portWatch.status === 'live'}
          />
          <ChartProbe
            chokepoint={chokepoint}
            selectedVessel={selectedVessel}
            onCycleVessel={cycleVessel}
            draft={probeDraft}
            onDraft={(value) => setDraftOverride({ id: selectedVessel.id, value })}
            speedOverride={speedOverride}
            onSpeed={setSpeedOverride}
          />
          <TideWindow
            forecast={tide}
            requiredTide={Math.max(
              0,
              chokepoint.depth.minUkc +
                probeDraft -
                chokepoint.depth.chartDepth +
                // squat really is speed- and hull-dependent; use the same
                // engine the UKC panel uses so the two never disagree.
                squatBarrass(BLOCK_COEFFICIENT[selectedVessel.type], 7.5, waterwayClassFor(chokepoint.straitType, chokepoint.channel.lockChambers)),
            )}
            vesselDraft={probeDraft}
          />
          <ArchivePanel
            mode={mode}
            progress={reconProgress}
            onReplay={openRecon}
            onModeChange={changeMode}
          />
          </ErrorBoundary>
        </aside>
      </main>

      <FooterTicker />
      <SourcesDrawer open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </div>
  )
}

export default App
