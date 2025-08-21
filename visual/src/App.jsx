import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Theme,
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderPanel,
  HeaderGlobalAction,
  Content,
  Grid,
  Column,
  Select,
  SelectItem,
  Slider,
  Button,
  Toggle,
  NumberInput,
  InlineLoading,
  Tooltip,
} from "@carbon/react";
import { Play, Pause, Renew, Restart, Settings } from "@carbon/icons-react";
import "@carbon/styles/css/styles.css";

// ----- Utilities -----
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const DEFAULT_SIZE = 55;
const DEFAULT_SPEED = 40; // ms per step
const MIN_VAL = 5;
const MAX_VAL = 100;

// ----- Sorting Step Generators -----
// Each generator yields an object describing a single visualization step.
// Steps: { type: 'compare'|'swap'|'set', indices: [i,j], array?: number[] }

function* bubbleSortSteps(arr) {
  const a = arr.slice();
  let n = a.length;
  let swapped;
  do {
    swapped = false;
    for (let i = 1; i < n; i++) {
      yield { type: "compare", indices: [i - 1, i] };
      if (a[i - 1] > a[i]) {
        [a[i - 1], a[i]] = [a[i], a[i - 1]];
        swapped = true;
        yield { type: "swap", indices: [i - 1, i], array: a.slice() };
      }
    }
    n--;
  } while (swapped);
  return a;
}

function* insertionSortSteps(arr) {
  const a = arr.slice();
  for (let i = 1; i < a.length; i++) {
    let key = a[i];
    let j = i - 1;
    yield { type: "compare", indices: [j, i] };
    while (j >= 0 && a[j] > key) {
      a[j + 1] = a[j];
      yield { type: "set", indices: [j, j + 1], array: a.slice() };
      j--;
      if (j >= 0) yield { type: "compare", indices: [j, i] };
    }
    a[j + 1] = key;
    yield { type: "set", indices: [j + 1, i], array: a.slice() };
  }
  return a;
}

const ALGORITHMS = [
  { id: "bubble", name: "Bubble Sort", gen: bubbleSortSteps },
  { id: "insertion", name: "Insertion Sort", gen: insertionSortSteps },
  // Future: add merge, quick, heap
];

