import { kernel } from './kernel';

export interface VFSFile {
  name: string;
  content: string;
  type: 'file' | 'dir';
  isCritical?: boolean;
  isCorrupted?: boolean;
}

export const INITIAL_VFS: Record<string, VFSFile> = {
  'kernel.sys': {
    name: 'kernel.sys',
    type: 'file',
    isCritical: true,
    content: `[VC.OS KERNEL v1.2.0]
MAGIC: 0x56434F53
ENTRY: 0x00100000
FLAGS: 0x00000001
---
void kernel_main() {
    init_vga();
    init_gdt();
    init_idt();
    while(1) {
        asm("hlt");
    }
}`
  },
  'boot.s': {
    name: 'boot.s',
    type: 'file',
    isCritical: true,
    content: `/* boot.s - Almes Corp Multiboot2 Entry */
.set MAGIC,    0xE85250D6
.set ARCH,     0
.set LENGTH,   (multiboot_header_end - multiboot_header)
.set CHECKSUM, -(MAGIC + ARCH + LENGTH)

.section .multiboot
.align 8
multiboot_header:
    .long MAGIC
    .long ARCH
    .long LENGTH
    .long CHECKSUM
    .short 0, 0
    .long 8
multiboot_header_end:

.section .bss
.align 16
stack_bottom: .skip 16384
stack_top:

.section .text
.global _start
_start:
    mov $stack_top, %esp
    cli
    call kernel_main
hang:
    hlt
    jmp hang`
  },
  'kernel.cpp': {
    name: 'kernel.cpp',
    type: 'file',
    isCritical: true,
    content: `/* kernel.cpp - Almes Corp Bare Metal Core */
#include <stdint.h>

extern "C" void init_gdt();
extern "C" void init_idt();

static short* const vga_buffer = (short*)0xB8000;
static const unsigned char vcos_color = 0x0D; 

void terminal_put_char(char c, int x, int y) {
    const int index = y * 80 + x;
    vga_buffer[index] = (vcos_color << 8) | c;
}

extern "C" void kernel_main() {
    asm volatile("cli");
    
    // Initialize Core Systems
    init_gdt();
    init_idt();

    for (int i = 0; i < 80 * 25; i++) vga_buffer[i] = (vcos_color << 8) | ' ';
    const char* msg = "ALMES CORP - VC.os v1.2.0 [BARE METAL BOOT]";
    for (int i = 0; msg[i] != '\\0'; i++) terminal_put_char(msg[i], i, 0);
    
    while (1) asm volatile("hlt");
}`
  },
  'linker.ld': {
    name: 'linker.ld',
    type: 'file',
    isCritical: true,
    content: `/* linker.ld - Almes Corp Linker Script */
ENTRY(_start)
SECTIONS {
    . = 1M;
    .text : { *(.multiboot) *(.text) }
    .rodata : { *(.rodata) }
    .data : { *(.data) }
    .bss : { *(COMMON) *(.bss) }
}`
  },
  'readme.txt': {
    name: 'readme.txt',
    type: 'file',
    content: 'VC.os v1.0.4\n(c) 2026 Keo Doolish\n\nVC.os stands for Vibe code.operating system.\nThe code is completely made by AI.\n\nWelcome to the Spectrum Gradient.\n\n--- NEW IN VC.linux ---\nNative support for .tar.xz archives is now active.\n\nVISUAL INSTALLER:\nOpen VC.linux and click "Software Center" to import and install software visually.\n\nCOMMAND LINE:\n1. wget <url>\n2. tar -xvf Downloads/<file>.tar.xz\n3. ./<folder>/<binary>'
  },
  'sys_logs.dat': {
    name: 'sys_logs.dat',
    type: 'file',
    isCritical: true,
    content: 'BOOT_OK\nMEM_CHECK_PASS\nIRQ_INIT_0x20\nCRASH_PREVENT_OFF'
  },
  'memory_map.h': {
    name: 'memory_map.h',
    type: 'file',
    isCritical: true,
    content: `#ifndef ALMES_MEMORY_MAP_H
#define ALMES_MEMORY_MAP_H

#include <stdint.h>

/**
 * VC.os MEMORY MAPPING PROFILE (v1.0.4)
 * This file is the "Law of the Land" for AI-driven memory management.
 * DO NOT modify these addresses without a full system re-index.
 */

namespace Almes {

    // --- CRITICAL SYSTEM ZONES (READ-ONLY/LOCKED) ---
    const uintptr_t IVT_START          = 0x00000000; // Interrupt Vector Table
    const uintptr_t BDA_START          = 0x00000400; // BIOS Data Area
    const uintptr_t BOOTLOADER_ENTRY   = 0x00007C00; // Entry point for .asm
    const uintptr_t KERNEL_CORE_START  = 0x00100000; // The Heart of VC.os

    // --- VISUAL & UI ZONES (WRITE-ONLY/RW) ---
    const uintptr_t VGA_BUFFER_START   = 0x000B8000; // Text Mode / RSOD Logic
    const uintptr_t SPECTRUM_UI_BUFFER = 0x01000000; // React/TSX Visual Layers

    // --- APPLICATION & ENGINE HEAPS ---
    const uintptr_t VC_ENGINE_HEAP     = 0x20000000; // 3D Data & Asset Pipeline
    const uintptr_t VC_STORE_HEAP      = 0x40000000; // Dynamic App Allocation
    const uintptr_t VC_LINUX_BRIDGE    = 0x80000000; // Virtualized Subsystem

    /**
     * @brief Check if a memory address is safe for AI-writing.
     * @return true if the address is in a RW (Read-Write) zone.
     */
    inline bool is_safe_zone(uintptr_t address) {
        if (address >= SPECTRUM_UI_BUFFER && address < 0xFFFFFFFF) {
            return true; // Safe for UI and Engine operations
        }
        return false; // Potentially triggers RSOD (Kernel/BIOS Protection)
    }

} // namespace Almes

#endif // ALMES_MEMORY_MAP_H`
  },
  'Makefile': {
    name: 'Makefile',
    type: 'file',
    content: `# VC.os Bare-metal Makefile
CC = i686-elf-gcc
AS = i686-elf-as
LD = i686-elf-ld

CFLAGS = -std=gnu99 -ffreestanding -O2 -Wall -Wextra
LDFLAGS = -ffreestanding -O2 -nostdlib -lgcc

OBJ = boot.o kernel.o gdt.o idt.o

all: kernel.bin

kernel.bin: $(OBJ)
	$(CC) -T linker.ld -o $@ $(LDFLAGS) $(OBJ)

%.o: %.cpp
	$(CC) -c $< -o $@ $(CFLAGS)

%.o: %.s
	$(AS) $< -o $@

clean:
	rm -f *.o kernel.bin`
  },
  'gdt.cpp': {
    name: 'gdt.cpp',
    type: 'file',
    content: `/* gdt.cpp - Global Descriptor Table Implementation */
#include <stdint.h>

struct gdt_entry_struct {
    uint16_t limit_low;
    uint16_t base_low;
    uint8_t  base_middle;
    uint8_t  access;
    uint8_t  granularity;
    uint8_t  base_high;
} __attribute__((packed));

struct gdt_ptr_struct {
    uint16_t limit;
    uint32_t base;
} __attribute__((packed));

gdt_entry_struct gdt_entries[5];
gdt_ptr_struct   gdt_ptr;

extern "C" void gdt_flush(uint32_t);

void gdt_set_gate(int32_t num, uint32_t base, uint32_t limit, uint8_t access, uint8_t gran) {
    gdt_entries[num].base_low    = (base & 0xFFFF);
    gdt_entries[num].base_middle = (base >> 16) & 0xFF;
    gdt_entries[num].base_high   = (base >> 24) & 0xFF;

    gdt_entries[num].limit_low   = (limit & 0xFFFF);
    gdt_entries[num].granularity = (limit >> 16) & 0x0F;

    gdt_entries[num].granularity |= gran & 0xF0;
    gdt_entries[num].access      = access;
}

void init_gdt() {
    gdt_ptr.limit = (sizeof(gdt_entry_struct) * 5) - 1;
    gdt_ptr.base  = (uint32_t)&gdt_entries;

    gdt_set_gate(0, 0, 0, 0, 0);                // Null segment
    gdt_set_gate(1, 0, 0xFFFFFFFF, 0x9A, 0xCF); // Code segment
    gdt_set_gate(2, 0, 0xFFFFFFFF, 0x92, 0xCF); // Data segment
    gdt_set_gate(3, 0, 0xFFFFFFFF, 0xFA, 0xCF); // User mode code segment
    gdt_set_gate(4, 0, 0xFFFFFFFF, 0xF2, 0xCF); // User mode data segment

    gdt_flush((uint32_t)&gdt_ptr);
}`
  },
  'idt.cpp': {
    name: 'idt.cpp',
    type: 'file',
    content: `/* idt.cpp - Interrupt Descriptor Table Implementation */
#include <stdint.h>

struct idt_entry_struct {
    uint16_t base_lo;
    uint16_t sel;
    uint8_t  always0;
    uint8_t  flags;
    uint16_t base_hi;
} __attribute__((packed));

struct idt_ptr_struct {
    uint16_t limit;
    uint32_t base;
} __attribute__((packed));

idt_entry_struct idt_entries[256];
idt_ptr_struct   idt_ptr;

void idt_set_gate(uint8_t num, uint32_t base, uint16_t sel, uint8_t flags) {
    idt_entries[num].base_lo = base & 0xFFFF;
    idt_entries[num].base_hi = (base >> 16) & 0xFFFF;
    idt_entries[num].sel     = sel;
    idt_entries[num].always0 = 0;
    idt_entries[num].flags   = flags;
}

void init_idt() {
    idt_ptr.limit = sizeof(idt_entry_struct) * 256 - 1;
    idt_ptr.base  = (uint32_t)&idt_entries;

    // Zero out the IDT
    for(int i = 0; i < 256; i++) {
        idt_set_gate(i, 0, 0, 0);
    }

    // Load IDT (simulated)
    // asm volatile("lidt (%0)" : : "r" (&idt_ptr));
}`
  }
};

