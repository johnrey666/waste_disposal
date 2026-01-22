// ================================
// CONFIGURATION
// ================================

// Google Apps Script endpoint for email (same as submit form)
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
const pageSize = 10;
let lastVisibleDoc = null;
let firstVisibleDoc = null;
let reportsData = [];
let allReportsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000;

// State variables
let currentRejectionData = null;
let currentBulkRejectionData = null;
let currentReportDetailsId = null;

// ================================
// AUTHENTICATION FUNCTIONS
// ================================
function authenticate(enteredPassword) {
    if (!enteredPassword) return false;
    
    if (enteredPassword === CORRECT_PASSWORD) {
        localStorage.setItem(PASSWORD_KEY, JSON.stringify({
            authenticated: true,
            timestamp: Date.now()
        }));
        return true;
    }
    return false;
}

function isAuthenticated() {
    const authData = localStorage.getItem(PASSWORD_KEY);
    if (!authData) return false;
    
    try {
        const { authenticated, timestamp } = JSON.parse(authData);
        const now = Date.now();
        return authenticated && (now - timestamp) < SESSION_TIMEOUT;
    } catch (error) {
        localStorage.removeItem(PASSWORD_KEY);
        return false;
    }
}

function lockSession() {
    localStorage.removeItem(PASSWORD_KEY);
}

function checkPassword() {
    const passwordInput = document.getElementById('password');
    if (!passwordInput) {
        console.error('Password input not found');
        return;
    }
    
    const enteredPassword = passwordInput.value.trim();
    
    if (!enteredPassword) {
        showNotification('Please enter the password', 'error');
        passwordInput.focus();
        return;
    }
    
    if (authenticate(enteredPassword)) {
        showNotification('Access granted! Loading reports...', 'success');
        
        const passwordSection = document.getElementById('passwordSection');
        const reportsSection = document.getElementById('reportsSection');
        const statisticsSection = document.getElementById('statisticsSection');
        
        if (passwordSection) passwordSection.style.display = 'none';
        if (reportsSection) reportsSection.style.display = 'block';
        if (statisticsSection) statisticsSection.style.display = 'block';
        
        passwordInput.value = '';
        
        setTimeout(() => {
            loadReports();
        }, 500);
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
    
    const passwordSection = document.getElementById('passwordSection');
    const reportsSection = document.getElementById('reportsSection');
    const statisticsSection = document.getElementById('statisticsSection');
    
    if (passwordSection) passwordSection.style.display = 'block';
    if (reportsSection) reportsSection.style.display = 'none';
    if (statisticsSection) statisticsSection.style.display = 'none';
    
    showNotification('Session locked. Enter password to access again.', 'info');
    
    const passwordInput = document.getElementById('password');
    if (passwordInput) {
        passwordInput.focus();
    }
}

// ================================
// INITIALIZATION
// ================================
function initializeApp() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        db = firebase.firestore();
        console.log('✅ Firebase initialized successfully');
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        showNotification('Firebase connection failed. Please check console.', 'error');
    }
    
    if (isAuthenticated()) {
        showReportsSection();
        setTimeout(() => {
            loadReports();
        }, 1000);
    } else {
        showPasswordSection();
    }
}

function showPasswordSection() {
    const passwordSection = document.getElementById('passwordSection');
    if (passwordSection) {
        passwordSection.style.display = 'block';
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.focus();
        }
    }
}

function showReportsSection() {
    const passwordSection = document.getElementById('passwordSection');
    const reportsSection = document.getElementById('reportsSection');
    const statisticsSection = document.getElementById('statisticsSection');
    
    if (passwordSection) passwordSection.style.display = 'none';
    if (reportsSection) reportsSection.style.display = 'block';
    if (statisticsSection) statisticsSection.style.display = 'block';
}

// ================================
// UTILITY FUNCTIONS
// ================================
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.style.display = 'block';
    
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
    }
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}

function formatDateTime(timestamp) {
    if (!timestamp) return 'N/A';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (error) {
        return 'Invalid Date';
    }
}

function getDisposalTypeBadge(type) {
    switch(type) {
        case 'expired': return '<span class="type-badge type-expired"><i class="fas fa-calendar-times"></i> Expired Items</span>';
        case 'waste': return '<span class="type-badge type-waste"><i class="fas fa-trash-alt"></i> Waste</span>';
        case 'noWaste': return '<span class="type-badge type-noWaste"><i class="fas fa-check-circle"></i> No Waste</span>';
        default: return '<span class="type-badge">Unknown</span>';
    }
}

