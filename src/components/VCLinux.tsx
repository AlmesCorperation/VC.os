import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Package, Cpu, Globe, Shield, HardDrive, Download, Box } from 'lucide-react';
import { MemoryMap } from '../services/memoryMap';
import { vfs } from '../services/vfs';
import { libarchive } from '../services/libarchive';
import { usePIT } from '../hooks/useAudio';
import { kernel } from '../services/kernel';

export const VCLinux: React.FC<{ 
  onCrash: () => void;
  installedGames?: string[];
  onLaunchGame?: (id: string) => void;
  onInstallGame?: (id: string) => void;
  onOpenFile?: (name: string) => void;
}> = ({ onCrash, installedGames = [], onLaunchGame, onInstallGame, onOpenFile }) => {
  const [history, setHistory] = useState<{ text: string, type?: 'cmd' | 'info' | 'error' | 'success' | 'system' | 'dim' }[]>([
    { text: 'VC.linux v2.5 "Crostini-Core" (LTS)', type: 'system' },
    { text: 'Welcome to the VC.linux container environment.', type: 'info' },
    { text: 'Based on Google Crostini virtualization technology.', type: 'info' },
    { text: 'Type "help" to see available commands.', type: 'info' },
    { text: '' }
  ]);
  const [input, setInput] = useState('');
  const [user, setUser] = useState('vcos_user');
  const [hostname] = useState('vc-linux-penguin');
  const [cwd, setCwd] = useState('~');
  const [isBooting, setIsBooting] = useState(true);
  const [bootProgress, setBootProgress] = useState(0);
  const [isEditing, setIsEditing] = useState<{ active: boolean, filename: string, content: string } | null>(null);
  const [showSoftwareCenter, setShowSoftwareCenter] = useState(false);
  const [installerStatus, setInstallerStatus] = useState<{ status: 'idle' | 'extracting' | 'success' | 'error', message: string }>({ status: 'idle', message: '' });
  const [runOptions, setRunOptions] = useState<{ active: boolean, filename: string, mode: 'text' | 'vclinux' | null, phase: 'menu' | 'visual' | 'running' }>({ active: false, filename: '', mode: null, phase: 'menu' });
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { playTone } = usePIT();

  useEffect(() => {
    if (isBooting) {
      kernel.emitEvent('SYSCALL', `SYS_BRIDGE_INIT (0x${MemoryMap.VC_LINUX_BRIDGE.toString(16).toUpperCase()})`);
      const interval = setInterval(() => {
        setBootProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setIsBooting(false);
            return 100;
          }
          return prev + 5;
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isBooting]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, isBooting]);

  const addToHistory = (text: string, type?: 'cmd' | 'info' | 'error' | 'success' | 'system' | 'dim') => {
    setHistory(prev => [...prev, { text, type }]);
  };

  const handleCommand = async (fullCmd: string) => {
    if (!fullCmd.trim()) return;

    // Play keystroke sound
    playTone(800, 0.01, 'square');

    const parts = fullCmd.trim().split(' ');
    let cmd = parts[0].toLowerCase();
    let args = parts.slice(1);
    let isSudo = false;

    if (cmd === 'sudo') {
      if (args.length === 0) {
        addToHistory('usage: sudo <command>', 'info');
        return;
      }
      if (args[0] === 'su') {
        setUser('root');
        addToHistory(`[sudo] password for ${user}: ************`, 'dim');
        addToHistory('Password accepted. You are now ROOT.', 'error');
        return;
      }
      if (user !== 'root') {
        addToHistory(`[sudo] password for ${user}: ************`, 'dim');
      }
      isSudo = true;
      cmd = args[0].toLowerCase();
      args = args.slice(1);
    }

    addToHistory(`${user}@${hostname}:${cwd}${user === 'root' ? '#' : '$'} ${fullCmd}`, 'cmd');
    kernel.emitEvent('TASK', `VCLINUX: ${cmd}`);
    kernel.executeTask('VCLINUX_CMD', 5);

    try {
      switch (cmd) {
        case 'help':
          addToHistory('VC.linux Unified Commands:', 'info');
          addToHistory('  software                - Open Visual Software Center');
          addToHistory('  apt-get [install|update] - Package management');
          addToHistory('  ls, dir                 - List directory contents');
          addToHistory('  cd                      - Change directory');
          addToHistory('  cat, type               - View file contents');
          addToHistory('  vim, nano               - Edit file contents');
          addToHistory('  cp, copy                - Copy files');
          addToHistory('  mv, move                - Move/Rename files');
          addToHistory('  rm, del                 - Delete files');
          addToHistory('  mkdir, md               - Create directory');
          addToHistory('  uname -a                - Kernel info');
          addToHistory('  top                     - Process monitor');
          addToHistory('  df -h                   - Disk usage');
          addToHistory('  neofetch                - System info summary');
          addToHistory('  man <cmd>               - Manual pages');
          addToHistory('  grep <pattern> <file>   - Search in file');
          addToHistory('  ping <host>             - Test network');
          addToHistory('  curl <url> [-O]         - Fetch web content');
          addToHistory('  wget <url>              - Download file');
          addToHistory('  tar -xvf <file>         - Extract archive');
          addToHistory('  make                    - Build kernel from source');
          addToHistory('  grub-mkrescue -o <iso>  - Create bootable ISO');
          addToHistory('  bsdtar [flags] <file>   - Advanced archive utility');
          addToHistory('  mkisofs -o <iso> <dir>  - Create ISO image');
          addToHistory('  install <game_id>       - Register downloaded game');
          addToHistory('  open <file>             - Open file in OS');
          addToHistory('  chmod +x <file>         - Make file executable');
          addToHistory('  ./<file>, sh <file>     - Execute script/binary');
          addToHistory('  whoami                  - Current user');
          addToHistory('  sudo                    - Elevate privileges');
          addToHistory('  echo                    - Print text');
          addToHistory('  launch                  - Start a program/game');
          addToHistory('  blender                 - Launch 3D suite');
          addToHistory('  sysinfo                 - Hardware report');
          addToHistory('  clear                   - Clear terminal');
          break;

        case 'neofetch':
          addToHistory('            .-.            vcos_user@vc-linux-penguin', 'success');
          addToHistory('           oo| |           --------------------------', 'success');
          addToHistory('           /`\' \           OS: VC.linux v2.5 x86_64', 'success');
          addToHistory('          (\\_; /           Host: Crostini Virtual Machine', 'success');
          addToHistory('         (      )          Kernel: 5.15.0-crostini-vcos', 'success');
          addToHistory('        (        )         Uptime: 1 hour, 24 mins', 'success');
          addToHistory('        |`-.__.-`|         Packages: 452 (dpkg)', 'success');
          addToHistory('        (___)(___)         Shell: bash 5.1.4', 'success');
          addToHistory('                           Resolution: 1920x1080', 'success');
          addToHistory('                           DE: VC.os Desktop', 'success');
          addToHistory('                           CPU: Virtual Core (4) @ 2.4GHz', 'success');
          addToHistory('                           GPU: VirGL VAE', 'success');
          addToHistory('                           Memory: 1245MiB / 7962MiB', 'success');
          break;

        case 'man':
          if (!args[0]) {
            addToHistory('What manual page do you want?', 'error');
          } else {
            addToHistory(`MANUAL PAGE: ${args[0].toUpperCase()}(1)`, 'system');
            addToHistory('NAME', 'info');
            addToHistory(`    ${args[0]} - a standard VC.linux utility`, 'dim');
            addToHistory('DESCRIPTION', 'info');
            addToHistory(`    This is a simulated manual page for ${args[0]}.`, 'dim');
            addToHistory(`    In a real Linux system, this would provide detailed documentation.`, 'dim');
          }
          break;

        case 'vim':
        case 'nano':
          if (!args[0]) {
            addToHistory(`Usage: ${cmd} <filename>`, 'error');
          } else {
            let content = '';
            try {
              content = vfs.cat(args[0]);
              if (content.startsWith('Error:')) content = '';
            } catch (e) {}
            setIsEditing({ active: true, filename: args[0], content });
          }
          break;

        case 'grep':
          if (args.length < 2) {
            addToHistory('Usage: grep <pattern> <file>', 'error');
          } else {
            try {
              const content = vfs.cat(args[1]);
              const lines = content.split('\n');
              const matches = lines.filter(l => l.toLowerCase().includes(args[0].toLowerCase()));
              if (matches.length > 0) {
                matches.forEach(m => addToHistory(m, 'success'));
              } else {
                addToHistory('No matches found.', 'dim');
              }
            } catch (e) {
              addToHistory(`Error: File '${args[1]}' not found.`, 'error');
            }
          }
          break;

        case 'ping':
          if (!args[0]) {
            addToHistory('Usage: ping <host>', 'error');
          } else {
            addToHistory(`PING ${args[0]} (${args[0]}) 56(84) bytes of data.`, 'info');
            for (let i = 0; i < 4; i++) {
              await new Promise(r => setTimeout(r, 500));
              addToHistory(`64 bytes from ${args[0]}: icmp_seq=${i+1} ttl=64 time=${(Math.random() * 20 + 10).toFixed(2)} ms`, 'success');
            }
            addToHistory(`--- ${args[0]} ping statistics ---`, 'info');
            addToHistory(`4 packets transmitted, 4 received, 0% packet loss`, 'info');
          }
          break;

        case 'curl':
          if (!args[0]) {
            addToHistory('Usage: curl <url> [-O]', 'error');
          } else {
            let url = args[0];
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
              url = 'https://' + url;
            }
            const isDownload = args.includes('-O');
            addToHistory(`% Total    % Received % Xferd  Average Speed   Time    Time     Time  Current`, 'dim');
            addToHistory(`                                 Dload  Upload   Total   Spent    Left  Speed`, 'dim');
            
            try {
              // Try multiple proxies if one fails
              const proxies = [
                `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
              ];
              
              let response = null;
              let content = '';
              
              for (const proxy of proxies) {
                try {
                  response = await fetch(proxy);
                  if (response.ok) {
                    content = await response.text();
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }

              if (!response || !response.ok) throw new Error(`Failed to fetch from all available mirrors`);
              
              if (isDownload) {
                const filename = url.split('/').pop() || 'downloaded_file';
                const path = `Downloads/${filename}`;
                vfs.write(path, content);
                addToHistory(`curl: saved content to '${path}'`, 'success');
              } else {
                addToHistory(content.substring(0, 2000) + (content.length > 2000 ? '\n... [TRUNCATED]' : ''), 'info');
              }
            } catch (e: any) {
              addToHistory(`curl: (7) Failed to connect to ${url}: ${e.message}`, 'error');
            }
          }
          break;

        case 'wget':
          if (!args[0]) {
            addToHistory('Usage: wget <url>', 'error');
          } else {
            let url = args[0];
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
              url = 'https://' + url;
            }
            const filename = url.split('/').pop() || 'index.html';
            const path = `Downloads/${filename}`;
            const isLarge = (url.toLowerCase().includes('blender') && url.includes('.tar')) || url.endsWith('.iso');
            
            const hostname = new URL(url).hostname;
            addToHistory(`--${new Date().toLocaleTimeString()}--  ${url}`, 'info');
            addToHistory(`Resolving ${hostname}... 127.0.0.1`, 'dim');
            addToHistory(`Connecting to ${hostname}|127.0.0.1|:443... connected.`, 'dim');
            
            try {
              if (isLarge) {
                addToHistory(`HTTP request sent, awaiting response... 200 OK`, 'success');
                const size = 184520192; // ~176MB
                addToHistory(`Length: ${size} (176M) [application/x-debian-package]`, 'info');
                addToHistory(`Saving to: '${path}'`, 'info');
                
                for (let i = 0; i <= 100; i += 10) {
                  await new Promise(r => setTimeout(r, 300));
                  const bar = '='.repeat(Math.floor(i / 2.5)).padEnd(40, ' ');
                  addToHistory(`${i.toString().padStart(3)}%[${bar}] ${(size * (i/100)).toLocaleString()}  12.4MB/s   eta ${Math.ceil((100-i)/10)}s`, 'success');
                }
                
                vfs.write(path, JSON.stringify({
                  magic: 'VCOS_TAR_XZ',
                  version: '1.0',
                  files: {
                    'blender/blender': '#!/bin/bash\necho "Launching Blender 3.4.1..."\nlaunch blender',
                    'blender/readme.txt': 'Blender 3.4.1 for VC.os\n\nThis is a professional 3D suite ported to the Spectrum Kernel.',
                    'blender/config.sys': 'DEVICE=BLENDER.SYS\nBUFFERS=32'
                  }
                }));
                addToHistory(`${new Date().toLocaleTimeString()} (12.4 MB/s) - '${path}' saved [${size}/${size}]`, 'success');
                addToHistory('Archive detected. You can now use "tar -xvf" to extract it.', 'info');
                
                if (filename.toLowerCase().includes('blender')) {
                  addToHistory('Detected software package. Auto-installing...', 'info');
                  await new Promise(r => setTimeout(r, 1000));
                  if (onInstallGame) onInstallGame('blender');
                  addToHistory('Blender has been successfully installed to the system.', 'success');
                }
              } else {
                const proxies = [
                  `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
                  `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
                ];
                
                let response = null;
                let content = '';
                
                for (const proxy of proxies) {
                  try {
                    response = await fetch(proxy);
                    if (response.ok) {
                      content = await response.text();
                      break;
                    }
                  } catch (e) {
                    continue;
                  }
                }

                if (!response || !response.ok) throw new Error(`Failed to fetch from all available mirrors`);
                
                addToHistory(`HTTP request sent, awaiting response... 200 OK`, 'success');
                addToHistory(`Length: ${content.length} (${(content.length / 1024).toFixed(1)}K) [text/plain]`, 'info');
                addToHistory(`Saving to: '${path}'`, 'info');
                
                vfs.write(path, content);
                
                addToHistory(`100%[======================================>] ${content.length}       --.-K/s   in 0.02s`, 'success');
                addToHistory(`${new Date().toLocaleTimeString()} (54.2 MB/s) - '${path}' saved [${content.length}/${content.length}]`, 'success');
              }
            } catch (e: any) {
              addToHistory(`wget: error downloading ${url}: ${e.message}`, 'error');
            }
          }
          break;

        case 'install':
          if (!args[0]) {
            addToHistory('Usage: install <game_id>', 'error');
          } else {
            const gameId = args[0];
            addToHistory(`Installing ${gameId} into system registry...`, 'info');
            await new Promise(r => setTimeout(r, 1000));
            if (onInstallGame) {
              onInstallGame(gameId);
              addToHistory(`Successfully installed ${gameId}. It is now available in the OS.`, 'success');
            } else {
              addToHistory('Error: System registry unavailable.', 'error');
            }
          }
          break;

        case 'open':
          if (!args[0]) {
            addToHistory('Usage: open <filename>', 'error');
          } else {
            const filename = args[0];
            addToHistory(`Opening ${filename} with system default...`, 'info');
            if (onOpenFile) {
              onOpenFile(filename);
            } else {
              addToHistory('Error: System GUI unavailable.', 'error');
            }
          }
          break;

        case 'chmod':
          if (args[0] === '+x' && args[1]) {
            addToHistory(`chmod: changed permissions of '${args[1]}' to 755`, 'success');
          } else {
            addToHistory('Usage: chmod +x <filename>', 'error');
          }
          break;

        case 'sh':
          if (!args[0]) {
            addToHistory('Usage: sh <filename>', 'error');
          } else {
            try {
              const content = vfs.cat(args[0]);
              addToHistory(`sh: executing ${args[0]}...`, 'info');
              await new Promise(r => setTimeout(r, 500));
              const lines = content.split('\n');
              lines.forEach(line => {
                if (line.startsWith('echo "')) {
                  addToHistory(line.replace('echo "', '').replace('"', ''), 'info');
                } else if (line.startsWith('printf("')) {
                  addToHistory(line.replace('printf("', '').replace('\\n");', ''), 'info');
                }
              });
              addToHistory(`${args[0]} finished with exit code 0`, 'success');
            } catch (e) {
              addToHistory(`sh: ${args[0]}: No such file or directory`, 'error');
            }
          }
          break;

        case 'run':
          if (args[0]) {
            setRunOptions({ active: true, filename: args[0], mode: null, phase: 'menu' });
          } else {
            addToHistory('usage: run <filename>', 'info');
          }
          break;

        case 'software':
          setShowSoftwareCenter(true);
          addToHistory('Opening Visual Software Center...', 'info');
          break;

        case 'make':
          addToHistory('make: Entering directory \'/home/vcos_user\'', 'dim');
          const makeResult = vfs.make();
          addToHistory(makeResult, 'success');
          addToHistory('make: Leaving directory \'/home/vcos_user\'', 'dim');
          break;

        case 'grub-mkrescue':
          if (args.includes('-o') && args.length >= 3) {
            const oIdx = args.indexOf('-o');
            const output = args[oIdx + 1];
            addToHistory(`grub-mkrescue: generating bootable rescue image ${output}...`, 'info');
            addToHistory('grub-mkrescue: checking for xorriso...', 'dim');
            addToHistory('grub-mkrescue: building ISO structure...', 'dim');
            
            try {
              const filesToInclude = ['kernel.bin', 'boot.s', 'linker.ld'];
              await libarchive.writeArchive(output, filesToInclude, 'iso');
              addToHistory(`grub-mkrescue: successfully created ${output}`, 'success');
              addToHistory('System: You can now use this ISO to boot a real machine.', 'info');
            } catch (e: any) {
              addToHistory(`grub-mkrescue: error: ${e.message}`, 'error');
            }
          } else {
            addToHistory('Usage: grub-mkrescue -o <output.iso>', 'error');
          }
          break;

        case 'mkisofs':
          if (args.includes('-o') && args.length >= 3) {
            const oIdx = args.indexOf('-o');
            const output = args[oIdx + 1];
            const source = args.filter((a, i) => i !== oIdx && i !== oIdx + 1)[0] || '.';
            
            addToHistory(`mkisofs: creating ISO image '${output}' from '${source}'...`, 'info');
            try {
              const filesToInclude = source === '.' ? vfs.ls() : vfs.ls().filter(f => f.startsWith(source));
              await libarchive.writeArchive(output, filesToInclude, 'iso');
              addToHistory(`mkisofs: successfully created ${output} (${filesToInclude.length} files)`, 'success');
            } catch (e: any) {
              addToHistory(`mkisofs: error: ${e.message}`, 'error');
            }
          } else {
            addToHistory('Usage: mkisofs -o <output.iso> <source_dir>', 'error');
          }
          break;

        case 'bsdtar':
          if (args.length === 0) {
            addToHistory('bsdtar: usage: -x (extract), -c (create), -t (list)', 'error');
          } else {
            const result = await libarchive.bsdtar(args);
            addToHistory(result, result.includes('error') ? 'error' : 'success');
          }
          break;

        case 'tar':
          if (args[0] === '-xvf' && args[1]) {
            const filename = args[1];
            addToHistory(`tar: extracting ${filename}...`, 'info');
            try {
              const extracted = vfs.untar(filename);
              extracted.forEach(f => addToHistory(`  extracted: ${f}`, 'success'));
              addToHistory(`tar: successfully extracted ${extracted.length} files`, 'success');
              
              // Auto-install if it looks like a package or is a binary
              const appName = filename.split('/').pop()?.split('.')[0];
              if (appName && onInstallGame) {
                onInstallGame(appName);
                addToHistory(`System: Registered '${appName}' as an executable application.`, 'info');
              }
            } catch (e: any) {
              addToHistory(`tar: error: ${e.message}`, 'error');
            }
          } else if (args[0] === '-cvf' && args[1] && args[2]) {
            const archiveName = args[1];
            const filesToArchive = args.slice(2);
            addToHistory(`tar: creating archive ${archiveName}...`, 'info');
            try {
              vfs.tar(archiveName, filesToArchive);
              addToHistory(`tar: successfully archived ${filesToArchive.length} files into ${archiveName}`, 'success');
            } catch (e: any) {
              addToHistory(`tar: error: ${e.message}`, 'error');
            }
          } else {
            addToHistory('Usage:', 'dim');
            addToHistory('  tar -xvf <archive.tar.xz>  - Extract archive', 'dim');
            addToHistory('  tar -cvf <archive.tar.xz> <file1> <file2>... - Create archive', 'dim');
          }
          break;

        case 'ls':
        case 'dir':
          const files = vfs.ls();
          addToHistory(`total ${files.length * 4}`, 'info');
          files.forEach(f => {
            const isExe = f.endsWith('.exe') || f.endsWith('.com') || f.endsWith('.bat');
            const isSys = f.endsWith('.sys') || f.endsWith('.dll');
            const perms = isExe ? '-rwxr-xr-x' : isSys ? '-rw-------' : '-rw-r--r--';
            const date = new Date().toLocaleDateString();
            const size = Math.floor(Math.random() * 5000) + 100;
            addToHistory(`${perms} 1 ${user} ${user} ${size.toString().padStart(5)} ${date} ${f}`, isExe ? 'success' : isSys ? 'error' : 'info');
          });
          break;

        case 'cd':
          if (!args[0] || args[0] === '~') {
            setCwd('~');
          } else if (args[0] === '..') {
            setCwd('~');
          } else {
            setCwd(`~/${args[0].toLowerCase()}`);
          }
          break;

        case 'cat':
        case 'type':
          if (!args[0]) {
            addToHistory('Error: Missing filename.', 'error');
          } else {
            try {
              const content = vfs.cat(args[0]);
              addToHistory(content, 'info');
            } catch (e) {
              addToHistory(`Error: File '${args[0]}' not found.`, 'error');
            }
          }
          break;

        case 'cp':
        case 'copy':
          if (args.length < 2) {
            addToHistory('Usage: cp <source> <dest>', 'error');
          } else {
            try {
              const content = vfs.cat(args[0]);
              vfs.write(args[1], content);
              addToHistory(`Copied '${args[0]}' to '${args[1]}'.`, 'success');
            } catch (e) {
              addToHistory(`Error: Source file '${args[0]}' not found.`, 'error');
            }
          }
          break;

        case 'mv':
        case 'move':
        case 'ren':
        case 'rename':
          if (args.length < 2) {
            addToHistory('Usage: mv <source> <dest>', 'error');
          } else {
            try {
              const content = vfs.cat(args[0]);
              vfs.write(args[1], content);
              vfs.rm(args[0]);
              addToHistory(`Moved '${args[0]}' to '${args[1]}'.`, 'success');
            } catch (err: any) {
              if (err.message.includes('CRITICAL_FILE_REMOVED')) {
                onCrash();
              } else {
                addToHistory(`Error: ${err.message}`, 'error');
              }
            }
          }
          break;

        case 'rm':
        case 'del':
          if (!args[0]) {
            addToHistory('Error: Missing filename.', 'error');
          } else {
            try {
              vfs.rm(args[0]);
              addToHistory(`Deleted '${args[0]}'.`, 'success');
            } catch (err: any) {
              if (err.message.includes('CRITICAL_FILE_REMOVED')) {
                onCrash();
              } else {
                addToHistory(`Error: ${err.message}`, 'error');
              }
            }
          }
          break;

        case 'mkdir':
        case 'md':
          if (!args[0]) {
            addToHistory('Error: Missing directory name.', 'error');
          } else {
            addToHistory(`Directory '${args[0]}' created.`, 'success');
          }
          break;

        case 'uname':
          if (args[0] === '-a') {
            addToHistory('Linux vc-linux-penguin 5.15.0-crostini-vcos #1 SMP PREEMPT Wed Mar 10 23:42:59 UTC 2026 x86_64 GNU/Linux', 'success');
          } else {
            addToHistory('Linux', 'success');
          }
          break;

        case 'apt-get':
        case 'apt':
          if (args[0] === 'update') {
            addToHistory('Hit:1 http://deb.debian.org/debian bullseye InRelease', 'info');
            addToHistory('Get:2 http://deb.debian.org/debian-security bullseye-security InRelease [44.1 kB]', 'info');
            addToHistory('Reading package lists... Done', 'success');
          } else if (args[0] === 'install') {
            const pkg = args[1] || 'package';
            addToHistory(`Reading package lists... Done`, 'info');
            addToHistory(`Building dependency tree... Done`, 'info');
            addToHistory(`The following NEW packages will be installed:`, 'info');
            addToHistory(`  ${pkg}`, 'info');
            addToHistory(`0 upgraded, 1 newly installed, 0 to remove.`, 'info');
            addToHistory(`Unpacking ${pkg} (1.0.0-vcos)...`, 'info');
            addToHistory(`Setting up ${pkg}...`, 'success');
          } else {
            addToHistory('Usage: apt-get [update|install <package>]', 'error');
          }
          break;

        case 'top':
          addToHistory('top - 23:42:59 up 1:24,  1 user,  load average: 0.00, 0.00, 0.00', 'info');
          addToHistory('Tasks:  42 total,   1 running,  41 sleeping,   0 stopped,   0 zombie', 'info');
          addToHistory('%Cpu(s):  0.3 us,  0.1 sy,  0.0 ni, 99.6 id,  0.0 wa,  0.0 hi,  0.0 si,  0.0 st', 'info');
          addToHistory('MiB Mem :   7962.4 total,   4123.1 free,   1245.8 used,   2593.5 buff/cache', 'info');
          break;

        case 'df':
          addToHistory('Filesystem      Size  Used Avail Use% Mounted on', 'info');
          addToHistory('/dev/vda1        20G  4.2G   15G  22% /', 'info');
          addToHistory('tmpfs           3.9G     0  3.9G   0% /dev/shm', 'info');
          break;

        case 'crostini-info':
          addToHistory('Container: penguin', 'success');
          addToHistory('Image: debian/bullseye', 'success');
          addToHistory('Architecture: x86_64', 'success');
          addToHistory('Runtime: sommelier/wayland', 'success');
          addToHistory('GPU Acceleration: VirGL (Enabled)', 'success');
          break;

        case 'whoami':
          addToHistory(user, 'info');
          break;

        case 'echo':
          addToHistory(args.join(' '), 'info');
          break;

        case 'battery':
          if ('getBattery' in navigator) {
            addToHistory('Querying ACPI BIOS...', 'info');
            try {
              const battery: any = await (navigator as any).getBattery();
              const level = Math.round(battery.level * 100);
              addToHistory(`BATTERY STATUS: ${level}%`, level > 20 ? 'success' : 'error');
            } catch (e) {
              addToHistory('Error accessing battery hardware.', 'error');
            }
          } else {
            addToHistory('Error: ACPI Battery Driver not found.', 'error');
          }
          break;

        case 'sysinfo':
          addToHistory('HARDWARE REPORT:', 'info');
          addToHistory(`  CPU Cores:      ${navigator.hardwareConcurrency || 'Unknown'}`, 'info');
          addToHistory(`  Display:        ${screen.width}x${screen.height}`, 'info');
          addToHistory(`  Platform:       ${navigator.platform}`, 'info');
          break;

        case 'vibrate':
          const ms = parseInt(args[0]) || 200;
          if (navigator.vibrate) {
            navigator.vibrate(ms);
            addToHistory(`Sending signal to haptic motor: ${ms}ms...`, 'success');
          } else {
            addToHistory('Error: Haptic hardware not detected.', 'error');
          }
          break;

        case 'storage':
          if (navigator.storage && navigator.storage.estimate) {
            try {
              const estimate = await navigator.storage.estimate();
              const used = ((estimate.usage || 0) / 1024 / 1024).toFixed(2);
              addToHistory(`DISK USAGE: ${used} MB used`, 'info');
            } catch (e) {
              addToHistory('Error reading disk controller.', 'error');
            }
          }
          break;

        case 'netstat':
          addToHistory('NETWORK INTERFACE STATUS:', 'info');
          addToHistory(`  State:     ${navigator.onLine ? 'ONLINE' : 'OFFLINE'}`, navigator.onLine ? 'success' : 'error');
          break;

        case 'launch':
          const gameId = args[0];
          if (!gameId) {
             addToHistory('Usage: launch <game_id>', 'error');
          } else if (installedGames.includes(gameId)) {
             addToHistory(`Launching process: ${gameId}...`, 'success');
             if (onLaunchGame) onLaunchGame(gameId);
          } else {
             addToHistory(`Error: Process '${gameId}' not found.`, 'error');
          }
          break;
        
        case 'snake':
        case 'pong':
        case 'doom':
        case 'blender':
           addToHistory(`Launching ${cmd}...`, 'success');
           if (onLaunchGame) onLaunchGame(cmd);
           break;

        case 'rsod':
        case 'panic':
          onCrash();
          break;

        case 'exit':
          if (user === 'root') {
            setUser('vcos_user');
            addToHistory('Logged out of root. Returning to vcos_user.', 'info');
          } else {
            addToHistory('Use the window controls to close the terminal.', 'dim');
          }
          break;

        case 'clear':
          setHistory([]);
          break;

        default:
          if (cmd.startsWith('./')) {
            const filename = cmd.substring(2);
            try {
              const content = vfs.cat(filename);
              addToHistory(`bash: executing ${filename}...`, 'info');
              await new Promise(r => setTimeout(r, 500));
              const lines = content.split('\n');
              lines.forEach(line => {
                if (line.startsWith('echo "')) {
                  addToHistory(line.replace('echo "', '').replace('"', ''), 'info');
                } else if (line.startsWith('printf("')) {
                  addToHistory(line.replace('printf("', '').replace('\\n");', ''), 'info');
                }
              });
              addToHistory(`${filename} finished with exit code 0`, 'success');
            } catch (e) {
              addToHistory(`-bash: ${cmd}: No such file or directory`, 'error');
            }
          } else {
            addToHistory(`-bash: ${cmd}: command not found`, 'error');
          }
      }
    } catch (e: any) {
      addToHistory(`KERNEL_PANIC: ${e.message}`, 'error');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0c0c0c] text-[#d1d1d1] font-mono text-[13px] overflow-hidden selection:bg-[#333] selection:text-white relative">
      {/* Linux Header */}
      <div className="bg-[#1e1e1e] p-2 flex items-center justify-between border-b border-[#333]">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-purple-400" />
          <span className="font-bold text-[11px] tracking-tight">VC.linux Terminal (v2.5 LTS)</span>
        </div>
        <div className="flex gap-4 text-[10px] opacity-60">
          <div className="flex items-center gap-1"><Cpu size={10} /> 12%</div>
          <div className="flex items-center gap-1"><HardDrive size={10} /> 4.2GB / 20GB</div>
        </div>
      </div>

      {/* Boot Screen */}
      {isBooting && (
        <div className="absolute inset-0 z-50 bg-black flex flex-col items-center justify-center p-10">
          <div className="w-full max-w-md space-y-4">
            <div className="flex justify-between text-[10px] text-purple-400 font-bold uppercase tracking-widest">
              <span>Booting VC.linux...</span>
              <span>{bootProgress}%</span>
            </div>
            <div className="h-1 w-full bg-[#111] overflow-hidden">
              <div 
                className="h-full bg-purple-500 transition-all duration-100" 
                style={{ width: `${bootProgress}%` }}
              />
            </div>
            <div className="text-[9px] text-gray-500 font-mono space-y-1">
              <div>[ OK ] Started Virtualization Layer.</div>
              {bootProgress > 20 && <div>[ OK ] Mounted Root Filesystem.</div>}
              {bootProgress > 40 && <div>[ OK ] Initialized Kernel Modules.</div>}
              {bootProgress > 60 && <div>[ OK ] Started Network Manager.</div>}
              {bootProgress > 80 && <div>[ OK ] Reached Multi-User System.</div>}
            </div>
          </div>
        </div>
      )}

      {/* Editor Overlay */}
      {isEditing && (
        <div className="absolute inset-0 z-40 bg-[#0c0c0c] flex flex-col">
          <div className="bg-[#1e1e1e] p-2 flex justify-between items-center border-b border-[#333]">
            <span className="text-xs font-bold text-purple-400">EDITING: {isEditing.filename}</span>
            <div className="flex gap-2">
              <button 
                onClick={() => {
                  vfs.write(isEditing.filename, isEditing.content);
                  addToHistory(`Saved ${isEditing.filename}`, 'success');
                  setIsEditing(null);
                }}
                className="px-2 py-0.5 bg-green-900/30 text-green-400 border border-green-500/30 rounded text-[10px] hover:bg-green-900/50"
              >
                SAVE & EXIT
              </button>
              <button 
                onClick={() => setIsEditing(null)}
                className="px-2 py-0.5 bg-red-900/30 text-red-400 border border-red-500/30 rounded text-[10px] hover:bg-red-900/50"
              >
                CANCEL
              </button>
            </div>
          </div>
          <textarea
            autoFocus
            className="flex-1 bg-transparent p-4 text-white font-mono text-sm outline-none resize-none"
            value={isEditing.content}
            onChange={(e) => setIsEditing({ ...isEditing, content: e.target.value })}
            spellCheck={false}
          />
          <div className="bg-[#1e1e1e] p-1 px-3 text-[9px] text-gray-500 border-t border-[#333]">
            Line: {isEditing.content.split('\n').length}, Chars: {isEditing.content.length}
          </div>
        </div>
      )}

      {/* Run Options Overlay */}
      {runOptions.active && (
        <div className="absolute inset-0 z-50 bg-black/90 flex flex-col items-center justify-center font-mono">
          {runOptions.phase === 'menu' && (
            <div className="w-full max-w-xs space-y-8 text-center">
              <div className="text-purple-400 text-sm font-bold tracking-[0.2em] animate-pulse">OPTIONS FOR STARTING</div>
              <div className="text-white text-[10px] opacity-50 uppercase">{runOptions.filename}</div>
              
              <div className="flex flex-col gap-4">
                <button 
                  onClick={() => {
                    setRunOptions({ ...runOptions, mode: 'text', phase: 'running' });
                    addToHistory(`Starting ${runOptions.filename} in TEXT MODE...`, 'info');
                    setTimeout(() => {
                      onLaunchGame?.(runOptions.filename);
                      setRunOptions({ active: false, filename: '', mode: null, phase: 'menu' });
                    }, 1000);
                  }}
                  className="w-full py-3 border border-white/20 hover:bg-white hover:text-black transition-all text-xs font-bold"
                >
                  TEXT MODE
                </button>
                <button 
                  onClick={() => {
                    setRunOptions({ ...runOptions, mode: 'vclinux', phase: 'visual' });
                    playTone(100, 0.5, 'sawtooth');
                    setTimeout(() => {
                      onLaunchGame?.(runOptions.filename);
                      setRunOptions({ active: false, filename: '', mode: null, phase: 'menu' });
                    }, 3000);
                  }}
                  className="w-full py-3 border-2 border-purple-500 bg-purple-900/20 text-purple-400 hover:bg-purple-500 hover:text-white transition-all text-xs font-bold shadow-[0_0_15px_rgba(168,85,247,0.3)]"
                >
                  VC.linux (Visual)
                </button>
              </div>
              
              <button 
                onClick={() => setRunOptions({ active: false, filename: '', mode: null, phase: 'menu' })}
                className="text-[9px] text-gray-500 hover:text-white underline"
              >
                CANCEL
              </button>
            </div>
          )}

          {runOptions.phase === 'visual' && (
            <div className="w-full h-full flex flex-col items-center justify-center space-y-6">
              <div className="relative w-64 h-64 border border-purple-500/30 overflow-hidden">
                {[...Array(15)].map((_, i) => (
                  <div 
                    key={i}
                    className="absolute h-px bg-purple-500/50 w-full animate-[scan_2s_linear_infinite]"
                    style={{ 
                      top: `${i * 7}%`, 
                      animationDelay: `${i * 0.1}s`,
                      opacity: 0.3
                    }}
                  />
                ))}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-purple-400 text-[10px] font-bold tracking-[0.5em] animate-pulse">VISUALIZING CORE</div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 h-1 bg-purple-900/30">
                  <div className="h-full bg-purple-500 animate-[loading_3s_ease-in-out]" />
                </div>
              </div>
              <div className="text-[9px] text-purple-400/50 font-mono tracking-widest uppercase">Initializing Graphics Layer...</div>
            </div>
          )}
        </div>
      )}

      {/* Software Center Overlay */}
      {showSoftwareCenter && (
        <div className="absolute inset-0 z-40 bg-[#1a1a1a] flex flex-col border-4 border-purple-500/30">
          <div className="bg-[#222] p-3 flex justify-between items-center border-b-4 border-purple-500/30">
            <div className="flex items-center gap-3">
              <Package className="text-purple-400" size={20} />
              <span className="text-sm font-bold tracking-tighter">VC.linux SOFTWARE CENTER</span>
            </div>
            <button 
              onClick={() => setShowSoftwareCenter(false)}
              className="px-3 py-1 bg-red-900/30 text-red-400 border border-red-500/30 rounded text-[10px] hover:bg-red-900/50"
            >
              CLOSE
            </button>
          </div>
          
          <div className="flex-1 p-6 overflow-y-auto space-y-6">
            <div className="bg-purple-900/10 border border-purple-500/20 p-4 rounded-lg">
              <h3 className="text-purple-400 font-bold mb-2">Import Linux Software</h3>
              <p className="text-gray-400 text-[10px] mb-4">Select a .tar.xz archive from your host machine to install it into the VC.linux environment.</p>
              
              <input 
                type="file" 
                ref={fileInputRef}
                accept=".tar.xz,.xz"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  // Limit file size to 256MB to prevent browser crashes
                  const MAX_IMPORT_SIZE = 256 * 1024 * 1024;
                  let fileToImport: File = file;
                  if (file.size > MAX_IMPORT_SIZE) {
                    const blob = file.slice(0, MAX_IMPORT_SIZE);
                    fileToImport = new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
                    setInstallerStatus({ status: 'extracting', message: `File too large. Truncating to 256MB...` });
                  }
                  
                  setInstallerStatus({ status: 'extracting', message: `Importing ${file.name}...` });
                  
                  try {
                    const reader = new FileReader();
                    reader.onload = async (event) => {
                      const content = event.target?.result as string;
                      const path = `Downloads/${file.name}`;
                      
                      // Write to VFS
                      vfs.write(path, content);
                      
                      // Extract
                      setInstallerStatus({ status: 'extracting', message: `Extracting ${file.name} into system...` });
                      await new Promise(r => setTimeout(r, 1500));
                      
                      try {
                        const extracted = vfs.untar(path);
                        const appName = file.name.split('.')[0];
                        
                        // Register as installed app if it's not already
                        if (onInstallGame) onInstallGame(appName);
                        
                        setInstallerStatus({ 
                          status: 'success', 
                          message: `Successfully installed ${appName}! ${extracted.length} files extracted and registered.` 
                        });
                        addToHistory(`Software Center: Installed ${appName}`, 'success');
                      } catch (err: any) {
                        setInstallerStatus({ status: 'error', message: `Extraction failed: ${err.message}` });
                      }
                    };
                    reader.readAsText(fileToImport); // Assuming text-based VCOS_TAR_XZ for now
                  } catch (err: any) {
                    setInstallerStatus({ status: 'error', message: `Import failed: ${err.message}` });
                  }
                }}
              />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={installerStatus.status === 'extracting'}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded border-b-4 border-purple-800 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
              >
                <Download size={16} />
                {installerStatus.status === 'extracting' ? 'PROCESSING...' : 'SELECT .TAR.XZ PACKAGE'}
              </button>
              
              {installerStatus.message && (
                <div className={`mt-4 p-3 text-[10px] rounded border ${
                  installerStatus.status === 'success' ? 'bg-green-900/20 border-green-500/30 text-green-400' :
                  installerStatus.status === 'error' ? 'bg-red-900/20 border-red-500/30 text-red-400' :
                  'bg-blue-900/20 border-blue-500/30 text-blue-400 animate-pulse'
                }`}>
                  {installerStatus.message}
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Featured Software</h3>
              <div className="grid grid-cols-1 gap-3">
                {!installedGames.includes('blender') && (
                  <div className="bg-[#222] border border-purple-500/30 p-3 rounded flex items-center justify-between group hover:bg-purple-900/10 transition-colors">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-orange-500/20 rounded flex items-center justify-center">
                         <Box className="text-orange-400" size={20} />
                       </div>
                       <div>
                         <div className="font-bold text-xs uppercase">Blender 3.4.1</div>
                         <div className="text-[9px] text-gray-500">Professional 3D Creation Suite</div>
                       </div>
                    </div>
                    <button 
                      onClick={() => {
                        setShowSoftwareCenter(false);
                        handleCommand('wget https://download.blender.org/release/Blender3.4/blender-3.4.1-linux-x64.tar.xz');
                      }}
                      className="px-4 py-1 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-bold rounded shadow-lg"
                    >
                      DOWNLOAD & INSTALL
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest">Installed Applications</h3>
              <div className="grid grid-cols-2 gap-3">
                {installedGames.map(game => (
                  <div key={game} className="bg-[#222] border border-white/5 p-3 rounded flex items-center justify-between group hover:border-purple-500/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-purple-500/20 rounded flex items-center justify-center">
                        <Package className="text-purple-400" size={16} />
                      </div>
                      <div>
                        <div className="font-bold text-xs uppercase">{game}</div>
                        <div className="text-[9px] text-gray-500">Linux Native Binary</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setRunOptions({ active: true, filename: game, mode: null, phase: 'menu' })}
                      className="opacity-0 group-hover:opacity-100 px-2 py-1 bg-purple-600 text-[9px] font-bold rounded"
                    >
                      LAUNCH
                    </button>
                  </div>
                ))}
                {installedGames.length === 0 && (
                  <div className="col-span-2 py-10 text-center border-2 border-dashed border-white/5 rounded-lg text-gray-600 italic">
                    No software installed yet.
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-[#111] p-2 px-4 text-[9px] text-gray-500 flex justify-between">
            <span>VCOS_PACKAGE_MANAGER v1.0</span>
            <span>STORAGE: {(vfs.getUsedMemory() / 1024 / 1024).toFixed(2)}MB / 1024MB</span>
          </div>
        </div>
      )}

      {/* Terminal Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin scrollbar-thumb-[#333]">
        {history.map((line, i) => (
          <div 
            key={i} 
            className={`whitespace-pre-wrap leading-relaxed ${
              line.type === 'cmd' ? 'text-white font-bold' : 
              line.type === 'error' ? 'text-red-400' : 
              line.type === 'success' ? 'text-green-400' : 
              line.type === 'system' ? 'text-purple-400 font-bold text-[15px] mb-2' :
              line.type === 'dim' ? 'text-gray-600 italic' :
              'text-[#aaa]'
            }`}
          >
            {line.text}
          </div>
        ))}
        
        <div className="flex items-center gap-2 pt-1">
          <span className="text-green-400 font-bold">{user}@{hostname}</span>
          <span className="text-white">:</span>
          <span className="text-blue-400 font-bold">{cwd}</span>
          <span className="text-white">{user === 'root' ? '#' : '$'}</span>
          <input
            autoFocus
            className="flex-1 bg-transparent outline-none border-none text-white font-bold caret-purple-500"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCommand(input);
                setInput('');
              }
            }}
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </div>

      {/* Footer / Quick Actions */}
      <div className="bg-[#1e1e1e] p-1 flex gap-2 border-t border-[#333]">
        <button 
          onClick={() => setShowSoftwareCenter(true)}
          className="px-2 py-0.5 hover:bg-[#333] rounded text-[10px] flex items-center gap-1 text-purple-400 font-bold"
        >
          <Package size={10} /> Software Center
        </button>
        <button className="px-2 py-0.5 hover:bg-[#333] rounded text-[10px] flex items-center gap-1">
          <Shield size={10} /> sudo
        </button>
        <button className="px-2 py-0.5 hover:bg-[#333] rounded text-[10px] flex items-center gap-1">
          <Globe size={10} /> network
        </button>
      </div>
    </div>
  );
};
