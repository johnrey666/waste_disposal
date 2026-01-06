// ================================
// FIREBASE CONFIGURATION
// ================================
const firebaseConfig = {
    apiKey: "AIzaSyAyp2f1b6cG4E_Dx9eako31LgTDuZrZ8_E",
    authDomain: "disposal-e6b83.firebaseapp.com",
    projectId: "disposal-e6b83",
    storageBucket: "disposal-e6b83.firebasestorage.app",
    messagingSenderId: "1050986320678",
    appId: "1:1050986320678:web:deb5f4c58c3ef0cbc6a7e7",
    measurementId: "G-3Q7705T5FE"
};

// Initialize Firebase
let db;
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

// ================================
// GLOBAL VARIABLES
// ================================
let currentPage = 1;
const pageSize = 10;
let lastVisibleDoc = null;
let firstVisibleDoc = null;
let reportsData = [];
let allReportsCache = null; // Cache for client-side filtering
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

// ================================
// HELPER FUNCTIONS
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
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function getDisposalTypeBadge(type) {
    switch(type) {
        case 'expired': return '<span class="type-badge type-expired">Expired Items</span>';
        case 'waste': return '<span class="type-badge type-waste">Waste</span>';
        case 'noWaste': return '<span class="type-badge type-noWaste">No Waste</span>';
        default: return '<span class="type-badge">Unknown</span>';
    }
}

// ================================
// FORM FUNCTIONS
// ================================
function toggleDynamicFields() {
    const disposalType = document.querySelector('input[name="disposalType"]:checked');
    if (!disposalType) return;
    
    const expiredContainer = document.getElementById('expiredContainer');
    const wasteContainer = document.getElementById('wasteContainer');
    
    // Hide both containers
    if (expiredContainer) expiredContainer.classList.remove('show');
    if (wasteContainer) wasteContainer.classList.remove('show');
    
    // Clear fields
    const expiredFields = document.getElementById('expiredFields');
    const wasteFields = document.getElementById('wasteFields');
    if (expiredFields) expiredFields.innerHTML = '';
    if (wasteFields) wasteFields.innerHTML = '';
    
    // Show appropriate container
    if (disposalType.value === 'expired') {
        if (expiredContainer) {
            expiredContainer.classList.add('show');
            if (expiredFields && expiredFields.querySelectorAll('.field-group').length === 0) {
                addExpiredItem();
            }
        }
    } else if (disposalType.value === 'waste') {
        if (wasteContainer) {
            wasteContainer.classList.add('show');
            if (wasteFields && wasteFields.querySelectorAll('.field-group').length === 0) {
                addWasteItem();
            }
        }
    }
}

// Convert file to Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve({
            name: file.name,
            type: file.type,
            size: file.size,
            base64: reader.result.split(',')[1],
            dataUrl: reader.result
        });
        reader.onerror = error => reject(error);
    });
}

// Create file preview
function createFilePreview(fileInput, previewContainerId) {
    const files = fileInput.files;
    const previewContainer = document.getElementById(previewContainerId);
    
    if (!previewContainer) return;
    
    // Clear existing preview
    previewContainer.innerHTML = '';
    
    // Create preview for each file
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const previewItem = document.createElement('div');
        previewItem.className = 'file-preview-item';
        previewItem.dataset.index = i;
        
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            previewItem.appendChild(img);
        } else if (file.type === 'application/pdf') {
            previewItem.className += ' pdf-file';
            previewItem.innerHTML = '📄 PDF';
        } else {
            previewItem.className += ' pdf-file';
            previewItem.innerHTML = '📄 Doc';
        }
        
        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-file';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeFileFromInput(fileInput, i);
        };
        previewItem.appendChild(removeBtn);
        
        previewContainer.appendChild(previewItem);
    }
    
    // Show file info
    if (files.length > 0) {
        const totalSize = Array.from(files).reduce((total, file) => total + file.size, 0);
        const sizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        const info = document.createElement('div');
        info.className = 'file-info';
        info.textContent = `${files.length} file(s), ${sizeMB} MB total`;
        previewContainer.appendChild(info);
    }
}

// Remove file from input
function removeFileFromInput(fileInput, index) {
    const files = Array.from(fileInput.files);
    files.splice(index, 1);
    
    // Create new FileList
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;
    
    // Update preview
    const previewContainerId = fileInput.id + '-preview';
    createFilePreview(fileInput, previewContainerId);
    
    // Trigger change event
    fileInput.dispatchEvent(new Event('change'));
}

