const express = require('express');
const app = express();
app.use(express.json());

let trvState = {
  id: 100,
  name: 'Sim TRV',
  battery: 90,
  online: true,
  current_C: 20.0,
  target_C: 21.0,
  pos: 42
};

app.get('/status', (req, res) => {
  res.json({ ble: { devices: [{ type: 'trv', id: trvState.id, name: trvState.name, battery: trvState.battery, online: trvState.online }] } });
});

app.get(/^\/rpc\/BluTrv\.call.*/, (req, res) => {
  // the plugin sometimes calls /rpc/BluTrv.call&id=... (no ?), so parse manually
  const raw = req.originalUrl || '';
  const queryString = raw.includes('?') ? raw.split('?')[1] : (raw.includes('&') ? raw.split('&').slice(1).join('&') : '');
  const params = Object.fromEntries(new URLSearchParams(queryString));
  const id = Number(params.id || req.query.id);
  const method = params.method || req.query.method;
  if (id !== trvState.id) return res.status(404).json({ error: 'device not found' });

  if (method === 'TRV.GetStatus') {
    return res.json({ current_C: trvState.current_C, target_C: trvState.target_C, pos: trvState.pos });
  }
  if (method === 'TRV.SetTarget') {
    const p = params.params ? JSON.parse(params.params) : (req.query.params ? JSON.parse(req.query.params) : {});
    if (typeof p.target_C === 'number') {
      trvState.target_C = p.target_C;
      trvState.pos = Math.round((trvState.target_C - 10) * 5) % 100;
    }
    return res.json({ ok: true });
  }
  return res.status(400).json({ error: 'unknown method' });
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log('Fake Shelly BLU gateway listening on port', port));