// ----- Main App -----
export default function App() {
  const [algoId, setAlgoId] = useState(ALGORITHMS[0].id);
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [array, setArray] = useState(() => generateArray(DEFAULT_SIZE));
  const [isRunning, setIsRunning] = useState(false);
  const [highlight, setHighlight] = useState([]); // indices being compared/swapped
  const [stepsCount, setStepsCount] = useState(0);
  const genRef = useRef(null);
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);

  const algo = useMemo(() => ALGORITHMS.find(a => a.id === algoId), [algoId]);

  function generateArray(n) {
    return Array.from({ length: n }, () => randInt(MIN_VAL, MAX_VAL));
  }

  const resetArray = useCallback((n = size) => {
    stop();
    const next = generateArray(n);
    setArray(next);
    setHighlight([]);
    setStepsCount(0);
  }, [size]);

  const applyStep = useCallback((step) => {
    setStepsCount((c) => c + 1);
    if (step.indices) setHighlight(step.indices);
    if (step.array) setArray(step.array);
  }, []);

  const tick = useCallback(
    (ts) => {
      if (!isRunning) return;

      if (!lastTickRef.current) lastTickRef.current = ts;
      const delta = ts - lastTickRef.current;

      if (delta >= speed) {
        lastTickRef.current = ts;
        const { value, done } = genRef.current.next();
        if (done) {
          setIsRunning(false);
          genRef.current = null;
          setHighlight([]);
          return;
        }
        applyStep(value);
      }

      rafRef.current = requestAnimationFrame(tick);
    },
    [isRunning, speed, applyStep]
  );

  const start = useCallback(() => {
    if (!genRef.current) {
      genRef.current = algo.gen(array);
    }
    setIsRunning(true);
    lastTickRef.current = 0;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [algo, array, tick]);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const stop = useCallback(() => {
    pause();
    genRef.current = null;
    setHighlight([]);
  }, [pause]);

  const stepOnce = useCallback(() => {
    if (!genRef.current) {
      genRef.current = algo.gen(array);
    }
    const res = genRef.current.next();
    if (res.done) {
      setIsRunning(false);
      genRef.current = null;
      setHighlight([]);
      return;
    }
    applyStep(res.value);
  }, [algo, array, applyStep]);

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); }, []);

  // When size changes, regenerate array
  useEffect(() => { resetArray(size); }, [size]);

  const maxHeight = 240; // px

  return (
    <Theme theme="g100">
      <div className="min-h-screen bg-transparent" data-carbon-theme="g10">
        <Header aria-label="Sorting Visualizer">
          <HeaderName prefix="">Visual Algorithms</HeaderName>
          <HeaderPanel aria-label="panel" expanded={false} />
        </Header>

        <Content className="p-6">
          <Grid condensed fullWidth>
            <Column lg={12} md={8} sm={4}>
              <div className="mb-4" style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
                <Select
                  id="algorithm"
                  labelText="Algorithm"
                  value={algoId}
                  onChange={(e) => { setAlgoId(e.target.value); stop(); setStepsCount(0); }}
                  size="md"
                >
                  {ALGORITHMS.map(a => (
                    <SelectItem key={a.id} value={a.id} text={a.name} />
                  ))}
                </Select>

                <Slider
                  id="size"
                  labelText="Array size"
                  min={10}
                  max={100}
                  value={size}
                  step={1}
                  onChange={({ value }) => setSize(value)}
                />

                <Slider
                  id="speed"
                  labelText={`Speed (ms/step)`}
                  min={5}
                  max={200}
                  value={speed}
                  step={5}
                  onChange={({ value }) => setSpeed(value)}
                />


                  <Button kind="secondary" onClick={() => resetArray()} renderIcon={Renew}>Unorder</Button>


                {!isRunning ? (
                  <Button kind="primary" onClick={start} renderIcon={Play}>Order</Button>
                ) : (
                  <Button kind="tertiary" onClick={pause} renderIcon={Pause}>Pause</Button>
                )}

                <Button kind="ghost" onClick={stepOnce}>Step</Button>
                <Button kind="danger--ghost" onClick={() => { stop(); setArray(array.slice().sort((a,b)=>a-b)); }} renderIcon={Restart}>Finish</Button>
              </div>

              <div className="mb-2" style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                {/* <InlineLoading status={isRunning ? "active" : "finished"} description={isRunning ? "Sorting…" : "Ready"} /> */}
                <div style={{ opacity: 0.8 }}>Steps: {stepsCount}</div>
                <div style={{ opacity: 0.8 }}>Length: {array.length}</div>
                <div style={{ opacity: 0.8 }}>Algorithm: {algo.name}</div>
              </div>
            </Column>

            <Column lg={12} md={8} sm={4}>
              <Visualizer array={array} highlight={highlight} maxHeight={maxHeight} />
            </Column>
          </Grid>
        </Content>
      </div>
    </Theme>
  );
}

function Visualizer({ array, highlight, maxHeight }) {
  const max = useMemo(() => Math.max(...array, 1), [array]);
  const widthPct = 100 / array.length;
  return (
    <div
      style={{
        height: maxHeight,
        border: "1px solid var(--cds-border-subtle-01)",
        padding: 8,
        display: "flex",
        alignItems: "flex-end",
        gap: 2,
        background: "var(--cds-layer-01)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {array.map((v, i) => {
        const h = (v / max) * (maxHeight - 12);
        const isHi = highlight.includes(i);
        return (
          <div
            key={i}
            title={`${v}`}
            style={{
              width: `${widthPct}%`,
              height: h,
              background: isHi ? "var(--cds-support-info-inverse)" : "var(--cds-interactive)",
              transition: "height 80ms linear",
            }}
          />
        );
      })}
    </div>
  );
}
