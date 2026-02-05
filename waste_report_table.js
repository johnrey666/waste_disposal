// ================================
// PERFORMANCE OPTIMIZATION MODULE
// ================================
const Performance = {
    cache: new Map(),
    debounceTimers: {},
    
    getElement(selector) {
        if (!this.cache.has(selector)) {
            const element = document.querySelector(selector);
            if (element) this.cache.set(selector, element);
            return element;
        }
        return this.cache.get(selector);
    },
    
    debounce(func, wait = 300, id = 'default') {
        return (...args) => {
            clearTimeout(this.debounceTimers[id]);
            this.debounceTimers[id] = setTimeout(() => func.apply(this, args), wait);
        };
    },
    
    throttle(func, limit = 300) {
        let inThrottle;
        return (...args) => {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    batchUpdate(callback) {
        requestAnimationFrame(callback);
    }
};

// ================================
// CONFIGURATION
// ================================

// Google Apps Script endpoint for email
const GAS_CONFIG = {
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbyPGgZ54q-lDUu5YxaeQbSJ-z2pDqM8ia4eTfshdpSNbrqBFF7fQZvglx9IeZn0PqHSTg/exec'
};

// Password configuration
const CORRECT_PASSWORD = "admin123";
const PASSWORD_KEY = "fg_operations_auth";
const SESSION_TIMEOUT = 30 * 60 * 1000;

// Firestore configuration
const firebaseConfig = {
    apiKey: "AIzaSyAyp2f1b6cG4E_Dx9eako31LgTDuZrZ8_E",
    authDomain: "disposal-e6b83.firebaseapp.com",
    projectId: "disposal-e6b83",
    storageBucket: "disposal-e6b83.firebasestorage.app",
    messagingSenderId: "1050986320678",
    appId: "1:1050986320678:web:deb5f4c58c3ef0cbc6a7e7",
    measurementId: "G-3Q7705T5FE"
};

// ================================
// GLOBAL VARIABLES
// ================================
let db;
let storage;
let currentPage = 1;
const pageSize = 20;
let lastVisibleDoc = null;
let firstVisibleDoc = null;
let reportsData = [];
let isDataLoading = false;

// Items management variables
let itemsData = [];
let itemsCurrentPage = 1;
const itemsPageSize = 20;
let itemsLastVisibleDoc = null;
let itemsFirstVisibleDoc = null;
let currentEditItemId = null;

// State variables
let currentRejectionData = null;
let currentBulkRejectionData = null;
let currentReportDetailsId = null;
let currentReportToDelete = null;
let currentImageToDelete = null;
let currentImageToDeleteData = null;

// Chart variables
let storeChart = null;
let currentChartType = 'bar'; // Default chart type
let allReportsData = []; // For chart analysis
let chartAnalysis = {
    stores: {},
    dailyReports: {},
    monthlyCosts: {},
    dailyCosts: {},
    timeSeriesData: {} // NEW: For line chart time series
};

// Cache for reports to reduce database calls
let reportsCache = {
    data: [],
    timestamp: 0,
    ttl: 5 * 60 * 1000 // 5 minutes cache
};

// Define all store names
const ALL_STORES = [
    'FG Express IROSIN',
    'FG Express LIGAO',
    'FG Express POLANGUI',
    'FG Express MASBATE',
    'FG Express DARAGA',
    'FG Express BAAO',
    'FG Express PIODURAN',
    'FG Express RIZAL',
    'FG to go TABACO',
    'FG to go LEGAZPI',
    'FG LEGAZPI',
    'FG NAGA'
];

// Store abbreviations for better display
const STORE_ABBREVIATIONS = {
    'FG Express IROSIN': 'FG IROSIN',
    'FG Express LIGAO': 'FG LIGAO',
    'FG Express POLANGUI': 'FG POLANGUI',
    'FG Express MASBATE': 'FG MASBATE',
    'FG Express DARAGA': 'FG DARAGA',
    'FG Express BAAO': 'FG BAAO',
    'FG Express PIODURAN': 'FG PIODURAN',
    'FG Express RIZAL': 'FG RIZAL',
    'FG to go TABACO': 'FG to go TABACO',
    'FG to go LEGAZPI': 'FG to go LEGAZPI',
    'FG LEGAZPI': 'FG LEGAZPI',
    'FG NAGA': 'FG NAGA'
};

// Store display names for chart labels
const STORE_DISPLAY_NAMES = {
    'FG Express IROSIN': 'IROSIN',
    'FG Express LIGAO': 'LIGAO',
    'FG Express POLANGUI': 'POLANGUI',
    'FG Express MASBATE': 'MASBATE',
    'FG Express DARAGA': 'DARAGA',
    'FG Express BAAO': 'BAAO',
    'FG Express PIODURAN': 'PIODURAN',
    'FG Express RIZAL': 'RIZAL',
    'FG to go TABACO': 'TABACO',
    'FG to go LEGAZPI': 'LEGAZPI',
    'FG LEGAZPI': 'LEGAZPI',
    'FG NAGA': 'NAGA'
};

// ================================
// OPTIMIZED IMAGE FUNCTIONS
// ================================
const ImageManager = {
    // Cache for image URLs to avoid repeated processing
    urlCache: new Map(),
    
    displayImagesInItem(item, index, type) {
        if (!item.documentation || !Array.isArray(item.documentation) || item.documentation.length === 0) {
            return '';
        }
        
        const images = item.documentation.filter(doc => doc.type?.startsWith('image/'));
        if (images.length === 0) {
            return '';
        }
        
        // Generate HTML with optimized image loading
        let imagesHTML = `
            <div class="image-gallery-section">
                <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
                    <i class="fas fa-images"></i> ${images.length} image${images.length !== 1 ? 's' : ''}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        `;
        
        images.forEach((doc, docIndex) => {
            // Use cached URL or generate new one
            let imageUrl = this.urlCache.get(doc.path);
            if (!imageUrl) {
                imageUrl = doc.url || this.getFirebaseStorageUrl(doc.path || doc.fullPath || doc.filePath);
                this.urlCache.set(doc.path, imageUrl);
            }
            
            const imageName = doc.name || `Image ${docIndex + 1}`;
            const safeImageName = this.escapeHtml(imageName);
            const uniqueId = `${type}-${index}-${docIndex}`;
            
            imagesHTML += `
                <div class="thumbnail-container" onclick="ImageManager.openModal('${imageUrl}', '${safeImageName}', '${uniqueId}', ${JSON.stringify(doc).replace(/"/g, '&quot;')}, '${currentReportDetailsId}', ${index}, '${type}', ${docIndex})">
                    <img src="${imageUrl}" 
                         alt="${safeImageName}"
                         loading="lazy"
                         style="width: 80px; height: 80px; object-fit: cover;"
                         onerror="ImageManager.handleError(this, '${safeImageName}')">
                    <div class="thumbnail-index">${docIndex + 1}</div>
                </div>
            `;
        });
        
        imagesHTML += `</div></div>`;
        return imagesHTML;
    },
    
    getFirebaseStorageUrl(storagePath) {
        if (!storagePath) return null;
        
        // Use cached result if available
        const cached = this.urlCache.get(storagePath);
        if (cached) return cached;
        
        // Process path
        let cleanPath = storagePath;
        
        // Remove leading slash if present
        if (cleanPath.startsWith('/')) {
            cleanPath = cleanPath.substring(1);
        }
        
        // Remove bucket prefix if present
        const bucketPrefix = `gs://${firebaseConfig.storageBucket}/`;
        if (cleanPath.startsWith(bucketPrefix)) {
            cleanPath = cleanPath.substring(bucketPrefix.length);
        }
        
        // Remove appspot prefix if present
        const appspotPrefix = 'disposal-e6b83.appspot.com/';
        if (cleanPath.startsWith(appspotPrefix)) {
            cleanPath = cleanPath.substring(appspotPrefix.length);
        }
        
        // Encode and construct URL
        const encodedPath = encodeURIComponent(cleanPath);
        const url = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodedPath}?alt=media`;
        
        // Cache the result
        this.urlCache.set(storagePath, url);
        return url;
    },
    
    openModal(imageUrl, imageName, uniqueId, imageData, reportId, itemIndex, itemType, imageIndex) {
        const modal = Performance.getElement('#imageModal');
        const modalImage = Performance.getElement('#modalImage');
        const imageLoading = Performance.getElement('#imageLoading');
        const imageInfo = Performance.getElement('#imageInfo');
        const downloadBtn = Performance.getElement('#downloadImageBtn');
        const deleteBtn = Performance.getElement('#deleteImageBtn');
        
        if (!modal || !modalImage) return;
        
        // Reset modal state
        modalImage.style.display = 'none';
        modalImage.src = '';
        if (imageLoading) imageLoading.style.display = 'block';
        
        // Update info
        if (imageInfo) {
            imageInfo.innerHTML = `
                <div style="text-align: center;">
                    <strong>${imageName}</strong><br>
                    <small>Loading...</small>
                </div>
            `;
        }
        
        // Set download handler
        if (downloadBtn) {
            downloadBtn.onclick = () => this.downloadImage(imageUrl, imageName);
        }
        
        // Set delete handler if imageData is provided
        if (deleteBtn && imageData && reportId) {
            currentImageToDeleteData = {
                reportId: reportId,
                itemIndex: itemIndex,
                itemType: itemType,
                imageIndex: imageIndex,
                imageData: imageData
            };
            deleteBtn.onclick = () => this.openDeleteImageModal(imageData, reportId, itemIndex, itemType, imageIndex);
            deleteBtn.style.display = 'inline-block';
        } else if (deleteBtn) {
            deleteBtn.style.display = 'none';
        }
        
        // Preload image with timeout
        const preloadTimer = setTimeout(() => {
            if (imageLoading) imageLoading.style.display = 'none';
            modalImage.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f8f9fa"/><text x="200" y="140" font-family="Arial" font-size="14" text-anchor="middle" fill="%23666">Loading...</text></svg>';
            modalImage.style.display = 'block';
        }, 5000);
        
        const img = new Image();
        img.onload = () => {
            clearTimeout(preloadTimer);
            modalImage.src = imageUrl;
            modalImage.alt = imageName;
            modalImage.style.display = 'block';
            
            if (imageLoading) imageLoading.style.display = 'none';
            
            if (imageInfo) {
                imageInfo.innerHTML = `
                    <div style="text-align: center;">
                        <strong>${imageName}</strong><br>
                        <small>${img.width} × ${img.height} pixels</small>
                    </div>
                `;
            }
            
            if (downloadBtn) {
                downloadBtn.style.display = 'inline-block';
            }
        };
        
        img.onerror = () => {
            clearTimeout(preloadTimer);
            modalImage.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="%23f8f9fa"/><text x="200" y="140" font-family="Arial" font-size="14" text-anchor="middle" fill="%23666">Image unavailable</text></svg>';
            modalImage.alt = 'Image not available';
            modalImage.style.display = 'block';
            
            if (imageLoading) imageLoading.style.display = 'none';
            
            if (imageInfo) {
                imageInfo.innerHTML = `
                    <div style="text-align: center;">
                        <strong>${imageName}</strong><br>
                        <small style="color: #dc3545;">Failed to load</small>
                    </div>
                `;
            }
        };
        
        img.src = imageUrl;
        modal.style.display = 'flex';
    },
    
    closeModal() {
        const modal = Performance.getElement('#imageModal');
        if (modal) {
            modal.style.display = 'none';
            const modalImage = Performance.getElement('#modalImage');
            if (modalImage) {
                modalImage.src = '';
            }
        }
        currentImageToDeleteData = null;
    },
    
    downloadImage(imageUrl, imageName) {
        if (!imageUrl) return;
        
        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = (imageName || 'image').replace(/[^a-z0-9.]/gi, '_').toLowerCase() + '.jpg';
        link.target = '_blank';
        
        document.body.appendChild(link);
        link.click();
        
        setTimeout(() => {
            document.body.removeChild(link);
        }, 100);
        
        showNotification('Download started...', 'info', 2000);
    },
    
    openDeleteImageModal(imageData, reportId, itemIndex, itemType, imageIndex) {
        currentImageToDelete = { imageData, reportId, itemIndex, itemType, imageIndex };
        
        const deleteImageInfo = Performance.getElement('#deleteImageInfo');
        if (deleteImageInfo) {
            const imageName = imageData.name || 'Image';
            deleteImageInfo.innerHTML = `
                <p><strong>Image:</strong> ${imageName}</p>
                <p><strong>Report:</strong> ${reportId}</p>
                <p><strong>Item Type:</strong> ${itemType === 'expired' ? 'Expired' : 'Waste'}</p>
                <p><strong>Size:</strong> ${imageData.size ? (imageData.size / 1024).toFixed(2) + ' KB' : 'Unknown'}</p>
            `;
        }
        
        const deleteImageModal = Performance.getElement('#deleteImageModal');
        if (deleteImageModal) {
            deleteImageModal.style.display = 'flex';
        }
    },
    
    closeDeleteImageModal() {
        currentImageToDelete = null;
        const deleteImageModal = Performance.getElement('#deleteImageModal');
        if (deleteImageModal) {
            deleteImageModal.style.display = 'none';
        }
    },
    
    async deleteImageFromStorage(imageData) {
        if (!imageData || !imageData.path) {
            throw new Error('Invalid image data');
        }
        
        try {
            // Clean up the path
            let filePath = imageData.path;
            
            // Remove leading slash if present
            if (filePath.startsWith('/')) {
                filePath = filePath.substring(1);
            }
            
            // Remove bucket prefix if present
            const bucketPrefix = `gs://${firebaseConfig.storageBucket}/`;
            if (filePath.startsWith(bucketPrefix)) {
                filePath = filePath.substring(bucketPrefix.length);
            }
            
            // Remove appspot prefix if present
            const appspotPrefix = 'disposal-e6b83.appspot.com/';
            if (filePath.startsWith(appspotPrefix)) {
                filePath = filePath.substring(appspotPrefix.length);
            }
            
            // Delete from Firebase Storage
            const storageRef = storage.ref(filePath);
            await storageRef.delete();
            
            // Remove from cache
            this.urlCache.delete(imageData.path);
            
            return true;
        } catch (error) {
            console.error('Error deleting image from storage:', error);
            throw error;
        }
    },
    
    handleError(imgElement, imageName) {
        console.warn(`Failed to load image: ${imageName}`);
        imgElement.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="%23f0f0f0"/><text x="40" y="40" font-family="Arial" font-size="10" text-anchor="middle" fill="%23999">Image</text></svg>';
        imgElement.style.objectFit = 'contain';
        imgElement.style.padding = '10px';
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/'/g, "&#39;").replace(/"/g, "&quot;");
    },
    
    clearCache() {
        this.urlCache.clear();
    }
};

// ================================
// OPTIMIZED LOADING & NOTIFICATION
// ================================
function showNotification(message, type = 'success', duration = 3000) {
    const notification = Performance.getElement('#notification');
    if (!notification) return;
    
    if (notification.timeoutId) {
        clearTimeout(notification.timeoutId);
    }
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    notification.style.animation = 'slideInRight 0.3s ease';
    
    notification.timeoutId = setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            notification.style.display = 'none';
            notification.style.animation = '';
        }, 300);
    }, duration);
    
    return notification;
}

function showLoading(show, message = 'Loading...') {
    const overlay = Performance.getElement('#loadingOverlay');
    if (!overlay) return;
    
    Performance.batchUpdate(() => {
        overlay.style.display = show ? 'flex' : 'none';
        if (show && message !== 'Loading...') {
            const spinner = overlay.querySelector('.loading-spinner');
            if (spinner) {
                const existingText = spinner.nextElementSibling;
                if (existingText && existingText.tagName === 'P') {
                    existingText.textContent = message;
                } else {
                    const text = document.createElement('p');
                    text.textContent = message;
                    text.style.cssText = 'color: white; margin: 15px 0 0; font-size: 14px; text-align: center;';
                    overlay.appendChild(text);
                }
            }
        }
    });
}

// ================================
// OPTIMIZED AUTHENTICATION
// ================================
function authenticate(enteredPassword) {
    if (!enteredPassword) return false;
    return enteredPassword === CORRECT_PASSWORD;
}

function isAuthenticated() {
    const authData = localStorage.getItem(PASSWORD_KEY);
    if (!authData) return false;
    
    try {
        const { authenticated, timestamp } = JSON.parse(authData);
        const now = Date.now();
        const isExpired = (now - timestamp) >= SESSION_TIMEOUT;
        
        if (isExpired) {
            localStorage.removeItem(PASSWORD_KEY);
            return false;
        }
        
        // Refresh timestamp on activity
        localStorage.setItem(PASSWORD_KEY, JSON.stringify({
            authenticated: true,
            timestamp: now
        }));
        
        return authenticated;
    } catch {
        localStorage.removeItem(PASSWORD_KEY);
        return false;
    }
}

function lockSession() {
    localStorage.removeItem(PASSWORD_KEY);
}