export class VirtualFileSystem {
  private files: Record<string, VFSFile> = { ...INITIAL_VFS };
  private readonly MAX_MEMORY = 1024 * 1024 * 1024; // 1 GB in bytes
  private readonly MAX_FILE_SIZE = 512 * 1024 * 1024; // 512 MB limit per file

  getUsedMemory() {
    return Object.values(this.files).reduce((acc, file) => acc + (file.content?.length || 0), 0);
  }

  getFreeMemory() {
    return this.MAX_MEMORY - this.getUsedMemory();
  }

  ls() {
    return Object.keys(this.files);
  }

  make() {
    kernel.emitEvent('TASK', 'MAKE: STARTING_BUILD');
    const files = this.ls();
    const sourceFiles = files.filter(f => f.endsWith('.cpp') || f.endsWith('.s'));
    
    kernel.emitEvent('TASK', `MAKE: COMPILING ${sourceFiles.length} FILES...`);
    
    // Simulate compilation steps
    sourceFiles.forEach(f => {
      kernel.emitEvent('TASK', `CC -c ${f} -o ${f.replace(/\.(cpp|s)$/, '.o')}`);
    });

    const kernelBinContent = `[VC.os KERNEL BINARY]
TYPE: MULTIBOOT2_ELF
ARCH: i386
SECTIONS: .text, .rodata, .data, .bss
---
BINARY_DATA_BLOB_0x${Math.random().toString(16).substring(2, 10).toUpperCase()}
`;
    this.write('kernel.bin', kernelBinContent);
    kernel.emitEvent('TASK', 'MAKE: LINKING kernel.bin');
    kernel.emitEvent('TASK', 'MAKE: BUILD_SUCCESSFUL');
    return 'kernel.bin created successfully.';
  }

