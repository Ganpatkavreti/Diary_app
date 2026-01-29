// ===== CONFIGURATION =====
const ADMIN_PASSWORD = 'diary2026';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB per image
const ARTICLES_PER_PAGE = 6;
const MAX_TITLE_LENGTH = 200;
const MAX_SUMMARY_LENGTH = 500;
const GITHUB_API_URL = 'https://api.github.com';
const GIST_FILENAME = 'digital-diary-articles.json';
const APP_IDENTIFIER = 'digital-diary-app-v1';

// PWA Configuration
const PWA_CACHE_NAME = 'digital-diary-pwa-v1';

// ===== GLOBAL STATE =====
let articles = [];
let currentPage = 1;
let quill = null;
let currentEditId = null;
let filteredCategory = 'all';
let isAdminLoggedIn = false;
let githubConfig = null;
let deferredPrompt = null;

// ===== PWA INSTALLATION =====
let installButton;

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('Initializing Digital Diary...');
    
    // Set current year in footer
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Initialize all components
    initTheme();
    initQuill();
    initStorage();
    initNavigation();
    initCategoryFilter();
    initPagination();
    initAdmin();
    initMobileMenu();
    initLogout();
    initCharacterCounters();
    initGitHubConfig();
    updateStorageInfo();
    
    // Initialize PWA features
    initPWA();
    
    console.log('Digital Diary initialized successfully!');
});

// ===== PWA MANAGEMENT =====
function initPWA() {
    console.log('Initializing PWA features...');
    
    // Setup PWA installation
    setupPWAInstall();
    
    // Setup offline detection
    setupOfflineDetection();
    
    // Setup network status
    setupNetworkStatus();
    
    // Setup splash screen
    hideSplashScreen();
    
    // Check if running in standalone mode
    checkPWAStandaloneMode();
    
    // Track app usage
    trackPWAUsage();
}

function setupPWAInstall() {
    installButton = document.getElementById('installButton');
    const installButtonFooter = document.getElementById('installButtonFooter');
    
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt event fired');
        e.preventDefault();
        deferredPrompt = e;
        
        if (installButton) {
            installButton.style.display = 'flex';
            installButton.addEventListener('click', installPWA);
        }
        
        if (installButtonFooter) {
            installButtonFooter.style.display = 'block';
            installButtonFooter.addEventListener('click', installPWA);
        }
        
        showNotification('इस ऐप को आपके डिवाइस पर इंस्टॉल किया जा सकता है!', 'info');
    });
    
    window.addEventListener('appinstalled', (evt) => {
        console.log('App was installed');
        
        if (installButton) {
            installButton.style.display = 'none';
        }
        
        if (installButtonFooter) {
            installButtonFooter.style.display = 'none';
        }
        
        // Track installation
        localStorage.setItem('pwa_installed', 'true');
        document.body.classList.add('pwa-installed');
        
        showNotification('ऐप सफलतापूर्वक इंस्टॉल हो गया!', 'success');
    });
    
    // Hide install button if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true ||
        localStorage.getItem('pwa_installed') === 'true') {
        if (installButton) {
            installButton.style.display = 'none';
        }
        if (installButtonFooter) {
            installButtonFooter.style.display = 'none';
        }
        document.body.classList.add('pwa-installed');
    }
}

function installPWA() {
    if (!deferredPrompt) {
        console.log('No install prompt available');
        return;
    }
    
    deferredPrompt.prompt();
    
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('User accepted the install prompt');
            if (installButton) {
                installButton.style.display = 'none';
            }
            const installButtonFooter = document.getElementById('installButtonFooter');
            if (installButtonFooter) {
                installButtonFooter.style.display = 'none';
            }
        } else {
            console.log('User dismissed the install prompt');
        }
        deferredPrompt = null;
    });
}

function setupOfflineDetection() {
    function updateNetworkStatus() {
        const networkStatus = document.getElementById('networkStatus');
        if (!navigator.onLine) {
            networkStatus.classList.add('show');
            showNotification('आप ऑफलाइन हैं। ऑफलाइन मोड में काम कर रहे हैं।', 'warning');
            
            // Disable GitHub sync features
            if (document.querySelector('[data-tab="github"]')) {
                const githubButtons = document.querySelectorAll('.github-btn, .sync-btn');
                githubButtons.forEach(btn => {
                    btn.disabled = true;
                    btn.title = 'ऑफलाइन - उपलब्ध नहीं';
                });
            }
        } else {
            networkStatus.classList.remove('show');
            
            // Enable GitHub sync features
            if (document.querySelector('[data-tab="github"]')) {
                const githubButtons = document.querySelectorAll('.github-btn, .sync-btn');
                githubButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.title = '';
                });
            }
            
            // Auto-sync when back online
            if (githubConfig && githubConfig.token && githubConfig.autoSync && githubConfig.gistId) {
                setTimeout(() => {
                    syncToGist().catch(err => console.log('ऑटो-सिंक विफल:', err));
                }, 2000);
            }
        }
    }
    
    // Listen for network status changes
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    // Initial check
    updateNetworkStatus();
}

function setupNetworkStatus() {
    // Check connection speed for optimization
    if (navigator.connection) {
        const connection = navigator.connection;
        
        function updateConnection() {
            const speed = connection.effectiveType;
            const saveData = connection.saveData;
            
            console.log('Connection speed:', speed, 'Save data mode:', saveData);
            
            // Adjust image quality based on connection
            if (speed === 'slow-2g' || speed === '2g' || saveData) {
                document.body.classList.add('slow-connection');
                localStorage.setItem('image_quality', 'low');
            } else {
                document.body.classList.remove('slow-connection');
                localStorage.removeItem('image_quality');
            }
        }
        
        navigator.connection.addEventListener('change', updateConnection);
        updateConnection();
    }
}

function hideSplashScreen() {
    // Hide splash screen after content loads
    window.addEventListener('load', function() {
        setTimeout(function() {
            const splash = document.getElementById('splashScreen');
            if (splash) {
                splash.style.opacity = '0';
                splash.style.pointerEvents = 'none';
                setTimeout(() => {
                    splash.style.display = 'none';
                }, 500);
            }
        }, 1000);
    });
}

function checkPWAStandaloneMode() {
    // Check if running in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || 
        window.navigator.standalone === true) {
        console.log('Running in PWA standalone mode');
        document.body.classList.add('pwa-standalone');
    }
}

function trackPWAUsage() {
    // Track app usage
    const today = new Date().toDateString();
    const lastVisit = localStorage.getItem('last_visit');
    
    if (lastVisit !== today) {
        // New day
        const totalVisits = parseInt(localStorage.getItem('total_visits') || '0') + 1;
        localStorage.setItem('total_visits', totalVisits.toString());
        localStorage.setItem('last_visit', today);
        
        console.log(`Total visits: ${totalVisits}`);
    }
    
    // Track time spent
    localStorage.setItem('session_start', Date.now().toString());
}

// ===== THEME MANAGEMENT =====
function initTheme() {
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('diary_theme') || 'light';
    
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    themeToggle.addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('diary_theme', newTheme);
        updateThemeIcon(newTheme);
    });
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-btn i');
    if (theme === 'dark') {
        icon.classList.remove('fa-moon');
        icon.classList.add('fa-sun');
    } else {
        icon.classList.remove('fa-sun');
        icon.classList.add('fa-moon');
    }
}