function getReportApprovalStatus(report) {
    if (!report) return 'pending';
    
    if (report.disposalType === 'noWaste') {
        return 'complete';
    }
    
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let totalItems = 0;
    
    if (report.disposalType === 'expired' && Array.isArray(report.expiredItems)) {
        totalItems = report.expiredItems.length;
        report.expiredItems.forEach(item => {
            if (item.approvalStatus === 'approved') approvedCount++;
            else if (item.approvalStatus === 'rejected') rejectedCount++;
            else pendingCount++;
        });
    } else if (report.disposalType === 'waste' && Array.isArray(report.wasteItems)) {
        totalItems = report.wasteItems.length;
        report.wasteItems.forEach(item => {
            if (item.approvalStatus === 'approved') approvedCount++;
            else if (item.approvalStatus === 'rejected') rejectedCount++;
            else pendingCount++;
        });
    }
    
    if (totalItems === 0) return 'complete';
    if (pendingCount === totalItems) return 'pending';
    if (approvedCount === totalItems) return 'complete';
    if (rejectedCount === totalItems) return 'complete';
    return 'partial';
}

function getApprovalStatusBadge(report) {
    const status = getReportApprovalStatus(report);
    
    switch(status) {
        case 'pending':
            return '<span class="item-approval-status status-pending"><i class="fas fa-clock"></i> Pending</span>';
        case 'complete':
            return '<span class="item-approval-status status-approved"><i class="fas fa-check-circle"></i> Approved</span>';
        case 'partial':
            return '<span class="item-approval-status status-partial"><i class="fas fa-exclamation-circle"></i> Partial</span>';
        default:
            return '<span class="item-approval-status status-pending"><i class="fas fa-clock"></i> Pending</span>';
    }
}

