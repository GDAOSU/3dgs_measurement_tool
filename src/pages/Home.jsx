import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import CesiumViewer from "../components/CesiumViewer";
import MeasurePanel from "../components/MeasurePanel";
import GeometryCreatorPanel from "../components/GeometryCreatorPanel";
import * as Cesium from "cesium";
import { getDefaultBucket, getAwsRegion } from "../utils/awsConfig";
import {
  Button
} from "@mui/material";


// Base models for demonstration.
// Base models are hosted locally within the repository's `public/models` directory.
const BASE_MODELS = [
  {
    id: "White Sculpture",
    name: "White Sculpture (Local)",
    tilesetUrls: ["/models/white/tileset.json"], // Local path(s)
    offsetHeight: -130,
  },
];

function buildS3Key(model) {
  const tilesetPath = (model.tileset || "tileset.json").replace(/^\/+/, "");
  const prefix = (model.prefix || "").replace(/\/+$/, "");
  const s3Key = prefix ? `${prefix}/${tilesetPath}` : tilesetPath;
  return s3Key;
}

function downloadFile(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
}

function parseCsvPointRows(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const lonIndex = headers.indexOf("lon");
  const latIndex = headers.indexOf("lat");
  const altIndex = headers.indexOf("alt");
  const accuracyIndex = headers.indexOf("accuracy");

  if (lonIndex === -1 || latIndex === -1 || altIndex === -1) {
    throw new Error("CSV must include lon, lat, and alt columns.");
  }

  const points = [];
  for (let i = 1; i < lines.length; i += 1) {
    const columns = lines[i].split(",").map((c) => c.trim());
    const lon = Number(columns[lonIndex]);
    const lat = Number(columns[latIndex]);
    const alt = Number(columns[altIndex]);
    const accuracyRaw = accuracyIndex >= 0 ? Number(columns[accuracyIndex]) : 1;
    const accuracy = Number.isFinite(accuracyRaw) && accuracyRaw > 0 ? accuracyRaw : 1;

    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(alt)) {
      continue;
    }

    points.push({ lon, lat, alt, accuracy });
  }

  return points;
}

function parseGeoJsonPointRows(text) {
  const data = JSON.parse(text);
  if (data?.type !== "FeatureCollection" || !Array.isArray(data.features)) {
    throw new Error("GeoJSON must be a FeatureCollection.");
  }

  const points = [];
  data.features.forEach((feature) => {
    const geometry = feature?.geometry;
    if (!geometry || geometry.type !== "Point" || !Array.isArray(geometry.coordinates)) {
      return;
    }

    const lon = Number(geometry.coordinates[0]);
    const lat = Number(geometry.coordinates[1]);
    const alt = Number(geometry.coordinates[2] ?? 0);
    const accuracyRaw = Number(feature?.properties?.accuracy);
    const accuracy = Number.isFinite(accuracyRaw) && accuracyRaw > 0 ? accuracyRaw : 1;

    if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(alt)) {
      return;
    }

    points.push({ lon, lat, alt, accuracy });
  });

  return points;
}

function toPointEntity(rawPoint) {
  const ecef = Cesium.Cartesian3.fromDegrees(rawPoint.lon, rawPoint.lat, rawPoint.alt);
  const variance = rawPoint.accuracy * rawPoint.accuracy;

  return {
    x: ecef.x,
    y: ecef.y,
    z: ecef.z,
    lon: rawPoint.lon,
    lat: rawPoint.lat,
    alt: rawPoint.alt,
    accuracy: rawPoint.accuracy,
    covariance: [
      [variance, 0, 0],
      [0, variance, 0],
      [0, 0, variance],
    ],
    measures: [],
  };
}