// ===== GITHUB GIST INTEGRATION =====
function initGitHubConfig() {
    const savedConfig = localStorage.getItem('diary_github_config');
    if (savedConfig) {
        try {
            githubConfig = JSON.parse(savedConfig);
            console.log('GitHub configuration loaded:', {
                hasToken: !!githubConfig.token,
                hasGistId: !!githubConfig.gistId,
                autoSync: githubConfig.autoSync
            });
            
            // Update UI
            if (githubConfig.token) {
                document.getElementById('githubToken').value = '••••••••••••••••••••';
            }
            if (githubConfig.gistId) {
                document.getElementById('gistId').value = githubConfig.gistId;
            }
            if (githubConfig.autoSync !== undefined) {
                document.getElementById('autoSync').checked = githubConfig.autoSync;
            }
            
            // Automatically load articles from Gist on startup if configured
            if (githubConfig.token && githubConfig.gistId && articles.length <= 2) {
                setTimeout(() => {
                    loadFromGistOnStartup();
                }, 1000);
            }
            
            updateGitHubStatus();
            
        } catch (error) {
            console.error('Error loading GitHub config:', error);
            githubConfig = null;
        }
    }
    
    updateStorageInfo();
}

async function saveGitHubConfig() {
    const token = document.getElementById('githubToken').value.trim();
    const gistId = document.getElementById('gistId').value.trim();
    const autoSync = document.getElementById('autoSync').checked;
    
    if (!token || token === '••••••••••••••••••••') {
        showNotification('कृपया एक वैध GitHub Personal Access Token दर्ज करें', 'error');
        return;
    }
    
    // Validate token format (basic check)
    if (!token.startsWith('ghp_') && !token.startsWith('github_pat_')) {
        if (!confirm('टोकन फॉर्मैट असामान्य लग रहा है। सुनिश्चित करें कि यह "ghp_" या "github_pat_" से शुरू होता है। जारी रखें?')) {
            return;
        }
    }
    
    // If Gist ID is provided, verify it exists
    let verifiedGistId = gistId;
    if (gistId) {
        showNotification('Gist ID सत्यापित किया जा रहा है...', 'info');
        const gistExists = await verifyGistWithToken(token, gistId);
        
        if (!gistExists) {
            showNotification('Gist नहीं मिला या पहुंच योग्य नहीं। कृपया Gist ID जांचें।', 'error');
            document.getElementById('gistId').focus();
            return;
        }
        
        // Check if this gist contains our app data
        const isDiaryGist = await checkIfDiaryGist(token, gistId);
        if (!isDiaryGist) {
            if (!confirm('यह Gist डिजिटल डायरी डेटा नहीं रखता है। फिर भी उपयोग करें?')) {
                return;
            }
        }
    }
    
    githubConfig = {
        token: token,
        gistId: verifiedGistId || null,
        autoSync: autoSync,
        lastSync: null
    };
    
    localStorage.setItem('diary_github_config', JSON.stringify(githubConfig));
    
    // Mask token in UI
    document.getElementById('githubToken').value = '••••••••••••••••••••';
    
    showNotification('GitHub कॉन्फ़िगरेशन सफलतापूर्वक सेव हो गया!', 'success');
    
    // Test connection and update status
    await testGitHubConnection();
}

