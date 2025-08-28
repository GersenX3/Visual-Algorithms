import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import soundUrl from "../src/assets/bounce.wav";
import { Play, Pause, Renew, Restart, Settings } from "@carbon/icons-react";
import "@carbon/styles/css/styles.css";

// ----- Utilities -----
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const DEFAULT_SIZE = 55;
const DEFAULT_SPEED = 100; // ms per step
const MIN_VAL = 0;
const MAX_VAL = 80;

// ----- Sorting Step Generators -----
// Each generator yields an object describing a single visualization step.
// Steps: { type: 'compare'|'swap'|'set', indices: [i,j], array?: number[] }

// Bogo Sort
function* bogoSortSteps(arr) {
  const a = arr.slice();

  function isSorted(array) {
    for (let i = 1; i < array.length; i++) {
      if (array[i - 1] > array[i]) return false;
    }
    return true;
  }

  while (!isSorted(a)) {
    // Desordenar con Fisher–Yates shuffle
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
      yield { type: "swap", indices: [i, j], array: a.slice() };
    }
  }
  return a;
}

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

// Selection Sort
function* selectionSortSteps(arr) {
  const a = arr.slice();
  const n = a.length;
  for (let i = 0; i < n - 1; i++) {
    let minIndex = i;
    for (let j = i + 1; j < n; j++) {
      yield { type: "compare", indices: [minIndex, j] };
      if (a[j] < a[minIndex]) {
        minIndex = j;
      }
    }
    if (minIndex !== i) {
      [a[i], a[minIndex]] = [a[minIndex], a[i]];
      yield { type: "swap", indices: [i, minIndex], array: a.slice() };
    }
  }
  return a;
}

// Merge Sort
function* mergeSortSteps(arr) {
  const a = arr.slice();

  function* mergeSort(start, end) {
    if (end - start <= 1) return;
    const mid = Math.floor((start + end) / 2);
    yield* mergeSort(start, mid);
    yield* mergeSort(mid, end);

    let left = a.slice(start, mid);
    let right = a.slice(mid, end);
    let i = 0,
      j = 0,
      k = start;

    while (i < left.length && j < right.length) {
      yield { type: "compare", indices: [start + i, mid + j] };
      if (left[i] <= right[j]) {
        a[k] = left[i++];
      } else {
        a[k] = right[j++];
      }
      yield { type: "set", indices: [k], array: a.slice() };
      k++;
    }

    while (i < left.length) {
      a[k] = left[i++];
      yield { type: "set", indices: [k], array: a.slice() };
      k++;
    }
    while (j < right.length) {
      a[k] = right[j++];
      yield { type: "set", indices: [k], array: a.slice() };
      k++;
    }
  }

  yield* mergeSort(0, a.length);
  return a;
}

// Quick Sort
function* quickSortSteps(arr) {
  const a = arr.slice();

  function* quickSort(low, high) {
    if (low < high) {
      let pivotIndex = low;
      let pivot = a[high];
      for (let i = low; i < high; i++) {
        yield { type: "compare", indices: [i, high] };
        if (a[i] < pivot) {
          [a[i], a[pivotIndex]] = [a[pivotIndex], a[i]];
          yield { type: "swap", indices: [i, pivotIndex], array: a.slice() };
          pivotIndex++;
        }
      }
      [a[pivotIndex], a[high]] = [a[high], a[pivotIndex]];
      yield { type: "swap", indices: [pivotIndex, high], array: a.slice() };

      yield* quickSort(low, pivotIndex - 1);
      yield* quickSort(pivotIndex + 1, high);
    }
  }

  yield* quickSort(0, a.length - 1);
  return a;
}

// Heap Sort
function* heapSortSteps(arr) {
  const a = arr.slice();
  const n = a.length;

  function* heapify(n, i) {
    let largest = i;
    const l = 2 * i + 1;
    const r = 2 * i + 2;

    if (l < n) {
      yield { type: "compare", indices: [l, largest] };
      if (a[l] > a[largest]) largest = l;
    }
    if (r < n) {
      yield { type: "compare", indices: [r, largest] };
      if (a[r] > a[largest]) largest = r;
    }

    if (largest !== i) {
      [a[i], a[largest]] = [a[largest], a[i]];
      yield { type: "swap", indices: [i, largest], array: a.slice() };
      yield* heapify(n, largest);
    }
  }

  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    yield* heapify(n, i);
  }
  for (let i = n - 1; i > 0; i--) {
    [a[0], a[i]] = [a[i], a[0]];
    yield { type: "swap", indices: [0, i], array: a.slice() };
    yield* heapify(i, 0);
  }

  return a;
}

