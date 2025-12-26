# Homebridge Shelly BLU TRV

**Homebridge plugin for Shelly BLU Thermostatic Radiator Valve (TRV) devices  
via the Shelly BLU Gateway Gen3**

This plugin exposes Shelly BLU TRV devices to Apple HomeKit using a local Shelly BLU Gateway Gen3.  
It supports temperature sensing, target temperature control, valve position, and battery monitoring.

## 🛠️ Features

✔ Read **current temperature**  
✔ Control **target temperature**  
✔ Show **valve position** (0–100 %)  
✔ Show **battery level**  
✔ Works locally via **Shelly BLU Gateway Gen3 HTTP RPC API** :contentReference[oaicite:0]{index=0}

---

## 📦 Installation

Install the plugin globally on your Homebridge host:

```bash
sudo npm install -g homebridge-shelly-blu-trv-js
````

Then restart Homebridge or your Homebridge UI service.

---

## ⚙️ Homebridge Configuration

Add the platform configuration to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "platform": "ShellyBluTrv",
      "name": "Shelly BLU TRV",
      "gatewayIP": "192.168.1.50",
      "trvIds": [200, 201]
    }
  ]
}
```

| Option      | Required | Description                                    |
| ----------- | -------- | ---------------------------------------------- |
| `gatewayIP` | ✅        | IP of your Shelly BLU Gateway Gen3             |
| `trvIds`    | ✅        | Array of TRV component IDs (from your gateway) |

The gateway serves as a bridge between Homebridge and BLE‑paired TRV devices. ([Shelly API Docs][1])

---

## 📱 HomeKit Support

Once configured, each TRV is exposed as a thermostat accessory in HomeKit with:

* ➤ **Current Temperature**
* ➤ **Target Temperature**
* ➤ **Valve Position** (shown as Occupancy/Active indicator)
* ➤ **Battery Level**

This allows Siri and the Home app to monitor and control radiator valve thermostats.

---

## 📘 How It Works

The plugin uses the Shelly BLU Gateway RPC endpoints to interact with BLU TRV devices:

* **Retrieve status** using
  `GET http://<gateway_ip>/rpc/BluTrv.GetRemoteStatus?id=<TRV_ID>`
  Includes current/target temperatures, valve position, battery, etc. ([Shelly API Docs][1])

* **Set target temperature** using
  `GET http://<gateway_ip>/rpc/BluTrv.Call?id=<TRV_ID>&method=TRV.SetTarget&params=…`

All commands are local and do **not** require internet connectivity.

---

## 🧩 Example Response

A TRV status response includes:

```json
{
  "status":{
    "trv:0":{
      "current_C":23.5,
      "target_C":21,
      "pos":45,
      "battery":87,
      "rssi":-60
    }
  }
}
```

From this, the plugin extracts:

* `current_C` → HomeKit Current Temp
* `target_C` → HomeKit Target Temp
* `pos` → Valve Position indicator
* `battery` → Battery Level

---

## 📍 Valve Position Representation

HomeKit doesn’t provide a native *valve position %* characteristic, so valve position is shown using a sensor (e.g., Occupancy or custom), representing **open vs closed**.

You can customize this in 3rd‑party apps if desired.

---

## ❗ Limitations

* Shelly BLU TRV must be paired with a **Shelly BLU Gateway Gen3** to be reachable. ([Shelly API Docs][1])
* Valve position % is not exposed as a native percentage slider in Apple Home — instead it appears as a binary indicator.

---

## 🧪 Troubleshooting

🔹 Make sure the Shelly BLU Gateway and TRVs are on the **same LAN** as your Homebridge host.
🔹 Ensure Gateway IP in the config is correct and reachable from Homebridge.
🔹 Use the Shelly app or web interface to verify TRV pairing before Homebridge integration.

---

## 🧑‍💻 Development & Contribution

Contributions are welcome!
Please follow Homebridge development guidelines when adding features or fixes. ([GitHub][2])

api-docs.shelly.cloud/gen2/Devices/Gen3/ShellyBluGwG3?utm_source=chatgpt.com "Shelly BLU Gateway Gen3 | Shelly Technical Documentation"
[2]: https://github.com/homebridge/homebridge-plugin-template?utm_source=chatgpt.com "GitHub - homebridge/homebridge-plugin-template: A template you can use to create your own Homebridge plugins."