async function testGitHubConnection() {
    if (!githubConfig || !githubConfig.token) {
        showNotification('कृपया पहले GitHub कॉन्फ़िगरेशन सेव करें', 'error');
        return;
    }
    
    try {
        showSyncStatus('GitHub कनेक्शन टेस्ट किया जा रहा है...', 'syncing');
        
        const response = await fetch(`${GITHUB_API_URL}/user`, {
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.ok) {
            const userData = await response.json();
            showNotification(`GitHub से कनेक्ट हो गया: ${userData.login}`, 'success');
            
            // If gistId is provided, verify it exists
            if (githubConfig.gistId) {
                const gistExists = await verifyGist();
                if (!gistExists) {
                    showNotification('कॉन्फ़िगर किया गया Gist नहीं मिला। कृपया Gist ID अपडेट करें।', 'warning');
                    githubConfig.gistId = null;
                    document.getElementById('gistId').value = '';
                    localStorage.setItem('diary_github_config', JSON.stringify(githubConfig));
                }
            }
            
            showSyncStatus('GitHub से कनेक्ट हो गया', 'success');
            updateGitHubStatus();
            
        } else {
            throw new Error(`GitHub API त्रुटि: ${response.status}`);
        }
        
    } catch (error) {
        console.error('GitHub कनेक्शन त्रुटि:', error);
        showNotification('GitHub से कनेक्ट करने में विफल। अपना टोकन जांचें।', 'error');
        showSyncStatus('कनेक्शन विफल', 'error');
    }
}

async function verifyGist() {
    if (!githubConfig || !githubConfig.token || !githubConfig.gistId) {
        return false;
    }
    
    try {
        const response = await fetch(`${GITHUB_API_URL}/gists/${githubConfig.gistId}`, {
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        return response.ok;
        
    } catch (error) {
        console.error('Gist सत्यापन त्रुटि:', error);
        return false;
    }
}

async function verifyGistWithToken(token, gistId) {
    try {
        const response = await fetch(`${GITHUB_API_URL}/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function checkIfDiaryGist(token, gistId) {
    try {
        const response = await fetch(`${GITHUB_API_URL}/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.ok) {
            const gistData = await response.json();
            return !!gistData.files[GIST_FILENAME];
        }
        return false;
    } catch (error) {
        return false;
    }
}

async function searchForDiaryGists() {
    if (!githubConfig || !githubConfig.token) {
        showNotification('कृपया पहले GitHub कॉन्फ़िगर करें', 'error');
        return;
    }
    
    try {
        showSyncStatus('डायरी gist खोजे जा रहे हैं...', 'syncing');
        
        const response = await fetch(`${GITHUB_API_URL}/gists`, {
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.ok) {
            const gists = await response.json();
            const diaryGists = gists.filter(gist => {
                return gist.files && gist.files[GIST_FILENAME];
            });
            
            if (diaryGists.length > 0) {
                let message = `${diaryGists.length} डायरी gist मिले:\n\n`;
                diaryGists.forEach((gist, index) => {
                    message += `${index + 1}. ${gist.description || 'कोई विवरण नहीं'}\n`;
                    message += `   ID: ${gist.id}\n`;
                    message += `   बनाया गया: ${new Date(gist.created_at).toLocaleDateString()}\n\n`;
                });
                
                const selected = prompt(`${message}\nउपयोग करने के लिए gist की संख्या दर्ज करें (या रद्द करने के लिए 0):`);
                const index = parseInt(selected) - 1;
                
                if (index >= 0 && index < diaryGists.length) {
                    const selectedGist = diaryGists[index];
                    githubConfig.gistId = selectedGist.id;
                    document.getElementById('gistId').value = selectedGist.id;
                    localStorage.setItem('diary_github_config', JSON.stringify(githubConfig));
                    showNotification(`चयनित gist: ${selectedGist.id}`, 'success');
                    updateGitHubStatus();
                }
            } else {
                showNotification('कोई मौजूदा डायरी gist नहीं मिला।', 'info');
            }
            
            showSyncStatus('खोज पूर्ण हुई', 'success');
            
        } else {
            throw new Error(`Gist प्राप्त करने में विफल: ${response.status}`);
        }
        
    } catch (error) {
        console.error('Gist खोज त्रुटि:', error);
        showNotification('Gist खोजने में विफल', 'error');
        showSyncStatus('खोज विफल', 'error');
    }
}

async function loadFromGistOnStartup() {
    if (!githubConfig || !githubConfig.token || !githubConfig.gistId) {
        return;
    }
    
    // Only load if we have minimal local data
    if (articles.length > 2) {
        console.log('Skipping Gist load - already have local articles');
        return;
    }
    
    try {
        showSyncStatus('Gist से लेख लोड हो रहे हैं...', 'syncing');
        
        const response = await fetch(`${GITHUB_API_URL}/gists/${githubConfig.gistId}`, {
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.ok) {
            const gistData = await response.json();
            const fileContent = gistData.files[GIST_FILENAME]?.content;
            
            if (!fileContent) {
                showNotification('इस Gist में कोई डायरी डेटा नहीं मिला', 'warning');
                showSyncStatus('Gist में कोई डेटा नहीं', 'warning');
                return;
            }
            
            const importedData = JSON.parse(fileContent);
            
                 // Validate data
            if (!importedData.articles || !Array.isArray(importedData.articles)) {
                throw new Error('Gist में अमान्य डेटा फॉर्मैट');
            }
            
            if (importedData.articles.length === 0) {
                showNotification('Gist खाली है', 'info');
                showSyncStatus('Gist खाली है', 'info');
                return;
            }
            
            // Replace articles
            articles = importedData.articles;
            
            // Assign new IDs to avoid conflicts
            articles.forEach(article => {
                if (!article.id) {
                    article.id = generateUUID();
                }
            });
             
            // Save to local storage
            if (saveToStorage()) {
                // Update config
                githubConfig.lastSync = new Date().toISOString();
                localStorage.setItem('diary_github_config', JSON.stringify(githubConfig));
                
                // Update UI
                updateGitHubStatus();
                renderArticles();
                renderArticlesList();
                updateStorageInfo();
                
                showNotification(`Gist से ${articles.length} लेख लोड हो गए`, 'success');
                showSyncStatus(`${articles.length} लेख लोड हो गए`, 'success');
                
            } else {
                throw new Error('स्थानीय स्टोरेज में सेव करने में विफल');
            }
            
        } else {
            throw new Error(`Gist प्राप्त करने में विफल: ${response.status}`);
        }
        
    } catch (error) {
        console.error('Gist लोड त्रुटि:', error);
        showNotification('Gist से लोड करने में विफल', 'error');
        showSyncStatus('लोड विफल', 'error');
    }
}

async function syncToGist() {
    if (!githubConfig || !githubConfig.token) {
        showNotification('कृपया पहले GitHub कॉन्फ़िगर करें', 'error');
        return;
    }
    
    // Check if offline
    if (!navigator.onLine) {
        showNotification('ऑफलाइन। सिंक को कतारबद्ध किया जा रहा है जब आप ऑनलाइन होंगे।', 'warning');
        return;
    }
    
    try {
        showSyncStatus('GitHub Gist पर सिंक हो रहा है...', 'syncing');
        
        let gistId = githubConfig.gistId;
        
        // If we don't have a Gist ID, search for existing ones first
        if (!gistId) {
            showNotification('मौजूदा डायरी gist खोजे जा रहे हैं...', 'info');
            
            const response = await fetch(`${GITHUB_API_URL}/gists`, {
                headers: {
                    'Authorization': `token ${githubConfig.token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });
            
            if (response.ok) {
                const gists = await response.json();
                const diaryGists = gists.filter(gist => {
                    return gist.files && gist.files[GIST_FILENAME];
                });
                
                if (diaryGists.length > 0) {
                    // Use the most recent diary gist
                    const mostRecent = diaryGists.sort((a, b) => 
                        new Date(b.updated_at) - new Date(a.updated_at)
                    )[0];
                    
                    gistId = mostRecent.id;
                    githubConfig.gistId = gistId;
                    document.getElementById('gistId').value = gistId;
                    localStorage.setItem('diary_github_config', JSON.stringify(githubConfig));
                    
                    showNotification(`मौजूदा डायरी gist मिला: ${gistId.substring(0, 8)}...`, 'success');
                }
            }
        }
        
        // If still no Gist ID, create a new one
        if (!gistId) {
            await createNewGist();
            gistId = githubConfig.gistId;
        }
        
        // Verify the Gist exists
        if (gistId) {
            const gistExists = await verifyGist();
            if (!gistExists) {
                showNotification('Gist नहीं मिला। नया बनाया जा रहा है...', 'warning');
                await createNewGist();
                gistId = githubConfig.gistId;
            }
        }
        
        // Prepare data
        const syncData = {
            version: '1.0',
            appIdentifier: APP_IDENTIFIER,
            lastSync: new Date().toISOString(),
            articles: articles,
            stats: {
                totalArticles: articles.length,
                totalSize: JSON.stringify(articles).length,
                categories: [...new Set(articles.map(a => a.category))]
            }
        };
        
        // Update Gist
        const response = await fetch(`${GITHUB_API_URL}/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: `डिजिटल डायरी - ${articles.length} लेख - अंतिम सिंक: ${new Date().toLocaleString()}`,
                files: {
                    [GIST_FILENAME]: {
                        content: JSON.stringify(syncData, null, 2)
                    }
                }
            })
        });
        
        if (response.ok) {
            const gistData = await response.json();
            
            // Update config
            githubConfig.lastSync = new Date().toISOString();
            githubConfig.gistId = gistId;
            localStorage.setItem('diary_github_config', JSON.stringify(githubConfig));
            
            // Update UI
            updateGitHubStatus();
            
            showNotification(`${articles.length} लेख GitHub Gist पर सिंक हो गए`, 'success');
            showSyncStatus(`${articles.length} लेख सिंक हो गए`, 'success');
            
        } else {
            throw new Error(`Gist अपडेट विफल: ${response.status}`);
        }
        
    } catch (error) {
        console.error('सिंक त्रुटि:', error);
        showNotification('GitHub Gist पर सिंक करने में विफल', 'error');
        showSyncStatus('सिंक विफल', 'error');
    }
}

async function createNewGist() {
    if (!githubConfig || !githubConfig.token) {
        showNotification('कृपया पहले GitHub कॉन्फ़िगर करें', 'error');
        return;
    }
    
    try {
        showSyncStatus('नया Gist बनाया जा रहा है...', 'syncing');
        
        const data = {
            description: 'डिजिटल डायरी - व्यक्तिगत ज्ञान संग्रह',
            public: false,
            files: {
                [GIST_FILENAME]: {
                    content: JSON.stringify({
                        version: '1.0',
                        appIdentifier: APP_IDENTIFIER,
                        created: new Date().toISOString(),
                        articles: articles
                    }, null, 2)
                }
            }
        };
        
        const response = await fetch(`${GITHUB_API_URL}/gists`, {
            method: 'POST',
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            const gistData = await response.json();
            githubConfig.gistId = gistData.id;
            githubConfig.lastSync = new Date().toISOString();
            
            localStorage.setItem('diary_github_config', JSON.stringify(githubConfig));
             
            // Update UI
            document.getElementById('gistId').value = gistData.id;
            
            showNotification(`नया Gist बन गया: ${gistData.id.substring(0, 8)}...`, 'success');
            showSyncStatus(`Gist बन गया: ${gistData.id.substring(0, 8)}...`, 'success');
            
        } else {
            throw new Error(`Gist बनाने में विफल: ${response.status}`);
        }
        
    } catch (error) {
        console.error('Gist निर्माण त्रुटि:', error);
        showNotification('Gist बनाने में विफल', 'error');
        showSyncStatus('Gist निर्माण विफल', 'error');
    }
}

async function pullFromGist() {
    if (!githubConfig || !githubConfig.token || !githubConfig.gistId) {
        showNotification('कृपया GitHub कॉन्फ़िगर करें और पहले एक Gist चुनें', 'error');
        return;
    }
    
    if (!confirm('यह आपके वर्तमान लेखों को Gist के डेटा से बदल देगा। जारी रखें?')) {
        return;
    }
    
    try {
        showSyncStatus('GitHub Gist से डाउनलोड हो रहा है...', 'syncing');
        
        const response = await fetch(`${GITHUB_API_URL}/gists/${githubConfig.gistId}`, {
            headers: {
                'Authorization': `token ${githubConfig.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.ok) {
            const gistData = await response.json();
            const fileContent = gistData.files[GIST_FILENAME]?.content;
            
            if (!fileContent) {
                throw new Error('Gist में कोई डायरी डेटा नहीं मिला');
            }
            
            const importedData = JSON.parse(fileContent);
            
        // Validate data
            if (!importedData.articles || !Array.isArray(importedData.articles)) {
                throw new Error('Gist में अमान्य डेटा फॉर्मैट');
            }
            
            // Replace articles
            articles = importedData.articles;
            
            // Assign new IDs to avoid conflicts
            articles.forEach(article => {
                if (!article.id) {
                    article.id = generateUUID();
                }
            });
            
            // Save to local storage
            if (saveToStorage()) {
                // Update config
                githubConfig.lastSync = new Date().toISOString();
                localStorage.setItem('diary_github_config', JSON.stringify(githubConfig));
                
                // Update UI
                updateGitHubStatus();
                renderArticles();
                renderArticlesList();
                updateStorageInfo();
                
                showNotification(`Gist से ${articles.length} लेख लोड हो गए`, 'success');
                showSyncStatus(`${articles.length} लेख लोड हो गए`, 'success');
                
            } else {
                throw new Error('स्थानीय स्टोरेज में सेव करने में विफल');
            }
            
        } else {
            throw new Error(`Gist प्राप्त करने में विफल: ${response.status}`);
        }
        
    } catch (error) {
        console.error('डाउनलोड त्रुटि:', error);
        showNotification('GitHub Gist से लोड करने में विफल', 'error');
        showSyncStatus('डाउनलोड विफल', 'error');
    }
}

function clearGitHubConfig() {
    if (confirm('GitHub कॉन्फ़िगरेशन साफ करें? यह आपका टोकन और Gist ID हटा देगा।')) {
        githubConfig = null;
        localStorage.removeItem('diary_github_config');
        
        document.getElementById('githubToken').value = '';
        document.getElementById('gistId').value = '';
        document.getElementById('autoSync').checked = true;
        
        showSyncStatus('कॉन्फ़िगर नहीं', 'error');
        updateGitHubStatus();
        showNotification('GitHub कॉन्फ़िगरेशन साफ हो गया', 'info');
    }
}

function showSyncStatus(message, status = 'info') {
    const syncStatus = document.getElementById('syncStatus');
    if (!syncStatus) return;
    
    syncStatus.className = 'sync-status';
    syncStatus.classList.add(status);
    syncStatus.classList.remove('hidden');
    
    syncStatus.innerHTML = `
        <i class="fas fa-${status === 'success' ? 'check-circle' : 
                          status === 'error' ? 'exclamation-circle' : 
                          status === 'syncing' ? 'sync-alt' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    if (status === 'syncing') {
        syncStatus.querySelector('i').classList.add('fa-spin');
    }
    
    // Auto hide after 3 seconds for success/error
    if (status === 'success' || status === 'error') {
        setTimeout(() => {
            syncStatus.classList.add('hidden');
        }, 3000);
    }
}

function updateGitHubStatus() {
    if (!githubConfig || !githubConfig.token) {
        document.getElementById('syncStatusText').textContent = 'कॉन्फ़िगर नहीं';
        document.getElementById('lastSyncTime').textContent = 'कभी नहीं';
        document.getElementById('gistArticleCount').textContent = '0';
        document.getElementById('currentGistId').textContent = 'सेट नहीं';
        document.getElementById('gistStorageInfo').textContent = 'कॉन्फ़िगर नहीं';
        return;
    }
    
    document.getElementById('syncStatusText').textContent = githubConfig.gistId ? 'कॉन्फ़िगर किया गया' : 'कॉन्फ़िगर किया गया (कोई Gist नहीं)';
    document.getElementById('lastSyncTime').textContent = githubConfig.lastSync ? 
        formatRelativeTime(githubConfig.lastSync) : 'कभी नहीं';
    document.getElementById('gistArticleCount').textContent = articles.length.toString();
    document.getElementById('currentGistId').textContent = githubConfig.gistId ? 
        `${githubConfig.gistId.substring(0, 8)}...` : 'सेट नहीं';
    
    // Update footer
    document.getElementById('gistStorageInfo').textContent = githubConfig.gistId ? 
        `${articles.length} लेख` : 'कॉन्फ़िगर नहीं';
}

function formatRelativeTime(dateString) {
    if (!dateString) return 'कभी नहीं';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'अभी-अभी';
    if (diffMins < 60) return `${diffMins} मिनट${diffMins === 1 ? '' : ''} पहले`;
    if (diffHours < 24) return `${diffHours} घंटे${diffHours === 1 ? '' : ''} पहले`;
    if (diffDays < 7) return `${diffDays} दिन${diffDays === 1 ? '' : ''} पहले`;
    
    return date.toLocaleDateString('hi-IN');
}
// ===== STORAGE MANAGEMENT =====
function initStorage() {
    console.log('Initializing storage...');
    
    try {
        const savedData = localStorage.getItem('diary_articles');
        
        if (!savedData || savedData === 'null' || savedData === 'undefined') {
            console.log('No saved data found');
            createSampleArticles();
            saveToStorage();
            renderArticles();
            return;
        }
        
        // Parse and validate data
        const parsed = JSON.parse(savedData);
        
        if (!Array.isArray(parsed)) {
            throw new Error('Invalid data format: not an array');
        }
        
        // Filter out invalid articles
        articles = parsed.filter(article => {
            return article && 
                   article.id && 
                   typeof article.id === 'string' &&
                   article.title && 
                   typeof article.title === 'string' &&
                   article.date;
        });
        
        console.log(`Loaded ${articles.length} articles from storage`);
        
        if (articles.length === 0) {
            createSampleArticles();
            saveToStorage();
        }
        
        renderArticles();
        
    } catch (error) {
        console.error('Error loading from storage:', error);
        
        // Try to load from backup
        try {
            const backup = localStorage.getItem('diary_articles_backup');
            if (backup) {
                articles = JSON.parse(backup);
                console.log(`Loaded ${articles.length} articles from backup`);
            } else {
                createSampleArticles();
            }
        } catch (backupError) {
            console.error('Backup also corrupted:', backupError);
            createSampleArticles();
        }
        
        saveToStorage();
        renderArticles();
        showNotification('सहेजा गया डेटा लोड करने में त्रुटि। नई शुरुआत की गई।', 'warning');
    }
}

function saveToStorage() {
    try {
        // Clean up articles before saving
        const cleanedArticles = articles.map(article => ({
            id: article.id || generateUUID(),
            title: article.title || 'Untitled',
            summary: article.summary || '',
            category: article.category || 'Others',
            content: article.content || '',
            date: article.date || new Date().toISOString(),
            image: article.image || ''
        }));
        
        const data = JSON.stringify(cleanedArticles);
        const dataSize = data.length;
        
        console.log(`Saving ${articles.length} articles (${Math.round(dataSize / 1024)} KB)`);
        
        // Check storage size
        if (dataSize > MAX_STORAGE_SIZE * 0.9) { // 90% of max
            showNotification('स्टोरेज लगभग पूर्ण है! पुराने लेख हटाने पर विचार करें।', 'warning');
        }
        
        // Save main data
        localStorage.setItem('diary_articles', data);
        
        // Create backup
        localStorage.setItem('diary_articles_backup', data);
        
        // Auto-sync to GitHub if configured and enabled
        if (githubConfig && githubConfig.token && githubConfig.autoSync && githubConfig.gistId) {
            setTimeout(async () => {
                try {
                    await syncToGist();
                } catch (error) {
                    console.error('Auto-sync failed:', error);
                }
            }, 1000);
        }
        
        updateStorageInfo();
        return true;
        
    } catch (error) {
        console.error('Error saving to storage:', error);
        
        if (error.name === 'QuotaExceededError') {
            handleStorageFull();
            return false;
        }
        
        showNotification('डेटा सेव करने में विफल। कृपया पुनः प्रयास करें।', 'error');
        return false;
    }
}

function handleStorageFull() {
    console.log('Handling storage full situation...');
    
    // Strategy 1: Remove images from old articles
    if (articles.length > 10) {
        articles.forEach((article, index) => {
            if (index > 9 && article.image) { // Keep images for first 10 articles
                article.image = '';
            }
        });
        console.log('Removed images from old articles');
    }
    // Strategy 2: Keep only recent articles
    if (articles.length > 20) {
        articles.sort((a, b) => new Date(b.date) - new Date(a.date));
        articles = articles.slice(0, 20);
        console.log('Kept only 20 most recent articles');
    }
    
    // Try saving again
    if (saveToStorage()) {
        showNotification('स्टोरेज पूर्ण था। पुराना डेटा साफ किया गया।', 'warning');
        return true;
    }
    
    // Last resort: Clear everything
    localStorage.clear();
    articles = [];
    createSampleArticles();
    saveToStorage();
    
    showNotification('स्टोरेज पूर्ण था। नमूना लेखों के साथ नई शुरुआत की गई।', 'warning');
    return true;
}

function updateStorageInfo() {
    try {
        const data = localStorage.getItem('diary_articles') || '[]';
        const sizeKB = Math.round(data.length / 1024);
        const sizeMB = (sizeKB / 1024).toFixed(2);
        const percentage = Math.min((sizeKB * 1024) / MAX_STORAGE_SIZE * 100, 100);
        
        document.getElementById('storageUsed').textContent = `${sizeKB} KB (${sizeMB} MB)`;
        document.getElementById('storageFill').style.width = `${percentage}%`;
        // Update footer info
        document.getElementById('localStorageInfo').textContent = `${sizeKB} KB`;
        
    } catch (error) {
        console.error('Error updating storage info:', error);
    }
}

function clearAllData() {
    if (confirm('क्या आप वाकई सभी लेख हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती!')) {
        articles = [];
        localStorage.clear();
        createSampleArticles();
        saveToStorage();
        renderArticles();
        renderArticlesList();
        updateStorageInfo();
        showNotification('सभी डेटा सफलतापूर्वक साफ हो गया!', 'info');
    }
}

// ===== SAMPLE DATA =====
function createSampleArticles() {
    console.log('Creating sample articles...');
    
    articles = [
        {
            id: generateUUID(),
            title: 'डिजिटल डायरी में आपका स्वागत है',
            summary: 'विचारों और लेखों को व्यवस्थित करने के लिए आपका व्यक्तिगत ज्ञान संग्रह।',
            category: 'शिक्षा',
            content: '<p>आपकी डिजिटल डायरी में स्वागत है! यह एक व्यक्तिगत ज्ञान प्रबंधन प्रणाली है जहाँ आप:</p><ul><li><strong>किसी भी विषय पर लेख</strong> लिख सकते हैं</li><li><strong>सामग्री को श्रेणियों</strong> द्वारा व्यवस्थित कर सकते हैं</li><li><strong>अपने लेखों में छवियाँ</strong> जोड़ सकते हैं</li><li><strong>किसी भी डिवाइस से सब कुछ</strong> एक्सेस कर सकते हैं</li></ul><p>डेटा आपके डिवाइस पर स्थानीय रूप से संग्रहीत किया जाता है, पूर्ण गोपनीयता सुनिश्चित करता है।</p><p>आरंभ करने के लिए:</p><ol><li>एडमिन सेक्शन पर जाएं (पासवर्ड: diary2026)</li><li>अपना पहला लेख बनाएं</li><li>छवियाँ जोड़ें और अपनी सामग्री फॉर्मेट करें</li><li>सेव करें और अपने लेख देखें</li></ol><p>शुभ लेखन!</p>',
            date: new Date().toISOString(),
            image: ''
        },
        {
            id: generateUUID(),
            title: 'उत्पादकता का विज्ञान',
            summary: 'अपनी दक्षता और फोकस को अधिकतम करने का तरीका समझना।',
            category: 'विज्ञान',
            content: '<h2>उत्पादकता के पीछे का विज्ञान</h2><p>उत्पादकता कड़ी मेहनत करने के बारे में नहीं है - यह चतुराई से काम करने के बारे में है। शोध बताता है कि हमारे दिमाग के संज्ञानात्मक संसाधन सीमित हैं, और इन सीमाओं को समझने से हमें अधिक कुशलता से काम करने में मदद मिल सकती है।</p><h3>मुख्य सिद्धांत:</h3><ol><li><strong>पोमोडोरो तकनीक</strong>: 5-मिनट के ब्रेक के साथ 25-मिनट के फोकस्ड अंतराल में काम करें</li><li><strong>गहन कार्य</strong>: अबाधित, केंद्रित कार्य की लंबी अवधि</li><li><strong>कार्य समूहीकरण</strong>: समान कार्यों को एक साथ समूहित करें</li><li><strong>ऊर्जा प्रबंधन</strong>: अपनी प्राकृतिक ऊर्जा चक्रों के साथ काम करें</li></ol><p>अध्ययन दिखाते हैं कि सबसे उत्पादक लोग 90-मिनट के चक्रों में काम करते हैं जिसके बाद ब्रेक होते हैं, जो हमारे प्राकृतिक अल्ट्राडियन रिदम से मेल खाता है।</p>',
            date: new Date(Date.now() - 86400000).toISOString(), // Yesterday
            image: ''
        }
    ];
    
    console.log(`Created ${articles.length} sample articles`);
}

// ===== UTILITY FUNCTIONS =====
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function formatDate(isoString) {
    try {
        const date = new Date(isoString);
        return date.toLocaleDateString('hi-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'अज्ञात तिथि';
    }
}

function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 
                          type === 'error' ? 'exclamation-circle' : 
                          type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Also show browser notification if available and permission granted
    if (type === 'warning' && Notification.permission === 'granted' && document.hidden) {
        new Notification('डिजिटल डायरी', {
            body: message,
            icon: 'icon.png',
            silent: true
        });
    }
    
    // Auto remove
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// ===== IMAGE COMPRESSION =====
function compressImage(base64Image, maxWidth = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Image;
        
        img.onload = function() {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            // Calculate new dimensions
            if (width > maxWidth) {
                const ratio = maxWidth / width;
                width = maxWidth;
                height = height * ratio;
            }
            
            canvas.width = width;
            canvas.height = height;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // Compress to JPEG
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            
            console.log(`Image compressed: ${Math.round(base64Image.length / 1024)}KB → ${Math.round(compressedBase64.length / 1024)}KB`);
            resolve(compressedBase64);
        };
        
        img.onerror = function() {
            console.log('Image compression failed, using original');
            resolve(base64Image);
        };
    });
}

// ===== CHARACTER COUNTERS =====
function initCharacterCounters() {
    const titleInput = document.getElementById('title');
    const summaryInput = document.getElementById('summary');
    
    if (titleInput) {
        titleInput.addEventListener('input', function() {
            document.getElementById('titleCharCount').textContent = 
                `${this.value.length}/${MAX_TITLE_LENGTH} अक्षर`;
        });
    }
    
    if (summaryInput) {
        summaryInput.addEventListener('input', function() {
            document.getElementById('summaryCharCount').textContent = 
                `${this.value.length}/${MAX_SUMMARY_LENGTH} अक्षर`;
        });
    }
}

// ===== MOBILE MENU =====
function initMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    
    if (!hamburger) return;
    
    hamburger.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('mobile-active');
    });
    
    // Close menu when link is clicked
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function() {
            hamburger.classList.remove('active');
            navLinks.classList.remove('mobile-active');
        });
    });
    
    // Close menu on resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            hamburger.classList.remove('active');
            navLinks.classList.remove('mobile-active');
        }
    });
    
    // Close menu when clicking outside
    document.addEventListener('click', function(e) {
        if (!hamburger.contains(e.target) && !navLinks.contains(e.target)) {
            hamburger.classList.remove('active');
            navLinks.classList.remove('mobile-active');
        }
    });
}

