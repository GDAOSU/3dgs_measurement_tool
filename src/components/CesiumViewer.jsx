import React, {
  useRef,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
  useMemo,
} from "react";
import { Viewer, Entity, PolylineGraphics, PolygonGraphics } from "resium";
import * as Cesium from "cesium";
import { Cartesian3, Color, Matrix3, Quaternion, PolygonHierarchy } from "cesium";

// Cesium Ion token is safe to embed in client code (not a secret)
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxNDM0OThmMS01NjBmLTQzNTYtYjQ0MC0yMWY0ZGExZjk0ZjEiLCJpZCI6MjM2MjE1LCJpYXQiOjE3MjQyNzQ4MjB9.6XHQrKm0KGDFRZSg5veN64KaxYT3ekGj2qprsbEiI7k";

// Define the scratch object ONCE for the eigendecomposition to avoid re-allocation
const scratchEigen = {
  diagonal: new Matrix3(),
  unitary: new Matrix3(),
};

function offsetTilesetHeight(tileset, offsetMeters) {
  const offset = Number(offsetMeters) || 0;
  if (offset === 0) return;

  const boundingSphere = tileset.boundingSphere;
  const center = boundingSphere.center;

  // Get normalized up direction in ECEF
  const up = Cesium.Cartesian3.normalize(center, new Cesium.Cartesian3());

  // Compute translation vector = up * offset
  const translation = Cesium.Cartesian3.multiplyByScalar(
    up,
    offset,
    new Cesium.Cartesian3(),
  );
  // Build translation matrix in ECEF
  const translationMatrix = Cesium.Matrix4.fromTranslation(translation);
  // Apply to existing transform
  const finalMatrix = Cesium.Matrix4.multiplyTransformation(
    translationMatrix,
    tileset.modelMatrix,
    new Cesium.Matrix4(),
  );
  tileset.modelMatrix = finalMatrix;
}

function undoTilesetTransformXYZ(x, y, z, tileset) {
  const ecefPoint = new Cesium.Cartesian3(x, y, z);

  // Compute inverse of current modelMatrix
  const inverseMatrix = Cesium.Matrix4.inverse(
    tileset.modelMatrix,
    new Cesium.Matrix4()
  );

  // Transform point back
  const originalPoint = Cesium.Matrix4.multiplyByPoint(
    inverseMatrix,
    ecefPoint,
    new Cesium.Cartesian3()
  );

  // Return plain numbers
  return {
    x: originalPoint.x,
    y: originalPoint.y,
    z: originalPoint.z
  };
}

function rotateTileset(tileset, rotationMatrix3) {
  // Convert 3x3 rotation into 4x4 matrix
  const rotationMatrix4 = Cesium.Matrix4.fromRotation(
    rotationMatrix3,
    new Cesium.Matrix4()
  );

  // Apply rotation *before* the existing model matrix
  Cesium.Matrix4.multiply(
    rotationMatrix4,
    tileset.modelMatrix,
    tileset.modelMatrix
  );
}

function scaleTileset(tileset, scaleX, scaleY, scaleZ) {
  const scaleMatrix = Cesium.Matrix4.fromScale(
    new Cesium.Cartesian3(scaleX, scaleY, scaleZ),
    new Cesium.Matrix4()
  );

  Cesium.Matrix4.multiply(
    scaleMatrix,
    tileset.modelMatrix,
    tileset.modelMatrix
  );
}



function ecefToLatLonAlt(x, y, z) {
  const ecef = new Cesium.Cartesian3(x, y, z);
  const carto = Cesium.Cartographic.fromCartesian(ecef, Cesium.Ellipsoid.WGS84);

  return {
    lat: Cesium.Math.toDegrees(carto.latitude),
    lon: Cesium.Math.toDegrees(carto.longitude),
    alt: carto.height,
  };
}

/**
 * Pure JS implementation of ray intersection (Least Squares)
 * Replaces the backend /api/compute-intersection
 */
