import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CanvasToolbar from '../../src/components/DiagramCanvas/CanvasToolbar';
import { useCanvasStore } from '../../src/stores/canvasStore';

describe('CanvasToolbar', () => {
  beforeEach(() => {
    useCanvasStore.getState().reset();
  });

  it('renders all tool buttons', () => {
    render(<CanvasToolbar />);
    expect(screen.getByTitle('Pen')).toBeInTheDocument();
    expect(screen.getByTitle('Line')).toBeInTheDocument();
    expect(screen.getByTitle('Rectangle')).toBeInTheDocument();
    expect(screen.getByTitle('Circle')).toBeInTheDocument();
    expect(screen.getByTitle('Text')).toBeInTheDocument();
    expect(screen.getByTitle('Pan/Move Canvas')).toBeInTheDocument();
    expect(screen.getByTitle('Eraser')).toBeInTheDocument();
  });

  it('renders undo/redo/clear/reset buttons', () => {
    render(<CanvasToolbar />);
    expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeInTheDocument();
    expect(screen.getByTitle('Redo (Ctrl+Y)')).toBeInTheDocument();
    expect(screen.getByTitle('Clear Canvas')).toBeInTheDocument();
    expect(screen.getByTitle('Reset Zoom')).toBeInTheDocument();
  });

  it('marks the active tool with active class', () => {
    render(<CanvasToolbar />);
    const penBtn = screen.getByTitle('Pen');
    expect(penBtn.className).toContain('active');

    const lineBtn = screen.getByTitle('Line');
    expect(lineBtn.className).not.toContain('active');
  });

  it('switches tool when a tool button is clicked', () => {
    render(<CanvasToolbar />);
    fireEvent.click(screen.getByTitle('Rectangle'));
    expect(useCanvasStore.getState().currentTool).toBe('rectangle');
  });

  it('switches to eraser when eraser button is clicked', () => {
    render(<CanvasToolbar />);
    fireEvent.click(screen.getByTitle('Eraser'));
    expect(useCanvasStore.getState().currentTool).toBe('eraser');
  });

  it('disables undo button when history is empty', () => {
    render(<CanvasToolbar />);
    expect(screen.getByTitle('Undo (Ctrl+Z)')).toBeDisabled();
  });

  it('enables undo button when history exists', () => {
    useCanvasStore.getState().addStroke({ tool: 'pen', points: [] });
    render(<CanvasToolbar />);
    expect(screen.getByTitle('Undo (Ctrl+Z)')).not.toBeDisabled();
  });

  it('disables redo button when redo history is empty', () => {
    render(<CanvasToolbar />);
    expect(screen.getByTitle('Redo (Ctrl+Y)')).toBeDisabled();
  });

  it('enables redo button after undo', () => {
    useCanvasStore.getState().addStroke({ tool: 'pen', points: [] });
    useCanvasStore.getState().undo();
    render(<CanvasToolbar />);
    expect(screen.getByTitle('Redo (Ctrl+Y)')).not.toBeDisabled();
  });

  it('calls undo when undo button is clicked', () => {
    useCanvasStore.getState().addStroke({ tool: 'pen', points: [{ x: 0, y: 0 }] });
    render(<CanvasToolbar />);
    fireEvent.click(screen.getByTitle('Undo (Ctrl+Z)'));
    expect(useCanvasStore.getState().drawingStrokes).toEqual([]);
  });

  it('calls redo when redo button is clicked', () => {
    const stroke = { tool: 'pen', points: [{ x: 0, y: 0 }] };
    useCanvasStore.getState().addStroke(stroke);
    useCanvasStore.getState().undo();
    render(<CanvasToolbar />);
    fireEvent.click(screen.getByTitle('Redo (Ctrl+Y)'));
    expect(useCanvasStore.getState().drawingStrokes).toEqual([stroke]);
  });

  it('clears canvas when clear button is clicked', () => {
    useCanvasStore.getState().addStroke({ tool: 'pen', points: [] });
    render(<CanvasToolbar />);
    fireEvent.click(screen.getByTitle('Clear Canvas'));
    expect(useCanvasStore.getState().drawingStrokes).toEqual([]);
  });

  it('resets zoom when reset zoom button is clicked', () => {
    useCanvasStore.getState().setZoom(2.5);
    useCanvasStore.getState().setPan({ x: 100, y: 50 });
    render(<CanvasToolbar />);
    fireEvent.click(screen.getByTitle('Reset Zoom'));
    expect(useCanvasStore.getState().zoom).toBe(1);
    expect(useCanvasStore.getState().panOffset).toEqual({ x: 0, y: 0 });
  });

  it('updates color when color picker changes', () => {
    render(<CanvasToolbar />);
    const colorPicker = screen.getByTitle('Color');
    fireEvent.change(colorPicker, { target: { value: '#ff0000' } });
    expect(useCanvasStore.getState().strokeColor).toBe('#ff0000');
  });

  it('updates stroke width when slider changes', () => {
    render(<CanvasToolbar />);
    const slider = screen.getByTitle('Brush size');
    fireEvent.change(slider, { target: { value: '8' } });
    expect(useCanvasStore.getState().strokeWidth).toBe(8);
  });

  it('displays current stroke width value', () => {
    useCanvasStore.getState().setStrokeWidth(5);
    render(<CanvasToolbar />);
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
