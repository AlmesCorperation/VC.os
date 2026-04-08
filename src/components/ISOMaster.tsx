import React, { useState, useEffect } from 'react';
import { HardDrive, Disc, Save, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { vfs } from '../services/vfs';
import { libarchive } from '../services/libarchive';
import { kernel } from '../services/kernel';

export const ISOMaster: React.FC = () => {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [isoName, setIsoName] = useState('vcos_system_backup.iso');
  const [buildMode, setBuildMode] = useState<'standard' | 'baremetal'>('standard');

  useEffect(() => {
    const allFiles = vfs.ls();
    setFiles(allFiles);
    setSelectedFiles(new Set(allFiles));
  }, []);

  const toggleFile = (file: string) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(file)) {
      newSelected.delete(file);
    } else {
      newSelected.add(file);
    }
    setSelectedFiles(newSelected);
  };

  const createISO = async () => {
    if (selectedFiles.size === 0) return;
    
    setIsCreating(true);
    setStatus('idle');
    kernel.emitEvent('TASK', `ISO_MASTER: STARTING_BUILD [${isoName}]`);

    try {
      // Simulate a bit of work
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (buildMode === 'baremetal') {
        kernel.emitEvent('TASK', 'ISO_MASTER: RUNNING_MAKE');
        vfs.make();
        await libarchive.writeArchive(isoName, ['kernel.bin', 'boot.s', 'linker.ld', 'gdt.cpp', 'idt.cpp'], 'iso');
      } else {
        await libarchive.writeArchive(isoName, Array.from(selectedFiles), 'iso');
      }
      
      setStatus('success');
      kernel.emitEvent('TASK', `ISO_MASTER: BUILD_COMPLETE [${isoName}]`);
    } catch (e) {
      console.error(e);
      setStatus('error');
      kernel.emitEvent('CRITICAL', `ISO_MASTER: BUILD_FAILED [${isoName}]`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-win95-gray font-sans text-[11px]">
      <div className="p-2 bg-win95-dark-gray text-white font-bold flex items-center gap-2 border-b border-white">
        <Disc size={16} />
        ISO_MASTER.EXE - System Archive Utility
      </div>

      <div className="flex-1 flex gap-2 p-2 overflow-hidden">
        {/* File List */}
        <div className="flex-1 flex flex-col border-inset bg-white overflow-hidden">
          <div className="p-1 bg-win95-gray border-b border-win95-dark-gray font-bold text-[9px] flex justify-between">
            <span>FILES_TO_INCLUDE</span>
            <span>{selectedFiles.size} / {files.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            {files.map(file => (
              <label key={file} className="flex items-center gap-2 p-1 hover:bg-win95-blue/10 cursor-pointer border-b border-win95-gray/10">
                <input 
                  type="checkbox" 
                  checked={selectedFiles.has(file)} 
                  onChange={() => toggleFile(file)}
                  className="w-3 h-3"
                />
                <span className={vfs.getFile(file)?.isCritical ? 'font-bold text-red-700' : ''}>
                  {file}
                </span>
                {vfs.getFile(file)?.isCritical && <span className="text-[8px] opacity-50">[SYSTEM]</span>}
              </label>
            ))}
          </div>
        </div>

        {/* Controls */}
        <div className="w-48 flex flex-col gap-4">
          <div className="border-inset bg-white p-3 space-y-3">
            <div className="font-bold border-b border-win95-gray pb-1">ARCHIVE_SETTINGS</div>
            <div className="space-y-1">
              <label className="text-[9px] text-gray-600 block">OUTPUT_FILENAME:</label>
              <input 
                type="text" 
                value={isoName}
                onChange={(e) => setIsoName(e.target.value)}
                className="w-full bg-white border-inset p-1 outline-none focus:ring-1 focus:ring-win95-blue"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-gray-600 block">BUILD_MODE:</label>
              <select 
                value={buildMode}
                onChange={(e) => setBuildMode(e.target.value as any)}
                className="w-full bg-white border-inset p-1 outline-none focus:ring-1 focus:ring-win95-blue text-[10px]"
              >
                <option value="standard">Standard Archive</option>
                <option value="baremetal">Bare-metal Boot (i386)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] text-gray-600 block">FORMAT:</label>
              <div className="font-bold text-blue-800">
                {buildMode === 'baremetal' ? 'ISO 9660 + El Torito' : 'ISO 9660 (Standard)'}
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-end gap-2">
            {status === 'success' && (
              <div className="p-2 bg-green-100 border border-green-600 text-green-800 flex items-center gap-2 animate-in fade-in">
                <CheckCircle size={14} />
                <span>ISO Created Successfully!</span>
              </div>
            )}
            {status === 'error' && (
              <div className="p-2 bg-red-100 border border-red-600 text-red-800 flex items-center gap-2 animate-in fade-in">
                <AlertTriangle size={14} />
                <span>Build Failed.</span>
              </div>
            )}

            <button 
              onClick={createISO}
              disabled={isCreating || selectedFiles.size === 0}
              className="w-full py-3 bg-win95-gray border-outset font-bold flex items-center justify-center gap-2 active:border-inset disabled:opacity-50"
            >
              {isCreating ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isCreating ? 'COMPILING...' : 'BUILD_ISO'}
            </button>
          </div>
        </div>
      </div>

      <div className="p-2 bg-win95-gray border-t border-white flex items-center gap-4 text-[9px] text-win95-dark-gray">
        <div className="flex items-center gap-1">
          <HardDrive size={12} />
          <span>VFS_SOURCE: /</span>
        </div>
        <div className="flex items-center gap-1">
          <Disc size={12} />
          <span>TARGET: {isoName}</span>
        </div>
      </div>
    </div>
  );
};