// Counting Sort (solo para enteros >= 0)
function* countingSortSteps(arr) {
  const a = arr.slice();
  const max = Math.max(...a);
  const count = Array(max + 1).fill(0);

  for (let i = 0; i < a.length; i++) {
    count[a[i]]++;
  }

  let k = 0;
  for (let i = 0; i <= max; i++) {
    while (count[i] > 0) {
      a[k] = i;
      yield { type: "set", indices: [k], array: a.slice() };
      k++;
      count[i]--;
    }
  }
  return a;
}

// Radix Sort (base 10)
function* radixSortSteps(arr) {
  const a = arr.slice();
  const max = Math.max(...a);
  let exp = 1;

  while (Math.floor(max / exp) > 0) {
    const output = Array(a.length).fill(0);
    const count = Array(10).fill(0);

    for (let i = 0; i < a.length; i++) {
      count[Math.floor(a[i] / exp) % 10]++;
    }

    for (let i = 1; i < 10; i++) {
      count[i] += count[i - 1];
    }

    for (let i = a.length - 1; i >= 0; i--) {
      const digit = Math.floor(a[i] / exp) % 10;
      output[--count[digit]] = a[i];
    }

    for (let i = 0; i < a.length; i++) {
      a[i] = output[i];
      yield { type: "set", indices: [i], array: a.slice() };
    }
    exp *= 10;
  }
  return a;
}

// Bucket Sort (simple, base en 10 cubetas)
function* bucketSortSteps(arr) {
  const a = arr.slice();
  const n = a.length;
  if (n <= 0) return a;

  let max = Math.max(...a);
  let min = Math.min(...a);
  const bucketCount = Math.floor(Math.sqrt(n));
  const buckets = Array.from({ length: bucketCount }, () => []);

  for (let i = 0; i < n; i++) {
    const idx = Math.floor(((a[i] - min) / (max - min + 1)) * bucketCount);
    buckets[idx].push(a[i]);
  }

  let k = 0;
  for (let b of buckets) {
    b.sort((x, y) => x - y);
    for (let val of b) {
      a[k] = val;
      yield { type: "set", indices: [k], array: a.slice() };
      k++;
    }
  }
  return a;
}

const ALGO_INFO = {
  bubble: {
    complexity: "O(n²)",
    description:
      "Compares adjacent pairs and swaps them until the entire array is sorted.",
  },
  insertion: {
    complexity: "O(n²)",
    description:
      "Inserts each element into the correct position in the already sorted part.",
  },
  selection: {
    complexity: "O(n²)",
    description:
      "Finds the minimum element and repeatedly places it at the beginning.",
  },
  merge: {
    complexity: "O(n log n)",
    description:
      "Divides the array into halves and then merges them in sorted order.",
  },
  quick: {
    complexity: "O(n log n) average, O(n²) worst case",
    description:
      "Selects a pivot and recursively sorts the other elements around it.",
  },
  heap: {
    complexity: "O(n log n)",
    description: "Builds a heap and repeatedly extracts the maximum element.",
  },
  counting: {
    complexity: "O(n + k)",
    description: "Counts occurrences of each value and reconstructs the array.",
  },
  radix: {
    complexity: "O(n·k)",
    description:
      "Sorts by digits, from the least significant to the most significant.",
  },
  bucket: {
    complexity: "O(n + k)",
    description:
      "Distributes elements into buckets, sorts each bucket, and then combines them.",
  },
  bogo: {
    complexity: "O((n+1)!)",
    description: "Randomly shuffles the array until, by chance, it is sorted.",
  },
};

