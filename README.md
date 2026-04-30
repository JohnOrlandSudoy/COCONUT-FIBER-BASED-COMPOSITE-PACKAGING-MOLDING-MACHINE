# Coconut Fiber Composite – Packaging Molding Machine (3D Demo)

Interactive 3D demo (React + Three.js) ng molding machine. May controls para sa playback, speed, at process inputs (binder viscosity/volume, temperature, pressing time, mixing time).

## Requirements

- Node.js (recommended: LTS)
- npm (kasama na sa Node.js)

## Install

1) Open terminal sa project folder:

```bash
cd c:\Users\ADMIN\Desktop\animated
```

2) Install dependencies:

```bash
npm install
```

## Run (Development)

```bash
npm run dev
```

Pag nag-run na, buksan sa browser yung URL na lalabas sa terminal (usually `http://localhost:5173/`).

## Build (Optional)

```bash
npm run build
```

To preview the production build:

```bash
npm run preview
```

## How To Use (Student-Friendly)

### 1) 3D View

- Drag mouse: rotate camera
- Scroll: zoom in/out
- Right click + drag (depende sa controls): pan

### 2) Playback Controls (Bottom)

- Play/Pause: start/stop animation
- Reset: balik sa start ng cycle
- Speed buttons: bagalan/bilisan ang animation
- Progress bar: shows progress ng cycle

### 3) Input Parameters (Left Panel)

Pwede mong i-edit yung values habang tumatakbo ang demo:

- Binder Viscosity (cP)
- Binder Volume (mL)
- Fiber Mass (g)
- Molder Temperature (°C)
- Binder Tank Temperature (°C)
- Pressing Time (s)
- Mixing Time (s)

### 4) Supporting Process Data (Right Button + Panel)

- Click **Show Process Data** (top-right) para lumabas ang computed results.
- Click ulit para i-hide.

### 5) Part Info (Tooltip)

- Click a part sa 3D machine para lumabas yung name/info.
- Click outside para i-close.

## Paano “Nagwo-Work” ang A, B, C (Student Guide)

Sa demo na ito, may 3 layers:

1) **Inputs** (left panel) = values na ini-edit mo  
2) **B: Formulas** = math na nagko-compute ng results  
3) **A: Thresholds** at **C: Classification** = interpretation ng results

### B) Formula Table (Math Engine)

Ang goal ng B ay gumawa ng computed results gamit ang inputs. Sa app, nangyayari ito sa `processData` computation sa [App.tsx](file:///c:/Users/ADMIN/Desktop/animated/src/App.tsx).

Key idea: kapag mas malapot ang binder, mas mahirap dumaloy. Kapag mas maayos ang mixing (higher uniformity), mas maganda ang quality.

**Main computed variables (simplified):**

- **Effective Viscosity (μ)**  
  Adjusted viscosity based on binder tank temperature.
  - Higher tank temperature → lower μ (mas “numinipis”).

- **Uniformity (U)**  
  0–1 score (0 = uneven, 1 = very uniform). Derived from mixing time + viscosity + tank temperature.

- **F1: Binder Flow Rate (Q)**  
  Example structure:
  - `Q = Q0 / (1 + μ/k)`
  - Higher μ → lower Q.

- **F2: Mixing Time (calc)**  
  Example structure:
  - `t_mix = (V_binder / Q) * (1/U)`
  - Higher volume or lower Q → longer time.
  - Higher U → shorter time (more efficient mixing).

- **F4: Binder Absorption (A)**  
  Linear combination of U, temperature, and binder volume.

- **F5: Bonding Strength (B)**  
  Weighted score using stickiness (μ), absorption (A), temperature (T), pressing effect (P).

- **F6: Final Weight (Wf)**  
  `Wf = W_fiber + W_binder - W_water_loss`

- **F10: Defect Risk (D)**  
  Higher risk kapag low U, low bonding, high moisture, or off-target viscosity.

- **F11: Quality Score (Qs)**  
  Weighted score:
  `Qs = w1U + w2B + w3T + w4P`

### C) Result Classification Labels (based on Quality Score)

Ito yung “label” sa output base sa Quality Score:

- **DEFECTIVE**: `< 60%`
- **ACCEPTABLE**: `60% – 84%`
- **EXCELLENT / GOOD POT**: `>= 85%`

Makikita ito sa “Result” section sa Supporting Process Data panel.

### A) Parameter Threshold Table (Low / Recommended / High)

Ito yung per-parameter “status check” kung nasa tamang range ang parameter. Example logic:

- If value < recommended minimum → **LOW / PROBLEM**
- If value > recommended maximum → **HIGH / PROBLEM**
- Else → **RECOMMENDED**

Makikita ito sa “A. Parameter Thresholds” section sa Supporting Process Data panel.

## Worked Example (Step-by-step Computation)

Example default inputs:

- Binder Viscosity = **255 cP**
- Binder Volume = **15 mL**
- Fiber Mass = **500 g**
- Molder Temperature = **180 °C**
- Binder Tank Temperature = **60 °C**
- Pressing Time = **8 s**
- Mixing Time = **12 s**

1) **Compute μ (effective viscosity)**  
   - `viscosityTempFactor = 1 - (Ttank - 25)*0.006`  
   - `= 1 - (60-25)*0.006 = 0.79`  
   - `μ = 255 * 0.79 = 201.45 cP`  

