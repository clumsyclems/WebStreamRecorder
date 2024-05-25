import {contextBridge, ipcRenderer} from 'electron';

contextBridge.exposeInMainWorld('versions', {
  node: () => process.versions.node,
  chrome: () => process.versions.chrome,
  electron: () => process.versions.electron,
  ping:() => ipcRenderer.invoke('ping'),
  fillRecordingArray: () => ipcRenderer.invoke('fillRecordingArray'),
  changeOnlineStatus: (name, status) => ipcRenderer.invoke('changeOnlineStatus', {name, status}),
  removeARowFromName: (name) => ipcRenderer.invoke('removeARowFromName', name),
  addNewModel: (model) => ipcRenderer.invoke('addNewModel',model),
  updateModelStatus: (callback) => ipcRenderer.on('updateModelStatus', (event, model, status) => 
  {
    callback(model, status);
  }),

  updateModelOnlineStatus: (modelUrl) => ipcRenderer.send('updateModelOnlineStatus', {modelUrl}),

  ready: () => ipcRenderer.send('Ready')
});