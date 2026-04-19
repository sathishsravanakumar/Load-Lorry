# Load Lorry — Fleet Operations & Intelligence Dashboard

Load Lorry is a high-fidelity, real-time fleet management platform designed to unify dispatching, diagnostics, and billing into a single, cohesive "Glassmorphism" interface. Built for modern logistics teams, it leverages AI-driven spatial reasoning and 3D digital twinning to optimize fleet efficiency.

## 🚀 Key Modules

### 1. Smart Dispatch & AI Matching
- **Predictive Routing:** AI-scored load assignments calculated based on 48hr predictive routing and return-load probability.
- **Driver Decision Intelligence:** Compare multiple candidates based on performance scores, proximity, and HOS status.
- **HOS Relay Logic:** Automated detection of Hours of Service (HOS) insufficiencies with smart recommendations for relay points.
- **Alternative Recovery:** Instant search for alternative drivers when a primary unit is blocked due to maintenance.

### 2. 3D Digital Twin Diagnostics
- **Parametric Reconstruction:** A fully interactive 3D truck model (Three.js) that visualizes the physical state of the fleet.
- **Localized Fault Highlighting:** Individual components (Engine, Rear Tires, Brakes) glow and pulse in real-time based on diagnostic severity (Red/Critical, Yellow/Warning).
- **Telemetry Stream:** Live monitoring of PSI, Brake Pad life, Fuel levels, and HOS.

### 3. Live Alert Feed & Tactical Mapping
- **Actionable Alerts:** Critical fleet issues (HOS expirations, mechanical failures) surfaced with immediate AI-recommended actions.
- **OSM Integration:** Real-time OpenStreetMap (OSM) tracking via Leaflet, visualizing the spatial relationship between units during relay operations.
- **Tactical Overlays:** Cinematic map overlays showing intercept paths and ETA metrics for inter-unit handoffs.

### 4. Billing Pipeline (OCR Workflow)
- **Document Intelligence:** Continuous OCR scanning cycle for Bills of Lading (BOL), Proof of Delivery (POD), and Fuel Receipts.
- **Terminal Simulation:** Visual "AI Extraction" terminal showing real-time data harvesting from scanned documents.
- **Historical Ledger:** Dynamic billing history tracking with margin analysis and payment status.

---

## 🏗 Architecture & Stack

### Frontend & Core
- **React 19 / Vite:** High-performance rendering and hot-module replacement.
- **State Management:** Centralized React state architecture managing multi-step workflows (OCR cycles, fleet diagnostics, and load queues).

### Visualization & Maps
- **3D Engine:** `@react-three/fiber` and `@react-three/drei` (Three.js) for hardware-accelerated digital twin rendering.
- **Mapping:** `react-leaflet` (Leaflet) using OpenStreetMap (OSM) and CartoDB Dark-Matter tiles for real-time geospatial data.
- **Post-Processing:** Bloom and ambient occlusion for the "premium" dashboard aesthetic.

### Design System
- **Glassmorphism UI:** A custom CSS variables-driven design system using backdrop filters, frosted glass effects, and a sophisticated `#39abd4` (Cyan) and `#d0dde7` (Ice) color palette.
- **Icons:** `lucide-react` for consistent, crisp iconography.

---

## 🛠 Getting Started

### Prerequisites
- Node.js (v18+)
- npm

### Installation
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

### Project Structure
- `src/App.jsx`: Centralized logic for all dashboard modules and state management.
- `src/index.css`: Root design system and global styles.
- `src/assets/`: High-fidelity tactical assets and background imagery.

---

## 🛡 License
Internal Hackathon Project — For Demonstration Purposes only.