// ===== QUILL EDITOR =====
function initQuill() {
    const editorElement = document.getElementById('editor');
    if (editorElement) {
        quill = new Quill(editorElement, {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, false] }],
                    ['bold', 'italic', 'underline'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                ]
            }
        });
    }
}
// ===== NAVIGATION =====
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link, .footer a[href^="#"]');
    const pages = document.querySelectorAll('.page');
    
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            if (this.id === 'navLogout') {
                e.preventDefault();
                logout();
                return;
            }
            
            e.preventDefault();
            
            // Get page ID
            let pageId;
            if (this.classList.contains('nav-link')) {
                // Navbar link
                pageId = this.dataset.page;
            } else {
                // Footer link
                pageId = this.getAttribute('href').replace('#', '');
            }
            
            // Update active nav
            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Show page
            pages.forEach(p => p.classList.remove('active'));
            document.getElementById(pageId).classList.add('active');
            
            // Page-specific actions
            if (pageId === 'home') {
                currentPage = 1;
                filteredCategory = 'all';
                updateCategoryButtons();
                renderArticles();
            } else if (pageId === 'gallery') {
                initGallery();
            } else if (pageId === 'admin' && !isAdminLoggedIn) {
                // Show login by default
                document.getElementById('adminLogin').style.display = 'block';
                document.getElementById('adminPanel').style.display = 'none';
            }
            
            updateSubNavVisibility();
        });
    });
}

