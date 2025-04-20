const admin = require('firebase-admin');
const axios = require('axios');

// Initialize Firebase
const serviceAccount = require('./firebase-creds.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const NEWS_API_KEY = '6b688c16d3fc4837bbad8aeb8e22c31b';

async function fetchAndSaveNews() {
  try {
    // 1. Fetch news
    const { data } = await axios.get(
      `https://newsapi.org/v2/top-headlines?country=us&pageSize=10&apiKey=${NEWS_API_KEY}`
    );

    // 2. Save to Firestore
    const batch = admin.firestore().batch();
    data.articles.forEach(article => {
      const ref = admin.firestore().collection('news').doc();
      batch.set(ref, {
        title: article.title,
        url: article.url,
        imageUrl: article.urlToImage || null,
        publishedAt: new Date(article.publishedAt),
        savedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await batch.commit();
    console.log('News saved successfully!');
  } catch (error) {
    console.error('Error:', error);
  }
}

fetchAndSaveNews();
