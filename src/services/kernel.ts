import { MemoryMap } from './memoryMap';

export type KernelEventType = 'IRQ' | 'SYSCALL' | 'MEM' | 'TASK' | 'CRITICAL' | 'ASM' | 'INT' | 'RING';

export enum CPURing {
  RING_0 = 0, // Kernel Mode
  RING_1 = 1, // Device Drivers (Simulated)
  RING_2 = 2, // Device Drivers (Simulated)
  RING_3 = 3  // User Mode
}

export interface KernelEvent {
  time: string;
  type: KernelEventType;
  message: string;
  vector?: number;
  ring?: CPURing;
}

export interface IDTEntry {
  vector: number;
  handler: string;
  description: string;
  count: number;
}

export interface RegisterState {
  EAX: string; EBX: string; ECX: string; EDX: string;
  ESI: string; EDI: string; ESP: string; EBP: string;
  EIP: string; EFLAGS: string;
}

class Kernel {
  private listeners: Set<() => void> = new Set();
  
  public events: KernelEvent[] = [];
  public cpuLoad: number[] = new Array(20).fill(0);
  public memUsage: number = 42;
  public idt: IDTEntry[] = [];
  public currentRing: CPURing = CPURing.RING_0;
  public registers: RegisterState = {
    EAX: '0x00000000', EBX: '0x00000000', ECX: '0x00000000', EDX: '0x00000000',
    ESI: '0x00000000', EDI: '0x00000000', ESP: '0xFFFF0000', EBP: '0xFFFF0000',
    EIP: '0x' + MemoryMap.KERNEL_CORE_START.toString(16).padStart(8, '0').toUpperCase(), EFLAGS: '0x00000202'
  };

  private interval: any;
  private isKernelCorrupted: boolean = false;
  public glitchLevel: number = 0;
  private onPanicCallback: ((reason: string) => void) | null = null;

  constructor() {
    this.initIDT();
    this.startSimulation();
  }

  private initIDT() {
    // Initialize 256 IDT entries
    const handlers = [
      { v: 0x00, h: 'DIV_BY_ZERO', d: 'Division by Zero Exception' },
      { v: 0x01, h: 'DEBUG', d: 'Debug Exception' },
      { v: 0x03, h: 'BREAKPOINT', d: 'Breakpoint Exception' },
      { v: 0x06, h: 'INVALID_OP', d: 'Invalid Opcode' },
      { v: 0x08, h: 'DOUBLE_FAULT', d: 'Double Fault' },
      { v: 0x0D, h: 'GP_FAULT', d: 'General Protection Fault' },
      { v: 0x0E, h: 'PAGE_FAULT', d: 'Page Fault' },
      { v: 0x20, h: 'TIMER', d: 'System Timer Tick' },
      { v: 0x21, h: 'KEYBOARD', d: 'Keyboard Input Event' },
      { v: 0x22, h: 'MOUSE', d: 'Mouse Pointer Event' },
      { v: 0x2E, h: 'DISK_IO', d: 'Disk Read/Write Operation' },
      { v: 0x80, h: 'SYSCALL', d: 'System Call (Legacy)' },
      { v: 0xBB, h: 'KERNEL_PANIC', d: 'Manual Kernel Panic Trigger' },
      { v: 0xCC, h: 'UI_EVENT', d: 'User Interface Interaction' },
      { v: 0xDD, h: 'AI_ACTION', d: 'AI Agent Autonomous Action' }
    ];

    for (let i = 0; i < 256; i++) {
      const handler = handlers.find(h => h.v === i);
      this.idt.push({
        vector: i,
        handler: handler ? handler.h : 'RESERVED',
        description: handler ? handler.d : 'Reserved for future use',
        count: 0
      });
    }
  }

