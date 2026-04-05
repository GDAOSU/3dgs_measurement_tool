import React, { useEffect, useRef, useState } from "react";
import {
  Card, CardContent, Typography, Button, List, ListItemButton,
  ListItemText, Divider, Stack, FormControl, InputLabel, Select,
  MenuItem, Menu, TextField, Dialog, DialogTitle, DialogContent, ToggleButton,
  ToggleButtonGroup,
  DialogActions, Tabs, Tab, Box
} from "@mui/material"; 
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { getDefaultBucket, getAwsRegion } from "../utils/awsConfig";

const DEFAULT_CUSTOM_MODEL = {
  bucket: getDefaultBucket() || "",
  region: getAwsRegion() || "",
  prefix: "data/3dtiles",
  tileset: "custom/tileset.json",
  offsetHeight: 0,
};

const DEFAULT_URL_MODEL = {
  tilesetUrl: "",
  offsetHeight: 0,
};

function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`simple-tabpanel-${index}`}
      aria-labelledby={`simple-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

function a11yProps(index) {
  return {
    id: `simple-tab-${index}`,
    "aria-controls": `simple-tabpanel-${index}`,
  };
}

function ExportMenu({ onExport, disabled }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = (format) => {
    onExport(format);
    handleClose();
  };

  return (
    <>
      <Button
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={handleClick}
        disabled={disabled}
        fullWidth
      >
        Export
      </Button>
      <Menu anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={() => handleSelect('geojson')}>As GeoJSON (.json)</MenuItem>
        <MenuItem onClick={() => handleSelect('csv')}>As CSV (.csv)</MenuItem>
        <MenuItem onClick={() => handleSelect('kml')}>As KML (.kml)</MenuItem>
      </Menu>
    </>
  );
}

export default function MeasurePanel({
  points,
  onSelectPoint,
  onDeletePoint,
  onToggleMeasure,
  measuring,
  offsetHeight,
  models,
  selectedModelId,
  customModel,
  urlModel,
  onModelChange,
  onSaveCustomModel,
  onSaveUrlModel,
  onOffsetHeightChange,
  onEditModel,
  pointAppearance,
  onPointAppearanceChange,
  ellipsoidScale,
  onIncreaseEllipsoidScale,
  onDecreaseEllipsoidScale,
  // New geometry props
  polylines,
  polygons,
  drawingState,
  selectedGeometry,
  onStartDrawing,
  onFinishDrawing,
  onCancelDrawing,
  onSelectGeometry,
  onDeleteGeometry,
  onExportGeometries,
  onImportPoints,
}) {
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [draftCustomModel, setDraftCustomModel] = useState(
    customModel || DEFAULT_CUSTOM_MODEL
  );
  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [draftUrlModel, setDraftUrlModel] = useState(
    urlModel || DEFAULT_URL_MODEL
  );
  const [tabIndex, setTabIndex] = useState(0);
  const importInputRef = useRef(null);

  const handleTabChange = (event, newValue) => {
    setTabIndex(newValue);
  };

  useEffect(() => {
    if (!customDialogOpen) {
      setDraftCustomModel(customModel || DEFAULT_CUSTOM_MODEL);
    }
  }, [customDialogOpen, customModel]);

  useEffect(() => {
    if (!urlDialogOpen) {
      setDraftUrlModel(urlModel || DEFAULT_URL_MODEL);
    }
  }, [urlDialogOpen, urlModel]);

  const handleSelect = (index) => {
    // Allow deselecting
    const nextIndex = selectedIndex === index ? null : index;
    setSelectedIndex(nextIndex);
    if (onSelectPoint) onSelectPoint(points[index]);
  };

  const openCustomDialog = () => {
    setDraftCustomModel(customModel || DEFAULT_CUSTOM_MODEL);
    setCustomDialogOpen(true);
  };

  const openUrlDialog = () => {
    setDraftUrlModel(urlModel || DEFAULT_URL_MODEL);
    setUrlDialogOpen(true);
  };

  const handleModelChange = (event) => {
    const nextModelId = event.target.value;
    if (onModelChange) onModelChange(nextModelId);
    if (nextModelId === "custom") {
      openCustomDialog();
    }
    if (nextModelId === "url") {
      openUrlDialog();
    }
  };

  const handleCustomFieldChange = (field) => (event) => {
    setDraftCustomModel((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleCustomSave = () => {
    const nextOffset = Number(draftCustomModel.offsetHeight);
    const payload = {
      ...draftCustomModel,
      offsetHeight: Number.isNaN(nextOffset) ? 0 : nextOffset,
    };
    if (onSaveCustomModel) onSaveCustomModel(payload);
    setCustomDialogOpen(false);
  };

  const handleUrlFieldChange = (field) => (event) => {
    setDraftUrlModel((prev) => ({
      ...prev,
      [field]: event.target.value,
    }));
  };

  const handleUrlSave = () => {
    const nextOffset = Number(draftUrlModel.offsetHeight);
    const payload = {
      ...draftUrlModel,
      offsetHeight: Number.isNaN(nextOffset) ? 0 : nextOffset,
    };
    if (onSaveUrlModel) onSaveUrlModel(payload);
    setUrlDialogOpen(false);
  };

  const handleCustomClose = () => {
    setCustomDialogOpen(false);
  };

  const handleUrlClose = () => {
    setUrlDialogOpen(false);
  };

  const handleImportClick = () => {
    if (importInputRef.current) {
      importInputRef.current.click();
    }
  };

  const handleImportFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (onImportPoints) {
      onImportPoints(file);
    }
    // Allow selecting the same file again in a later import.
    event.target.value = "";
  };

  return (
    <Card
      sx={{
        width: 400,
        position: "absolute",
        top: 20,
        left: 20,
        bgcolor: "background.paper",
        boxShadow: 5,
        borderRadius: 3,
      }}
    >
      <CardContent>
        <Typography variant="h6" gutterBottom>
          3D Measurement
        </Typography>

        <Stack spacing={2} mt={2}>
          <Stack direction="row" spacing={1}>
            <FormControl size="small" fullWidth sx={{ flex: 1 }}>
              <InputLabel id="model-select-label">Model</InputLabel>
              <Select
                labelId="model-select-label"
                value={selectedModelId}
                label="Model"
                onChange={handleModelChange}
              >
                {models.map((model) => (
                  <MenuItem key={model.id} value={model.id}>
                    {model.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {(selectedModelId === "custom" || selectedModelId === "url" || selectedModelId === "upload") && (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => {
                  if (selectedModelId === "custom") openCustomDialog();
                  if (selectedModelId === "url") openUrlDialog();
                  if (selectedModelId === "upload" && onEditModel) onEditModel();
                }}
              >
                {selectedModelId === "upload" ? "Upload" : "Edit"}
              </Button>
            )}
          </Stack>

          <TextField
            size="small"
            label="Offset Height"
            type="number"
            value={offsetHeight}
            onChange={(event) =>
              onOffsetHeightChange && onOffsetHeightChange(event.target.value)
            }
            inputProps={{ step: 1 }}
          />

        </Stack>

        <Box sx={{ borderBottom: 1, borderColor: "divider", mt: 2 }}>
          <Tabs
            value={tabIndex}
            onChange={handleTabChange}
            aria-label="points and buildings tabs"
          >
            <Tab label={`Points (${points.length})`} {...a11yProps(0)} sx={{ textTransform: 'none' }} />
            <Tab label={`Polylines (${polylines.length})`} {...a11yProps(1)} sx={{ textTransform: 'none' }} />
            <Tab label={`Polygons (${polygons.length})`} {...a11yProps(2)} sx={{ textTransform: 'none' }} />
          </Tabs>
        </Box>

        <TabPanel value={tabIndex} index={0}>
          <input
            ref={importInputRef}
            type="file"
            accept=".csv,.geojson,.json,application/json,text/csv,application/geo+json"
            style={{ display: "none" }}
            onChange={handleImportFileChange}
          />
          <List dense sx={{ maxHeight: 200, overflowY: "auto" }}>
            {points.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                No points measured yet.
              </Typography>
            )}
            {points.map((p, index) => (
              <React.Fragment key={p.id}>
                <ListItemButton
                  selected={selectedIndex === index}
                  onClick={() => handleSelect(index)}
                  sx={{
                    borderRadius: 2,
                    "&.Mui-selected": {
                      bgcolor: "primary.light",
                      color: "white",
                      "&:hover": { bgcolor: "primary.main" },
                    },
                  }}
                >
                  <ListItemText
                    primary={`Point ${p.id}`}
                    secondary={`(${p.lat.toFixed(8)}, ${p.lon.toFixed(8)}, ${p.alt.toFixed(4)}) | σ = ${p.accuracy.toFixed(3)} m`}
                  />
                </ListItemButton>
                {index < points.length - 1 && <Divider component="li" />}
              </React.Fragment>
            ))}
          </List>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ToggleButtonGroup
                value={pointAppearance}
                exclusive
                fullWidth
                size="small"
                onChange={(event, newAppearance) => {
                  // Prevent unselecting all buttons
                  if (newAppearance !== null) {
                    onPointAppearanceChange(newAppearance);
                  }
                }}
                aria-label="point appearance"
                sx={{ flex: 1 }}
              >
                <ToggleButton value="ellipsoid" sx={{ flex: 1 }}>Error Ellipsoid</ToggleButton>
                <ToggleButton value="point" sx={{ flex: 1 }}>Simple Point</ToggleButton>
              </ToggleButtonGroup>
              <Stack direction="row" spacing={0.5}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onDecreaseEllipsoidScale}
                  disabled={pointAppearance !== "ellipsoid"}
                  sx={{ minWidth: 36, px: 0 }}
                >
                  -
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={onIncreaseEllipsoidScale}
                  disabled={pointAppearance !== "ellipsoid"}
                  sx={{ minWidth: 36, px: 0 }}
                >
                  +
                </Button>
              </Stack>
            </Stack>
            <Typography variant="caption" color="text.secondary" sx={{ px: 0.5 }}>
              Ellipsoid scale: {Number(ellipsoidScale).toFixed(2)}x
            </Typography>
            <Button
              variant="contained"
              color={measuring ? "error" : "primary"}
              onClick={onToggleMeasure}
              fullWidth
            >
              {measuring ? "End Measure" : "Start Measure"}
            </Button>
            <Stack direction="row" spacing={1}>
              <ExportMenu onExport={(format) => onExportGeometries('point', format)} disabled={points.length === 0} />
              <Button
                variant="outlined"
                startIcon={<UploadFileIcon />}
                onClick={handleImportClick}
                fullWidth
              >
                Import
              </Button>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteIcon />}
                onClick={onDeletePoint}
                disabled={selectedIndex === null}
                fullWidth
              >
                Delete
              </Button>
            </Stack>
          </Stack>
        </TabPanel>

        <TabPanel value={tabIndex} index={1}>
          <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
            {polylines.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                No polylines created yet.
              </Typography>
            )}
            {polylines.map((line) => (
              <ListItemButton
                key={line.id}
                selected={selectedGeometry?.type === 'polyline' && selectedGeometry?.id === line.id}
                onClick={() => onSelectGeometry('polyline', line.id)}
                sx={{
                  borderRadius: 2,
                  "&.Mui-selected": {
                    bgcolor: "primary.light",
                    color: "white",
                    "&:hover": { bgcolor: "primary.dark" },
                  },
                }}
              >
                <ListItemText primary={line.id} secondary={`${line.points.length} points`} />
              </ListItemButton>
            ))}
          </List>
          <Stack spacing={1} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => onStartDrawing('polyline')}
                disabled={drawingState.mode !== 'none'}
              >
                Create Polyline
              </Button>
              <Stack direction="row" spacing={1}>
                <ExportMenu onExport={(format) => onExportGeometries('polyline', format)} disabled={polylines.length === 0} />
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={onDeleteGeometry}
                  disabled={selectedGeometry?.type !== 'polyline'}
                  fullWidth
                >
                  Delete
                </Button>
              </Stack>
            </Stack>
        </TabPanel>

        <TabPanel value={tabIndex} index={2}>
          <List dense sx={{ maxHeight: 150, overflowY: "auto" }}>
            {polygons.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ px: 1 }}>
                No polygons created yet.
              </Typography>
            )}
            {polygons.map((poly) => (
              <ListItemButton
                key={poly.id}
                selected={selectedGeometry?.type === 'polygon' && selectedGeometry?.id === poly.id}
                onClick={() => onSelectGeometry('polygon', poly.id)}
                sx={{
                  borderRadius: 2,
                  "&.Mui-selected": {
                    bgcolor: "primary.light",
                    color: "white",
                    "&:hover": { bgcolor: "primary.dark" },
                  },
                }}
              >
                <ListItemText primary={poly.id} secondary={`${poly.points.length} points`} />
              </ListItemButton>
            ))}
          </List>
          <Stack spacing={1} sx={{ mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => onStartDrawing('polygon')}
                disabled={drawingState.mode !== 'none'}
              >
                Create Polygon
              </Button>
              <Stack direction="row" spacing={1}>
                <ExportMenu onExport={(format) => onExportGeometries('polygon', format)} disabled={polygons.length === 0} />
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={onDeleteGeometry}
                  disabled={selectedGeometry?.type !== 'polygon'}
                  fullWidth
                >
                  Delete
                </Button>
              </Stack>
            </Stack>
        </TabPanel>
      </CardContent>

      <Dialog open={customDialogOpen} onClose={handleCustomClose} maxWidth="sm" fullWidth>
        <DialogTitle>Custom S3 Model</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              size="small"
              label="Region"
              placeholder="e.g., us-east-1"
              value={draftCustomModel.region}
              onChange={handleCustomFieldChange("region")}
              fullWidth
            />
            <TextField
              size="small"
              label="Bucket"
              value={draftCustomModel.bucket}
              onChange={handleCustomFieldChange("bucket")}
              fullWidth
            />
            <TextField
              size="small"
              label="Prefix"
              value={draftCustomModel.prefix}
              onChange={handleCustomFieldChange("prefix")}
              fullWidth
            />
            <TextField
              size="small"
              label="Tileset"
              value={draftCustomModel.tileset}
              onChange={handleCustomFieldChange("tileset")}
              fullWidth
            />
            <TextField
              size="small"
              label="Offset Height"
              type="number"
              value={draftCustomModel.offsetHeight}
              onChange={handleCustomFieldChange("offsetHeight")}
              inputProps={{ step: 1 }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCustomClose}>Cancel</Button>
          <Button variant="contained" onClick={handleCustomSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={urlDialogOpen} onClose={handleUrlClose} maxWidth="sm" fullWidth>
        <DialogTitle>URL Model</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              size="small"
              label="Tileset URL"
              placeholder="http://localhost:8000/tileset.json"
              value={draftUrlModel.tilesetUrl}
              onChange={handleUrlFieldChange("tilesetUrl")}
              fullWidth
            />
            <TextField
              size="small"
              label="Offset Height"
              type="number"
              value={draftUrlModel.offsetHeight}
              onChange={handleUrlFieldChange("offsetHeight")}
              inputProps={{ step: 1 }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleUrlClose}>Cancel</Button>
          <Button variant="contained" onClick={handleUrlSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
