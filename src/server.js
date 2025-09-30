const path = require('path');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const queryRouter = require('./routes/query');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.use('/api/query', queryRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`EventHive server listening on port ${PORT}`);
});
