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
// ENHANCED LOADER FUNCTIONS
// ================================
const Loader = {
    overlay: document.getElementById('loadingOverlay'),
    textElement: document.getElementById('loaderText'),
    
    show(message = 'Loading...') {
        if (!this.overlay) return;
        
        requestAnimationFrame(() => {
            this.overlay.style.display = 'flex';
            if (this.textElement) {
                this.textElement.textContent = message;
            }
        });
    },
    
    hide() {
        if (!this.overlay) return;
        
        requestAnimationFrame(() => {
            this.overlay.style.opacity = '0';
            setTimeout(() => {
                this.overlay.style.display = 'none';
                this.overlay.style.opacity = '1';
            }, 200);
        });
    },
    
    updateMessage(message) {
        if (this.textElement) {
            this.textElement.textContent = message;
        }
    }
};

// Replace the existing showLoading function with:
function showLoading(show, message = 'Loading...') {
    if (show) {
        Loader.show(message);
    } else {
        Loader.hide();
    }
}

// ================================
// CONFIGURATION
// ================================

// Google Apps Script endpoint for email
const GAS_CONFIG = {
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbyPGgZ54q-lDUu5YxaeQbSJ-z2pDqM8ia4eTfshdpSNbrqBFF7fQZvglx9IeZn0PqHSTg/exec'
};

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
let auth;
let currentUser = null;
let currentUserRole = 'user';
let currentPage = 1;
const pageSize = 10;
let lastVisibleDoc = null;
let firstVisibleDoc = null;
let reportsData = [];
let isDataLoading = false;
let allReportsData = [];
let filteredReportsData = [];
let totalFilteredCount = 0;

// Items management variables
let itemsData = [];
let itemsCurrentPage = 1;
const itemsPageSize = 10;
let itemsLastVisibleDoc = null;
let itemsFirstVisibleDoc = null;
let currentEditItemId = null;
let currentItemType = 'regular'; // 'regular' or 'kitchen'
let kitchenItemsData = [];
let regularItemsData = [];
let regularItemsCount = 0;
let kitchenItemsCount = 0;

// State variables
let currentRejectionData = null;
let currentBulkRejectionData = null;
let currentReportDetailsId = null;
let currentReportToDelete = null;
let currentImageToDelete = null;
let currentImageToDeleteData = null;

// Chart variables
let storeChart = null;
let currentChartType = 'bar';
let chartAnalysis = {
    stores: {},
    dailyReports: {},
    monthlyCosts: {},
    dailyCosts: {},
    timeSeriesData: {}
};

// Statistics variables
let statsFilterPeriod = 'all';

// Cache for reports
let reportsCache = {
    data: [],
    timestamp: 0,
    ttl: 5 * 60 * 1000
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
    'FG to go LEGAZPI': 'LEGAZPI(to go)',
    'FG LEGAZPI': 'LEGAZPI',
    'FG NAGA': 'NAGA'
};

// Admin emails list
const ADMIN_EMAILS = [
    'admin@fgoperations.com',
    'admin@gmail.com'
];

// ================================
// AUTHENTICATION FUNCTIONS
// ================================

// Initialize Firebase Auth
function initializeAuth() {
    auth = firebase.auth();
    
    // Set up auth state observer
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await determineUserRole(user);
            showReportsSection();
            updateNavBar(user);
            loadReports();
            showNotification(`Welcome ${user.displayName || user.email}!`, 'success');
        } else {
            currentUser = null;
            currentUserRole = 'user';
            showAuthSection();
            updateNavBar(null);
        }
    });
}

// Determine user role
async function determineUserRole(user) {
    if (!user) {
        currentUserRole = 'user';
        return;
    }
    
    try {
        if (ADMIN_EMAILS.includes(user.email)) {
            currentUserRole = 'admin';
        } else {
            const idTokenResult = await user.getIdTokenResult();
            if (idTokenResult.claims.admin || idTokenResult.claims.role === 'admin') {
                currentUserRole = 'admin';
            } else {
                currentUserRole = 'user';
            }
        }
        
        document.body.className = currentUserRole;
        
    } catch (error) {
        console.error('Error determining user role:', error);
        currentUserRole = 'user';
        document.body.className = 'user';
    }
}

// Update navigation bar
function updateNavBar(user) {
    const navActions = Performance.getElement('#navActions');
    if (!navActions) return;
    
    if (user) {
        const displayName = user.displayName || user.email.split('@')[0];
        navActions.innerHTML = `
            <div class="user-info ${currentUserRole}">
                <i class="fas fa-user-circle"></i>
                <span>${displayName}</span>
                <span class="user-role-badge">${currentUserRole.toUpperCase()}</span>
            </div>
            <button class="logout-btn" onclick="handleLogout()">
                <i class="fas fa-sign-out-alt"></i> Logout
            </button>
        `;
    } else {
        navActions.innerHTML = `
            <button class="btn btn-primary" onclick="showAuthSection()">
                <i class="fas fa-sign-in-alt"></i> Login
            </button>
        `;
    }
}

// Handle login
async function handleLogin() {
    const email = Performance.getElement('#loginEmail')?.value.trim();
    const password = Performance.getElement('#loginPassword')?.value;
    
    if (!email || !password) {
        showNotification('Please enter email and password', 'error');
        return;
    }
    
    showLoading(true, 'Logging in...');
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        showNotification('Login successful!', 'success');
        
        Performance.getElement('#loginEmail').value = '';
        Performance.getElement('#loginPassword').value = '';
        
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = 'Login failed';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'User not found. Please contact administrator.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled.';
                break;
            default:
                errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        showLoading(false);
    }
}

// ================================
// CREATE ACCOUNT MODAL FUNCTIONS - FIXED
// ================================

// Open create account modal
function openCreateAccountModal() {
    if (!isAdmin()) {
        showNotification('Only administrators can create accounts', 'error');
        return;
    }
    
    const modal = document.getElementById('createAccountModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

// Close create account modal - FIXED: Now properly closes the modal
function closeCreateAccountModal() {
    const modal = document.getElementById('createAccountModal');
    if (modal) {
        modal.style.display = 'none';
        
        // Clear form fields
        const emailInput = document.getElementById('newAccountEmail');
        const passwordInput = document.getElementById('newAccountPassword');
        const confirmInput = document.getElementById('newAccountConfirmPassword');
        const nameInput = document.getElementById('newAccountFullName');
        
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (confirmInput) confirmInput.value = '';
        if (nameInput) nameInput.value = '';
        
        // Reset radio to default
        const userRadio = document.getElementById('roleUser');
        if (userRadio) userRadio.checked = true;
    }
}

// Setup create account modal event listeners
function setupCreateAccountModalListeners() {
    const closeBtn = document.getElementById('closeCreateAccountModal');
    const cancelBtn = document.getElementById('cancelCreateAccount');
    const createBtn = document.getElementById('createAccountSubmit');
    
    if (closeBtn) {
        closeBtn.addEventListener('click', closeCreateAccountModal);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeCreateAccountModal);
    }
    
    if (createBtn) {
        createBtn.addEventListener('click', handleAdminCreateAccount);
    }
    
    // Handle backdrop click
    const modal = document.getElementById('createAccountModal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeCreateAccountModal();
            }
        });
    }
    
    // Handle escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('createAccountModal');
            if (modal && modal.style.display === 'flex') {
                closeCreateAccountModal();
            }
        }
    });
}

