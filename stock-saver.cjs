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

if (!ALPHA_VANTAGE_API_KEY) {
  throw new Error('Alpha Vantage API key is missing. Please set the ALPHA_VANTAGE_API_KEY environment variable.');
}

function getFormattedTimestamp() {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
  return `${dateStr}_${timeStr}`;
}

async function fetchAndSaveStockData() {
  try {
    const db = admin.firestore();
    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();
    const formattedTimestamp = getFormattedTimestamp();

    for (const symbol of STOCK_SYMBOLS) {
      // Fetch stock data from Alpha Vantage API
      const { data } = await axios.get(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`,
        { timeout: 10000 } // 10 second timeout
      );

      if (data['Global Quote']) {
        const quote = data['Global Quote'];
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

        // Save to both current data and historical data
        const currentRef = db.collection('stocks').doc(symbol);
        batch.set(currentRef, stockData);

        // Use symbol_date_time format for historical records
        const historyRef = db.collection('stocksHistory')
          .doc(`${symbol}_${formattedTimestamp}`);
        batch.set(historyRef, stockData);
      }
    }

    await batch.commit();
    console.log(`Stock data saved successfully at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1); // Exit with error code to fail the GitHub Action
  }
}

fetchAndSaveStockData();