function computeIntersectionLocal(measurements) {
  if (measurements.length < 2) return null;

  const n = measurements.length;
  let sumIminusDDt = new Cesium.Matrix3(0, 0, 0, 0, 0, 0, 0, 0, 0);
  let sumIminusDDtO = new Cesium.Cartesian3(0, 0, 0);

  measurements.forEach((m) => {
    const origin = new Cesium.Cartesian3(m.camera.x, m.camera.y, m.camera.z);
    const target = new Cesium.Cartesian3(m.point.x, m.point.y, m.point.z);
    const direction = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(target, origin, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    // I - d*d^T
    const d = direction;
    const m_ddt = [
      1 - d.x * d.x, -d.x * d.y, -d.x * d.z,
      -d.y * d.x, 1 - d.y * d.y, -d.y * d.z,
      -d.z * d.x, -d.z * d.y, 1 - d.z * d.z,
    ];
    const mat = Cesium.Matrix3.fromArray(m_ddt);

    // Accumulate matrices
    Cesium.Matrix3.add(sumIminusDDt, mat, sumIminusDDt);

    // Accumulate (I - d*d^T) * origin
    const termO = Cesium.Matrix3.multiplyByVector(mat, origin, new Cesium.Cartesian3());
    Cesium.Cartesian3.add(sumIminusDDtO, termO, sumIminusDDtO);
  });

  const inverseSum = Cesium.Matrix3.inverse(sumIminusDDt, new Cesium.Matrix3());
  if (!inverseSum) return null;

  const x = Cesium.Matrix3.multiplyByVector(inverseSum, sumIminusDDtO, new Cesium.Cartesian3());

  // Calculate Residuals and Variance
  let sse = 0;
  measurements.forEach((m) => {
    const origin = new Cesium.Cartesian3(m.camera.x, m.camera.y, m.camera.z);
    const target = new Cesium.Cartesian3(m.point.x, m.point.y, m.point.z);
    const direction = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.subtract(target, origin, new Cesium.Cartesian3()),
      new Cesium.Cartesian3()
    );

    // Residual vector: v = (I - d*d^T) * (x - origin)
    const diff = Cesium.Cartesian3.subtract(x, origin, new Cesium.Cartesian3());
    const dot = Cesium.Cartesian3.dot(direction, diff);
    const projection = Cesium.Cartesian3.multiplyByScalar(direction, dot, new Cesium.Cartesian3());
    const residualVec = Cesium.Cartesian3.subtract(diff, projection, new Cesium.Cartesian3());

    sse += Cesium.Cartesian3.magnitudeSquared(residualVec);
  });

  // Variance factor (Degrees of freedom: 2n - 3)
  const sigma2 = n > 1 ? sse / (2 * n - 3) : 0.01;

  // Covariance Matrix = sigma2 * (Sum(I - dd^T))^-1
  const covMat = Cesium.Matrix3.multiplyByScalar(inverseSum, sigma2, new Cesium.Matrix3());
  const covarianceArray = Cesium.Matrix3.toArray(covMat);

  return {
    x: x.x,
    y: x.y,
    z: x.z,
    stddev: Math.sqrt(sigma2),
    // Flattened 3x3 matrix for the component
    covariance: covarianceArray,
    status: "ok"
  };
}

