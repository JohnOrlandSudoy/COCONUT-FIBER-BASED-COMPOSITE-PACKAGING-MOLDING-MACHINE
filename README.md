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
- Molder Temperature (°C)
- Pressing Time (s)
- Mixing Time (s)

### 4) Supporting Process Data (Right Button + Panel)

- Click **Show Process Data** (top-right) para lumabas ang computed results.
- Click ulit para i-hide.

### 5) Part Info (Tooltip)

- Click a part sa 3D machine para lumabas yung name/info.
- Click outside para i-close.

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
