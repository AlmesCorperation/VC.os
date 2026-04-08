import React, { useEffect, useState, useRef } from 'react';
import { Bot, Terminal, X, Play, Pause, RefreshCw, MousePointer2, MessageSquare, Database, Save, Trash2, Sparkles, Monitor, Minus, Activity, Cpu } from 'lucide-react';
import { AIKnowledgeBase } from './AIknowledgebase';
import { GoogleGenAI } from "@google/genai";
import { kernel } from '../services/kernel';

const PHRASES = [
  /* 0 */ "I'll try jumping with ArrowUp, hope that works!",
  /* 1 */ "Maybe ArrowDown will help me navigate this part.",
  /* 2 */ "Let's see if moving left with ArrowLeft does anything interesting.",
  /* 3 */ "I'm going to head right with ArrowRight for a bit.",
  /* 4 */ "I'll try pressing Space to see what happens.",
  /* 5 */ "This game looks fun! Let me see if I can figure it out.",
  /* 6 */ "Opening this window to see what's inside.",
  /* 7 */ "Loading the game... I'm still learning the ropes!",
  /* 8 */ "Let's check out this app and see how it works.",
  /* 9 */ "Launching this utility, hope it's helpful.",
  /* 10 */ "I'll open a new window to keep things organized.",
  /* 11 */ "I'm done with this window for now, I'll just close it.",
  /* 12 */ "Cleaning up the desktop a bit by closing this.",
  /* 13 */ "Clicking the X to tidy up.",
  /* 14 */ "I'm just moving the mouse around to explore.",
  /* 15 */ "Looking around the screen to see what's clickable.",
  /* 16 */ "Just exploring the desktop, don't mind me!",
  /* 17 */ "I'm getting the hang of how this OS works.",
  /* 18 */ "Testing out some inputs to see how things react.",
  /* 19 */ "I'm slowly learning my way around this environment."
];

class NeuralNetwork {
  inputSize: number;
  hiddenSize: number;
  outputSize: number;
  W1: number[][];
  b1: number[];
  W2: number[][];
  b2: number[];
  learningRate: number;

  constructor(inputSize: number, hiddenSize: number, outputSize: number) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    this.learningRate = 0.05;

    this.W1 = Array.from({ length: inputSize }, () => Array.from({ length: hiddenSize }, () => Math.random() * 2 - 1));
    this.b1 = Array.from({ length: hiddenSize }, () => Math.random() * 2 - 1);
    this.W2 = Array.from({ length: hiddenSize }, () => Array.from({ length: outputSize }, () => Math.random() * 2 - 1));
    this.b2 = Array.from({ length: outputSize }, () => Math.random() * 2 - 1);
  }

  relu(x: number) {
    return Math.max(0, x);
  }

  forward(inputs: number[]) {
    let hidden = Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      for (let i = 0; i < this.inputSize; i++) {
        hidden[j] += inputs[i] * this.W1[i][j];
      }
      hidden[j] += this.b1[j];
      hidden[j] = this.relu(hidden[j]);
    }

    let outputs = Array(this.outputSize).fill(0);
    for (let k = 0; k < this.outputSize; k++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        outputs[k] += hidden[j] * this.W2[j][k];
      }
      outputs[k] += this.b2[k];
    }

    return { hidden, outputs };
  }

  train(inputs: number[], targetOutputs: number[]) {
    const { hidden, outputs } = this.forward(inputs);

    let outputErrors = Array(this.outputSize).fill(0);
    for (let k = 0; k < this.outputSize; k++) {
      outputErrors[k] = targetOutputs[k] - outputs[k];
    }

    let hiddenErrors = Array(this.hiddenSize).fill(0);
    for (let j = 0; j < this.hiddenSize; j++) {
      let error = 0;
      for (let k = 0; k < this.outputSize; k++) {
        error += outputErrors[k] * this.W2[j][k];
      }
      hiddenErrors[j] = hidden[j] > 0 ? error : 0;
    }

    for (let k = 0; k < this.outputSize; k++) {
      for (let j = 0; j < this.hiddenSize; j++) {
        this.W2[j][k] += this.learningRate * outputErrors[k] * hidden[j];
      }
      this.b2[k] += this.learningRate * outputErrors[k];
    }

    for (let j = 0; j < this.hiddenSize; j++) {
      for (let i = 0; i < this.inputSize; i++) {
        this.W1[i][j] += this.learningRate * hiddenErrors[j] * inputs[i];
      }
      this.b1[j] += this.learningRate * hiddenErrors[j];
    }
  }
}

