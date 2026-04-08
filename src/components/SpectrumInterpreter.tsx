import React, { useState, useEffect, useRef } from 'react';
import { kernel } from '../services/kernel';

interface InterpreterProps {
  script: string;
  isPaused?: boolean;
  gameId?: string;
  isMultiplayer?: boolean;
}

export const SpectrumInterpreter: React.FC<InterpreterProps> = ({ script, isPaused, gameId, isMultiplayer }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [vars, setVars] = useState<Record<string, any>>({});
  const varsRef = useRef<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const clientId = useRef(Math.random().toString(36).slice(2));

  useEffect(() => {
    if (isMultiplayer && gameId) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = new WebSocket(`${protocol}//${window.location.host}`);
      socketRef.current = socket;

      socket.onopen = () => {
        socket.send(JSON.stringify({ type: 'join', gameId }));
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'sync' && message.sender !== clientId.current) {
          Object.assign(varsRef.current, message.state);
        }
      };

      return () => {
        socket.close();
      };
    }
  }, [isMultiplayer, gameId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const keysPressed = new Set<string>();

    const handleKeyDown = (e: KeyboardEvent) => keysPressed.add(e.key.toLowerCase());
    const handleKeyUp = (e: KeyboardEvent) => keysPressed.delete(e.key.toLowerCase());
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const lines = script.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

    const executeLine = (line: string, context: CanvasRenderingContext2D) => {
      const parts = line.split(/\s+/);
      const cmd = parts[0].toUpperCase();

      const resolve = (val: string): any => {
        if (typeof val !== 'string') return val;
        
        if (val === '$PID') return clientId.current;

        // Handle basic arithmetic like $X+1 or $X-1
        if (val.includes('+') || val.includes('-')) {
          const op = val.includes('+') ? '+' : '-';
          const [left, right] = val.split(op);
          const lVal = Number(resolve(left.trim()));
          const rVal = Number(resolve(right.trim()));
          return op === '+' ? lVal + rVal : lVal - rVal;
        }

        if (val.startsWith('$')) {
          const varName = val.slice(1);
          return varsRef.current[varName] ?? 0;
        }
        return isNaN(Number(val)) ? val : Number(val);
      };

      try {
        switch (cmd) {
          case 'VAR':
            varsRef.current[parts[1]] = resolve(parts[2]);
            break;
          case 'INC':
            varsRef.current[parts[1]] = (varsRef.current[parts[1]] ?? 0) + Number(resolve(parts[2]));
            break;
          case 'DEC':
            varsRef.current[parts[1]] = (varsRef.current[parts[1]] ?? 0) - Number(resolve(parts[2]));
            break;
          case 'BG':
            context.fillStyle = resolve(parts[1]) as string;
            context.fillRect(0, 0, canvas.width, canvas.height);
            break;
          case 'RECT':
            context.fillStyle = resolve(parts[5]) as string;
            context.fillRect(
              Number(resolve(parts[1])),
              Number(resolve(parts[2])),
              Number(resolve(parts[3])),
              Number(resolve(parts[4]))
            );
            break;
          case 'TEXT':
            context.fillStyle = resolve(parts[4]) as string;
            context.font = '10px monospace';
            context.fillText(parts.slice(3, -1).join(' ').replace(/"/g, ''), Number(resolve(parts[1])), Number(resolve(parts[2])));
            break;
          case 'IF_KEY': {
            const key = parts[1].toLowerCase();
            if (keysPressed.has(key)) {
              kernel.emitEvent('IRQ', `IRQ_0x21: SPECTRUM_KEY (${key})`);
              executeLine(parts.slice(2).join(' '), context);
            }
            break;
          }
          case 'IF_GT': {
            const val1 = Number(resolve(parts[1]));
            const val2 = Number(resolve(parts[2]));
            if (val1 > val2) {
              executeLine(parts.slice(3).join(' '), context);
            }
            break;
          }
          case 'IF_LT': {
            const val1 = Number(resolve(parts[1]));
            const val2 = Number(resolve(parts[2]));
            if (val1 < val2) {
              executeLine(parts.slice(3).join(' '), context);
            }
            break;
          }
          case 'IF_EQ': {
            const val1 = Number(resolve(parts[1]));
            const val2 = Number(resolve(parts[2]));
            if (val1 === val2) {
              executeLine(parts.slice(3).join(' '), context);
            }
            break;
          }
          case 'IF_COLLIDE': {
            const x1 = Number(resolve(parts[1]));
            const y1 = Number(resolve(parts[2]));
            const w1 = Number(resolve(parts[3]));
            const h1 = Number(resolve(parts[4]));
            const x2 = Number(resolve(parts[5]));
            const y2 = Number(resolve(parts[6]));
            const w2 = Number(resolve(parts[7]));
            const h2 = Number(resolve(parts[8]));
            
            if (x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2) {
              executeLine(parts.slice(9).join(' '), context);
            }
            break;
          }
          case 'SET': {
            varsRef.current[parts[1]] = resolve(parts[2]);
            break;
          }
          case 'GEN_GLITCH_MAP': {
            const level = Number(resolve(parts[1]));
            const map = [];
            for (let r = 0; r < 20; r++) {
              const row = [];
              for (let c = 0; c < 8; c++) {
                if (r === 19) {
                  row.push(1);
                } else if (r >= 4 && r % 4 === 0) {
                  let isSolid = Math.random() > 0.3 ? 1 : 0;
                  if (Math.random() < level * 0.05) isSolid = 1 - isSolid;
                  row.push(isSolid);
                } else {
                  let isSolid = 0;
                  if (Math.random() < level * 0.02) isSolid = 1;
                  row.push(isSolid);
                }
              }
              map.push(row);
            }
            // Clear spawn area
            map[15][0] = 0;
            map[14][0] = 0;
            map[16][0] = 0;
            // Clear goal area
            map[4][7] = 0;
            map[3][7] = 0;
            map[5][7] = 0;
            varsRef.current['_MAP'] = map;
            break;
          }
          case 'DRAW_GLITCH_MAP': {
            const map = varsRef.current['_MAP'];
            if (!map) break;
            const level = Number(resolve(parts[1]));
            context.fillStyle = level > 5 ? '#FF0055' : '#555555';
            for (let r = 0; r < 20; r++) {
              for (let c = 0; c < 8; c++) {
                if (map[r][c] === 1) {
                  const glitchX = (Math.random() < level * 0.01) ? (Math.random() * 4 - 2) : 0;
                  const glitchY = (Math.random() < level * 0.01) ? (Math.random() * 4 - 2) : 0;
                  context.fillRect(c * 40 + glitchX, r * 10 + glitchY, 40, 10);
                }
              }
            }
            break;
          }
          case 'COLLIDE_GLITCH_MAP': {
            const map = varsRef.current['_MAP'];
            if (!map) break;
            const xVar = parts[1];
            const yVar = parts[2];
            const w = Number(resolve(parts[3]));
            const h = Number(resolve(parts[4]));
            const vyVar = parts[5];
            const jumpVar = parts[6];
            const level = Number(resolve(parts[7])); // Pass level for physics glitches

            let px = Number(varsRef.current[xVar]);
            let py = Number(varsRef.current[yVar]);
            let pvy = Number(varsRef.current[vyVar]);

            let landed = false;
            for (let r = 0; r < 20; r++) {
              for (let c = 0; c < 8; c++) {
                if (map[r][c] === 1) {
                  const bx = c * 40;
                  const by = r * 10;
                  const bw = 40;
                  const bh = 10;

                  if (px < bx + bw && px + w > bx && py < by + bh && py + h > by) {
                    // Physics glitch: Sometimes ignore collision entirely at high levels
                    if (level > 10 && Math.random() < (level - 10) * 0.02) {
                      continue;
                    }

                    const overlapTop = (py + h) - by;
                    const overlapBottom = (by + bh) - py;
                    const overlapLeft = (px + w) - bx;
                    const overlapRight = (bx + bw) - px;

                    const minOverlap = Math.min(overlapTop, overlapBottom, overlapLeft, overlapRight);

                    if (minOverlap === overlapTop && pvy >= 0) {
                      py = by - h;
                      pvy = 0;
                      landed = true;
                      
                      // Physics glitch: Bouncy floor
                      if (level > 5 && Math.random() < (level - 5) * 0.05) {
                        pvy = -Math.random() * 10;
                        landed = false;
                      }
                    } else if (minOverlap === overlapBottom && pvy < 0) {
                      py = by + bh;
                      pvy = 0;
                    } else if (minOverlap === overlapLeft) {
                      px = bx - w;
                    } else if (minOverlap === overlapRight) {
                      px = bx + bw;
                    }
                  }
                }
              }
            }

            // Physics glitch: Random teleportation
            if (level > 15 && Math.random() < (level - 15) * 0.01) {
              px += (Math.random() * 40 - 20);
              py += (Math.random() * 40 - 20);
            }

            varsRef.current[xVar] = px;
            varsRef.current[yVar] = py;
            varsRef.current[vyVar] = pvy;
            if (landed) {
              varsRef.current[jumpVar] = 1;
            }
            break;
          }
        }
      } catch (e: any) {
        setError(e.message);
      }
    };

    const setupLines = lines.filter(l => !l.startsWith('LOOP'));
    const loopLines = lines.filter(l => l.startsWith('LOOP')).map(l => l.slice(5));

    // Run setup once
    setupLines.forEach(line => executeLine(line, ctx));

    const render = () => {
      if (isPaused) return;

      // Artificial CPU Lag
      const lag = Math.random() * 30; // 0-30ms lag per frame
      const start = performance.now();
      while (performance.now() - start < lag) {
        // Busy wait to simulate slow CPU
      }
      
      const prevState = JSON.stringify(varsRef.current);

      // Execute loop lines
      loopLines.forEach(line => executeLine(line, ctx));

      const currentState = JSON.stringify(varsRef.current);
      if (isMultiplayer && socketRef.current?.readyState === WebSocket.OPEN && prevState !== currentState) {
        socketRef.current.send(JSON.stringify({
          type: 'update',
          state: varsRef.current,
          sender: clientId.current
        }));
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [script, isPaused]);

  return (
    <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden border border-white/10">
      <canvas 
        ref={canvasRef} 
        width={320} 
        height={200} 
        className="w-full h-full image-pixelated"
        style={{ imageRendering: 'pixelated' }}
      />
      {error && (
        <div className="absolute top-0 left-0 right-0 bg-red-600 text-white text-[9px] p-1 font-mono">
          RUNTIME_ERROR: {error}
        </div>
      )}
      <div className="absolute bottom-1 right-1 text-[8px] text-white/20 font-mono">
        VC-SCRIPT_VM_v1
      </div>
    </div>
  );
};
