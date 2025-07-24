const express = require('express');
const cors = require('cors'); 

const app = express();
const port = 7000;

app.use(cors()); 
app.use(express.json());

app.post('/receive-command', (req, res) => {
  const { message, cameraIp } = req.body;

  if (!message || !cameraIp) {
    console.error('Invalid request: Missing message or cameraIp');
    return res.status(400).json({ error: 'Missing message or cameraIp' });
  }

  console.log(`Received command: "${message}"`);
  console.log(`From Camera IP: ${cameraIp}`);

  res.status(200).json({ message: 'Command received successfully' });
});

app.listen(port, () => {
  console.log(`Receiver server running at http://localhost:${port}`);
});
