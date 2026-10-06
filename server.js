const express = require("express");
const { loginDeviceByIp } = require("tp-link-tapo-connect");
// const record = require("node-record-lpcm16");
// const { Transform } = require("stream");

require("dotenv").config();

const app = express();
const PORT = 3000;

// Settings params
const email = process.env.TAPO_EMAIL;
const password = process.env.TAPO_PASSWORD;
const deviceIp = process.env.TAPO_DEVICE_IP;
const districtSlug = process.env.DISTRICT_SLUG;

const ALERT_URL = `https://tryvoha.online/api/v1/alerts/${districtSlug}`; 

let device;
let lightOn = false;
let lastSoundTime = 0;
let activationTime = 120000;

// --- connecting to the bulb ---
async function init() {
  try {
    console.log("🔌 Connecting to the bulb...");
    device = await loginDeviceByIp(email, password, deviceIp);
    console.log("✅ Connected successfully!");

    startAlertPolling();

    // Starting the mic monitoring
    // startMicMonitor();

    // Each 500 ms check for silence
    // setInterval(checkSilence, 500);
  } catch (err) {
    console.error("An error while connecting the bulb:", err);
  }
}

// --- monitoring the mic volume ---
// function startMicMonitor() {
//   console.log("🎤 Mic starting...");

//   const meter = new Transform({
//     transform(chunk, enc, callback) {
//       let sum = 0;
//       for (let i = 0; i < chunk.length; i += 2) {
//         const val = chunk.readInt16LE(i) / 32768;
//         sum += val * val;
//       }
//       const rms = Math.sqrt(sum / (chunk.length / 2));
//       const volume = rms.toFixed(3);

//       if (volume > 0.05) {
//         console.log('Sound')
//         handleSoundDetected();
//       } else {
//         console.log('Silence')
//         handleSilence();
//       }

//       callback();
//     },
//   });

//   // record
//   //   .record({
//   //     sampleRateHertz: 16000,
//   //     threshold: 0,
//   //     verbose: false,
//   //     recordProgram: "sox", // or "rec"
//   //   })
//   //   .stream()
//   //   .pipe(meter);
// }

// --- Handle sound detection ---
// async function handleSoundDetected() {
//   const now = Date.now();
//   lastSoundTime = now;

//   if (!lightOn && device) {
//     lightOn = true;
//     await device.turnOn();
//     console.log("💡 Light turned on!");
//   }
// }

// function handleSilence() {
//   // just mark the fact of silence (without a timer)
//   isSilent = true;
// }

// --- Check for silence prolonged ---
// async function checkSilence() {
//   const now = Date.now();
//   const silenceDuration = now - lastSoundTime;

//   if (silenceDuration > activationTime && lightOn && device) {
//     lightOn = false;
//     await device.turnOff();
//     console.log("💤 Silence — light turned off.");
//   }
// }

let previousAlertState = null;

async function checkAirRaidAlert() {
  try {
    console.log("Checking for air raid alert...");

    const response = await fetch(ALERT_URL);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    const isAlertActive = data.active === true;
    
    if (previousAlertState === null) {
      previousAlertState = isAlertActive;
      console.log( isAlertActive ? "🚨 Alert is active" : "✅ Currently no alert" );
      return;
    }

    // Alert is activated
    if (!previousAlertState && isAlertActive) {
      console.log("🚨 Alert started");
      await setRedLight();
    }
    
    // Alert is over
    if (previousAlertState && !isAlertActive) {
      console.log("✅ Alert ended");
      await setWarmLight();
    }
    previousAlertState = isAlertActive;
  } catch (error) {
    console.error("❌ Error while checking alert:", error.message);
  }
}

function startAlertPolling() {
  checkAirRaidAlert();
  setInterval(checkAirRaidAlert, 10_000);
}


async function setRedLight() {
  if (!device) return;

  await device.setColour("red");
  await device.setBrightness(50);

  console.log("🔴 Red colour, brightness 50%");
}

async function setWarmLight() {
  if (!device) return;

  await device.setColour("warmwhite");
  await device.setBrightness(100);

  console.log("💡 Warm white, brightness 100%");
}

// --- Manual control routes ---
app.get("/on", async (req, res) => {
  try {
    await device.turnOn();
    lightOn = true;
    res.send("💡 Light turned on!");
  } catch (e) {
    res.status(500).send("Error turning on the light");
  }
});

app.get("/off", async (req, res) => {
  try {
    await device.turnOff();
    lightOn = false;
    res.send("💤 Light turned off!");
  } catch (e) {
    res.status(500).send("Error turning off the light");
  }
});

app.get("/red", async (req, res) => {
  try {
    await setRedLight();
    res.send("🔴 Light set to red!");
  } catch (e) {
    console.error(e);
    res.status(500).send("Error setting red light");
  }
});

app.get("/warm", async (req, res) => {
  try {
    await setWarmLight();
    res.send("💡 Light set to warm white!");
  } catch (e) {
    console.error(e);
    res.status(500).send("Error setting warm light");
  }
});


app.listen(PORT, () => {
  console.log(`🚀 Server started: http://localhost:${PORT}`);
  init();
});
