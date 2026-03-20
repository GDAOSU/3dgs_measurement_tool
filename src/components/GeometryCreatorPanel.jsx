import React, { useMemo } from 'react';
import {
  Card, CardContent, CardActions, Button, Typography, List, ListItem,
  ListItemText, ListItemSecondaryAction, IconButton, Divider, Box, ListItemButton,
  ListItemIcon
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// A new component for the sortable list item, using dnd-kit hooks
function SortablePointItem({ point, index, onPreviewPoint, onPointSelect }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(point.id) });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 'auto', // Ensure dragging item is on top
  };

  return (
    <ListItem
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onMouseEnter={() => onPreviewPoint(point.id || 0)}
      onMouseLeave={() => onPreviewPoint(0)}
      sx={{
        cursor: 'grab',
        touchAction: 'none',
        bgcolor: isDragging ? 'action.hover' : 'transparent',
      }}
    >
      <ListItemIcon sx={{ minWidth: 'auto', pr: 1 }}>
        <DragIndicatorIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText primary={`Point ${point.id}`} secondary={`(${point.lon.toFixed(4)}, ${point.lat.toFixed(4)}, ${point.alt.toFixed(2)})`} />
      <ListItemSecondaryAction><IconButton edge="end" aria-label="delete" onClick={() => onPointSelect(point)}><DeleteIcon /></IconButton></ListItemSecondaryAction>
    </ListItem>
  );
}

export default function GeometryCreatorPanel({
  isOpen,
  drawingState,
  onCancel,
  onFinish,
  onPointSelect, // To remove a point from the list
  onPreviewPoint,
  // For the available points list
  availablePoints,
  multiSelectPoints,
  onAvailablePointClick,
  onAddMultiSelectedPoints,
  onClearPoints,
  onReorderPoints,
}) {
  if (!isOpen) {
    return null;
  }

  const { mode, points: selectedPoints } = drawingState;
  const title = mode === 'polyline' ? 'Create Polyline' : 'Create Polygon';
  const finishText = mode === 'polyline' ? 'Finish Polyline' : 'Finish Polygon';
  const minPoints = mode === 'polyline' ? 2 : 3;

  const availablePointsToShow = useMemo(() => {
    const selectedIds = new Set(selectedPoints.map(p => p.id));
    return availablePoints.filter(p => !selectedIds.has(p.id));
  }, [availablePoints, selectedPoints]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Require the mouse to move by a few pixels before activating
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = selectedPoints.findIndex(p => String(p.id) === active.id);
      const newIndex = selectedPoints.findIndex(p => String(p.id) === over.id);
      if (oldIndex !== -1 && newIndex !== -1) {
        onReorderPoints(oldIndex, newIndex);
      }
    }
  }

  return (
    <Card
      sx={{
        position: 'absolute',
        top: 80,
        right: 20,
        width: 400,
        zIndex: 1000,
        boxShadow: 5,
        borderRadius: 2,
      }}
    >
      <CardContent>
        <Typography variant="h6" gutterBottom>{title}</Typography>
        <Typography variant="body2" color="textSecondary" gutterBottom>
          Select existing measured points from the 3D view or the list below.
        </Typography>
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
          <Typography variant="h6" gutterBottom component="div" sx={{ mb: 0 }}>
            Selected Points ({selectedPoints.length})
          </Typography>
          {selectedPoints.length > 0 && (
            <Button 
                onClick={onClearPoints}
                size="small"
                color="error"
            >
                Clear All
            </Button>
          )}
        </Box>

        {selectedPoints.length === 0 ? (
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>No points selected yet.</Typography>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={selectedPoints.map(p => String(p.id))} strategy={verticalListSortingStrategy}>
              <List dense sx={{ maxHeight: 150, overflow: "auto" }}>
                {selectedPoints.map((point, index) => (
                  <SortablePointItem
                    key={point.id}
                    point={point}
                    index={index}
                    onPreviewPoint={onPreviewPoint}
                    onPointSelect={onPointSelect}
                  />
                ))}
              </List>
            </SortableContext>
          </DndContext>
        )}

        <Divider style={{ margin: '16px 0' }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" gutterBottom component="div">
            Available Measured Points
          </Typography>
          <Button 
              onClick={onAddMultiSelectedPoints}
              disabled={multiSelectPoints.length === 0}
              size="small"
              variant="outlined"
          >
              Add Selected ({multiSelectPoints.length})
          </Button>
        </Box>
        <List dense style={{ maxHeight: 200, overflow: 'auto' }}>
            {availablePointsToShow.map((point) => (
              <ListItemButton
                key={point.id}
                onClick={(event) => onAvailablePointClick(event, point.id)}
                selected={multiSelectPoints.includes(point.id)}
                onMouseEnter={() => onPreviewPoint(point.id)}
                onMouseLeave={() => onPreviewPoint(0)}
                sx={{
                  borderRadius: 1,
                  "&.Mui-selected": {
                    bgcolor: "primary.light",
                    color: "primary.contrastText",
                    "&:hover": { bgcolor: "primary.main" },
                  },
                }}
              >
                  <ListItemText primary={`Point ${point.id}`} />
              </ListItemButton>
            ))}
            {availablePointsToShow.length === 0 && (
              <ListItem>
                <ListItemText primary="No other measured points available." />
              </ListItem>
            )}
        </List>

      </CardContent>
      <CardActions sx={{ justifyContent: 'flex-end', p: 2 }}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="contained" onClick={onFinish} disabled={selectedPoints.length < minPoints} >
              {finishText}
          </Button>
      </CardActions>
    </Card>
  );
}
