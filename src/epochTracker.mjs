
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

// cache the fetch module once to avoid repeated dynamic imports. fix me with direct import? dunno about macos bars
let cachedFetch = null;
async function getFetch() {
  if (!cachedFetch) {
    cachedFetch = (await import('node-fetch')).default;
  }
  return cachedFetch;
}

async function withRetries(fn, errorMessage, maxRetries = 3) {
  let attempts = 0;
  while (attempts < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      attempts++;
      console.error(`Attempt ${attempts} failed:`, error.message);
      if (attempts >= maxRetries) {
        throw new Error(errorMessage);
      }
    }
  }
}

async function getRecentPerformanceSamples(network) {
  if (!NETWORKS[network]) {
    throw new Error(`Invalid network: ${network}`);
  }
  return withRetries(async () => {
    const fetch = await getFetch();
    const response = await fetch(NETWORKS[network], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getRecentPerformanceSamples",
      }),
    });
    const data = await response.json();
    if (!data.result || !Array.isArray(data.result) || data.result.length === 0) {
      throw new Error("Invalid response from getRecentPerformanceSamples");
    }
    const avgTimePerSlot =
      data.result.reduce(
        (total, sample) => total + sample.samplePeriodSecs / sample.numSlots,
        0
      ) / data.result.length;
    return parseFloat(avgTimePerSlot.toFixed(4));
  }, "failed to fetch performance samples after multiple attempts");
}

async function fetchEpochData(network) {
  if (!NETWORKS[network]) {
    throw new Error(`Invalid network: ${network}`);
  }
  return withRetries(async () => {
    const fetch = await getFetch();
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
    console.log(data);
    if (!data.result) throw new Error("Invalid response from API");

    const { epoch, slotIndex, slotsInEpoch, absoluteSlot } = data.result;
    const remainingSlots = slotsInEpoch - slotIndex;
    const timePerSlot = await getRecentPerformanceSamples(network);
    const remainingSeconds = Math.floor(remainingSlots * timePerSlot);
    const progress = ((slotIndex / slotsInEpoch) * 100).toFixed(2);
    const status =
      currentSlot !== null
        ? absoluteSlot > currentSlot
          ? STATUS_TEXT.progressing
          : STATUS_TEXT.halted
        : STATUS_TEXT.progressing;

    // update slot tracking
    previousSlot = currentSlot;
    currentSlot = absoluteSlot;
    return {
      epoch,
      progress,
      remainingTime: formatTime(remainingSeconds),
      timePerSlot,
      status,
    };
  }, "Failed to fetch epoch data after multiple attempts");
}

function formatTime(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${hrs}h ${mins}m ${secs}s`;
}

export { fetchEpochData };
