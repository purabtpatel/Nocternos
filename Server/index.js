require('dotenv').config();
const express = require('express');
const { restClient } = require('@polygon.io/client-js');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const port = 3000;

const POLYGON_API_KEY = process.env.POLYGON_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const rest = restClient(POLYGON_API_KEY);

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);

app.use(express.json());

app.get('/api/financials', async (req, res) => {
  try {
    const { ticker, timeframe = 'annual', order: order_val = 'asc', limit: limit_val = 100, sort = 'filing_date' } = req.query;

    console.log('\n--- Incoming Request ---');
    console.log('Params:', { ticker, timeframe, order_val, limit_val, sort });

    if (!ticker) {
      console.warn('Missing "ticker" in request');
      return res.status(400).json({ error: 'Ticker is required' });
    }

    // Step 1: Try to fetch from Supabase cache
    const { data: cacheData, error: cacheError } = await supabase
      .from('financials_cache')
      .select('cached_data, updated_at')
      .eq('ticker', ticker)
      .eq('timeframe', timeframe)
      .eq('order_val', order_val)
      .eq('limit_val', parseInt(limit_val))
      .eq('sort', sort)
      .single();

    if (cacheError) {
      console.warn('Supabase cache query error:', cacheError);
    } else {
      console.log('Supabase cache data:', cacheData ? 'Found' : 'Not Found');
    }

    const isStale = cacheData && (new Date() - new Date(cacheData.updated_at)) > 24 * 60 * 60 * 1000;
    if (cacheData && !isStale) {
      console.log('✅ Returning cached financial data');
      return res.json({ ...cacheData.cached_data, fromCache: true });
    } else if (isStale) {
      console.log('⚠️ Cache is stale, refetching...');
    }

    // Step 2: Fetch from Polygon API
    console.log('Fetching fresh data from Polygon API...');
    const data = await rest.reference.stockFinancials({
      ticker,
      timeframe,
      order: order_val,
      limit: parseInt(limit_val),
      sort
    });
    console.log('✅ Polygon API response received');

    // Step 3: Upsert into Supabase
    const { error: upsertError } = await supabase
      .from('financials_cache')
      .upsert({
        ticker,
        timeframe,
        order_val,
        limit_val: parseInt(limit_val),
        sort,
        cached_data: data,
        updated_at: new Date().toISOString()
      }, { onConflict: ['ticker', 'timeframe', 'order_val', 'limit_val', 'sort'] });

    if (upsertError) {
      console.error('❌ Supabase upsert error:', upsertError);
    } else {
      console.log('✅ Data cached in Supabase');
    }

    res.json({ ...data, fromCache: false });

  } catch (error) {
    console.error('❌ Error fetching financials:', error);
    res.status(500).json({ error: 'Failed to fetch financial data', details: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