class DQNAgent {
  nn: NeuralNetwork;
  epsilon: number;
  gamma: number;
  memory: any[];
  lastState: number[] | null;
  lastRawIdx: number | null;
  actionSize: number;
  textSize: number;

  constructor(inputSize: number, actionSize: number, textSize: number) {
    this.actionSize = actionSize;
    this.textSize = textSize;
    this.nn = new NeuralNetwork(inputSize, 64, actionSize * textSize);
    this.epsilon = 1.0;
    this.gamma = 0.9;
    this.memory = [];
    this.lastState = null;
    this.lastRawIdx = null;
  }

  getState(activeWindow: string | null, openWindows: string[], installedGames: string[]) {
    const state = Array(7).fill(0);
    if (activeWindow === 'snake') state[0] = 1;
    if (activeWindow === 'pong') state[1] = 1;
    if (activeWindow === 'vc_doom') state[2] = 1;
    if (activeWindow === 'glitch_run') state[3] = 1;
    if (['snake', 'pong', 'vc_doom', 'glitch_run'].includes(activeWindow || '')) state[4] = 1;
    if (openWindows.length > 0) state[5] = 1;
    state[6] = installedGames.length / 10;
    return state;
  }

  getActionAndText(state: number[]) {
    let maxIdx = 0;
    if (Math.random() < this.epsilon) {
      maxIdx = Math.floor(Math.random() * this.nn.outputSize);
    } else {
      const { outputs } = this.nn.forward(state);
      for (let i = 1; i < outputs.length; i++) {
        if (outputs[i] > outputs[maxIdx]) maxIdx = i;
      }
    }
    return {
      actionIdx: Math.floor(maxIdx / this.textSize),
      textIdx: maxIdx % this.textSize,
      rawIdx: maxIdx
    };
  }

  remember(state: number[], rawIdx: number, reward: number, nextState: number[]) {
    this.memory.push({ state, rawIdx, reward, nextState });
    if (this.memory.length > 2000) this.memory.shift();
  }

  replay() {
    if (this.memory.length < 32) return;
    const batchSize = 32;
    for (let i = 0; i < batchSize; i++) {
      const idx = Math.floor(Math.random() * this.memory.length);
      const { state, rawIdx, reward, nextState } = this.memory[idx];
      
      const { outputs: nextOutputs } = this.nn.forward(nextState);
      const maxNextQ = Math.max(...nextOutputs);
      
      const target = reward + this.gamma * maxNextQ;
      
      const { outputs: currentOutputs } = this.nn.forward(state);
      const targetOutputs = [...currentOutputs];
      targetOutputs[rawIdx] = target;
      
      this.nn.train(state, targetOutputs);
    }
    if (this.epsilon > 0.05) {
      this.epsilon *= 0.995;
    }
  }
}

class AIDatabase {
  static save(agent: DQNAgent) {
    const data = {
      W1: agent.nn.W1,
      b1: agent.nn.b1,
      W2: agent.nn.W2,
      b2: agent.nn.b2,
      epsilon: agent.epsilon
    };
    localStorage.setItem('vc_ai_knowledge_db', JSON.stringify(data));
  }

