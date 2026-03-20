# 3DGS Point Measurement Tool

**Accurate Point Measurement in 3DGS - A New Alternative to Traditional Stereoscopic-View Based Measurements**

A web-based interactive tool for precise point measurement in 3D Gaussian Splatting (3DGS) scenes. This project implements the methodology presented in the research paper and provides an intuitive interface for users to perform accurate measurements directly on 3DGS models.

## 📄 Paper

**"Accurate Point Measurement in 3DGS - A New Alternative to Traditional Stereoscopic-View Based Measurements"**

- **Publication**: ISPRS 2026
- **arXiv**: [Link to arXiv](#) *(Update with your arXiv link)*
- **Preprint**: Available in the `docs` folder.

## 🎥 Demo

Watch the demonstration video:

<video width="100%" controls>
  <!-- Update 'yourusername' and 'main' (if your branch is different) to match your repository -->
  <source src="https://raw.githubusercontent.com/GDAOSU/3dgs_measurement_tool/main/demos/3dgs_measurement_tool_demo_30s.mp4" type="video/mp4">
  Your browser does not support the video tag.
</video>

## 🤗 Try Online

Try the interactive demo on HuggingFace Spaces: [3DGS Measurement Tool](https://huggingface.co/spaces/GDAOSU/3dgs_measurement_tool) *(Update with your HuggingFace Space link)*

## ✨ Features

- **Interactive 3D Visualization**: Navigate and explore 3DGS models using Cesium
- **Point Measurement**: Measure 3D points via multi-ray intersection for high accuracy.
- **Geometry Creation**: Create polylines and polygons from measured points.
- **Real-time Interaction**: Instant visualization of measurements with interactive controls
- **Multi-view Support**: Stereoscopic-view alternative measurement approach
- **Data Export**: Export points, polylines, and polygons to GeoJSON, KML, and CSV.
- **Client-Side Processing**: All core measurement logic runs in the browser. No server required for measurement features.
- **Responsive Design**: Works on desktop and tablets

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

## 🛠️ Technology Stack

- **Frontend Framework**: React 19 with Vite
- **3D Visualization**: Cesium & Resium
- **UI Library**: Material-UI (MUI)
- **Routing**: React Router
- **Drag & Drop**: dnd-kit
- **Cloud Storage**: AWS S3
- **Styling**: Emotion

## 📦 Dependencies

Core dependencies include:
- `react` - UI framework
- `cesium` & `resium` - 3D visualization
- `@mui/material` - Component library
- `react-router-dom` - Routing

See `package.json` for complete dependency list and versions.

## 🔧 Configuration

### Cesium Setup

Configure Cesium viewer in [cesiumSetup.js](src/cesiumSetup.js)

### AWS S3 Integration

Configure AWS credentials in [awsConfig.js](src/utils/awsConfig.js)

### API Configuration

Update API endpoints in [apiConfig.js](src/utils/apiConfig.js)

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📊 Results & Validation

This tool provides comparable or superior accuracy compared to traditional stereoscopic-view based measurement methods. See the paper for detailed validation results and benchmarks.

## 🐛 Issues & Support

For issues, questions, or suggestions, please:
- Open an issue on GitHub
- Check existing issues for solutions
- Provide detailed information about your setup and the problem

## 📝 Citation

If you use this tool or the methodology in your research, please cite our paper:

```bibtex
@article{your_citation_2026,
  title={Accurate Point Measurement in 3DGS - A New Alternative to Traditional Stereoscopic-View Based Measurements},
  author={Your Name(s)},
  journal={ISPRS},
  year={2026},
  note={arXiv preprint arXiv:XXXX.XXXXX}
}
```

## 📄 License

This project is licensed under the [LICENSE TYPE] - see the LICENSE file for details.

## 🙏 Acknowledgments

- ISPRS 2026 conference for publication opportunity
- Cesium for 3D visualization technology
- Material-UI for comprehensive component library
- All contributors and testers

## 📧 Contact

For questions or inquiries about this work, please contact:
- **Author(s)**: [Your Name]
- **Email**: [Your Email]
- **Institution**: [Your Institution]

---

**Last Updated**: March 2026