// Handle admin creating new account
async function handleAdminCreateAccount() {
    if (!isAuthenticated()) {
        showNotification('You must be logged in', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can create accounts', 'error');
        return;
    }
    
    const email = document.getElementById('newAccountEmail')?.value.trim();
    const password = document.getElementById('newAccountPassword')?.value;
    const confirmPassword = document.getElementById('newAccountConfirmPassword')?.value;
    const fullName = document.getElementById('newAccountFullName')?.value.trim();
    const roleRadios = document.getElementsByName('accountRole');
    let selectedRole = 'user';
    
    for (const radio of roleRadios) {
        if (radio.checked) {
            selectedRole = radio.value;
            break;
        }
    }
    
    // Validation
    if (!email || !password || !confirmPassword || !fullName) {
        showNotification('Please fill in all fields', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showNotification('Please enter a valid email address', 'error');
        return;
    }
    
    showLoading(true, 'Creating account...');
    
    try {
        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Update profile
        await userCredential.user.updateProfile({
            displayName: fullName
        });
        
        // Store in users collection
        await db.collection('users').doc(userCredential.user.uid).set({
            email: email,
            displayName: fullName,
            role: selectedRole,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.email || 'Administrator'
        });
        
        // Add to admin list if role is admin
        if (selectedRole === 'admin' && !ADMIN_EMAILS.includes(email)) {
            ADMIN_EMAILS.push(email);
        }
        
        showNotification(`Account created successfully for ${fullName} (${selectedRole})`, 'success');
        
        // Clear form and close modal
        closeCreateAccountModal();
        
    } catch (error) {
        console.error('Create account error:', error);
        
        let errorMessage = 'Failed to create account';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = 'Email already in use.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/weak-password':
                errorMessage = 'Password is too weak.';
                break;
            default:
                errorMessage = error.message;
        }
        
        showNotification(errorMessage, 'error');
    } finally {
        showLoading(false);
    }
}

// Handle logout
async function handleLogout() {
    try {
        await auth.signOut();
        showNotification('Logged out successfully', 'info');
        showAuthSection();
    } catch (error) {
        console.error('Logout error:', error);
        showNotification('Error logging out', 'error');
    }
}

// Check if user is authenticated
function isAuthenticated() {
    return currentUser !== null;
}

// Check if user is admin
function isAdmin() {
    return currentUserRole === 'admin';
}

// Toggle password visibility
function togglePassword(inputId) {
    const input = Performance.getElement(`#${inputId}`);
    const toggleBtn = input?.nextElementSibling;
    
    if (input && toggleBtn) {
        const type = input.type === 'password' ? 'text' : 'password';
        input.type = type;
        toggleBtn.innerHTML = type === 'password' ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    }
}

// Show auth section
function showAuthSection() {
    const authSection = Performance.getElement('#authSection');
    const reportsSection = Performance.getElement('#reportsSection');
    
    if (authSection) authSection.style.display = 'flex';
    if (reportsSection) reportsSection.style.display = 'none';
}

// Show reports section
function showReportsSection() {
    const authSection = Performance.getElement('#authSection');
    const reportsSection = Performance.getElement('#reportsSection');
    
    if (authSection) authSection.style.display = 'none';
    if (reportsSection) reportsSection.style.display = 'block';
}

// ================================
// STATISTICS FUNCTIONS
// ================================
function updateStatisticsFromAllReports() {
    if (!allReportsData || allReportsData.length === 0) {
        updateStatistics(0, 0, 0, 0, 0);
        return;
    }
    
    const filteredReports = filterReportsByPeriod(allReportsData, statsFilterPeriod);
    
    let expiredCount = 0;
    let wasteCount = 0;
    let noWasteCount = 0;
    let pendingApprovalCount = 0;
    
    filteredReports.forEach(report => {
        const disposalTypes = report.disposalTypes;
        
        if (disposalTypes.includes('expired')) expiredCount++;
        if (disposalTypes.includes('waste')) wasteCount++;
        if (disposalTypes.includes('noWaste')) noWasteCount++;
        
        const approvalStatus = getReportApprovalStatus(report);
        if (approvalStatus === 'pending') pendingApprovalCount++;
    });
    
    updateStatistics(
        filteredReports.length, 
        expiredCount, 
        wasteCount, 
        noWasteCount, 
        pendingApprovalCount
    );
    
    const statsPeriodInfo = Performance.getElement('#statsPeriodInfo');
    if (statsPeriodInfo) {
        const periodText = getStatsPeriodText(statsFilterPeriod);
        statsPeriodInfo.textContent = `Showing statistics for: ${periodText} (${filteredReports.length} reports)`;
    }
}

function filterReportsByPeriod(reports, period) {
    if (period === 'all' || !reports || reports.length === 0) {
        return reports;
    }
    
    const now = new Date();
    let startDate, endDate;
    
    switch(period) {
        case 'today':
            startDate = new Date(now);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'thisWeek':
            startDate = new Date(now);
            startDate.setDate(startDate.getDate() - startDate.getDay());
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + 6);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'thisMonth':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'lastMonth':
            startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), now.getMonth(), 0);
            endDate.setHours(23, 59, 59, 999);
            break;
        case 'thisYear':
            startDate = new Date(now.getFullYear(), 0, 1);
            startDate.setHours(0, 0, 0, 0);
            endDate = new Date(now.getFullYear(), 11, 31);
            endDate.setHours(23, 59, 59, 999);
            break;
        default:
            return reports;
    }
    
    return reports.filter(report => {
        const reportDate = new Date(report.reportDate);
        return reportDate >= startDate && reportDate <= endDate;
    });
}