  getFile(name: string) {
    return this.files[name];
  }

  cat(name: string) {
    const file = this.files[name];
    if (!file) return `Error: File '${name}' not found.`;
    if (file.isCorrupted) throw new Error(`CRITICAL_FILE_CORRUPTION: ${name}`);
    return file.content;
  }

  write(name: string, content: string) {
    let finalContent = content;
    
    // 1. Limit individual file size
    if (finalContent.length > this.MAX_FILE_SIZE) {
      finalContent = finalContent.substring(0, this.MAX_FILE_SIZE);
    }

    // 2. Limit based on remaining total memory
    const currentSize = this.files[name] ? (this.files[name].content?.length || 0) : 0;
    const newSize = finalContent.length;
    const sizeDiff = newSize - currentSize;

    if (this.getUsedMemory() + sizeDiff > this.MAX_MEMORY) {
      const available = this.MAX_MEMORY - (this.getUsedMemory() - currentSize);
      if (available > 0) {
        finalContent = finalContent.substring(0, available);
      } else {
        kernel.emitEvent('CRITICAL', `VFS_OOM: ${name}`);
        throw new Error(`OUT_OF_MEMORY: Cannot write '${name}'. VFS is full.`);
      }
    }

    this.files[name] = { name, content: finalContent, type: 'file' };
    this.save();
    kernel.emitEvent('SYSCALL', `SYS_WRITE: ${name}`);
    
    if (name === 'kernel.sys') {
      kernel.onKernelUpdate(finalContent);
    }

    if (sizeDiff > 0) {
      kernel.allocateMemory(sizeDiff / (1024 * 1024));
    } else if (sizeDiff < 0) {
      kernel.freeMemory(Math.abs(sizeDiff) / (1024 * 1024));
    }
  }

