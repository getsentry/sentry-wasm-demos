# Unity WebGL · exceptionSupport · `@sentry/wasm`

Minimal Unity project that builds **four WebGL players** — one per
`PlayerSettings.WebGL.exceptionSupport` mode — and throws a managed
`InvalidOperationException` through a three-frame deep call stack.

The player has **no Sentry Unity SDK**. Crashes are captured on the harness page
by `@sentry/browser` + `@sentry/wasm` (same as Emscripten/Rust). Expect wasm/IL2CPP
frames, not C# method names. See [COVERAGE_MATRIX.md](../../docs/COVERAGE_MATRIX.md).

## Prerequisites

- **Unity 2022.3 LTS** + **WebGL Build Support** (Unity Hub → Add modules)
- `SENTRY_DSN` in `web/.env` — baked into the **harness** with `cd web && npm run build:js`
  (not into the Unity player)

## First-time editor setup (once)

1. Open `backends/unity/` in Unity Hub.
2. Wait for the empty project to import (no extra packages).
3. Confirm scene `Assets/Scenes/Main.unity` with GameObject `WasmCrashHarness`.
4. Save (`Ctrl/Cmd+S`).

## Build

```bash
export UNITY="/Applications/Unity/Hub/Editor/2022.3.50f1/Unity.app/Contents/MacOS/Unity"
make unity
```

DSN is **not** required for `make unity`. Outputs: `web/assets/unity/<slug>/`.

| Slug | `WebGLExceptionSupport` |
| ---- | ----------------------- |
| `none` | `None` |
| `explicit` | `ExplicitlyThrownExceptionsOnly` |
| `full-no-stack` | `FullWithoutStacktrace` |
| `full-stack` | `FullWithStacktrace` |

One mode:

```bash
make -C backends/unity unity-one MODE=full-stack
```

## From the main harness

```bash
set -a && source web/.env && set +a
cd web && npm run build:js && cd ..
python3 -m http.server 8080
```

Open [http://localhost:8080/web/?backend=unity](http://localhost:8080/web/?backend=unity)
(default `full-stack`). Other modes: `&build=explicit`, `full-no-stack`, `none`.
Load path: `&load=streaming` (default), `non-streaming`, `default`.

**C# deep crash** calls `SendMessage('WasmCrashHarness', 'TriggerDeepCrash')`.
The C# throw becomes an IL2CPP/wasm abort; `@sentry/wasm` attaches wasm frame
metadata when instantiate was patched (it is — `bootstrap.js` inits Sentry first).

Standalone `web/assets/unity/<slug>/index.html` has **no** Sentry — use the harness.

## What to record in Sentry

Filter `wasm.backend=unity`. Compare with emscripten-raycast deep crash on the same DSN.

| Check | Where | Expect |
| ----- | ----- | ------ |
| Event arrived? | Issues | yes on `full-stack` if JS sees the abort |
| C# frames (`Deep3`)? | `exception.stacktrace.frames` `platform: csharp` | **no** |
| Wasm frames? | `*.wasm:wasm-function` / `wasm://` | maybe — fill the matrix |
| `debug_id`? | `debug_meta.images` | often empty (no `build_id` section on Unity wasm) |
| Symbolicated? | `debug_status: found` | **no** — not uploaded |

Details: [docs/UNITY_EXCEPTION_SUPPORT.md](../../docs/UNITY_EXCEPTION_SUPPORT.md).

## Crash surface

```text
WasmCrashHarness.TriggerDeepCrash()
  → Deep1() → Deep2() → Deep3()
    → throw new InvalidOperationException(...)
```

## References

- [Unity — Enable exceptions (WebGL)](https://docs.unity3d.com/2023.2/Documentation/Manual/webgl-building.html)
- [getsentry/sentry-unity#2415](https://github.com/getsentry/sentry-unity/issues/2415) — why exceptionSupport used to matter for the Unity SDK (not used here)