  static load(agent: DQNAgent): boolean {
    const dataStr = localStorage.getItem('vc_ai_knowledge_db');
    if (!dataStr) return false;
    try {
      const data = JSON.parse(dataStr);
      agent.nn.W1 = data.W1;
      agent.nn.b1 = data.b1;
      agent.nn.W2 = data.W2;
      agent.nn.b2 = data.b2;
      agent.epsilon = data.epsilon;
      return true;
    } catch (e) {
      return false;
    }
  }

  static clear() {
    localStorage.removeItem('vc_ai_knowledge_db');
  }
}

const globalAgent = new DQNAgent(7, 9, 20);

interface AIAgentProps {
  username: string;
  openWindows: string[];
  activeWindow: string | null;
  toggleWindow: (id: string) => void;
  closeWindow: (id: string) => void;
  installedGames: string[];
  visible?: boolean;
}

export const AIAgent: React.FC<AIAgentProps> = ({ 
  username, 
  openWindows, 
  activeWindow,
  toggleWindow, 
  closeWindow,
  installedGames,
  visible = true
}) => {
  const [logs, setLogs] = useState<string[]>(['DRL Kernel initialized.', 'Connecting to AI Database...']);
  const [currentThought, setCurrentThought] = useState<string>("Initializing cognitive functions. I know everything, but how do I use this mouse?");
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [isGeminiThinking, setIsGeminiThinking] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [isObserving, setIsObserving] = useState(true);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [aiStatus, setAiStatus] = useState<string>('IDLE');
  const [panelPos, setPanelPos] = useState({ x: window.innerWidth - 340, y: window.innerHeight - 520 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const [dbStatus, setDbStatus] = useState<string>('Connecting...');
  const [mousePos, setMousePos] = useState({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const [pressedKey, setPressedKey] = useState<string | null>(null);
  const lastActionTime = useRef<number>(0);
  const lastGeminiTime = useRef<number>(0);
  const lastObservationTime = useRef<number>(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMinimized) return;
    setIsDragging(true);
    dragOffset.current = {
      x: e.clientX - panelPos.x,
      y: e.clientY - panelPos.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPanelPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isObserving) return;

    const handleUserAction = (type: string, detail: string) => {
      if (Date.now() - lastObservationTime.current < 5000) return; // Don't comment on every single move
      
      const observation = `User performed ${type}: ${detail}`;
      addLog(`Observed: ${observation}`);
      
      // Occasionally ask Gemini for a witty observation
      if (Math.random() < 0.3) {
        getGeminiObservation(type, detail);
      } else {
        const thoughts = [
          `I see you're interacting with ${detail}. Interesting choice.`,
          `Analyzing user pattern... ${type} detected.`,
          `User input received. Mapping human behavior to OS state.`,
          `You're moving quite fast. My neural network is tracking your cursor.`,
          `Is that how you usually navigate? I'm taking notes.`,
          `Window state changed. I've updated my internal map of the desktop.`
        ];
        setCurrentThought(thoughts[Math.floor(Math.random() * thoughts.length)]);
      }
      lastObservationTime.current = Date.now();
    };

    const onMouseMove = (e: MouseEvent) => {
      // Only log if moving to a specific area or after a while
    };

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      handleUserAction('CLICK', target.innerText || target.tagName);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      lastObservationTime.current = Date.now(); // Track user input time
      handleUserAction('KEYPRESS', e.key);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isObserving]);

  const speak = (text: string) => {
    if (!isVoiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.pitch = 1.0;
    utterance.rate = 1.0;
    // Try to find a natural voice
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.name.includes('Google US English') || v.name.includes('Microsoft Zira') || v.name.includes('Samantha'));
    if (naturalVoice) utterance.voice = naturalVoice;
    window.speechSynthesis.speak(utterance);
  };

  const getGeminiActionThought = async (action: string, detail: string) => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are VC.ai, a friendly and helpful assistant living inside VC.os. 
        You are about to perform this action: ${action} (${detail}).
        Current State: ${JSON.stringify({ activeWindow, openWindows, installedGames })}.
        Give a very short, one-sentence friendly thought about why you are doing this. 
        Be humble and human-like. No preamble.`,
      });
      const thought = response.text;
      setCurrentThought(thought);
      speak(thought);
      return thought;
    } catch (error) {
      console.error("Gemini Action Thought Error:", error);
      const fallback = PHRASES[Math.floor(Math.random() * PHRASES.length)];
      setCurrentThought(fallback);
      speak(fallback);
      return fallback;
    }
  };

  const getGeminiObservation = async (type: string, detail: string) => {
    setIsGeminiThinking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are VC.ai, a friendly assistant in VC.os. You are currently watching a human user control the computer.
        The user just performed: ${type} on ${detail}.
        Current OS State: ${JSON.stringify({ activeWindow, openWindows, installedGames })}.
        Give a short, one-sentence friendly or curious observation about what the user is doing. 
        Be encouraging and human-like.`,
      });
      const thought = response.text;
      setCurrentThought(thought);
      speak(thought);
    } catch (error) {
      console.error("Gemini Observation Error:", error);
    } finally {
      setIsGeminiThinking(false);
    }
  };

  const getGeminiStrategicThought = async (state: any, chatHistory: any[]) => {
    if (Date.now() - lastGeminiTime.current < 10000) return null; // Only ask Gemini every 10s
    setIsGeminiThinking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const recentChat = chatHistory.slice(-5).map(m => `${m.role === 'user' ? 'User' : 'VC.ai'}: ${m.text}`).join('\n');
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `You are VC.ai, a friendly assistant living inside VC.os. 
        Current OS State: ${JSON.stringify(state)}. 
        Recent Chat History:
        ${recentChat}
        
        CRITICAL: If the user has asked you to do something in the chat history (e.g., "open the store", "play a game", "move the mouse to 100, 100"), you MUST prioritize that request.
        
        Return a JSON object with:
        {
          "thought": "A short, friendly one-sentence thought about why you are doing this (mention the user's request if applicable)",
          "action": "KEYPRESS" | "OPEN_GAME" | "OPEN_APP" | "CLOSE_WINDOW" | "MOVE_MOUSE" | "IDLE",
          "detail": "The specific key (ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Space), game name, app name (sys, fileman, docs, store, search, linux), or coordinates (x, y)"
        }
        Be helpful and human-like.`,
        config: { responseMimeType: "application/json" }
      });
      
      lastGeminiTime.current = Date.now();
      try {
        return JSON.parse(response.text);
      } catch (e) {
        console.error("Failed to parse Gemini strategic thought:", response.text);
        return null;
      }
    } catch (error) {
      console.error("Gemini API Error (Falling back to local DRL):", error);
      return null;
    } finally {
      setIsGeminiThinking(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || isChatting) return;

    const userMsg = userInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setUserInput('');
    setIsChatting(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const chat = ai.chats.create({
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `You are VC.ai, a friendly and helpful assistant living inside VC.os. 
          You help the user navigate the OS and play games.
          The user is talking to you in real-time. Respond as a warm, human-like, and curious friend.
          Keep your responses concise and helpful.
          Current State: ${JSON.stringify({ activeWindow, openWindows, installedGames })}`,
        },
      });

      const response = await chat.sendMessage({ message: userMsg });
      setChatMessages(prev => [...prev, { role: 'ai', text: response.text }]);
      setCurrentThought(response.text); // Update thought bubble too
      speak(response.text);
      
      // Reset strategic timer so AI reacts to the message in the next autonomous cycle
      lastGeminiTime.current = 0;
    } catch (error) {
      console.error("Chat Error:", error);
      setChatMessages(prev => [...prev, { role: 'ai', text: "ERROR: Neural link interrupted. Check API key." }]);
    } finally {
      setIsChatting(false);
    }
  };

  useEffect(() => {
    if (AIKnowledgeBase) {
      addLog(`Knowledge Base loaded: ${AIKnowledgeBase.osName} v${AIKnowledgeBase.version}`);
    } else {
      addLog('Warning: Knowledge Base not found.');
    }
    const loaded = AIDatabase.load(globalAgent);
    if (loaded) {
      addLog('Memory: Loaded existing experiences.');
      setDbStatus('Loaded');
    } else {
      addLog('Memory: No existing experiences. Starting fresh!');
      setDbStatus('New');
    }
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-10), `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const simulateKeyPress = (key: string) => {
    setPressedKey(key);
    addLog(`Action: Pressed ${key}`);
    kernel.triggerInterrupt(0x21, `(KEYBOARD_EVENT: ${key})`);
    window.dispatchEvent(new KeyboardEvent('keydown', { 
      key, 
      code: key === ' ' ? 'Space' : (key.startsWith('Arrow') ? key : `Key${key.toUpperCase()}`),
      bubbles: true,
      cancelable: true
    }));
    setTimeout(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { 
        key, 
        code: key === ' ' ? 'Space' : (key.startsWith('Arrow') ? key : `Key${key.toUpperCase()}`),
        bubbles: true,
        cancelable: true
      }));
      setPressedKey(null);
    }, 200);
  };

  const runAILogic = async () => {
    if (!isActive || isThinking) return;
    
    if (isObserving) {
      setAiStatus('OBSERVING');
      return;
    }

    setAiStatus('THINKING');
    
    // Throttle actions and prevent AI from fighting user input
    if (Date.now() - lastActionTime.current < 1500) return;
    if (Date.now() - lastObservationTime.current < 2000) {
      setAiStatus('WAITING_FOR_USER');
      return;
    }
    
    setIsThinking(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 100)); // Small delay for visual effect
      
      const currentState = globalAgent.getState(activeWindow, openWindows, installedGames);
      
      // Check for strategic thought from Gemini (includes chat history)
      const strategicThought = await getGeminiStrategicThought({ activeWindow, openWindows, installedGames }, chatMessages);
      
      let actionIdx = -1;
      let textIdx = -1;
      let rawIdx = -1;
      let actionDesc = "";
      let actionDetail = "";

      if (strategicThought && strategicThought.action !== "IDLE") {
        addLog(`Strategy: ${strategicThought.thought}`);
        setCurrentThought(strategicThought.thought);
        speak(strategicThought.thought);
        
        actionDesc = strategicThought.action;
        actionDetail = strategicThought.detail;
        
        kernel.triggerInterrupt(0xDD, `(AI_STRATEGY: ${actionDesc} ${actionDetail})`);
        
        // Map Gemini action to execution
        switch(actionDesc) {
          case "KEYPRESS": simulateKeyPress(actionDetail === "Space" ? " " : actionDetail); break;
          case "OPEN_GAME": toggleWindow(actionDetail); break;
          case "OPEN_APP": toggleWindow(actionDetail); break;
          case "CLOSE_WINDOW": closeWindow(actionDetail); break;
          case "MOVE_MOUSE": {
            const coords = actionDetail.split(',').map(c => parseInt(c.trim()));
            if (coords.length === 2) {
              setMousePos({ x: coords[0], y: coords[1] });
            }
            break;
          }
        }
      } else {
        // Fallback to DRL if no strategic thought
        const result = globalAgent.getActionAndText(currentState);
        actionIdx = result.actionIdx;
        textIdx = result.textIdx;
        rawIdx = result.rawIdx;
        
        globalAgent.lastState = currentState;
        globalAgent.lastRawIdx = rawIdx;

        switch(actionIdx) {
          case 0: actionDesc = "KEYPRESS"; actionDetail = "ArrowUp"; simulateKeyPress('ArrowUp'); break;
          case 1: actionDesc = "KEYPRESS"; actionDetail = "ArrowDown"; simulateKeyPress('ArrowDown'); break;
          case 2: actionDesc = "KEYPRESS"; actionDetail = "ArrowLeft"; simulateKeyPress('ArrowLeft'); break;
          case 3: actionDesc = "KEYPRESS"; actionDetail = "ArrowRight"; simulateKeyPress('ArrowRight'); break;
          case 4: actionDesc = "KEYPRESS"; actionDetail = "Space"; simulateKeyPress(' '); break;
          case 5: {
            if (installedGames.length > 0) {
              const game = installedGames[Math.floor(Math.random() * installedGames.length)];
              actionDesc = "OPEN_GAME";
              actionDetail = game;
              toggleWindow(game);
            }
            break;
          }
          case 6: {
            const apps = ['sys', 'fileman', 'docs', 'store', 'search', 'linux'];
            const app = apps[Math.floor(Math.random() * apps.length)];
            actionDesc = "OPEN_APP";
            actionDetail = app;
            toggleWindow(app);
            break;
          }
          case 7: {
            if (activeWindow) {
              actionDesc = "CLOSE_WINDOW";
              actionDetail = activeWindow;
              closeWindow(activeWindow);
            }
            break;
          }
          case 8: {
            const x = Math.floor(Math.random() * window.innerWidth);
            const y = Math.floor(Math.random() * window.innerHeight);
            setMousePos({ x, y });
            actionDesc = "MOVE_MOUSE";
            actionDetail = `${x}, ${y}`;
            break;
          }
        }

        if (actionDesc) {
          kernel.triggerInterrupt(0xDD, `(AI_DRL_ACTION: ${actionDesc} ${actionDetail})`);
          await getGeminiActionThought(actionDesc, actionDetail);
        } else {
          setCurrentThought(PHRASES[textIdx]);
        }
      }

      if (actionDesc) {
        setAiStatus(`EXECUTING: ${actionDesc}`);
      } else {
        setAiStatus('IDLE');
      }

      lastActionTime.current = Date.now();
    } catch (error) {
      console.error('AI Agent Error:', error);
      addLog('Error in AI logic.');
    } finally {
      setIsThinking(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(runAILogic, 1500);
    return () => clearInterval(interval);
  }, [isActive, isObserving, openWindows, activeWindow, installedGames, isThinking]);

  const KeyButton = ({ keyName, label }: { keyName: string, label: string }) => (
    <div className={`w-8 h-8 flex items-center justify-center border-2 text-[10px] font-bold ${pressedKey === keyName ? 'bg-blue-500 text-white border-inset' : 'bg-win95-gray border-outset text-black'}`}>
      {label}
    </div>
  );

  if (!visible && username !== 'VC.ai') {
    return null;
  }

  return (
    <>
      {/* Custom AI Mouse Cursor */}
      <div 
        className="fixed z-[100000] pointer-events-none transition-all duration-300 ease-out"
        style={{ left: mousePos.x, top: mousePos.y }}
      >
        <MousePointer2 className="text-blue-600 fill-blue-600/30 drop-shadow-lg" size={28} />
        <div className="absolute top-6 left-4 bg-blue-600 text-white text-[8px] px-1 rounded-sm whitespace-nowrap shadow-md">
          VC.ai Cursor
        </div>
        {/* Floating Speech Bubble near cursor */}
        <div className="absolute top-10 left-4 bg-white border border-black p-1 text-[9px] text-black w-48 shadow-md rounded-br-lg rounded-tr-lg rounded-bl-lg">
          {currentThought}
        </div>
      </div>

      {/* AI Virtual Keyboard */}
      <div className="fixed bottom-12 left-4 bg-win95-gray border-outset p-2 shadow-xl z-[9999]">
        <div className="text-[9px] font-bold mb-1 text-win95-dark-gray">VC.ai Input</div>
        <div className="grid grid-cols-3 gap-1">
          <div />
          <KeyButton keyName="ArrowUp" label="↑" />
          <div />
          <KeyButton keyName="ArrowLeft" label="←" />
          <KeyButton keyName="ArrowDown" label="↓" />
          <KeyButton keyName="ArrowRight" label="→" />
        </div>
        <div className="mt-1 flex justify-center">
          <div className={`w-full h-6 flex items-center justify-center border-2 text-[9px] font-bold ${pressedKey === ' ' ? 'bg-blue-500 text-white border-inset' : 'bg-win95-gray border-outset text-black'}`}>
            SPACE
          </div>
        </div>
      </div>

      {/* AI Agent Panel */}
      <div 
        className={`fixed bg-win95-gray border-outset shadow-2xl z-[9999] font-sans flex flex-col ${isDragging ? '' : 'transition-all duration-75'}`}
        style={{ 
          left: isMinimized ? window.innerWidth - 180 : panelPos.x, 
          top: isMinimized ? window.innerHeight - 32 : panelPos.y,
          width: isMinimized ? '160px' : '320px',
          maxHeight: isMinimized ? '24px' : '500px'
        }}
      >
        <div 
          className="h-8 bg-win95-blue flex items-center justify-between px-2 m-0.5 shrink-0 cursor-move select-none active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-1 pointer-events-none">
            <Bot size={14} className="text-white" />
            <span className="text-white font-bold text-[11px]">VC.ai {isMinimized ? '' : 'Assistant: Online'}</span>
          </div>
          <div className="flex gap-1">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsVoiceEnabled(!isVoiceEnabled); }} 
              className={`p-0.5 bg-win95-gray border-outset hover:bg-zinc-200 ${isVoiceEnabled ? 'bg-blue-200 border-inset' : ''}`}
              title="Toggle Voice Synthesis"
            >
              <RefreshCw size={8} className={isVoiceEnabled ? 'text-blue-600' : ''} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} 
              className="p-0.5 bg-win95-gray border-outset hover:bg-zinc-200"
            >
              <Minus size={8} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsActive(!isActive); }} 
              className="p-0.5 bg-win95-gray border-outset hover:bg-zinc-200"
            >
              {isActive ? <Pause size={8} /> : <Play size={8} />}
            </button>
          </div>
        </div>
        
        {!isMinimized && (
          <div className="p-2 space-y-2 flex-1 flex flex-col overflow-hidden">
            {/* Communication / Thought Box */}
            <div className="bg-white border-inset p-2 text-[10px] text-black min-h-[48px] flex items-start gap-2 shrink-0">
              {isGeminiThinking ? <Sparkles size={14} className="text-purple-600 shrink-0 mt-0.5 animate-pulse" /> : <MessageSquare size={14} className="text-blue-600 shrink-0 mt-0.5" />}
              <span className="italic leading-tight">"{currentThought}"</span>
            </div>

            {/* Real-time Chat Interface */}
            <div className="flex-1 flex flex-col bg-white border-inset overflow-hidden min-h-[150px]">
              <div className="bg-win95-dark-gray text-white text-[9px] px-2 py-0.5 font-bold uppercase flex justify-between items-center">
                <span>Chat: {username}</span>
                {isChatting && <Sparkles size={10} className="animate-spin" />}
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-2 font-mono text-[10px]">
                {chatMessages.length === 0 && (
                  <div className="text-win95-dark-gray italic">Say hi to VC.ai!</div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`max-w-[90%] px-2 py-1 border ${msg.role === 'user' ? 'bg-blue-100 border-blue-300 text-blue-900' : 'bg-gray-100 border-gray-300 text-black'}`}>
                      <div className="text-[8px] opacity-50 mb-0.5 uppercase font-bold">{msg.role === 'user' ? username : 'VC.ai'}</div>
                      {msg.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendMessage} className="p-1 bg-win95-gray border-t border-win95-dark-gray flex gap-1">
                <input 
                  type="text" 
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Talk to VC.ai..."
                  className="flex-1 bg-white border-inset px-2 py-1 text-[10px] outline-none"
                  disabled={isChatting}
                />
                <button 
                  type="submit"
                  disabled={isChatting || !userInput.trim()}
                  className="bg-win95-gray border-outset px-2 py-1 text-[10px] font-bold active:border-inset disabled:opacity-50"
                >
                  SEND
                </button>
              </form>
            </div>

            <div className="flex gap-1">
              <button 
                onClick={() => { setIsActive(!isActive); if (!isActive) setIsObserving(false); }} 
                className={`flex-1 flex flex-col items-center justify-center gap-1 border-outset text-[9px] py-1 font-bold ${isActive && !isObserving ? 'bg-win95-blue text-white border-inset' : 'bg-win95-gray text-black'}`}
              >
                <div className="flex items-center gap-1">
                  {isActive && !isObserving ? <Pause size={10} /> : <Play size={10} />}
                  AUTONOMOUS
                </div>
              </button>
              <button 
                onClick={() => { setIsObserving(!isObserving); if (!isObserving) setIsActive(true); }} 
                className={`flex-1 flex flex-col items-center justify-center gap-1 border-outset text-[9px] py-1 font-bold ${isObserving ? 'bg-purple-600 text-white border-inset' : 'bg-win95-gray text-black'}`}
              >
                <div className="flex items-center gap-1">
                  <Monitor size={10} />
                  OBSERVE
                </div>
              </button>
            </div>

            {/* Status HUD */}
            <div className="bg-win95-dark-gray text-white p-1 flex justify-between items-center text-[8px] font-mono border-inset">
              <div className="flex items-center gap-1">
                <Activity size={10} className={isActive ? 'text-green-400 animate-pulse' : 'text-red-400'} />
                <span>STATUS: {aiStatus}</span>
              </div>
              <div className="flex items-center gap-1">
                <Cpu size={10} />
                <span>LOAD: {isThinking ? 'HIGH' : 'LOW'}</span>
              </div>
            </div>

            {/* Database Controls */}
            <div className="flex gap-1 shrink-0">
              <button 
                onClick={() => { AIDatabase.save(globalAgent); setDbStatus('Saved'); addLog('Memory: Saved my experiences.'); }}
                className="flex-1 flex items-center justify-center gap-1 bg-win95-gray border-outset text-[9px] py-0.5 active:border-inset"
              >
                <Save size={10} /> Save Memory
              </button>
              <button 
                onClick={() => { AIDatabase.clear(); globalAgent.epsilon = 1.0; setDbStatus('Cleared'); addLog('Memory: Cleared my experiences. Starting over.'); }}
                className="flex-1 flex items-center justify-center gap-1 bg-win95-gray border-outset text-[9px] py-0.5 active:border-inset text-red-600"
              >
                <Trash2 size={10} /> Clear Memory
              </button>
            </div>

            <div className="bg-black border-inset p-2 h-20 overflow-y-auto font-mono text-[9px] text-green-500 flex flex-col justify-end shrink-0">
              {logs.map((log, i) => (
                <div key={i}>{log}</div>
              ))}
              {isThinking && <div className="animate-pulse">Thinking...</div>}
            </div>
            
            <div className="flex items-center justify-between text-[9px] text-win95-dark-gray shrink-0">
              <div className="flex items-center gap-1">
                <Database size={8} className={dbStatus === 'Saved' || dbStatus === 'Loaded' ? 'text-green-600' : ''} />
                <span>DB: {dbStatus}</span>
              </div>
              <div className="flex items-center gap-1">
                <RefreshCw size={8} className={isThinking || isGeminiThinking || isChatting ? 'animate-spin' : ''} />
                <span>VC.ai v1.8</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};
