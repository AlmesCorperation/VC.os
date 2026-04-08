import React, { useState, useEffect, MouseEvent } from 'react';
import { kernel } from '../services/kernel';

const ROWS = 16;
const COLS = 16;
const MINES = 40;

interface Cell {
  x: number;
  y: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

export const Minesweeper: React.FC = () => {
  const [grid, setGrid] = useState<Cell[][]>([]);
  const [gameOver, setGameOver] = useState(false);
  const [win, setWin] = useState(false);
  const [minesLeft, setMinesLeft] = useState(MINES);
  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [face, setFace] = useState('🙂'); // 🙂 😮 😎 😵

  // Initialize grid
  const initGrid = () => {
    const newGrid: Cell[][] = [];
    for (let y = 0; y < ROWS; y++) {
      const row: Cell[] = [];
      for (let x = 0; x < COLS; x++) {
        row.push({ x, y, isMine: false, isRevealed: false, isFlagged: false, neighborMines: 0 });
      }
      newGrid.push(row);
    }

    // Place mines
    let minesPlaced = 0;
    while (minesPlaced < MINES) {
      const x = Math.floor(Math.random() * COLS);
      const y = Math.floor(Math.random() * ROWS);
      if (!newGrid[y][x].isMine) {
        newGrid[y][x].isMine = true;
        minesPlaced++;
      }
    }

    // Calculate neighbors
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!newGrid[y][x].isMine) {
          let count = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const ny = y + dy;
              const nx = x + dx;
              if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS && newGrid[ny][nx].isMine) {
                count++;
              }
            }
          }
          newGrid[y][x].neighborMines = count;
        }
      }
    }

    setGrid(newGrid);
    setGameOver(false);
    setWin(false);
    setMinesLeft(MINES);
    setTime(0);
    setIsPlaying(false);
    setFace('🙂');
  };

  useEffect(() => {
    initGrid();
  }, []);

  useEffect(() => {
    let timer: any;
    if (isPlaying && !gameOver && !win) {
      timer = setInterval(() => setTime(t => Math.min(t + 1, 999)), 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, gameOver, win]);

  const revealCell = (x: number, y: number) => {
    if (gameOver || win || grid[y][x].isRevealed || grid[y][x].isFlagged) return;

    if (!isPlaying) setIsPlaying(true);

    const newGrid = [...grid.map(row => [...row])];
    
    if (newGrid[y][x].isMine) {
      // Game Over
      newGrid[y][x].isRevealed = true;
      setGrid(newGrid);
      setGameOver(true);
      setFace('😵');
      setIsPlaying(false);
      kernel.emitEvent('TASK', 'MINESWEEPER: GAME_OVER');
      return;
    }

    // Flood fill
    const stack = [{x, y}];
    while (stack.length > 0) {
      const curr = stack.pop()!;
      if (curr.y < 0 || curr.y >= ROWS || curr.x < 0 || curr.x >= COLS) continue;
      const cell = newGrid[curr.y][curr.x];
      if (cell.isRevealed || cell.isFlagged || cell.isMine) continue;

      cell.isRevealed = true;

      if (cell.neighborMines === 0) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            stack.push({x: curr.x + dx, y: curr.y + dy});
          }
        }
      }
    }

    setGrid(newGrid);

    // Check win
    let unrevealedSafe = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (!newGrid[r][c].isMine && !newGrid[r][c].isRevealed) unrevealedSafe++;
      }
    }
    if (unrevealedSafe === 0) {
      setWin(true);
      setFace('😎');
      setIsPlaying(false);
      setMinesLeft(0);
    }
  };

  const toggleFlag = (e: MouseEvent, x: number, y: number) => {
    e.preventDefault();
    if (gameOver || win || grid[y][x].isRevealed) return;

    const newGrid = [...grid.map(row => [...row])];
    const cell = newGrid[y][x];
    
    if (!cell.isFlagged && minesLeft > 0) {
      cell.isFlagged = true;
      setMinesLeft(m => m - 1);
    } else if (cell.isFlagged) {
      cell.isFlagged = false;
      setMinesLeft(m => m + 1);
    }
    setGrid(newGrid);
  };

  const getNumberColor = (n: number) => {
    const colors = ['', '#0000FA', '#4B802D', '#DB1300', '#202081', '#690400', '#008284', '#840084', '#000000'];
    return colors[n] || '#000';
  };

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#C0C0C0] p-4 select-none font-sans">
      <div className="bg-[#C0C0C0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#808080] p-2 inline-block">
        
        {/* Header */}
        <div className="flex justify-between items-center bg-[#C0C0C0] border-t-2 border-l-2 border-[#808080] border-b-2 border-r-2 border-white p-1 mb-2">
          <div className="bg-black text-red-500 font-mono text-xl px-1 w-12 text-right leading-none py-1">
            {minesLeft.toString().padStart(3, '0')}
          </div>
          <button 
            className="w-8 h-8 bg-[#C0C0C0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#808080] active:border-t-[#808080] active:border-l-[#808080] active:border-b-white active:border-r-white flex items-center justify-center text-xl"
            onClick={initGrid}
          >
            {face}
          </button>
          <div className="bg-black text-red-500 font-mono text-xl px-1 w-12 text-right leading-none py-1">
            {time.toString().padStart(3, '0')}
          </div>
        </div>

        {/* Grid */}
        <div className="bg-[#C0C0C0] border-t-2 border-l-2 border-[#808080] border-b-2 border-r-2 border-white">
          {grid.map((row, y) => (
            <div key={y} className="flex">
              {row.map((cell, x) => (
                <div
                  key={`${x}-${y}`}
                  onMouseDown={(e) => {
                    if (e.button === 0 && !cell.isRevealed && !cell.isFlagged && !gameOver && !win) setFace('😮');
                  }}
                  onMouseUp={(e) => {
                    if (e.button === 0 && !gameOver && !win) setFace('🙂');
                  }}
                  onMouseLeave={() => {
                    if (!gameOver && !win) setFace('🙂');
                  }}
                  onClick={() => revealCell(x, y)}
                  onContextMenu={(e) => toggleFlag(e, x, y)}
                  className={`w-5 h-5 flex items-center justify-center text-sm font-bold cursor-default
                    ${cell.isRevealed 
                      ? 'bg-[#C0C0C0] border border-[#808080] border-t-transparent border-l-transparent' 
                      : 'bg-[#C0C0C0] border-t-2 border-l-2 border-white border-b-2 border-r-2 border-[#808080] active:border-t-[#808080] active:border-l-[#808080] active:border-b-transparent active:border-r-transparent active:bg-[#C0C0C0]'
                    }
                    ${cell.isMine && cell.isRevealed ? 'bg-red-500' : ''}
                  `}
                >
                  {cell.isRevealed ? (
                    cell.isMine ? '💣' : (cell.neighborMines > 0 ? <span style={{color: getNumberColor(cell.neighborMines)}}>{cell.neighborMines}</span> : '')
                  ) : (
                    cell.isFlagged ? <span className="text-red-500">🚩</span> : ''
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>

      </div>
    </div>
  );
};
