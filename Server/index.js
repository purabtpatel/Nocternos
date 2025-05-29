require('dotenv').config();
const express = require('express');
const { restClient } = require('@polygon.io/client-js');

const app = express();
const port = 3000;

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const rest = restClient(POLYGON_API_KEY);


app.use(express.json());

// Endpoint to fetch stock financials
app.get('/api/financials', async (req, res) => {
  try {
    const { ticker, timeframe, order, limit, sort } = req.query;

    if (!ticker) {
      return res.status(400).json({ error: 'Ticker is required' });
    }

    const params = {
      ticker,
      timeframe: timeframe || 'annual',
      order: order || 'asc',
      limit: parseInt(limit) || 100,
      sort: sort || 'filing_date'
    };

    const data = await rest.reference.stockFinancials(params);

    res.json(data);
  } catch (error) {
    console.error('Error fetching financials:', error);
    res.status(500).json({ error: 'Failed to fetch financial data' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});