// ================================
// REPORTS LOADING FUNCTIONS
// ================================
async function loadReports() {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to view reports', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        if (!db) {
            throw new Error('Firebase not initialized');
        }
        
        reportsData = [];
        const tableBody = document.getElementById('reportsTableBody');
        if (!tableBody) {
            throw new Error('Table body not found');
        }
        
        tableBody.innerHTML = '';
        
        const storeFilter = document.getElementById('filterStore');
        const typeFilter = document.getElementById('filterType');
        const dateFilter = document.getElementById('filterDate');
        const searchEmail = document.getElementById('searchEmail');
        const filterStatus = document.getElementById('filterStatus');
        
        let query = db.collection('wasteReports');
        
        if (storeFilter && storeFilter.value) {
            query = query.where('store', '==', storeFilter.value);
        }
        
        if (typeFilter && typeFilter.value) {
            query = query.where('disposalType', '==', typeFilter.value);
        }
        
        if (dateFilter && dateFilter.value) {
            query = query.where('reportDate', '==', dateFilter.value);
        }
        
        query = query.orderBy('submittedAt', 'desc');
        
        if (currentPage > 1 && lastVisibleDoc) {
            query = query.startAfter(lastVisibleDoc);
        }
        
        query = query.limit(pageSize);
        
        const snapshot = await query.get();
        
        if (!snapshot.empty) {
            firstVisibleDoc = snapshot.docs[0];
            lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
        } else {
            firstVisibleDoc = null;
            lastVisibleDoc = null;
        }
        
        let expiredCount = 0;
        let wasteCount = 0;
        let noWasteCount = 0;
        let pendingApprovalCount = 0;
        
        snapshot.forEach(doc => {
            const report = { id: doc.id, ...doc.data() };
            reportsData.push(report);
            
            if (report.disposalType === 'expired') expiredCount++;
            else if (report.disposalType === 'waste') wasteCount++;
            else if (report.disposalType === 'noWaste') noWasteCount++;
            
            if (getReportApprovalStatus(report) === 'pending') pendingApprovalCount++;
            
            let displayId = report.reportId || report.id;
            let itemCount = 0;
            
            if (report.disposalType === 'expired' && Array.isArray(report.expiredItems)) {
                itemCount = report.expiredItems.length;
            } else if (report.disposalType === 'waste' && Array.isArray(report.wasteItems)) {
                itemCount = report.wasteItems.length;
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <div class="report-id">${displayId.substring(0, 12)}${displayId.length > 12 ? '...' : ''}</div>
                </td>
                <td><strong>${report.store || 'N/A'}</strong></td>
                <td>${report.personnel || 'N/A'}</td>
                <td><strong>${formatDate(report.reportDate)}</strong></td>
                <td>${getDisposalTypeBadge(report.disposalType)}</td>
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
                <td><span class="status-badge status-submitted">Submitted</span></td>
                <td>${getApprovalStatusBadge(report)}</td>
                <td>
                    <button class="view-details-btn" onclick="viewReportDetails('${report.id}')" title="View full report">
                        <i class="fas fa-eye"></i> View
                    </button>
                </td>
            `;
            tableBody.appendChild(row);
        });
        
        if (reportsData.length === 0) {
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
        
        updateStatistics(reportsData.length, expiredCount, wasteCount, noWasteCount, pendingApprovalCount);
        updatePageInfo();
        updatePaginationButtons();
        
    } catch (error) {
        console.error('Error loading reports:', error);
        showNotification('Error loading reports: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function updateStatistics(total, expired, waste, noWaste, pending = 0) {
    const totalEl = document.getElementById('totalReports');
    const expiredEl = document.getElementById('expiredCount');
    const wasteEl = document.getElementById('wasteCount');
    const noWasteEl = document.getElementById('noWasteCount');
    const pendingEl = document.getElementById('pendingApprovalCount');
    
    if (totalEl) totalEl.textContent = total.toLocaleString();
    if (expiredEl) expiredEl.textContent = expired.toLocaleString();
    if (wasteEl) wasteEl.textContent = waste.toLocaleString();
    if (noWasteEl) noWasteEl.textContent = noWaste.toLocaleString();
    if (pendingEl) pendingEl.textContent = pending.toLocaleString();
}

function updatePageInfo() {
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `Page ${currentPage}`;
    }
    
    const showingCount = document.getElementById('showingCount');
    if (showingCount) {
        showingCount.textContent = reportsData.length;
    }
}

function updatePaginationButtons() {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
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
// FILTER FUNCTIONS
// ================================
function applyFilters() {
    currentPage = 1;
    lastVisibleDoc = null;
    firstVisibleDoc = null;
    loadReports();
}

function clearFilters() {
    const storeFilter = document.getElementById('filterStore');
    const typeFilter = document.getElementById('filterType');
    const dateFilter = document.getElementById('filterDate');
    const searchEmail = document.getElementById('searchEmail');
    const filterStatus = document.getElementById('filterStatus');
    
    if (storeFilter) storeFilter.value = '';
    if (typeFilter) typeFilter.value = '';
    if (dateFilter) dateFilter.value = '';
    if (searchEmail) searchEmail.value = '';
    if (filterStatus) filterStatus.value = '';
    
    applyFilters();
}

// ================================
// REPORT DETAILS FUNCTIONS
// ================================
async function viewReportDetails(reportId) {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to view report details', 'error');
        return;
    }
    
    showLoading(true);
    
    try {
        currentReportDetailsId = reportId;
        
        const doc = await db.collection('wasteReports').doc(reportId).get();
        
        if (!doc.exists) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const report = { id: doc.id, ...doc.data() };
        buildModalContent(report);
        
        const detailsModal = document.getElementById('detailsModal');
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

function buildModalContent(report) {
    const modalContent = document.getElementById('modalContent');
    if (!modalContent) return;
    
    let approvedCount = 0;
    let rejectedCount = 0;
    let pendingCount = 0;
    let totalItems = 0;
    
    if (report.disposalType === 'expired' && Array.isArray(report.expiredItems)) {
        totalItems = report.expiredItems.length;
        report.expiredItems.forEach(item => {
            if (item.approvalStatus === 'approved') approvedCount++;
            else if (item.approvalStatus === 'rejected') rejectedCount++;
            else pendingCount++;
        });
    } else if (report.disposalType === 'waste' && Array.isArray(report.wasteItems)) {
        totalItems = report.wasteItems.length;
        report.wasteItems.forEach(item => {
            if (item.approvalStatus === 'approved') approvedCount++;
            else if (item.approvalStatus === 'rejected') rejectedCount++;
            else pendingCount++;
        });
    }
    
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
                    <div class="detail-label">Disposal Type</div>
                    <div class="detail-value">${getDisposalTypeBadge(report.disposalType)}</div>
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
    
    if (pendingCount > 0 && report.disposalType !== 'noWaste') {
        content += `
            <div class="bulk-approval-section">
                <h4><i class="fas fa-bolt"></i> Bulk Actions</h4>
                <p>Approve or reject all pending items at once:</p>
                <div class="bulk-approval-actions">
                    <button class="bulk-approval-btn bulk-approve-btn" onclick="bulkApproveItems('${report.id}', '${report.disposalType}')">
                        <i class="fas fa-check"></i> Approve All Pending
                    </button>
                    <button class="bulk-approval-btn bulk-reject-btn" onclick="openBulkRejectionModal('${report.id}', ${pendingCount}, '${report.disposalType}')">
                        <i class="fas fa-times"></i> Reject All Pending
                    </button>
                </div>
            </div>
        `;
    }
    
    content += `</div>`;
    
    if (report.disposalType === 'expired' && Array.isArray(report.expiredItems)) {
        content += buildExpiredItemsContent(report);
    } else if (report.disposalType === 'waste' && Array.isArray(report.wasteItems)) {
        content += buildWasteItemsContent(report);
    } else if (report.disposalType === 'noWaste') {
        content += buildNoWasteContent();
    }
    
    modalContent.innerHTML = content;
}

function buildExpiredItemsContent(report) {
    let content = `
        <div class="details-section">
            <h3><i class="fas fa-boxes"></i> Expired Items (${report.expiredItems.length})</h3>
            <div class="item-list">
    `;
    
    report.expiredItems.forEach((item, index) => {
        const approvalStatus = item.approvalStatus || 'pending';
        const statusClass = `status-${approvalStatus}`;
        const statusIcon = approvalStatus === 'approved' ? 'fa-check-circle' : 
                         approvalStatus === 'rejected' ? 'fa-times-circle' : 'fa-clock';
        
        content += `
            <div class="item-list-item">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <div>
                        <strong>Item ${index + 1}: ${item.item || 'N/A'}</strong>
                        <span class="item-approval-status ${statusClass}" style="margin-left: 8px;">
                            <i class="fas ${statusIcon}"></i> ${approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
                        </span>
                    </div>
                    <span style="background: #fff3cd; color: #856404; padding: 2px 8px; border-radius: 10px; font-size: 11px;">
                        ${item.quantity || 0} ${item.unit || 'units'}
                    </span>
                </div>
                <div style="font-size: 12px; color: var(--color-gray); margin-bottom: 8px;">
                    <div>Delivered: ${formatDate(item.deliveredDate)}</div>
                    <div>Manufactured: ${formatDate(item.manufacturedDate)}</div>
                    <div>Expired: ${formatDate(item.expirationDate)}</div>
                </div>
        `;
        
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
        
        if (item.documentation && Array.isArray(item.documentation)) {
            content += buildDocumentationContent(item.documentation);
        }
        
        if (item.notes) {
            content += `
                <div style="margin-top: 8px; padding: 8px; background: var(--color-offwhite); border-radius: var(--border-radius); font-size: 11px;">
                    <strong>Notes:</strong> ${item.notes}
                </div>
            `;
        }
        
        if (approvalStatus === 'pending') {
            content += `
                <div class="approval-actions">
                    <button class="approve-btn" onclick="approveItem('${report.id}', ${index}, 'expired')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="reject-btn" onclick="openRejectionModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${report.id}', ${index}, 'expired')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            `;
        }
        
        content += `</div>`;
    });
    
    content += `</div></div>`;
    return content;
}