function getStatsPeriodText(period) {
    const now = new Date();
    
    switch(period) {
        case 'today':
            return `Today (${now.toLocaleDateString('en-US', {weekday: 'short', month: 'short', day: 'numeric'})})`;
        case 'thisWeek':
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            return `This Week (${weekStart.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - ${weekEnd.toLocaleDateString('en-US', {month: 'short', day: 'numeric'})})`;
        case 'thisMonth':
            return `This Month (${now.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})})`;
        case 'lastMonth':
            const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            return `Last Month (${lastMonth.toLocaleDateString('en-US', {month: 'long', year: 'numeric'})})`;
        case 'thisYear':
            return `This Year (${now.getFullYear()})`;
        case 'all':
        default:
            return 'All Time';
    }
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

function refreshStatistics() {
    updateStatisticsFromAllReports();
}

function changeStatsPeriod(period) {
    statsFilterPeriod = period;
    refreshStatistics();
}

// ================================
// OPTIMIZED IMAGE FUNCTIONS
// ================================
const ImageManager = {
    urlCache: new Map(),
    
    displayImagesInItem(item, index, type) {
        if (!item.documentation || !Array.isArray(item.documentation) || item.documentation.length === 0) {
            return '';
        }
        
        const images = item.documentation.filter(doc => doc.type?.startsWith('image/'));
        if (images.length === 0) {
            return '';
        }
        
        let imagesHTML = `
            <div class="image-gallery-section">
                <div style="font-size: 11px; color: #666; margin-bottom: 8px;">
                    <i class="fas fa-images"></i> ${images.length} image${images.length !== 1 ? 's' : ''}
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px;">
        `;
        
        images.forEach((doc, docIndex) => {
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
        
        const cached = this.urlCache.get(storagePath);
        if (cached) return cached;
        
        let cleanPath = storagePath;
        
        if (cleanPath.startsWith('/')) {
            cleanPath = cleanPath.substring(1);
        }
        
        const bucketPrefix = `gs://${firebaseConfig.storageBucket}/`;
        if (cleanPath.startsWith(bucketPrefix)) {
            cleanPath = cleanPath.substring(bucketPrefix.length);
        }
        
        const appspotPrefix = 'disposal-e6b83.appspot.com/';
        if (cleanPath.startsWith(appspotPrefix)) {
            cleanPath = cleanPath.substring(appspotPrefix.length);
        }
        
        const encodedPath = encodeURIComponent(cleanPath);
        const url = `https://firebasestorage.googleapis.com/v0/b/${firebaseConfig.storageBucket}/o/${encodedPath}?alt=media`;
        
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
        
        modalImage.style.display = 'none';
        modalImage.src = '';
        if (imageLoading) imageLoading.style.display = 'block';
        
        if (imageInfo) {
            imageInfo.innerHTML = `
                <div style="text-align: center;">
                    <strong>${imageName}</strong><br>
                    <small>Loading...</small>
                </div>
            `;
        }
        
        if (downloadBtn) {
            downloadBtn.onclick = () => this.downloadImage(imageUrl, imageName);
        }
        
        if (deleteBtn && imageData && reportId && isAdmin()) {
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
        if (!isAdmin()) {
            showNotification('Only admins can delete images', 'error');
            return;
        }
        
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
            let filePath = imageData.path;
            
            if (filePath.startsWith('/')) {
                filePath = filePath.substring(1);
            }
            
            const bucketPrefix = `gs://${firebaseConfig.storageBucket}/`;
            if (filePath.startsWith(bucketPrefix)) {
                filePath = filePath.substring(bucketPrefix.length);
            }
            
            const appspotPrefix = 'disposal-e6b83.appspot.com/';
            if (filePath.startsWith(appspotPrefix)) {
                filePath = filePath.substring(appspotPrefix.length);
            }
            
            const storageRef = storage.ref(filePath);
            await storageRef.delete();
            
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
// OPTIMIZED INITIALIZATION
// ================================
function initializeApp() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        storage = firebase.storage();
        auth = firebase.auth();
        
        db.enablePersistence()
            .then(() => console.log('✅ Firebase persistence enabled'))
            .catch(err => {
                if (err.code === 'failed-precondition') {
                    console.log('Multiple tabs open, persistence can only be enabled in one tab at a time.');
                } else if (err.code === 'unimplemented') {
                    console.log('The current browser does not support persistence.');
                }
            });
        
        initializeAuth();
        
        // Migrate existing items to have category field
        setTimeout(() => {
            if (isAdmin()) {
                migrateItemsToCategories();
            }
        }, 2000);
        
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        showNotification('Firebase connection failed. Please check console.', 'error');
        return;
    }
}

// ================================
// CHART FUNCTIONS
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
        if (storeSelectorContainer) storeSelectorContainer.style.display = 'block';
        if (dateRangePickerContainer && chartPeriod) {
            dateRangePickerContainer.style.display = chartPeriod.value === 'specificDateRange' ? 'block' : 'none';
        }
    } else {
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
        updateStatisticsFromAllReports();
        
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
        timeSeriesData: {}
    };
    
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
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
            dailyTotalCosts: {},
            currentMetric: 0,
            periodReportCount: 0,
            periodItemCount: 0,
            periodCost: 0,
            periodApprovedCost: 0,
            periodApprovedItemCount: 0,
            periodTotalCost: 0
        };
    });
    
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
        
        let reportCost = 0;
        let approvedReportCost = 0;
        let approvedItemCount = 0;
        let totalItemCount = 0;
        
        if (report.expiredItems) {
            report.expiredItems.forEach(item => {
                const itemCost = item.itemCost || 0;
                const quantity = item.quantity || 0;
                const itemTotalCost = itemCost * quantity;
                
                totalItemCount++;
                storeData.itemCount++;
                
                if (item.approvalStatus === 'approved') {
                    approvedItemCount++;
                    approvedReportCost += itemTotalCost;
                }
                
                reportCost += itemTotalCost;
            });
        }
        
        if (report.wasteItems) {
            report.wasteItems.forEach(item => {
                const itemCost = item.itemCost || 0;
                const quantity = item.quantity || 0;
                const itemTotalCost = itemCost * quantity;
                
                totalItemCount++;
                storeData.itemCount++;
                
                if (item.approvalStatus === 'approved') {
                    approvedItemCount++;
                    approvedReportCost += itemTotalCost;
                }
                
                reportCost += itemTotalCost;
            });
        }
        
        storeData.totalCost += reportCost;
        storeData.approvedCost += approvedReportCost;
        storeData.approvedItemCount += approvedItemCount;
        storeData.reportCount++;
        storeData.reportDates.add(report.reportDate);
        
        if (!storeData.monthlyCosts[monthKey]) {
            storeData.monthlyCosts[monthKey] = {
                approved: 0,
                total: 0
            };
        }
        storeData.monthlyCosts[monthKey].approved += approvedReportCost;
        storeData.monthlyCosts[monthKey].total += reportCost;
        
        if (!storeData.dailyCosts[dayKey]) {
            storeData.dailyCosts[dayKey] = {
                approved: 0,
                total: 0
            };
        }
        storeData.dailyCosts[dayKey].approved += approvedReportCost;
        storeData.dailyCosts[dayKey].total += reportCost;
        
        if (!storeData.dailyTotalCosts[dayKey]) {
            storeData.dailyTotalCosts[dayKey] = 0;
        }
        storeData.dailyTotalCosts[dayKey] += reportCost;
        
        if (!chartAnalysis.dailyReports[dayKey]) {
            chartAnalysis.dailyReports[dayKey] = new Set();
        }
        chartAnalysis.dailyReports[dayKey].add(store);
        
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
        
        data.periodReportCount = 0;
        data.periodItemCount = 0;
        data.periodCost = 0;
        data.periodApprovedCost = 0;
        data.periodApprovedItemCount = 0;
        data.periodTotalCost = 0;
        
        return [store, data];
    });
    
    calculatePeriodMetrics(storeEntries, period);
    
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
            default:
                metricValue = data.periodApprovedCost;
        }
        return {
            store,
            data,
            metricValue
        };
    });
    
    storeEntriesWithValues.sort((a, b) => {
        return sortOrder === 'desc' ? b.metricValue - a.metricValue : a.metricValue - b.metricValue;
    });
    
    const sortedStoreEntries = storeEntriesWithValues.map(item => [item.store, item.data]);
    
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
            default:
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
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 30);
                endDate = new Date(now);
            }
            break;
        default:
            startDate = new Date(0);
            endDate = new Date(8640000000000000);
    }
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    storeEntries.forEach(([store, data]) => {
        let periodApprovedCost = 0;
        let periodTotalCost = 0;
        let periodReportCount = 0;
        let periodItemCount = 0;
        let periodApprovedItemCount = 0;
        
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateKey = currentDate.toISOString().split('T')[0];
            
            if (data.reportDates.has(dateKey)) {
                periodReportCount++;
            }
            
            if (data.dailyCosts[dateKey]) {
                periodApprovedCost += data.dailyCosts[dateKey].approved || 0;
                periodTotalCost += data.dailyCosts[dateKey].total || 0;
            }
            
            periodItemCount += calculateItemsForDate(store, dateKey);
            periodApprovedItemCount += calculateApprovedItemsForDate(store, dateKey);
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        data.periodReportCount = periodReportCount;
        data.periodApprovedCost = periodApprovedCost;
        data.periodTotalCost = periodTotalCost;
        data.periodItemCount = periodItemCount;
        data.periodApprovedItemCount = periodApprovedItemCount;
        data.periodCost = periodApprovedCost;
    });
}