// Add expired item fields
function addExpiredItem() {
    const expiredFields = document.getElementById('expiredFields');
    if (!expiredFields) return;
    
    const itemId = Date.now() + Math.random().toString(36).substr(2, 9);
    
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';
    fieldGroup.id = `expired-${itemId}`;
    
    // Set today's date for delivered date
    const today = new Date().toISOString().split('T')[0];
    
    fieldGroup.innerHTML = `
        <div class="field-header">
            <div class="field-title">Expired Item</div>
            <button type="button" class="remove-btn" onclick="removeField('expired-${itemId}')">×</button>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="expiredItem-${itemId}">Item Name <span class="required">*</span></label>
                <input type="text" id="expiredItem-${itemId}" name="expiredItems[${itemId}][item]" required placeholder="Enter item name">
            </div>
            <div class="form-group">
                <label for="deliveredDate-${itemId}">Delivered Date <span class="required">*</span></label>
                <input type="date" id="deliveredDate-${itemId}" name="expiredItems[${itemId}][deliveredDate]" required value="${today}">
            </div>
            <div class="form-group">
                <label for="manufacturedDate-${itemId}">Manufactured Date <span class="required">*</span></label>
                <input type="date" id="manufacturedDate-${itemId}" name="expiredItems[${itemId}][manufacturedDate]" required>
            </div>
            <div class="form-group">
                <label for="expirationDate-${itemId}">Expiration Date <span class="required">*</span></label>
                <input type="date" id="expirationDate-${itemId}" name="expiredItems[${itemId}][expirationDate]" required>
            </div>
            <div class="form-group">
                <label for="quantity-${itemId}">Quantity <span class="required">*</span></label>
                <input type="number" id="quantity-${itemId}" name="expiredItems[${itemId}][quantity]" required min="0" step="0.01" placeholder="0.00">
            </div>
            <div class="form-group">
                <label for="unit-${itemId}">Unit of Measure <span class="required">*</span></label>
                <select id="unit-${itemId}" name="expiredItems[${itemId}][unit]" required>
                    <option value="" disabled selected>Select unit</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="L">Liters (L)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="boxes">Boxes</option>
                    <option value="packs">Packs</option>
                    <option value="cans">Cans</option>
                    <option value="bottles">Bottles</option>
                    <option value="bags">Bags</option>
                </select>
            </div>
            <div class="form-group file-upload-container">
                <label for="documentation-${itemId}">Documentation <span class="required">*</span></label>
                <input type="file" id="documentation-${itemId}" name="expiredItems[${itemId}][documentation]" 
                       required accept="image/*,.pdf" multiple 
                       onchange="createFilePreview(this, 'documentation-${itemId}-preview')">
                <div id="documentation-${itemId}-preview" class="file-preview"></div>
                <span class="note">Upload photos or PDFs for this item (Max 5MB per file, 10 files max)</span>
            </div>
            <div class="form-group">
                <label for="notes-${itemId}">Additional Notes</label>
                <textarea id="notes-${itemId}" name="expiredItems[${itemId}][notes]" rows="2" placeholder="Any additional information about this item"></textarea>
            </div>
        </div>
    `;
    
    expiredFields.appendChild(fieldGroup);
}

// Add waste item fields
function addWasteItem() {
    const wasteFields = document.getElementById('wasteFields');
    if (!wasteFields) return;
    
    const itemId = Date.now() + Math.random().toString(36).substr(2, 9);
    
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';
    fieldGroup.id = `waste-${itemId}`;
    
    fieldGroup.innerHTML = `
        <div class="field-header">
            <div class="field-title">Waste Item</div>
            <button type="button" class="remove-btn" onclick="removeField('waste-${itemId}')">×</button>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="wasteItem-${itemId}">Item/Description <span class="required">*</span></label>
                <input type="text" id="wasteItem-${itemId}" name="wasteItems[${itemId}][item]" required placeholder="Enter item or description">
            </div>
            <div class="form-group">
                <label for="reason-${itemId}">Reason for Waste <span class="required">*</span></label>
                <select id="reason-${itemId}" name="wasteItems[${itemId}][reason]" required>
                    <option value="" disabled selected>Select reason</option>
                    <option value="spoilage">Spoilage</option>
                    <option value="preparation_waste">Preparation Waste</option>
                    <option value="damaged">Damaged Packaging</option>
                    <option value="overproduction">Overproduction</option>
                    <option value="customer_return">Customer Return</option>
                    <option value="quality_issue">Quality Issue</option>
                    <option value="other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label for="wasteQuantity-${itemId}">Quantity <span class="required">*</span></label>
                <input type="number" id="wasteQuantity-${itemId}" name="wasteItems[${itemId}][quantity]" required min="0" step="0.01" placeholder="0.00">
            </div>
            <div class="form-group">
                <label for="wasteUnit-${itemId}">Unit of Measure <span class="required">*</span></label>
                <select id="wasteUnit-${itemId}" name="wasteItems[${itemId}][unit]" required>
                    <option value="" disabled selected>Select unit</option>
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kg">Kilograms (kg)</option>
                    <option value="g">Grams (g)</option>
                    <option value="L">Liters (L)</option>
                    <option value="ml">Milliliters (ml)</option>
                    <option value="boxes">Boxes</option>
                    <option value="packs">Packs</option>
                    <option value="cans">Cans</option>
                    <option value="bottles">Bottles</option>
                    <option value="bags">Bags</option>
                </select>
            </div>
            <div class="form-group file-upload-container">
                <label for="wasteDocumentation-${itemId}">Documentation <span class="required">*</span></label>
                <input type="file" id="wasteDocumentation-${itemId}" name="wasteItems[${itemId}][documentation]" 
                       required accept="image/*,.pdf" multiple 
                       onchange="createFilePreview(this, 'wasteDocumentation-${itemId}-preview')">
                <div id="wasteDocumentation-${itemId}-preview" class="file-preview"></div>
                <span class="note">Upload photos or PDFs for this waste item (Max 5MB per file, 10 files max)</span>
            </div>
            <div class="form-group">
                <label for="wasteNotes-${itemId}">Additional Notes</label>
                <textarea id="wasteNotes-${itemId}" name="wasteItems[${itemId}][notes]" rows="2" placeholder="Any additional information about this waste"></textarea>
            </div>
        </div>
    `;
    
    wasteFields.appendChild(fieldGroup);
}

// Remove field group
function removeField(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.remove();
    }
}

