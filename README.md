# Tiger 5 stats

A minimalist, responsive, and offline-first mobile web application designed to track the "Tiger 5" golf errors with zero friction during a round. 

This app features a tropical-golf theme ("Palm & Sage") and a custom palm-flag logo.

---

## ⛳ The Concept: Tiger 5

The underlying thesis of this tracker is that a great round of golf isn't about hitting 18 perfect pars; it is about avoiding the **five specific errors** that leak strokes:

1. **Double Bogey+** — Any hole played at +2 or worse.
2. **Bogey on Par 5** — Failing to secure par or better on the easiest scoring holes.
3. **Three Putt** — Taking three or more putts on a green.
4. **Wedge Miss** — Missing the green on an approach shot from wedge distance.
5. **Chipped Twice+** — Requiring two or more chips/pitches around the same green.

**The goal is simple: achieve zero Tiger 5 events.**

---

## 📱 iPhone Installation & Setup

Because this is a Progressive Web App (PWA), it can behave like a native iOS application—complete with an icon on your home screen, fullscreen view (no Safari address bar), and full offline capability.

### How to Install it on your iPhone:
1. Make sure your iPhone is connected to the same Wi-Fi network as your computer, or host the files on a public HTTPS server (like GitHub Pages).
2. Find your computer's local IP address (e.g., `192.168.1.XX`).
3. On your iPhone, open **Safari** and navigate to `http://192.168.1.XX:8000`.
4. Tap the **Share** button (the square with an arrow pointing up) at the bottom of Safari.
5. Scroll down the sharing menu and select **Add to Home Screen**.
6. Name it **Tiger 5** and tap **Add**.
7. Launch the app from your home screen!

---

## 💻 Running the App Locally

To start a local server on your computer, open your terminal and run:

```bash
# Navigate to the project folder
cd /Users/stefanpalm/experiements/tiger5stats

# Start a local Python web server
python3 -m http.server 8000
```

Now, navigate to [http://localhost:8000](http://localhost:8000) in your desktop browser.

---

## 🛠️ Key Features

* **High-Contrast Themes:** Features a Forrest Dark mode and a Sunlight-Optimized Light mode designed for visibility in direct sunlight. Toggle it inside **Settings**.
* **Zero-Friction Logging:** Big, glove-friendly buttons (minimum 56px touch targets). Tap through holes in under 5 seconds.
* **Context-Aware Toggles:** The "Bogey on Par 5" toggle automatically disables on Par 3 and Par 4 holes to prevent invalid data entry.
* **Resume In-Progress Rounds:** If you close the app mid-round, it will offer to restore your progress on next launch.
* **Interactive Charts:** Hand-crafted, lightweight SVG charts show your Tiger 5 Index trend over time and rank your most frequent leaks.
* **100% Offline & Safe:** All data stays on your device (`localStorage`). Save your history to spreadsheets or backup files using the **JSON / CSV Export** tools in Settings.

---

## 📁 File Structure

```
tiger5stats/
├── README.md          # Project documentation (this file)
├── index.html         # Main SPA layout
├── style.css          # Design system & theme styles
├── app.js             # State controller & stats math
├── manifest.json      # PWA metadata
├── sw.js              # Service Worker for offline capability
└── icons/             # App icons
    ├── logo.svg       # Palm-flag logo
    ├── icon-192.png   # 192px app launcher icon
    └── icon-512.png   # 512px app launcher icon
```