const CesiumViewer = forwardRef(
  ({
    tilesetUrl,
    points,
    onAddPoint,
    offsetHeight,
    selectedPoint,
    pointAppearance,
    // New props for drawing
    drawingState,
    polylines,
    polygons,
    onPointSelectForDrawing,
    selectedGeometry,
    previewPointId,
  }, ref) => {
    const viewerRef = useRef(null);
    const currentModeRef = useRef("default"); // keep internal mode
    const [measurements, setMeasurements] = useState([]);
    const measurementIdCounter = useRef(0);
    const tilesetRef = useRef(null);
    const viewerContextOptions = useMemo(
      () => ({
        requestWebgl1: false,
        webgl: {
          powerPreference: "high-performance",
        },
      }),
      []
    );

    // Refs to hold the latest props that change frequently.
    // This prevents the main `useEffect` from re-running unnecessarily, which would
    // cause the entire 3D scene to reload when points are added or drawing mode changes.
    const pointsRef = useRef(points);
    useEffect(() => { pointsRef.current = points; }, [points]);

    const drawingStateRef = useRef(drawingState);
    useEffect(() => { drawingStateRef.current = drawingState; }, [drawingState]);

    // Use a ref to hold the latest onPointSelectForDrawing callback to avoid re-running the main effect.
    const onPointSelectForDrawingRef = useRef(onPointSelectForDrawing);
    useEffect(() => { onPointSelectForDrawingRef.current = onPointSelectForDrawing; }, [onPointSelectForDrawing]);


    const addMeausure = (cameraPosition, cartesian) => {
      measurementIdCounter.current += 1;
      const newMeasurement = {
        id: measurementIdCounter.current,
        camera: {
          x: cameraPosition.x,
          y: cameraPosition.y,
          z: cameraPosition.z,
        },
        point: { x: cartesian.x, y: cartesian.y, z: cartesian.z },
      };
      console.log("Adding measure:", newMeasurement);
      setMeasurements((prev) => [...prev, newMeasurement]);
    };
    // Expose a function to parent
    useImperativeHandle(ref, () => ({
      setMode: (newMode) => {
        currentModeRef.current = newMode;
        console.log("Cesium mode changed to:", newMode);
        // if (newMode === "measure") { activateMeasurement(viewerRef.current) }
        // else if (newMode === "select") { activateSelection(viewerRef.current) }
      },
      getMode: () => currentModeRef.current,
      endMeasure: async () => {
        if (onAddPoint && measurements.length > 0) {
          try {
            const result = computeIntersectionLocal(measurements);
            if (!result) throw new Error("Could not compute intersection locally");

            // The result from the ray intersection is the final ECEF coordinate.
            // No further offsetting is needed as the rays implicitly find the point
            // on the visual (offset) model surface.
            const finalCoord = { x: result.x, y: result.y, z: result.z };
            const lla = ecefToLatLonAlt(result.x, result.y, result.z);

            const point = {
              x: finalCoord.x, // Use the un-offset coordinate for rendering
              y: finalCoord.y,
              z: finalCoord.z,
              accuracy: result.stddev,
              covariance: result.covariance,
              measures: [...measurements], // copy of all measures
              lat: lla.lat,
              lon: lla.lon,
              alt: lla.alt,
            };
            console.log("Computed intersection point:", point);
            onAddPoint(point);
          } catch (err) {
            console.error("Failed to compute intersection:", err);
          }
        }
        currentModeRef.current = "default";
        setMeasurements([]);
        measurementIdCounter.current = 0;
      },
    }));

    // point = {x, y, z}, size in meters, color optional
    /**
   * Creates a Cesium Entity to visualize a 3D point and its covariance.
   *
   * @param {object} point - The 3D point { x, y, z }.
   * @param {number[][]} covariance - The 3x3 covariance matrix.
   * @param {number} [confidenceScale=1.0] - Scale factor for the radii.
   * - 1.0 = 1-sigma ellipsoid
   * - 2.795 = 95% confidence ellipsoid (for 3D)
   * @param {Color} [color=Color.RED.withAlpha(0.5)] - The ellipsoid material.
   * @param {string} [key] - React key.
   */
    // Define the scratch object ONCE for the eigendecomposition
    const createCovarianceEntity = ( // Simplified for more flexible styling
      point,
      confidenceScale = 1.0,
      ellipsoidColor = Color.RED.withAlpha(0.5),
      key,
      pointColor = Color.WHITE,
      pixelSize = 8
    ) => {
      // 1. Convert your 2D array into a Cesium Matrix3
      // Cesium matrices are column-major, so we flatten the array
      const covMatrix = Matrix3.fromArray(point.covariance.flat());
      // 2. Perform Eigendecomposition
      // This finds the orientation (eigenvectors) and variance (eigenvalues)
      // result.unitary = Rotation matrix (eigenvectors)
      // result.diagonal = Diagonal matrix of eigenvalues
      let result;
      try {
        result = Matrix3.computeEigenDecomposition(covMatrix, scratchEigen);
      } catch (e) {
        console.error("Failed to compute eigendecomposition. Matrix may be singular.", e);
        return null; // Don't render if math fails
      }
      const diagonal = result.diagonal; // Extract diagonal elements
      const unitary = result.unitary;
      const length = Math.sqrt(diagonal[0] + diagonal[4] + diagonal[8]) + 1.0e-12;

      // 3. Get the radii (standard deviations)
      // The radii are the square root of the eigenvalues (on the diagonal)
      // We apply the confidence scaling factor here.
      const radii = new Cartesian3(
        Math.sqrt(diagonal[0]) / length * confidenceScale,
        Math.sqrt(diagonal[4]) / length * confidenceScale,
        Math.sqrt(diagonal[8]) / length * confidenceScale
      );
      // 4. Get the orientation
      // Convert the rotation matrix (eigenvectors) into a Quaternion
      const orientation = Quaternion.fromRotationMatrix(unitary);

      // 5. Create the Entity
      return (
        <Entity
          key={key}
          id={key} // Add ID for picking
          position={new Cartesian3(point.x, point.y, point.z)}
          orientation={orientation}
          ellipsoid={{
            radii: radii,
            material: ellipsoidColor,
            outline: true,
            outlineColor: Color.BLACK,
          }}
          // The solid center point marker
          point={{
            pixelSize: pixelSize,
            color: pointColor,
            outlineColor: Color.BLACK,
            outlineWidth: 2,
          }}
        />
      );
    };

    const createPointEntity = (point, size = 1.0, color = Color.RED, key) => {
      const entities = [];
      // Main point as a sphere
      entities.push(
        <Entity
          key={key}
          position={new Cartesian3(point.x, point.y, point.z)}
          ellipsoid={{
            radii: new Cartesian3(size, size, size), // Equal radii for a sphere 
            material: color,
          }}
        />
      );
      return entities;
    };

    const createLineEntity = (m, width = 2, color = Color.YELLOW, key) => {
      const start = new Cartesian3(m.camera.x, m.camera.y, m.camera.z);
      const end = new Cartesian3(m.point.x, m.point.y, m.point.z);

      // Calculate the direction from the camera to the clicked point
      const direction = Cartesian3.normalize(
        Cartesian3.subtract(end, start, new Cartesian3()),
        new Cartesian3()
      );

      // Extend the line far out along the same direction to ensure it passes through the model
      const farDistance = 10000.0; // A large distance like 10km is sufficient
      const farEnd = Cartesian3.add(
        start,
        Cartesian3.multiplyByScalar(direction, farDistance, new Cartesian3()),
        new Cartesian3()
      );

      return (
        <Entity
          key={key}
          polyline={{
            positions: [start, farEnd], // Use the new, extended end point
            width: width,
            material: color,
          }}
        />
      );
    };

    useEffect(() => {
      let handler;
      let cancelled = false;
      let removeRenderErrorListener;
      let recoveryAttempts = 0;
      let currentMaxScreenSpaceError = 128;

      // Wait until viewerRef.current.cesiumElement becomes available
      const interval = setInterval(() => {
        const viewer = viewerRef.current?.cesiumElement;
        if (!viewer) return;

        clearInterval(interval);

        const removeCurrentTileset = () => {
          if (tilesetRef.current) {
            viewer.scene.primitives.remove(tilesetRef.current);
            tilesetRef.current = null;
          }
        };

        const loadTileset = (maximumScreenSpaceError) => {
          removeCurrentTileset();

          if (!tilesetUrl) {
            return;
          }

          Cesium.Cesium3DTileset.fromUrl(tilesetUrl, {
            maximumScreenSpaceError,
            maximumMemoryUsage: 512,
            skipLevelOfDetail: false,
            cullWithChildrenBounds: true,
            cullRequestsWhileMoving: true,
            preloadWhenHidden: false,
            preferLeaves: false,
            dynamicScreenSpaceError: true,
          })
            .then((tileset) => {
              if (cancelled) {
                return;
              }

              // This app is explicitly for 3DGS rendering, so always keep splat rendering enabled.
              if ("showGaussianSplatting" in tileset) {
                tileset.enableShowGaussianSplatting = true;
                tileset.showGaussianSplatting = true;
              }

              //tileset.debugShowBoundingVolume = true;

              offsetTilesetHeight(tileset, offsetHeight);

              viewer.scene.primitives.add(tileset);
              viewer.zoomTo(tileset);
              tilesetRef.current = tileset;
            })
            .catch((error) => {
              console.error("Error loading tileset:", error);
              const message = String(error?.message || error || "");
              const mightBeVertexBufferIssue =
                message.includes("Vertex buffer is not big enough") ||
                message.includes("GL_INVALID_OPERATION") ||
                message.includes("0x00000502");

              if (mightBeVertexBufferIssue && recoveryAttempts < 2) {
                recoveryAttempts += 1;
                currentMaxScreenSpaceError = Math.min(currentMaxScreenSpaceError * 2, 512);
                console.warn(
                  `Retrying tileset load with higher maximumScreenSpaceError=${currentMaxScreenSpaceError} while keeping Gaussian splatting enabled.`
                );
                loadTileset(currentMaxScreenSpaceError);
              }
            });
        };

        const onRenderError = (scene, error) => {
          const message = String(error?.message || error || "");
          const isVertexBufferOverflow =
            message.includes("Vertex buffer is not big enough") ||
            message.includes("GL_INVALID_OPERATION") ||
            message.includes("0x00000502");

          if (isVertexBufferOverflow && recoveryAttempts < 2) {
            recoveryAttempts += 1;
            currentMaxScreenSpaceError = Math.min(currentMaxScreenSpaceError * 2, 512);
            console.warn(
              `Detected GPU vertex-buffer overflow; reloading tileset with higher maximumScreenSpaceError=${currentMaxScreenSpaceError} and Gaussian splatting still enabled.`
            );
            loadTileset(currentMaxScreenSpaceError);
          }
        };
        viewer.scene.renderError.addEventListener(onRenderError);
        removeRenderErrorListener = () => viewer.scene.renderError.removeEventListener(onRenderError);

        loadTileset(currentMaxScreenSpaceError);

        // Set up mouse event handler
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

        // Prevent the default double-click behavior which zooms into the point
        // and can cause a "matrix is not invertible" crash.
        handler.setInputAction((click) => {
          // Explicitly set the tracked entity to undefined to fully disable
          // the default camera flight behavior on double-click, which can
          // cause the rendering to crash.
          viewer.trackedEntity = undefined;
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

        handler.setInputAction((click) => {
          const { mode: drawingMode } = drawingStateRef.current;

          if (drawingMode === 'polyline' || drawingMode === 'polygon') {
            const viewer = viewerRef.current.cesiumElement;
            
            // 1. Try to pick an existing point entity
            const pickedObject = viewer.scene.pick(click.position);
            if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id) && typeof pickedObject.id.id === 'string' && pickedObject.id.id.startsWith('point_')) {
              const pointId = parseInt(pickedObject.id.id.split('_')[1], 10);
              const point = pointsRef.current.find(p => p.id === pointId);
              if (point) {
                onPointSelectForDrawingRef.current(point);
              }
            }

            // After attempting to pick a point, stop further click processing for this mode.
            return;
          }

          if (currentModeRef.current === "measure") {
            // This picks on the WGS84 ellipsoid, which is fine for ray-casting.
            const cartesian = viewer.camera.pickEllipsoid(
              click.position,
              viewer.scene.globe.ellipsoid,
            );
            if (cartesian) {
              addMeausure(viewer.camera.positionWC, cartesian);
            }
          } else {
            // This could be used for selecting points for inspection from the viewer
            // const pickedObject = viewer.scene.pick(click.position);
            // ...
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        handler.setInputAction((movement) => {
          /*const cartesian = viewer.camera.pickEllipsoid(
          movement.endPosition,
          viewer.scene.globe.ellipsoid
        );
        if (cartesian) {
          // Example: show coordinates or highlight
        }*/
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
      }, 200); // check every 200 ms until viewer is ready

      // Cleanup
      return () => {
        cancelled = true;
        clearInterval(interval);
        if (removeRenderErrorListener) removeRenderErrorListener();
        if (handler) handler.destroy();
        const viewer = viewerRef.current?.cesiumElement;
        if (viewer && tilesetRef.current) {
          viewer.scene.primitives.remove(tilesetRef.current);
          tilesetRef.current = null;
        }
      };
    }, [tilesetUrl, offsetHeight]);

    return (
      <Viewer
        ref={viewerRef}
        full
        infoBox={false}
        selectionIndicator={false}
        contextOptions={viewerContextOptions}
      >
        {points.map((pt) => {
          const isSelectedForInspection = selectedPoint === pt.id;
          const isSelectedForGeometry = drawingState.points.some(p => p.id === pt.id);
          const isPreviewed = previewPointId === pt.id;

          let ellipsoidColor = Color.BLUE.withAlpha(0.5);
          let pointColor = Color.WHITE;
          let pixelSize = 8;
          let scale = 0.2;

          if (isPreviewed) {
            ellipsoidColor = Color.CYAN.withAlpha(0.8);
            pointColor = Color.CYAN;
            pixelSize = 16;
            scale = 0.3;
          } else if (isSelectedForGeometry) {
            ellipsoidColor = Color.ORANGE.withAlpha(0.7);
            pointColor = Color.ORANGE;
            pixelSize = 12;
          } else if (isSelectedForInspection) {
            ellipsoidColor = Color.GREEN.withAlpha(0.7);
            pointColor = Color.GREEN;
            pixelSize = 12;
          }

          if (pointAppearance === 'ellipsoid') {
            return createCovarianceEntity(
              pt, scale, ellipsoidColor, "point_" + pt.id, pointColor, pixelSize
            );
          } else { // 'point'
            return (
              <Entity
                key={"point_" + pt.id}
                id={"point_" + pt.id}
                position={new Cartesian3(pt.x, pt.y, pt.z)}
                point={{
                  pixelSize: pixelSize,
                  color: pointColor,
                  outlineColor: Color.BLACK,
                  outlineWidth: 2,
                  // Disable depth test when highlighted to ensure visibility
                  disableDepthTestDistance: isSelectedForGeometry || isPreviewed || isSelectedForInspection ? Number.POSITIVE_INFINITY : 0,
                }}
              />
            );
          }
        })}
        {measurements.map((m) =>
          createLineEntity(m, 2, Color.YELLOW.withAlpha(0.5), "line_" + m.id),
        )}

        {/* --- Render Geometries --- */}

        {/* Render completed polylines */}
        {polylines.map(line => {
          const isSelected = selectedGeometry?.type === 'polyline' && selectedGeometry?.id === line.id;
          return (
            <Entity key={line.id} id={line.id}>
              <PolylineGraphics
                positions={line.points.map(p => new Cartesian3(p.x, p.y, p.z))}
                width={isSelected ? 5 : 3}
                material={isSelected ? Color.CYAN : Color.YELLOW}
                clampToGround={false}
                disableDepthTestDistance={Number.POSITIVE_INFINITY}
              />
            </Entity>
          );
        })}

        {/* Render completed polygons */}
        {polygons.map(poly => {
          const isSelected = selectedGeometry?.type === 'polygon' && selectedGeometry?.id === poly.id;
          const polylinePositions = [...poly.points.map(p => new Cartesian3(p.x, p.y, p.z)), new Cartesian3(poly.points[0].x, poly.points[0].y, poly.points[0].z)];
          return (
            <Entity key={poly.id} id={poly.id}>
              {/* The fill, which can be occluded to prevent "floating" */}
              <PolygonGraphics
                hierarchy={new PolygonHierarchy(poly.points.map(p => new Cartesian3(p.x, p.y, p.z)))}
                material={isSelected ? Color.CYAN.withAlpha(0.5) : Color.ORANGE.withAlpha(0.5)}
              />
              {/* The outline, which is always on top for visibility */}
              <PolylineGraphics
                positions={polylinePositions}
                width={isSelected ? 3 : 1.5}
                material={isSelected ? Color.CYAN : Color.BLACK}
                disableDepthTestDistance={Number.POSITIVE_INFINITY}
              />
            </Entity>
          );
        })}

        {/* Render the geometry being currently drawn */}
        {drawingState.mode === 'polyline' && drawingState.points.length > 0 && (
          <Entity>
            <PolylineGraphics
              positions={drawingState.points.map(p => new Cartesian3(p.x, p.y, p.z))}
              width={3}
              material={Color.RED.withAlpha(0.7)}
              disableDepthTestDistance={Number.POSITIVE_INFINITY}
            />
          </Entity>
        )}
        {drawingState.mode === 'polygon' && drawingState.points.length > 0 && (
          <Entity>
            <PolylineGraphics
              positions={[...drawingState.points, drawingState.points[0]].map(p => new Cartesian3(p.x, p.y, p.z))}
              width={3}
              material={Color.RED.withAlpha(0.7)}
              disableDepthTestDistance={Number.POSITIVE_INFINITY}
            />
            {drawingState.points.length > 2 && (
              <PolygonGraphics
                hierarchy={new PolygonHierarchy(drawingState.points.map(p => new Cartesian3(p.x, p.y, p.z)))}
                material={Color.RED.withAlpha(0.3)} />
            )}
          </Entity>
        )}
      </Viewer>
    );
  },
);

export default CesiumViewer;