// Validate file size and count
function validateFiles(fileInput) {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const maxFiles = 10;
    
    if (fileInput.files.length > maxFiles) {
        return `Maximum ${maxFiles} files allowed`;
    }
    
    for (let file of fileInput.files) {
        if (file.size > maxSize) {
            return `File "${file.name}" exceeds 5MB limit`;
        }
    }
    
    return null;
}

// Form validation for dynamic fields
function validateDynamicFields() {
    const disposalType = document.querySelector('input[name="disposalType"]:checked');
    if (!disposalType) {
        showNotification('Please select a disposal type.', 'error');
        return false;
    }
    
    if (disposalType.value === 'expired') {
        const expiredItems = document.querySelectorAll('#expiredFields .field-group');
        if (expiredItems.length === 0) {
            showNotification('Please add at least one expired item.', 'error');
            return false;
        }
        
        for (let item of expiredItems) {
            const requiredFields = item.querySelectorAll('input[required], select[required]');
            const fileInput = item.querySelector('input[type="file"]');
            
            // Validate required fields
            for (let field of requiredFields) {
                if (!field.value.trim()) {
                    showNotification('Please fill in all required fields for expired items.', 'error');
                    return false;
                }
            }
            
            // Validate files
            if (fileInput) {
                if (fileInput.files.length === 0) {
                    showNotification('Please upload documentation for all expired items.', 'error');
                    return false;
                }
                
                const fileError = validateFiles(fileInput);
                if (fileError) {
                    showNotification(fileError, 'error');
                    return false;
                }
            }
        }
    } else if (disposalType.value === 'waste') {
        const wasteItems = document.querySelectorAll('#wasteFields .field-group');
        if (wasteItems.length === 0) {
            showNotification('Please add at least one waste item.', 'error');
            return false;
        }
        
        for (let item of wasteItems) {
            const requiredFields = item.querySelectorAll('input[required], select[required]');
            const fileInput = item.querySelector('input[type="file"]');
            
            // Validate required fields
            for (let field of requiredFields) {
                if (!field.value.trim()) {
                    showNotification('Please fill in all required fields for waste items.', 'error');
                    return false;
                }
            }
            
            // Validate files
            if (fileInput) {
                if (fileInput.files.length === 0) {
                    showNotification('Please upload documentation for all waste items.', 'error');
                    return false;
                }
                
                const fileError = validateFiles(fileInput);
                if (fileError) {
                    showNotification(fileError, 'error');
                    return false;
                }
            }
        }
    }
    
    return true;
}