function updateSubNavVisibility() {
    const subNav = document.getElementById('subNav');
    const currentPage = document.querySelector('.page.active').id;
    
    if (subNav) {
        if (isAdminLoggedIn || currentPage === 'admin') {
            subNav.classList.add('hidden');
        } else {
            subNav.classList.remove('hidden');
        }
    }
}

// ===== CATEGORY FILTER =====
function initCategoryFilter() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            filteredCategory = this.dataset.category;
            updateCategoryButtons();
            currentPage = 1;
            renderArticles();
        });
    });
}

function updateCategoryButtons() {
    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === filteredCategory);
    });
}

// ===== PAGINATION =====
function initPagination() {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            document.getElementById('home').classList.add('active');
            document.getElementById('articleView').classList.remove('active');
            document.querySelector('.nav-link[data-page="home"]').click();
        });
    }
}

function renderPagination() {
    const totalPages = Math.ceil(getFilteredArticles().length / ARTICLES_PER_PAGE);
    const pagination = document.getElementById('pagination');
    let paginationHTML = '';
    
    if (totalPages > 1) {
        paginationHTML += `
            <button class="pagination-btn ${currentPage === 1 ? 'disabled' : ''}" id="prevPage">
                <i class="fas fa-chevron-left"></i> पिछला
            </button>
            <span class="page-info">पृष्ठ ${currentPage} का ${totalPages}</span>
            <button class="pagination-btn ${currentPage === totalPages ? 'disabled' : ''}" id="nextPage">
                अगला <i class="fas fa-chevron-right"></i>
            </button>
        `;
        pagination.innerHTML = paginationHTML;
        
        // Event delegation
        pagination.addEventListener('click', function(e) {
            if (e.target.id === 'prevPage' && currentPage > 1) {
                currentPage--;
                renderArticles();
            } else if (e.target.id === 'nextPage' && currentPage < totalPages) {
                currentPage++;
                renderArticles();
            }
        });
    } else {
        pagination.innerHTML = '';
    }
}
// ===== ARTICLES DISPLAY =====
function getFilteredArticles() {
    if (filteredCategory === 'all') {
        return articles;
    }
    return articles.filter(article => article.category === filteredCategory);
}