  public triggerInterrupt(vector: number, message: string = '') {
    if (vector < 0 || vector > 255) return;
    
    const entry = this.idt[vector];
    entry.count++;
    
    // Interrupts usually cause a transition to Ring 0 (Kernel Mode)
    const previousRing = this.currentRing;
    if (this.currentRing !== CPURing.RING_0) {
      this.currentRing = CPURing.RING_0;
      this.emitEvent('RING', `PRIVILEGE_ESCALATION: RING_${previousRing} -> RING_0 (INT 0x${vector.toString(16).toUpperCase()})`);
    }

    this.emitEvent('INT', `INT 0x${vector.toString(16).toUpperCase()}: ${entry.handler} ${message}`, vector);
    
    // Simulate CPU "computing" the interrupt
    this.cpuLoad = [...this.cpuLoad.slice(1), Math.min(100, this.cpuLoad[this.cpuLoad.length - 1] + 2)];
    
    // Update registers to reflect "context switch"
    this.registers = {
      ...this.registers,
      EIP: `0x${(vector * 8).toString(16).padStart(8, '0').toUpperCase()}`,
      EAX: `0x${vector.toString(16).padStart(8, '0').toUpperCase()}`,
      EFLAGS: '0x' + (parseInt(this.registers.EFLAGS, 16) | 0x200).toString(16).padStart(8, '0').toUpperCase() // Set IF
    };

    if (entry.handler === 'KERNEL_PANIC') {
      this.panic(message || 'INTERRUPT_DRIVEN_PANIC');
    }

    // After handling, if it was a user-triggered interrupt, we might return to Ring 3
    // For this simulation, we'll stay in Ring 0 unless explicitly set back or via SYSCALL return
    this.notify();
  }

  public setRing(ring: CPURing) {
    if (this.currentRing === ring) return;
    const oldRing = this.currentRing;
    this.currentRing = ring;
    this.emitEvent('RING', `CPU_TRANSITION: RING_${oldRing} -> RING_${ring}`);
    this.notify();
  }

  public async syscall(name: string, params: any = {}) {
    // Transition to Ring 0
    const previousRing = this.currentRing;
    this.setRing(CPURing.RING_0);
    this.emitEvent('SYSCALL', `EXEC_SYSCALL: ${name}`);
    
    // Perform the privileged action
    if (name === 'SYS_MALLOC') {
      this.memUsage = Math.min(128, this.memUsage + (params.size || 0));
      this.emitEvent('MEM', `ALLOC_PAGE: ${(params.size || 0).toFixed(1)}MB`);
    } else if (name === 'SYS_FREE') {
      this.memUsage = Math.max(10, this.memUsage - (params.size || 0));
      this.emitEvent('MEM', `FREE_PAGE: ${(params.size || 0).toFixed(1)}MB`);
    }
    
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Return to previous ring
    this.setRing(previousRing);
    return { status: 'OK' };
  }

  public setOnPanic(callback: (reason: string) => void) {
    this.onPanicCallback = callback;
  }

  public onKernelUpdate(content: string): boolean {
    // Check for magic bytes and structure
    const hasMagic = content.includes('MAGIC: 0x56434F53');
    const hasEntry = content.includes('ENTRY: 0x00100000');
    const hasMain = content.includes('void kernel_main()');

    if (!hasMagic || !hasEntry || !hasMain) {
      this.isKernelCorrupted = true;
      this.emitEvent('CRITICAL', 'KERNEL_INTEGRITY_CHECK_FAILED');
      this.glitchLevel = 0.5;
      this.notify();
      
      // If severely corrupted, panic after a short delay to simulate "execution"
      setTimeout(() => {
        if (this.isKernelCorrupted) {
          this.glitchLevel = 1.0;
          this.notify();
          setTimeout(() => {
            if (this.isKernelCorrupted) {
              this.panic('KERNEL_IMAGE_CORRUPTED: INVALID_MAGIC_OR_ENTRY');
            }
          }, 1500);
        }
      }, 2000);
      return false;
    } else {
      this.isKernelCorrupted = false;
      this.glitchLevel = 0;
      this.emitEvent('SYSCALL', 'KERNEL_RELOADED_SUCCESSFULLY');
      this.notify();
      return true;
    }
  }

  public panic(reason: string) {
    this.emitEvent('CRITICAL', `KERNEL_PANIC: ${reason}`);
    if (this.onPanicCallback) {
      this.onPanicCallback(reason);
    }
  }

  public emitEvent(type: KernelEventType, message: string, vector?: number) {
    const newEvent: KernelEvent = {
      time: new Date().getTime().toString(16).slice(-6).toUpperCase(),
      type,
      message,
      vector,
      ring: this.currentRing
    };
    this.events = [...this.events.slice(-40), newEvent];
    this.notify();
  }

