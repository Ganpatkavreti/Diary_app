// डिजिटल डायरी PWA सर्विस वर्कर
const CACHE_NAME = 'digital-diary-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/manifest.json',
  '/icon.png',
  '/icon-192x192.png',
  '/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.min.js',
  'https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// इंस्टॉल इवेंट
self.addEventListener('install', event => {
  console.log('सर्विस वर्कर इंस्टॉल हो रहा है...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('ऐप शैल कैशिंग की जा रही है');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// एक्टिवेट इवेंट
self.addEventListener('activate', event => {
  console.log('सर्विस वर्कर एक्टिवेट हो रहा है...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('पुराना कैश डिलीट किया जा रहा है:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// फ़ेच इवेंट (कैश विद नेटवर्क फॉलबैक)
self.addEventListener('fetch', event => {
  // क्रॉस-ओरिजिन रिक्वेस्ट्स को छोड़ें
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          console.log('कैश से सेव किया गया:', event.request.url);
          return cachedResponse;
        }

        return fetch(event.request)
          .then(response => {
            // अगर वैलिड रिस्पॉन्स नहीं है तो कैश न करें
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // रिस्पॉन्स को क्लोन करें
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
                console.log('कैश में सेव किया गया:', event.request.url);
              });

            return response;
          })
          .catch(error => {
            console.log('फ़ेच विफल; ऑफलाइन पेज लौटाया जा रहा है:', error);
            // ऑफलाइन पेज लौटाएं
            return caches.match('/');
          });
      })
  );
});

// सिंक इवेंट फॉर बैकग्राउंड सिंक
self.addEventListener('sync', event => {
  if (event.tag === 'sync-articles') {
    console.log('बैकग्राउंड सिंक शुरू हो रहा है:', event.tag);
    event.waitUntil(syncArticles());
  }
});

// बैकग्राउंड सिंक फंक्शन
async function syncArticles() {
  try {
    console.log('बैकग्राउंड सिंक: लेख सिंक हो रहे हैं');
    
    // यहां आप अपने सर्वर या GitHub Gist के साथ सिंक करेंगे
    // वर्तमान में, हम सिर्फ एक मैसेज भेजते हैं
    
    // सिंक स्थिति अपडेट करें
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: new Date().toISOString(),
        message: 'लेख सफलतापूर्वक सिंक हो गए'
      });
    });
    
  } catch (error) {
    console.error('बैकग्राउंड सिंक विफल:', error);
  }
}

// पुश नोटिफिकेशन हैंडलर
self.addEventListener('push', event => {
  console.log('पुश नोटिफिकेशन प्राप्त हुआ');
  
  const options = {
    body: event.data ? event.data.text() : 'अपनी डायरी में लिखने का दैनिक रिमाइंडर! 📖',
    icon: 'icon-192x192.png',
    badge: 'icon-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '2'
    },
    actions: [
      {
        action: 'open',
        title: 'डायरी खोलें'
      },
      {
        action: 'close',
        title: 'बंद करें'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('डिजिटल डायरी', options)
  );
});

self.addEventListener('notificationclick', event => {
  console.log('नोटिफिकेशन क्लिक किया गया:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({type: 'window'}).then(windowClients => {
        for (let client of windowClients) {
          if (client.url === '/' && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// क्लाइंट्स के साथ संवाद
self.addEventListener('message', event => {
  console.log('सर्विस वर्कर को मैसेज मिला:', event.data);
  
  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    event.ports[0].postMessage({
      type: 'CACHE_STATUS',
      cacheName: CACHE_NAME,
      cachedUrls: urlsToCache
    });
  }
});

// पेज को ऑफलाइन उपलब्ध कराना
self.addEventListener('fetch', event => {
  // केवल GET रिक्वेस्ट्स को हैंडल करें
  if (event.request.method !== 'GET') return;
  
  // एचटीएमएल पेजों के लिए नेटवर्क-फर्स्ट स्ट्रैटेजी
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return caches.match('/');
        })
    );
    return;
  }
});

// ऑफलाइन अनुभव के लिए कस्टम पेज
const offlinePage = `
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>आप ऑफलाइन हैं - डिजिटल डायरी</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            text-align: center;
            padding: 20px;
        }
        .container {
            max-width: 500px;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
        }
        p {
            font-size: 1.2rem;
            margin-bottom: 2rem;
            opacity: 0.9;
        }
        .icon {
            font-size: 4rem;
            margin-bottom: 2rem;
            animation: bounce 2s infinite;
        }
        @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">📚</div>
        <h1>आप ऑफलाइन हैं</h1>
        <p>इंटरनेट कनेक्शन बहाल होने तक कृपया प्रतीक्षा करें।</p>
        <p>आपके द्वारा किए गए परिवर्तन स्थानीय रूप से सहेजे जाएंगे और ऑनलाइन होने पर सिंक हो जाएंगे।</p>
    </div>
</body>
</html>
`;

// ऑफलाइन पेज रिस्पॉन्स
const offlineResponse = new Response(offlinePage, {
  headers: {'Content-Type': 'text/html'}
});