2) **Compute U (uniformity)**  
   - `U = 0.35 + mixingTime/20 - μ/1200 + (Ttank - 25)*0.002`  
   - `= 0.35 + 12/20 - 201.45/1200 + 35*0.002`  
   - `≈ 0.85`  

3) **F1: Flow rate Q**  
   - `Q = 3.2 / (1 + μ/220)`  
   - `= 3.2 / (1 + 201.45/220)`  
   - `≈ 1.67 L/min`  

4) **F2: Mixing time (calc)**  
   - Convert binder volume to liters: `V = 15/1000 = 0.015 L`  
   - `t_mix = (V/Q) * 60 * (1/U)`  
   - `≈ (0.015/1.67) * 60 * (1/0.85)`  
   - `≈ 0.6 s`  

5) **F4: Absorption A (%)**  
   - `A = 5 + 35U + 0.18T + 0.06V(mL)`  
   - `≈ 5 + 35(0.85) + 0.18(180) + 0.06(15)`  
   - `≈ 68%`  

6) **F5: Bonding strength B (%)**  
   - Normalize:  
     - `P` from pressing time, `Tn` from temperature, `Sn=μ/350`, `An=A/100`  
   - Weighted score:
     - `B = 0.35Sn + 0.25An + 0.20Tn + 0.20P`  
   - Result example: `≈ 67%`

7) **F6: Final weight Wf (g)**  
   - `W_binder = V(mL) * 0.85 = 12.75 g`  
   - Compute moisture factor `Mf` then:
   - `Wf = W_fiber + W_binder - W_water_loss`  
   - Result example: `≈ 460.7 g`

8) **F10: Defect risk D (%)**  
   - `D = (1-U) + (1-B) + Mf + viscosity_error`  
   - Convert to percent (0–100).  
   - Result example: `≈ 25.7%`

9) **F11: Quality score Qs (%)**  
   - `Qs = 0.30U + 0.35B + 0.20T + 0.15P` (normalized)  
   - Result example: `≈ 76.6%`  

10) **C: Classification**  
   - 76.6% → **ACCEPTABLE**

11) **A: Threshold checks**  
   - Each parameter is compared against recommended ranges and labeled:
     - LOW / PROBLEM, RECOMMENDED, HIGH / PROBLEM

## 3D Model Files

Model files are inside:

- `public/models/molding-machine.fbx` (main model used by the app)
- `public/models/molding-machine.glb` (extra file, optional)

If you want to replace the model:

1) Put your FBX file into `public/models/`
2) Rename it to `molding-machine.fbx` (or update the path in the code)

## Troubleshooting

- **Blank/black screen**: wait a few seconds (FBX can be heavy). Check browser console for errors.
- **Model not showing**: confirm the file exists at `public/models/molding-machine.fbx`.
- **Install errors**: delete `node_modules` and run `npm install` again.
- **TypeScript errors**: run `npm run typecheck`.