export default function Home() {
  const [customModel, setCustomModel] = useState({
    bucket: getDefaultBucket() || "",
    region: getAwsRegion() || "",
    prefix: "data/3dtiles",
    tileset: "custom/tileset.json",
    offsetHeight: 0,
  });
  const [urlModel, setUrlModel] = useState({
    tilesetUrl: "",
    offsetHeight: 0,
  });
  
  // --- New state for client-side drawing ---
  const [drawingState, setDrawingState] = useState({ mode: 'none', points: [] }); // mode: 'none', 'polyline', 'polygon'
  const [polylines, setPolylines] = useState([]);
  const [polygons, setPolygons] = useState([]);
  const [selectedGeometry, setSelectedGeometry] = useState(null); // { type: 'polyline' | 'polygon', id: string | number }
  const geometryIdCounter = useRef(0);
  
  // --- State for the Geometry Creator Panel ---
  const [previewPointId, setPreviewPointId] = useState(0);
  const [multiSelectPoints, setMultiSelectPoints] = useState([]);
  const models = useMemo(
    () => [
      ...BASE_MODELS,
      {
        id: "custom",
        name: "Custom S3 Model",
      },
      {
        id: "url",
        name: "URL Model",
      },
    ],
    []
  );

  const [selectedModelId, setSelectedModelId] = useState(models[0].id);
  const selectedModel = useMemo(() => {
    if (selectedModelId === "custom") {
      return { id: "custom", name: "Custom S3 Model", ...customModel };
    }
    if (selectedModelId === "url") {
      return { id: "url", name: "URL Model", ...urlModel };
    }
    return (
      BASE_MODELS.find((model) => model.id === selectedModelId) ||
      BASE_MODELS[0]
    );
  }, [selectedModelId, customModel, urlModel]);

  const [offsetHeight, setOffsetHeight] = useState(
    selectedModel.offsetHeight ?? 0
  );

  // Use direct unsigned S3 URL (bucket is publicly readable)
  const [tilesetUrls, setTilesetUrls] = useState([]);

  useEffect(() => {
    if (selectedModel.id === "url") {
      const primaryUrl = urlModel.tilesetUrl || "";
      const extendedUrl = urlModel.extendedTilesetUrl || "";
      setTilesetUrls([primaryUrl, extendedUrl].filter(Boolean));
    } else if (selectedModel.id === "custom") {
      if (selectedModel.bucket && selectedModel.region) {
        const s3Key = buildS3Key(selectedModel);
        const directUrl = `https://${selectedModel.bucket}.s3.${selectedModel.region}.amazonaws.com/${s3Key}`;
        setTilesetUrls([directUrl]);
      } else {
        setTilesetUrls([]);
        // Only warn if user actively selected it to avoid noise on startup
        if (selectedModelId === 'custom') {
            console.warn("Custom S3 model selected, but Bucket and Region are not configured in the dialog or .env.local");
        }
      }
    } else { // It's a base model from the hardcoded list
      const modelUrls = (selectedModel.tilesetUrls || []).filter(Boolean);
      setTilesetUrls(modelUrls);
    }
  }, [selectedModel, selectedModelId, urlModel.tilesetUrl, urlModel.extendedTilesetUrl]);

  const [points, setPoints] = useState([]);
  const [isMeasuring, setIsMeasuring] = useState(false);
  const cesiumRef = useRef(null);
  const maxPointId = useRef(0);
  const [selectedPoint, setSelectedPoint] = useState(0);
  const [pointAppearance, setPointAppearance] = useState("ellipsoid"); // 'ellipsoid' or 'point'
  const [ellipsoidScale, setEllipsoidScale] = useState(1.0);

  const handleAddPoint = useCallback((point) => {
    maxPointId.current += 1;
    console.log("New 3D point added:", point);
    setPoints((prev) => [...prev, { ...point, id: maxPointId.current }]);
  }, []);

  const handleMeasureClick = () => {
    if (!cesiumRef.current) return;
    if (isMeasuring) {
      cesiumRef.current.endMeasure();
      setIsMeasuring(false);
    } else {
      cesiumRef.current.setMode("measure");
      setIsMeasuring(true);
    }
  };
  const handleSelectPoint = (point) => {
    if (!cesiumRef.current) return;
    setSelectedPoint(point.id);
    console.log("Selected point for inspection:", point);
  };
  const handleDeletePoint = () => {
    if (!cesiumRef.current) return;
    if (selectedPoint === 0) return;
    setPoints((prev) => prev.filter((pt) => pt.id !== selectedPoint));
    setSelectedPoint(0);
  };

  const handlePointAppearanceChange = (newAppearance) => {
    setPointAppearance(newAppearance);
  };

  const handleIncreaseEllipsoidScale = () => {
    setEllipsoidScale((prev) => Math.min(prev + 0.1, 5.0));
  };

  const handleDecreaseEllipsoidScale = () => {
    setEllipsoidScale((prev) => Math.max(prev - 0.1, 0.1));
  };

  const handleImportPoints = async (file) => {
    try {
      const fileText = await file.text();
      const lowerName = file.name.toLowerCase();

      let parsedPoints = [];
      if (lowerName.endsWith(".csv")) {
        parsedPoints = parseCsvPointRows(fileText);
      } else if (lowerName.endsWith(".geojson") || lowerName.endsWith(".json")) {
        parsedPoints = parseGeoJsonPointRows(fileText);
      } else {
        throw new Error("Unsupported file type. Use .csv or .geojson.");
      }

      if (parsedPoints.length === 0) {
        alert("No valid point rows found in the selected file.");
        return;
      }

      const convertedPoints = parsedPoints.map(toPointEntity);
      setPoints((prev) => {
        const next = [...prev];
        convertedPoints.forEach((point) => {
          maxPointId.current += 1;
          next.push({ ...point, id: maxPointId.current });
        });
        return next;
      });

      alert(`Imported ${convertedPoints.length} point(s) from ${file.name}.`);
    } catch (error) {
      console.error("Failed to import points:", error);
      alert(error?.message || "Failed to import points.");
    }
  };

  // --- New Geometry Handlers ---

  const handleStartDrawing = (mode) => {
    if (drawingState.mode !== 'none' || isMeasuring) {
      alert("Please finish your current measurement or drawing first.");
      return;
    }
    setDrawingState({ mode, points: [] });
    setSelectedPoint(0); // Deselect any points
    setSelectedGeometry(null); // Deselect any geometry
    setMultiSelectPoints([]); // Reset multi-select
  };

  const handleCancelDrawing = () => {
    setDrawingState({ mode: 'none', points: [] });
    setMultiSelectPoints([]);
    setPreviewPointId(0);
  };

  const handleFinishDrawing = () => {
    const { mode, points: geometryPoints } = drawingState;
    if (mode === 'none') {
      handleCancelDrawing();
      return;
    }

    geometryIdCounter.current += 1;
    const newId = `${mode}-${geometryIdCounter.current}`;

    if (mode === 'polyline') {
      if (geometryPoints.length < 2) {
        alert("A polyline requires at least 2 points.");
        return;
      }
      const newPolyline = { id: newId, points: geometryPoints };
      setPolylines(prev => [...prev, newPolyline]);
    } else if (mode === 'polygon') {
      if (geometryPoints.length < 3) {
        alert("A polygon requires at least 3 points.");
        return;
      }
      const newPolygon = { id: newId, points: geometryPoints };
      setPolygons(prev => [...prev, newPolygon]);
    }

    handleCancelDrawing();
  };

  const handlePointSelectForGeometry = useCallback((point) => {
    // Since we only select existing points, they will always have an ID.
    setDrawingState(prev => {
      const isAlreadyAdded = prev.points.some(p => p.id === point.id);
      if (isAlreadyAdded) {
        // Remove the point if it's already in the list
        return { ...prev, points: prev.points.filter(p => p.id !== point.id) };
      } else {
        // Add the point
        return { ...prev, points: [...prev.points, point] };
      }
    });
  }, []);

  const handleAvailablePointClick = (event, pointId) => {
    const isCtrlOrMeta = event.ctrlKey || event.metaKey;

    setMultiSelectPoints(prev => {
        if (isCtrlOrMeta) {
            if (prev.includes(pointId)) {
                return prev.filter(id => id !== pointId);
            } else {
                return [...prev, pointId];
            }
        } else {
            if (prev.length === 1 && prev[0] === pointId) {
                return [];
            } else {
                return [pointId];
            }
        }
    });
  };

  const handleAddMultiSelectedPoints = () => {
      const pointsToAdd = points.filter(p => multiSelectPoints.includes(p.id));
      setDrawingState(prev => {
        const newPoints = pointsToAdd.filter(p => !prev.points.some(dp => dp.id === p.id));
        return { ...prev, points: [...prev.points, ...newPoints] };
      });
      setMultiSelectPoints([]); // Clear selection after adding
  };

  const handleClearGeometryPoints = () => {
    setDrawingState(prev => ({ ...prev, points: [] }));
  };

  const handleReorderGeometryPoints = (oldIndex, newIndex) => {
    setDrawingState(prev => {
      const items = Array.from(prev.points);
      const [reorderedItem] = items.splice(oldIndex, 1);
      items.splice(newIndex, 0, reorderedItem);
      return { ...prev, points: items };
    });
  };

  const handleSelectGeometry = (type, id) => {
    const newSelection = selectedGeometry?.id === id && selectedGeometry?.type === type ? null : { type, id };
    setSelectedGeometry(newSelection);
    setSelectedPoint(0); // Deselect any points
  };

  const handleDeleteGeometry = () => {
    if (!selectedGeometry) return;
    const { type, id } = selectedGeometry;

    if (type === 'polyline') {
      setPolylines(prev => prev.filter(p => p.id !== id));
    } else if (type === 'polygon') {
      setPolygons(prev => prev.filter(p => p.id !== id));
    }
    setSelectedGeometry(null);
  };

  const handleExportGeometries = (type, format) => {
    let geometries;
    const fileName = `measurements_${type}`;

    if (type === 'point') {
      geometries = points;
    } else {
      geometries = type === 'polyline' ? polylines : polygons;
    }

    if (geometries.length === 0) {
      alert(`No ${type}s to export.`);
      return;
    }

    // --- GeoJSON is the common base for some formats ---
    const geojson = type === 'point'
      ? {
          type: 'FeatureCollection',
          features: geometries.map(p => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lon, p.lat, p.alt] },
            properties: { id: p.id, accuracy: p.accuracy }
          }))
        }
      : { // polyline or polygon
          type: 'FeatureCollection',
          features: geometries.map(geom => ({
            type: 'Feature',
            geometry: {
              type: type === 'polyline' ? 'LineString' : 'Polygon',
              coordinates: type === 'polygon'
                ? [[...geom.points.map(p => [p.lon, p.lat, p.alt]), [geom.points[0].lon, geom.points[0].lat, geom.points[0].alt]]]
                : geom.points.map(p => [p.lon, p.lat, p.alt]),
            },
            properties: { id: geom.id }
          }))
        };

    // --- Format-specific logic ---
    if (format === 'geojson') {
      const dataStr = JSON.stringify(geojson, null, 2);
      downloadFile(dataStr, `${fileName}.geojson`, 'application/json');
    } else if (format === 'csv') {
      let csvContent = '';
      if (type === 'point') {
        csvContent = 'id,lon,lat,alt,accuracy\n';
        geometries.forEach(p => {
          csvContent += `${p.id},${p.lon},${p.lat},${p.alt},${p.accuracy}\n`;
        });
      } else { // polyline or polygon
        csvContent = 'geometry_id,point_order,lon,lat,alt\n';
        geometries.forEach(geom => {
          geom.points.forEach((p, index) => {
            csvContent += `${geom.id},${index + 1},${p.lon},${p.lat},${p.alt}\n`;
          });
        });
      }
      downloadFile(csvContent, `${fileName}.csv`, 'text/csv;charset=utf-8;');
    } else if (format === 'kml') {
      const placemarks = geometries.map(geom => {
        const name = type === 'point' ? `Point ${geom.id}` : geom.id;
        const points = type === 'point' ? [geom] : geom.points;
        const coords = points.map(p => `${p.lon},${p.lat},${p.alt}`).join(' ');
        let geometryString;
        if (type === 'point') geometryString = `<Point><coordinates>${coords}</coordinates></Point>`;
        else if (type === 'polyline') geometryString = `<LineString><coordinates>${coords}</coordinates></LineString>`;
        else if (type === 'polygon') geometryString = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${coords} ${points[0].lon},${points[0].lat},${points[0].alt}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
        return `<Placemark><name>${name}</name>${geometryString || ''}</Placemark>`;
      }).join('\n    ');

      const kmlContent = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Document>\n    <name>${fileName}</name>\n    ${placemarks}\n  </Document>\n</kml>`;
      downloadFile(kmlContent, `${fileName}.kml`, 'application/vnd.google-earth.kml+xml');
    }
  };

  const handleModelChange = (modelId) => {
    // In a purely client-side app, changing model just updates the selection.
    setSelectedModelId(modelId);
  };

  const handleCustomModelSave = (model) => {
    const nextOffset = Number(model.offsetHeight);
    const normalizedModel = {
      ...model,
      offsetHeight: Number.isNaN(nextOffset) ? 0 : nextOffset,
    };
    setCustomModel(normalizedModel);
    setSelectedModelId("custom");
  };

  const handleUrlModelSave = (model) => {
    const nextOffset = Number(model.offsetHeight);
    const normalizedModel = {
      ...model,
      offsetHeight: Number.isNaN(nextOffset) ? 0 : nextOffset,
    };
    setUrlModel(normalizedModel);
    setSelectedModelId("url");
  };

  const handleOffsetHeightChange = (value) => {
    // Allow updating the UI state with raw value (e.g. "-" or empty string)
    setOffsetHeight(value);

    const nextValue = Number(value);
    if (!Number.isNaN(nextValue)) {
      if (selectedModelId === "custom") {
        setCustomModel((prev) => ({ ...prev, offsetHeight: nextValue }));
      }
      if (selectedModelId === "url") {
        setUrlModel((prev) => ({ ...prev, offsetHeight: nextValue }));
      }
    }
  };

  useEffect(() => {
    setOffsetHeight(selectedModel.offsetHeight ?? 0);
  }, [selectedModelId, selectedModel.offsetHeight]);

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      {/* Cesium Viewer */}
      <CesiumViewer
        ref={cesiumRef}
        tilesetUrls={tilesetUrls}
        points={points}
        onAddPoint={handleAddPoint}
        offsetHeight={offsetHeight}
        selectedPoint={selectedPoint}
        pointAppearance={pointAppearance}
        ellipsoidScale={ellipsoidScale}
        // New props for drawing
        drawingState={drawingState}
        polylines={polylines}
        polygons={polygons}
        onPointSelectForDrawing={handlePointSelectForGeometry}
        selectedGeometry={selectedGeometry}
        previewPointId={previewPointId}
      />

      {/* MUI Overlay */}
      <MeasurePanel
        points={points}
        measuring={isMeasuring}
        offsetHeight={offsetHeight}
        models={models}
        selectedModelId={selectedModelId}
        customModel={customModel}
        urlModel={urlModel}
        onModelChange={handleModelChange}
        onSaveCustomModel={handleCustomModelSave}
        onSaveUrlModel={handleUrlModelSave}
        onOffsetHeightChange={handleOffsetHeightChange}
        onToggleMeasure={handleMeasureClick}
        onSelectPoint={handleSelectPoint}
        onDeletePoint={handleDeletePoint}
        pointAppearance={pointAppearance}
        onPointAppearanceChange={handlePointAppearanceChange}
        ellipsoidScale={ellipsoidScale}
        onIncreaseEllipsoidScale={handleIncreaseEllipsoidScale}
        onDecreaseEllipsoidScale={handleDecreaseEllipsoidScale}
        // New props for geometry
        polylines={polylines}
        polygons={polygons}
        drawingState={drawingState}
        selectedGeometry={selectedGeometry}
        onStartDrawing={handleStartDrawing}
        onFinishDrawing={handleFinishDrawing}
        onCancelDrawing={handleCancelDrawing}
        onSelectGeometry={handleSelectGeometry}
        onDeleteGeometry={handleDeleteGeometry}
        onExportGeometries={handleExportGeometries}
        onImportPoints={handleImportPoints}
      />

      <GeometryCreatorPanel
        isOpen={drawingState.mode !== 'none'}
        drawingState={drawingState}
        onCancel={handleCancelDrawing}
        onFinish={handleFinishDrawing}
        onPointSelect={handlePointSelectForGeometry}
        onPreviewPoint={setPreviewPointId}
        // Props for available points list
        availablePoints={points}
        multiSelectPoints={multiSelectPoints}
        onAvailablePointClick={handleAvailablePointClick}
        onAddMultiSelectedPoints={handleAddMultiSelectedPoints}
        onClearPoints={handleClearGeometryPoints}
        onReorderPoints={handleReorderGeometryPoints}
      />

    </div>
  );
}