function createLineChart(period, metric, selectedStore) {
    const ctx = document.getElementById('storeChart')?.getContext('2d');
    if (!ctx) return;
    
    if (storeChart) {
        storeChart.destroy();
    }
    
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
                const dayDiff = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
                dateFormat = dayDiff > 90 ? 'MMM' : 'MMM dd';
            } else {
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 30);
                endDate = new Date(now);
            }
            break;
        default:
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
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
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
            default:
                label = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
        
        labels.push(label);
        currentDate.setDate(currentDate.getDate() + 1);
    }
    
    const datasets = [];
    const colors = [
        '#2a5934', '#3a7d5a', '#4aa180', '#5abfa6', '#6addcc',
        '#ff6b6b', '#ff8e6b', '#ffb16b', '#ffd46b', '#fff76b',
        '#6b83ff', '#8e6bff', '#b16bff', '#d46bff', '#f76bff'
    ];
    
    let storesToShow = [];
    if (selectedStore === 'all') {
        storesToShow = ALL_STORES;
    } else {
        storesToShow = [selectedStore];
    }
    
    storesToShow.forEach((store, index) => {
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
                    default:
                        value = storeData.approved || 0;
                }
            }
            
            data.push(value);
            currentDate.setDate(currentDate.getDate() + 1);
            dataIndex++;
        }
        
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
        default:
            label += `₱${value.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} (approved only)`;
    }
    
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
    
    const dailyRateEl = Performance.getElement('#dailyRate');
    if (dailyRateEl) {
        const totalStores = storeEntries.length;
        const activeStores = storeEntries.filter(([store, data]) => {
            return data.periodReportCount > 0;
        }).length;
        
        const dailyRate = totalStores > 0 ? Math.round((activeStores / totalStores) * 100) : 0;
        dailyRateEl.textContent = `${dailyRate}%`;
    }
    
    const lastUpdatedEl = Performance.getElement('#lastUpdated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = `Updated: ${now.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}`;
    }
    
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
    
    const lastUpdatedEl = Performance.getElement('#lastUpdated');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = `Updated: ${now.toLocaleTimeString('en-US', {hour: '2-digit', minute: '2-digit'})}`;
    }
    
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
// UTILITY FUNCTIONS
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

function hasPendingItems(report) {
    if (!report || report.disposalTypes?.includes('noWaste')) {
        return false;
    }
    
    const expiredItems = report.expiredItems || [];
    const wasteItems = report.wasteItems || [];
    
    for (const item of [...expiredItems, ...wasteItems]) {
        if (!item.approvalStatus || item.approvalStatus === 'pending') {
            return true;
        }
    }
    
    return false;
}

function hasRejectedItems(report) {
    if (!report || report.disposalTypes?.includes('noWaste')) {
        return false;
    }
    
    const expiredItems = report.expiredItems || [];
    const wasteItems = report.wasteItems || [];
    
    for (const item of [...expiredItems, ...wasteItems]) {
        if (item.approvalStatus === 'rejected') {
            return true;
        }
    }
    
    return false;
}