function checkPassword() {
    const passwordInput = Performance.getElement('#password');
    if (!passwordInput) return;
    
    const enteredPassword = passwordInput.value.trim();
    
    if (!enteredPassword) {
        showNotification('Please enter the password', 'error');
        passwordInput.focus();
        return;
    }
    
    if (authenticate(enteredPassword)) {
        localStorage.setItem(PASSWORD_KEY, JSON.stringify({
            authenticated: true,
            timestamp: Date.now()
        }));
        
        showNotification('Access granted! Loading reports...', 'success');
        
        const passwordSection = Performance.getElement('#passwordSection');
        const reportsSection = Performance.getElement('#reportsSection');
        const statisticsSection = Performance.getElement('#statisticsSection');
        
        if (passwordSection) passwordSection.style.display = 'none';
        if (reportsSection) reportsSection.style.display = 'block';
        if (statisticsSection) statisticsSection.style.display = 'block';
        
        passwordInput.value = '';
        
        // Load reports after UI update
        setTimeout(() => {
            loadReports();
        }, 300);
    } else {
        showNotification('Incorrect password. Please try again.', 'error');
        passwordInput.value = '';
        passwordInput.focus();
        passwordInput.style.animation = 'shake 0.5s';
        setTimeout(() => {
            passwordInput.style.animation = '';
        }, 500);
    }
}

function lockReports() {
    lockSession();
    
    const passwordSection = Performance.getElement('#passwordSection');
    const reportsSection = Performance.getElement('#reportsSection');
    const statisticsSection = Performance.getElement('#statisticsSection');
    
    if (passwordSection) passwordSection.style.display = 'block';
    if (reportsSection) reportsSection.style.display = 'none';
    if (statisticsSection) statisticsSection.style.display = 'none';
    
    showNotification('Session locked. Enter password to access again.', 'info');
    
    const passwordInput = Performance.getElement('#password');
    if (passwordInput) {
        passwordInput.focus();
    }
}

// ================================
// OPTIMIZED INITIALIZATION
// ================================
function initializeApp() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        storage = firebase.storage();
        
        // Enable offline persistence for better performance
        db.enablePersistence()
            .then(() => console.log('✅ Firebase persistence enabled'))
            .catch(err => {
                if (err.code === 'failed-precondition') {
                    console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                } else if (err.code === 'unimplemented') {
                    console.log('The current browser does not support persistence.');
                }
            });
        
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        showNotification('Firebase connection failed. Please check console.', 'error');
        return;
    }
    
    if (isAuthenticated()) {
        showReportsSection();
        // Use requestIdleCallback for smoother initial load
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                loadReports();
            }, { timeout: 1000 });
        } else {
            setTimeout(() => {
                loadReports();
            }, 300);
        }
    } else {
        showPasswordSection();
    }
}

function showPasswordSection() {
    const passwordSection = Performance.getElement('#passwordSection');
    if (passwordSection) {
        passwordSection.style.display = 'block';
        const passwordInput = Performance.getElement('#password');
        if (passwordInput) {
            passwordInput.focus();
        }
    }
}

function showReportsSection() {
    const passwordSection = Performance.getElement('#passwordSection');
    const reportsSection = Performance.getElement('#reportsSection');
    const statisticsSection = Performance.getElement('#statisticsSection');
    
    if (passwordSection) passwordSection.style.display = 'none';
    if (reportsSection) reportsSection.style.display = 'block';
    if (statisticsSection) statisticsSection.style.display = 'block';
}

// ================================
// CHART FUNCTIONS - OPTIMIZED
// ================================
function initChartTypeSelector() {
    const chartTypeBtns = document.querySelectorAll('.chart-type-btn');
    chartTypeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            chartTypeBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentChartType = this.dataset.type;
            updateChartControlsVisibility();
            createChartBasedOnType();
        });
    });
}

function updateChartControlsVisibility() {
    const storeSelectorContainer = Performance.getElement('#storeSelectorContainer');
    const dateRangePickerContainer = Performance.getElement('#dateRangePickerContainer');
    const chartPeriod = Performance.getElement('#chartPeriod');
    
    if (currentChartType === 'line') {
        // Show store selector for line chart
        if (storeSelectorContainer) storeSelectorContainer.style.display = 'block';
        
        // Show date range picker if specificDateRange is selected
        if (dateRangePickerContainer && chartPeriod) {
            dateRangePickerContainer.style.display = chartPeriod.value === 'specificDateRange' ? 'block' : 'none';
        }
    } else {
        // Hide store selector for bar and pie charts
        if (storeSelectorContainer) storeSelectorContainer.style.display = 'none';
        if (dateRangePickerContainer) dateRangePickerContainer.style.display = 'none';
    }
}

async function loadAllReportsForChart() {
    try {
        showLoading(true, 'Analyzing store performance...');
        
        const snapshot = await db.collection('wasteReports')
            .orderBy('reportDate', 'desc')
            .get();
        
        allReportsData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            allReportsData.push({ 
                id: doc.id, 
                ...data,
                disposalTypes: Array.isArray(data.disposalTypes) ? data.disposalTypes : 
                              data.disposalType ? [data.disposalType] : ['unknown']
            });
        });
        
        analyzeStorePerformance();
        createChartBasedOnType();
        
    } catch (error) {
        console.error('Error loading reports for chart:', error);
        showNotification('Error analyzing store performance', 'error');
    } finally {
        showLoading(false);
    }
}