  public allocateMemory(mb: number) {
    if (this.currentRing !== CPURing.RING_0) {
      this.emitEvent('CRITICAL', `PRIVILEGE_VIOLATION: RING_${this.currentRing} ATTEMPTED MEM_ALLOC`);
      this.triggerInterrupt(0x0D, 'GP_FAULT: PRIVILEGED_INSTRUCTION_IN_USER_MODE');
      return;
    }
    this.memUsage = Math.min(128, this.memUsage + mb);
    this.emitEvent('MEM', `ALLOC_PAGE: ${mb.toFixed(1)}MB`);
    this.notify();
  }

  public freeMemory(mb: number) {
    if (this.currentRing !== CPURing.RING_0) {
      this.emitEvent('CRITICAL', `PRIVILEGE_VIOLATION: RING_${this.currentRing} ATTEMPTED MEM_FREE`);
      this.triggerInterrupt(0x0D, 'GP_FAULT: PRIVILEGED_INSTRUCTION_IN_USER_MODE');
      return;
    }
    this.memUsage = Math.max(10, this.memUsage - mb);
    this.emitEvent('MEM', `FREE_PAGE: ${mb.toFixed(1)}MB`);
    this.notify();
  }

  public executeTask(name: string, load: number) {
    this.emitEvent('TASK', `EXEC: ${name}`);
    this.cpuLoad = [...this.cpuLoad.slice(1), Math.min(100, this.cpuLoad[this.cpuLoad.length - 1] + load)];
    this.notify();
  }

  private startSimulation() {
    const messages = {
      IRQ: ['IRQ_0x20: TIMER_TICK', 'IRQ_0x21: KBD_EVENT', 'IRQ_0x2E: DISK_IO', 'IRQ_0x27: LPT_ACK'],
      SYSCALL: ['SYS_READ(0x3)', 'SYS_WRITE(0x1)', 'SYS_MALLOC(0x1000)', 'SYS_EXIT(0)', 'SYS_FORK()', 'SYS_EXECVE()'],
      MEM: [`PAGE_FAULT @ 0x${MemoryMap.IVT_START.toString(16).toUpperCase()}`, `COW_FAULT @ 0x${MemoryMap.SPECTRUM_UI_BUFFER.toString(16).toUpperCase()}`],
      TASK: ['SWITCH_TO: PID_1', 'FORK: PID_4', 'KILL: PID_3', 'YIELD: PID_2'],
      CRITICAL: ['KERNEL_PANIC: STACK_OVERFLOW', 'SEGFAULT: PID_5', 'DOUBLE_FAULT'],
      ASM: ['MOV EAX, 0x01', 'PUSH EBX', 'INT 0x80', `CALL 0x${MemoryMap.KERNEL_CORE_START.toString(16).toUpperCase()}`, 'RET', 'JMP SHORT 0x10', 'CMP EAX, 0x00', 'JZ 0x00100600']
    };

    this.interval = setInterval(() => {
      // CPU Load Simulation - drift towards 5-15% idle
      const currentLoad = this.cpuLoad[this.cpuLoad.length - 1];
      const targetLoad = 10;
      const drift = (targetLoad - currentLoad) * 0.1;
      const noise = (Math.random() - 0.5) * 15;
      this.cpuLoad = [...this.cpuLoad.slice(1), Math.max(0, Math.min(100, currentLoad + drift + noise))];
      
      // Memory Simulation - drift towards base OS usage
      const targetMem = 32;
      const memDrift = (targetMem - this.memUsage) * 0.1;
      const memNoise = (Math.random() - 0.5) * 2;
      this.memUsage = Math.max(10, Math.min(128, this.memUsage + memDrift + memNoise));

      // Random Events
      if (Math.random() > 0.3) {
        const types: KernelEventType[] = ['IRQ', 'SYSCALL', 'MEM', 'TASK', 'ASM'];
        const type = types[Math.floor(Math.random() * types.length)];
        const msg = messages[type as keyof typeof messages][Math.floor(Math.random() * messages[type as keyof typeof messages].length)];
        this.emitEvent(type, msg);
      }

      // Registers
      this.registers = {
        ...this.registers,
        EAX: '0x' + Math.floor(Math.random() * 0xFFFFFFFF).toString(16).padStart(8, '0').toUpperCase(),
        EIP: '0x' + (parseInt(this.registers.EIP, 16) + Math.floor(Math.random() * 0x100)).toString(16).padStart(8, '0').toUpperCase(),
        ESP: '0x' + (parseInt(this.registers.ESP, 16) - (Math.random() > 0.5 ? 4 : -4)).toString(16).padStart(8, '0').toUpperCase()
      };

      this.notify();
    }, 800);
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const kernel = new Kernel();
