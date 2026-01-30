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

// Chart variables
let storeChart = null;
let currentChartType = 'bar'; // Default chart type
let allReportsData = []; // For chart analysis
let chartAnalysis = {
    stores: {},
    dailyReports: {},
    monthlyCosts: {},
    dailyCosts: {}
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
    
    requestAnimationFrame(() => {
        overlay.style.display = show ? 'flex' : 'none';
        if (show && message !== 'Loading...') {
            const spinner = overlay.querySelector('.loading-spinner');
            if (spinner) {
                spinner.style.marginBottom = '15px';
                spinner.nextElementSibling?.remove();
                const text = document.createElement('p');
                text.textContent = message;
                text.style.cssText = 'color: white; margin: 0; font-size: 14px; text-align: center;';
                overlay.appendChild(text);
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
// SIMPLE MINIMAL CHART FUNCTIONS
// ================================
function initChartTypeSelector() {
    const chartTypeBtns = document.querySelectorAll('.chart-type-btn');
    chartTypeBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Remove active class from all buttons
            chartTypeBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            this.classList.add('active');
            // Update current chart type
            currentChartType = this.dataset.type;
            // Refresh chart with new type
            createChartBasedOnType();
        });
    });
}

async function loadAllReportsForChart() {
    try {
        showLoading(true, 'Analyzing store performance...');
        
        const snapshot = await db.collection('wasteReports')
            .orderBy('reportDate', 'desc')
            .get();
        
        allReportsData = [];
        snapshot.forEach(doc => {
            allReportsData.push({ id: doc.id, ...doc.data() });
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
    // Reset analysis - initialize ALL stores with zero values
    chartAnalysis = {
        stores: {},
        dailyReports: {},
        monthlyCosts: {},
        dailyCosts: {}
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
            reportDates: new Set(),
            monthlyCosts: {},
            dailyCosts: {},
            currentMetric: 0,
            periodReportCount: 0,
            periodItemCount: 0,
            periodCost: 0
        };
    });
    
    // Process ALL reports for store performance
    allReportsData.forEach(report => {
        const store = report.store;
        const reportDate = new Date(report.reportDate);
        const monthKey = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}`;
        const dayKey = report.reportDate; // YYYY-MM-DD format
        const dateKey = `${reportDate.getFullYear()}-${String(reportDate.getMonth() + 1).padStart(2, '0')}-${String(reportDate.getDate()).padStart(2, '0')}`;
        
        // Make sure store exists in chartAnalysis (in case there are stores not in ALL_STORES)
        if (!chartAnalysis.stores[store]) {
            chartAnalysis.stores[store] = {
                totalCost: 0,
                reportCount: 0,
                itemCount: 0,
                reportDates: new Set(),
                monthlyCosts: {},
                dailyCosts: {},
                currentMetric: 0,
                periodReportCount: 0,
                periodItemCount: 0,
                periodCost: 0
            };
        }
        
        const storeData = chartAnalysis.stores[store];
        
        // Calculate total cost - ONLY include approved items
        let reportCost = 0;
        let approvedItemCount = 0;
        
        // Check if it's a no-waste report (always accepted)
        if (report.disposalTypes?.includes('noWaste') || report.disposalType === 'noWaste') {
            // No waste report has 0 cost
            reportCost = 0;
            
            // Count report and add to store data
            storeData.reportCount++;
            storeData.reportDates.add(report.reportDate);
            
            // Track daily reports
            if (!chartAnalysis.dailyReports[dayKey]) {
                chartAnalysis.dailyReports[dayKey] = new Set();
            }
            chartAnalysis.dailyReports[dayKey].add(store);
            
            // Track costs by exact date (even though cost is 0)
            if (!chartAnalysis.dailyCosts[dateKey]) {
                chartAnalysis.dailyCosts[dateKey] = {};
            }
            if (!chartAnalysis.dailyCosts[dateKey][store]) {
                chartAnalysis.dailyCosts[dateKey][store] = 0;
            }
            chartAnalysis.dailyCosts[dateKey][store] += reportCost;
            
            return; // Skip to next report
        }
        
        // For reports with items, only include APPROVED items in cost calculation
        if (report.expiredItems) {
            report.expiredItems.forEach(item => {
                if (item.approvalStatus === 'approved') {
                    const itemCost = item.itemCost || 0;
                    const quantity = item.quantity || 0;
                    reportCost += itemCost * quantity;
                    approvedItemCount++;
                    storeData.itemCount++;
                }
            });
        }
        
        if (report.wasteItems) {
            report.wasteItems.forEach(item => {
                if (item.approvalStatus === 'approved') {
                    const itemCost = item.itemCost || 0;
                    const quantity = item.quantity || 0;
                    reportCost += itemCost * quantity;
                    approvedItemCount++;
                    storeData.itemCount++;
                }
            });
        }
        
        // Only count report and add to store data if at least ONE item is approved
        if (reportCost > 0 || approvedItemCount > 0) {
            storeData.totalCost += reportCost;
            storeData.reportCount++;
            storeData.reportDates.add(report.reportDate);
            
            // Track monthly costs
            if (!storeData.monthlyCosts[monthKey]) {
                storeData.monthlyCosts[monthKey] = 0;
            }
            storeData.monthlyCosts[monthKey] += reportCost;
            
            // Track daily costs
            if (!storeData.dailyCosts[dayKey]) {
                storeData.dailyCosts[dayKey] = 0;
            }
            storeData.dailyCosts[dayKey] += reportCost;
            
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
                chartAnalysis.dailyCosts[dateKey][store] = 0;
            }
            chartAnalysis.dailyCosts[dateKey][store] += reportCost;
        }
    });
}

function createChartBasedOnType() {
    const period = Performance.getElement('#chartPeriod')?.value || 'all';
    const metric = Performance.getElement('#chartMetric')?.value || 'cost';
    const sortOrder = Performance.getElement('#chartSort')?.value || 'desc';
    const datePicker = Performance.getElement('#chartDatePicker');
    
    // Start with ALL_STORES
    let storeEntries = ALL_STORES.map(store => {
        const data = chartAnalysis.stores[store] || {
            totalCost: 0,
            reportCount: 0,
            itemCount: 0,
            reportDates: new Set(),
            monthlyCosts: {},
            dailyCosts: {},
            currentMetric: 0,
            periodReportCount: 0,
            periodItemCount: 0,
            periodCost: 0
        };
        
        // Reset period-specific counters
        data.periodReportCount = 0;
        data.periodItemCount = 0;
        data.periodCost = 0;
        
        return [store, data];
    });
    
    // Filter by period and calculate period-specific metrics
    const now = new Date();
    
    if (period === 'today') {
        const today = now.toISOString().split('T')[0]; // YYYY-MM-DD format
        storeEntries.forEach(([store, data]) => {
            // Count reports from today
            data.reportDates.forEach(dateStr => {
                if (dateStr === today) {
                    data.periodReportCount++;
                }
            });
            
            // Get cost from today
            data.periodCost = data.dailyCosts[today] || 0;
            
            // For item count, we need to filter reports from today
            // This is a simplified version - in production you might want to track this differently
            data.periodItemCount = data.itemCount; // This is an approximation
        });
    } else if (period === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayKey = yesterday.toISOString().split('T')[0];
        
        storeEntries.forEach(([store, data]) => {
            data.reportDates.forEach(dateStr => {
                if (dateStr === yesterdayKey) {
                    data.periodReportCount++;
                }
            });
            data.periodCost = data.dailyCosts[yesterdayKey] || 0;
            data.periodItemCount = data.itemCount; // Approximation
        });
    } else if (period === 'thisWeek') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // Sunday
        
        storeEntries.forEach(([store, data]) => {
            let weekCost = 0;
            let weekReportCount = 0;
            
            for (let i = 0; i < 7; i++) {
                const date = new Date(startOfWeek);
                date.setDate(date.getDate() + i);
                const dateKey = date.toISOString().split('T')[0];
                
                // Check if store has reports on this date
                if (data.reportDates.has(dateKey)) {
                    weekReportCount++;
                }
                
                weekCost += data.dailyCosts[dateKey] || 0;
            }
            
            data.periodReportCount = weekReportCount;
            data.periodCost = weekCost;
            data.periodItemCount = data.itemCount; // Approximation
        });
    } else if (period === 'lastWeek') {
        const startOfLastWeek = new Date(now);
        startOfLastWeek.setDate(startOfLastWeek.getDate() - startOfLastWeek.getDay() - 7);
        
        storeEntries.forEach(([store, data]) => {
            let weekCost = 0;
            let weekReportCount = 0;
            
            for (let i = 0; i < 7; i++) {
                const date = new Date(startOfLastWeek);
                date.setDate(date.getDate() + i);
                const dateKey = date.toISOString().split('T')[0];
                
                if (data.reportDates.has(dateKey)) {
                    weekReportCount++;
                }
                
                weekCost += data.dailyCosts[dateKey] || 0;
            }
            
            data.periodReportCount = weekReportCount;
            data.periodCost = weekCost;
            data.periodItemCount = data.itemCount; // Approximation
        });
    } else if (period === 'month') {
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        
        storeEntries.forEach(([store, data]) => {
            // Count reports from this month
            data.reportDates.forEach(dateStr => {
                if (dateStr.startsWith(currentMonth)) {
                    data.periodReportCount++;
                }
            });
            
            data.periodCost = data.monthlyCosts[currentMonth] || 0;
            data.periodItemCount = data.itemCount; // Approximation
        });
    } else if (period === 'lastMonth') {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
        
        storeEntries.forEach(([store, data]) => {
            data.reportDates.forEach(dateStr => {
                if (dateStr.startsWith(lastMonthKey)) {
                    data.periodReportCount++;
                }
            });
            data.periodCost = data.monthlyCosts[lastMonthKey] || 0;
            data.periodItemCount = data.itemCount; // Approximation
        });
    } else if (period === 'quarter') {
        const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        const quarterEnd = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + 3, 0);
        
        storeEntries.forEach(([store, data]) => {
            let quarterCost = 0;
            let quarterReportCount = 0;
            
            data.reportDates.forEach(dateStr => {
                const reportDate = new Date(dateStr);
                if (reportDate >= quarterStart && reportDate <= quarterEnd) {
                    quarterReportCount++;
                }
            });
            
            for (let i = 0; i < 3; i++) {
                const month = new Date(quarterStart.getFullYear(), quarterStart.getMonth() + i, 1);
                const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
                quarterCost += data.monthlyCosts[monthKey] || 0;
            }
            
            data.periodReportCount = quarterReportCount;
            data.periodCost = quarterCost;
            data.periodItemCount = data.itemCount; // Approximation
        });
    } else if (period === 'year') {
        const currentYear = now.getFullYear();
        const yearStart = new Date(currentYear, 0, 1);
        const yearEnd = new Date(currentYear, 11, 31);
        
        storeEntries.forEach(([store, data]) => {
            let yearCost = 0;
            let yearReportCount = 0;
            
            data.reportDates.forEach(dateStr => {
                if (dateStr.startsWith(currentYear.toString())) {
                    yearReportCount++;
                }
            });
            
            for (let i = 1; i <= 12; i++) {
                const monthKey = `${currentYear}-${String(i).padStart(2, '0')}`;
                yearCost += data.monthlyCosts[monthKey] || 0;
            }
            
            data.periodReportCount = yearReportCount;
            data.periodCost = yearCost;
            data.periodItemCount = data.itemCount; // Approximation
        });
    } else if (period === 'specificDate' && datePicker && datePicker.value) {
        const selectedDate = datePicker.value;
        
        storeEntries.forEach(([store, data]) => {
            if (data.reportDates.has(selectedDate)) {
                data.periodReportCount = 1;
            } else {
                data.periodReportCount = 0;
            }
            data.periodCost = data.dailyCosts[selectedDate] || 0;
            data.periodItemCount = data.itemCount; // Approximation
        });
    } else {
        // All time - use total values
        storeEntries.forEach(([store, data]) => {
            data.periodReportCount = data.reportCount;
            data.periodCost = data.totalCost;
            data.periodItemCount = data.itemCount;
        });
    }
    
    // Calculate metric values for sorting
    const storeEntriesWithValues = storeEntries.map(([store, data]) => {
        let metricValue;
        switch(metric) {
            case 'reports':
                metricValue = data.periodReportCount; // FIXED: Use period-specific report count
                break;
            case 'items':
                metricValue = data.periodItemCount; // FIXED: Use period-specific item count
                break;
            case 'average':
                metricValue = data.periodReportCount > 0 ? data.periodCost / data.periodReportCount : 0; // FIXED: Use period values
                break;
            default: // cost
                metricValue = data.periodCost; // FIXED: Use period-specific cost
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
    
    // Convert back to array format
    const sortedStoreEntries = storeEntriesWithValues.map(item => [item.store, item.data]);
    
    // Prepare chart data
    const labels = sortedStoreEntries.map(([store]) => STORE_DISPLAY_NAMES[store] || STORE_ABBREVIATIONS[store] || store);
    const dataValues = sortedStoreEntries.map(([store, data]) => {
        switch(metric) {
            case 'reports':
                return data.periodReportCount; // FIXED
            case 'items':
                return data.periodItemCount; // FIXED
            case 'average':
                return data.periodReportCount > 0 ? data.periodCost / data.periodReportCount : 0; // FIXED
            default: // cost
                return data.periodCost; // FIXED
        }
    });
    
    // Create chart based on type
    createChart(labels, dataValues, sortedStoreEntries, metric, period);
    
    // Update chart statistics
    updateChartStatistics(sortedStoreEntries, metric, period);
}

function createChart(labels, dataValues, storeEntries, metric, period) {
    const ctx = document.getElementById('storeChart')?.getContext('2d');
    if (!ctx) return;
    
    // Destroy existing chart
    if (storeChart) {
        storeChart.destroy();
    }
    
    // Define chart data based on type
    let chartData, chartOptions;
    
    const baseColor = '#2a5934'; // Primary green color
    const accentColor = '#28a745'; // Success green
    
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
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 13,
                        },
                        bodyFont: {
                            size: 12
                        },
                        padding: 10,
                        cornerRadius: 4,
                        callbacks: {
                            label: function(context) {
                                return buildChartTooltip(context, storeEntries, metric, period);
                            },
                            title: function(context) {
                                const storeIndex = context[0].dataIndex;
                                const store = storeEntries[storeIndex][0];
                                return store; // Show full store name in tooltip
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            padding: 5,
                            callback: function(value) {
                                if (metric === 'cost' || metric === 'average') {
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
                        grid: {
                            display: false
                        },
                        ticks: {
                            font: {
                                size: 9, // Smaller font for better fit
                                weight: 'normal'
                            },
                            padding: 5,
                            maxRotation: 90,
                            minRotation: 45,
                            autoSkip: false
                        }
                    }
                }
            };
            break;
            
        case 'line':
            chartData = {
                labels: labels,
                datasets: [{
                    label: getChartLabel(metric, period),
                    data: dataValues,
                    backgroundColor: 'rgba(42, 89, 52, 0.05)',
                    borderColor: baseColor,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointBackgroundColor: baseColor,
                    pointBorderColor: '#fff',
                    pointBorderWidth: 1,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }]
            };
            
            chartOptions = {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 13,
                        },
                        bodyFont: {
                            size: 12
                        },
                        padding: 10,
                        cornerRadius: 4,
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
                        grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            padding: 5,
                            callback: function(value) {
                                if (metric === 'cost' || metric === 'average') {
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
                        grid: {
                            color: 'rgba(0, 0, 0, 0.02)',
                            drawBorder: false
                        },
                        ticks: {
                            font: {
                                size: 9
                            },
                            padding: 5,
                            maxRotation: 90,
                            minRotation: 45,
                            autoSkip: false
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
                    legend: {
                        position: 'right',
                        labels: {
                            boxWidth: 12,
                            font: {
                                size: 9
                            },
                            padding: 10
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleFont: {
                            size: 13,
                        },
                        bodyFont: {
                            size: 12
                        },
                        padding: 10,
                        cornerRadius: 4,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw;
                                const total = dataValues.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                
                                let tooltipText = `${label}: `;
                                
                                switch(metric) {
                                    case 'cost':
                                        tooltipText += `₱${value.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })} (${percentage}%)`;
                                        break;
                                    case 'reports':
                                        tooltipText += `${value} reports (${percentage}%)`;
                                        break;
                                    case 'items':
                                        tooltipText += `${value} items (${percentage}%)`;
                                        break;
                                    case 'average':
                                        tooltipText += `₱${value.toLocaleString('en-US', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })} (${percentage}%)`;
                                        break;
                                }
                                
                                return tooltipText;
                            }
                        }
                    }
                }
            };
            break;
    }
    
    // Create the chart
    storeChart = new Chart(ctx, {
        type: currentChartType,
        data: chartData,
        options: chartOptions
    });
}

function generateBarColors(values) {
    if (values.length === 0) return [];
    
    const max = Math.max(...values) || 1; // Prevent division by zero
    
    return values.map(value => {
        // For zero values, use a different color
        if (value === 0) return 'rgba(200, 200, 200, 0.5)'; // Light gray for zero
        
        const ratio = max > 0 ? value / max : 0;
        
        if (ratio > 0.7) return 'rgba(42, 89, 52, 0.9)'; // Dark green for high
        if (ratio > 0.4) return 'rgba(66, 133, 91, 0.8)'; // Medium green
        return 'rgba(102, 178, 122, 0.7)'; // Light green for low
    });
}

function generatePieColors(count) {
    const colors = [];
    const baseHue = 120; // Green hue
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
        case 'cost': return `Total At-Cost - ${periodText}`;
        case 'reports': return `Number of Reports - ${periodText}`;
        case 'items': return `Number of Items - ${periodText}`;
        case 'average': return `Average Cost - ${periodText}`;
        default: return `Total At-Cost - ${periodText}`;
    }
}

function getPeriodText(period) {
    const datePicker = Performance.getElement('#chartDatePicker');
    const now = new Date();
    
    switch(period) {
        case 'today':
            return `Today (${now.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})})`;
        case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(yesterday.getDate() - 1);
            return `Yesterday (${yesterday.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})})`;
        case 'thisWeek':
            return 'This Week';
        case 'lastWeek':
            return 'Last Week';
        case 'month':
            return `This Month (${now.toLocaleDateString('en-US', {month: 'short'})})`;
        case 'lastMonth':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return `Last Month (${lastMonth.toLocaleDateString('en-US', {month: 'short'})})`;
        case 'quarter':
            return 'This Quarter';
        case 'year':
            return `This Year (${now.getFullYear()})`;
        case 'specificDate':
            if (datePicker && datePicker.value) {
                const date = new Date(datePicker.value);
                return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
            }
            return 'Selected Date';
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
            label += `${value} item${value !== 1 ? 's' : ''}`;
            break;
        case 'average':
            label += `₱${value.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} per report`;
            break;
        default: // cost
            label += `₱${value.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;
    }
    
    // Add additional info
    if (metric !== 'reports') {
        label += ` (${storeData.periodReportCount} report${storeData.periodReportCount !== 1 ? 's' : ''} in period)`;
    }
    
    // Add last report date if available
    const lastReportDate = getLastReportDate(store);
    if (lastReportDate) {
        label += ` • Last: ${lastReportDate}`;
    }
    
    return label;
}

