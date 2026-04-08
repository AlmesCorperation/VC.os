import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SPECTRUM_GRADIENT } from '../constants';
import { kernel } from '../services/kernel';

const GRID_SIZE = 20;
const INITIAL_SNAKE = [{ x: 10, y: 10 }];
const INITIAL_DIRECTION = { x: 1, y: 0 };

export const SnakeGame: React.FC = () => {
  const [snake, setSnake] = useState(INITIAL_SNAKE);
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [direction, setDirection] = useState(INITIAL_DIRECTION);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const gameRef = useRef<HTMLDivElement>(null);

  const moveSnake = useCallback(() => {
    if (gameOver) return;

    setSnake((prevSnake) => {
      const head = prevSnake[0];
      const newHead = {
        x: (head.x + direction.x + GRID_SIZE) % GRID_SIZE,
        y: (head.y + direction.y + GRID_SIZE) % GRID_SIZE,
      };

      // Check collision with self
      if (prevSnake.some((segment) => segment.x === newHead.x && segment.y === newHead.y)) {
        setGameOver(true);
        kernel.emitEvent('TASK', 'SNAKE: GAME_OVER');
        return prevSnake;
      }

      const newSnake = [newHead, ...prevSnake];

      // Check food
      if (newHead.x === food.x && newHead.y === food.y) {
        setScore((s) => s + 1);
        kernel.emitEvent('TASK', 'SNAKE: ATE_FOOD');
        setFood({
          x: Math.floor(Math.random() * GRID_SIZE),
          y: Math.floor(Math.random() * GRID_SIZE),
        });
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, food, gameOver]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      switch (e.key) {
        case 'ArrowUp': if (direction.y === 0) setDirection({ x: 0, y: -1 }); break;
        case 'ArrowDown': if (direction.y === 0) setDirection({ x: 0, y: 1 }); break;
        case 'ArrowLeft': if (direction.x === 0) setDirection({ x: -1, y: 0 }); break;
        case 'ArrowRight': if (direction.x === 0) setDirection({ x: 1, y: 0 }); break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Artificial Lag: Random jitter added to base interval
    const baseInterval = 200; // Slower base speed
    const jitter = Math.random() * 100; // Random lag spike
    const interval = setInterval(moveSnake, baseInterval + jitter);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearInterval(interval);
    };
  }, [moveSnake, direction]);

  const resetGame = () => {
    setSnake(INITIAL_SNAKE);
    setDirection(INITIAL_DIRECTION);
    setGameOver(false);
    setScore(0);
  };

  return (
    <div className="h-full flex flex-col font-mono bg-black text-white p-2" ref={gameRef}>
      <div className="flex justify-between text-[10px] mb-2">
        <span>SNAKE_PROC_ID: 0x42</span>
        <span>SCORE: {score.toString().padStart(4, '0')}</span>
      </div>
      
      <div className="flex-1 relative border border-white/20 bg-zinc-900">
        <div 
          className="absolute inset-0 grid" 
          style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)`, gridTemplateRows: `repeat(${GRID_SIZE}, 1fr)` }}
        >
          {snake.map((segment, i) => (
            <div
              key={i}
              className="border-[0.5px] border-black/20"
              style={{ 
                gridColumnStart: segment.x + 1, 
                gridRowStart: segment.y + 1,
                backgroundColor: SPECTRUM_GRADIENT[i % SPECTRUM_GRADIENT.length]
              }}
            />
          ))}
          <div
            className="bg-white animate-pulse"
            style={{ 
              gridColumnStart: food.x + 1, 
              gridRowStart: food.y + 1 
            }}
          />
        </div>

        {gameOver && (
          <div className="absolute inset-0 bg-red-600/80 flex flex-col items-center justify-center text-center p-4">
            <div className="text-xl font-bold mb-2">SEGMENTATION_FAULT</div>
            <div className="text-[10px] mb-4">SNAKE_COLLISION_DETECTED</div>
            <button 
              onClick={resetGame}
              className="border-2 border-white px-4 py-1 hover:bg-white hover:text-red-600 transition-all text-[12px]"
            >
              RETRY_EXEC
            </button>
          </div>
        )}
      </div>
      <div className="text-[9px] mt-2 opacity-50">USE_ARROW_KEYS_TO_STEER</div>
    </div>
  );
};
