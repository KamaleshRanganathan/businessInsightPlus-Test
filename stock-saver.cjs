const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase using environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDS);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Get API key from environment variable
const ALPHA_VANTAGE_API_KEY = process.env.ALPHA_VANTAGE_API_KEY;
const STOCK_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'];
const MARKET_INDEXES = [
  { symbol: 'SPY', name: 'S&P 500' },
  { symbol: 'DIA', name: 'Dow Jones' }, 
  { symbol: 'QQQ', name: 'NASDAQ' }
];

if (!ALPHA_VANTAGE_API_KEY) {
  throw new Error('Alpha Vantage API key is missing. Please set the ALPHA_VANTAGE_API_KEY environment variable.');
}

function getFormattedTimestamp() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
  return `${dateStr}_${timeStr}`;
}

async function fetchStockQuote(symbol) {
  try {
    const { data } = await axios.get(
      `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`,
      { timeout: 10000 }
    );
    return data['Global Quote'] || null;
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error);
    return null;
  }
}

async function fetchAndSaveData() {
  try {
    const db = admin.firestore();
    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const formattedTimestamp = getFormattedTimestamp();

    // Process individual stocks
    for (const symbol of STOCK_SYMBOLS) {
      const quote = await fetchStockQuote(symbol);
      if (quote) {
        const stockData = {
          symbol: quote['01. symbol'],
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: quote['10. change percent'],
          open: parseFloat(quote['02. open']),
          high: parseFloat(quote['03. high']),
          low: parseFloat(quote['04. low']),
          volume: parseInt(quote['06. volume']),
          latestTradingDay: quote['07. latest trading day'],
          previousClose: parseFloat(quote['08. previous close']),
          updatedAt: timestamp,
          timestamp: formattedTimestamp
        };

        const currentRef = db.collection('stocks').doc(symbol);
        batch.set(currentRef, stockData);

        const historyRef = db.collection('stocksHistory').doc(`${symbol}_${formattedTimestamp}`);
        batch.set(historyRef, stockData);
      }
    }

    // Process market indexes
    for (const index of MARKET_INDEXES) {
      const quote = await fetchStockQuote(index.symbol);
      if (quote) {
        const indexData = {
          symbol: index.symbol,
          name: index.name,
          price: parseFloat(quote['05. price']),
          change: parseFloat(quote['09. change']),
          changePercent: quote['10. change percent'],
          updatedAt: timestamp,
          timestamp: formattedTimestamp
        };

        const currentRef = db.collection('marketIndexes').doc(index.symbol);
        batch.set(currentRef, indexData);

        const historyRef = db.collection('marketIndexesHistory').doc(`${index.symbol}_${formattedTimestamp}`);
        batch.set(historyRef, indexData);
      }
    }

    await batch.commit();
    console.log(`Stock and market data saved successfully at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fetchAndSaveData();