function renderArticles() {
    const filtered = getFilteredArticles();
    const start = (currentPage - 1) * ARTICLES_PER_PAGE;
    const end = start + ARTICLES_PER_PAGE;
    const pageArticles = filtered.slice(start, end);
    
    const grid = document.getElementById('articlesGrid');
    
    // Remove skeleton loader
    const skeleton = grid.querySelector('.skeleton-loader');
    if (skeleton) {
        skeleton.remove();
    }
    
    if (pageArticles.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <h3>कोई लेख नहीं मिला</h3>
                <p>${filteredCategory === 'all' ? 'एडमिन पैनल में अपना पहला लेख बनाएं!' : 'इस श्रेणी में अभी तक कोई लेख नहीं हैं।'}</p>
            </div>
        `;
    } else {
        grid.innerHTML = pageArticles.map(article => createArticleCard(article)).join('');
        
        // Add click handlers
        grid.querySelectorAll('.article-card').forEach((card, index) => {
            card.addEventListener('click', () => showArticle(filtered[start + index]));
        });
    }
    
    renderPagination();
}

function createArticleCard(article) {
    const hasImage = article.image && article.image.trim() !== '';
    const cardClass = hasImage ? 'article-card media-rich' : 'article-card text-only';
    
    const imageHTML = hasImage ? `
        <div class="card-image">
            <img src="${article.image}" alt="${article.title}" loading="lazy">
        </div>
    ` : '';
    
    return `
        <div class="${cardClass}" data-id="${article.id}">
            ${imageHTML}
            <div class="card-content">
                <span class="card-category">${article.category}</span>
                <h3 class="card-title">${article.title}</h3>
                <p class="card-summary">${article.summary}</p>
                <small class="card-date">
                    <i class="far fa-calendar"></i> ${formatDate(article.date)}
                </small>
            </div>
        </div>
    `;
}

function showArticle(article) {
    if (!article) {
        showNotification('लेख नहीं मिला!', 'error');
        return;
    }
    
    document.getElementById('articleContent').innerHTML = `
        <div class="article-header">
            <span class="card-category">${article.category}</span>
            <h1>${article.title}</h1>
            <p class="card-summary">${article.summary}</p>
            <small><i class="far fa-calendar"></i> ${formatDate(article.date)}</small>
        </div>
        <div class="article-body">
            ${article.image && article.image.trim() !== '' ? `<img src="${article.image}" alt="${article.title}">` : ''}
            ${article.content}
        </div>
    `;
    
    document.getElementById('home').classList.remove('active');
    document.getElementById('articleView').classList.add('active');
}
// ===== GALLERY =====
function initGallery() {
    const galleryGrid = document.getElementById('galleryGrid');
    const images = articles
        .filter(a => a.image && a.image.trim() !== '')
        .map(article => ({
            src: article.image,
            title: article.title,
            id: article.id
        }));
    
    if (images.length === 0) {
        galleryGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-images"></i>
                <h3>अभी तक कोई छवि नहीं</h3>
                <p>उन्हें यहाँ देखने के लिए अपने लेखों में छवियाँ जोड़ें!</p>
            </div>
        `;
    } else {
        galleryGrid.innerHTML = images.map(img => `
            <div class="gallery-item" onclick="openImage('${img.src}', '${img.title}')">
                <img src="${img.src}" alt="${img.title}">
                <div class="gallery-overlay">
                    <p>${img.title}</p>
                </div>
            </div>
        `).join('');
    }
}

