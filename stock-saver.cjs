const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase using environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_CREDS);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const ALPHA_VANTAGE_API_KEY = 'YOUR_ALPHA_VANTAGE_API_KEY'; // Replace with your key
const STOCK_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA'];

async function fetchAndSaveStockData() {
  try {
    const db = admin.firestore();
    const batch = db.batch();
    const timestamp = admin.firestore.FieldValue.serverTimestamp();

    for (const symbol of STOCK_SYMBOLS) {
      // Fetch stock data from Alpha Vantage API
      const { data } = await axios.get(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
      );

      if (data['Global Quote']) {
        const quote = data['Global Quote'];
        const stockData = {
          symbol: quote['01. symbol'],
          price: quote['05. price'],
          change: quote['09. change'],
          changePercent: quote['10. change percent'],
          open: quote['02. open'],
          high: quote['03. high'],
          low: quote['04. low'],
          volume: quote['06. volume'],
          latestTradingDay: quote['07. latest trading day'],
          previousClose: quote['08. previous close'],
          updatedAt: timestamp
        };

        // Save to both current data and historical data
        const currentRef = db.collection('stocks').doc(symbol);
        batch.set(currentRef, stockData);

        const historyRef = db.collection('stocksHistory').doc(`${symbol}_${Date.now()}`);
        batch.set(historyRef, stockData);
      }
    }

    await batch.commit();
    console.log('Stock data saved successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchAndSaveStockData();
