const NETWORKS = {
  mainnet: "https://api.mainnet-beta.solana.com",
  testnet: "https://api.testnet.solana.com",
  devnet: "https://api.devnet.solana.com",
};

const STATUS_TEXT = {
  progressing: "Progressing",
  halted: "Halted",
  unknown: "Unknown",
};

let currentSlot = null;
let previousSlot = null;

async function fetchEpochData(network) {
  const maxRetries = 3;
  let attempts = 0;

  while (attempts < maxRetries) {
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(NETWORKS[network], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getEpochInfo",
        }),
      });

      const data = await response.json();
      if (!data.result) throw new Error("Invalid response from API");

      const { epoch, slotIndex, slotsInEpoch, absoluteSlot } = data.result;
      const remainingSlots = slotsInEpoch - slotIndex;
      const timePerSlot = 0.4; // Solana's average slot time in seconds
      const remainingSeconds = Math.floor(remainingSlots * timePerSlot);

      // Calculate progress percentage
      const progress = ((slotIndex / slotsInEpoch) * 100).toFixed(2);

      // Determine status
      let status = STATUS_TEXT.unknown;
      if (currentSlot !== null) {
        if (absoluteSlot > currentSlot) {
          status = STATUS_TEXT.progressing;
        } else if (absoluteSlot <= currentSlot) {
          status = STATUS_TEXT.halted;
        }
      } else {
        status = STATUS_TEXT.progressing;
      }

      // Update slots
      previousSlot = currentSlot;
      currentSlot = absoluteSlot;

      return {
        epoch,
        progress,
        remainingTime: formatTime(remainingSeconds),
        status,
      };
    } catch (error) {
      attempts++;
      console.error(`Attempt ${attempts} failed:`, error.message);

      if (attempts >= maxRetries) {
        throw new Error("Failed to fetch epoch data after multiple attempts");
      }
    }
  }
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs}h ${mins}m ${secs}s`;
}

export { fetchEpochData }; 