function analyzeStorePerformance() {
    chartAnalysis = {
        stores: {},
        dailyReports: {},
        monthlyCosts: {},
        dailyCosts: {},
        timeSeriesData: {} // For line chart time series
    };
    
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    // Initialize ALL stores with zero values
    ALL_STORES.forEach(store => {
        chartAnalysis.stores[store] = {
            totalCost: 0,
            reportCount: 0,
            itemCount: 0,
            approvedItemCount: 0,
            approvedCost: 0,
            reportDates: new Set(),
            monthlyCosts: {},
            dailyCosts: {},
            dailyTotalCosts: {}, // NEW: Track total costs (including pending/rejected)
            currentMetric: 0,
            periodReportCount: 0,
            periodItemCount: 0,
            periodCost: 0,
            periodApprovedCost: 0,
            periodApprovedItemCount: 0,
            periodTotalCost: 0 // NEW: Track period total cost (all items)
        };
    });
    
    // Process reports
    allReportsData.forEach(report => {
        const store = report.store;
        if (!store) return;
        
        const reportDate = new Date(report.reportDate);
        const monthKey = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;
        const dayKey = report.reportDate;
        const dateKey = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}-${String(reportDate.getDate()).padStart(2, '0')}`;
        
        if (!chartAnalysis.stores[store]) {
            chartAnalysis.stores[store] = {
                totalCost: 0,
                reportCount: 0,
                itemCount: 0,
                approvedItemCount: 0,
                approvedCost: 0,
                reportDates: new Set(),
                monthlyCosts: {},
                dailyCosts: {},
                dailyTotalCosts: {},
                currentMetric: 0,
                periodReportCount: 0,
                periodItemCount: 0,
                periodCost: 0,
                periodApprovedCost: 0,
                periodApprovedItemCount: 0,
                periodTotalCost: 0
            };
        }
        
        const storeData = chartAnalysis.stores[store];
        
        // No waste report
        if (report.disposalTypes?.includes('noWaste')) {
            storeData.reportCount++;
            storeData.reportDates.add(report.reportDate);
            
            if (!chartAnalysis.dailyReports[dayKey]) {
                chartAnalysis.dailyReports[dayKey] = new Set();
            }
            chartAnalysis.dailyReports[dayKey].add(store);
            
            if (!chartAnalysis.dailyCosts[dateKey]) {
                chartAnalysis.dailyCosts[dateKey] = {};
            }
            if (!chartAnalysis.dailyCosts[dateKey][store]) {
                chartAnalysis.dailyCosts[dateKey][store] = 0;
            }
            
            return;
        }
        
        // Calculate cost - BOTH approved and total
        let reportCost = 0;
        let approvedReportCost = 0;
        let approvedItemCount = 0;
        let totalItemCount = 0;
        
        if (report.expiredItems) {
            report.expiredItems.forEach(item => {
                const itemCost = item.itemCost || 0;
                const quantity = item.quantity || 0;
                const itemTotalCost = itemCost * quantity;
                
                // Count all items
                totalItemCount++;
                storeData.itemCount++;
                
                // Only count approved items for approved cost calculation
                if (item.approvalStatus === 'approved') {
                    approvedItemCount++;
                    approvedReportCost += itemTotalCost;
                }
                
                // Count all items for total cost (including pending/rejected)
                reportCost += itemTotalCost;
            });
        }
        
        if (report.wasteItems) {
            report.wasteItems.forEach(item => {
                const itemCost = item.itemCost || 0;
                const quantity = item.quantity || 0;
                const itemTotalCost = itemCost * quantity;
                
                // Count all items
                totalItemCount++;
                storeData.itemCount++;
                
                // Only count approved items for approved cost calculation
                if (item.approvalStatus === 'approved') {
                    approvedItemCount++;
                    approvedReportCost += itemTotalCost;
                }
                
                // Count all items for total cost (including pending/rejected)
                reportCost += itemTotalCost;
            });
        }
        
        // Update store data
        storeData.totalCost += reportCost; // Total cost (all items)
        storeData.approvedCost += approvedReportCost; // Approved cost only
        storeData.approvedItemCount += approvedItemCount;
        storeData.reportCount++;
        storeData.reportDates.add(report.reportDate);
        
        // Track monthly costs - BOTH approved and total
        if (!storeData.monthlyCosts[monthKey]) {
            storeData.monthlyCosts[monthKey] = {
                approved: 0,
                total: 0
            };
        }
        storeData.monthlyCosts[monthKey].approved += approvedReportCost;
        storeData.monthlyCosts[monthKey].total += reportCost;
        
        // Track daily costs - BOTH approved and total
        if (!storeData.dailyCosts[dayKey]) {
            storeData.dailyCosts[dayKey] = {
                approved: 0,
                total: 0
            };
        }
        storeData.dailyCosts[dayKey].approved += approvedReportCost;
        storeData.dailyCosts[dayKey].total += reportCost;
        
        // Track daily total costs separately for time series
        if (!storeData.dailyTotalCosts[dayKey]) {
            storeData.dailyTotalCosts[dayKey] = 0;
        }
        storeData.dailyTotalCosts[dayKey] += reportCost;
        
        // Track daily reports
        if (!chartAnalysis.dailyReports[dayKey]) {
            chartAnalysis.dailyReports[dayKey] = new Set();
        }
        chartAnalysis.dailyReports[dayKey].add(store);
        
        // Track costs by exact date
        if (!chartAnalysis.dailyCosts[dateKey]) {
            chartAnalysis.dailyCosts[dateKey] = {};
        }
        if (!chartAnalysis.dailyCosts[dateKey][store]) {
            chartAnalysis.dailyCosts[dateKey][store] = {
                approved: 0,
                total: 0
            };
        }
        chartAnalysis.dailyCosts[dateKey][store].approved += approvedReportCost;
        chartAnalysis.dailyCosts[dateKey][store].total += reportCost;
        
        // Build time series data for line chart
        if (!chartAnalysis.timeSeriesData[dayKey]) {
            chartAnalysis.timeSeriesData[dayKey] = {};
        }
        if (!chartAnalysis.timeSeriesData[dayKey][store]) {
            chartAnalysis.timeSeriesData[dayKey][store] = {
                approved: 0,
                total: 0,
                reports: 0,
                items: 0,
                approvedItems: 0
            };
        }
        chartAnalysis.timeSeriesData[dayKey][store].approved += approvedReportCost;
        chartAnalysis.timeSeriesData[dayKey][store].total += reportCost;
        chartAnalysis.timeSeriesData[dayKey][store].reports += 1;
        chartAnalysis.timeSeriesData[dayKey][store].items += totalItemCount;
        chartAnalysis.timeSeriesData[dayKey][store].approvedItems += approvedItemCount;
    });
}

function createChartBasedOnType() {
    const period = Performance.getElement('#chartPeriod')?.value || 'last7days';
    const metric = Performance.getElement('#chartMetric')?.value || 'cost';
    const sortOrder = Performance.getElement('#chartSort')?.value || 'desc';
    const chartStore = Performance.getElement('#chartStore')?.value || 'all';
    
    if (currentChartType === 'line') {
        createLineChart(period, metric, chartStore);
    } else {
        createBarOrPieChart(period, metric, sortOrder);
    }
}

function createBarOrPieChart(period, metric, sortOrder) {
    let storeEntries = ALL_STORES.map(store => {
        const data = chartAnalysis.stores[store] || {
            totalCost: 0,
            reportCount: 0,
            itemCount: 0,
            approvedItemCount: 0,
            approvedCost: 0,
            reportDates: new Set(),
            monthlyCosts: {},
            dailyCosts: {},
            dailyTotalCosts: {},
            currentMetric: 0,
            periodReportCount: 0,
            periodItemCount: 0,
            periodCost: 0,
            periodApprovedCost: 0,
            periodApprovedItemCount: 0,
            periodTotalCost: 0
        };
        
        // Initialize period metrics
        data.periodReportCount = 0;
        data.periodItemCount = 0;
        data.periodCost = 0;
        data.periodApprovedCost = 0;
        data.periodApprovedItemCount = 0;
        data.periodTotalCost = 0;
        
        return [store, data];
    });
    
    // Calculate period-specific metrics
    calculatePeriodMetrics(storeEntries, period);
    
    // Calculate metric values for sorting
    const storeEntriesWithValues = storeEntries.map(([store, data]) => {
        let metricValue;
        switch(metric) {
            case 'reports':
                metricValue = data.periodReportCount;
                break;
            case 'items':
                metricValue = data.periodApprovedItemCount;
                break;
            case 'totalItems':
                metricValue = data.periodItemCount;
                break;
            case 'average':
                metricValue = data.periodReportCount > 0 ? data.periodApprovedCost / data.periodReportCount : 0;
                break;
            case 'averageTotal':
                metricValue = data.periodReportCount > 0 ? data.periodTotalCost / data.periodReportCount : 0;
                break;
            case 'totalCost':
                metricValue = data.periodTotalCost;
                break;
            default: // cost (approved only)
                metricValue = data.periodApprovedCost;
        }
        return {
            store,
            data,
            metricValue
        };
    });
    
    // Sort based on selected metric
    storeEntriesWithValues.sort((a, b) => {
        return sortOrder === 'desc' ? b.metricValue - a.metricValue : a.metricValue - b.metricValue;
    });
    
    const sortedStoreEntries = storeEntriesWithValues.map(item => [item.store, item.data]);
    
    // Prepare chart data
    const labels = sortedStoreEntries.map(([store]) => STORE_DISPLAY_NAMES[store] || STORE_ABBREVIATIONS[store] || store);
    const dataValues = sortedStoreEntries.map(([store, data]) => {
        switch(metric) {
            case 'reports':
                return data.periodReportCount;
            case 'items':
                return data.periodApprovedItemCount;
            case 'totalItems':
                return data.periodItemCount;
            case 'average':
                return data.periodReportCount > 0 ? data.periodApprovedCost / data.periodReportCount : 0;
            case 'averageTotal':
                return data.periodReportCount > 0 ? data.periodTotalCost / data.periodReportCount : 0;
            case 'totalCost':
                return data.periodTotalCost;
            default: // cost (approved only)
                return data.periodApprovedCost;
        }
    });
    
    createChart(labels, dataValues, sortedStoreEntries, metric, period);
    updateChartStatistics(sortedStoreEntries, metric, period);
}

function calculatePeriodMetrics(storeEntries, period) {
    const now = new Date();
    let startDate, endDate;
    
    switch(period) {
        case 'last7days':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date(now);
            break;
        case 'last30days':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 30);
            endDate = new Date(now);
            break;
        case 'thisWeek':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - startDate.getDay());
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            break;
        case 'lastWeek':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - startDate.getDay() - 7);
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            break;
        case 'thisMonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            break;
        case 'lastMonth':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            break;
        case 'thisQuarter':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
            break;
        case 'thisYear':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            break;
        case 'specificDateRange':
            const dateFrom = Performance.getElement('#chartDateFrom')?.value;
            const dateTo = Performance.getElement('#chartDateTo')?.value;
            if (dateFrom && dateTo) {
                startDate = new Date(dateFrom);
                endDate = new Date(dateTo);
            } else {
                // Default to last 30 days if no dates selected
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 30);
                endDate = new Date(now);
            }
            break;
        default: // all
            startDate = new Date(0); // Beginning of time
            endDate = new Date(8640000000000000); // Far future
    }
    
    // Adjust dates to include whole days
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    storeEntries.forEach(([store, data]) => {
        let periodApprovedCost = 0;
        let periodTotalCost = 0;
        let periodReportCount = 0;
        let periodItemCount = 0;
        let periodApprovedItemCount = 0;
        
        // Iterate through all dates in the period
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateKey = currentDate.toISOString().split('T')[0];
            const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
            
            // Check if store has reports on this date
            if (data.reportDates.has(dateKey)) {
                periodReportCount++;
            }
            
            // Add daily costs
            if (data.dailyCosts[dateKey]) {
                periodApprovedCost += data.dailyCosts[dateKey].approved || 0;
                periodTotalCost += data.dailyCosts[dateKey].total || 0;
            }
            
            // Add daily total costs
            if (data.dailyTotalCosts[dateKey]) {
                // Already included in periodTotalCost above
            }
            
            // Count items for this date
            periodItemCount += calculateItemsForDate(store, dateKey);
            periodApprovedItemCount += calculateApprovedItemsForDate(store, dateKey);
            
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        data.periodReportCount = periodReportCount;
        data.periodApprovedCost = periodApprovedCost;
        data.periodTotalCost = periodTotalCost;
        data.periodItemCount = periodItemCount;
        data.periodApprovedItemCount = periodApprovedItemCount;
        data.periodCost = periodApprovedCost; // For backward compatibility
    });
}

function createLineChart(period, metric, selectedStore) {
    const ctx = document.getElementById('storeChart')?.getContext('2d');
    if (!ctx) return;
    
    if (storeChart) {
        storeChart.destroy();
    }
    
    // Get date range based on period
    const now = new Date();
    let startDate, endDate;
    let dateFormat = 'MMM dd';
    
    switch(period) {
        case 'last7days':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 7);
            endDate = new Date(now);
            break;
        case 'last30days':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - 30);
            endDate = new Date(now);
            break;
        case 'thisWeek':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - startDate.getDay());
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            break;
        case 'lastWeek':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - startDate.getDay() - 7);
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            break;
        case 'thisMonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            dateFormat = 'MMM dd';
            break;
        case 'lastMonth':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            dateFormat = 'MMM dd';
            break;
        case 'thisQuarter':
            const quarter = Math.floor(now.getMonth() / 3);
            startDate = new Date(now.getFullYear(), quarter * 3, 1);
            endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
            dateFormat = 'MMM dd';
            break;
        case 'thisYear':
            startDate = new Date(now.getFullYear(), 0, 1);
            endDate = new Date(now.getFullYear(), 11, 31);
            dateFormat = 'MMM';
            break;
        case 'specificDateRange':
            const dateFrom = Performance.getElement('#chartDateFrom')?.value;
            const dateTo = Performance.getElement('#chartDateTo')?.value;
            if (dateFrom && dateTo) {
                startDate = new Date(dateFrom);
                endDate = new Date(dateTo);
                // Adjust format based on date range length
                const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                dateFormat = dayDiff > 90 ? 'MMM' : 'MMM dd';
            } else {
                // Default to last 30 days
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 30);
                endDate = new Date(now);
            }
            break;
        default: // all
            // Find earliest and latest dates from data
            const allDates = Object.keys(chartAnalysis.timeSeriesData).sort();
            if (allDates.length > 0) {
                startDate = new Date(allDates[0]);
                endDate = new Date(allDates[allDates.length - 1]);
                const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                dateFormat = dayDiff > 90 ? 'MMM yyyy' : 'MMM dd';
            } else {
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 30);
                endDate = new Date(now);
            }
    }
    
    // Adjust dates to include whole days
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    // Generate date labels
    const labels = [];
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().split('T')[0];
        let label;
        
        switch(dateFormat) {
            case 'MMM':
                label = currentDate.toLocaleDateString('en-US', { month: 'short' });
                break;
            case 'MMM yyyy':
                label = currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                break;
            default: // 'MMM dd'
                label = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        labels.push(label);
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Prepare datasets based on selected stores
    const datasets = [];
    const colors = [
        '#2a5934', '#3a7d5a', '#4aa180', '#5abfa6', '#6addcc',
        '#ff6b6b', '#ff8e6b', '#ffb16b', '#ffd46b', '#fff76b',
        '#6b83ff', '#8e6bff', '#b16bff', '#d46bff', '#f76bff'
    ];
    
    let storesToShow = [];
    if (selectedStore === 'all') {
        // Show all stores
        storesToShow = ALL_STORES;
    } else {
        // Show only selected store
        storesToShow = [selectedStore];
    }
    
    storesToShow.forEach((store, index) => {
        // Generate data for this store
        const data = [];
        const currentDate = new Date(startDate);
        let dataIndex = 0;
        
        while (currentDate <= endDate) {
            const dateKey = currentDate.toISOString().split('T')[0];
            let value = 0;
            
            if (chartAnalysis.timeSeriesData[dateKey] && chartAnalysis.timeSeriesData[dateKey][store]) {
                const storeData = chartAnalysis.timeSeriesData[dateKey][store];
                
                switch(metric) {
                    case 'reports':
                        value = storeData.reports || 0;
                        break;
                    case 'items':
                        value = storeData.approvedItems || 0;
                        break;
                    case 'totalItems':
                        value = storeData.items || 0;
                        break;
                    case 'average':
                        value = storeData.reports > 0 ? (storeData.approved || 0) / storeData.reports : 0;
                        break;
                    case 'averageTotal':
                        value = storeData.reports > 0 ? (storeData.total || 0) / storeData.reports : 0;
                        break;
                    case 'totalCost':
                        value = storeData.total || 0;
                        break;
                    default: // cost (approved only)
                        value = storeData.approved || 0;
                }
            }
            
            data.push(value);
            currentDate.setDate(currentDate.getDate() + 1);
            dataIndex++;
        }
        
        // Only add dataset if there's any data
        if (data.some(v => v > 0) || storesToShow.length === 1) {
            const colorIndex = index % colors.length;
            datasets.push({
                label: STORE_DISPLAY_NAMES[store] || STORE_ABBREVIATIONS[store] || store,
                data: data,
                borderColor: colors[colorIndex],
                backgroundColor: colors[colorIndex] + '20',
                borderWidth: 2,
                fill: true,
                tension: 0.1
            });
        }
    });
    
    // Create the chart
    const chartData = {
        labels: labels,
        datasets: datasets
    };
    
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: datasets.length > 1,
                position: 'top'
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) {
                            label += ': ';
                        }
                        
                        const value = context.raw;
                        if (metric === 'cost' || metric === 'totalCost' || metric === 'average' || metric === 'averageTotal') {
                            label += '₱' + value.toLocaleString('en-US', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2
                            });
                        } else {
                            label += value;
                        }
                        
                        return label;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                ticks: {
                    callback: function(value) {
                        if (metric === 'cost' || metric === 'totalCost' || metric === 'average' || metric === 'averageTotal') {
                            return '₱' + value.toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 0
                            });
                        }
                        return value;
                    }
                },
                title: {
                    display: true,
                    text: getYAxisTitle(metric)
                }
            },
            x: {
                grid: { color: 'rgba(0, 0, 0, 0.02)' },
                ticks: {
                    maxRotation: 45,
                    minRotation: 0
                }
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        }
    };
    
    storeChart = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: chartOptions
    });
    
    // Update statistics for line chart
    updateLineChartStatistics(period, metric, selectedStore);
}

function getYAxisTitle(metric) {
    switch(metric) {
        case 'reports': return 'Number of Reports';
        case 'items': return 'Approved Items Count';
        case 'totalItems': return 'All Items Count';
        case 'average': return 'Average Approved Cost (₱)';
        case 'averageTotal': return 'Average Total Cost (₱)';
        case 'totalCost': return 'Total Cost (₱)';
        default: return 'Approved Cost (₱)';
    }
}

function calculateItemsForDate(store, dateKey) {
    let itemCount = 0;
    
    allReportsData.forEach(report => {
        if (report.store === store && report.reportDate === dateKey) {
            if (report.disposalTypes?.includes('noWaste')) {
                return;
            }
            
            itemCount += (report.expiredItems?.length || 0) + (report.wasteItems?.length || 0);
        }
    });
    
    return itemCount;
}

function calculateApprovedItemsForDate(store, dateKey) {
    let approvedCount = 0;
    
    allReportsData.forEach(report => {
        if (report.store === store && report.reportDate === dateKey) {
            if (report.disposalTypes?.includes('noWaste')) {
                return;
            }
            
            if (report.expiredItems) {
                report.expiredItems.forEach(item => {
                    if (item.approvalStatus === 'approved') {
                        approvedCount++;
                    }
                });
            }
            
            if (report.wasteItems) {
                report.wasteItems.forEach(item => {
                    if (item.approvalStatus === 'approved') {
                        approvedCount++;
                    }
                });
            }
        }
    });
    
    return approvedCount;
}

function createChart(labels, dataValues, storeEntries, metric, period) {
    const ctx = document.getElementById('storeChart')?.getContext('2d');
    if (!ctx) return;
    
    if (storeChart) {
        storeChart.destroy();
    }
    
    let chartData, chartOptions;
    const baseColor = '#2a5934';
    
    switch(currentChartType) {
        case 'bar':
            chartData = {
                labels: labels,
                datasets: [{
                    label: getChartLabel(metric, period),
                    data: dataValues,
                    backgroundColor: generateBarColors(dataValues),
                    borderColor: baseColor,
                    borderWidth: 1,
                    borderRadius: 2,
                }]
            };
            
            chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        callbacks: {
                            label: function(context) {
                                return buildChartTooltip(context, storeEntries, metric, period);
                            },
                            title: function(context) {
                                const storeIndex = context[0].dataIndex;
                                const store = storeEntries[storeIndex][0];
                                return store;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: {
                            callback: function(value) {
                                if (metric === 'cost' || metric === 'totalCost' || metric === 'average' || metric === 'averageTotal') {
                                    return '₱' + value.toLocaleString('en-US', {
                                        minimumFractionDigits: 0,
                                        maximumFractionDigits: 0
                                    });
                                }
                                return value;
                            }
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxRotation: 90,
                            minRotation: 45
                        }
                    }
                }
            };
            break;
            
        case 'pie':
            chartData = {
                labels: labels,
                datasets: [{
                    label: getChartLabel(metric, period),
                    data: dataValues,
                    backgroundColor: generatePieColors(labels.length),
                    borderColor: '#fff',
                    borderWidth: 1,
                    hoverOffset: 8
                }]
            };
            
            chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw;
                                const total = dataValues.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                
                                if (metric === 'cost' || metric === 'totalCost' || metric === 'average' || metric === 'averageTotal') {
                                    return `${label}: ₱${value.toLocaleString()} (${percentage}%)`;
                                }
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            };
            break;
    }
    
    if (chartData && chartOptions) {
        storeChart = new Chart(ctx, {
            type: currentChartType,
            data: chartData,
            options: chartOptions
        });
    }
}

function generateBarColors(values) {
    if (values.length === 0) return [];
    const max = Math.max(...values) || 1;
    
    return values.map(value => {
        if (value === 0) return 'rgba(200, 200, 200, 0.5)';
        const ratio = max > 0 ? value / max : 0;
        
        if (ratio > 0.7) return 'rgba(42, 89, 52, 0.9)';
        if (ratio > 0.4) return 'rgba(66, 133, 91, 0.8)';
        return 'rgba(102, 178, 122, 0.7)';
    });
}

function generatePieColors(count) {
    const colors = [];
    const baseHue = 120;
    const saturation = 60;
    const lightness = 50;
    
    for (let i = 0; i < count; i++) {
        const hue = (baseHue + (i * 30)) % 360;
        colors.push(`hsl(${hue}, ${saturation}%, ${lightness}%)`);
    }
    
    return colors;
}

function getChartLabel(metric, period) {
    const periodText = getPeriodText(period);
    switch(metric) {
        case 'cost': return `Approved At-Cost - ${periodText}`;
        case 'totalCost': return `Total At-Cost (All Items) - ${periodText}`;
        case 'reports': return `Reports Count - ${periodText}`;
        case 'items': return `Approved Items - ${periodText}`;
        case 'totalItems': return `All Items - ${periodText}`;
        case 'average': return `Average Approved Cost - ${periodText}`;
        case 'averageTotal': return `Average Total Cost - ${periodText}`;
        default: return `Approved At-Cost - ${periodText}`;
    }
}

function getPeriodText(period) {
    const now = new Date();
    const dateFrom = Performance.getElement('#chartDateFrom');
    const dateTo = Performance.getElement('#chartDateTo');
    
    switch(period) {
        case 'last7days':
            return 'Last 7 Days';
        case 'last30days':
            return 'Last 30 Days';
        case 'thisWeek':
            const thisWeekStart = new Date(now);
            thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());
            return `This Week (${thisWeekStart.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})})`;
        case 'lastWeek':
            const lastWeekStart = new Date(now);
            lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7);
            return `Last Week (${lastWeekStart.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})})`;
        case 'thisMonth':
            return `This Month (${now.toLocaleDateString('en-US', {month: 'short'})})`;
        case 'lastMonth':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return `Last Month (${lastMonth.toLocaleDateString('en-US', {month: 'short'})})`;
        case 'thisQuarter':
            return 'This Quarter';
        case 'thisYear':
            return `This Year (${now.getFullYear()})`;
        case 'specificDateRange':
            if (dateFrom?.value && dateTo?.value) {
                const fromDate = new Date(dateFrom.value);
                const toDate = new Date(dateTo.value);
                return `${fromDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${toDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}`;
            }
            return 'Selected Date Range';
        default:
            return 'All Time';
    }
}

function buildChartTooltip(context, storeEntries, metric, period) {
    const value = context.raw;
    const storeIndex = context.dataIndex;
    const store = storeEntries[storeIndex][0];
    const storeData = storeEntries[storeIndex][1];
    
    let label = '';
    
    switch(metric) {
        case 'reports':
            label += `${value} report${value !== 1 ? 's' : ''}`;
            break;
        case 'items':
            label += `${value} approved item${value !== 1 ? 's' : ''}`;
            break;
        case 'totalItems':
            label += `${value} item${value !== 1 ? 's' : ''} (all status)`;
            break;
        case 'average':
            label += `₱${value.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} per report (approved only)`;
            break;
        case 'averageTotal':
            label += `₱${value.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} per report (all items)`;
            break;
        case 'totalCost':
            label += `₱${value.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} (all items)`;
            break;
        default: // cost (approved only)
            label += `₱${value.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} (approved only)`;
    }
    
    // Add comparison with total if applicable
    if (metric === 'cost' && storeData.periodTotalCost > 0) {
        const totalCost = storeData.periodTotalCost;
        const approvalRate = totalCost > 0 ? Math.round((value / totalCost) * 100) : 0;
        label += ` • ${approvalRate}% of total cost`;
    }
    
    if (metric === 'items' && storeData.periodItemCount > 0) {
        const totalItems = storeData.periodItemCount;
        const approvalRate = totalItems > 0 ? Math.round((value / totalItems) * 100) : 0;
        label += ` • ${approvalRate}% approval rate`;
    }
    
    if (metric !== 'reports') {
        label += ` (${storeData.periodReportCount} report${storeData.periodReportCount !== 1 ? 's' : ''} in period)`;
    }
    
    const lastReportDate = getLastReportDate(store);
    if (lastReportDate) {
        label += ` • Last: ${lastReportDate}`;
    }
    
    return label;
}

function getLastReportDate(store) {
    const storeData = chartAnalysis.stores[store];
    if (!storeData || storeData.reportDates.size === 0) return null;
    
    const dates = Array.from(storeData.reportDates);
    dates.sort((a, b) => new Date(b) - new Date(a));
    
    const lastDate = new Date(dates[0]);
    const now = new Date();
    const diffTime = Math.abs(now - lastDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return lastDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
    });
}

function updateChartStatistics(storeEntries, metric, period) {
    if (storeEntries.length === 0) return;
    
    const now = new Date();
    
    // Top performing store
    const topStore = storeEntries[0];
    const topStoreName = Performance.getElement('#topStoreName');
    const topStoreValue = Performance.getElement('#topStoreValue');
    
    if (topStoreName && topStoreValue) {
        const value = metric === 'reports' ? topStore[1].periodReportCount :
                     metric === 'items' ? topStore[1].periodApprovedItemCount :
                     metric === 'totalItems' ? topStore[1].periodItemCount :
                     metric === 'average' ? (topStore[1].periodReportCount > 0 ? topStore[1].periodApprovedCost / topStore[1].periodReportCount : 0) :
                     metric === 'averageTotal' ? (topStore[1].periodReportCount > 0 ? topStore[1].periodTotalCost / topStore[1].periodReportCount : 0) :
                     metric === 'totalCost' ? topStore[1].periodTotalCost :
                     topStore[1].periodApprovedCost;
        
        topStoreName.textContent = STORE_DISPLAY_NAMES[topStore[0]] || STORE_ABBREVIATIONS[topStore[0]] || topStore[0];
        topStoreValue.textContent = metric === 'reports' ? `${value} reports` :
                                   metric === 'items' ? `${value} approved items` :
                                   metric === 'totalItems' ? `${value} items` :
                                   metric === 'average' ? `₱${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` :
                                   metric === 'averageTotal' ? `₱${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` :
                                   `₱${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
    
    // Total cost/reports
    const totalCostEl = Performance.getElement('#totalCost');
    const reportCountEl = Performance.getElement('#reportCount');
    
    if (totalCostEl && reportCountEl) {
        const totalValue = storeEntries.reduce((sum, [store, data]) => {
            return sum + (metric === 'reports' ? data.periodReportCount :
                         metric === 'items' ? data.periodApprovedItemCount :
                         metric === 'totalItems' ? data.periodItemCount :
                         metric === 'average' ? (data.periodReportCount > 0 ? data.periodApprovedCost / data.periodReportCount : 0) :
                         metric === 'averageTotal' ? (data.periodReportCount > 0 ? data.periodTotalCost / data.periodReportCount : 0) :
                         metric === 'totalCost' ? data.periodTotalCost :
                         data.periodApprovedCost);
        }, 0);
        
        const totalReports = storeEntries.reduce((sum, [store, data]) => sum + data.periodReportCount, 0);
        
        totalCostEl.textContent = metric === 'reports' ? `${totalValue}` :
                                 metric === 'items' ? `${totalValue}` :
                                 metric === 'totalItems' ? `${totalValue}` :
                                 metric === 'average' ? `₱${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` :
                                 metric === 'averageTotal' ? `₱${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` :
                                 `₱${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        reportCountEl.textContent = `${totalReports} report${totalReports !== 1 ? 's' : ''}`;
    }
    
    // Most consistent store
    const consistentStoreEl = Performance.getElement('#consistentStore');
    const consistencyRateEl = Performance.getElement('#consistencyRate');
    
    if (consistentStoreEl && consistencyRateEl) {
        let mostConsistentStore = '';
        let highestRate = 0;
        
        storeEntries.forEach(([store, data]) => {
            const rate = getStoreDailyRate(store);
            if (rate > highestRate && data.reportCount > 0) {
                highestRate = rate;
                mostConsistentStore = store;
            }
        });
        
        consistentStoreEl.textContent = mostConsistentStore ? (STORE_DISPLAY_NAMES[mostConsistentStore] || STORE_ABBREVIATIONS[mostConsistentStore] || mostConsistentStore) : '-';
        consistencyRateEl.textContent = `${highestRate}% reporting rate`;
    }
    
    // Store needing attention
    const attentionStoreEl = Performance.getElement('#attentionStore');
    const attentionReasonEl = Performance.getElement('#attentionReason');
    
    if (attentionStoreEl && attentionReasonEl) {
        let attentionStore = '';
        let reason = '';
        
        for (const [store, data] of storeEntries) {
            if (data.periodReportCount === 0) {
                attentionStore = store;
                reason = 'No reports in selected period';
                break;
            }
        }
        
        if (!attentionStore) {
            for (const [store, data] of storeEntries) {
                if (data.periodReportCount < 2) {
                    attentionStore = store;
                    reason = `Only ${data.periodReportCount} report${data.periodReportCount !== 1 ? 's' : ''} in period`;
                    break;
                }
            }
        }
        
        if (!attentionStore) {
            attentionStore = 'All stores active';
            reason = 'No issues';
        }
        
        attentionStoreEl.textContent = attentionStore ? (STORE_DISPLAY_NAMES[attentionStore] || STORE_ABBREVIATIONS[attentionStore] || attentionStore) : '-';
        attentionReasonEl.textContent = reason;
    }
    
    // Daily reporting rate
    const dailyRateEl = Performance.getElement('#dailyRate');
    if (dailyRateEl) {
        const totalStores = storeEntries.length;
        const activeStores = storeEntries.filter(([store, data]) => {
            return data.periodReportCount > 0;
        }).length;
        
        const dailyRate = totalStores > 0 ? Math.round((activeStores / totalStores) * 100) : 0;
        dailyRateEl.textContent = `${dailyRate}%`;
    }
    
    // Last updated
    const lastUpdatedEl = Performance.getElement('#lastUpdated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = `Updated: ${now.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}`;
    }
    
    // Update period info
    const periodInfoEl = Performance.getElement('#periodInfo');
    if (periodInfoEl) {
        periodInfoEl.textContent = getPeriodText(period);
    }
}

function updateLineChartStatistics(period, metric, selectedStore) {
    const now = new Date();
    const periodInfoEl = Performance.getElement('#periodInfo');
    
    if (periodInfoEl) {
        periodInfoEl.textContent = getPeriodText(period) + (selectedStore !== 'all' ? ` - ${selectedStore}` : '');
    }
    
    // Update last updated
    const lastUpdatedEl = Performance.getElement('#lastUpdated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = `Updated: ${now.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}`;
    }
    
    // Hide or update other stats as needed for line chart
    const statCards = document.querySelectorAll('.chart-stat-card');
    statCards.forEach(card => {
        card.style.opacity = '0.6';
    });
}

function getStoreDailyRate(store) {
    const storeData = chartAnalysis.stores[store];
    if (!storeData) return 0;
    
    const reportDates = Array.from(storeData.reportDates);
    if (reportDates.length === 0) return 0;
    
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentReports = reportDates.filter(dateStr => {
        const reportDate = new Date(dateStr);
        return reportDate >= thirtyDaysAgo;
    });
    
    const uniqueDays = new Set(recentReports).size;
    return Math.round((uniqueDays / 30) * 100);
}

function refreshChart() {
    loadAllReportsForChart();
}

function updateChartControls() {
    updateChartControlsVisibility();
    
    const periodSelect = Performance.getElement('#chartPeriod');
    const dateRangePickerContainer = Performance.getElement('#dateRangePickerContainer');
    
    if (periodSelect && dateRangePickerContainer) {
        if (periodSelect.value === 'specificDateRange') {
            dateRangePickerContainer.style.display = 'block';
            // Set default dates if not set
            const dateFrom = Performance.getElement('#chartDateFrom');
            const dateTo = Performance.getElement('#chartDateTo');
            const today = new Date().toISOString().split('T')[0];
            const lastWeek = new Date();
            lastWeek.setDate(lastWeek.getDate() - 7);
            const lastWeekStr = lastWeek.toISOString().split('T')[0];
            
            if (dateFrom && !dateFrom.value) dateFrom.value = lastWeekStr;
            if (dateTo && !dateTo.value) dateTo.value = today;
        } else {
            dateRangePickerContainer.style.display = 'none';
        }
        createChartBasedOnType();
    }
}

// ================================
// UTILITY FUNCTIONS - OPTIMIZED
// ================================
function calculateReportCost(report) {
    if (!report) return 0;
    
    if (report.disposalTypes?.includes('noWaste')) {
        return 0;
    }
    
    let totalCost = 0;
    
    if (report.expiredItems) {
        report.expiredItems.forEach(item => {
            const itemCost = item.itemCost || 0;
            const quantity = item.quantity || 0;
            totalCost += itemCost * quantity;
        });
    }
    
    if (report.wasteItems) {
        report.wasteItems.forEach(item => {
            const itemCost = item.itemCost || 0;
            const quantity = item.quantity || 0;
            totalCost += itemCost * quantity;
        });
    }
    
    return totalCost;
}

function calculateApprovedReportCost(report) {
    if (!report) return 0;
    
    if (report.disposalTypes?.includes('noWaste')) {
        return 0;
    }
    
    let approvedCost = 0;
    
    if (report.expiredItems) {
        report.expiredItems.forEach(item => {
            if (item.approvalStatus === 'approved') {
                const itemCost = item.itemCost || 0;
                const quantity = item.quantity || 0;
                approvedCost += itemCost * quantity;
            }
        });
    }
    
    if (report.wasteItems) {
        report.wasteItems.forEach(item => {
            if (item.approvalStatus === 'approved') {
                const itemCost = item.itemCost || 0;
                const quantity = item.quantity || 0;
                approvedCost += itemCost * quantity;
            }
        });
    }
    
    return approvedCost;
}

function getCostCellClass(cost) {
    if (cost === 0) return '';
    if (cost > 5000) return 'high';
    if (cost > 1000) return 'medium';
    return 'low';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    } catch {
        return 'Invalid Date';
    }
}

function formatDateTime(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'Invalid Date';
    }
}

function getDisposalTypeBadge(disposalTypes) {
    if (!Array.isArray(disposalTypes)) {
        disposalTypes = [disposalTypes];
    }
    
    const badges = [];
    if (disposalTypes.includes('noWaste')) {
        badges.push('<span class="type-badge type-noWaste"><i class="fas fa-check-circle"></i> No Waste</span>');
    } else {
        if (disposalTypes.includes('expired')) {
            badges.push('<span class="type-badge type-expired"><i class="fas fa-calendar-times"></i> Expired</span>');
        }
        if (disposalTypes.includes('waste')) {
            badges.push('<span class="type-badge type-waste"><i class="fas fa-trash-alt"></i> Waste</span>');
        }
    }
    
    return badges.length > 0 ? badges.join(' ') : '<span class="type-badge">Unknown</span>';
}

function getDisposalTypeText(disposalTypes) {
    if (!Array.isArray(disposalTypes)) {
        disposalTypes = [disposalTypes];
    }
    
    if (disposalTypes.includes('noWaste')) {
        return 'NO WASTE';
    } else if (disposalTypes.includes('expired') && disposalTypes.includes('waste')) {
        return 'EXPIRED & WASTE';
    } else if (disposalTypes.includes('expired')) {
        return 'EXPIRED';
    } else if (disposalTypes.includes('waste')) {
        return 'WASTE';
    } else {
        return 'N/A';
    }
}

function getReportApprovalStatus(report) {
    if (!report) return 'pending';
    
    if (report.disposalTypes?.includes('noWaste')) {
        return 'complete';
    }
    
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let totalItems = 0;
    
    const expiredItems = report.expiredItems || [];
    const wasteItems = report.wasteItems || [];
    
    [...expiredItems, ...wasteItems].forEach(item => {
        totalItems++;
        const status = item.approvalStatus || 'pending';
        if (status === 'approved') approvedCount++;
        else if (status === 'rejected') rejectedCount++;
        else pendingCount++;
    });
    
    if (totalItems === 0) return 'complete';
    if (pendingCount === totalItems) return 'pending';
    if (approvedCount === totalItems) return 'complete';
    if (rejectedCount === totalItems) return 'rejected';
    return 'partial';
}

function getApprovalStatusBadge(report) {
    const status = getReportApprovalStatus(report);
    
    switch(status) {
        case 'pending':
            return '<span class="item-approval-status status-pending"><i class="fas fa-clock"></i> Pending</span>';
        case 'complete':
            return '<span class="item-approval-status status-approved"><i class="fas fa-check-circle"></i> Approved</span>';
        case 'rejected':
            return '<span class="item-approval-status status-rejected"><i class="fas fa-times-circle"></i> Rejected</span>';
        case 'partial':
            return '<span class="item-approval-status status-partial"><i class="fas fa-exclamation-circle"></i> Partial</span>';
        default:
            return '<span class="item-approval-status status-pending"><i class="fas fa-clock"></i> Pending</span>';
    }
}

function getItemCount(report) {
    return (report.expiredItems?.length || 0) + (report.wasteItems?.length || 0);
}

function getApprovedItemCount(report) {
    let approvedCount = 0;
    
    if (report.expiredItems) {
        report.expiredItems.forEach(item => {
            if (item.approvalStatus === 'approved') {
                approvedCount++;
            }
        });
    }
    
    if (report.wasteItems) {
        report.wasteItems.forEach(item => {
            if (item.approvalStatus === 'approved') {
                approvedCount++;
            }
        });
    }
    
    return approvedCount;
}

// ================================
// REPORT DETAILS - OPTIMIZED
// ================================
async function viewReportDetails(reportId) {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to view report details', 'error');
        return;
    }
    
    showLoading(true, 'Loading report details...');
    
    try {
        currentReportDetailsId = reportId;
        
        const doc = await db.collection('wasteReports').doc(reportId).get();
        
        if (!doc.exists) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const data = doc.data();
        const report = { 
            id: doc.id, 
            ...data,
            disposalTypes: Array.isArray(data.disposalTypes) ? data.disposalTypes : 
                          data.disposalType ? [data.disposalType] : ['unknown']
        };
        
        await buildModalContent(report);
        
        const detailsModal = Performance.getElement('#detailsModal');
        if (detailsModal) {
            detailsModal.style.display = 'flex';
        }
        
    } catch (error) {
        console.error('Error loading report details:', error);
        showNotification('Error loading report details: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function buildModalContent(report) {
    const modalContent = Performance.getElement('#modalContent');
    if (!modalContent) return;
    
    const content = await buildReportContent(report);
    modalContent.innerHTML = content;
    
    // Add delete button handler
    const deleteReportButton = Performance.getElement('#deleteReportButton');
    if (deleteReportButton) {
        deleteReportButton.onclick = () => openDeleteModal(report);
    }
}

async function buildReportContent(report) {
    const disposalTypes = report.disposalTypes;
    
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let totalItems = 0;
    
    const expiredItems = report.expiredItems || [];
    const wasteItems = report.wasteItems || [];
    
    [...expiredItems, ...wasteItems].forEach(item => {
        totalItems++;
        const status = item.approvalStatus || 'pending';
        if (status === 'approved') approvedCount++;
        else if (status === 'rejected') rejectedCount++;
        else pendingCount++;
    });
    
    const totalCost = calculateReportCost(report);
    const approvedCost = calculateApprovedReportCost(report);
    const approvalStatus = getReportApprovalStatus(report);
    
    let content = `
        <div class="details-section">
            <div class="details-grid">
                <div class="detail-item">
                    <div class="detail-label">Report ID</div>
                    <div class="detail-value">${report.reportId || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Store</div>
                    <div class="detail-value">${report.store || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Personnel</div>
                    <div class="detail-value">${report.personnel || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Email</div>
                    <div class="detail-value">${report.email || 'N/A'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Report Date</div>
                    <div class="detail-value">${formatDate(report.reportDate)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Submitted</div>
                    <div class="detail-value">${formatDateTime(report.submittedAt)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Disposal Type(s)</div>
                    <div class="detail-value">${getDisposalTypeBadge(disposalTypes)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Total At-Cost</div>
                    <div class="detail-value">
                        <strong>₱${totalCost.toFixed(2)}</strong>
                        ${approvedCost < totalCost ? `<div style="font-size: 11px; color: #666;">(₱${approvedCost.toFixed(2)} approved)</div>` : ''}
                    </div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Overall Status</div>
                    <div class="detail-value">${getApprovalStatusBadge(report)}</div>
                </div>
                ${report.hasImages ? `
                <div class="detail-item">
                    <div class="detail-label">Images</div>
                    <div class="detail-value">
                        <span style="background: #d1ecf1; color: #0c5460; padding: 2px 8px; border-radius: 10px; font-size: 11px;">
                            <i class="fas fa-images"></i> ${report.imageCount || 0} images
                        </span>
                    </div>
                </div>
                ` : ''}
            </div>
            
            <div class="approval-summary">
                <div class="approval-count approved-count">
                    <i class="fas fa-check-circle"></i> ${approvedCount} Approved
                </div>
                <div class="approval-count rejected-count">
                    <i class="fas fa-times-circle"></i> ${rejectedCount} Rejected
                </div>
                <div class="approval-count pending-count">
                    <i class="fas fa-clock"></i> ${pendingCount} Pending
                </div>
                <div class="approval-count">
                    <i class="fas fa-boxes"></i> ${totalItems} Total
                </div>
            </div>
    `;
    
    // Add bulk actions if there are pending items
    if (pendingCount > 0 && !disposalTypes.includes('noWaste')) {
        let bulkActions = '';
        
        if (expiredItems.length > 0) {
            const pendingExpired = expiredItems.filter(item => (!item.approvalStatus || item.approvalStatus === 'pending')).length;
            if (pendingExpired > 0) {
                bulkActions += `
                    <div class="bulk-approval-actions" style="margin-bottom: 10px;">
                        <h5><i class="fas fa-calendar-times"></i> Expired Items Actions (${pendingExpired} pending):</h5>
                        <button class="bulk-approval-btn bulk-approve-btn" onclick="bulkApproveItems('${report.id}', 'expired')">
                            <i class="fas fa-check"></i> Approve All Expired
                        </button>
                        <button class="bulk-approval-btn bulk-reject-btn" onclick="openBulkRejectionModal('${report.id}', ${pendingExpired}, 'expired')">
                            <i class="fas fa-times"></i> Reject All Expired
                        </button>
                    </div>
                `;
            }
        }
        
        if (wasteItems.length > 0) {
            const pendingWaste = wasteItems.filter(item => (!item.approvalStatus || item.approvalStatus === 'pending')).length;
            if (pendingWaste > 0) {
                bulkActions += `
                    <div class="bulk-approval-actions">
                        <h5><i class="fas fa-trash-alt"></i> Waste Items Actions (${pendingWaste} pending):</h5>
                        <button class="bulk-approval-btn bulk-approve-btn" onclick="bulkApproveItems('${report.id}', 'waste')">
                            <i class="fas fa-check"></i> Approve All Waste
                        </button>
                        <button class="bulk-approval-btn bulk-reject-btn" onclick="openBulkRejectionModal('${report.id}', ${pendingWaste}, 'waste')">
                            <i class="fas fa-times"></i> Reject All Waste
                        </button>
                    </div>
                `;
            }
        }
        
        if (bulkActions) {
            content += `
                <div class="bulk-approval-section">
                    <h4><i class="fas fa-bolt"></i> Bulk Actions</h4>
                    ${bulkActions}
                </div>
            `;
        }
    }
    
    // Add items sections with images
    if (expiredItems.length > 0) {
        content += await buildItemsSection(report, 'expired');
    }
    
    if (wasteItems.length > 0) {
        content += await buildItemsSection(report, 'waste');
    }
    
    if (disposalTypes.includes('noWaste')) {
        content += buildNoWasteContent();
    }
    
    content += `</div>`;
    return content;
}

async function buildItemsSection(report, type) {
    const items = type === 'expired' ? report.expiredItems : report.wasteItems;
    const title = type === 'expired' ? 'Expired Items' : 'Waste Items';
    const icon = type === 'expired' ? 'fa-calendar-times' : 'fa-trash-alt';
    
    let content = `
        <div class="details-section">
            <h3><i class="fas ${icon}"></i> ${title} (${items.length})</h3>
            <div class="item-list">
    `;
    
    items.forEach((item, index) => {
        content += buildItemContent(item, index, type, report.id);
    });
    
    content += `</div></div>`;
    return content;
}

function buildItemContent(item, index, type, reportId) {
    const approvalStatus = item.approvalStatus || 'pending';
    const statusClass = `status-${approvalStatus}`;
    const statusIcon = approvalStatus === 'approved' ? 'fa-check-circle' : 
                     approvalStatus === 'rejected' ? 'fa-times-circle' : 'fa-clock';
    const itemCost = item.itemCost || 0;
    const totalCost = itemCost * (item.quantity || 0);
    
    let content = `
        <div class="item-list-item">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <div>
                    <strong>Item ${index + 1}: ${item.item || 'N/A'}</strong>
                    <span class="item-approval-status ${statusClass}" style="margin-left: 8px;">
                        <i class="fas ${statusIcon}"></i> ${approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
                    </span>
                </div>
                <div style="text-align: right;">
                    <span style="background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 10px; font-size: 11px; display: block; margin-bottom: 4px;">
                        ${item.quantity || 0} ${item.unit || 'units'}
                    </span>
                    <span style="background: #d4edda; color: #155724; padding: 2px 8px; border-radius: 10px; font-size: 11px; display: block;">
                        ₱${totalCost.toFixed(2)} ${approvalStatus !== 'approved' ? '<small style="color: #999;">(pending)</small>' : ''}
                    </span>
                </div>
            </div>
            <div style="font-size: 12px; color: var(--color-gray); margin-bottom: 8px;">
    `;
    
    if (type === 'expired') {
        content += `
            <div>Delivered: ${formatDate(item.deliveredDate)}</div>
            <div>Manufactured: ${formatDate(item.manufacturedDate)}</div>
            <div>Expired: ${formatDate(item.expirationDate)}</div>
        `;
    } else {
        content += `<div>Reason: ${item.reason || 'N/A'}</div>`;
    }
    
    content += `<div>Unit Cost: ₱${(item.itemCost || 0).toFixed(2)}</div></div>`;
    
    // Add approval/rejection info
    if (approvalStatus === 'approved' && item.approvedAt) {
        content += `
            <div style="font-size: 10px; color: #155724; margin-bottom: 8px;">
                <i class="fas fa-check-circle"></i> Approved by ${item.approvedBy || 'Administrator'} on ${formatDate(item.approvedAt)}
            </div>
        `;
    }
    
    if (approvalStatus === 'rejected' && item.rejectionReason) {
        content += `
            <div class="rejection-reason">
                <i class="fas fa-times-circle"></i> <strong>Rejection Reason:</strong> ${item.rejectionReason}
                <div style="font-size: 9px; margin-top: 2px;">
                    Rejected by ${item.rejectedBy || 'Administrator'} on ${formatDate(item.rejectedAt)}
                </div>
            </div>
        `;
    }
    
    // Add images using optimized ImageManager
    content += ImageManager.displayImagesInItem(item, index, type);
    
    // Add notes if exists
    if (item.notes) {
        content += `
            <div style="margin-top: 8px; padding: 8px; background: var(--color-offwhite); border-radius: var(--border-radius); font-size: 11px;">
                <strong>Notes:</strong> ${item.notes}
            </div>
        `;
    }
    
    // Add approval buttons if pending
    if (approvalStatus === 'pending') {
        content += `
            <div class="approval-actions">
                <button class="approve-btn" onclick="approveItem('${reportId}', ${index}, '${type}')">
                    <i class="fas fa-check"></i> Approve
                </button>
                <button class="reject-btn" onclick="openRejectionModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${reportId}', ${index}, '${type}')">
                    <i class="fas fa-times"></i> Reject
                </button>
            </div>
        `;
    }
    
    content += `</div>`;
    return content;
}

function buildNoWasteContent() {
    return `
        <div class="details-section">
            <h3><i class="fas fa-check-circle"></i> No Waste Report</h3>
            <div style="text-align: center; padding: 40px; background: var(--color-offwhite); border-radius: var(--border-radius);">
                <i class="fas fa-check-circle" style="font-size: 48px; color: var(--color-success); margin-bottom: 16px;"></i>
                <p style="color: var(--color-gray);">No waste or expired items to report for this period.</p>
                <div style="margin-top: 16px; font-size: 12px; color: var(--color-primary);">
                    <i class="fas fa-check"></i> Automatically approved
                </div>
            </div>
        </div>
    `;
}

function closeDetailsModal() {
    const detailsModal = Performance.getElement('#detailsModal');
    if (detailsModal) {
        detailsModal.style.display = 'none';
    }
    currentReportDetailsId = null;
}

// ================================
// DELETE FUNCTIONALITY
// ================================
async function deleteAllImagesFromReport(report) {
    try {
        const imagesToDelete = [];
        
        // Collect all images from expired items
        if (report.expiredItems) {
            report.expiredItems.forEach(item => {
                if (item.documentation && Array.isArray(item.documentation)) {
                    item.documentation.forEach(doc => {
                        if (doc.type?.startsWith('image/') && doc.path) {
                            imagesToDelete.push(doc);
                        }
                    });
                }
            });
        }
        
        // Collect all images from waste items
        if (report.wasteItems) {
            report.wasteItems.forEach(item => {
                if (item.documentation && Array.isArray(item.documentation)) {
                    item.documentation.forEach(doc => {
                        if (doc.type?.startsWith('image/') && doc.path) {
                            imagesToDelete.push(doc);
                        }
                    });
                }
            });
        }
        
        // Delete all images
        for (const image of imagesToDelete) {
            try {
                await ImageManager.deleteImageFromStorage(image);
                console.log(`Deleted image: ${image.path}`);
            } catch (error) {
                console.warn(`Failed to delete image ${image.path}:`, error);
                // Continue deleting other images even if one fails
            }
        }
        
        console.log(`Deleted ${imagesToDelete.length} images for report ${report.id}`);
        return imagesToDelete.length;
        
    } catch (error) {
        console.error('Error deleting images:', error);
        throw error;
    }
}

async function deleteReport(reportId) {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to delete reports', 'error');
        return;
    }
    
    showLoading(true, 'Deleting report and images...');
    
    try {
        // Get the report data first to find and delete images
        const reportDoc = await db.collection('wasteReports').doc(reportId).get();
        if (!reportDoc.exists) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const report = { id: reportDoc.id, ...reportDoc.data() };
        
        // Delete all images from storage
        const imagesDeleted = await deleteAllImagesFromReport(report);
        
        // Delete the report document from Firestore
        await db.collection('wasteReports').doc(reportId).delete();
        
        // Update UI
        const index = reportsData.findIndex(r => r.id === reportId);
        if (index !== -1) {
            reportsData.splice(index, 1);
        }
        
        // Reload reports
        await loadReports();
        
        // Close modals
        closeDeleteModal();
        closeDetailsModal();
        
        showNotification(`Report deleted successfully. ${imagesDeleted} images removed from storage.`, 'success');
        
        // Refresh chart data
        setTimeout(() => {
            loadAllReportsForChart();
        }, 500);
        
    } catch (error) {
        console.error('Error deleting report:', error);
        showNotification('Error deleting report: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteAllReports(applyFilters = false) {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to delete reports', 'error');
        return;
    }
    
    showLoading(true, 'Deleting reports and images...');
    
    try {
        let query = db.collection('wasteReports');
        
        // Apply filters if requested
        if (applyFilters) {
            const storeFilter = Performance.getElement('#filterStore');
            const dateFromFilter = Performance.getElement('#filterDateFrom');
            const dateToFilter = Performance.getElement('#filterDateTo');
            const typeFilter = Performance.getElement('#filterType');
            const filterStatus = Performance.getElement('#filterStatus');
            
            if (storeFilter?.value) {
                query = query.where('store', '==', storeFilter.value);
            }
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            showNotification('No reports found to delete', 'warning');
            return;
        }
        
        const totalReports = snapshot.size;
        let deletedReports = 0;
        let deletedImages = 0;
        
        // Process reports in batches to avoid overwhelming the system
        const batchSize = 5;
        const reports = [];
        
        snapshot.forEach(doc => {
            reports.push({ id: doc.id, ...doc.data() });
        });
        
        for (let i = 0; i < reports.length; i += batchSize) {
            const batch = reports.slice(i, i + batchSize);
            
            // Delete images and reports in parallel for this batch
            const deletePromises = batch.map(async (report) => {
                try {
                    // Delete images first
                    const imagesCount = await deleteAllImagesFromReport(report);
                    deletedImages += imagesCount;
                    
                    // Then delete the report document
                    await db.collection('wasteReports').doc(report.id).delete();
                    deletedReports++;
                    
                    // Update progress
                    if (deletedReports % 10 === 0 || deletedReports === totalReports) {
                        showLoading(true, `Deleting ${deletedReports}/${totalReports} reports...`);
                    }
                    
                } catch (error) {
                    console.error(`Error deleting report ${report.id}:`, error);
                    // Continue with other reports even if one fails
                }
            });
            
            await Promise.all(deletePromises);
            
            // Small delay between batches to prevent overwhelming Firebase
            if (i + batchSize < reports.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        // Clear local data
        reportsData = [];
        
        // Reload reports
        await loadReports();
        
        // Close modal
        closeDeleteAllModal();
        
        showNotification(`Deleted ${deletedReports} reports and ${deletedImages} images from storage.`, 'success');
        
        // Refresh chart data
        setTimeout(() => {
            loadAllReportsForChart();
        }, 1000);
        
    } catch (error) {
        console.error('Error deleting all reports:', error);
        showNotification('Error deleting reports: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteSingleImage(reportId, itemIndex, itemType, imageIndex) {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to delete images', 'error');
        return;
    }
    
    showLoading(true, 'Deleting image...');
    
    try {
        // Get the report
        const reportDoc = await db.collection('wasteReports').doc(reportId).get();
        if (!reportDoc.exists) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const report = { id: reportDoc.id, ...reportDoc.data() };
        const items = itemType === 'expired' ? report.expiredItems : report.wasteItems;
        
        if (!items || itemIndex >= items.length) {
            showNotification('Item not found', 'error');
            return;
        }
        
        const item = items[itemIndex];
        if (!item.documentation || !Array.isArray(item.documentation) || imageIndex >= item.documentation.length) {
            showNotification('Image not found', 'error');
            return;
        }
        
        const imageToDelete = item.documentation[imageIndex];
        
        // Delete image from storage
        await ImageManager.deleteImageFromStorage(imageToDelete);
        
        // Remove image from documentation array
        item.documentation.splice(imageIndex, 1);
        
        // Update the item in Firestore
        const field = itemType === 'expired' ? 'expiredItems' : 'wasteItems';
        await db.collection('wasteReports').doc(reportId).update({
            [field]: items
        });
        
        showNotification('Image deleted successfully', 'success');
        
        // Refresh the details modal
        if (currentReportDetailsId === reportId) {
            await viewReportDetails(reportId);
        }
        
        // Refresh reports list
        loadReports();
        
        // Close modals
        ImageManager.closeDeleteImageModal();
        ImageManager.closeModal();
        
    } catch (error) {
        console.error('Error deleting image:', error);
        showNotification('Error deleting image: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function openDeleteModal(report) {
    currentReportToDelete = report;
    
    const deleteReportInfo = Performance.getElement('#deleteReportInfo');
    if (deleteReportInfo) {
        const totalCost = calculateReportCost(report);
        const approvedCost = calculateApprovedReportCost(report);
        const itemCount = getItemCount(report);
        
        let imageCount = 0;
        const countImages = (items) => {
            if (!items) return;
            items.forEach(item => {
                if (item.documentation && Array.isArray(item.documentation)) {
                    imageCount += item.documentation.filter(doc => doc.type?.startsWith('image/')).length;
                }
            });
        };
        countImages(report.expiredItems);
        countImages(report.wasteItems);
        
        deleteReportInfo.innerHTML = `
            <p><strong>Report ID:</strong> ${report.reportId || report.id.substring(0, 8)}...</p>
            <p><strong>Store:</strong> ${report.store || 'N/A'}</p>
            <p><strong>Date:</strong> ${formatDate(report.reportDate)}</p>
            <p><strong>Items:</strong> ${itemCount} items (₱${totalCost.toFixed(2)} total, ₱${approvedCost.toFixed(2)} approved)</p>
            <p><strong>Images:</strong> ${imageCount} images will be deleted</p>
        `;
    }
    
    const deleteConfirmation = Performance.getElement('#deleteConfirmation');
    const confirmDeleteButton = Performance.getElement('#confirmDeleteButton');
    
    if (deleteConfirmation && confirmDeleteButton) {
        deleteConfirmation.value = '';
        confirmDeleteButton.disabled = true;
        
        deleteConfirmation.addEventListener('input', function() {
            confirmDeleteButton.disabled = this.value.toUpperCase() !== 'DELETE';
        });
    }
    
    const deleteModal = Performance.getElement('#deleteModal');
    if (deleteModal) {
        deleteModal.style.display = 'flex';
        deleteConfirmation?.focus();
    }
}

function closeDeleteModal() {
    currentReportToDelete = null;
    const deleteModal = Performance.getElement('#deleteModal');
    if (deleteModal) {
        deleteModal.style.display = 'none';
    }
}

function openDeleteAllModal() {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to delete reports', 'error');
        return;
    }
    
    const deleteAllCount = Performance.getElement('#deleteAllCount');
    const deleteAllConfirmation = Performance.getElement('#deleteAllConfirmation');
    const confirmDeleteAllButton = Performance.getElement('#confirmDeleteAllButton');
    const applyFiltersCheckbox = Performance.getElement('#applyFiltersToDeleteAll');
    
    if (deleteAllCount) {
        // Count all reports (or filtered reports)
        const count = applyFiltersCheckbox?.checked ? reportsData.length : allReportsData.length;
        deleteAllCount.textContent = count;
    }
    
    if (deleteAllConfirmation && confirmDeleteAllButton) {
        deleteAllConfirmation.value = '';
        confirmDeleteAllButton.disabled = true;
        
        deleteAllConfirmation.addEventListener('input', function() {
            confirmDeleteAllButton.disabled = this.value.toUpperCase() !== 'DELETE ALL';
        });
    }
    
    if (applyFiltersCheckbox) {
        applyFiltersCheckbox.checked = false;
    }
    
    const deleteAllModal = Performance.getElement('#deleteAllModal');
    if (deleteAllModal) {
        deleteAllModal.style.display = 'flex';
        deleteAllConfirmation?.focus();
    }
}

function closeDeleteAllModal() {
    const deleteAllModal = Performance.getElement('#deleteAllModal');
    if (deleteAllModal) {
        deleteAllModal.style.display = 'none';
    }
}

function confirmDelete() {
    if (currentReportToDelete) {
        deleteReport(currentReportToDelete.id);
    }
}

function confirmDeleteAll() {
    const applyFilters = Performance.getElement('#applyFiltersToDeleteAll')?.checked || false;
    deleteAllReports(applyFilters);
}

// ================================
// REPORTS LOADING - OPTIMIZED
// ================================
async function loadReports() {
    if (isDataLoading) return;
    
    if (!isAuthenticated()) {
        showNotification('Please authenticate to view reports', 'error');
        return;
    }
    
    isDataLoading = true;
    showLoading(true, 'Loading reports...');
    
    try {
        reportsData = [];
        const tableBody = Performance.getElement('#reportsTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        // Get filter values
        const storeFilter = Performance.getElement('#filterStore');
        const dateFromFilter = Performance.getElement('#filterDateFrom');
        const dateToFilter = Performance.getElement('#filterDateTo');
        const searchInput = Performance.getElement('#searchInput');
        const typeFilter = Performance.getElement('#filterType');
        const filterStatus = Performance.getElement('#filterStatus');
        
        let query = db.collection('wasteReports');
        
        // Apply server-side filters
        if (storeFilter?.value) {
            query = query.where('store', '==', storeFilter.value);
        }
        
        query = query.orderBy('submittedAt', 'desc').limit(pageSize);
        
        if (currentPage > 1 && lastVisibleDoc) {
            query = query.startAfter(lastVisibleDoc);
        }
        
        const snapshot = await query.get();
        
        if (!snapshot.empty) {
            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        } else {
            lastVisibleDoc = null;
        }
        
        let expiredCount = 0;
        let wasteCount = 0;
        let noWasteCount = 0;
        let pendingApprovalCount = 0;
        let rejectedCount = 0;
        let partialCount = 0;
        let completeCount = 0;
        
        // Build HTML with DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const report = { 
                id: doc.id, 
                ...data,
                disposalTypes: Array.isArray(data.disposalTypes) ? data.disposalTypes : 
                              data.disposalType ? [data.disposalType] : ['unknown']
            };
            
            reportsData.push(report);
            
            const disposalTypes = report.disposalTypes;
            
            // Count for statistics
            if (disposalTypes.includes('expired')) expiredCount++;
            if (disposalTypes.includes('waste')) wasteCount++;
            if (disposalTypes.includes('noWaste')) noWasteCount++;
            
            const approvalStatus = getReportApprovalStatus(report);
            if (approvalStatus === 'pending') pendingApprovalCount++;
            if (approvalStatus === 'rejected') rejectedCount++;
            if (approvalStatus === 'partial') partialCount++;
            if (approvalStatus === 'complete') completeCount++;
            
            // Client-side filtering
            const searchMatch = !searchInput?.value || 
                              (report.reportId && report.reportId.toLowerCase().includes(searchInput.value.toLowerCase())) ||
                              (report.email && report.email.toLowerCase().includes(searchInput.value.toLowerCase())) ||
                              (report.personnel && report.personnel.toLowerCase().includes(searchInput.value.toLowerCase())) ||
                              (report.store && report.store.toLowerCase().includes(searchInput.value.toLowerCase()));
            
            const typeMatch = !typeFilter?.value || 
                             disposalTypes.includes(typeFilter.value);
            const statusMatch = !filterStatus?.value || 
                               approvalStatus === filterStatus.value;
            
            // Date range filtering
            let dateMatch = true;
            if (dateFromFilter?.value || dateToFilter?.value) {
                const reportDate = new Date(report.reportDate);
                
                if (dateFromFilter?.value) {
                    const fromDate = new Date(dateFromFilter.value);
                    fromDate.setHours(0, 0, 0, 0);
                    if (reportDate < fromDate) {
                        dateMatch = false;
                    }
                }
                
                if (dateToFilter?.value) {
                    const toDate = new Date(dateToFilter.value);
                    toDate.setHours(23, 59, 59, 999);
                    if (reportDate > toDate) {
                        dateMatch = false;
                    }
                }
            }
            
            if (searchMatch && typeMatch && statusMatch && dateMatch) {
                const row = createTableRow(report);
                fragment.appendChild(row);
            }
        });
        
        // Append all rows at once
        if (fragment.childNodes.length > 0) {
            tableBody.appendChild(fragment);
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="12" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>No reports found</h3>
                        <p>Try changing your filters or submit a new report.</p>
                    </td>
                </tr>
            `;
        }
        
        // Update statistics
        updateStatistics(reportsData.length, expiredCount, wasteCount, noWasteCount, pendingApprovalCount);
        updatePageInfo();
        updatePaginationButtons();
        
        // Load chart data if this is the first page
        if (currentPage === 1) {
            setTimeout(() => {
                loadAllReportsForChart();
            }, 100);
        }
        
        // Cache the data
        reportsCache.data = reportsData;
        reportsCache.timestamp = Date.now();
        
    } catch (error) {
        console.error('Error loading reports:', error);
        showNotification('Error loading reports: ' + error.message, 'error');
    } finally {
        isDataLoading = false;
        showLoading(false);
    }
}

function createTableRow(report) {
    const row = document.createElement('tr');
    const itemCount = getItemCount(report);
    const approvedItemCount = getApprovedItemCount(report);
    const totalCost = calculateReportCost(report); // Total cost of ALL items (including pending/rejected)
    const approvedCost = calculateApprovedReportCost(report); // Cost of approved items only
    const costCellClass = getCostCellClass(totalCost);
    
    // Count images
    let imageCount = 0;
    const countImages = (items) => {
        if (!items) return;
        items.forEach(item => {
            if (item.documentation && Array.isArray(item.documentation)) {
                imageCount += item.documentation.filter(doc => doc.type?.startsWith('image/')).length;
            }
        });
    };
    countImages(report.expiredItems);
    countImages(report.wasteItems);
    
    row.innerHTML = `
        <td>
            <div class="report-id">${report.reportId?.substring(0, 12) || report.id.substring(0, 12)}${(report.reportId || report.id).length > 12 ? '...' : ''}</div>
        </td>
        <td><strong>${report.store || 'N/A'}</strong></td>
        <td>${report.personnel || 'N/A'}</td>
        <td><strong>${formatDate(report.reportDate)}</strong></td>
        <td>${getDisposalTypeBadge(report.disposalTypes)}</td>
        <td>
            <div style="font-size: 11px; color: var(--color-gray);">${report.email || 'N/A'}</div>
        </td>
        <td>
            <div style="font-size: 10px; color: var(--color-gray);">${formatDateTime(report.submittedAt)}</div>
        </td>
        <td>
            <div style="text-align: center;">
                <span style="background: var(--color-accent); padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 500;">
                    ${itemCount} ${itemCount === 1 ? 'item' : 'items'}
                </span>
                ${approvedItemCount < itemCount ? `
                <div style="margin-top: 4px; font-size: 10px; color: #666;">
                    (${approvedItemCount} approved)
                </div>
                ` : ''}
                ${imageCount > 0 ? `
                <div style="margin-top: 4px;">
                    <span style="background: #d1ecf1; color: #0c5460; padding: 2px 6px; border-radius: 10px; font-size: 9px;">
                        <i class="fas fa-images"></i> ${imageCount}
                    </span>
                </div>
                ` : ''}
            </div>
        </td>
        <td class="store-cost-cell ${costCellClass}">
            <strong>₱${totalCost.toFixed(2)}</strong>
            ${approvedCost < totalCost ? `<div style="font-size: 10px; color: #666;">(₱${approvedCost.toFixed(2)} approved)</div>` : ''}
        </td>
        <td><span class="status-badge status-submitted">Submitted</span></td>
        <td>${getApprovalStatusBadge(report)}</td>
        <td>
            <div style="display: flex; gap: 4px;">
                <button class="view-details-btn" onclick="viewReportDetails('${report.id}')" title="${imageCount > 0 ? `View (${imageCount} images)` : 'View'}">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="delete-btn-small" onclick="openDeleteModal(${JSON.stringify(report).replace(/"/g, '&quot;')})" title="Delete report and images">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </td>
    `;
    
    return row;
}

function updateStatistics(total, expired, waste, noWaste, pending = 0) {
    const setText = (id, text) => {
        const el = Performance.getElement(id);
        if (el) el.textContent = text;
    };
    
    setText('#totalReports', total);
    setText('#expiredCount', expired);
    setText('#wasteCount', waste);
    setText('#noWasteCount', noWaste);
    setText('#pendingApprovalCount', pending);
}

function updatePageInfo() {
    const pageInfo = Performance.getElement('#pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage}`;
    }
    
    const showingCount = Performance.getElement('#showingCount');
    if (showingCount) {
        showingCount.textContent = reportsData.length;
    }
}

function updatePaginationButtons() {
    const prevBtn = Performance.getElement('#prevPageBtn');
    const nextBtn = Performance.getElement('#nextPageBtn');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = reportsData.length < pageSize;
    }
}

function changePage(direction) {
    currentPage += direction;
    loadReports();
}

// ================================
// FILTERS - OPTIMIZED
// ================================
function debounceApplyFilters() {
    Performance.debounce(() => {
        currentPage = 1;
        lastVisibleDoc = null;
        loadReports();
    }, 300, 'filters')();
}

function clearFilters() {
    const filters = [
        '#filterStore', '#filterType', '#filterDateFrom', '#filterDateTo', 
        '#searchInput', '#filterStatus'
    ];
    
    filters.forEach(selector => {
        const el = Performance.getElement(selector);
        if (el) el.value = '';
    });
    
    currentPage = 1;
    lastVisibleDoc = null;
    loadReports();
}

// ================================
// APPROVAL & REJECTION FUNCTIONS - OPTIMIZED
// ================================
async function approveItem(reportId, itemIndex, itemType) {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to approve items', 'error');
        return;
    }
    
    showLoading(true, 'Approving item...');
    
    try {
        const docRef = db.collection('wasteReports').doc(reportId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const report = doc.data();
        const items = itemType === 'expired' ? report.expiredItems : report.wasteItems;
        
        if (!items || itemIndex >= items.length) {
            showNotification('Item not found', 'error');
            return;
        }
        
        items[itemIndex] = {
            ...items[itemIndex],
            approvalStatus: 'approved',
            approvedAt: new Date().toISOString(),
            approvedBy: 'Administrator',
            rejectionReason: null
        };
        
        const field = itemType === 'expired' ? 'expiredItems' : 'wasteItems';
        await docRef.update({ [field]: items });
        
        showNotification('Item approved successfully', 'success');
        
        // Update UI without full reload
        updateReportAfterApproval(reportId);
        
    } catch (error) {
        console.error('Error approving item:', error);
        showNotification('Error approving item: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function rejectItem(reportId, itemIndex, itemType, reason) {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to reject items', 'error');
        return;
    }
    
    if (!reason || reason.trim().length === 0) {
        showNotification('Please provide a reason for rejection', 'error');
        return;
    }
    
    showLoading(true, 'Rejecting item...');
    
    try {
        const docRef = db.collection('wasteReports').doc(reportId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const report = doc.data();
        const items = itemType === 'expired' ? report.expiredItems : report.wasteItems;
        
        if (!items || itemIndex >= items.length) {
            showNotification('Item not found', 'error');
            return;
        }
        
        // Generate unique item ID for resubmission
        const uniqueItemId = `${reportId}_${itemType}_${itemIndex}_${Date.now()}`;
        
        // Update the item with rejection info
        items[itemIndex] = {
            ...items[itemIndex],
            approvalStatus: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: 'Administrator',
            rejectionReason: reason.trim(),
            itemId: uniqueItemId, // THIS LINE IS CRITICAL
            canResubmit: true
        };
        
        const field = itemType === 'expired' ? 'expiredItems' : 'wasteItems';
        await docRef.update({ [field]: items });
        
        showNotification('Item rejected successfully', 'success');
        
        // Update UI without full reload
        updateReportAfterApproval(reportId);
        
        // Send email notification with edit link AND ITEM ID
        await sendRejectionEmailViaGAS(
            report.email, 
            report.reportId || reportId, 
            itemIndex, 
            itemType, 
            reason.trim(), 
            report, 
            uniqueItemId // PASS THE ITEM ID
        );
        
    } catch (error) {
        console.error('Error rejecting item:', error);
        showNotification('Error rejecting item: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function bulkApproveItems(reportId, itemType) {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to approve items', 'error');
        return;
    }
    
    showLoading(true, 'Approving items...');
    
    try {
        const docRef = db.collection('wasteReports').doc(reportId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const report = doc.data();
        const items = itemType === 'expired' ? report.expiredItems : report.wasteItems;
        
        if (!items) {
            showNotification('No items found', 'error');
            return;
        }
        
        const updatedItems = items.map(item => {
            if (!item.approvalStatus || item.approvalStatus === 'pending') {
                return {
                    ...item,
                    approvalStatus: 'approved',
                    approvedAt: new Date().toISOString(),
                    approvedBy: 'Administrator',
                    rejectionReason: null
                };
            }
            return item;
        });
        
        const field = itemType === 'expired' ? 'expiredItems' : 'wasteItems';
        await docRef.update({ [field]: updatedItems });
        
        showNotification('All pending items approved successfully', 'success');
        
        // Update UI without full reload
        updateReportAfterApproval(reportId);
        
    } catch (error) {
        console.error('Error bulk approving items:', error);
        showNotification('Error bulk approving items: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function bulkRejectItems(reportId, itemType, reason) {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to reject items', 'error');
        return;
    }
    
    if (!reason || reason.trim().length === 0) {
        showNotification('Please provide a reason for rejection', 'error');
        return;
    }
    
    showLoading(true, 'Rejecting items...');
    
    try {
        const docRef = db.collection('wasteReports').doc(reportId);
        const doc = await docRef.get();
        
        if (!doc.exists) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const report = doc.data();
        const items = itemType === 'expired' ? report.expiredItems : report.wasteItems;
        
        if (!items) {
            showNotification('No items found', 'error');
            return;
        }
        
        const rejectedItems = [];
        const updatedItems = items.map((item, index) => {
            if (!item.approvalStatus || item.approvalStatus === 'pending') {
                // Generate unique item ID for each rejected item
                const uniqueItemId = `${reportId}_${itemType}_${index}_${Date.now()}`;
                
                // Store for individual emails (you might want to send separate emails for each)
                rejectedItems.push({
                    item: item,
                    index: index,
                    itemId: uniqueItemId
                });
                
                return {
                    ...item,
                    approvalStatus: 'rejected',
                    rejectedAt: new Date().toISOString(),
                    rejectedBy: 'Administrator',
                    rejectionReason: reason.trim(),
                    itemId: uniqueItemId,
                    canResubmit: true
                };
            }
            return item;
        });
        
        const field = itemType === 'expired' ? 'expiredItems' : 'wasteItems';
        await docRef.update({ [field]: updatedItems });
        
        showNotification('All pending items rejected successfully', 'success');
        
        // Update UI without full reload
        updateReportAfterApproval(reportId);
        
        // Send bulk rejection email
        await sendBulkRejectionEmailViaGAS(
            report.email, 
            report.reportId || reportId, 
            rejectedItems.length, 
            reason.trim(), 
            report
        );
        
        // Optionally send individual emails with item IDs
        // for (const rejectedItem of rejectedItems) {
        //     await sendRejectionEmailViaGAS(
        //         report.email,
        //         report.reportId || reportId,
        //         rejectedItem.index,
        //         itemType,
        //         reason.trim(),
        //         report,
        //         rejectedItem.itemId
        //     );
        // }
        
    } catch (error) {
        console.error('Error bulk rejecting items:', error);
        showNotification('Error bulk rejecting items: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}
async function updateReportAfterApproval(reportId) {
    try {
        const doc = await db.collection('wasteReports').doc(reportId).get();
        if (!doc.exists) return;
        
        const data = doc.data();
        const updatedReport = { 
            id: doc.id, 
            ...data,
            disposalTypes: Array.isArray(data.disposalTypes) ? data.disposalTypes : 
                          data.disposalType ? [data.disposalType] : ['unknown']
        };
        
        // Update the table row if the report is in the current view
        const rowIndex = reportsData.findIndex(r => r.id === reportId);
        if (rowIndex !== -1) {
            reportsData[rowIndex] = updatedReport;
            
            const tableBody = Performance.getElement('#reportsTableBody');
            if (tableBody && tableBody.children[rowIndex]) {
                const row = tableBody.children[rowIndex];
                const approvalCell = row.cells[9];
                if (approvalCell) {
                    approvalCell.innerHTML = getApprovalStatusBadge(updatedReport);
                }
            }
        }
        
        // If details modal is open for this report, refresh it
        if (currentReportDetailsId === reportId) {
            await viewReportDetails(reportId);
        }
        
        // Refresh statistics
        updateStatisticsFromReports();
        
        // Refresh chart data
        setTimeout(() => {
            loadAllReportsForChart();
        }, 500);
        
    } catch (error) {
        console.error('Error updating UI after approval:', error);
        loadReports();
    }
}

function updateStatisticsFromReports() {
    let expiredCount = 0;
    let wasteCount = 0;
    let noWasteCount = 0;
    let pendingApprovalCount = 0;
    
    reportsData.forEach(report => {
        const disposalTypes = report.disposalTypes;
        
        if (disposalTypes.includes('expired')) expiredCount++;
        if (disposalTypes.includes('waste')) wasteCount++;
        if (disposalTypes.includes('noWaste')) noWasteCount++;
        
        if (getReportApprovalStatus(report) === 'pending') pendingApprovalCount++;
    });
    
    updateStatistics(reportsData.length, expiredCount, wasteCount, noWasteCount, pendingApprovalCount);
}

// ================================
// REJECTION MODAL FUNCTIONS
// ================================
function openRejectionModal(itemInfo, reportId, itemIndex, itemType) {
    currentRejectionData = { reportId, itemIndex, itemType };
    
    const rejectionItemInfo = Performance.getElement('#rejectionItemInfo');
    if (rejectionItemInfo) {
        rejectionItemInfo.innerHTML = `
            <p><strong>Item:</strong> ${itemInfo.item || 'N/A'}</p>
            <p><strong>Quantity:</strong> ${itemInfo.quantity || 0} ${itemInfo.unit || 'units'}</p>
            <p><strong>Cost:</strong> ₱${((itemInfo.itemCost || 0) * (itemInfo.quantity || 0)).toFixed(2)}</p>
            ${itemType === 'expired' ? `<p><strong>Expiration:</strong> ${formatDate(itemInfo.expirationDate)}</p>` : ''}
            ${itemType === 'waste' ? `<p><strong>Reason for Waste:</strong> ${itemInfo.reason || 'N/A'}</p>` : ''}
        `;
    }
    
    const rejectionReason = Performance.getElement('#rejectionReason');
    if (rejectionReason) {
        rejectionReason.value = '';
        Performance.getElement('#rejectionCharCount').textContent = '0/500 characters';
    }
    
    const rejectionModal = Performance.getElement('#rejectionModal');
    if (rejectionModal) {
        rejectionModal.style.display = 'flex';
        rejectionReason.focus();
    }
}

function closeRejectionModal() {
    currentRejectionData = null;
    const rejectionModal = Performance.getElement('#rejectionModal');
    if (rejectionModal) {
        rejectionModal.style.display = 'none';
    }
}

function openBulkRejectionModal(reportId, itemCount, itemType) {
    currentBulkRejectionData = { reportId, itemType };
    
    const bulkItemsCount = Performance.getElement('#bulkItemsCount');
    const bulkReportId = Performance.getElement('#bulkReportId');
    if (bulkItemsCount) bulkItemsCount.textContent = itemCount;
    if (bulkReportId) bulkReportId.textContent = reportId;
    
    const bulkRejectionReason = Performance.getElement('#bulkRejectionReason');
    if (bulkRejectionReason) {
        bulkRejectionReason.value = '';
        Performance.getElement('#bulkRejectionCharCount').textContent = '0/500 characters';
    }
    
    const bulkRejectionModal = Performance.getElement('#bulkRejectionModal');
    if (bulkRejectionModal) {
        bulkRejectionModal.style.display = 'flex';
        bulkRejectionReason.focus();
    }
}

function closeBulkRejectionModal() {
    currentBulkRejectionData = null;
    const bulkRejectionModal = Performance.getElement('#bulkRejectionModal');
    if (bulkRejectionModal) {
        bulkRejectionModal.style.display = 'none';
    }
}

function handleItemRejection() {
    const reason = Performance.getElement('#rejectionReason')?.value.trim();
    if (!reason) {
        showNotification('Please provide a reason for rejection', 'error');
        return;
    }
    
    if (currentRejectionData) {
        rejectItem(
            currentRejectionData.reportId,
            currentRejectionData.itemIndex,
            currentRejectionData.itemType,
            reason
        );
        closeRejectionModal();
    }
}

function handleBulkItemRejection() {
    const reason = Performance.getElement('#bulkRejectionReason')?.value.trim();
    if (!reason) {
        showNotification('Please provide a reason for rejection', 'error');
        return;
    }
    
    if (currentBulkRejectionData) {
        bulkRejectItems(
            currentBulkRejectionData.reportId,
            currentBulkRejectionData.itemType,
            reason
        );
        closeBulkRejectionModal();
    }
}

// ================================
// EMAIL SENDING FUNCTIONS - UPDATED WITH EDIT LINK
// ================================
async function sendRejectionEmailViaGAS(toEmail, reportId, itemIndex, itemType, reason, reportData, itemId) {
    try {
        const itemsArray = itemType === 'expired' ? reportData.expiredItems : reportData.wasteItems;
        const rejectedItem = itemsArray[itemIndex];
        
        // Create edit link with item ID
        const editLink = `https://waste-disposal-six.vercel.app/submit_waste_report.html`;
        
        // Get item details for email
        const itemName = rejectedItem?.item || 'N/A';
        const itemQuantity = rejectedItem?.quantity || 0;
        const itemUnit = rejectedItem?.unit || 'units';
        const itemCost = `₱${((rejectedItem?.itemCost || 0) * (rejectedItem?.quantity || 0)).toFixed(2)}`;
        const expirationDate = itemType === 'expired' ? formatDate(rejectedItem?.expirationDate) : 'N/A';
        const wasteReason = itemType === 'waste' ? rejectedItem?.reason || 'N/A' : 'N/A';
        
        const emailData = {
            emailType: 'rejection',
            to: toEmail,
            subject: `Item Rejected - ${itemName}`,
            store: reportData.store || 'N/A',
            personnel: reportData.personnel || 'Team Member',
            reportDate: formatDate(reportData.reportDate) || 'N/A',
            disposalType: getDisposalTypeText(reportData.disposalTypes),
            reportId: reportId,
            itemId: itemId, // THIS IS CRITICAL - MUST BE INCLUDED
            itemName: itemName,
            itemQuantity: itemQuantity,
            itemUnit: itemUnit,
            itemCost: itemCost,
            itemReason: wasteReason,
            expirationDate: expirationDate,
            rejectionReason: reason,
            editLink: editLink,
            rejectedAt: new Date().toLocaleString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            }),
            // Add clear instructions about the Item ID
            specialInstructions: `ITEM ID FOR RESUBMISSION: ${itemId}`
        };

        const formData = new FormData();
        Object.keys(emailData).forEach(key => {
            formData.append(key, emailData[key]);
        });

        let success = false;
        
        try {
            await fetch(GAS_CONFIG.ENDPOINT, {
                method: 'POST',
                body: formData,
                mode: 'no-cors'
            });
            success = true;
        } catch (error) {
            console.warn('Form data approach failed:', error);
            
            try {
                const params = new URLSearchParams();
                Object.keys(emailData).forEach(key => {
                    params.append(key, emailData[key]);
                });
                
                await fetch(GAS_CONFIG.ENDPOINT + '?' + params.toString(), {
                    method: 'GET',
                    mode: 'no-cors'
                });
                success = true;
            } catch (error2) {
                console.error('URL params approach also failed:', error2);
            }
        }

        if (success) {
            console.log('✅ Rejection email sent with edit link and Item ID');
            return { success: true };
        } else {
            console.warn('⚠️ Email sending failed, but item was still rejected');
            return { success: false, error: 'Email sending failed' };
        }

    } catch (error) {
        console.error('❌ Rejection email function error:', error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}

async function sendBulkRejectionEmailViaGAS(toEmail, reportId, rejectedCount, reason, reportData) {
    try {
        const editLink = 'https://waste-disposal-six.vercel.app/submit_waste_report.html';
        
        const emailData = {
            emailType: 'bulk_rejection',
            to: toEmail,
            subject: `Multiple Items Rejected - ${reportId}`,
            store: reportData.store || 'N/A',
            personnel: reportData.personnel || 'Team Member',
            reportDate: formatDate(reportData.reportDate) || 'N/A',
            disposalType: getDisposalTypeText(reportData.disposalTypes),
            reportId: reportId,
            rejectedCount: rejectedCount,
            rejectionReason: reason,
            editLink: editLink,
            rejectedAt: new Date().toLocaleString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            })
        };

        const formData = new FormData();
        Object.keys(emailData).forEach(key => {
            formData.append(key, emailData[key]);
        });

        let success = false;
        
        try {
            await fetch(GAS_CONFIG.ENDPOINT, {
                method: 'POST',
                body: formData,
                mode: 'no-cors'
            });
            success = true;
        } catch (error) {
            console.warn('Form data approach failed:', error);
            
            try {
                const params = new URLSearchParams();
                Object.keys(emailData).forEach(key => {
                    params.append(key, emailData[key]);
                });
                
                await fetch(GAS_CONFIG.ENDPOINT + '?' + params.toString(), {
                    method: 'GET',
                    mode: 'no-cors'
                });
                success = true;
            } catch (error2) {
                console.error('URL params approach also failed:', error2);
            }
        }

        if (success) {
            console.log('✅ Bulk rejection email sent successfully');
            return { success: true };
        } else {
            console.warn('⚠️ Bulk email sending failed, but items were still rejected');
            return { success: false, error: 'Email sending failed' };
        }

    } catch (error) {
        console.error('❌ Bulk rejection email function error:', error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}

// ================================
// EXPORT FUNCTIONS
// ================================
async function exportReports(type = 'current') {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to export reports', 'error');
        return;
    }
    
    try {
        if (type === 'date') {
            showExportDate();
            return;
        }
        
        showLoading(true, 'Preparing export...');
        
        let query = db.collection('wasteReports').orderBy('submittedAt', 'desc');
        
        if (type === 'current') {
            const storeFilter = Performance.getElement('#filterStore');
            const dateFromFilter = Performance.getElement('#filterDateFrom');
            const dateToFilter = Performance.getElement('#filterDateTo');
            
            if (storeFilter?.value) {
                query = query.where('store', '==', storeFilter.value);
            }
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            showNotification('No reports to export', 'warning');
            return;
        }
        
        let reports = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            reports.push({ 
                id: doc.id, 
                ...data,
                disposalTypes: Array.isArray(data.disposalTypes) ? data.disposalTypes : 
                              data.disposalType ? [data.disposalType] : ['unknown']
            });
        });
        
        // Apply date range filter client-side for export
        const dateFromFilter = Performance.getElement('#filterDateFrom');
        const dateToFilter = Performance.getElement('#filterDateTo');
        
        if (type === 'current' && (dateFromFilter?.value || dateToFilter?.value)) {
            reports = reports.filter(report => {
                const reportDate = new Date(report.reportDate);
                let isValid = true;
                
                if (dateFromFilter?.value) {
                    const fromDate = new Date(dateFromFilter.value);
                    fromDate.setHours(0, 0, 0, 0);
                    if (reportDate < fromDate) {
                        isValid = false;
                    }
                }
                
                if (dateToFilter?.value) {
                    const toDate = new Date(dateToFilter.value);
                    toDate.setHours(23, 59, 59, 999);
                    if (reportDate > toDate) {
                        isValid = false;
                    }
                }
                
                return isValid;
            });
        }
        
        await exportToExcel(reports, type === 'all' ? 'All_Reports' : 'Filtered_Reports');
        
    } catch (error) {
        console.error('Error exporting reports:', error);
        showNotification('Error exporting reports: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function exportReportsByDate() {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to export reports', 'error');
        return;
    }
    
    const exportDateEl = Performance.getElement('#exportDate');
    const exportDate = exportDateEl ? exportDateEl.value : '';
    
    if (!exportDate) {
        showNotification('Please select a date for export', 'error');
        return;
    }
    
    showLoading(true, 'Exporting reports...');
    
    try {
        const snapshot = await db.collection('wasteReports')
            .where('reportDate', '==', exportDate)
            .orderBy('submittedAt', 'desc')
            .get();
        
        if (snapshot.empty) {
            showNotification('No reports found for the selected date', 'warning');
            return;
        }
        
        const reports = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            reports.push({ 
                id: doc.id, 
                ...data,
                disposalTypes: Array.isArray(data.disposalTypes) ? data.disposalTypes : 
                              data.disposalType ? [data.disposalType] : ['unknown']
            });
        });
        
        await exportToExcel(reports, `Reports_${exportDate}`);
        
        hideExportDate();
        
    } catch (error) {
        console.error('Error exporting reports by date:', error);
        showNotification('Error exporting reports: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function exportToExcel(reports, fileName) {
    try {
        const data = [];
        
        // Add headers
        data.push([
            'Report ID', 'Store', 'Personnel', 'Date', 'Type', 'Email', 
            'Submitted At', 'Total Items', 'At-Cost (₱)', 'Approval Status', 'Expired Items', 'Waste Items'
        ]);
        
        // Add rows
        reports.forEach(report => {
            const disposalTypes = Array.isArray(report.disposalTypes) ? report.disposalTypes.join(', ') : report.disposalType;
            const totalItems = (report.expiredItems?.length || 0) + (report.wasteItems?.length || 0);
            const approvalStatus = getReportApprovalStatus(report);
            const totalCost = calculateReportCost(report);
            
            data.push([
                report.reportId || report.id,
                report.store || 'N/A',
                report.personnel || 'N/A',
                formatDate(report.reportDate),
                disposalTypes,
                report.email || 'N/A',
                formatDateTime(report.submittedAt),
                totalItems,
                totalCost.toFixed(2),
                approvalStatus,
                report.expiredItems?.length || 0,
                report.wasteItems?.length || 0
            ]);
        });
        
        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reports');
        
        // Generate Excel file
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        
        // Save file
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        saveAs(blob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showNotification('Export completed successfully', 'success');
        
    } catch (error) {
        console.error('Error creating Excel file:', error);
        throw error;
    }
}

function showExportDate() {
    const exportDateContainer = Performance.getElement('#exportDateContainer');
    if (exportDateContainer) {
        exportDateContainer.style.display = 'block';
        const exportDateInput = Performance.getElement('#exportDate');
        if (exportDateInput) {
            const today = new Date().toISOString().split('T')[0];
            exportDateInput.value = today;
        }
    }
}

function hideExportDate() {
    const exportDateContainer = Performance.getElement('#exportDateContainer');
    if (exportDateContainer) {
        exportDateContainer.style.display = 'none';
    }
}

// ================================
// ITEMS MANAGEMENT FUNCTIONS
// ================================
function openItemsManagement() {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to manage items', 'error');
        return;
    }
    
    const itemsModal = Performance.getElement('#itemsManagementModal');
    if (itemsModal) {
        itemsModal.style.display = 'flex';
        loadItems();
    }
}

function closeItemsManagement() {
    const itemsModal = Performance.getElement('#itemsManagementModal');
    if (itemsModal) {
        itemsModal.style.display = 'none';
    }
}

async function loadItems() {
    if (!isAuthenticated()) return;
    
    showLoading(true, 'Loading items...');
    
    try {
        const searchTerm = Performance.getElement('#searchItems')?.value.toLowerCase() || '';
        
        let query = db.collection('items');
        
        if (searchTerm) {
            query = query.orderBy('nameLowerCase')
                        .where('nameLowerCase', '>=', searchTerm)
                        .where('nameLowerCase', '<=', searchTerm + '\uf8ff');
        } else {
            query = query.orderBy('name', 'asc');
        }
        
        if (itemsCurrentPage > 1 && itemsLastVisibleDoc) {
            query = query.startAfter(itemsLastVisibleDoc);
        }
        
        query = query.limit(itemsPageSize);
        
        const snapshot = await query.get();
        
        if (!snapshot.empty) {
            itemsLastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        } else {
            itemsLastVisibleDoc = null;
        }
        
        itemsData = [];
        const tableBody = Performance.getElement('#itemsTableBody');
        if (!tableBody) return;
        
        const fragment = document.createDocumentFragment();
        
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            itemsData.push(item);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><strong>${item.name}</strong></td>
                <td>
                    <div style="color: #28a745; font-weight: bold; font-size: 14px;">
                        ₱${(item.cost || 0).toFixed(2)}
                    </div>
                </td>
                <td><small style="color: var(--color-gray);">${formatDate(item.createdAt)}</small></td>
                <td>
                    <div class="item-actions">
                        <button class="item-action-btn edit-item-btn" onclick="openEditItemModal('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.cost || 0})">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="item-action-btn delete-item-btn" onclick="deleteItem('${item.id}', '${item.name.replace(/'/g, "\\'")}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </td>
            `;
            
            fragment.appendChild(row);
        });
        
        tableBody.innerHTML = '';
        tableBody.appendChild(fragment);
        
        if (itemsData.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" style="text-align: center; padding: 40px; color: var(--color-gray);">
                        <i class="fas fa-box-open" style="font-size: 24px; margin-bottom: 10px;"></i>
                        <p>No items found. Add your first item!</p>
                    </td>
                </tr>
            `;
        }
        
        // Get total count
        let totalCount = 0;
        try {
            const countQuery = db.collection('items');
            if (searchTerm) {
                countQuery.where('nameLowerCase', '>=', searchTerm)
                         .where('nameLowerCase', '<=', searchTerm + '\uf8ff');
            }
            
            const allItems = await countQuery.get();
            totalCount = allItems.size;
        } catch (error) {
            console.log('Count method not available, using fallback:', error);
            totalCount = itemsData.length + ((itemsCurrentPage - 1) * itemsPageSize);
        }
        
        updateItemsStatistics(totalCount);
        updateItemsPageInfo();
        updateItemsPaginationButtons();
        
    } catch (error) {
        console.error('Error loading items:', error);
        showNotification('Error loading items: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function updateItemsStatistics(totalCount) {
    const totalEl = Performance.getElement('#totalItemsCount');
    const showingEl = Performance.getElement('#showingItemsCount');
    
    if (totalEl) totalEl.textContent = totalCount;
    if (showingEl) showingEl.textContent = itemsData.length;
}

function updateItemsPageInfo() {
    const pageInfo = Performance.getElement('#itemsPageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Page ${itemsCurrentPage}`;
    }
}

function updateItemsPaginationButtons() {
    const prevBtn = Performance.getElement('#prevItemsPageBtn');
    const nextBtn = Performance.getElement('#nextItemsPageBtn');
    
    if (prevBtn) {
        prevBtn.disabled = itemsCurrentPage <= 1;
    }
    
    if (nextBtn) {
        nextBtn.disabled = itemsData.length < itemsPageSize;
    }
}

function changeItemsPage(direction) {
    itemsCurrentPage += direction;
    loadItems();
}

async function addItemToDatabase() {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to add items', 'error');
        return;
    }
    
    const nameInput = Performance.getElement('#newItemName');
    const costInput = Performance.getElement('#newItemCost');
    
    const name = nameInput?.value.trim();
    const cost = parseFloat(costInput?.value) || 0;
    
    if (!name) {
        showNotification('Please enter item name', 'error');
        nameInput?.focus();
        return;
    }
    
    if (name.length > 100) {
        showNotification('Item name must be less than 100 characters', 'error');
        return;
    }
    
    if (isNaN(cost) || cost < 0) {
        showNotification('Cost must be a valid positive number', 'error');
        costInput?.focus();
        return;
    }
    
    showLoading(true, 'Adding item...');
    
    try {
        // Check if item exists
        const existingQuery = await db.collection('items')
            .where('nameLowerCase', '==', name.toLowerCase())
            .limit(1)
            .get();
        
        if (!existingQuery.empty) {
            showNotification('Item already exists in database', 'error');
            return;
        }
        
        // Add new item
        const newItem = {
            name: name,
            nameLowerCase: name.toLowerCase(),
            cost: cost,
            createdAt: new Date().toISOString(),
            createdBy: 'Administrator',
            updatedAt: new Date().toISOString(),
            usageCount: 0
        };
        
        await db.collection('items').add(newItem);
        
        showNotification('Item added successfully', 'success');
        
        if (nameInput) nameInput.value = '';
        if (costInput) costInput.value = '0';
        
        // Refresh items list
        loadItems();
        
    } catch (error) {
        console.error('Error adding item:', error);
        showNotification('Error adding item: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function openEditItemModal(itemId, name, cost = 0) {
    currentEditItemId = itemId;
    
    const nameInput = Performance.getElement('#editItemName');
    const costInput = Performance.getElement('#editItemCost');
    const itemInfo = Performance.getElement('#editItemInfo');
    
    if (nameInput) nameInput.value = name;
    if (costInput) costInput.value = cost;
    if (itemInfo) {
        itemInfo.innerHTML = `Editing item: <strong>${name}</strong>`;
    }
    
    const editModal = Performance.getElement('#editItemModal');
    if (editModal) {
        editModal.style.display = 'flex';
        nameInput?.focus();
    }
}

function closeEditItemModal() {
    currentEditItemId = null;
    const editModal = Performance.getElement('#editItemModal');
    if (editModal) {
        editModal.style.display = 'none';
    }
}

async function saveItemChanges() {
    if (!currentEditItemId) return;
    
    const nameInput = Performance.getElement('#editItemName');
    const costInput = Performance.getElement('#editItemCost');
    
    const name = nameInput?.value.trim();
    const cost = parseFloat(costInput?.value) || 0;
    
    if (!name) {
        showNotification('Item name is required', 'error');
        nameInput?.focus();
        return;
    }
    
    if (name.length > 100) {
        showNotification('Item name must be less than 100 characters', 'error');
        return;
    }
    
    if (isNaN(cost) || cost < 0) {
        showNotification('Cost must be a valid positive number', 'error');
        costInput?.focus();
        return;
    }
    
    showLoading(true, 'Saving changes...');
    
    try {
        // Check if another item with the same name exists
        const existingQuery = await db.collection('items')
            .where('nameLowerCase', '==', name.toLowerCase())
            .limit(1)
            .get();
        
        let exists = false;
        existingQuery.forEach(doc => {
            if (doc.id !== currentEditItemId) {
                exists = true;
            }
        });
        
        if (exists) {
            showNotification('Item name already exists in database', 'error');
            return;
        }
        
        const updates = {
            name: name,
            nameLowerCase: name.toLowerCase(),
            cost: cost,
            updatedAt: new Date().toISOString()
        };
        
        await db.collection('items').doc(currentEditItemId).update(updates);
        
        showNotification('Item updated successfully', 'success');
        closeEditItemModal();
        loadItems();
        
    } catch (error) {
        console.error('Error updating item:', error);
        showNotification('Error updating item: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteItem(itemId, itemName) {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to delete items', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete "${itemName}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    showLoading(true, 'Deleting item...');
    
    try {
        // Check if item is used in any reports
        const reportsQuery = await db.collection('wasteReports')
            .where('disposalType', 'in', ['expired', 'waste'])
            .get();
        
        let isUsed = false;
        reportsQuery.forEach(doc => {
            const report = doc.data();
            const expiredItems = report.expiredItems || [];
            const wasteItems = report.wasteItems || [];
            
            [...expiredItems, ...wasteItems].forEach(item => {
                if (item.item === itemName) {
                    isUsed = true;
                }
            });
        });
        
        if (isUsed) {
            showNotification(`Cannot delete "${itemName}" because it is used in existing reports.`, 'error');
            return;
        }
        
        await db.collection('items').doc(itemId).delete();
        
        showNotification(`Item "${itemName}" deleted successfully`, 'success');
        loadItems();
        
    } catch (error) {
        console.error('Error deleting item:', error);
        showNotification('Error deleting item: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function applyItemsFilters() {
    itemsCurrentPage = 1;
    itemsLastVisibleDoc = null;
    loadItems();
}

// ================================
// EVENT LISTENERS - OPTIMIZED
// ================================
function setupEventListeners() {
    // Password section
    const passwordInput = Performance.getElement('#password');
    const accessButton = Performance.getElement('#accessButton');
    
    if (passwordInput && accessButton) {
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkPassword();
        });
        accessButton.addEventListener('click', checkPassword);
    }
    
    const lockButton = Performance.getElement('#lockButton');
    if (lockButton) {
        lockButton.addEventListener('click', lockReports);
    }
    
    // Delete All button
    const deleteAllButton = Performance.getElement('#deleteAllButton');
    if (deleteAllButton) {
        deleteAllButton.addEventListener('click', openDeleteAllModal);
    }
    
    // Initialize chart type selector
    initChartTypeSelector();
    
    // Chart controls
    const chartPeriod = Performance.getElement('#chartPeriod');
    const chartMetric = Performance.getElement('#chartMetric');
    const chartSort = Performance.getElement('#chartSort');
    const refreshChartBtn = Performance.getElement('#refreshChart');
    const chartDatePickerFrom = Performance.getElement('#chartDateFrom');
    const chartDatePickerTo = Performance.getElement('#chartDateTo');
    const chartStore = Performance.getElement('#chartStore');
    
    if (chartPeriod) chartPeriod.addEventListener('change', updateChartControls);
    if (chartMetric) chartMetric.addEventListener('change', createChartBasedOnType);
    if (chartSort) chartSort.addEventListener('change', createChartBasedOnType);
    if (refreshChartBtn) refreshChartBtn.addEventListener('click', refreshChart);
    if (chartDatePickerFrom) chartDatePickerFrom.addEventListener('change', createChartBasedOnType);
    if (chartDatePickerTo) chartDatePickerTo.addEventListener('change', createChartBasedOnType);
    if (chartStore) chartStore.addEventListener('change', createChartBasedOnType);
    
    // Reports filters with debounce
    const searchInput = Performance.getElement('#searchInput');
    const filterStore = Performance.getElement('#filterStore');
    const filterType = Performance.getElement('#filterType');
    const filterDateFrom = Performance.getElement('#filterDateFrom');
    const filterDateTo = Performance.getElement('#filterDateTo');
    const filterStatus = Performance.getElement('#filterStatus');
    const clearFiltersBtn = Performance.getElement('#clearFilters');
    
    [searchInput, filterStore, filterType, filterDateFrom, filterDateTo, filterStatus].forEach(el => {
        if (el) {
            el.addEventListener('change', Performance.debounce(debounceApplyFilters, 300, 'filters'));
            if (el.tagName === 'INPUT') {
                el.addEventListener('input', Performance.debounce(debounceApplyFilters, 300, 'filters'));
            }
        }
    });
    
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }
    
    // Reports pagination
    const prevPageBtn = Performance.getElement('#prevPageBtn');
    const nextPageBtn = Performance.getElement('#nextPageBtn');
    
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => changePage(-1));
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => changePage(1));
    
    // Export functionality
    const exportDropdown = document.querySelector('.export-dropdown');
    if (exportDropdown) {
        exportDropdown.addEventListener('mouseenter', function() {
            this.querySelector('.export-options').style.display = 'block';
        });
        
        exportDropdown.addEventListener('mouseleave', function() {
            this.querySelector('.export-options').style.display = 'none';
        });
        
        const exportOptions = document.querySelectorAll('.export-option');
        exportOptions.forEach(option => {
            option.addEventListener('click', function() {
                const type = this.getAttribute('data-type');
                exportReports(type);
            });
        });
    }
    
    const exportDateButton = Performance.getElement('#exportDateButton');
    const cancelExportDate = Performance.getElement('#cancelExportDate');
    
    if (exportDateButton) exportDateButton.addEventListener('click', exportReportsByDate);
    if (cancelExportDate) cancelExportDate.addEventListener('click', hideExportDate);
    
    // Manage items
    const manageItemsButton = Performance.getElement('#manageItemsButton');
    const closeItemsModalBtn = Performance.getElement('#closeItemsModal');
    const closeItemsModalButton = Performance.getElement('#closeItemsModalButton');
    const addItemButton = Performance.getElement('#addItemButton');
    const searchItemsInput = Performance.getElement('#searchItems');
    const prevItemsPageBtn = Performance.getElement('#prevItemsPageBtn');
    const nextItemsPageBtn = Performance.getElement('#nextItemsPageBtn');
    
    if (manageItemsButton) manageItemsButton.addEventListener('click', openItemsManagement);
    if (closeItemsModalBtn) closeItemsModalBtn.addEventListener('click', closeItemsManagement);
    if (closeItemsModalButton) closeItemsModalButton.addEventListener('click', closeItemsManagement);
    if (addItemButton) addItemButton.addEventListener('click', addItemToDatabase);
    
    if (searchItemsInput) {
        searchItemsInput.addEventListener('input', Performance.debounce(() => {
            itemsCurrentPage = 1;
            itemsLastVisibleDoc = null;
            loadItems();
        }, 300, 'itemsSearch'));
    }
    
    if (prevItemsPageBtn) prevItemsPageBtn.addEventListener('click', () => changeItemsPage(-1));
    if (nextItemsPageBtn) nextItemsPageBtn.addEventListener('click', () => changeItemsPage(1));
    
    // Edit item modal
    const closeEditItemModalBtn = Performance.getElement('#closeEditItemModal');
    const cancelEditItemButton = Performance.getElement('#cancelEditItemButton');
    const saveItemButton = Performance.getElement('#saveItemButton');
    
    if (closeEditItemModalBtn) closeEditItemModalBtn.addEventListener('click', closeEditItemModal);
    if (cancelEditItemButton) cancelEditItemButton.addEventListener('click', closeEditItemModal);
    if (saveItemButton) saveItemButton.addEventListener('click', saveItemChanges);
    
    // Report details modal
    const closeDetailsModalBtn = Performance.getElement('#closeDetailsModal');
    const closeModalButton = Performance.getElement('#closeModalButton');
    
    if (closeDetailsModalBtn) closeDetailsModalBtn.addEventListener('click', closeDetailsModal);
    if (closeModalButton) closeModalButton.addEventListener('click', closeDetailsModal);
    
    // Image modal
    const closeImageModalBtn = Performance.getElement('#closeImageModal');
    const closeImageModalButton = Performance.getElement('#closeImageModalButton');
    
    if (closeImageModalBtn) closeImageModalBtn.addEventListener('click', ImageManager.closeModal);
    if (closeImageModalButton) closeImageModalButton.addEventListener('click', ImageManager.closeModal);
    
    // Rejection modals
    const closeRejectionModalBtn = Performance.getElement('#closeRejectionModal');
    const cancelRejectionButton = Performance.getElement('#cancelRejectionButton');
    const confirmRejectionButton = Performance.getElement('#confirmRejectionButton');
    const closeBulkRejectionModalBtn = Performance.getElement('#closeBulkRejectionModal');
    const cancelBulkRejectionButton = Performance.getElement('#cancelBulkRejectionButton');
    const confirmBulkRejectionButton = Performance.getElement('#confirmBulkRejectionButton');
    
    if (closeRejectionModalBtn) closeRejectionModalBtn.addEventListener('click', closeRejectionModal);
    if (cancelRejectionButton) cancelRejectionButton.addEventListener('click', closeRejectionModal);
    if (confirmRejectionButton) confirmRejectionButton.addEventListener('click', handleItemRejection);
    if (closeBulkRejectionModalBtn) closeBulkRejectionModalBtn.addEventListener('click', closeBulkRejectionModal);
    if (cancelBulkRejectionButton) cancelBulkRejectionButton.addEventListener('click', closeBulkRejectionModal);
    if (confirmBulkRejectionButton) confirmBulkRejectionButton.addEventListener('click', handleBulkItemRejection);
    
    // Character count for rejection reasons
    const rejectionReason = Performance.getElement('#rejectionReason');
    const bulkRejectionReason = Performance.getElement('#bulkRejectionReason');
    
    if (rejectionReason) {
        rejectionReason.addEventListener('input', function() {
            const charCount = this.value.length;
            const charCountEl = Performance.getElement('#rejectionCharCount');
            if (charCountEl) {
                charCountEl.textContent = `${Math.min(charCount, 500)}/500 characters`;
                if (charCount > 500) {
                    this.value = this.value.substring(0, 500);
                }
            }
        });
    }
    
    if (bulkRejectionReason) {
        bulkRejectionReason.addEventListener('input', function() {
            const charCount = this.value.length;
            const charCountEl = Performance.getElement('#bulkRejectionCharCount');
            if (charCountEl) {
                charCountEl.textContent = `${Math.min(charCount, 500)}/500 characters`;
                if (charCount > 500) {
                    this.value = this.value.substring(0, 500);
                }
            }
        });
    }
    
    // Delete modals
    const closeDeleteModalBtn = Performance.getElement('#closeDeleteModal');
    const cancelDeleteButton = Performance.getElement('#cancelDeleteButton');
    const confirmDeleteButton = Performance.getElement('#confirmDeleteButton');
    const closeDeleteAllModalBtn = Performance.getElement('#closeDeleteAllModal');
    const cancelDeleteAllButton = Performance.getElement('#cancelDeleteAllButton');
    const confirmDeleteAllButton = Performance.getElement('#confirmDeleteAllButton');
    const closeDeleteImageModalBtn = Performance.getElement('#closeDeleteImageModal');
    const cancelDeleteImageButton = Performance.getElement('#cancelDeleteImageButton');
    const confirmDeleteImageButton = Performance.getElement('#confirmDeleteImageButton');
    
    if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
    if (cancelDeleteButton) cancelDeleteButton.addEventListener('click', closeDeleteModal);
    if (confirmDeleteButton) confirmDeleteButton.addEventListener('click', confirmDelete);
    
    if (closeDeleteAllModalBtn) closeDeleteAllModalBtn.addEventListener('click', closeDeleteAllModal);
    if (cancelDeleteAllButton) cancelDeleteAllButton.addEventListener('click', closeDeleteAllModal);
    if (confirmDeleteAllButton) confirmDeleteAllButton.addEventListener('click', confirmDeleteAll);
    
    if (closeDeleteImageModalBtn) closeDeleteImageModalBtn.addEventListener('click', ImageManager.closeDeleteImageModal);
    if (cancelDeleteImageButton) cancelDeleteImageButton.addEventListener('click', ImageManager.closeDeleteImageModal);
    if (confirmDeleteImageButton) confirmDeleteImageButton.addEventListener('click', () => {
        if (currentImageToDelete) {
            deleteSingleImage(
                currentImageToDelete.reportId,
                currentImageToDelete.itemIndex,
                currentImageToDelete.itemType,
                currentImageToDelete.imageIndex
            );
        }
    });
    
    // Modal close on backdrop click
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (modal.id === 'detailsModal') closeDetailsModal();
                else if (modal.id === 'imageModal') ImageManager.closeModal();
                else if (modal.id === 'rejectionModal') closeRejectionModal();
                else if (modal.id === 'bulkRejectionModal') closeBulkRejectionModal();
                else if (modal.id === 'itemsManagementModal') closeItemsManagement();
                else if (modal.id === 'editItemModal') closeEditItemModal();
                else if (modal.id === 'deleteModal') closeDeleteModal();
                else if (modal.id === 'deleteAllModal') closeDeleteAllModal();
                else if (modal.id === 'deleteImageModal') ImageManager.closeDeleteImageModal();
            }
        });
    });
    
    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDetailsModal();
            ImageManager.closeModal();
            closeRejectionModal();
            closeBulkRejectionModal();
            closeItemsManagement();
            closeEditItemModal();
            closeDeleteModal();
            closeDeleteAllModal();
            ImageManager.closeDeleteImageModal();
        }
    });
    
    // Session timeout check
    setInterval(() => {
        if (!isAuthenticated()) {
            const reportsSection = Performance.getElement('#reportsSection');
            if (reportsSection && reportsSection.style.display !== 'none') {
                lockReports();
                showNotification('Session expired. Please login again.', 'info');
            }
        }
    }, 60000);
}

// ================================
// MAIN INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('Document loaded, initializing reports table...');
    initializeApp();
    setupEventListeners();
});

// ================================
// GLOBAL EXPORTS
// ================================
window.checkPassword = checkPassword;
window.lockReports = lockReports;
window.loadReports = loadReports;
window.clearFilters = clearFilters;
window.changePage = changePage;
window.exportReports = exportReports;
window.exportReportsByDate = exportReportsByDate;
window.hideExportDate = hideExportDate;
window.viewReportDetails = viewReportDetails;
window.closeDetailsModal = closeDetailsModal;
window.viewImage = ImageManager.openModal;
window.closeImageModal = ImageManager.closeModal;
window.downloadCurrentImage = ImageManager.downloadImage;
window.deleteCurrentImage = () => {
    if (currentImageToDeleteData) {
        ImageManager.openDeleteImageModal(
            currentImageToDeleteData.imageData,
            currentImageToDeleteData.reportId,
            currentImageToDeleteData.itemIndex,
            currentImageToDeleteData.itemType,
            currentImageToDeleteData.imageIndex
        );
    }
};
window.approveItem = approveItem;
window.bulkApproveItems = bulkApproveItems;
window.openRejectionModal = openRejectionModal;
window.closeRejectionModal = closeRejectionModal;
window.openBulkRejectionModal = openBulkRejectionModal;
window.closeBulkRejectionModal = closeBulkRejectionModal;
window.showNotification = showNotification;
window.openItemsManagement = openItemsManagement;
window.closeItemsManagement = closeItemsManagement;
window.loadItems = loadItems;
window.changeItemsPage = changeItemsPage;
window.applyItemsFilters = applyItemsFilters;
window.addItemToDatabase = addItemToDatabase;
window.openEditItemModal = openEditItemModal;
window.closeEditItemModal = closeEditItemModal;
window.saveItemChanges = saveItemChanges;
window.deleteItem = deleteItem;
window.refreshChart = refreshChart;
window.createChartBasedOnType = createChartBasedOnType;
window.updateChartControls = updateChartControls;
window.viewReportImages = viewReportDetails;
window.ImageManager = ImageManager;
window.openDeleteModal = openDeleteModal;
window.closeDeleteModal = closeDeleteModal;
window.openDeleteAllModal = openDeleteAllModal;
window.closeDeleteAllModal = closeDeleteAllModal;
window.confirmDelete = confirmDelete;
window.confirmDeleteAll = confirmDeleteAll;
window.deleteSingleImage = deleteSingleImage;
