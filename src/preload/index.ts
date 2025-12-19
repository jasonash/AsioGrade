import { contextBridge, ipcRenderer } from 'electron'

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,

  // IPC methods for service calls
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    // Whitelist of allowed channels
    const validChannels = [
      'auth:login',
      'auth:logout',
      'auth:getStatus',
      'drive:listFiles',
      'drive:uploadFile',
      'drive:downloadFile',
      'storage:get',
      'storage:set',
      'llm:generate',
      'pdf:parse',
      'grade:process'
    ]
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args)
    }
    return Promise.reject(new Error(`Invalid channel: ${channel}`))
  },

  // Event listeners
  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const validChannels = ['auth:statusChanged', 'sync:progress', 'sync:error']
    if (validChannels.includes(channel)) {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: unknown[]): void => {
        callback(...args)
      }
      ipcRenderer.on(channel, subscription)
      return () => {
        ipcRenderer.removeListener(channel, subscription)
      }
    }
    return () => {}
  }
})

// Type declarations for the exposed API
export interface ElectronAPI {
  platform: NodeJS.Platform
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