  rm(name: string) {
    const file = this.files[name];
    if (file) {
      const size = file.content?.length || 0;
      if (file.isCritical) {
        delete this.files[name];
        this.save();
        kernel.emitEvent('CRITICAL', `SYS_UNLINK: ${name}`);
        throw new Error(`CRITICAL_FILE_REMOVED: ${name}`);
      }
      delete this.files[name];
      this.save();
      kernel.emitEvent('SYSCALL', `SYS_UNLINK: ${name}`);
      kernel.freeMemory(size / (1024 * 1024));
    }
  }

  corrupt(name: string) {
    if (this.files[name]) {
      this.files[name].isCorrupted = true;
      this.save();
      kernel.emitEvent('CRITICAL', `VFS_CORRUPT: ${name}`);
    }
  }

  tar(name: string, filePaths: string[]) {
    const archiveData: Record<string, string> = {};
    filePaths.forEach(path => {
      const file = this.files[path];
      if (file && file.type === 'file') {
        archiveData[path] = file.content;
      }
    });
    const content = JSON.stringify({
      magic: 'VCOS_TAR_XZ',
      version: '1.0',
      files: archiveData
    });
    this.write(name, content);
  }

  untar(name: string) {
    const content = this.cat(name);
    try {
      // Try to parse as our simulated JSON format
      if (content.trim().startsWith('{')) {
        const data = JSON.parse(content);
        if (data.magic === 'VCOS_TAR_XZ') {
          const extractedFiles: string[] = [];
          Object.entries(data.files).forEach(([path, fileContent]) => {
            this.write(path as string, fileContent as string);
            extractedFiles.push(path as string);
          });
          return extractedFiles;
        }
      }
      
      // Fallback: If it's a "real" file (binary or unknown text), 
      // simulate a successful extraction of a single binary
      const baseName = name.split('/').pop()?.split('.')[0] || 'app';
      const binPath = `bin/${baseName}`;
      this.write(binPath, `#!/bin/bash\necho "Executing native Linux binary: ${baseName}..."\n# Simulated execution of raw buffer`);
      return [binPath];
    } catch (e) {
      // Even if JSON parsing fails, we fallback to the binary simulation
      const baseName = name.split('/').pop()?.split('.')[0] || 'app';
      const binPath = `bin/${baseName}`;
      this.write(binPath, `#!/bin/bash\necho "Executing native Linux binary: ${baseName}..."\n# Simulated execution of raw buffer`);
      return [binPath];
    }
  }

  save() {
    localStorage.setItem('vcos_vfs_data', JSON.stringify(this.files));
  }

  load() {
    const saved = localStorage.getItem('vcos_vfs_data');
    if (saved) {
      try {
        const loadedFiles = JSON.parse(saved);
        this.files = { ...loadedFiles };
        
        // Ensure essential (critical) files from INITIAL_VFS are always present and not corrupted on boot
        Object.entries(INITIAL_VFS).forEach(([name, file]) => {
          if (file.isCritical && (!this.files[name] || this.files[name].isCorrupted)) {
            this.files[name] = { ...file };
          }
        });

        if (this.files['kernel.sys']) {
          const isValid = kernel.onKernelUpdate(this.files['kernel.sys'].content);
          if (!isValid) {
            // If the kernel is invalid, restore it from INITIAL_VFS
            this.files['kernel.sys'] = { ...INITIAL_VFS['kernel.sys'] };
            this.save();
            kernel.onKernelUpdate(this.files['kernel.sys'].content);
          }
        }
      } catch (e) {
        console.error('Failed to load VFS from localStorage', e);
        this.files = { ...INITIAL_VFS };
      }
    } else {
      this.files = { ...INITIAL_VFS };
    }
  }
}

export const vfs = new VirtualFileSystem();
vfs.load();
