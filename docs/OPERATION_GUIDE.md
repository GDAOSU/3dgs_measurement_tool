# 3DGS Measurement Tool - Operation Guide

This short guide explains the main workflow in the web app.

## 1. Select a Model

1. In the left panel, open the **Model** dropdown menu to see loading options.
2. Choose one of the following methods:
   - **Select a built-in model**: Simply choose one from the list.
   - **Load from Custom S3**: Select this option, click **Edit**, provide your S3 Bucket, Prefix, and Tileset file name, set an optional height offset, and click **Save**.
   - **Load from URL**: Select this option, click **Edit**, paste the tileset URL, set an optional height offset, and click **Save**.
   - **Upload a local file**: Select this option, click **Upload**, enter the model's Latitude and Longitude, set an optional height offset, and then choose a `.ply`, `.splat`, or `.spz` file from your computer.
3. The **Offset Height** value can be adjusted at any time from the model panel to vertically shift the model for better alignment.

## 2. Measure Points

1. Go to the **Points** tab.
2. Click **Start Measure** to begin.
3. In the 3D viewer, click on your target point. A ray is cast from the camera.
4. Change the camera view (rotate/pan/zoom) and click the *same* point from a different angle.
5. Repeat at least once. More clicks from varied viewpoints improve the measurement's stability.
6. Click **End Measure**. The system triangulates the clicks to compute and save the 3D point.
7. The measured point appears in the list with coordinates and an `Iz` accuracy metric.

## 3. View Error Ellipsoid

In the **Points** tab, you can switch between two visualization modes for measured points:
- **Error Ellipsoid**: Shows the uncertainty of each point as a 3D ellipsoid. This is useful for visually assessing measurement quality.
- **Simple Point**: Shows a simple marker for a cleaner view.

Use the toggle to switch between these modes.

## 4. Create Polylines

1. Go to the **Polylines** tab.
2. Click **Create Polyline**. A geometry creation panel will appear on the right.
3. Build the polyline by adding existing measured points to it. You can do this in two ways:
   - Click on measured points directly in the 3D view.
   - In the geometry panel, select points from the "Available Measured Points" list and click **Add Selected**.
4. (Optional) In the geometry panel, drag and drop points within the "Selected Points for Geometry" list to reorder them.
5. Click **Finish Polyline** to save the new geometry.

## 5. Create Polygons

1. Go to the **Polygons** tab.
2. Click **Create Polygon**. A geometry creation panel will appear on the right.
3. Build the polygon by adding at least 3 existing measured points. You can do this in two ways:
   - Click on measured points directly in the 3D view.
   - In the geometry panel, select points from the "Available Measured Points" list and click **Add Selected**.
4. (Optional) In the geometry panel, drag and drop points to reorder the polygon's vertices.
5. Click **Finish Polygon** to save the new geometry.

## 6. Export Points, Polylines, and Polygons

Each tab (**Points**, **Polylines**, **Polygons**) has its own **Export** button.
1. Go to the tab containing the data you want to export.
2. Click the **Export** button.
3. Choose your desired format: **GeoJSON**, **CSV**, or **KML**.
4. Your browser will download the file.

## 7. Select and Delete Items

- **To select**: In any list, click on a point, polyline, or polygon to select it. The item will be highlighted in the 3D view.
- **To delete**: Select an item from the list and click the **Delete** button in its corresponding tab.
- **To clear during creation**: While creating a polyline or polygon, click **Clear All** in the geometry panel to remove all points from the current selection.
