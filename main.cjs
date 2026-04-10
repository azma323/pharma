const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 768,
    // আপনার লোগো থাকলে এখানে পাথ দিন
    // icon: path.join(__dirname, 'public/logo.png'), 
    autoHideMenuBar: true, // উপরের ফাইল, এডিট মেনু হাইড করবে
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // React এর বিল্ড ফোল্ডার থেকে ফাইল লোড করবে
  // দ্রষ্টব্য: আপনি যদি Vite ব্যবহার করেন তবে এটি 'dist' হবে, CRA হলে 'build' হবে।
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});