const ALGORITHMS = [
  { id: "bubble", name: "Bubble Sort", gen: bubbleSortSteps },
  { id: "insertion", name: "Insertion Sort", gen: insertionSortSteps },
  { id: "selection", name: "Selection Sort", gen: selectionSortSteps },
  { id: "merge", name: "Merge Sort", gen: mergeSortSteps },
  { id: "quick", name: "Quick Sort", gen: quickSortSteps },
  { id: "heap", name: "Heap Sort", gen: heapSortSteps },
  { id: "counting", name: "Counting Sort", gen: countingSortSteps },
  { id: "radix", name: "Radix Sort", gen: radixSortSteps },
  { id: "bucket", name: "Bucket Sort", gen: bucketSortSteps },
  { id: "bogo", name: "Bogo Sort [BAD]", gen: bogoSortSteps },
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
  const speedRef = useRef(speed);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  const [comparisons, setComparisons] = useState(0);
  const [accesses, setAccesses] = useState(0);

  const algo = useMemo(() => ALGORITHMS.find((a) => a.id === algoId), [algoId]);

  function generateArray(n) {
    return Array.from({ length: n }, () => randInt(MIN_VAL, MAX_VAL));
  }

  const resetArray = useCallback(
    (n = size) => {
      stop();
      const next = generateArray(n);
      setArray(next);
      setHighlight([]);
      setStepsCount(0);
      setComparisons(0);
      setAccesses(0);
    },
    [size]
  );

  const unorderArray = useCallback(() => {
    stop();
    // clonamos el arreglo actual
    const next = [...array];

    // Fisher–Yates shuffle
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }

    setArray(next);
    setHighlight([]);
    setStepsCount(0);
    setComparisons(0);
    setAccesses(0);
  }, [array]);

  const applyStep = useCallback((step) => {
    setStepsCount((c) => c + 1);

    if (step.type === "compare") {
      setComparisons((c) => c + 1);
    }
    if (step.type === "set" || step.type === "swap") {
      setAccesses((c) => c + 1);
    }

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

  const timeoutRef = useRef(null);
  const isSortedRef = useRef(false);

  const start = useCallback(() => {
    if (!genRef.current) {
      genRef.current = algo.gen(array);
      isSortedRef.current = false;
    }

    setIsRunning(true);

    const runStep = () => {
      const res = genRef.current.next();
      if (res.done) {
        // ya terminó el algoritmo
        setIsRunning(false);
        genRef.current = null;
        setHighlight([]);
        isSortedRef.current = true;
        return;
      }

      applyStep(res.value);

      // si no está ordenado, programamos el siguiente paso
      if (!isSortedRef.current) {
        // Reproduce el sonido en cada paso
        if (speedRef.current > 50) {
          const audio = new Audio(soundUrl);
          audio.play();
        }
        timeoutRef.current = setTimeout(runStep, speedRef.current);
      }
    };

    runStep();
  }, [algo, array, applyStep, speed]);

  const startAndSetSteps = useCallback(() => {
    setStepsCount(0);
    setComparisons(0);
    setAccesses(0);
    start();
  }, [start]);

  const pause = useCallback(() => {
    setIsRunning(false);
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    pause();
    genRef.current = null;
    setHighlight([]);
    isSortedRef.current = false;
  }, [pause]);

  const stepOnce = useCallback(() => {
    if (!genRef.current) {
      genRef.current = algo.gen(array);
      isSortedRef.current = false;
    }
    const res = genRef.current.next();
    if (res.done) {
      setIsRunning(false);
      genRef.current = null;
      setHighlight([]);
      isSortedRef.current = true;
      return;
    }
    applyStep(res.value);
  }, [algo, array, applyStep]);

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    },
    []
  );

  // When size changes, regenerate array
  useEffect(() => {
    resetArray(size);
  }, [size]);

  const maxHeight = 240; // px

  return (
    <Theme theme="g100">
      <div
        className="min-h-screen bg-transparent flex flex-col"
        data-carbon-theme="g10"
      >
        <Header aria-label="Sorting Visualizer">
          <HeaderName prefix="">Visual Algorithms</HeaderName>
          <HeaderPanel aria-label="panel" expanded={false} />
        </Header>

        {/* Contenido centrado */}
        <Content className="flex-1 flex justify-center items-center p-6">
          <Grid condensed fullWidth align="right">
            <Column
              lg={16}
              md={8}
              sm={4}
              className="mx-auto flex flex-col items-center"
            >
              {/* Controles */}
              <div
                className="mb-6 w-full flex justify-center"
                style={{
                  gap: 16,
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                <Select
                  id="algorithm"
                  labelText="Algorithm"
                  value={algoId}
                  onChange={(e) => {
                    setAlgoId(e.target.value);
                    stop();
                    setStepsCount(0);
                    setComparisons(0);
                    setAccesses(0);
                  }}
                  size="md"
                  style={{ marginBottom: "1rem" }}
                >
                  {ALGORITHMS.map((a) => (
                    <SelectItem key={a.id} value={a.id} text={a.name} />
                  ))}
                </Select>

                <Slider
                  id="size"
                  labelText="Array size"
                  min={2}
                  max={100}
                  value={size}
                  step={1}
                  onChange={({ value }) => setSize(value)}
                />

                <Slider
                  id="speed"
                  labelText={`Speed (ms/step)`}
                  min={1}
                  max={999}
                  value={speed}
                  step={5}
                  onChange={({ value }) => setSpeed(value)}
                />

                <Button
                  style={{ marginTop: "1rem" }}
                  kind="secondary"
                  onClick={() => unorderArray()}
                  renderIcon={Renew}
                >
                  Unorder
                </Button>

                {!isRunning ? (
                  <Button
                    style={{ marginTop: "1rem" }}
                    kind="primary"
                    onClick={startAndSetSteps}
                    renderIcon={Play}
                  >
                    Order
                  </Button>
                ) : (
                  <Button
                    kind="tertiary"
                    onClick={pause}
                    renderIcon={Pause}
                    style={{ marginTop: "1rem" }}
                  >
                    Pause
                  </Button>
                )}

                <Button
                  kind="ghost"
                  onClick={stepOnce}
                  style={{ marginTop: "1rem" }}
                >
                  Step
                </Button>
                <Button
                  style={{ marginTop: "1rem" }}
                  kind="danger--ghost"
                  onClick={() => {
                    stop();
                    setArray(array.slice().sort((a, b) => a - b));
                  }}
                  renderIcon={Restart}
                >
                  Finish
                </Button>
              </div>

              {/* Visualizador */}
              <Visualizer
                array={array}
                highlight={highlight}
                maxHeight={maxHeight}
              />

              {/* Info */}
              <div
                className="mt-6 p-4 w-full"
                style={{
                  border: "1px solid var(--cds-border-subtle-01)",
                  borderRadius: 8,
                  background: "var(--cds-layer-01)",
                  marginTop: '1rem',
                  padding: '1rem'
                }}
              >
                <div style={{ marginBottom: 8, fontWeight: "bold" }}>
                  {algo.name}
                </div>
                <div style={{ opacity: 0.8, marginBottom: 8 }}>
                  {ALGO_INFO[algo.id]?.description}
                </div>

                <div style={{ display: "flex", gap: 24, flexWrap: "wrap",  }}>
                  <div style={{ opacity: 0.8 }}>Steps: {stepsCount}</div>
                  <div style={{ opacity: 0.8 }}>Comparisons: {comparisons}</div>
                  <div style={{ opacity: 0.8 }}>Array accesses: {accesses}</div>
                  <div style={{ opacity: 0.8 }}>Length: {array.length}</div>
                  <div style={{ opacity: 0.8 }}>
                    Complexity: {ALGO_INFO[algo.id]?.complexity}
                  </div>
                </div>
              </div>
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
        paddingTop: 256,
        display: "flex",
        alignItems: "flex-end",
        gap: 2,
        background: "var(--cds-layer-01)",
        borderRadius: 8,
        overflow: "hidden",
        marginTop: 16,
      }}
    >
      {array.map((v, i) => {
        const h = (v / max) * (maxHeight - 12);
        const isHi = highlight.includes(i);

        return (
          <div
            key={i}
            style={{
              width: `${widthPct}%`,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
            }}
          >
            {/* Texto arriba de la barra */}
            <span
              style={{
                fontSize: 10,
                marginBottom: 2,
                color: isHi
                  ? "var(--cds-support-info)"
                  : "var(--cds-text-secondary)",
              }}
            >
              {v}
            </span>

            <div
              style={{
                width: "100%",
                height: h,
                background: isHi
                  ? "var(--cds-support-info-inverse)"
                  : "var(--cds-interactive)",
                transition: "height 80ms linear",
              }}
            />
          </div>
        );
      })}
    </div>
  );
}