function getStoreDailyRate(store) {
    const storeData = chartAnalysis.stores[store];
    if (!storeData) return 0;
    
    const reportDates = Array.from(storeData.reportDates);
    if (reportDates.length === 0) return 0;
    
    // Count unique days with reports in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentReports = reportDates.filter(dateStr => {
        const reportDate = new Date(dateStr);
        return reportDate >= thirtyDaysAgo;
    });
    
    const uniqueDays = new Set(recentReports).size;
    return Math.round((uniqueDays / 30) * 100);
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
    
    // Top performing store (excluding zeros if needed)
    const topStore = storeEntries[0];
    const topStoreName = Performance.getElement('#topStoreName');
    const topStoreValue = Performance.getElement('#topStoreValue');
    
    if (topStoreName && topStoreValue) {
        const value = metric === 'reports' ? topStore[1].periodReportCount :
                     metric === 'items' ? topStore[1].periodItemCount :
                     metric === 'average' ? (topStore[1].periodReportCount > 0 ? topStore[1].periodCost / topStore[1].periodReportCount : 0) :
                     topStore[1].periodCost;
        
        topStoreName.textContent = STORE_DISPLAY_NAMES[topStore[0]] || STORE_ABBREVIATIONS[topStore[0]] || topStore[0];
        topStoreValue.textContent = metric === 'reports' ? `${value} reports` :
                                   metric === 'items' ? `${value} items` :
                                   metric === 'average' ? `₱${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` :
                                   `₱${value.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    }
    
    // Total cost/reports
    const totalCostEl = Performance.getElement('#totalCost');
    const reportCountEl = Performance.getElement('#reportCount');
    
    if (totalCostEl && reportCountEl) {
        const totalValue = storeEntries.reduce((sum, [store, data]) => {
            return sum + (metric === 'reports' ? data.periodReportCount :
                         metric === 'items' ? data.periodItemCount :
                         metric === 'average' ? (data.periodReportCount > 0 ? data.periodCost / data.periodReportCount : 0) :
                         data.periodCost);
        }, 0);
        
        const totalReports = storeEntries.reduce((sum, [store, data]) => sum + data.periodReportCount, 0);
        
        totalCostEl.textContent = metric === 'reports' ? `${totalValue}` :
                                 metric === 'items' ? `${totalValue}` :
                                 metric === 'average' ? `₱${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` :
                                 `₱${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
        reportCountEl.textContent = `${totalReports} report${totalReports !== 1 ? 's' : ''}`;
    }
    
    // Most consistent store (daily reporting)
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
        
        // Find store with no reports at all
        for (const [store, data] of storeEntries) {
            if (data.periodReportCount === 0) {
                attentionStore = store;
                reason = 'No reports in selected period';
                break;
            }
        }
        
        if (!attentionStore) {
            // If all stores have reports, check for stores with low report counts
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

function refreshChart() {
    loadAllReportsForChart();
}

function updateChartPeriodControls() {
    const periodSelect = Performance.getElement('#chartPeriod');
    const datePickerContainer = Performance.getElement('#datePickerContainer');
    
    if (periodSelect && datePickerContainer) {
        if (periodSelect.value === 'specificDate') {
            datePickerContainer.style.display = 'block';
            const datePicker = Performance.getElement('#chartDatePicker');
            if (datePicker) {
                datePicker.value = new Date().toISOString().split('T')[0];
            }
        } else {
            datePickerContainer.style.display = 'none';
        }
        createChartBasedOnType();
    }
}

// ================================
// CALCULATE REPORT COST
// ================================
function calculateReportCost(report) {
    if (!report) return 0;
    
    if (report.disposalTypes?.includes('noWaste') || report.disposalType === 'noWaste') {
        return 0;
    }
    
    let totalCost = 0;
    
    // Calculate cost from expired items
    if (report.expiredItems) {
        report.expiredItems.forEach(item => {
            const itemCost = item.itemCost || 0;
            const quantity = item.quantity || 0;
            totalCost += itemCost * quantity;
        });
    }
    
    // Calculate cost from waste items
    if (report.wasteItems) {
        report.wasteItems.forEach(item => {
            const itemCost = item.itemCost || 0;
            const quantity = item.quantity || 0;
            totalCost += itemCost * quantity;
        });
    }
    
    return totalCost;
}

function getCostCellClass(cost) {
    if (cost === 0) return '';
    if (cost > 5000) return 'high';
    if (cost > 1000) return 'medium';
    return 'low';
}

// ================================
// OPTIMIZED UTILITY FUNCTIONS
// ================================
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

function getReportApprovalStatus(report) {
    if (!report) return 'pending';
    
    if (report.disposalTypes?.includes('noWaste') || report.disposalType === 'noWaste') {
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

// ================================
// OPTIMIZED REPORTS LOADING WITH COST - UPDATED FOR DATE RANGE
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
        
        // Clear table efficiently using innerHTML for better performance
        tableBody.innerHTML = '';
        
        // Get filter values - UPDATED for date range
        const storeFilter = Performance.getElement('#filterStore');
        const dateFromFilter = Performance.getElement('#filterDateFrom');
        const dateToFilter = Performance.getElement('#filterDateTo');
        const searchEmail = Performance.getElement('#searchEmail');
        const typeFilter = Performance.getElement('#filterType');
        const filterStatus = Performance.getElement('#filterStatus');
        
        let query = db.collection('wasteReports');
        
        // Apply server-side filters
        if (storeFilter?.value) {
            query = query.where('store', '==', storeFilter.value);
        }
        
        // FIXED: Date range filtering - we'll filter client-side for range
        // Firestore doesn't support range queries on different fields easily
        // So we'll get all reports and filter client-side for date range
        
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
        
        // Build HTML string for better performance
        let tableHTML = '';
        
        snapshot.forEach(doc => {
            const report = { id: doc.id, ...doc.data() };
            reportsData.push(report);
            
            const disposalTypes = Array.isArray(report.disposalTypes) ? report.disposalTypes : 
                                report.disposalType ? [report.disposalType] : ['unknown'];
            
            // Count for statistics
            if (disposalTypes.includes('expired')) expiredCount++;
            if (disposalTypes.includes('waste')) wasteCount++;
            if (disposalTypes.includes('noWaste')) noWasteCount++;
            
            const approvalStatus = getReportApprovalStatus(report);
            if (approvalStatus === 'pending') pendingApprovalCount++;
            if (approvalStatus === 'rejected') rejectedCount++;
            if (approvalStatus === 'partial') partialCount++;
            if (approvalStatus === 'complete') completeCount++;
            
            // Client-side filtering for fields not indexed in Firestore
            const emailMatch = !searchEmail?.value || 
                              (report.email && report.email.toLowerCase().includes(searchEmail.value.toLowerCase()));
            const typeMatch = !typeFilter?.value || 
                             disposalTypes.includes(typeFilter.value);
            const statusMatch = !filterStatus?.value || 
                               approvalStatus === filterStatus.value;
            
            // UPDATED: Date range filtering
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
            
            if (emailMatch && typeMatch && statusMatch && dateMatch) {
                const itemCount = getItemCount(report);
                const totalCost = calculateReportCost(report);
                const costCellClass = getCostCellClass(totalCost);
                
                tableHTML += `
                    <tr>
                        <td>
                            <div class="report-id">${report.reportId?.substring(0, 12) || report.id.substring(0, 12)}${(report.reportId || report.id).length > 12 ? '...' : ''}</div>
                        </td>
                        <td><strong>${report.store || 'N/A'}</strong></td>
                        <td>${report.personnel || 'N/A'}</td>
                        <td><strong>${formatDate(report.reportDate)}</strong></td>
                        <td>${getDisposalTypeBadge(disposalTypes)}</td>
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
                            </div>
                        </td>
                        <td class="store-cost-cell ${costCellClass}">
                            <strong>₱${totalCost.toFixed(2)}</strong>
                        </td>
                        <td><span class="status-badge status-submitted">Submitted</span></td>
                        <td>${getApprovalStatusBadge(report)}</td>
                        <td>
                            <button class="view-details-btn" onclick="viewReportDetails('${report.id}')" title="View full report">
                                <i class="fas fa-eye"></i> View
                            </button>
                        </td>
                    </tr>
                `;
            }
        });
        
        // Set HTML in one operation
        if (tableHTML) {
            tableBody.innerHTML = tableHTML;
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
        
        // Load chart data if this is the first page (but don't wait for it)
        if (currentPage === 1) {
            // Use setTimeout to avoid blocking UI
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

function updateStatistics(total, expired, waste, noWaste, pending = 0) {
    const totalEl = Performance.getElement('#totalReports');
    const expiredEl = Performance.getElement('#expiredCount');
    const wasteEl = Performance.getElement('#wasteCount');
    const noWasteEl = Performance.getElement('#noWasteCount');
    const pendingEl = Performance.getElement('#pendingApprovalCount');
    
    if (totalEl) totalEl.textContent = total;
    if (expiredEl) expiredEl.textContent = expired;
    if (wasteEl) wasteEl.textContent = waste;
    if (noWasteEl) noWasteEl.textContent = noWaste;
    if (pendingEl) pendingEl.textContent = pending;
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
// OPTIMIZED FILTERS WITH DEBOUNCE - UPDATED FOR DATE RANGE
// ================================
function debounceApplyFilters() {
    Performance.debounce(() => {
        currentPage = 1;
        lastVisibleDoc = null;
        loadReports();
    }, 300, 'filters')();
}

function clearFilters() {
    const storeFilter = Performance.getElement('#filterStore');
    const typeFilter = Performance.getElement('#filterType');
    const dateFromFilter = Performance.getElement('#filterDateFrom'); // UPDATED
    const dateToFilter = Performance.getElement('#filterDateTo'); // UPDATED
    const searchEmail = Performance.getElement('#searchEmail');
    const filterStatus = Performance.getElement('#filterStatus');
    
    if (storeFilter) storeFilter.value = '';
    if (typeFilter) typeFilter.value = '';
    if (dateFromFilter) dateFromFilter.value = ''; // UPDATED
    if (dateToFilter) dateToFilter.value = ''; // UPDATED
    if (searchEmail) searchEmail.value = '';
    if (filterStatus) filterStatus.value = '';
    
    currentPage = 1;
    lastVisibleDoc = null;
    loadReports();
}

// ================================
// OPTIMIZED REPORT DETAILS
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
        
        const report = { id: doc.id, ...doc.data() };
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
}

async function buildReportContent(report) {
    const disposalTypes = Array.isArray(report.disposalTypes) ? report.disposalTypes : 
                        report.disposalType ? [report.disposalType] : ['unknown'];
    
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
                    <div class="detail-value"><strong>₱${totalCost.toFixed(2)}</strong></div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Overall Status</div>
                    <div class="detail-value">${getApprovalStatusBadge(report)}</div>
                </div>
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
    
    // Add items sections
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
                        ₱${totalCost.toFixed(2)}
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
    
    // Add documentation if exists
    if (item.documentation?.length > 0) {
        content += buildDocumentationContent(item.documentation);
    }
    
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

function buildDocumentationContent(docs) {
    let content = `
        <div style="margin-top: 8px;">
            <div style="font-size: 11px; color: var(--color-gray); margin-bottom: 4px;">Documentation (${docs.length} files):</div>
            <div class="image-gallery">
    `;
    
    // Limit to 3 images for performance
    docs.slice(0, 3).forEach((doc, docIndex) => {
        if (doc.type?.startsWith('image/')) {
            content += `
                <img src="data:${doc.type};base64,${doc.base64}" 
                     alt="Document ${docIndex + 1}" 
                     class="image-thumbnail"
                     onclick="viewImage('data:${doc.type};base64,${doc.base64}')"
                     style="cursor: pointer; width: 80px; height: 80px; object-fit: cover; border-radius: 4px; margin: 2px;">
            `;
        }
    });
    
    content += `</div></div>`;
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

function viewImage(src) {
    const imageModal = Performance.getElement('#imageModal');
    const modalImage = Performance.getElement('#modalImage');
    
    if (imageModal && modalImage) {
        modalImage.src = src;
        imageModal.style.display = 'flex';
        
        // Preload image for smoother experience
        const img = new Image();
        img.src = src;
    }
}

function closeImageModal() {
    const imageModal = Performance.getElement('#imageModal');
    if (imageModal) {
        imageModal.style.display = 'none';
    }
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
        
        items[itemIndex] = {
            ...items[itemIndex],
            approvalStatus: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: 'Administrator',
            rejectionReason: reason.trim()
        };
        
        const field = itemType === 'expired' ? 'expiredItems' : 'wasteItems';
        await docRef.update({ [field]: items });
        
        showNotification('Item rejected successfully', 'success');
        
        // Update UI without full reload
        updateReportAfterApproval(reportId);
        
        // Send email notification
        await sendRejectionEmailViaGAS(report.email, report.reportId || reportId, itemIndex + 1, itemType, reason.trim(), report);
        
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
        
        const updatedItems = items.map(item => {
            if (!item.approvalStatus || item.approvalStatus === 'pending') {
                return {
                    ...item,
                    approvalStatus: 'rejected',
                    rejectedAt: new Date().toISOString(),
                    rejectedBy: 'Administrator',
                    rejectionReason: reason.trim()
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
        await sendBulkRejectionEmailViaGAS(report.email, report.reportId || reportId, updatedItems.filter(i => i.approvalStatus === 'rejected').length, reason.trim(), report);
        
    } catch (error) {
        console.error('Error bulk rejecting items:', error);
        showNotification('Error bulk rejecting items: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ================================
// OPTIMIZED UI UPDATING
// ================================
async function updateReportAfterApproval(reportId) {
    try {
        // Get updated report
        const doc = await db.collection('wasteReports').doc(reportId).get();
        if (!doc.exists) return;
        
        const updatedReport = { id: doc.id, ...doc.data() };
        
        // Update the table row if the report is in the current view
        const rowIndex = reportsData.findIndex(r => r.id === reportId);
        if (rowIndex !== -1) {
            reportsData[rowIndex] = updatedReport;
            
            // Update the specific row in the table
            const tableBody = Performance.getElement('#reportsTableBody');
            if (tableBody && tableBody.children[rowIndex]) {
                const row = tableBody.children[rowIndex];
                const approvalCell = row.cells[9]; // Approval status cell
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
        
        // Refresh chart data if report status changed (since we now track approved items)
        setTimeout(() => {
            loadAllReportsForChart();
        }, 500);
        
    } catch (error) {
        console.error('Error updating UI after approval:', error);
        // Fall back to full reload if partial update fails
        loadReports();
    }
}

function updateStatisticsFromReports() {
    let expiredCount = 0;
    let wasteCount = 0;
    let noWasteCount = 0;
    let pendingApprovalCount = 0;
    
    reportsData.forEach(report => {
        const disposalTypes = Array.isArray(report.disposalTypes) ? report.disposalTypes : 
                            report.disposalType ? [report.disposalType] : ['unknown'];
        
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
// EMAIL SENDING FUNCTIONS
// ================================
async function sendRejectionEmailViaGAS(toEmail, reportId, itemNumber, itemType, reason, reportData) {
    try {
        const itemsArray = itemType === 'expired' ? reportData.expiredItems : reportData.wasteItems;
        const rejectedItem = itemsArray[itemNumber - 1];

        // Prepare email data
        const emailData = {
            emailType: 'rejection',
            to: toEmail,
            subject: `Waste Report Item Rejected - ${reportId}`,
            store: reportData.store || 'N/A',
            personnel: reportData.personnel || 'Team Member',
            reportDate: formatDate(reportData.reportDate) || 'N/A',
            disposalType: (reportData.disposalType || '').toUpperCase(),
            reportId: reportId,
            itemName: rejectedItem?.item || 'N/A',
            itemQuantity: rejectedItem?.quantity || 0,
            itemUnit: rejectedItem?.unit || 'units',
            itemCost: `₱${((rejectedItem?.itemCost || 0) * (rejectedItem?.quantity || 0)).toFixed(2)}`,
            itemReason: itemType === 'waste' ? rejectedItem?.reason || 'N/A' : 'N/A',
            expirationDate: itemType === 'expired' ? formatDate(rejectedItem?.expirationDate) : 'N/A',
            rejectionReason: reason,
            rejectedAt: new Date().toLocaleString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            })
        };

        console.log('Sending rejection email with data:', emailData);

        const formData = new FormData();
        Object.keys(emailData).forEach(key => {
            formData.append(key, emailData[key]);
        });

        // Try different approaches
        let success = false;
        
        // Approach 1: Using fetch with form data
        try {
            await fetch(GAS_CONFIG.ENDPOINT, {
                method: 'POST',
                body: formData,
                mode: 'no-cors' // Using no-cors for GAS
            });
            console.log('Rejection email sent via form data');
            success = true;
        } catch (error) {
            console.warn('Form data approach failed, trying URL params:', error);
            
            // Approach 2: Using URL parameters
            try {
                const params = new URLSearchParams();
                Object.keys(emailData).forEach(key => {
                    params.append(key, emailData[key]);
                });
                
                await fetch(GAS_CONFIG.ENDPOINT + '?' + params.toString(), {
                    method: 'GET',
                    mode: 'no-cors'
                });
                console.log('Rejection email sent via URL params');
                success = true;
            } catch (error2) {
                console.error('URL params approach also failed:', error2);
                
                // Approach 3: Try JSON POST
                try {
                    await fetch(GAS_CONFIG.ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(emailData),
                        mode: 'no-cors'
                    });
                    console.log('Rejection email sent via JSON');
                    success = true;
                } catch (error3) {
                    console.error('All email sending approaches failed:', error3);
                }
            }
        }

        if (success) {
            console.log('✅ Rejection email sent successfully');
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
        const emailData = {
            emailType: 'bulk_rejection',
            to: toEmail,
            subject: `Multiple Items Rejected - ${reportId}`,
            store: reportData.store || 'N/A',
            personnel: reportData.personnel || 'Team Member',
            reportDate: formatDate(reportData.reportDate) || 'N/A',
            disposalType: (reportData.disposalType || '').toUpperCase(),
            reportId: reportId,
            rejectedCount: rejectedCount,
            rejectionReason: reason,
            rejectedAt: new Date().toLocaleString('en-US', { 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
            })
        };

        console.log('Sending bulk rejection email with data:', emailData);

        const formData = new FormData();
        Object.keys(emailData).forEach(key => {
            formData.append(key, emailData[key]);
        });

        let success = false;
        
        // Try different approaches
        try {
            await fetch(GAS_CONFIG.ENDPOINT, {
                method: 'POST',
                body: formData,
                mode: 'no-cors'
            });
            console.log('Bulk rejection email sent via form data');
            success = true;
        } catch (error) {
            console.warn('Form data approach failed, trying URL params:', error);
            
            try {
                const params = new URLSearchParams();
                Object.keys(emailData).forEach(key => {
                    params.append(key, emailData[key]);
                });
                
                await fetch(GAS_CONFIG.ENDPOINT + '?' + params.toString(), {
                    method: 'GET',
                    mode: 'no-cors'
                });
                console.log('Bulk rejection email sent via URL params');
                success = true;
            } catch (error2) {
                console.error('URL params approach also failed:', error2);
                
                try {
                    await fetch(GAS_CONFIG.ENDPOINT, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(emailData),
                        mode: 'no-cors'
                    });
                    console.log('Bulk rejection email sent via JSON');
                    success = true;
                } catch (error3) {
                    console.error('All bulk email sending approaches failed:', error3);
                }
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
// EXPORT FUNCTIONS - UPDATED FOR DATE RANGE
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
            // Apply current filters - UPDATED for date range
            const storeFilter = Performance.getElement('#filterStore');
            const dateFromFilter = Performance.getElement('#filterDateFrom');
            const dateToFilter = Performance.getElement('#filterDateTo');
            
            if (storeFilter?.value) {
                query = query.where('store', '==', storeFilter.value);
            }
            
            // Note: We'll filter by date range client-side for export too
        }
        
        const snapshot = await query.get();
        
        if (snapshot.empty) {
            showNotification('No reports to export', 'warning');
            return;
        }
        
        let reports = [];
        snapshot.forEach(doc => {
            reports.push({ id: doc.id, ...doc.data() });
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
            reports.push({ id: doc.id, ...doc.data() });
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
// OPTIMIZED ITEMS MANAGEMENT
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
// ENHANCED EVENT LISTENERS WITH CHART TYPE SELECTOR - UPDATED FOR DATE RANGE
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
    
    // Initialize chart type selector
    initChartTypeSelector();
    
    // Chart controls
    const chartPeriod = Performance.getElement('#chartPeriod');
    const chartMetric = Performance.getElement('#chartMetric');
    const chartSort = Performance.getElement('#chartSort');
    const refreshChartBtn = Performance.getElement('#refreshChart');
    const chartDatePicker = Performance.getElement('#chartDatePicker');
    
    if (chartPeriod) chartPeriod.addEventListener('change', updateChartPeriodControls);
    if (chartMetric) chartMetric.addEventListener('change', createChartBasedOnType);
    if (chartSort) chartSort.addEventListener('change', createChartBasedOnType);
    if (refreshChartBtn) refreshChartBtn.addEventListener('click', refreshChart);
    if (chartDatePicker) chartDatePicker.addEventListener('change', createChartBasedOnType);
    
    // Reports filters with debounce - UPDATED for date range
    const searchEmail = Performance.getElement('#searchEmail');
    const filterStore = Performance.getElement('#filterStore');
    const filterType = Performance.getElement('#filterType');
    const filterDateFrom = Performance.getElement('#filterDateFrom'); // UPDATED
    const filterDateTo = Performance.getElement('#filterDateTo'); // UPDATED
    const filterStatus = Performance.getElement('#filterStatus');
    const clearFiltersBtn = Performance.getElement('#clearFilters');
    
    [searchEmail, filterStore, filterType, filterDateFrom, filterDateTo, filterStatus].forEach(el => {
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
    
    if (closeImageModalBtn) closeImageModalBtn.addEventListener('click', closeImageModal);
    if (closeImageModalButton) closeImageModalButton.addEventListener('click', closeImageModal);
    
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
    
    // Modal close on backdrop click
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                if (modal.id === 'detailsModal') closeDetailsModal();
                else if (modal.id === 'imageModal') closeImageModal();
                else if (modal.id === 'rejectionModal') closeRejectionModal();
                else if (modal.id === 'bulkRejectionModal') closeBulkRejectionModal();
                else if (modal.id === 'itemsManagementModal') closeItemsManagement();
                else if (modal.id === 'editItemModal') closeEditItemModal();
            }
        });
    });
    
    // Escape key to close modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeDetailsModal();
            closeImageModal();
            closeRejectionModal();
            closeBulkRejectionModal();
            closeItemsManagement();
            closeEditItemModal();
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
    }, 60000); // Check every minute
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
window.viewImage = viewImage;
window.closeImageModal = closeImageModal;
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
window.updateChartPeriodControls = updateChartPeriodControls;