function hasApprovedItems(report) {
    if (!report || report.disposalTypes?.includes('noWaste')) {
        return true;
    }
    
    const expiredItems = report.expiredItems || [];
    const wasteItems = report.wasteItems || [];
    
    for (const item of [...expiredItems, ...wasteItems]) {
        if (item.approvalStatus === 'approved') {
            return true;
        }
    }
    
    return false;
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
// REPORT DETAILS
// ================================
async function viewReportDetails(reportId) {
    if (!isAuthenticated()) {
        showNotification('Please login to view report details', 'error');
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
    
    const deleteReportButton = Performance.getElement('#deleteReportButton');
    if (deleteReportButton) {
        if (isAdmin()) {
            deleteReportButton.style.display = 'inline-block';
            deleteReportButton.onclick = () => openDeleteModal(report);
        } else {
            deleteReportButton.style.display = 'none';
        }
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
    
    if (pendingCount > 0 && !disposalTypes.includes('noWaste') && isAdmin()) {
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
    
    content += ImageManager.displayImagesInItem(item, index, type);
    
    if (item.notes) {
        content += `
            <div style="margin-top: 8px; padding: 8px; background: var(--color-offwhite); border-radius: var(--border-radius); font-size: 11px;">
                <strong>Notes:</strong> ${item.notes}
            </div>
        `;
    }
    
    if (approvalStatus === 'pending' && isAdmin()) {
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
// DELETE FUNCTIONALITY (ADMIN ONLY)
// ================================
async function deleteAllImagesFromReport(report) {
    try {
        const imagesToDelete = [];
        
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
        
        for (const image of imagesToDelete) {
            try {
                await ImageManager.deleteImageFromStorage(image);
                console.log(`Deleted image: ${image.path}`);
            } catch (error) {
                console.warn(`Failed to delete image ${image.path}:`, error);
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
        showNotification('Please login to delete reports', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can delete reports', 'error');
        return;
    }
    
    showLoading(true, 'Deleting report and images...');
    
    try {
        const reportDoc = await db.collection('wasteReports').doc(reportId).get();
        if (!reportDoc.exists) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const report = { id: reportDoc.id, ...reportDoc.data() };
        
        const imagesDeleted = await deleteAllImagesFromReport(report);
        
        await db.collection('wasteReports').doc(reportId).delete();
        
        const index = reportsData.findIndex(r => r.id === reportId);
        if (index !== -1) {
            reportsData.splice(index, 1);
        }
        
        await loadReports();
        
        closeDeleteModal();
        closeDetailsModal();
        
        showNotification(`Report deleted successfully. ${imagesDeleted} images removed from storage.`, 'success');
        
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
        showNotification('Please login to delete reports', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can delete reports', 'error');
        return;
    }
    
    showLoading(true, 'Deleting reports and images...');
    
    try {
        let query = db.collection('wasteReports');
        
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
        
        const batchSize = 5;
        const reports = [];
        
        snapshot.forEach(doc => {
            reports.push({ id: doc.id, ...doc.data() });
        });
        
        for (let i = 0; i < reports.length; i += batchSize) {
            const batch = reports.slice(i, i + batchSize);
            
            const deletePromises = batch.map(async (report) => {
                try {
                    const imagesCount = await deleteAllImagesFromReport(report);
                    deletedImages += imagesCount;
                    
                    await db.collection('wasteReports').doc(report.id).delete();
                    deletedReports++;
                    
                    if (deletedReports % 10 === 0 || deletedReports === totalReports) {
                        showLoading(true, `Deleting ${deletedReports}/${totalReports} reports...`);
                    }
                    
                } catch (error) {
                    console.error(`Error deleting report ${report.id}:`, error);
                }
            });
            
            await Promise.all(deletePromises);
            
            if (i + batchSize < reports.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        
        reportsData = [];
        
        await loadReports();
        
        closeDeleteAllModal();
        
        showNotification(`Deleted ${deletedReports} reports and ${deletedImages} images from storage.`, 'success');
        
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
        showNotification('Please login to delete images', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can delete images', 'error');
        return;
    }
    
    showLoading(true, 'Deleting image...');
    
    try {
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
        
        await ImageManager.deleteImageFromStorage(imageToDelete);
        
        item.documentation.splice(imageIndex, 1);
        
        const field = itemType === 'expired' ? 'expiredItems' : 'wasteItems';
        await db.collection('wasteReports').doc(reportId).update({
            [field]: items
        });
        
        showNotification('Image deleted successfully', 'success');
        
        if (currentReportDetailsId === reportId) {
            await viewReportDetails(reportId);
        }
        
        loadReports();
        
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
    if (!isAdmin()) {
        showNotification('Only administrators can delete reports', 'error');
        return;
    }
    
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
        showNotification('Please login to delete reports', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can delete reports', 'error');
        return;
    }
    
    const deleteAllCount = Performance.getElement('#deleteAllCount');
    const deleteAllConfirmation = Performance.getElement('#deleteAllConfirmation');
    const confirmDeleteAllButton = Performance.getElement('#confirmDeleteAllButton');
    const applyFiltersCheckbox = Performance.getElement('#applyFiltersToDeleteAll');
    
    if (deleteAllCount) {
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
// REPORTS LOADING
// ================================
async function loadReports() {
    if (isDataLoading) return;
    
    if (!isAuthenticated()) {
        showNotification('Please login to view reports', 'error');
        return;
    }
    
    isDataLoading = true;
    showLoading(true, 'Loading reports...');
    
    try {
        reportsData = [];
        const tableBody = Performance.getElement('#reportsTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        const storeFilter = Performance.getElement('#filterStore');
        const dateFromFilter = Performance.getElement('#filterDateFrom');
        const dateToFilter = Performance.getElement('#filterDateTo');
        const searchInput = Performance.getElement('#searchInput');
        const typeFilter = Performance.getElement('#filterType');
        const filterStatus = Performance.getElement('#filterStatus');
        
        let query = db.collection('wasteReports');
        
        if (storeFilter?.value) {
            query = query.where('store', '==', storeFilter.value);
        }
        
        query = query.orderBy('submittedAt', 'desc');
        
        const snapshot = await query.get();
        
        filteredReportsData = [];
        const allReports = [];
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const report = { 
                id: doc.id, 
                ...data,
                disposalTypes: Array.isArray(data.disposalTypes) ? data.disposalTypes : 
                            data.disposalType ? [data.disposalType] : ['unknown']
            };
            allReports.push(report);
            
            const searchMatch = !searchInput?.value || 
                            (report.reportId && report.reportId.toLowerCase().includes(searchInput.value.toLowerCase())) ||
                            (report.email && report.email.toLowerCase().includes(searchInput.value.toLowerCase())) ||
                            (report.personnel && report.personnel.toLowerCase().includes(searchInput.value.toLowerCase())) ||
                            (report.store && report.store.toLowerCase().includes(searchInput.value.toLowerCase()));
            
            const typeMatch = !typeFilter?.value || 
                            report.disposalTypes.includes(typeFilter.value);
            
            let statusMatch = true;
            if (filterStatus?.value) {
                const approvalStatus = getReportApprovalStatus(report);
                
                if (filterStatus.value === 'pending') {
                    statusMatch = hasPendingItems(report);
                } else if (filterStatus.value === 'rejected') {
                    statusMatch = hasRejectedItems(report);
                } else if (filterStatus.value === 'complete') {
                    statusMatch = approvalStatus === 'complete';
                } else if (filterStatus.value === 'partial') {
                    statusMatch = approvalStatus === 'partial';
                }
            }
            
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
                filteredReportsData.push(report);
            }
        });
        
        allReportsData = allReports;
        totalFilteredCount = filteredReportsData.length;
        
        const totalPages = Math.ceil(totalFilteredCount / pageSize);
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = Math.min(startIndex + pageSize, totalFilteredCount);
        
        const pageReports = filteredReportsData.slice(startIndex, endIndex);
        
        const fragment = document.createDocumentFragment();
        
        pageReports.forEach(report => {
            reportsData.push(report);
            const row = createTableRow(report);
            fragment.appendChild(row);
        });
        
        if (fragment.childNodes.length > 0) {
            tableBody.appendChild(fragment);
        } else {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="11" class="empty-state">
                        <i class="fas fa-inbox"></i>
                        <h3>No reports found</h3>
                        <p>Try changing your filters or submit a new report.</p>
                    </td>
                </tr>
            `;
        }
        
        updateStatisticsFromAllReports();
        
        updatePageInfo();
        updatePaginationButtons();
        
        if (currentPage === 1) {
            setTimeout(() => {
                loadAllReportsForChart();
            }, 100);
        }
        
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
    const totalCost = calculateReportCost(report);
    const approvedCost = calculateApprovedReportCost(report);
    const costCellClass = getCostCellClass(totalCost);
    
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
    
    let actionsColumn = '';
    if (isAdmin()) {
        actionsColumn = `
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
    } else {
        actionsColumn = `
            <td>
                <div style="display: flex; gap: 4px;">
                    <button class="view-details-btn" onclick="viewReportDetails('${report.id}')" title="${imageCount > 0 ? `View (${imageCount} images)` : 'View'}">
                        <i class="fas fa-eye"></i> View
                    </button>
                </div>
            </td>
        `;
    }
    
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
        <td>${getApprovalStatusBadge(report)}</td>
        ${actionsColumn}
    `;
    
    return row;
}

function updatePageInfo() {
    const pageInfo = Performance.getElement('#pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage} of ${Math.ceil(totalFilteredCount / pageSize)}`;
    }
    
    const showingCount = Performance.getElement('#showingCount');
    const totalFilteredCountEl = Performance.getElement('#totalFilteredCount');
    
    if (showingCount) {
        showingCount.textContent = reportsData.length;
    }
    
    if (totalFilteredCountEl) {
        totalFilteredCountEl.textContent = totalFilteredCount;
    }
}

function updatePaginationButtons() {
    const prevBtn = Performance.getElement('#prevPageBtn');
    const nextBtn = Performance.getElement('#nextPageBtn');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        const totalPages = Math.ceil(totalFilteredCount / pageSize);
        nextBtn.disabled = currentPage >= totalPages;
    }
}

function changePage(direction) {
    currentPage += direction;
    if (currentPage < 1) currentPage = 1;
    
    const totalPages = Math.ceil(totalFilteredCount / pageSize);
    if (currentPage > totalPages) currentPage = totalPages;
    
    loadReports();
}

// ================================
// FILTERS
// ================================
function debounceApplyFilters() {
    Performance.debounce(() => {
        currentPage = 1;
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
    loadReports();
}

// ================================
// APPROVAL & REJECTION FUNCTIONS
// ================================
async function approveItem(reportId, itemIndex, itemType) {
    if (!isAuthenticated()) {
        showNotification('Please login to approve items', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can approve items', 'error');
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
            approvedBy: currentUser?.email || 'Administrator',
            rejectionReason: null
        };
        
        const field = itemType === 'expired' ? 'expiredItems' : 'wasteItems';
        await docRef.update({ [field]: items });
        
        showNotification('Item approved successfully', 'success');
        
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
        showNotification('Please login to reject items', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can reject items', 'error');
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
        
        const uniqueItemId = `${reportId}_${itemType}_${itemIndex}_${Date.now()}`;
        
        items[itemIndex] = {
            ...items[itemIndex],
            approvalStatus: 'rejected',
            rejectedAt: new Date().toISOString(),
            rejectedBy: currentUser?.email || 'Administrator',
            rejectionReason: reason.trim(),
            itemId: uniqueItemId,
            canResubmit: true
        };
        
        const field = itemType === 'expired' ? 'expiredItems' : 'wasteItems';
        await docRef.update({ [field]: items });
        
        showNotification('Item rejected successfully', 'success');
        
        updateReportAfterApproval(reportId);
        
        await sendRejectionEmailViaGAS(
            report.email, 
            report.reportId || reportId, 
            itemIndex, 
            itemType, 
            reason.trim(), 
            report, 
            uniqueItemId
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
        showNotification('Please login to approve items', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can approve items', 'error');
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
                    approvedBy: currentUser?.email || 'Administrator',
                    rejectionReason: null
                };
            }
            return item;
        });
        
        const field = itemType === 'expired' ? 'expiredItems' : 'wasteItems';
        await docRef.update({ [field]: updatedItems });
        
        showNotification('All pending items approved successfully', 'success');
        
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
        showNotification('Please login to reject items', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can reject items', 'error');
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
                const uniqueItemId = `${reportId}_${itemType}_${index}_${Date.now()}`;
                
                rejectedItems.push({
                    item: item,
                    index: index,
                    itemId: uniqueItemId
                });
                
                return {
                    ...item,
                    approvalStatus: 'rejected',
                    rejectedAt: new Date().toISOString(),
                    rejectedBy: currentUser?.email || 'Administrator',
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
        
        updateReportAfterApproval(reportId);
        
        await sendBulkRejectionEmailViaGAS(
            report.email, 
            report.reportId || reportId, 
            rejectedItems.length, 
            reason.trim(), 
            report
        );
        
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
        
        if (currentReportDetailsId === reportId) {
            await viewReportDetails(reportId);
        }
        
        if (allReportsData.length > 0) {
            updateStatisticsFromAllReports();
        }
        
        setTimeout(() => {
            loadAllReportsForChart();
        }, 500);
        
    } catch (error) {
        console.error('Error updating UI after approval:', error);
        loadReports();
    }
}

// ================================
// REJECTION MODAL FUNCTIONS
// ================================
function openRejectionModal(itemInfo, reportId, itemIndex, itemType) {
    if (!isAdmin()) {
        showNotification('Only administrators can reject items', 'error');
        return;
    }
    
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
    if (!isAdmin()) {
        showNotification('Only administrators can reject items', 'error');
        return;
    }
    
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
async function sendRejectionEmailViaGAS(toEmail, reportId, itemIndex, itemType, reason, reportData, itemId) {
    try {
        const itemsArray = itemType === 'expired' ? reportData.expiredItems : reportData.wasteItems;
        const rejectedItem = itemsArray[itemIndex];
        
        const editLink = `https://waste-disposal-six.vercel.app/submit_waste_report.html`;
        
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
            itemId: itemId,
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
        showNotification('Please login to export reports', 'error');
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
            const typeFilter = Performance.getElement('#filterType');
            const filterStatus = Performance.getElement('#filterStatus');
            
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
        
        if (type === 'current') {
            const storeFilter = Performance.getElement('#filterStore');
            const dateFromFilter = Performance.getElement('#filterDateFrom');
            const dateToFilter = Performance.getElement('#filterDateTo');
            const typeFilter = Performance.getElement('#filterType');
            const filterStatus = Performance.getElement('#filterStatus');
            const searchInput = Performance.getElement('#searchInput');
            
            reports = reports.filter(report => {
                let isValid = true;
                
                if (storeFilter?.value && report.store !== storeFilter.value) {
                    isValid = false;
                }
                
                if (dateFromFilter?.value || dateToFilter?.value) {
                    const reportDate = new Date(report.reportDate);
                    
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
                }
                
                if (typeFilter?.value) {
                    const disposalTypes = report.disposalTypes;
                    if (!disposalTypes.includes(typeFilter.value)) {
                        isValid = false;
                    }
                }
                
                if (filterStatus?.value) {
                    const approvalStatus = getReportApprovalStatus(report);
                    
                    if (filterStatus.value === 'pending') {
                        isValid = hasPendingItems(report);
                    } else if (filterStatus.value === 'rejected') {
                        isValid = hasRejectedItems(report);
                    } else if (filterStatus.value === 'complete') {
                        isValid = approvalStatus === 'complete';
                    } else if (filterStatus.value === 'partial') {
                        isValid = approvalStatus === 'partial';
                    }
                }
                
                if (searchInput?.value) {
                    const searchTerm = searchInput.value.toLowerCase();
                    const searchMatch = 
                        (report.reportId && report.reportId.toLowerCase().includes(searchTerm)) ||
                        (report.email && report.email.toLowerCase().includes(searchTerm)) ||
                        (report.personnel && report.personnel.toLowerCase().includes(searchTerm)) ||
                        (report.store && report.store.toLowerCase().includes(searchTerm));
                    
                    if (!searchMatch) {
                        isValid = false;
                    }
                }
                
                return isValid;
            });
        }
        
        if (reports.length === 0) {
            showNotification('No reports match your filters for export', 'warning');
            return;
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
        showNotification('Please login to export reports', 'error');
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
        
        data.push([
            'Report ID', 'Store', 'Personnel', 'Date', 'Type', 'Email', 
            'Submitted At', 'Total Items', 'At-Cost (₱)', 'Approval Status',
            'Item Type', 'Item Name', 'Item Cost (₱)', 'Quantity', 'Unit',
            'Total Item Cost (₱)', 'Approval Status', 'Reason/Expiration Date',
            'Manufactured Date', 'Delivered Date', 'Notes'
        ]);
        
        reports.forEach(report => {
            const disposalTypes = Array.isArray(report.disposalTypes) ? report.disposalTypes.join(', ') : report.disposalType;
            const totalItems = (report.expiredItems?.length || 0) + (report.wasteItems?.length || 0);
            const approvalStatus = getReportApprovalStatus(report);
            const totalCost = calculateReportCost(report);
            const baseReportData = [
                report.reportId || report.id,
                report.store || 'N/A',
                report.personnel || 'N/A',
                formatDate(report.reportDate),
                disposalTypes,
                report.email || 'N/A',
                formatDateTime(report.submittedAt),
                totalItems,
                totalCost.toFixed(2),
                approvalStatus
            ];
            
            if (report.expiredItems && report.expiredItems.length > 0) {
                report.expiredItems.forEach((item, index) => {
                    const itemCost = item.itemCost || 0;
                    const quantity = item.quantity || 0;
                    const itemTotalCost = itemCost * quantity;
                    
                    const row = [
                        ...baseReportData,
                        'EXPIRED',
                        item.item || 'N/A',
                        itemCost.toFixed(2),
                        quantity,
                        item.unit || 'units',
                        itemTotalCost.toFixed(2),
                        item.approvalStatus || 'pending',
                        formatDate(item.expirationDate) || 'N/A',
                        formatDate(item.manufacturedDate) || 'N/A',
                        formatDate(item.deliveredDate) || 'N/A',
                        item.notes || ''
                    ];
                    data.push(row);
                });
            }
            
            if (report.wasteItems && report.wasteItems.length > 0) {
                report.wasteItems.forEach((item, index) => {
                    const itemCost = item.itemCost || 0;
                    const quantity = item.quantity || 0;
                    const itemTotalCost = itemCost * quantity;
                    
                    const row = [
                        ...baseReportData,
                        'WASTE',
                        item.item || 'N/A',
                        itemCost.toFixed(2),
                        quantity,
                        item.unit || 'units',
                        itemTotalCost.toFixed(2),
                        item.approvalStatus || 'pending',
                        item.reason || 'N/A',
                        'N/A',
                        'N/A',
                        item.notes || ''
                    ];
                    data.push(row);
                });
            }
            
            if (report.disposalTypes?.includes('noWaste') || 
                (totalItems === 0 && !report.expiredItems?.length && !report.wasteItems?.length)) {
                const row = [
                    ...baseReportData,
                    'NO WASTE',
                    'No items to report',
                    '0.00',
                    '0',
                    'N/A',
                    '0.00',
                    'approved',
                    'No waste reported',
                    'N/A',
                    'N/A',
                    report.notes || ''
                ];
                data.push(row);
            }
        });
        
        const ws = XLSX.utils.aoa_to_sheet(data);
        
        const colWidths = [
            { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
            { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
            { wch: 12 }, { wch: 30 }, { wch: 15 }, { wch: 10 }, { wch: 10 },
            { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 },
            { wch: 30 }
        ];
        ws['!cols'] = colWidths;
        
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Reports');
        
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        
        const blob = new Blob([wbout], { type: 'application/octet-stream' });
        saveAs(blob, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
        
        showNotification(`Export completed successfully. ${data.length - 1} rows exported.`, 'success');
        
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
        showNotification('Please login to manage items', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can manage items', 'error');
        return;
    }
    
    const itemsModal = Performance.getElement('#itemsManagementModal');
    if (itemsModal) {
        itemsModal.style.display = 'flex';
        // Reset to regular items view
        const typeSelect = Performance.getElement('#itemTypeSelect');
        if (typeSelect) typeSelect.value = 'regular';
        currentItemType = 'regular';
        itemsCurrentPage = 1;
        itemsLastVisibleDoc = null;
        loadItems();
        updateItemCounts();
    }
}

function closeItemsManagement() {
    const itemsModal = Performance.getElement('#itemsManagementModal');
    if (itemsModal) {
        itemsModal.style.display = 'none';
        // Reset search when closing
        const searchInput = Performance.getElement('#searchItems');
        if (searchInput) searchInput.value = '';
    }
}

async function updateItemCounts() {
    try {
        // Get regular items count
        const regularSnapshot = await db.collection('items')
            .where('category', '==', 'regular')
            .get();
        regularItemsCount = regularSnapshot.size;
        
        // Get kitchen items count
        const kitchenSnapshot = await db.collection('items')
            .where('category', '==', 'kitchen')
            .get();
        kitchenItemsCount = kitchenSnapshot.size;
        
        // Update UI
        const totalEl = Performance.getElement('#totalItemsCount');
        const kitchenEl = Performance.getElement('#kitchenItemsCount');
        
        if (totalEl) totalEl.textContent = regularItemsCount;
        if (kitchenEl) kitchenEl.textContent = kitchenItemsCount;
        
    } catch (error) {
        console.error('Error updating item counts:', error);
    }
}

// ================================
// UPDATED ITEMS MANAGEMENT FUNCTIONS - COMPLETE FIX
// ================================

async function loadItems() {
    if (!isAuthenticated()) return;
    
    showLoading(true, 'Loading items...');
    
    try {
        const searchTerm = document.getElementById('searchItems')?.value || '';
        currentItemType = document.getElementById('itemTypeSelect')?.value || 'regular';
        
        // Update badge
        const badge = document.getElementById('itemTypeBadge');
        if (badge) {
            if (currentItemType === 'regular') {
                badge.innerHTML = '<i class="fas fa-box"></i> Store Items';
                badge.style.background = 'var(--color-primary)';
            } else {
                badge.innerHTML = '<i class="fas fa-utensils"></i> Kitchen Items';
                badge.style.background = '#856404';
            }
        }
        
        // Get ALL items of the selected category first (without pagination)
        let query = db.collection('items').where('category', '==', currentItemType);
        
        const snapshot = await query.get();
        
        // Convert to array and filter by search term (case insensitive, contains anywhere)
        let allItems = [];
        snapshot.forEach(doc => {
            const item = { id: doc.id, ...doc.data() };
            allItems.push(item);
        });
        
        // Apply search filter if there's a search term
        let filteredItems = allItems;
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase().trim();
            filteredItems = allItems.filter(item => {
                // Check if item name contains the search term anywhere (case insensitive)
                return item.name && item.name.toLowerCase().includes(searchLower);
            });
        }
        
        // Sort alphabetically
        filteredItems.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        
        // Update total counts for both categories (for the stats cards)
        await updateItemCounts();
        
        // Apply pagination to filtered results
        const startIndex = (itemsCurrentPage - 1) * itemsPageSize;
        const endIndex = startIndex + itemsPageSize;
        const pageItems = filteredItems.slice(startIndex, endIndex);
        
        itemsData = pageItems;
        
        // Store whether there are more pages
        itemsLastVisibleDoc = endIndex < filteredItems.length;
        
        // Render the items
        renderItemsTable(itemsData);
        
        // Update UI elements
        const showingEl = document.getElementById('showingItemsCount');
        if (showingEl) {
            showingEl.textContent = itemsData.length;
        }
        
        // Update page info
        const pageInfo = document.getElementById('itemsPageInfo');
        if (pageInfo) {
            const totalPages = Math.ceil(filteredItems.length / itemsPageSize) || 1;
            pageInfo.textContent = `Page ${itemsCurrentPage} of ${totalPages}`;
        }
        
        // Update pagination buttons
        const prevBtn = document.getElementById('prevItemsPageBtn');
        const nextBtn = document.getElementById('nextItemsPageBtn');
        
        if (prevBtn) {
            prevBtn.disabled = itemsCurrentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = endIndex >= filteredItems.length;
        }
        
        // Update category item count display
        const categoryCountEl = document.getElementById('categoryItemCount');
        if (categoryCountEl) {
            const totalInCategory = currentItemType === 'regular' ? regularItemsCount : kitchenItemsCount;
            const showingCount = itemsData.length;
            const filteredTotal = filteredItems.length;
            
            if (searchTerm) {
                categoryCountEl.innerHTML = `<i class="fas fa-search"></i> Found ${filteredTotal} of ${totalInCategory} ${currentItemType} items (showing ${showingCount})`;
            } else {
                categoryCountEl.innerHTML = `<i class="fas fa-database"></i> Showing ${showingCount} of ${totalInCategory} ${currentItemType} items`;
            }
        }
        
    } catch (error) {
        console.error('Error loading items:', error);
        showNotification('Error loading items: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// Helper function to render items table
function renderItemsTable(items) {
    const tableBody = document.getElementById('itemsTableBody');
    if (!tableBody) return;
    
    const fragment = document.createDocumentFragment();
    
    items.forEach(item => {
        const row = document.createElement('tr');
        const categoryIcon = item.category === 'kitchen' ? '🍳' : '📦';
        const categoryName = item.category === 'kitchen' ? 'Kitchen' : 'Regular';
        
        row.innerHTML = `
            <td><strong>${escapeHtml(item.name)}</strong></td>
            <td>
                <div style="color: #28a745; font-weight: bold; font-size: 14px;">
                    ₱${(item.cost || 0).toFixed(2)}
                </div>
            </td>
            <td>
                <span style="background: ${item.category === 'kitchen' ? '#fff3cd' : '#e8f5e9'}; color: ${item.category === 'kitchen' ? '#856404' : '#2e7d32'}; padding: 3px 8px; border-radius: 12px; font-size: 10px; font-weight: 500;">
                    ${categoryIcon} ${categoryName}
                </span>
            </td>
            <td><small style="color: var(--color-gray);">${formatDate(item.createdAt)}</small></td>
            <td>
                <div class="item-actions">
                    <button class="item-action-btn edit-item-btn" onclick="openEditItemModal('${item.id}', '${escapeHtml(item.name).replace(/'/g, "\\'")}', ${item.cost || 0}, '${item.category || 'regular'}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="item-action-btn delete-item-btn" onclick="deleteItem('${item.id}', '${escapeHtml(item.name).replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </td>
        `;
        
        fragment.appendChild(row);
    });
    
    tableBody.innerHTML = '';
    tableBody.appendChild(fragment);
    
    if (items.length === 0) {
        const searchTerm = document.getElementById('searchItems')?.value;
        const searchMessage = searchTerm ? ` matching "${searchTerm}"` : '';
        
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 40px; color: var(--color-gray);">
                    <i class="fas ${currentItemType === 'kitchen' ? 'fa-utensils' : 'fa-box-open'}" style="font-size: 24px; margin-bottom: 10px;"></i>
                    <p>No ${currentItemType} items${searchMessage} found.</p>
                    <p style="font-size: 11px; margin-top: 5px;">Add your first ${currentItemType} item using the form above.</p>
                </td>
            </tr>
        `;
    }
}

// Update the item counts function to get totals for both categories
async function updateItemCounts() {
    try {
        // Get regular items count (all)
        const regularSnapshot = await db.collection('items')
            .where('category', '==', 'regular')
            .get();
        regularItemsCount = regularSnapshot.size;
        
        // Get kitchen items count (all)
        const kitchenSnapshot = await db.collection('items')
            .where('category', '==', 'kitchen')
            .get();
        kitchenItemsCount = kitchenSnapshot.size;
        
        // Update UI with total counts
        const regularTotalEl = document.getElementById('totalRegularItemsCount');
        const kitchenTotalEl = document.getElementById('totalKitchenItemsCount');
        
        if (regularTotalEl) regularTotalEl.textContent = regularItemsCount;
        if (kitchenTotalEl) kitchenTotalEl.textContent = kitchenItemsCount;
        
    } catch (error) {
        console.error('Error updating item counts:', error);
    }
}

// Helper function to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update pagination functions
function changeItemsPage(direction) {
    itemsCurrentPage += direction;
    loadItems();
}

// Update search input handler
function setupItemTypeListener() {
    const itemTypeSelect = document.getElementById('itemTypeSelect');
    if (itemTypeSelect) {
        itemTypeSelect.addEventListener('change', function() {
            currentItemType = this.value;
            itemsCurrentPage = 1;
            loadItems();
        });
    }
    
    const searchItemsInput = document.getElementById('searchItems');
    if (searchItemsInput) {
        searchItemsInput.addEventListener('input', Performance.debounce(() => {
            itemsCurrentPage = 1;
            loadItems();
        }, 300, 'itemsSearch'));
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
        showNotification('Please login to add items', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can add items', 'error');
        return;
    }
    
    const nameInput = Performance.getElement('#newItemName');
    const costInput = Performance.getElement('#newItemCost');
    const itemTypeSelect = Performance.getElement('#itemTypeSelect');
    
    const name = nameInput?.value.trim();
    const cost = parseFloat(costInput?.value) || 0;
    const category = itemTypeSelect?.value || 'regular';
    
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
        // Check if item exists in the same category
        const existingQuery = await db.collection('items')
            .where('nameLowerCase', '==', name.toLowerCase())
            .where('category', '==', category)
            .limit(1)
            .get();
        
        if (!existingQuery.empty) {
            showNotification(`${category === 'kitchen' ? 'Kitchen' : 'Regular'} item already exists in database`, 'error');
            return;
        }
        
        const newItem = {
            name: name,
            nameLowerCase: name.toLowerCase(),
            cost: cost,
            category: category,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.email || 'Administrator',
            updatedAt: new Date().toISOString(),
            usageCount: 0
        };
        
        await db.collection('items').add(newItem);
        
        showNotification(`${category === 'kitchen' ? 'Kitchen' : 'Regular'} item added successfully`, 'success');
        
        if (nameInput) nameInput.value = '';
        if (costInput) costInput.value = '0';
        
        await loadItems();
        await updateItemCounts();
        
    } catch (error) {
        console.error('Error adding item:', error);
        showNotification('Error adding item: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function openEditItemModal(itemId, name, cost = 0, category = 'regular') {
    if (!isAdmin()) {
        showNotification('Only administrators can edit items', 'error');
        return;
    }
    
    currentEditItemId = itemId;
    
    const nameInput = Performance.getElement('#editItemName');
    const costInput = Performance.getElement('#editItemCost');
    const categorySelect = Performance.getElement('#editItemCategory');
    const itemInfo = Performance.getElement('#editItemInfo');
    
    if (nameInput) nameInput.value = name;
    if (costInput) costInput.value = cost;
    if (categorySelect) categorySelect.value = category;
    if (itemInfo) {
        itemInfo.innerHTML = `Editing ${category === 'kitchen' ? 'kitchen' : 'regular'} item: <strong>${name}</strong>`;
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
    
    if (!isAdmin()) {
        showNotification('Only administrators can edit items', 'error');
        return;
    }
    
    const nameInput = Performance.getElement('#editItemName');
    const costInput = Performance.getElement('#editItemCost');
    const categorySelect = Performance.getElement('#editItemCategory');
    
    const name = nameInput?.value.trim();
    const cost = parseFloat(costInput?.value) || 0;
    const category = categorySelect?.value || 'regular';
    
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
        // Check if item name exists in the same category (excluding current item)
        const existingQuery = await db.collection('items')
            .where('nameLowerCase', '==', name.toLowerCase())
            .where('category', '==', category)
            .limit(1)
            .get();
        
        let exists = false;
        existingQuery.forEach(doc => {
            if (doc.id !== currentEditItemId) {
                exists = true;
            }
        });
        
        if (exists) {
            showNotification(`Item name already exists in ${category} category`, 'error');
            return;
        }
        
        const updates = {
            name: name,
            nameLowerCase: name.toLowerCase(),
            cost: cost,
            category: category,
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser?.email || 'Administrator'
        };
        
        await db.collection('items').doc(currentEditItemId).update(updates);
        
        showNotification('Item updated successfully', 'success');
        closeEditItemModal();
        await loadItems();
        await updateItemCounts();
        
    } catch (error) {
        console.error('Error updating item:', error);
        showNotification('Error updating item: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteItem(itemId, itemName) {
    if (!isAuthenticated()) {
        showNotification('Please login to delete items', 'error');
        return;
    }
    
    if (!isAdmin()) {
        showNotification('Only administrators can delete items', 'error');
        return;
    }
    
    if (!confirm(`Are you sure you want to delete "${itemName}"?\n\nThis action cannot be undone.`)) {
        return;
    }
    
    showLoading(true, 'Deleting item...');
    
    try {
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
        await loadItems();
        await updateItemCounts();
        
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

// Migration function to update existing items with category
async function migrateItemsToCategories() {
    if (!isAdmin()) return;
    
    try {
        const snapshot = await db.collection('items').get();
        const batch = db.batch();
        let updatedCount = 0;
        
        snapshot.forEach(doc => {
            const item = doc.data();
            if (!item.category) {
                // Assume existing items are regular items
                batch.update(doc.ref, { category: 'regular' });
                updatedCount++;
            }
        });
        
        if (updatedCount > 0) {
            await batch.commit();
            console.log(`Migrated ${updatedCount} items to have category field`);
        }
    } catch (error) {
        console.error('Error migrating items:', error);
    }
}

// Setup item type change listener
function setupItemTypeListener() {
    const itemTypeSelect = Performance.getElement('#itemTypeSelect');
    if (itemTypeSelect) {
        itemTypeSelect.addEventListener('change', function() {
            currentItemType = this.value;
            itemsCurrentPage = 1;
            itemsLastVisibleDoc = null;
            loadItems();
        });
    }
}

// ================================
// EVENT LISTENERS
// ================================
function setupEventListeners() {
    // Auth section
    const logoutButton = Performance.getElement('#logoutButton');
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);
    
    const loginEmail = Performance.getElement('#loginEmail');
    const loginPassword = Performance.getElement('#loginPassword');
    
    if (loginEmail && loginPassword) {
        loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }
    
    // Create Account Modal listeners
    setupCreateAccountModalListeners();
    
    // Create Account button
    const createAccountButton = Performance.getElement('#createAccountButton');
    if (createAccountButton) {
        createAccountButton.addEventListener('click', openCreateAccountModal);
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
    
    // Statistics filter
    const statsPeriodFilter = Performance.getElement('#statsPeriodFilter');
    if (statsPeriodFilter) {
        statsPeriodFilter.addEventListener('change', function() {
            changeStatsPeriod(this.value);
        });
    }
    
    // Reports filters
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
    
    // Item type selector
    setupItemTypeListener();
    
    // Edit item modal
    const closeEditItemModalBtn = Performance.getElement('#closeEditItemModal');
    const cancelEditItemButton = Performance.getElement('#cancelEditItemButton');
    const saveItemButton = Performance.getElement('#saveItemButton');
    
    if (closeEditItemModalBtn) closeEditItemModalBtn.addEventListener('click', closeEditItemModal);
    if (cancelEditItemButton) cancelEditItemButton.addEventListener('click', closeEditItemModal);
    if (saveItemButton) saveItemButton.addEventListener('click', saveItemChanges);
    
    // Report details modal
    const closeDetailsModalBtn = Performance.getElement('#closeDetailsModal');
    
    if (closeDetailsModalBtn) closeDetailsModalBtn.addEventListener('click', closeDetailsModal);
    
    // Image modal
    const closeImageModalBtn = Performance.getElement('#closeImageModal');
    
    if (closeImageModalBtn) closeImageModalBtn.addEventListener('click', ImageManager.closeModal);
    
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
                else if (modal.id === 'createAccountModal') closeCreateAccountModal();
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
            closeCreateAccountModal();
        }
    });
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
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.togglePassword = togglePassword;
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
window.refreshStatistics = refreshStatistics;
window.changeStatsPeriod = changeStatsPeriod;
window.isAdmin = isAdmin;
window.handleAdminCreateAccount = handleAdminCreateAccount;
window.openCreateAccountModal = openCreateAccountModal;
window.closeCreateAccountModal = closeCreateAccountModal;