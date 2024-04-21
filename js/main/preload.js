const { contextBridge, ipcRenderer} = require('electron')

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  ping:() => ipcRenderer.invoke('ping'),
  fillRecordingArray: () => ipcRenderer.invoke('fillRecordingArray'),
  changeRecordingStatus: (name, status) => ipcRenderer.invoke('changeRecordingStatus', {name, status}),
  removeARowFromName: (name) => ipcRenderer.invoke('removeARowFromName', name),
  addNewModel: (model) => ipcRenderer.invoke('addNewModel',model),
  // we can also expose variables, not just functions
})