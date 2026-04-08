import { useState, useEffect } from 'react';

class SettingsStore {
  private listeners: Set<() => void> = new Set();
  public performanceMode: boolean = true;

  constructor() {
    const saved = localStorage.getItem('vcos_performance_mode');
    if (saved) {
      try {
        this.performanceMode = JSON.parse(saved);
      } catch (e) {}
    }
  }

  setPerformanceMode(value: boolean) {
    this.performanceMode = value;
    localStorage.setItem('vcos_performance_mode', JSON.stringify(value));
    this.notify();
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private notify() {
    this.listeners.forEach(l => l());
  }
}

export const settingsStore = new SettingsStore();

export const useSettings = () => {
  const [performanceMode, setPerformanceMode] = useState(settingsStore.performanceMode);

  useEffect(() => {
    return settingsStore.subscribe(() => {
      setPerformanceMode(settingsStore.performanceMode);
    });
  }, []);

  return { 
    performanceMode, 
    setPerformanceMode: (val: boolean) => settingsStore.setPerformanceMode(val) 
  };
};