// ================================
// FORM SUBMISSION HANDLER
// ================================
async function handleSubmit(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    console.log('Form submission started...');
    
    // Check if Firebase is initialized
    if (!db) {
        showNotification('Error: Firebase not initialized. Cannot submit report.', 'error');
        console.error('Firebase not initialized');
        return;
    }
    
    const submitBtn = document.querySelector('.submit-btn');
    if (!submitBtn) {
        console.error('Submit button not found');
        return;
    }
    
    const originalText = submitBtn.textContent;
    
    // Basic validation
    const requiredFields = ['email', 'store', 'personnel', 'reportDate'];
    for (let field of requiredFields) {
        const fieldElement = document.getElementById(field);
        if (!fieldElement || !fieldElement.value.trim()) {
            showNotification(`Please fill in the ${field} field.`, 'error');
            console.error(`Missing field: ${field}`);
            return;
        }
    }
    
    const disposalType = document.querySelector('input[name="disposalType"]:checked');
    if (!disposalType) {
        showNotification('Please select a disposal type.', 'error');
        console.error('No disposal type selected');
        return;
    }
    
    // Validate dynamic fields
    if (!validateDynamicFields()) {
        console.error('Dynamic field validation failed');
        return;
    }
    
    // Show loading state
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
    showLoading(true);
    
    try {
        // Generate report ID
        const reportId = 'REPORT-' + Date.now().toString();
        
        // Collect form data
        const reportData = {
            email: document.getElementById('email').value.trim(),
            store: document.getElementById('store').value,
            personnel: document.getElementById('personnel').value.trim(),
            reportDate: document.getElementById('reportDate').value,
            disposalType: disposalType.value,
            submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
            reportId: reportId,
            status: 'submitted',
            createdAt: new Date().toISOString()
        };
        
        console.log('Processing report data:', reportData);
        
        // Process based on disposal type
        if (disposalType.value === 'expired') {
            const expiredItems = [];
            const expiredFields = document.querySelectorAll('#expiredFields .field-group');
            
            console.log(`Found ${expiredFields.length} expired items`);
            
            for (let field of expiredFields) {
                const itemId = field.id.split('-')[1];
                const fileInput = document.getElementById(`documentation-${itemId}`);
                
                console.log(`Processing expired item ${itemId} with ${fileInput.files.length} files`);
                
                // Convert files to Base64
                const filesBase64 = [];
                if (fileInput && fileInput.files.length > 0) {
                    for (let i = 0; i < fileInput.files.length; i++) {
                        try {
                            const file = fileInput.files[i];
                            const fileData = await fileToBase64(file);
                            filesBase64.push(fileData);
                            console.log(`Converted file ${i + 1}/${fileInput.files.length}: ${file.name}`);
                        } catch (fileError) {
                            console.error('Error converting file:', fileError);
                        }
                    }
                }
                
                const expiredItem = {
                    item: document.getElementById(`expiredItem-${itemId}`).value.trim(),
                    deliveredDate: document.getElementById(`deliveredDate-${itemId}`).value,
                    manufacturedDate: document.getElementById(`manufacturedDate-${itemId}`).value,
                    expirationDate: document.getElementById(`expirationDate-${itemId}`).value,
                    quantity: parseFloat(document.getElementById(`quantity-${itemId}`).value) || 0,
                    unit: document.getElementById(`unit-${itemId}`).value,
                    documentation: filesBase64,
                    notes: document.getElementById(`notes-${itemId}`).value.trim() || '',
                    itemId: itemId,
                    totalFiles: fileInput ? fileInput.files.length : 0
                };
                
                expiredItems.push(expiredItem);
            }
            
            reportData.expiredItems = expiredItems;
            reportData.totalExpiredItems = expiredItems.length;
            
        } else if (disposalType.value === 'waste') {
            const wasteItems = [];
            const wasteFields = document.querySelectorAll('#wasteFields .field-group');
            
            console.log(`Found ${wasteFields.length} waste items`);
            
            for (let field of wasteFields) {
                const itemId = field.id.split('-')[1];
                const fileInput = document.getElementById(`wasteDocumentation-${itemId}`);
                
                console.log(`Processing waste item ${itemId} with ${fileInput.files.length} files`);
                
                // Convert files to Base64
                const filesBase64 = [];
                if (fileInput && fileInput.files.length > 0) {
                    for (let i = 0; i < fileInput.files.length; i++) {
                        try {
                            const file = fileInput.files[i];
                            const fileData = await fileToBase64(file);
                            filesBase64.push(fileData);
                            console.log(`Converted file ${i + 1}/${fileInput.files.length}: ${file.name}`);
                        } catch (fileError) {
                            console.error('Error converting file:', fileError);
                        }
                    }
                }
                
                const wasteItem = {
                    item: document.getElementById(`wasteItem-${itemId}`).value.trim(),
                    reason: document.getElementById(`reason-${itemId}`).value,
                    quantity: parseFloat(document.getElementById(`wasteQuantity-${itemId}`).value) || 0,
                    unit: document.getElementById(`wasteUnit-${itemId}`).value,
                    documentation: filesBase64,
                    notes: document.getElementById(`wasteNotes-${itemId}`).value.trim() || '',
                    itemId: itemId,
                    totalFiles: fileInput ? fileInput.files.length : 0
                };
                
                wasteItems.push(wasteItem);
            }
            
            reportData.wasteItems = wasteItems;
            reportData.totalWasteItems = wasteItems.length;
        } else if (disposalType.value === 'noWaste') {
            reportData.noWaste = true;
            reportData.notes = "No waste or expired items to report for this period";
        }
        
        // Calculate total data size (for monitoring)
        const reportSize = new TextEncoder().encode(JSON.stringify(reportData)).length;
        reportData.reportSizeKB = Math.round(reportSize / 1024);
        
        console.log('Saving to Firestore:', {
            ...reportData,
            documentation: '[...file data hidden...]'
        });
        
        // Save to Firestore
        const docRef = db.collection('wasteReports').doc(reportId);
        await docRef.set(reportData);
        
        console.log('✅ Report saved to Firestore with ID:', reportId);
        
        // Clear cache since we have new data
        allReportsCache = null;
        cacheTimestamp = null;
        
        // Show success message
        showNotification('Report submitted successfully!', 'success');
        
        // Reset form
        const form = document.getElementById('wasteReportForm');
        if (form) {
            form.reset();
            
            // Set default date to today
            const today = new Date().toISOString().split('T')[0];
            const reportDateInput = document.getElementById('reportDate');
            if (reportDateInput) {
                reportDateInput.value = today;
            }
            
            // Clear dynamic fields
            const expiredFields = document.getElementById('expiredFields');
            const wasteFields = document.getElementById('wasteFields');
            if (expiredFields) expiredFields.innerHTML = '';
            if (wasteFields) wasteFields.innerHTML = '';
            
            // Hide containers
            const expiredContainer = document.getElementById('expiredContainer');
            const wasteContainer = document.getElementById('wasteContainer');
            if (expiredContainer) expiredContainer.classList.remove('show');
            if (wasteContainer) wasteContainer.classList.remove('show');
        }
        
        // Show success message and option to view reports
        setTimeout(() => {
            if (confirm('Report submitted successfully! Would you like to view all reports?')) {
                window.location.href = 'waste_report_table.html';
            }
        }, 1000);
        
    } catch (error) {
        console.error('❌ Error submitting report:', error);
        console.error('Error details:', error.message, error.stack);
        
        let errorMessage = 'Error submitting report: ';
        if (error.code === 'permission-denied') {
            errorMessage += 'Permission denied. Check Firebase rules.';
        } else if (error.code === 'unavailable') {
            errorMessage += 'Network error. Please check your connection.';
        } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'error');
        
        // Try to save to localStorage as backup
        try {
            const reports = JSON.parse(localStorage.getItem('wasteReports_backup') || '[]');
            reports.push({
                ...reportData,
                savedLocally: true,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('wasteReports_backup', JSON.stringify(reports));
            console.log('Saved to localStorage as backup');
        } catch (localError) {
            console.error('Could not save to localStorage:', localError);
        }
    } finally {
        // Reset button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        showLoading(false);
    }
}

// ================================
// FILTERING AND SEARCH FUNCTIONS
// ================================
async function loadAllReportsForFiltering() {
    // Check if cache is still valid
    if (allReportsCache && cacheTimestamp && 
        (Date.now() - cacheTimestamp) < CACHE_DURATION) {
        console.log('Using cached reports for filtering');
        return allReportsCache;
    }
    
    console.log('Fetching all reports for client-side filtering...');
    showLoading(true);
    
    try {
        // Fetch all reports from Firestore
        const snapshot = await db.collection('wasteReports')
            .orderBy('submittedAt', 'desc')
            .get();
        
        allReportsCache = [];
        snapshot.forEach(doc => {
            const report = { id: doc.id, ...doc.data() };
            // Ensure all fields exist for filtering
            report.email = report.email || '';
            report.store = report.store || '';
            report.disposalType = report.disposalType || '';
            report.reportDate = report.reportDate || '';
            allReportsCache.push(report);
        });
        
        cacheTimestamp = Date.now();
        console.log(`✅ Loaded ${allReportsCache.length} reports for client-side filtering`);
        
        // Update statistics from cache
        updateStatisticsFromCache();
        
        return allReportsCache;
    } catch (error) {
        console.error('Error loading all reports:', error);
        showNotification('Error loading reports for filtering: ' + error.message, 'error');
        return [];
    } finally {
        showLoading(false);
    }
}

function applyFiltersClientSide(reports) {
    const storeFilter = document.getElementById('filterStore');
    const typeFilter = document.getElementById('filterType');
    const dateFilter = document.getElementById('filterDate');
    const searchEmail = document.getElementById('searchEmail');
    
    if (!reports || reports.length === 0) return [];
    
    return reports.filter(report => {
        // Store filter
        if (storeFilter && storeFilter.value && 
            report.store !== storeFilter.value) {
            return false;
        }
        
        // Type filter
        if (typeFilter && typeFilter.value && 
            report.disposalType !== typeFilter.value) {
            return false;
        }
        
        // Date filter
        if (dateFilter && dateFilter.value && 
            report.reportDate !== dateFilter.value) {
            return false;
        }
        
        // Email search
        if (searchEmail && searchEmail.value && 
            !report.email.toLowerCase().includes(searchEmail.value.toLowerCase())) {
            return false;
        }
        
        return true;
    });
}

// ================================
// REPORTS VIEW FUNCTIONS
// ================================
async function loadReports() {
    showLoading(true);
    
    try {
        if (!db) {
            console.error('Firebase not initialized for loading reports');
            showNotification('Cannot load reports: Firebase not initialized', 'error');
            return;
        }
        
        // Clear existing data
        reportsData = [];
        const tableBody = document.getElementById('reportsTableBody');
        if (!tableBody) {
            console.error('Table body not found');
            return;
        }
        
        tableBody.innerHTML = '';
        
        // Check which filters are active
        const storeFilter = document.getElementById('filterStore');
        const typeFilter = document.getElementById('filterType');
        const dateFilter = document.getElementById('filterDate');
        const searchEmail = document.getElementById('searchEmail');
        
        const hasStoreFilter = storeFilter && storeFilter.value;
        const hasTypeFilter = typeFilter && typeFilter.value;
        const hasDateFilter = dateFilter && dateFilter.value;
        const hasEmailSearch = searchEmail && searchEmail.value;
        
        // Determine if we need server-side or client-side filtering
        const useServerSide = !(hasStoreFilter && hasTypeFilter) && 
                             !(hasStoreFilter && hasDateFilter) && 
                             !(hasTypeFilter && hasDateFilter) &&
                             !hasEmailSearch;
        
        let filteredReports = [];
        let totalFilteredCount = 0;
        
        if (useServerSide) {
            console.log('Using server-side filtering');
            // Use Firestore queries for simple filtering
            let query = db.collection('wasteReports');
            
            // Apply single filter if present
            if (hasStoreFilter) {
                query = query.where('store', '==', storeFilter.value);
            } else if (hasTypeFilter) {
                query = query.where('disposalType', '==', typeFilter.value);
            } else if (hasDateFilter) {
                query = query.where('reportDate', '==', dateFilter.value);
            }
            
            // Always order by submission date (newest first)
            query = query.orderBy('submittedAt', 'desc');
            
            // Apply pagination
            if (currentPage > 1 && lastVisibleDoc) {
                query = query.startAfter(lastVisibleDoc);
            }
            
            // Get limited results
            query = query.limit(pageSize);
            
            const snapshot = await query.get();
            
            // Update pagination markers
            if (!snapshot.empty) {
                firstVisibleDoc = snapshot.docs[0];
                lastVisibleDoc = snapshot.docs[snapshot.docs.length - 1];
            } else {
                firstVisibleDoc = null;
                lastVisibleDoc = null;
            }
            
            // Process results
            snapshot.forEach(doc => {
                const report = { id: doc.id, ...doc.data() };
                filteredReports.push(report);
            });
            
            totalFilteredCount = filteredReports.length;
            
        } else {
            console.log('Using client-side filtering');
            // Use client-side filtering for complex filters
            const allReports = await loadAllReportsForFiltering();
            filteredReports = applyFiltersClientSide(allReports);
            
            // Apply pagination to filtered results
            const startIndex = (currentPage - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            filteredReports = filteredReports.slice(startIndex, endIndex);
            totalFilteredCount = allReports.length;
            
            // Reset server-side pagination markers
            firstVisibleDoc = null;
            lastVisibleDoc = null;
        }
        
        // Display results
        if (filteredReports.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: var(--color-gray);">
                        No reports found. Try changing your filters or submit a new report.
                    </td>
                </tr>
            `;
        } else {
            // Count statistics from displayed reports
            let expiredCount = 0;
            let wasteCount = 0;
            let noWasteCount = 0;
            
            filteredReports.forEach(report => {
                reportsData.push(report);
                
                // Count by type
                if (report.disposalType === 'expired') expiredCount++;
                else if (report.disposalType === 'waste') wasteCount++;
                else if (report.disposalType === 'noWaste') noWasteCount++;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${report.reportId ? report.reportId.substring(0, 8) + '...' : 'N/A'}</td>
                    <td>${report.store || 'N/A'}</td>
                    <td>${report.personnel || 'N/A'}</td>
                    <td>${formatDate(report.reportDate)}</td>
                    <td>${getDisposalTypeBadge(report.disposalType)}</td>
                    <td>${report.email || 'N/A'}</td>
                    <td>${formatDateTime(report.submittedAt)}</td>
                    <td><span class="status-badge status-submitted">Submitted</span></td>
                    <td>
                        <button class="view-details-btn" onclick="viewReportDetails('${report.id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            // Update statistics for displayed reports
            updateStatistics(reportsData.length, expiredCount, wasteCount, noWasteCount);
        }
        
        // Update pagination info
        updatePageInfo(reportsData.length, totalFilteredCount);
        updatePaginationButtons(totalFilteredCount);
        
    } catch (error) {
        console.error('Error loading reports:', error);
        
        // Fallback to client-side filtering on any error
        if (error.code === 'failed-precondition' || error.code === 'unimplemented') {
            console.log('Firebase index error, falling back to client-side filtering...');
            showNotification('Using advanced filtering...', 'info');
            
            // Clear table
            const tableBody = document.getElementById('reportsTableBody');
            if (tableBody) tableBody.innerHTML = '';
            
            // Try client-side filtering
            await loadReportsClientSide();
        } else {
            showNotification('Error loading reports: ' + error.message, 'error');
        }
    } finally {
        showLoading(false);
    }
}

async function loadReportsClientSide() {
    try {
        const allReports = await loadAllReportsForFiltering();
        const filteredReports = applyFiltersClientSide(allReports);
        
        // Apply pagination
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const paginatedReports = filteredReports.slice(startIndex, endIndex);
        
        // Display results
        const tableBody = document.getElementById('reportsTableBody');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        if (paginatedReports.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px; color: var(--color-gray);">
                        No reports found with current filters.
                    </td>
                </tr>
            `;
        } else {
            // Count statistics
            let expiredCount = 0;
            let wasteCount = 0;
            let noWasteCount = 0;
            
            paginatedReports.forEach(report => {
                reportsData.push(report);
                
                // Count by type
                if (report.disposalType === 'expired') expiredCount++;
                else if (report.disposalType === 'waste') wasteCount++;
                else if (report.disposalType === 'noWaste') noWasteCount++;
                
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${report.reportId ? report.reportId.substring(0, 8) + '...' : 'N/A'}</td>
                    <td>${report.store || 'N/A'}</td>
                    <td>${report.personnel || 'N/A'}</td>
                    <td>${formatDate(report.reportDate)}</td>
                    <td>${getDisposalTypeBadge(report.disposalType)}</td>
                    <td>${report.email || 'N/A'}</td>
                    <td>${formatDateTime(report.submittedAt)}</td>
                    <td><span class="status-badge status-submitted">Submitted</span></td>
                    <td>
                        <button class="view-details-btn" onclick="viewReportDetails('${report.id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                `;
                tableBody.appendChild(row);
            });
            
            // Update statistics
            updateStatistics(reportsData.length, expiredCount, wasteCount, noWasteCount);
        }
        
        // Update pagination
        updatePageInfo(reportsData.length, filteredReports.length);
        updatePaginationButtons(filteredReports.length);
        
    } catch (error) {
        console.error('Error in client-side filtering:', error);
        showNotification('Error loading reports', 'error');
    }
}

function clearFilters() {
    const storeFilter = document.getElementById('filterStore');
    const typeFilter = document.getElementById('filterType');
    const dateFilter = document.getElementById('filterDate');
    const searchEmail = document.getElementById('searchEmail');
    
    if (storeFilter) storeFilter.value = '';
    if (typeFilter) typeFilter.value = '';
    if (dateFilter) dateFilter.value = '';
    if (searchEmail) searchEmail.value = '';
    
    currentPage = 1;
    lastVisibleDoc = null;
    firstVisibleDoc = null;
    
    loadReports();
}

function changePage(direction) {
    currentPage += direction;
    loadReports();
}

function updatePageInfo(displayedCount, totalCount = displayedCount) {
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        const start = (currentPage - 1) * pageSize + 1;
        const end = Math.min(start + displayedCount - 1, totalCount);
        pageInfo.textContent = `Showing ${start}-${end} of ${totalCount}`;
    }
    
    const showingCount = document.getElementById('showingCount');
    if (showingCount) {
        showingCount.textContent = displayedCount;
    }
}

function updateStatisticsFromCache() {
    if (!allReportsCache) return;
    
    const expiredCount = allReportsCache.filter(r => r.disposalType === 'expired').length;
    const wasteCount = allReportsCache.filter(r => r.disposalType === 'waste').length;
    const noWasteCount = allReportsCache.filter(r => r.disposalType === 'noWaste').length;
    
    updateStatistics(allReportsCache.length, expiredCount, wasteCount, noWasteCount);
}

function updateStatistics(total, expired, waste, noWaste) {
    const totalEl = document.getElementById('totalReports');
    const expiredEl = document.getElementById('expiredCount');
    const wasteEl = document.getElementById('wasteCount');
    const noWasteEl = document.getElementById('noWasteCount');
    
    if (totalEl) totalEl.textContent = total;
    if (expiredEl) expiredEl.textContent = expired;
    if (wasteEl) wasteEl.textContent = waste;
    if (noWasteEl) noWasteEl.textContent = noWaste;
}

function updatePaginationButtons(totalFilteredCount) {
    const prevBtn = document.getElementById('prevPageBtn');
    const nextBtn = document.getElementById('nextPageBtn');
    
    if (prevBtn) {
        prevBtn.disabled = currentPage <= 1;
    }
    
    if (nextBtn) {
        const totalPages = Math.ceil(totalFilteredCount / pageSize);
        nextBtn.disabled = currentPage >= totalPages || reportsData.length < pageSize;
    }
}

// ================================
// REPORT DETAILS FUNCTIONS
// ================================
async function viewReportDetails(reportId) {
    showLoading(true);
    
    try {
        const doc = await db.collection('wasteReports').doc(reportId).get();
        
        if (!doc.exists) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const report = { id: doc.id, ...doc.data() };
        
        // Build modal content
        let modalContent = `
            <div class="details-section">
                <h3><i class="fas fa-info-circle"></i> Report Information</h3>
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
                        <div class="detail-label">Report Date</div>
                        <div class="detail-value">${formatDate(report.reportDate)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Disposal Type</div>
                        <div class="detail-value">${getDisposalTypeBadge(report.disposalType)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Email</div>
                        <div class="detail-value">${report.email || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Submitted At</div>
                        <div class="detail-value">${formatDateTime(report.submittedAt)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Status</div>
                        <div class="detail-value"><span class="status-badge status-submitted">${report.status || 'Submitted'}</span></div>
                    </div>
                </div>
            </div>
        `;
        
        // Add items based on disposal type
        if (report.disposalType === 'expired' && report.expiredItems) {
            modalContent += `
                <div class="details-section">
                    <h3><i class="fas fa-boxes"></i> Expired Items (${report.expiredItems.length})</h3>
                    <div class="item-list">
            `;
            
            report.expiredItems.forEach((item, index) => {
                modalContent += `
                    <div class="item-list-item">
                        <div class="detail-item">
                            <div class="detail-label">Item Name</div>
                            <div class="detail-value">${item.item}</div>
                        </div>
                        <div class="details-grid">
                            <div class="detail-item">
                                <div class="detail-label">Delivered Date</div>
                                <div class="detail-value">${formatDate(item.deliveredDate)}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Manufactured Date</div>
                                <div class="detail-value">${formatDate(item.manufacturedDate)}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Expiration Date</div>
                                <div class="detail-value">${formatDate(item.expirationDate)}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Quantity</div>
                                <div class="detail-value">${item.quantity} ${item.unit}</div>
                            </div>
                        </div>
                        ${item.notes ? `
                            <div class="detail-item">
                                <div class="detail-label">Notes</div>
                                <div class="detail-value">${item.notes}</div>
                            </div>
                        ` : ''}
                `;
                
                // Add documentation if available
                if (item.documentation && item.documentation.length > 0) {
                    modalContent += `
                        <div class="detail-item">
                            <div class="detail-label">Documentation (${item.documentation.length} files)</div>
                            <div class="image-gallery">
                    `;
                    
                    item.documentation.forEach((file, fileIndex) => {
                        if (file.type && file.type.startsWith('image/')) {
                            modalContent += `
                                <img src="data:${file.type};base64,${file.base64}" 
                                     alt="${file.name}" 
                                     class="image-thumbnail"
                                     onclick="viewImage('data:${file.type};base64,${file.base64}')">
                            `;
                        } else {
                            modalContent += `
                                <div class="image-thumbnail" style="display: flex; align-items: center; justify-content: center; background: #f0f0f0;">
                                    <i class="fas fa-file-pdf"></i> ${file.name}
                                </div>
                            `;
                        }
                    });
                    
                    modalContent += `
                            </div>
                        </div>
                    `;
                }
                
                modalContent += `</div>`;
            });
            
            modalContent += `
                    </div>
                </div>
            `;
        } else if (report.disposalType === 'waste' && report.wasteItems) {
            modalContent += `
                <div class="details-section">
                    <h3><i class="fas fa-trash"></i> Waste Items (${report.wasteItems.length})</h3>
                    <div class="item-list">
            `;
            
            report.wasteItems.forEach((item, index) => {
                modalContent += `
                    <div class="item-list-item">
                        <div class="detail-item">
                            <div class="detail-label">Item Description</div>
                            <div class="detail-value">${item.item}</div>
                        </div>
                        <div class="details-grid">
                            <div class="detail-item">
                                <div class="detail-label">Reason</div>
                                <div class="detail-value">${item.reason}</div>
                            </div>
                            <div class="detail-item">
                                <div class="detail-label">Quantity</div>
                                <div class="detail-value">${item.quantity} ${item.unit}</div>
                            </div>
                        </div>
                        ${item.notes ? `
                            <div class="detail-item">
                                <div class="detail-label">Notes</div>
                                <div class="detail-value">${item.notes}</div>
                            </div>
                        ` : ''}
                `;
                
                // Add documentation if available
                if (item.documentation && item.documentation.length > 0) {
                    modalContent += `
                        <div class="detail-item">
                            <div class="detail-label">Documentation (${item.documentation.length} files)</div>
                            <div class="image-gallery">
                    `;
                    
                    item.documentation.forEach((file, fileIndex) => {
                        if (file.type && file.type.startsWith('image/')) {
                            modalContent += `
                                <img src="data:${file.type};base64,${file.base64}" 
                                     alt="${file.name}" 
                                     class="image-thumbnail"
                                     onclick="viewImage('data:${file.type};base64,${file.base64}')">
                            `;
                        } else {
                            modalContent += `
                                <div class="image-thumbnail" style="display: flex; align-items: center; justify-content: center; background: #f0f0f0;">
                                    <i class="fas fa-file-pdf"></i> ${file.name}
                                </div>
                            `;
                        }
                    });
                    
                    modalContent += `
                            </div>
                        </div>
                    `;
                }
                
                modalContent += `</div>`;
            });
            
            modalContent += `
                    </div>
                </div>
            `;
        } else if (report.disposalType === 'noWaste') {
            modalContent += `
                <div class="details-section">
                    <h3><i class="fas fa-check-circle"></i> No Waste Report</h3>
                    <div class="detail-item">
                        <div class="detail-value" style="color: var(--color-success); font-weight: 500;">
                            ✅ No waste or expired items to report for this period
                        </div>
                    </div>
                    ${report.notes ? `
                        <div class="detail-item">
                            <div class="detail-label">Notes</div>
                            <div class="detail-value">${report.notes}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }
        
        // Add report metadata
        modalContent += `
            <div class="details-section">
                <h3><i class="fas fa-database"></i> Report Metadata</h3>
                <div class="details-grid">
                    <div class="detail-item">
                        <div class="detail-label">Created At</div>
                        <div class="detail-value">${formatDateTime(report.createdAt)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Report Size</div>
                        <div class="detail-value">${report.reportSizeKB || 'Unknown'} KB</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Total Items</div>
                        <div class="detail-value">${report.totalExpiredItems || report.totalWasteItems || 0}</div>
                    </div>
                </div>
            </div>
        `;
        
        // Set modal content and show
        const modalContentEl = document.getElementById('modalContent');
        if (modalContentEl) {
            modalContentEl.innerHTML = modalContent;
        }
        
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

function closeDetailsModal() {
    const detailsModal = document.getElementById('detailsModal');
    if (detailsModal) {
        detailsModal.style.display = 'none';
    }
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
// INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('Document loaded, initializing...');
    
    // Set default date to today
    const reportDateInput = document.getElementById('reportDate');
    if (reportDateInput) {
        const today = new Date().toISOString().split('T')[0];
        reportDateInput.value = today;
        reportDateInput.min = today;
        console.log('Set report date to:', today);
    }
    
    // Setup form submission
    const form = document.getElementById('wasteReportForm');
    if (form) {
        console.log('Form found, adding submit event listener');
        form.addEventListener('submit', handleSubmit);
        
        // Also add click handler to submit button for extra safety
        const submitBtn = form.querySelector('.submit-btn');
        if (submitBtn) {
            submitBtn.addEventListener('click', function(e) {
                if (form.checkValidity()) {
                    handleSubmit(e);
                } else {
                    form.reportValidity();
                }
            });
        }
    }
    
    // Setup dynamic field toggling for disposal type
    const disposalTypeRadios = document.querySelectorAll('input[name="disposalType"]');
    disposalTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleDynamicFields);
    });
    
    // Test Firebase connection
    testFirebaseConnection();
    
    // Load reports if on reports page
    if (document.getElementById('reportsTableBody')) {
        console.log('On reports page, loading reports...');
        loadReports();
        
        // Set up filter event listeners
        const filterStore = document.getElementById('filterStore');
        const filterType = document.getElementById('filterType');
        const filterDate = document.getElementById('filterDate');
        const searchEmail = document.getElementById('searchEmail');
        
        if (filterStore) filterStore.addEventListener('change', () => {
            currentPage = 1;
            lastVisibleDoc = null;
            loadReports();
        });
        
        if (filterType) filterType.addEventListener('change', () => {
            currentPage = 1;
            lastVisibleDoc = null;
            loadReports();
        });
        
        if (filterDate) filterDate.addEventListener('change', () => {
            currentPage = 1;
            lastVisibleDoc = null;
            loadReports();
        });
        
        if (searchEmail) searchEmail.addEventListener('input', () => {
            currentPage = 1;
            lastVisibleDoc = null;
            loadReports();
        });
    }
    
    // Close modals when clicking outside
    window.addEventListener('click', function(event) {
        const detailsModal = document.getElementById('detailsModal');
        const imageModal = document.getElementById('imageModal');
        
        if (event.target === detailsModal) {
            closeDetailsModal();
        }
        if (event.target === imageModal) {
            closeImageModal();
        }
    });
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeDetailsModal();
            closeImageModal();
        }
    });
});

// Test Firebase connection
async function testFirebaseConnection() {
    try {
        if (!firebase.apps.length) {
            console.error('Firebase not initialized');
            return;
        }
        
        console.log('Testing Firebase connection...');
        
        // Try to write a test document
        const testRef = db.collection('_test').doc('connection');
        await testRef.set({
            test: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Firebase write test successful');
        
        // Clean up test document
        await testRef.delete();
        
        console.log('✅ Firebase connection test complete');
        
    } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        let errorMessage = 'Firebase connection issue: ';
        if (error.code === 'permission-denied') {
            errorMessage += 'Permission denied. Please check Firebase Firestore rules.';
        } else if (error.code === 'unavailable') {
            errorMessage += 'Network error. Please check your internet connection.';
        } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'error');
    }
}

// Export for debugging
window.debugSubmit = handleSubmit;
window.debugFirebase = () => {
    console.log('Firebase status:', {
        initialized: !!firebase.apps.length,
        db: !!db,
        config: firebaseConfig
    });
    testFirebaseConnection();
};
window.clearCache = () => {
    allReportsCache = null;
    cacheTimestamp = null;
    console.log('Cache cleared');
    showNotification('Cache cleared', 'success');
};