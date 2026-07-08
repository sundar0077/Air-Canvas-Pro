# ✋ AirCanvas Pro — Intelligent Air Paint Studio

> **Draw in thin air using hand gestures.** AirCanvas Pro is an AI-powered, real-time gesture drawing application that turns your webcam into a creative canvas. Powered by [MediaPipe Hand Landmarker](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker), it tracks your hands and translates finger movements into vibrant neon strokes — no stylus, no touch screen, just your hands.

---

## ✨ Features

### 🎨 Air Drawing
- **Index finger drawing** — Raise your index finger to draw glowing neon strokes on a full-screen canvas.
- **Auto shape recognition** — Automatically detects and snaps freehand drawings into clean **circles**, **rectangles**, and **straight lines**.
- **Color palette** — Switch colors via the on-screen color bar or use a left-hand gesture to randomize.
- **Erase all** — Open both palms (all 5 fingers on both hands) to clear the canvas.

### 🔮 Portal System & Mini-Games
Activate a **holographic portal** by holding both open palms together for 0.6 seconds. Inside the portal, select from three interactive experiences:

| Mode | Description |
|---|---|
| 🏹 **Archery** | Draw a virtual bow with both hands, aim and release arrows at a moving target. Score points for accuracy. |
| 🎾 **Tennis** | Deflect a glowing ball with your palm against an AI opponent. Rally score tracks your streak. |
| 🧊 **3D Rotate** | Explore wireframe 3D models (rock & chair) — rotate them in real-time by moving your hand. |

> **Portal controls:** Pinch to select a menu item · Double-flash open palm to go back · Double-flash again to close the portal.

### 🔐 Authentication
- Simple login system with demo credentials.
- Session-based auth protects artwork saving.

### 💾 Save Artwork
- Save your canvas creations as PNG files to the server via a Flask backend.
- Artworks are stored in `backend/saved_artworks/` with timestamped filenames.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Hand Tracking** | [MediaPipe Tasks Vision](https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14) (WASM + GPU) |
| **Frontend** | Vanilla HTML / CSS / JavaScript (ES Modules) |
| **Animations** | [GSAP 3.13](https://gsap.com/) for portal transitions & screen effects |
| **Typography** | [Inter](https://fonts.google.com/specimen/Inter) + [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) via Google Fonts |
| **Backend** | Python [Flask 3.0](https://flask.palletsprojects.com/) with Flask-CORS |
| **Design** | Dark cyberpunk aesthetic with neon HUD overlays, scanline animations, and glow effects |

---

## 📁 Project Structure

```
aircanvas pro/
├── index.html          # Main HTML — login page, landing page, and app canvas
├── style.css           # Cyberpunk-themed styles, login UI, HUD overlays
├── script.js           # Core drawing engine, hand tracking, shape recognition
├── effects.js          # Cinematic effects: portal system, mini-games, particles
├── backend/
│   ├── app.py          # Flask server — auth, static serving, artwork saving
│   ├── requirements.txt# Python dependencies (flask, flask-cors, pillow)
│   ├── run.bat         # One-click backend launcher (Windows)
│   ├── saved_artworks/ # Stored PNG artworks (auto-created)
│   └── venv/           # Python virtual environment (auto-created)
└── .vscode/            # VS Code workspace settings
```

---

## 🚀 Getting Started

### Prerequisites
- **Python 3.8+** installed and available in PATH
- A modern browser (Chrome / Edge recommended for best WebGL + camera support)
- A **webcam** connected to your device

### 1. Start the Backend

```bash
cd backend
run.bat
```

This will:
1. Create a Python virtual environment (if it doesn't exist)
2. Install dependencies (`flask`, `flask-cors`, `pillow`)
3. Start the Flask server on **http://localhost:5000**

> **Manual alternative:**
> ```bash
> cd backend
> python -m venv venv
> venv\Scripts\activate
> pip install -r requirements.txt
> python app.py
> ```

### 2. Open the App

Navigate to **http://localhost:5000** in your browser. The Flask server serves the frontend automatically.

### 3. Login

Use the demo credentials:

| Username | Password |
|---|---|
| `demo` | `1234` |
| `admin` | `admin123` |

### 4. Start Drawing!

Click **"START AIR DRAWING"**, grant camera permission, and begin painting in the air.

---

## 🎮 Gesture Guide

| Gesture | Action |
|---|---|
| ☝️ **Index finger up** (1 finger) | Draw on canvas |
| ✌️ **Index + middle up** (2 fingers, left hand) | Change color randomly |
| 🖐️ **All fingers up** (4 fingers) | Finish stroke (triggers shape recognition) |
| 🖐️🖐️ **Both palms open** (5+5 fingers) | Erase all strokes |
| 🤲 **Hold both open palms** (0.6s) | Open portal menu |
| 🤏 **Pinch** (inside portal) | Select menu option |
| 👋👋 **Double-flash open palm** | Exit current game / close portal |

---

## ⚙️ Configuration

### Camera Resolution
The app requests **1280×720** video by default. To change this, edit [script.js](script.js):
```javascript
const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 1280, height: 720 }
});
```

### Hand Detection Confidence
Adjust tracking sensitivity in [script.js](script.js):
```javascript
minHandDetectionConfidence: 0.7,
minHandPresenceConfidence: 0.7
```

### Stroke Width
Default stroke width is `14px`. Modify in the `processHand()` and `drawStroke()` functions.

---

## 🧠 How It Works

1. **Camera Feed** → The browser captures a live webcam stream via `getUserMedia`.
2. **Hand Landmark Detection** → MediaPipe's `HandLandmarker` runs in `VIDEO` mode, detecting up to 2 hands with 21 landmarks each, directly in the browser (WASM).
3. **Gesture Classification** → Finger tip positions relative to knuckle joints determine which fingers are raised, classifying gestures (draw, erase, color change, etc.).
4. **Shape Recognition** → When a stroke finishes, bounding box analysis and aspect ratio checks snap freehand curves into geometric shapes (circles, rectangles, lines).
5. **Portal & Games** → The `CinematicEffects` class manages a secondary rendering layer with particle pools, 3D wireframe projection, and physics-based mini-games — all clipped inside a circular portal.
6. **Backend Save** → Canvas data is exported as a base64 PNG and sent to the Flask server via `POST /save`, where it's decoded and stored to disk.

---

## 📝 API Endpoints

| Method | Route | Description |
|---|---|---|
| `GET` | `/` | Serve the frontend (`index.html`) |
| `GET` | `/<path>` | Serve static assets (CSS, JS, etc.) |
| `POST` | `/login` | Authenticate user (`{ username, password }`) |
| `GET` | `/logout` | Clear user session |
| `POST` | `/save` | Save artwork PNG (`{ image: "data:image/png;base64,..." }`) |

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m "Add amazing feature"`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is open source and available for personal and educational use.

---

<p align="center">
  <strong>AirCanvas Pro</strong> — Paint with nothing but your imagination ✨
</p>