function openImage(src, title) {
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.innerHTML = `
        <img src="${src}" alt="${title}" style="max-width: 90%; max-height: 90%; border-radius: 10px;">
        <button class="modal-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
        <div class="image-title">${title}</div>
    `;
    modal.onclick = (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
    document.body.appendChild(modal);
}

// ===== ADMIN FUNCTIONS =====
function initAdmin() {
    const loginBtn = document.getElementById('loginBtn');
    const passwordInput = document.getElementById('adminPassword');
    
    if (!loginBtn) return;
    
    loginBtn.addEventListener('click', login);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') login();
    });
}

function login() {
    const passwordInput = document.getElementById('adminPassword');
    const password = passwordInput.value;
    
    if (password === ADMIN_PASSWORD) {
        isAdminLoggedIn = true;
        document.getElementById('adminLogin').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'block';
        document.getElementById('navLogout').style.display = 'flex';
        
        renderArticlesList();
        initTabs();
        initForm();
        updateSubNavVisibility();
        
        showNotification('लॉगिन सफल!', 'success');
    } else {
        showNotification('गलत पासवर्ड!', 'error');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

function initLogout() {
    const adminLogoutBtn = document.getElementById('adminLogout');
    const navLogoutBtn = document.getElementById('navLogout');
    
    if (adminLogoutBtn) {
        adminLogoutBtn.addEventListener('click', logout);
    }
    
    if (navLogoutBtn) {
        navLogoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
}

function logout() {
    if (!isAdminLoggedIn) return;
    
    isAdminLoggedIn = false;
    document.getElementById('adminLogin').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('navLogout').style.display = 'none';
    document.getElementById('adminPassword').value = '';
    
    if (currentEditId) {
        resetForm();
    }
    
    document.querySelector('.nav-link[data-page="home"]').click();
    updateSubNavVisibility();
    
    showNotification('सफलतापूर्वक लॉगआउट हो गया!', 'info');
}

function initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(tab + 'Tab').classList.add('active');
            
            if (tab === 'manage') {
                renderArticlesList();
            } else if (tab === 'github') {
                updateGitHubStatus();
            }
        });
    });
}
// ===== ARTICLE FORM =====
function initForm() {
    const form = document.getElementById('articleForm');
    const imageInput = document.getElementById('image');
    
    if (!form) return;
    
    imageInput.addEventListener('change', handleImageUpload);
    form.addEventListener('submit', handleFormSubmit);
    
    const cancelEditBtn = document.getElementById('cancelEdit');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', resetForm);
    }
}

async function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
        showNotification('कृपया एक छवि फ़ाइल चुनें', 'error');
        e.target.value = '';
        return;
    }
    
    if (file.size > MAX_IMAGE_SIZE) {
        showNotification('छवि का आकार 2MB से कम होना चाहिए', 'error');
        e.target.value = '';
        return;
    }
    
    // Show file size warning for large images
    const warningElement = document.getElementById('fileSizeWarning');
    if (file.size > 500 * 1024) { // 500KB
        warningElement.style.display = 'block';
    } else {
        warningElement.style.display = 'none';
    }
    
    // Read and process image
    const reader = new FileReader();
    reader.onload = async (event) => {
        try {
            let imageData = event.target.result;
            
            // Compress large images
            if (file.size > 500 * 1024) {
                showNotification('छवि संपीड़ित की जा रही है...', 'info');
                imageData = await compressImage(imageData, 1024, 0.7);
            }
            
            document.getElementById('imagePreview').innerHTML = `<img src="${imageData}">`;
            
        } catch (error) {
            console.error('Image processing error:', error);
            showNotification('छवि प्रसंस्करण में त्रुटि', 'error');
            document.getElementById('imagePreview').innerHTML = '';
        }
    };
    
    reader.onerror = () => {
        showNotification('छवि फ़ाइल पढ़ने में त्रुटि', 'error');
        document.getElementById('imagePreview').innerHTML = '';
    };
    
    reader.readAsDataURL(file);
}

async function handleFormSubmit(e) {
    e.preventDefault();
    await saveArticle();
}

async function saveArticle() {
    const id = document.getElementById('editId').value;
    const title = document.getElementById('title').value.trim();
    const summary = document.getElementById('summary').value.trim();
    const category = document.getElementById('category').value;
    
    // Validation
    if (!title || !summary || !category) {
        showNotification('कृपया सभी आवश्यक फ़ील्ड भरें!', 'error');
        return;
    }
    
    if (title.length > MAX_TITLE_LENGTH) {
        showNotification(`शीर्षक बहुत लंबा है (अधिकतम ${MAX_TITLE_LENGTH} अक्षर)`, 'error');
        return;
    }
    
    if (summary.length > MAX_SUMMARY_LENGTH) {
        showNotification(`सारांश बहुत लंबा है (अधिकतम ${MAX_SUMMARY_LENGTH} अक्षर)`, 'error');
        return;
    }
    
    // Get image data
    let imageData = '';
    const imagePreview = document.getElementById('imagePreview').querySelector('img');
    if (imagePreview && imagePreview.src) {
        imageData = imagePreview.src;
    }
    
    // Create article object
    const article = {
        id: id || generateUUID(),
        title: title,
        summary: summary,
        category: category,
        content: quill.root.innerHTML,
        date: new Date().toISOString(),
        image: imageData
    };
    
    console.log('Saving article:', article.title);
    
    // Update or add article
    if (id) {
        const index = articles.findIndex(a => a.id === id);
        if (index !== -1) {
            articles[index] = article;
        } else {
            showNotification('अपडेट के लिए लेख नहीं मिला', 'error');
            return;
        }
    } else {
        articles.unshift(article);
    }
    
    // Save to storage (this will trigger auto-sync if configured)
    if (saveToStorage()) {
        showNotification(id ? 'लेख सफलतापूर्वक अपडेट हो गया!' : 'लेख सफलतापूर्वक बन गया!', 'success');
        resetForm();
        renderArticlesList();
        
        if (document.getElementById('home').classList.contains('active')) {
            renderArticles();
        }
    } else {
        showNotification('लेख सेव करने में विफल! स्टोरेज पूर्ण हो सकता है।', 'error');
        if (!id) {
            articles.shift(); // Rollback
        }
    }
}