function buildWasteItemsContent(report) {
    let content = `
        <div class="details-section">
            <h3><i class="fas fa-trash-alt"></i> Waste Items (${report.wasteItems.length})</h3>
            <div class="item-list">
    `;
    
    report.wasteItems.forEach((item, index) => {
        const approvalStatus = item.approvalStatus || 'pending';
        const statusClass = `status-${approvalStatus}`;
        const statusIcon = approvalStatus === 'approved' ? 'fa-check-circle' : 
                         approvalStatus === 'rejected' ? 'fa-times-circle' : 'fa-clock';
        
        content += `
            <div class="item-list-item">
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                    <div>
                        <strong>Item ${index + 1}: ${item.item || 'N/A'}</strong>
                        <span class="item-approval-status ${statusClass}" style="margin-left: 8px;">
                            <i class="fas ${statusIcon}"></i> ${approvalStatus.charAt(0).toUpperCase() + approvalStatus.slice(1)}
                        </span>
                    </div>
                    <span style="background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 10px; font-size: 11px;">
                        ${item.quantity || 0} ${item.unit || 'units'}
                    </span>
                </div>
                <div style="font-size: 12px; color: var(--color-gray); margin-bottom: 8px;">
                    <div>Reason: ${item.reason || 'N/A'}</div>
                </div>
        `;
        
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
        
        if (item.documentation && Array.isArray(item.documentation)) {
            content += buildDocumentationContent(item.documentation);
        }
        
        if (item.notes) {
            content += `
                <div style="margin-top: 8px; padding: 8px; background: var(--color-offwhite); border-radius: var(--border-radius); font-size: 11px;">
                    <strong>Notes:</strong> ${item.notes}
                </div>
            `;
        }
        
        if (approvalStatus === 'pending') {
            content += `
                <div class="approval-actions">
                    <button class="approve-btn" onclick="approveItem('${report.id}', ${index}, 'waste')">
                        <i class="fas fa-check"></i> Approve
                    </button>
                    <button class="reject-btn" onclick="openRejectionModal(${JSON.stringify(item).replace(/"/g, '&quot;')}, '${report.id}', ${index}, 'waste')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                </div>
            `;
        }
        
        content += `</div>`;
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

function buildDocumentationContent(docs) {
    let content = `
        <div style="margin-top: 8px;">
            <div style="font-size: 11px; color: var(--color-gray); margin-bottom: 4px;">Documentation (${docs.length} files):</div>
            <div class="image-gallery">
    `;
    
    docs.forEach((doc, docIndex) => {
        if (doc.type && doc.type.startsWith('image/')) {
            content += `
                <img src="data:${doc.type};base64,${doc.base64}" 
                     alt="Document ${docIndex + 1}" 
                     class="image-thumbnail"
                     onclick="viewImage('data:${doc.type};base64,${doc.base64}')"
                     style="cursor: pointer;">
            `;
        } else {
            content += `
                <div style="width: 80px; height: 80px; background: var(--color-offwhite); border-radius: var(--border-radius); display: flex; align-items: center; justify-content: center; border: var(--border-base);">
                    <i class="fas fa-file-pdf" style="font-size: 24px; color: var(--color-primary);"></i>
                </div>
            `;
        }
    });
    
    content += `</div></div>`;
    return content;
}

function closeDetailsModal() {
    const detailsModal = document.getElementById('detailsModal');
    if (detailsModal) {
        detailsModal.style.display = 'none';
    }
    currentReportDetailsId = null;
}

function viewImage(src) {
    const imageModal = document.getElementById('imageModal');
    const modalImage = document.getElementById('modalImage');
    
    if (imageModal && modalImage) {
        modalImage.src = src;
        imageModal.style.display = 'flex';
    }
}

function closeImageModal() {
    const imageModal = document.getElementById('imageModal');
    if (imageModal) {
        imageModal.style.display = 'none';
    }
}

// ================================
// APPROVAL & REJECTION FUNCTIONS
// ================================
async function approveItem(reportId, itemIndex, itemType) {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to approve items', 'error');
        return;
    }
    
    showLoading(true);
    
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
        
        if (currentReportDetailsId === reportId) {
            await viewReportDetails(reportId);
        } else {
            loadReports();
        }
        
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
    
    showLoading(true);
    
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
        
        if (currentReportDetailsId === reportId) {
            await viewReportDetails(reportId);
        } else {
            loadReports();
        }
        
        const emailResult = await sendRejectionEmailViaGAS(report.email, report.reportId || reportId, itemIndex + 1, itemType, reason.trim(), report);
        if (!emailResult.success) {
            showNotification('Item rejected, but rejection email failed to send.', 'warning');
        }
        
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
    
    showLoading(true);
    
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
        
        if (currentReportDetailsId === reportId) {
            await viewReportDetails(reportId);
        } else {
            loadReports();
        }
        
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
    
    showLoading(true);
    
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
        
        if (currentReportDetailsId === reportId) {
            await viewReportDetails(reportId);
        } else {
            loadReports();
        }
        
        const emailResult = await sendBulkRejectionEmailViaGAS(report.email, report.reportId || reportId, updatedItems.filter(i => i.approvalStatus === 'rejected').length, reason.trim(), report);
        if (!emailResult.success) {
            showNotification('Items rejected, but email failed to send.', 'warning');
        }
        
    } catch (error) {
        console.error('Error bulk rejecting items:', error);
        showNotification('Error bulk rejecting items: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ================================
// REJECTION MODAL FUNCTIONS
// ================================
function openRejectionModal(itemInfo, reportId, itemIndex, itemType) {
    currentRejectionData = { reportId, itemIndex, itemType };
    
    const rejectionItemInfo = document.getElementById('rejectionItemInfo');
    if (rejectionItemInfo) {
        rejectionItemInfo.innerHTML = `
            <p><strong>Item:</strong> ${itemInfo.item || 'N/A'}</p>
            <p><strong>Quantity:</strong> ${itemInfo.quantity || 0} ${itemInfo.unit || 'units'}</p>
            ${itemType === 'expired' ? `<p><strong>Expiration:</strong> ${formatDate(itemInfo.expirationDate)}</p>` : ''}
            ${itemType === 'waste' ? `<p><strong>Reason for Waste:</strong> ${itemInfo.reason || 'N/A'}</p>` : ''}
        `;
    }
    
    const rejectionReason = document.getElementById('rejectionReason');
    if (rejectionReason) {
        rejectionReason.value = '';
        document.getElementById('rejectionCharCount').textContent = '0/500 characters';
    }
    
    const rejectionModal = document.getElementById('rejectionModal');
    if (rejectionModal) {
        rejectionModal.style.display = 'flex';
        rejectionReason.focus();
    }
}

function closeRejectionModal() {
    currentRejectionData = null;
    const rejectionModal = document.getElementById('rejectionModal');
    if (rejectionModal) {
        rejectionModal.style.display = 'none';
    }
}

function openBulkRejectionModal(reportId, itemCount, itemType) {
    currentBulkRejectionData = { reportId, itemType };
    
    const bulkItemsCount = document.getElementById('bulkItemsCount');
    const bulkReportId = document.getElementById('bulkReportId');
    if (bulkItemsCount) bulkItemsCount.textContent = itemCount;
    if (bulkReportId) bulkReportId.textContent = reportId;
    
    const bulkRejectionReason = document.getElementById('bulkRejectionReason');
    if (bulkRejectionReason) {
        bulkRejectionReason.value = '';
        document.getElementById('bulkRejectionCharCount').textContent = '0/500 characters';
    }
    
    const bulkRejectionModal = document.getElementById('bulkRejectionModal');
    if (bulkRejectionModal) {
        bulkRejectionModal.style.display = 'flex';
        bulkRejectionReason.focus();
    }
}

function closeBulkRejectionModal() {
    currentBulkRejectionData = null;
    const bulkRejectionModal = document.getElementById('bulkRejectionModal');
    if (bulkRejectionModal) {
        bulkRejectionModal.style.display = 'none';
    }
}

function handleItemRejection(reason) {
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

function handleBulkItemRejection(reason) {
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
// EMAIL SENDING WITH FULL FALLBACK
// ================================
async function sendRejectionEmailViaGAS(toEmail, reportId, itemNumber, itemType, reason, reportData) {
    try {
        const itemsArray = itemType === 'expired' ? reportData.expiredItems : reportData.wasteItems;
        const rejectedItem = itemsArray[itemNumber - 1];

        const emailData = {
            emailType: 'rejection',  // Triggers red template
            to: toEmail,
            subject: `Waste Report Item Rejected - ${reportId}`,
            store: reportData.store || 'N/A',
            personnel: reportData.personnel || 'Team Member',
            reportDate: formatDate(reportData.reportDate) || 'N/A',
            disposalType: reportData.disposalType.toUpperCase(),
            reportId: reportId,
            itemName: rejectedItem?.item || 'N/A',
            itemQuantity: rejectedItem?.quantity || 0,
            itemUnit: rejectedItem?.unit || 'units',
            itemReason: itemType === 'waste' ? rejectedItem?.reason || 'N/A' : 'N/A',
            expirationDate: itemType === 'expired' ? formatDate(rejectedItem?.expirationDate) : 'N/A',
            rejectionReason: reason,
            rejectedAt: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };

        // Method 1: FormData POST
        try {
            const formData = new FormData();
            formData.append('data', JSON.stringify(emailData));
            
            const response = await fetch(GAS_CONFIG.ENDPOINT, {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                console.log('Rejection email sent via POST');
                return { success: true };
            }
        } catch (err) {
            console.log('POST failed, trying GET fallback...', err);
        }

        // Method 2: GET fallback
        try {
            const params = new URLSearchParams(emailData);
            await fetch(`${GAS_CONFIG.ENDPOINT}?${params.toString()}`, { mode: 'no-cors' });
            console.log('Rejection email sent via GET fallback');
            return { success: true };
        } catch (err) {
            console.log('GET fallback failed, trying iframe...');
        }

        // Method 3: Iframe fallback
        return new Promise(resolve => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.name = 'rejectionIframe';
            
            const form = document.createElement('form');
            form.target = 'rejectionIframe';
            form.method = 'POST';
            form.action = GAS_CONFIG.ENDPOINT;
            
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'data';
            input.value = JSON.stringify(emailData);
            form.appendChild(input);
            
            document.body.appendChild(iframe);
            document.body.appendChild(form);
            
            setTimeout(() => {
                document.body.removeChild(iframe);
                document.body.removeChild(form);
                console.log('Rejection email sent via iframe fallback');
                resolve({ success: true });
            }, 2000);
            
            form.submit();
        });

    } catch (error) {
        console.error('All rejection email methods failed:', error);
        return { success: false };
    }
}

async function sendBulkRejectionEmailViaGAS(toEmail, reportId, rejectedCount, reason, reportData) {
    try {
        const emailData = {
            emailType: 'rejection',
            to: toEmail,
            subject: `Multiple Items Rejected - ${reportId}`,
            store: reportData.store || 'N/A',
            personnel: reportData.personnel || 'Team Member',
            reportDate: formatDate(reportData.reportDate) || 'N/A',
            disposalType: reportData.disposalType.toUpperCase(),
            reportId: reportId,
            rejectedCount: rejectedCount,
            rejectionReason: reason,
            rejectedAt: new Date().toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
        };

        // Same 3-step fallback
        try {
            const formData = new FormData();
            formData.append('data', JSON.stringify(emailData));
            const response = await fetch(GAS_CONFIG.ENDPOINT, {
                method: 'POST',
                body: formData
            });
            if (response.ok) return { success: true };
        } catch (err) {}

        try {
            const params = new URLSearchParams(emailData);
            await fetch(`${GAS_CONFIG.ENDPOINT}?${params.toString()}`, { mode: 'no-cors' });
            return { success: true };
        } catch (err) {}

        return new Promise(resolve => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.name = 'bulkRejectionIframe';
            
            const form = document.createElement('form');
            form.target = 'bulkRejectionIframe';
            form.method = 'POST';
            form.action = GAS_CONFIG.ENDPOINT;
            
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'data';
            input.value = JSON.stringify(emailData);
            form.appendChild(input);
            
            document.body.appendChild(iframe);
            document.body.appendChild(form);
            
            setTimeout(() => {
                document.body.removeChild(iframe);
                document.body.removeChild(form);
                resolve({ success: true });
            }, 2000);
            
            form.submit();
        });

    } catch (error) {
        console.error('Bulk rejection email failed:', error);
        return { success: false };
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
        
        showNotification('Export feature is being implemented...', 'info');
        
    } catch (error) {
        console.error('Error exporting reports:', error);
        showNotification('Error exporting reports: ' + error.message, 'error');
    }
}

function showExportDate() {
    const exportDateContainer = document.getElementById('exportDateContainer');
    if (exportDateContainer) {
        exportDateContainer.style.display = 'block';
        const exportDateInput = document.getElementById('exportDate');
        if (exportDateInput) {
            const today = new Date().toISOString().split('T')[0];
            exportDateInput.value = today;
        }
    }
}

function hideExportDate() {
    const exportDateContainer = document.getElementById('exportDateContainer');
    if (exportDateContainer) {
        exportDateContainer.style.display = 'none';
    }
}

async function exportReportsByDate() {
    if (!isAuthenticated()) {
        showNotification('Please authenticate to export reports', 'error');
        return;
    }
    
    const exportDateEl = document.getElementById('exportDate');
    const exportDate = exportDateEl ? exportDateEl.value : '';
    
    if (!exportDate) {
        showNotification('Please select a date for export', 'error');
        return;
    }
    
    showNotification('Export by date feature is being implemented...', 'info');
    hideExportDate();
}

// ================================
// EVENT LISTENERS SETUP
// ================================
function setupEventListeners() {
    const passwordInput = document.getElementById('password');
    const accessButton = document.getElementById('accessButton');
    const lockButton = document.getElementById('lockButton');
    
    if (passwordInput && accessButton) {
        passwordInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                checkPassword();
            }
        });
        
        accessButton.addEventListener('click', checkPassword);
    }
    
    if (lockButton) {
        lockButton.addEventListener('click', lockReports);
    }
    
    const closeDetailsModalBtn = document.getElementById('closeDetailsModal');
    const closeModalButton = document.getElementById('closeModalButton');
    const closeImageModalBtn = document.getElementById('closeImageModal');
    const closeImageModalButton = document.getElementById('closeImageModalButton');
    const closeRejectionModalBtn = document.getElementById('closeRejectionModal');
    const cancelRejectionButton = document.getElementById('cancelRejectionButton');
    const closeBulkRejectionModalBtn = document.getElementById('closeBulkRejectionModal');
    const cancelBulkRejectionButton = document.getElementById('cancelBulkRejectionButton');
    const confirmRejectionButton = document.getElementById('confirmRejectionButton');
    const confirmBulkRejectionButton = document.getElementById('confirmBulkRejectionButton');
    
    if (closeDetailsModalBtn) closeDetailsModalBtn.addEventListener('click', closeDetailsModal);
    if (closeModalButton) closeModalButton.addEventListener('click', closeDetailsModal);
    if (closeImageModalBtn) closeImageModalBtn.addEventListener('click', closeImageModal);
    if (closeImageModalButton) closeImageModalButton.addEventListener('click', closeImageModal);
    if (closeRejectionModalBtn) closeRejectionModalBtn.addEventListener('click', closeRejectionModal);
    if (cancelRejectionButton) cancelRejectionButton.addEventListener('click', closeRejectionModal);
    if (closeBulkRejectionModalBtn) closeBulkRejectionModalBtn.addEventListener('click', closeBulkRejectionModal);
    if (cancelBulkRejectionButton) cancelBulkRejectionButton.addEventListener('click', closeBulkRejectionModal);
    
    const rejectionReason = document.getElementById('rejectionReason');
    if (rejectionReason) {
        rejectionReason.addEventListener('input', function() {
            const charCount = this.value.length;
            document.getElementById('rejectionCharCount').textContent = 
                `${Math.min(charCount, 500)}/500 characters`;
            if (charCount > 500) {
                this.value = this.value.substring(0, 500);
            }
        });
    }
    
    if (confirmRejectionButton) {
        confirmRejectionButton.addEventListener('click', function() {
            const reason = document.getElementById('rejectionReason').value.trim();
            if (!reason) {
                showNotification('Please provide a reason for rejection', 'error');
                return;
            }
            handleItemRejection(reason);
        });
    }
    
    const bulkRejectionReason = document.getElementById('bulkRejectionReason');
    if (bulkRejectionReason) {
        bulkRejectionReason.addEventListener('input', function() {
            const charCount = this.value.length;
            document.getElementById('bulkRejectionCharCount').textContent = 
                `${Math.min(charCount, 500)}/500 characters`;
            if (charCount > 500) {
                this.value = this.value.substring(0, 500);
            }
        });
    }
    
    if (confirmBulkRejectionButton) {
        confirmBulkRejectionButton.addEventListener('click', function() {
            const reason = document.getElementById('bulkRejectionReason').value.trim();
            if (!reason) {
                showNotification('Please provide a reason for rejection', 'error');
                return;
            }
            handleBulkItemRejection(reason);
        });
    }
    
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
    
    const exportDateButton = document.getElementById('exportDateButton');
    const cancelExportDate = document.getElementById('cancelExportDate');
    
    if (exportDateButton) exportDateButton.addEventListener('click', exportReportsByDate);
    if (cancelExportDate) cancelExportDate.addEventListener('click', hideExportDate);
    
    const searchEmail = document.getElementById('searchEmail');
    const filterStore = document.getElementById('filterStore');
    const filterType = document.getElementById('filterType');
    const filterDate = document.getElementById('filterDate');
    const filterStatus = document.getElementById('filterStatus');
    const clearFiltersBtn = document.getElementById('clearFilters');
    
    if (searchEmail) searchEmail.addEventListener('input', applyFilters);
    if (filterStore) filterStore.addEventListener('change', applyFilters);
    if (filterType) filterType.addEventListener('change', applyFilters);
    if (filterDate) filterDate.addEventListener('change', applyFilters);
    if (filterStatus) filterStatus.addEventListener('change', applyFilters);
    if (clearFiltersBtn) clearFiltersBtn.addEventListener('click', clearFilters);
    
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => changePage(-1));
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => changePage(1));
    
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === this) {
                if (this.id === 'detailsModal') closeDetailsModal();
                else if (this.id === 'imageModal') closeImageModal();
                else if (this.id === 'rejectionModal') closeRejectionModal();
                else if (this.id === 'bulkRejectionModal') closeBulkRejectionModal();
            }
        });
    });
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeDetailsModal();
            closeImageModal();
            closeRejectionModal();
            closeBulkRejectionModal();
        }
    });
    
    setInterval(() => {
        if (!isAuthenticated()) {
            const reportsSection = document.getElementById('reportsSection');
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
document.addEventListener('DOMContentLoaded', function() {
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