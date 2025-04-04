import { app, Tray, Menu, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchEpochData } from './src/epochTracker.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let tray = null;
let currentNetwork = 'mainnet';

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'extension-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({
    width: 24,
    height: 16,
    quality: 'best'
  });
  
  tray = new Tray(icon);
  
  // Set initial tooltip
  tray.setToolTip('Solana Epoch Tracker');
  
  // Initial update
  updateEpochInfo();
  
  // Update every minute
  setInterval(updateEpochInfo, 60000);
  
  // Create context menu
  const contextMenu = Menu.buildFromTemplate([
    { 
      label: 'Mainnet', 
      type: 'radio', 
      checked: currentNetwork === 'mainnet',
      click: () => switchNetwork('mainnet')
    },
    { 
      label: 'Testnet', 
      type: 'radio', 
      checked: currentNetwork === 'testnet',
      click: () => switchNetwork('testnet')
    },
    { 
      label: 'Devnet', 
      type: 'radio', 
      checked: currentNetwork === 'devnet',
      click: () => switchNetwork('devnet')
    },
    { type: 'separator' },
    { 
      label: 'Quit', 
      click: () => app.quit() 
    }
  ]);
  
  tray.setContextMenu(contextMenu);
}

async function updateEpochInfo() {
  try {
    const epochInfo = await fetchEpochData(currentNetwork);
    if (epochInfo) {
      const { epoch, progress, remainingTime, status } = epochInfo;
      
      // Format progress to always have 2 decimal places
      const formattedProgress = Number(progress).toFixed(2);
      
      // Capitalize first letter of network name
      const networkName = currentNetwork.charAt(0).toUpperCase() + currentNetwork.slice(1);
      
      // Use a fixed-width format for the title with network, epoch and progress
      const title = ` ${networkName} Epoch ${epoch}: ${formattedProgress}%`;
      tray.setTitle(title, {
        fontType: 'monospacedDigit'
      });
      
      // Set detailed information in tooltip
      tray.setToolTip(
        `Network: ${networkName}\n` +
        `Epoch: ${epoch}\n` +
        `Progress: ${formattedProgress}%\n` +
        `Remaining: ${remainingTime}\n` +
        `Status: ${status}`
      );
    }
  } catch (error) {
    console.error('Failed to update epoch info:', error);
    tray.setTitle('Error');
    tray.setToolTip('Failed to fetch epoch data');
  }
}

function switchNetwork(network) {
  currentNetwork = network;
  updateEpochInfo();
}

// Prevent the app from closing when all windows are closed
app.on('window-all-closed', (e) => {
  e.preventDefault();
});

// Create tray when app is ready
app.whenReady().then(createTray); 