function editArticle(id) {
    const article = articles.find(a => a.id === id);
    if (!article) {
        showNotification('लेख नहीं मिला!', 'error');
        return;
    }
    
    currentEditId = id;
    document.getElementById('editId').value = id;
    document.getElementById('title').value = article.title;
    document.getElementById('summary').value = article.summary;
    document.getElementById('category').value = article.category;
    quill.root.innerHTML = article.content;
    
    // Update character counters
    document.getElementById('titleCharCount').textContent = 
        `${article.title.length}/${MAX_TITLE_LENGTH} अक्षर`;
    document.getElementById('summaryCharCount').textContent = 
        `${article.summary.length}/${MAX_SUMMARY_LENGTH} अक्षर`;
    
    // Set image preview
    if (article.image && article.image.trim() !== '') {
        document.getElementById('imagePreview').innerHTML = 
            `<img src="${article.image}">`;
    } else {
        document.getElementById('imagePreview').innerHTML = '';
    }
    
    document.getElementById('submitBtn').innerHTML = '<i class="fas fa-save"></i> लेख अपडेट करें';
    document.getElementById('cancelEdit').style.display = 'flex';
    
    document.querySelector('[data-tab="create"]').click();
}

function deleteArticle(id) {
    if (!confirm('क्या आप वाकई इस लेख को हटाना चाहते हैं? यह क्रिया पूर्ववत नहीं की जा सकती।')) {
        return;
    }
    
    const articleIndex = articles.findIndex(a => a.id === id);
    if (articleIndex === -1) {
        showNotification('लेख नहीं मिला!', 'error');
        return;
    }
    
    articles.splice(articleIndex, 1);
    
    if (saveToStorage()) {
        renderArticlesList();
        
        if (document.getElementById('home').classList.contains('active')) {
            currentPage = 1;
            renderArticles();
        }
        
        showNotification('लेख सफलतापूर्वक हटा दिया गया!', 'info');
    } else {
        showNotification('लेख हटाने में विफल!', 'error');
    }
}

function renderArticlesList() {
    const list = document.getElementById('articlesList');
    const count = document.getElementById('articlesCount');
    
    if (!list) return;
    
    if (articles.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-newspaper"></i>
                <h3>अभी तक कोई लेख नहीं</h3>
                <p>"लेख बनाएं" टैब का उपयोग करके अपना पहला लेख बनाएं!</p>
            </div>
        `;
    } else {
        // Sort by date (newest first)
        const sortedArticles = [...articles].sort((a, b) => 
            new Date(b.date) - new Date(a.date)
        );
        
        list.innerHTML = sortedArticles.map(article => `
            <div class="article-item" data-id="${article.id}">
                <div>
                    <h4>${article.title}</h4>
                    <small><i class="far fa-calendar"></i> ${formatDate(article.date)} | 
                           <i class="fas fa-tag"></i> ${article.category}</small>
                </div>
                <div class="article-actions">
                    <button class="btn-small btn-edit" onclick="editArticle('${article.id}')">
                        <i class="fas fa-edit"></i> संपादित करें
                    </button>
                    <button class="btn-small btn-delete" onclick="deleteArticle('${article.id}')">
                        <i class="fas fa-trash"></i> हटाएं
                    </button>
                </div>
            </div>
        `).join('');
    }
    
    if (count) {
        count.textContent = articles.length;
    }
}

function resetForm() {
    const form = document.getElementById('articleForm');
    if (form) {
        form.reset();
        document.getElementById('editId').value = '';
        document.getElementById('imagePreview').innerHTML = '';
        document.getElementById('image').value = '';
        document.getElementById('fileSizeWarning').style.display = 'none';
        quill.setText('');
        
        // Reset character counters
        document.getElementById('titleCharCount').textContent = `0/${MAX_TITLE_LENGTH} अक्षर`;
        document.getElementById('summaryCharCount').textContent = `0/${MAX_SUMMARY_LENGTH} अक्षर`;
        
        document.getElementById('submitBtn').innerHTML = '<i class="fas fa-paper-plane"></i> लेख सबमिट करें';
        document.getElementById('cancelEdit').style.display = 'none';
        currentEditId = null;
    }
}
// ===== EXPORT/IMPORT FUNCTIONS =====
function exportToJSON() {
    try {
        const data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            articles: articles,
            stats: {
                totalArticles: articles.length,
                totalSize: JSON.stringify(articles).length,
                categories: [...new Set(articles.map(a => a.category))]
            }
        };
        
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `digital-diary-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification(`${articles.length} लेख JSON फ़ाइल में एक्सपोर्ट हो गए`, 'success');
        
    } catch (error) {
        console.error('Export error:', error);
        showNotification('डेटा एक्सपोर्ट करने में विफल', 'error');
    }
}

function exportData() {
    exportToJSON();
}

function importData() {
    const fileInput = document.getElementById('importFile');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('कृपया इम्पोर्ट करने के लिए एक फ़ाइल चुनें', 'error');
        return;
    }
    
    if (!file.name.endsWith('.json')) {
        showNotification('कृपया एक JSON फ़ाइल चुनें', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const importedData = JSON.parse(event.target.result);
            
            // Validate imported data
            if (!importedData.articles || !Array.isArray(importedData.articles)) {
                throw new Error('अमान्य डेटा फॉर्मैट');
            }
            
            if (!confirm(`${importedData.articles.length} लेख इम्पोर्ट करें? यह आपका वर्तमान डेटा बदल देगा।`)) {
                return;
            }
            
            // Replace current articles
            articles = importedData.articles;
            
            // Assign new IDs to avoid conflicts
            articles.forEach(article => {
                article.id = generateUUID();
            });
            
            if (saveToStorage()) {
                renderArticles();
                renderArticlesList();
                showNotification('डेटा सफलतापूर्वक इम्पोर्ट हो गया!', 'success');
                fileInput.value = '';
            } else {
                showNotification('इम्पोर्ट किया गया डेटा सेव करने में विफल!', 'error');
            }
            
        } catch (error) {
            console.error('Import error:', error);
            showNotification('अमान्य फ़ाइल फॉर्मैट!', 'error');
        }
    };
    
    reader.onerror = function() {
        showNotification('फ़ाइल पढ़ने में त्रुटि!', 'error');
    };
    
    reader.readAsText(file);
}

// Initialize GitHub status on load
window.addEventListener('load', function() {
    if (githubConfig && githubConfig.token) {
        updateGitHubStatus();
    }
});
