<div align="center">
   <h1>Accurate Point Measurement in 3DGS</h1>
   <h2>A New Alternative to Traditional Stereoscopic-View Based Measurements</h2>

   <p><strong>Deyan Deng¹, Rongjun Qin¹*</strong></p>

   <p>¹ The Ohio State University<br>* Corresponding author</p>

   <p>
      <a href="https://gdaosu.github.io/3dgs_measurement_tool/"><img src="https://img.shields.io/badge/Project-Page-2f80ed?style=flat-square" alt="Project Page"></a>
      <a href="https://huggingface.co/spaces/GDAOSU/3dgs_measurement_tool"><img src="https://img.shields.io/badge/%F0%9F%A4%97%20Hugging%20Face-Spaces-f7931a?style=flat-square" alt="Hugging Face Spaces"></a>
      <a href="https://arxiv.org/abs/2603.24716"><img src="https://img.shields.io/badge/arXiv-2603.24716-b31b1b?style=flat-square&logo=arxiv&logoColor=white" alt="arXiv"></a>
      <a href="./docs/ISPRS_Congress_2026_Full_paper_point_measurement_in_3DGS.pdf"><img src="https://img.shields.io/badge/Paper-PDF-4c8c2b?style=flat-square&logo=readthedocs&logoColor=white" alt="Paper PDF"></a>
   </p>

</div>

This repository contains the official implementation for the 3DGS point measurement tool.

## 🔗 Resources

We provide a comprehensive suite of resources for this project:

- **Project Page**: https://gdaosu.github.io/3dgs_measurement_tool/
- **Interactive Demo**: https://huggingface.co/spaces/GDAOSU/3dgs_measurement_tool
- **Paper**: https://arxiv.org/abs/2603.24716
- **PDF**: [ISPRS_Congress_2026_Full_paper_point_measurement_in_3DGS.pdf](./docs/ISPRS_Congress_2026_Full_paper_point_measurement_in_3DGS.pdf)

## 🎥 Demo

Watch the demonstration video:

<!--
  To get a working video link for your README:
  1. Compress your video to be under 10 MB.
  2. Drag & drop the compressed video file into a GitHub issue comment box to upload it.
  3. Copy the public asset URL that GitHub generates and paste it into the src attribute below.
-->
![3DGS Measurement Tool Demo](demos/3dgs_measurement_demo.gif)
## 🤗 Try Online

Try the interactive demo on HuggingFace Spaces: [3DGS Measurement Tool](https://huggingface.co/spaces/GDAOSU/3dgs_measurement_tool)

## ✨ Features

- **Interactive 3D Visualization**: Navigate and explore 3DGS models using Cesium
- **Point Measurement**: Measure 3D points via multi-ray triangulation for high accuracy, with uncertainty ellipsoids.
- **Geometry Creation**: Create polylines and polygons from measured points.
- **Standard Data Export**: Export points, polylines, and polygons to GeoJSON, KML, and CSV.


## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn package manager
- Modern web browser with WebGL support

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/GDAOSU/3dgs_measurement_tool.git
   cd 3dgs_measurement_tool
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - This step is **optional** for local development. The application works out-of-the-box.
   - To configure the application for deployment or to use the "Custom S3 Model" feature, create a `.env.local` file by copying the provided `.env.example`.
   - See `.env.example` for a list of available variables and their descriptions.

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### Building

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## 📋 Usage

1. **Load a 3DGS Model**: Upload or select a 3D Gaussian Splatting model
2. **Create Measurement Points**: Click multiple times in the 3D scene to cast rays and compute an intersection point. The tool will visualize the rays and the resulting 3D point with its uncertainty ellipsoid.
3. **Create Geometries**: Use the created points to define polylines and polygons.
4. **Export Results**: Download measurement data in supported formats

## 🏗️ Project Structure

```
├── src/
│   ├── components/           # React components
│   │   ├── CesiumViewer.jsx         # 3D visualization component
│   │   ├── GeometryCreatorPanel.jsx # Geometry creation tools
│   │   └── MeasurePanel.jsx         # Measurement interface
│   ├── pages/                # Application pages
│   │   └── Home.jsx                # Main application page
│   ├── utils/                # Utility functions
│   │   └── awsConfig.js            # AWS S3 configuration
│   ├── App.jsx               # Main application component
│   └── main.jsx              # Application entry point
├── index.html               # HTML template
├── vite.config.js           # Vite configuration
└── package.json             # Project dependencies
```

## 📦 Dependencies

Core dependencies include:
- `react` - UI framework
- `cesium` & `resium` - 3D visualization
- `@mui/material` - Component library
- `react-router-dom` - Routing

See `package.json` for complete dependency list and versions.


## 📝 Citation

If you use this tool or the methodology in your research, please cite our paper:

```bibtex
@misc{deng2026accurate,
      title={Accurate Point Measurement in 3DGS -- A New Alternative to Traditional Stereoscopic-View Based Measurements}, 
      author={Deyan Deng and Rongjun Qin},
      year={2026},
      eprint={2603.24716},
      archivePrefix={arXiv},
      primaryClass={cs.CV}
}
```

