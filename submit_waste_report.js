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

// ================================
// GOOGLE APPS SCRIPT CONFIGURATION
// ================================
const GAS_CONFIG = {
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbyPGgZ54q-lDUu5YxaeQbSJ-z2pDqM8ia4eTfshdpSNbrqBFF7fQZvglx9IeZn0PqHSTg/exec',
    SENDER_EMAIL: 'tsliferich@gmail.com',
    SENDER_NAME: 'FG Operations'
};

// ================================
// FILE SIZE LIMITS (UPDATED TO 10MB)
// ================================
const FILE_CONFIG = {
    MAX_SIZE_PER_FILE: 10 * 1024 * 1024, // 10MB per file
    MAX_TOTAL_SIZE: 10 * 1024 * 1024,   // 10MB total per item
    MAX_FILES_PER_ITEM: 3               // Max 3 files per item
};

// ================================
// ITEMS LIST FOR DROPDOWN
// ================================
let ITEMS_LIST = [];
let itemsLoaded = false;
let isResubmitting = false;
let originalItemData = null;

// Initialize Firebase
let db, storage;
try {
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    db = firebase.firestore();
    storage = firebase.storage();
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
    showNotification('Firebase connection failed. Please check console.', 'error');
}

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

function showLoading(show, message = '') {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.style.display = show ? 'flex' : 'none';
        
        if (message) {
            const progressText = document.getElementById('progressText');
            if (progressText) {
                progressText.textContent = message;
            }
        }
    }
}

function showUploadProgress(show, current = 0, total = 0, fileName = '') {
    const progressContainer = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const progressDetails = document.getElementById('progressDetails');
    
    if (!progressContainer || !progressFill || !progressText) return;
    
    if (show) {
        progressContainer.style.display = 'block';
        
        if (total > 0) {
            const percentage = Math.round((current / total) * 100);
            progressFill.style.width = `${percentage}%`;
            progressText.textContent = `Uploading: ${percentage}%`;
            
            if (fileName) {
                progressDetails.textContent = `File: ${fileName}`;
            }
        }
    } else {
        progressContainer.style.display = 'none';
        progressFill.style.width = '0%';
        progressText.textContent = 'Uploading: 0%';
        progressDetails.textContent = '';
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

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ================================
// OPTIMIZED FIREBASE STORAGE FUNCTIONS
// ================================

// Parallel file upload for a single item
async function uploadFilesForItemParallel(files, reportId, itemId) {
    const uploadedFiles = [];
    
    const maxConcurrent = 3;
    const chunks = [];
    
    for (let i = 0; i < files.length; i += maxConcurrent) {
        chunks.push(files.slice(i, i + maxConcurrent));
    }
    
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
        const chunk = chunks[chunkIndex];
        const uploadPromises = chunk.map(async (file, fileIndex) => {
            const globalIndex = chunkIndex * maxConcurrent + fileIndex;
            
            try {
                let fileToUpload = file;
                if (file.size > 2 * 1024 * 1024 && file.type.startsWith('image/')) {
                    fileToUpload = await prepareFileForUpload(file);
                }
                
                const timestamp = Date.now() + globalIndex;
                const randomString = Math.random().toString(36).substring(7);
                const fileExtension = file.name.split('.').pop();
                const fileName = `${reportId}/${itemId}/${timestamp}_${randomString}.${fileExtension}`;
                
                const storageRef = storage.ref().child(fileName);
                const uploadTask = storageRef.put(fileToUpload);
                
                return new Promise((resolve, reject) => {
                    uploadTask.on(
                        'state_changed',
                        null,
                        reject,
                        async () => {
                            try {
                                const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                                resolve({
                                    url: downloadURL,
                                    name: file.name,
                                    type: file.type,
                                    size: fileToUpload.size,
                                    path: fileName,
                                    storagePath: storageRef.fullPath,
                                    index: globalIndex
                                });
                            } catch (error) {
                                reject(error);
                            }
                        }
                    );
                });
            } catch (error) {
                console.error(`Failed to upload file ${file.name}:`, error);
                throw new Error(`Failed to upload ${file.name}: ${error.message}`);
            }
        });
        
        const results = await Promise.all(uploadPromises);
        uploadedFiles.push(...results);
        
        const currentProgress = (uploadedFiles.length / files.length) * 100;
        showUploadProgress(true, uploadedFiles.length, files.length, `${uploadedFiles.length}/${files.length} files`);
    }
    
    return uploadedFiles.sort((a, b) => a.index - b.index);
}

// Process all items with parallel upload
async function processAllItemsWithUploads(reportId, allItems, progressCallback) {
    const totalItems = allItems.length;
    let completedItems = 0;
    
    for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        const itemId = item.itemId;
        const fileInput = document.getElementById(
            item.type === 'expired' ? `documentation-${itemId}` : `wasteDocumentation-${itemId}`
        );
        
        if (fileInput && fileInput.files.length > 0) {
            const files = Array.from(fileInput.files);
            
            try {
                const uploadedFiles = await uploadFilesForItemParallel(files, reportId, `${item.type}-${itemId}`);
                item.documentation = uploadedFiles;
                item.totalFiles = uploadedFiles.length;
                
                item.storageUsed = uploadedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
                item.originalFileSize = files.reduce((sum, file) => sum + file.size, 0);
                
            } catch (error) {
                console.error(`Failed to upload files for item ${item.item}:`, error);
                throw error;
            }
        }
        
        completedItems++;
        if (progressCallback) {
            progressCallback(completedItems, totalItems);
        }
    }
    
    return allItems;
}

// ================================
// FETCH ITEMS FROM FIRESTORE
// ================================
async function fetchItemsFromFirestore() {
    try {
        if (!db) {
            console.error('Firebase not initialized');
            throw new Error('Firebase not initialized');
        }
        
        console.log('Fetching items from Firestore...');
        showLoading(true, 'Loading items...');
        
        const snapshot = await db.collection('items')
            .orderBy('name', 'asc')
            .get();
        
        ITEMS_LIST = [];
        
        snapshot.forEach(doc => {
            const itemData = doc.data();
            ITEMS_LIST.push(itemData.name);
        });
        
        console.log(`✅ Loaded ${ITEMS_LIST.length} items from Firestore`);
        itemsLoaded = true;
        
        initializeAllSelect2Dropdowns();
        return ITEMS_LIST;
        
    } catch (error) {
        console.error('❌ Error fetching items from Firestore:', error);
        showNotification('Failed to load items from database. Please try again.', 'error');
        throw error;
    } finally {
        showLoading(false);
    }
}

// ================================
// GET ITEM COST FROM FIRESTORE
// ================================
async function getItemCost(itemName) {
    try {
        if (!itemName || !db) return 0;
        
        const query = await db.collection('items')
            .where('name', '==', itemName)
            .limit(1)
            .get();
        
        if (!query.empty) {
            const doc = query.docs[0];
            const itemData = doc.data();
            return parseFloat(itemData.cost) || 0;
        }
        
        return 0;
        
    } catch (error) {
        console.error('Error getting item cost:', error);
        return 0;
    }
}

function initializeAllSelect2Dropdowns() {
    $('.item-dropdown').each(function() {
        const selectId = $(this).attr('id');
        if (selectId) {
            initSelect2Dropdown(selectId);
        }
    });
}

function initSelect2Dropdown(selectElementId) {
    if (ITEMS_LIST.length === 0) return;
    
    $(`#${selectElementId}`).select2({
        data: ITEMS_LIST.map(item => ({ id: item, text: item })),
        placeholder: "Select or type to search...",
        allowClear: false,
        width: '100%',
        dropdownParent: $(`#${selectElementId}`).parent()
    });
}

// ================================
// LOAD REJECTED ITEM FUNCTION - MODIFIED
// ================================
async function loadRejectedItem() {
    const itemIdInput = document.getElementById('itemId');
    const itemId = itemIdInput ? itemIdInput.value.trim() : '';
    
    if (!itemId) {
        showNotification('Please enter an Item ID', 'error');
        return;
    }
    
    showLoading(true, 'Searching for rejected item...');
    
    try {
        const parts = itemId.split('_');
        if (parts.length < 3) {
            showNotification('Invalid Item ID format', 'error');
            return;
        }
        
        const reportId = parts[0];
        const itemType = parts[1];
        const itemIndex = parseInt(parts[2]);
        
        const reportDoc = await db.collection('wasteReports').doc(reportId).get();
        
        if (!reportDoc.exists) {
            showNotification('Report not found', 'error');
            return;
        }
        
        const report = reportDoc.data();
        const items = itemType === 'expired' ? report.expiredItems : report.wasteItems;
        
        if (!items || itemIndex >= items.length) {
            showNotification('Item not found in report', 'error');
            return;
        }
        
        const rejectedItem = items[itemIndex];
        
        if (rejectedItem.approvalStatus !== 'rejected') {
            showNotification('This item is not rejected', 'warning');
            return;
        }
        
        originalItemData = {
            reportId: reportId,
            itemType: itemType,
            itemIndex: itemIndex,
            originalItem: rejectedItem
        };
        
        isResubmitting = true;
        
        // Don't pre-populate other fields for resubmission
        // Only show the item being resubmitted
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('reportDate').value = today;
        
        // Show appropriate disposal type based on item type
        const disposalTypes = report.disposalTypes || [];
        if (itemType === 'expired') {
            document.getElementById('expired').checked = true;
            toggleDisposalType('expired');
        } else if (itemType === 'waste') {
            document.getElementById('waste').checked = true;
            toggleDisposalType('waste');
        }
        
        // Clear any existing fields
        const expiredFields = document.getElementById('expiredFields');
        const wasteFields = document.getElementById('wasteFields');
        if (expiredFields) expiredFields.innerHTML = '';
        if (wasteFields) wasteFields.innerHTML = '';
        
        // Add the rejected item for resubmission
        if (itemType === 'expired') {
            addExpiredItemWithData(rejectedItem);
        } else {
            addWasteItemWithData(rejectedItem);
        }
        
        showNotification('Rejected item loaded. Please review and edit the information for resubmission.', 'success');
        
        if (itemType === 'expired') {
            document.getElementById('expiredContainer').scrollIntoView({ behavior: 'smooth' });
        } else {
            document.getElementById('wasteContainer').scrollIntoView({ behavior: 'smooth' });
        }
        
    } catch (error) {
        console.error('Error loading rejected item:', error);
        showNotification('Error loading item: ' + error.message, 'error');
    } finally {
        showLoading(false);
    }
}

// ================================
// ADD ITEM WITH PRE-POPULATED DATA
// ================================
function addExpiredItemWithData(itemData) {
    const expiredFields = document.getElementById('expiredFields');
    if (!expiredFields) return;
    
    const itemId = Date.now() + Math.random().toString(36).substr(2, 9);
    const today = new Date().toISOString().split('T')[0];
    
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';
    fieldGroup.id = `expired-${itemId}`;
    
    fieldGroup.innerHTML = `
        <div class="field-header">
            <div class="field-title">Expired Item (Resubmitting)</div>
            <button type="button" class="remove-btn" onclick="removeField('expired-${itemId}')">×</button>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="expiredItem-${itemId}">Item Name <span class="required">*</span></label>
                <select class="item-dropdown" id="expiredItem-${itemId}" name="expiredItems[${itemId}][item]" required>
                    <option value="" disabled>Select or type to search...</option>
                    <option value="${itemData.item}" selected>${itemData.item}</option>
                </select>
                <span class="note">Type to search or select from dropdown</span>
            </div>
            <div class="form-group">
                <label for="deliveredDate-${itemId}">Delivered Date <span class="required">*</span></label>
                <input type="date" id="deliveredDate-${itemId}" name="expiredItems[${itemId}][deliveredDate]" required value="${itemData.deliveredDate || today}">
            </div>
            <div class="form-group">
                <label for="manufacturedDate-${itemId}">Manufactured Date <span class="required">*</span></label>
                <input type="date" id="manufacturedDate-${itemId}" name="expiredItems[${itemId}][manufacturedDate]" required value="${itemData.manufacturedDate || ''}">
            </div>
            <div class="form-group">
                <label for="expirationDate-${itemId}">Expiration Date <span class="required">*</span></label>
                <input type="date" id="expirationDate-${itemId}" name="expiredItems[${itemId}][expirationDate]" required value="${itemData.expirationDate || ''}">
            </div>
            <div class="form-group">
                <label for="quantity-${itemId}">Quantity <span class="required">*</span></label>
                <input type="number" id="quantity-${itemId}" name="expiredItems[${itemId}][quantity]" required min="0" step="0.01" placeholder="0.00" value="${itemData.quantity || 0}">
            </div>
            <div class="form-group">
                <label for="unit-${itemId}">Unit of Measure <span class="required">*</span></label>
                <select id="unit-${itemId}" name="expiredItems[${itemId}][unit]" required>
                    <option value="" disabled>Select unit</option>
                    <option value="pieces" ${itemData.unit === 'pieces' ? 'selected' : ''}>Pieces</option>
                    <option value="packs" ${itemData.unit === 'packs' ? 'selected' : ''}>Packs</option>
                    <option value="kilogram" ${itemData.unit === 'kilogram' ? 'selected' : ''}>Kilogram</option>
                    <option value="servings" ${itemData.unit === 'servings' ? 'selected' : ''}>Servings</option>
                </select>
            </div>
            <div class="form-group file-upload-container">
                <label for="documentation-${itemId}">Documentation <span class="required">*</span></label>
                <input type="file" id="documentation-${itemId}" name="expiredItems[${itemId}][documentation]" 
                       required accept="image/*,.pdf" multiple 
                       onchange="createFilePreview(this, 'documentation-${itemId}-preview')">
                <div id="documentation-${itemId}-preview" class="file-preview"></div>
                <span class="note">Upload photos or PDFs (Max 10MB per file, 3 files max)</span>
                ${itemData.documentation && itemData.documentation.length > 0 ? `
                <div style="margin-top: 5px; font-size: 12px; color: #666;">
                    <i class="fas fa-info-circle"></i> Previous documentation: ${itemData.documentation.length} file(s)
                </div>
                ` : ''}
            </div>
            <div class="form-group">
                <label for="notes-${itemId}">Additional Notes</label>
                <textarea id="notes-${itemId}" name="expiredItems[${itemId}][notes]" rows="2" placeholder="Any additional information">${itemData.notes || ''}</textarea>
            </div>
            ${itemData.rejectionReason ? `
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Previous Rejection Reason</label>
                <div style="background: #fff3cd; padding: 10px; border-radius: 4px; border-left: 4px solid #ffc107;">
                    <strong><i class="fas fa-exclamation-triangle"></i> ${itemData.rejectionReason}</strong>
                    <div style="font-size: 11px; color: #856404; margin-top: 5px;">
                        <i class="fas fa-info-circle"></i> Please correct the issue and resubmit
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    expiredFields.appendChild(fieldGroup);
    
    setTimeout(() => {
        initSelect2Dropdown(`expiredItem-${itemId}`);
    }, 100);
}

function addWasteItemWithData(itemData) {
    const wasteFields = document.getElementById('wasteFields');
    if (!wasteFields) return;
    
    const itemId = Date.now() + Math.random().toString(36).substr(2, 9);
    
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';
    fieldGroup.id = `waste-${itemId}`;
    
    fieldGroup.innerHTML = `
        <div class="field-header">
            <div class="field-title">Waste Item (Resubmitting)</div>
                <button type="button" class="remove-btn" onclick="removeField('waste-${itemId}')">×</button>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="wasteItem-${itemId}">Item/Description <span class="required">*</span></label>
                <select class="item-dropdown" id="wasteItem-${itemId}" name="wasteItems[${itemId}][item]" required>
                    <option value="" disabled>Select or type to search...</option>
                    <option value="${itemData.item}" selected>${itemData.item}</option>
                </select>
                <span class="note">Type to search or select from dropdown</span>
            </div>
            <div class="form-group">
                <label for="reason-${itemId}">Reason for Waste <span class="required">*</span></label>
                <select id="reason-${itemId}" name="wasteItems[${itemId}][reason]" required onchange="toggleAdditionalNotesRequirement('${itemId}')">
                    <option value="" disabled>Select reason</option>
                    <option value="spoilage" ${itemData.reason === 'spoilage' ? 'selected' : ''}>Spoilage</option>
                    <option value="damaged" ${itemData.reason === 'damaged' ? 'selected' : ''}>Damaged Packaging</option>
                    <option value="overproduction" ${itemData.reason === 'overproduction' ? 'selected' : ''}>Overproduction</option>
                    <option value="customer_return" ${itemData.reason === 'customer_return' ? 'selected' : ''}>Customer Return</option>
                    <option value="quality_issue" ${itemData.reason === 'quality_issue' ? 'selected' : ''}>Quality Issue</option>
                    <option value="other" ${itemData.reason === 'other' ? 'selected' : ''}>Other</option>
                </select>
                <div id="reason-note-${itemId}" class="note" style="margin-top: 5px; font-size: 12px; color: #666;"></div>
            </div>
            <div class="form-group">
                <label for="wasteQuantity-${itemId}">Quantity <span class="required">*</span></label>
                <input type="number" id="wasteQuantity-${itemId}" name="wasteItems[${itemId}][quantity]" required min="0" step="0.01" placeholder="0.00" value="${itemData.quantity || 0}">
            </div>
            <div class="form-group">
                <label for="wasteUnit-${itemId}">Unit of Measure <span class="required">*</span></label>
                <select id="wasteUnit-${itemId}" name="wasteItems[${itemId}][unit]" required>
                    <option value="" disabled>Select unit</option>
                    <option value="pieces" ${itemData.unit === 'pieces' ? 'selected' : ''}>Pieces</option>
                    <option value="packs" ${itemData.unit === 'packs' ? 'selected' : ''}>Packs</option>
                    <option value="kilogram" ${itemData.unit === 'kilogram' ? 'selected' : ''}>Kilogram</option>
                    <option value="servings" ${itemData.unit === 'servings' ? 'selected' : ''}>Servings</option>
                </select>
            </div>
            <div class="form-group file-upload-container">
                <label for="wasteDocumentation-${itemId}">Documentation <span class="required">*</span></label>
                <input type="file" id="wasteDocumentation-${itemId}" name="wasteItems[${itemId}][documentation]" 
                       required accept="image/*,.pdf" multiple 
                       onchange="createFilePreview(this, 'wasteDocumentation-${itemId}-preview')">
                <div id="wasteDocumentation-${itemId}-preview" class="file-preview"></div>
                <span class="note">Upload photos or PDFs (Max 10MB per file, 3 files max)</span>
                ${itemData.documentation && itemData.documentation.length > 0 ? `
                <div style="margin-top: 5px; font-size: 12px; color: #666;">
                    <i class="fas fa-info-circle"></i> Previous documentation: ${itemData.documentation.length} file(s)
                </div>
                ` : ''}
            </div>
            <div class="form-group">
                <label for="wasteNotes-${itemId}">Additional Notes <span id="notes-required-${itemId}" class="required" style="display: none;">*</span></label>
                <textarea id="wasteNotes-${itemId}" name="wasteItems[${itemId}][notes]" rows="2" placeholder="Any additional information">${itemData.notes || ''}</textarea>
                <span id="notes-note-${itemId}" class="note" style="margin-top: 5px; font-size: 12px; color: #666;"></span>
            </div>
            ${itemData.rejectionReason ? `
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Previous Rejection Reason</label>
                <div style="background: #fff3cd; padding: 10px; border-radius: 4px; border-left: 4px solid #ffc107;">
                    <strong><i class="fas fa-exclamation-triangle"></i> ${itemData.rejectionReason}</strong>
                    <div style="font-size: 11px; color: #856404; margin-top: 5px;">
                        <i class="fas fa-info-circle"></i> Please correct the issue and resubmit
                    </div>
                </div>
            </div>
            ` : ''}
        </div>
    `;
    
    wasteFields.appendChild(fieldGroup);
    
    setTimeout(() => {
        initSelect2Dropdown(`wasteItem-${itemId}`);
        toggleAdditionalNotesRequirement(itemId);
    }, 100);
}

// ================================
// TOGGLE ADDITIONAL NOTES REQUIREMENT
// ================================
function toggleAdditionalNotesRequirement(itemId) {
    const reasonSelect = document.getElementById(`reason-${itemId}`);
    const notesRequired = document.getElementById(`notes-required-${itemId}`);
    const reasonNote = document.getElementById(`reason-note-${itemId}`);
    const notesNote = document.getElementById(`notes-note-${itemId}`);
    
    if (!reasonSelect) return;
    
    const selectedReason = reasonSelect.value;
    
    if (reasonNote) reasonNote.textContent = '';
    if (notesNote) notesNote.textContent = '';
    
    if (selectedReason === 'customer_return' || selectedReason === 'quality_issue' || selectedReason === 'other') {
        if (notesRequired) notesRequired.style.display = 'inline';
        
        if (selectedReason === 'customer_return') {
            if (reasonNote) reasonNote.textContent = '⚠️ Additional notes required: Please explain why the item was returned';
            if (notesNote) notesNote.textContent = 'Required: Explain the reason for customer return (e.g., wrong order, customer dissatisfaction, etc.)';
        } else if (selectedReason === 'quality_issue') {
            if (reasonNote) reasonNote.textContent = '⚠️ Additional notes required: Please describe the quality issue';
            if (notesNote) notesNote.textContent = 'Required: Describe the specific quality problem (e.g., off-taste, wrong color, texture issue, etc.)';
        } else if (selectedReason === 'other') {
            if (reasonNote) reasonNote.textContent = '⚠️ Additional notes required: Please specify the reason';
            if (notesNote) notesNote.textContent = 'Required: Specify the exact reason for waste disposal';
        }
    } else {
        if (notesRequired) notesRequired.style.display = 'none';
    }
}

// ================================
// DISPOSAL TYPE TOGGLE FUNCTIONS
// ================================
function toggleDisposalType(checkboxId) {
    const expiredCheckbox = document.getElementById('expired');
    const wasteCheckbox = document.getElementById('waste');
    const noWasteCheckbox = document.getElementById('noWaste');
    
    const expiredContainer = document.getElementById('expiredContainer');
    const wasteContainer = document.getElementById('wasteContainer');
    
    const currentCheckbox = document.getElementById(checkboxId);
    const isChecked = currentCheckbox.checked;
    
    if (checkboxId === 'noWaste' && isChecked) {
        expiredCheckbox.checked = false;
        wasteCheckbox.checked = false;
        
        if (expiredContainer) expiredContainer.classList.remove('show');
        if (wasteContainer) wasteContainer.classList.remove('show');
        
        const expiredFields = document.getElementById('expiredFields');
        const wasteFields = document.getElementById('wasteFields');
        if (expiredFields) expiredFields.innerHTML = '';
        if (wasteFields) wasteFields.innerHTML = '';
    }
    else if ((checkboxId === 'expired' || checkboxId === 'waste') && isChecked) {
        noWasteCheckbox.checked = false;
        
        if (checkboxId === 'expired' && expiredCheckbox.checked) {
            if (expiredContainer) expiredContainer.classList.add('show');
            const expiredFields = document.getElementById('expiredFields');
            if (expiredFields && expiredFields.querySelectorAll('.field-group').length === 0 && !isResubmitting) {
                addExpiredItem();
            }
        }
        
        if (checkboxId === 'waste' && wasteCheckbox.checked) {
            if (wasteContainer) wasteContainer.classList.add('show');
            const wasteFields = document.getElementById('wasteFields');
            if (wasteFields && wasteFields.querySelectorAll('.field-group').length === 0 && !isResubmitting) {
                addWasteItem();
            }
        }
    }
    else if (!isChecked) {
        if (checkboxId === 'expired') {
            if (expiredContainer) expiredContainer.classList.remove('show');
            const expiredFields = document.getElementById('expiredFields');
            if (expiredFields) expiredFields.innerHTML = '';
        }
        else if (checkboxId === 'waste') {
            if (wasteContainer) wasteContainer.classList.remove('show');
            const wasteFields = document.getElementById('wasteFields');
            if (wasteFields) wasteFields.innerHTML = '';
        }
        else if (checkboxId === 'noWaste') {
            if (expiredCheckbox.checked && expiredContainer) {
                expiredContainer.classList.add('show');
                const expiredFields = document.getElementById('expiredFields');
                if (expiredFields && expiredFields.querySelectorAll('.field-group').length === 0 && !isResubmitting) {
                    addExpiredItem();
                }
            }
            if (wasteCheckbox.checked && wasteContainer) {
                wasteContainer.classList.add('show');
                const wasteFields = document.getElementById('wasteFields');
                if (wasteFields && wasteFields.querySelectorAll('.field-group').length === 0 && !isResubmitting) {
                    addWasteItem();
                }
            }
        }
    }
    
    updateDisposalTypeHint();
}

function updateDisposalTypeHint() {
    const expiredChecked = document.getElementById('expired').checked;
    const wasteChecked = document.getElementById('waste').checked;
    const noWasteChecked = document.getElementById('noWaste').checked;
    const hint = document.getElementById('disposalTypeHint');
    
    if (!hint) return;
    
    const selected = [];
    if (expiredChecked) selected.push('Expired Items');
    if (wasteChecked) selected.push('Waste');
    if (noWasteChecked) selected.push('No Waste');
    
    if (selected.length === 0) {
        hint.textContent = 'Select at least one disposal type';
        hint.style.color = '#dc3545';
    } else if (selected.length === 1) {
        hint.textContent = `Selected: ${selected[0]}`;
        hint.style.color = '#28a745';
    } else {
        hint.textContent = `Selected: ${selected.join(', ')}`;
        hint.style.color = '#28a745';
    }
}

function validateDisposalTypeSelection() {
    const expiredChecked = document.getElementById('expired').checked;
    const wasteChecked = document.getElementById('waste').checked;
    const noWasteChecked = document.getElementById('noWaste').checked;
    
    if (!expiredChecked && !wasteChecked && !noWasteChecked) {
        showNotification('Please select at least one disposal type.', 'error');
        return false;
    }
    
    if (noWasteChecked && (expiredChecked || wasteChecked)) {
        const confirmProceed = confirm('You have selected "No Waste" along with other disposal types. "No Waste" will override other selections. Do you want to continue?');
        if (!confirmProceed) {
            return false;
        }
    }
    
    return true;
}

// ================================
// IMAGE COMPRESSION FUNCTIONS (OPTIMIZED)
// ================================
async function prepareFileForUpload(file) {
    if (file.size <= 2 * 1024 * 1024 || !file.type.startsWith('image/')) {
        return file;
    }
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = function(event) {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = function() {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                const maxDimension = 1024;
                if (width > height && width > maxDimension) {
                    height = Math.round((height * maxDimension) / width);
                    width = maxDimension;
                } else if (height > maxDimension) {
                    width = Math.round((width * maxDimension) / height);
                    height = maxDimension;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                let quality = 0.7;
                if (file.size > 5 * 1024 * 1024) quality = 0.6;
                if (file.size > 8 * 1024 * 1024) quality = 0.5;
                
                canvas.toBlob(
                    (blob) => {
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };
            
            img.onerror = reject;
        };
        
        reader.onerror = reject;
    });
}

// ================================
// FORM FUNCTIONS
// ================================
function createFilePreview(fileInput, previewContainerId) {
    const files = fileInput.files;
    const previewContainer = document.getElementById(previewContainerId);
    
    if (!previewContainer) return;
    
    previewContainer.innerHTML = '';
    
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
        
        const sizeInfo = document.createElement('div');
        sizeInfo.className = 'file-size';
        sizeInfo.textContent = formatFileSize(file.size);
        previewItem.appendChild(sizeInfo);
        
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
    
    if (files.length > 0) {
        const totalSize = Array.from(files).reduce((total, file) => total + file.size, 0);
        const info = document.createElement('div');
        info.className = 'file-info';
        info.textContent = `${files.length} file(s), ${formatFileSize(totalSize)} total`;
        previewContainer.appendChild(info);
    }
}

function removeFileFromInput(fileInput, index) {
    const files = Array.from(fileInput.files);
    files.splice(index, 1);
    
    const dataTransfer = new DataTransfer();
    files.forEach(file => dataTransfer.items.add(file));
    fileInput.files = dataTransfer.files;
    
    const previewContainerId = fileInput.id + '-preview';
    createFilePreview(fileInput, previewContainerId);
    
    fileInput.dispatchEvent(new Event('change'));
}

function addExpiredItem() {
    const expiredFields = document.getElementById('expiredFields');
    if (!expiredFields) return;
    
    const itemId = Date.now() + Math.random().toString(36).substr(2, 9);
    const today = new Date().toISOString().split('T')[0];
    
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';
    fieldGroup.id = `expired-${itemId}`;
    
    fieldGroup.innerHTML = `
        <div class="field-header">
            <div class="field-title">Expired Item</div>
            <button type="button" class="remove-btn" onclick="removeField('expired-${itemId}')">×</button>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="expiredItem-${itemId}">Item Name <span class="required">*</span></label>
                <select class="item-dropdown" id="expiredItem-${itemId}" name="expiredItems[${itemId}][item]" required>
                    <option value="" disabled selected>Select or type to search...</option>
                </select>
                <span class="note">Type to search or select from dropdown</span>
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
                    <option value="pieces">Pieces</option>
                    <option value="packs">Packs</option>
                    <option value="kilogram">Kilogram</option>
                    <option value="servings">Servings</option>
                </select>
            </div>
            <div class="form-group file-upload-container">
                <label for="documentation-${itemId}">Documentation <span class="required">*</span></label>
                <input type="file" id="documentation-${itemId}" name="expiredItems[${itemId}][documentation]" 
                       required accept="image/*,.pdf" multiple 
                       onchange="createFilePreview(this, 'documentation-${itemId}-preview')">
                <div id="documentation-${itemId}-preview" class="file-preview"></div>
                <span class="note">Upload photos or PDFs (Max 10MB per file, 3 files max)</span>
            </div>
            <div class="form-group">
                <label for="notes-${itemId}">Additional Notes</label>
                <textarea id="notes-${itemId}" name="expiredItems[${itemId}][notes]" rows="2" placeholder="Any additional information"></textarea>
            </div>
        </div>
    `;
    
    expiredFields.appendChild(fieldGroup);
    
    setTimeout(() => {
        initSelect2Dropdown(`expiredItem-${itemId}`);
    }, 100);
}

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
                <select class="item-dropdown" id="wasteItem-${itemId}" name="wasteItems[${itemId}][item]" required>
                    <option value="" disabled selected>Select or type to search...</option>
                </select>
                <span class="note">Type to search or select from dropdown</span>
            </div>
            <div class="form-group">
                <label for="reason-${itemId}">Reason for Waste <span class="required">*</span></label>
                <select id="reason-${itemId}" name="wasteItems[${itemId}][reason]" required onchange="toggleAdditionalNotesRequirement('${itemId}')">
                    <option value="" disabled selected>Select reason</option>
                    <option value="spoilage">Spoilage</option>
                    <option value="damaged">Damaged Packaging</option>
                    <option value="overproduction">Overproduction</option>
                    <option value="customer_return">Customer Return</option>
                    <option value="quality_issue">Quality Issue</option>
                    <option value="other">Other</option>
                </select>
                <div id="reason-note-${itemId}" class="note" style="margin-top: 5px; font-size: 12px; color: #666;"></div>
            </div>
            <div class="form-group">
                <label for="wasteQuantity-${itemId}">Quantity <span class="required">*</span></label>
                <input type="number" id="wasteQuantity-${itemId}" name="wasteItems[${itemId}][quantity]" required min="0" step="0.01" placeholder="0.00">
            </div>
            <div class="form-group">
                <label for="wasteUnit-${itemId}">Unit of Measure <span class="required">*</span></label>
                <select id="wasteUnit-${itemId}" name="wasteItems[${itemId}][unit]" required>
                    <option value="" disabled selected>Select unit</option>
                    <option value="pieces">Pieces</option>
                    <option value="packs">Packs</option>
                    <option value="kilogram">Kilogram</option>
                    <option value="servings">Servings</option>
                </select>
            </div>
            <div class="form-group file-upload-container">
                <label for="wasteDocumentation-${itemId}">Documentation <span class="required">*</span></label>
                <input type="file" id="wasteDocumentation-${itemId}" name="wasteItems[${itemId}][documentation]" 
                       required accept="image/*,.pdf" multiple 
                       onchange="createFilePreview(this, 'wasteDocumentation-${itemId}-preview')">
                <div id="wasteDocumentation-${itemId}-preview" class="file-preview"></div>
                <span class="note">Upload photos or PDFs (Max 10MB per file, 3 files max)</span>
            </div>
            <div class="form-group">
                <label for="wasteNotes-${itemId}">Additional Notes <span id="notes-required-${itemId}" class="required" style="display: none;">*</span></label>
                <textarea id="wasteNotes-${itemId}" name="wasteItems[${itemId}][notes]" rows="2" placeholder="Any additional information"></textarea>
                <span id="notes-note-${itemId}" class="note" style="margin-top: 5px; font-size: 12px; color: #666;"></span>
            </div>
        </div>
    `;
    
    wasteFields.appendChild(fieldGroup);
    
    setTimeout(() => {
        initSelect2Dropdown(`wasteItem-${itemId}`);
        toggleAdditionalNotesRequirement(itemId);
    }, 100);
}

function removeField(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.remove();
    }
}

function validateFiles(fileInput) {
    const maxSize = FILE_CONFIG.MAX_SIZE_PER_FILE;
    const maxFiles = FILE_CONFIG.MAX_FILES_PER_ITEM;
    const maxTotalSize = FILE_CONFIG.MAX_TOTAL_SIZE;
    
    if (fileInput.files.length > maxFiles) {
        return `Maximum ${maxFiles} files allowed`;
    }
    
    let totalSize = 0;
    
    for (let file of fileInput.files) {
        if (file.size > maxSize) {
            return `File "${file.name}" exceeds ${formatFileSize(maxSize)} limit (${formatFileSize(file.size)})`;
        }
        totalSize += file.size;
    }
    
    if (totalSize > maxTotalSize) {
        return `Total file size (${formatFileSize(totalSize)}) exceeds ${formatFileSize(maxTotalSize)} limit`;
    }
    
    return null;
}

function validateDynamicFields() {
    const expiredChecked = document.getElementById('expired').checked;
    const wasteChecked = document.getElementById('waste').checked;
    const noWasteChecked = document.getElementById('noWaste').checked;
    
    if (noWasteChecked) return true;
    
    if (expiredChecked) {
        const expiredItems = document.querySelectorAll('#expiredFields .field-group');
        if (expiredItems.length === 0) {
            showNotification('Please add at least one expired item.', 'error');
            return false;
        }
        
        for (let item of expiredItems) {
            const requiredFields = item.querySelectorAll('select[required], input[required]');
            const fileInput = item.querySelector('input[type="file"]');
            
            for (let field of requiredFields) {
                if (!field.value.trim()) {
                    showNotification('Please fill in all required fields for expired items.', 'error');
                    return false;
                }
            }
            
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
    }
    
    if (wasteChecked) {
        const wasteItems = document.querySelectorAll('#wasteFields .field-group');
        if (wasteItems.length === 0) {
            showNotification('Please add at least one waste item.', 'error');
            return false;
        }
        
        for (let item of wasteItems) {
            const requiredFields = item.querySelectorAll('select[required], input[required]');
            const fileInput = item.querySelector('input[type="file"]');
            
            for (let field of requiredFields) {
                if (!field.value.trim()) {
                    showNotification('Please fill in all required fields for waste items.', 'error');
                    return false;
                }
            }
            
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
            
            const itemId = item.id.split('-')[1];
            const reasonSelect = document.getElementById(`reason-${itemId}`);
            const notesTextarea = document.getElementById(`wasteNotes-${itemId}`);
            
            if (reasonSelect && notesTextarea) {
                const selectedReason = reasonSelect.value;
                
                if ((selectedReason === 'customer_return' || selectedReason === 'quality_issue' || selectedReason === 'other') && 
                    (!notesTextarea.value || notesTextarea.value.trim() === '')) {
                    
                    let reasonText = '';
                    if (selectedReason === 'customer_return') {
                        reasonText = 'customer return';
                    } else if (selectedReason === 'quality_issue') {
                        reasonText = 'quality issue';
                    } else if (selectedReason === 'other') {
                        reasonText = 'other';
                    }
                    
                    showNotification(`Additional notes are required for ${reasonText}. Please explain the reason.`, 'error');
                    notesTextarea.focus();
                    return false;
                }
            }
        }
    }
    
    return true;
}

// ================================
// RELIABLE EMAIL FUNCTION
// ================================
async function sendEmailConfirmation(reportData, reportId, itemsDetails, isResubmissionUpdate = false) {
    try {
        console.log('📧 Sending email confirmation...');
        
        if (!GAS_CONFIG.ENDPOINT) {
            return { success: false, error: 'Email service URL not configured' };
        }
        
        const submissionTime = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        let reportDetails = '';
        let htmlReportDetails = '';
        
        const expiredItems = itemsDetails.filter(item => item.type === 'expired');
        const wasteItems = itemsDetails.filter(item => item.type === 'waste');
        
        if (reportData.noWaste) {
            reportDetails = 'No waste or expired items to report for this period.';
            htmlReportDetails = '<li>No waste or expired items to report for this period.</li>';
        } else {
            if (expiredItems.length > 0) {
                reportDetails += 'EXPIRED ITEMS:\n';
                htmlReportDetails += '<h4>Expired Items:</h4><ul>';
                expiredItems.forEach((item, index) => {
                    const totalCost = (item.itemCost || 0) * (item.quantity || 0);
                    reportDetails += `${index + 1}. ${item.item || 'N/A'} - ${item.quantity || 0} ${item.unit || ''} (Cost: ₱${totalCost.toFixed(2)})\n`;
                    htmlReportDetails += `<li><strong>${item.item || 'N/A'}</strong> - ${item.quantity || 0} ${item.unit || ''} (Cost: ₱${totalCost.toFixed(2)})`;
                    if (item.notes) {
                        reportDetails += `   Notes: ${item.notes}\n`;
                        htmlReportDetails += `<br><small>Notes: ${item.notes}</small>`;
                    }
                    htmlReportDetails += '</li>';
                });
                htmlReportDetails += '</ul>';
            }
            
            if (wasteItems.length > 0) {
                reportDetails += '\nWASTE ITEMS:\n';
                htmlReportDetails += '<h4>Waste Items:</h4><ul>';
                wasteItems.forEach((item, index) => {
                    const totalCost = (item.itemCost || 0) * (item.quantity || 0);
                    reportDetails += `${index + 1}. ${item.item || 'N/A'} - ${item.quantity || 0} ${item.unit || ''} (Reason: ${item.reason || 'N/A'}) (Cost: ₱${totalCost.toFixed(2)})\n`;
                    htmlReportDetails += `<li><strong>${item.item || 'N/A'}</strong> - ${item.quantity || 0} ${item.unit || ''} (Reason: ${item.reason || 'N/A'}) (Cost: ₱${totalCost.toFixed(2)})`;
                    if (item.notes) {
                        reportDetails += `   Notes: ${item.notes}\n`;
                        htmlReportDetails += `<br><small>Notes: ${item.notes}</small>`;
                    }
                    htmlReportDetails += '</li>';
                });
                htmlReportDetails += '</ul>';
            }
        }
        
        const emailData = {
            to: reportData.email,
            subject: isResubmissionUpdate ? `Item Resubmitted - ${reportId}` : `Waste Report Confirmation - ${reportId}`,
            store: reportData.store || 'N/A',
            personnel: reportData.personnel || 'N/A',
            reportDate: formatDate(reportData.reportDate) || 'N/A',
            disposalTypes: reportData.disposalTypes || ['N/A'],
            itemCount: itemsDetails.length,
            reportDetails: reportDetails,
            htmlReportDetails: htmlReportDetails,
            submissionTime: submissionTime,
            reportId: reportId,
            totalBatches: reportData.totalBatches || 1,
            hasAttachments: reportData.hasImages || false,
            isResubmission: isResubmissionUpdate || false
        };

        const formData = new FormData();
        Object.keys(emailData).forEach(key => {
            formData.append(key, emailData[key]);
        });

        let success = false;
        
        try {
            const response = await fetch(GAS_CONFIG.ENDPOINT, {
                method: 'POST',
                body: formData
            });
            
            console.log('✅ FormData request sent (status:', response.status, ')');
            
            if (response.ok) {
                try {
                    const result = await response.json();
                    return { success: true, response: result };
                } catch (e) {
                    return { success: true, message: 'Email sent (non-JSON response)' };
                }
            }
        } catch (err) {
            console.log('FormData failed, trying fallback methods...', err);
        }
        
        try {
            const params = new URLSearchParams();
            Object.keys(emailData).forEach(key => params.append(key, emailData[key]));
            const url = `${GAS_CONFIG.ENDPOINT}?${params.toString()}`;
            
            const response = await fetch(url);
            if (response.ok) {
                console.log('✅ GET fallback request successful');
                return { success: true, message: 'Email sent via GET fallback' };
            }
        } catch (err) {
            console.log('GET fallback failed:', err);
        }
        
        return new Promise(resolve => {
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.name = 'gasIframe';
            
            const form = document.createElement('form');
            form.target = 'gasIframe';
            form.method = 'POST';
            form.action = GAS_CONFIG.ENDPOINT;
            
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = 'data';
            input.value = JSON.stringify(emailData);
            form.appendChild(input);
            
            document.body.appendChild(iframe);
            document.body.appendChild(form);
            
            iframe.onload = function() {
                setTimeout(() => {
                    document.body.removeChild(iframe);
                    document.body.removeChild(form);
                    console.log('✅ Iframe fallback submitted');
                    resolve({ success: true, message: 'Email sent via iframe fallback' });
                }, 1000);
            };
            
            form.submit();
        });
        
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return { success: false, error: error.message || 'Unknown error' };
    }
}

// ================================
// RESUBMISSION HANDLER - MODIFIED
// ================================
async function handleResubmission(originalItemData, updatedItem) {
    try {
        console.log('🔄 Processing resubmission...');
        
        const reportDoc = await db.collection('wasteReports').doc(originalItemData.reportId).get();
        
        if (!reportDoc.exists) {
            throw new Error('Original report not found');
        }
        
        const report = reportDoc.data();
        const itemsField = originalItemData.itemType === 'expired' ? 'expiredItems' : 'wasteItems';
        const items = report[itemsField] || [];
        
        if (originalItemData.itemIndex >= items.length) {
            throw new Error('Item index out of bounds');
        }
        
        // Update the existing item with resubmission data
        const originalItem = items[originalItemData.itemIndex];
        
        // Merge updated data with original item
        const mergedItem = {
            ...originalItem,
            ...updatedItem,
            approvalStatus: 'pending', // Reset to pending
            previousApprovalStatus: 'rejected', // Track previous status
            resubmitted: true,
            resubmissionCount: (originalItem.resubmissionCount || 0) + 1,
            resubmittedAt: new Date().toISOString(),
            resubmittedBy: 'User',
            previousRejectionReason: originalItem.rejectionReason,
            rejectionReason: null, // Clear rejection reason
            rejectedAt: null,
            rejectedBy: null
        };
        
        // Replace the item in the array
        items[originalItemData.itemIndex] = mergedItem;
        
        // Update the report in Firestore
        const updateData = {
            [itemsField]: items,
            updatedAt: new Date().toISOString(),
            hasResubmission: true
        };
        
        await db.collection('wasteReports').doc(originalItemData.reportId).update(updateData);
        
        console.log('✅ Item resubmitted successfully');
        
        // Send resubmission email
        const emailResult = await sendEmailConfirmation(
            report,
            originalItemData.reportId,
            [mergedItem],
            true // isResubmissionUpdate flag
        );
        
        return {
            success: true,
            reportId: originalItemData.reportId,
            emailSent: emailResult.success,
            item: mergedItem
        };
        
    } catch (error) {
        console.error('❌ Error processing resubmission:', error);
        throw error;
    }
}

// ================================
// OPTIMIZED FORM SUBMISSION HANDLER - MODIFIED
// ================================
async function handleSubmit(event) {
    console.log('Form submission started...');
    
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (!db || !storage) {
        showNotification('Error: Firebase not initialized. Cannot submit report.', 'error');
        return;
    }
    
    const submitBtn = document.querySelector('.submit-btn');
    if (!submitBtn) return;
    
    const originalText = submitBtn.textContent;
    
    if (!itemsLoaded || ITEMS_LIST.length === 0) {
        showNotification('Please wait for items to load before submitting.', 'error');
        return;
    }
    
    const requiredFields = ['email', 'store', 'personnel', 'reportDate'];
    for (let field of requiredFields) {
        const fieldElement = document.getElementById(field);
        if (!fieldElement || !fieldElement.value.trim()) {
            showNotification(`Please fill in the ${field} field.`, 'error');
            return;
        }
    }
    
    if (!validateDisposalTypeSelection()) return;
    if (!validateDynamicFields()) return;
    
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
    showLoading(true, 'Preparing submission...');
    showUploadProgress(false);
    
    const disposalTypes = [];
    const disposalTypeCheckboxes = document.querySelectorAll('input[name="disposalType"]:checked');
    disposalTypeCheckboxes.forEach(checkbox => {
        disposalTypes.push(checkbox.value);
    });
    
    // Check if this is a resubmission
    if (isResubmitting && originalItemData) {
        try {
            console.log('Processing resubmission...');
            
            // Collect the resubmitted item data
            let resubmittedItem = null;
            let itemId = null;
            
            if (originalItemData.itemType === 'expired') {
                const expiredFields = document.querySelectorAll('#expiredFields .field-group');
                if (expiredFields.length === 0) {
                    throw new Error('No expired item found for resubmission');
                }
                
                const field = expiredFields[0];
                itemId = field.id.split('-')[1];
                
                const dropdown = document.getElementById(`expiredItem-${itemId}`);
                let selectedItem = '';
                if (dropdown && dropdown.value) {
                    selectedItem = dropdown.value;
                } else {
                    const selectElement = $(`#expiredItem-${itemId}`);
                    if (selectElement.length > 0) {
                        selectedItem = selectElement.select2('data')[0]?.id || '';
                    }
                }
                
                const itemCost = await getItemCost(selectedItem);
                
                resubmittedItem = {
                    type: 'expired',
                    item: selectedItem,
                    deliveredDate: document.getElementById(`deliveredDate-${itemId}`).value,
                    manufacturedDate: document.getElementById(`manufacturedDate-${itemId}`).value,
                    expirationDate: document.getElementById(`expirationDate-${itemId}`).value,
                    quantity: parseFloat(document.getElementById(`quantity-${itemId}`).value) || 0,
                    unit: document.getElementById(`unit-${itemId}`).value,
                    notes: document.getElementById(`notes-${itemId}`).value.trim() || '',
                    itemId: originalItemData.originalItem.itemId || `item_${Date.now()}`,
                    itemCost: itemCost,
                    documentation: [],
                    approvalStatus: 'pending',
                    submittedAt: new Date().toISOString(),
                    previousApprovalStatus: 'rejected',
                    previousRejectionReason: originalItemData.originalItem.rejectionReason
                };
                
                // Check for files
                const fileInput = document.getElementById(`documentation-${itemId}`);
                if (fileInput && fileInput.files.length > 0) {
                    resubmittedItem.hasFiles = true;
                    resubmittedItem.fileCount = fileInput.files.length;
                    
                    // Upload files
                    const files = Array.from(fileInput.files);
                    const uploadedFiles = await uploadFilesForItemParallel(
                        files, 
                        originalItemData.reportId, 
                        `resubmitted-expired-${itemId}`
                    );
                    resubmittedItem.documentation = uploadedFiles;
                }
                
            } else {
                const wasteFields = document.querySelectorAll('#wasteFields .field-group');
                if (wasteFields.length === 0) {
                    throw new Error('No waste item found for resubmission');
                }
                
                const field = wasteFields[0];
                itemId = field.id.split('-')[1];
                
                const dropdown = document.getElementById(`wasteItem-${itemId}`);
                let selectedItem = '';
                if (dropdown && dropdown.value) {
                    selectedItem = dropdown.value;
                } else {
                    const selectElement = $(`#wasteItem-${itemId}`);
                    if (selectElement.length > 0) {
                        selectedItem = selectElement.select2('data')[0]?.id || '';
                    }
                }
                
                const itemCost = await getItemCost(selectedItem);
                
                resubmittedItem = {
                    type: 'waste',
                    item: selectedItem,
                    reason: document.getElementById(`reason-${itemId}`).value,
                    quantity: parseFloat(document.getElementById(`wasteQuantity-${itemId}`).value) || 0,
                    unit: document.getElementById(`wasteUnit-${itemId}`).value,
                    notes: document.getElementById(`wasteNotes-${itemId}`).value.trim() || '',
                    itemId: originalItemData.originalItem.itemId || `item_${Date.now()}`,
                    itemCost: itemCost,
                    documentation: [],
                    approvalStatus: 'pending',
                    submittedAt: new Date().toISOString(),
                    previousApprovalStatus: 'rejected',
                    previousRejectionReason: originalItemData.originalItem.rejectionReason
                };
                
                // Check for files
                const fileInput = document.getElementById(`wasteDocumentation-${itemId}`);
                if (fileInput && fileInput.files.length > 0) {
                    resubmittedItem.hasFiles = true;
                    resubmittedItem.fileCount = fileInput.files.length;
                    
                    // Upload files
                    const files = Array.from(fileInput.files);
                    const uploadedFiles = await uploadFilesForItemParallel(
                        files, 
                        originalItemData.reportId, 
                        `resubmitted-waste-${itemId}`
                    );
                    resubmittedItem.documentation = uploadedFiles;
                }
            }
            
            // Update the original report
            const result = await handleResubmission(originalItemData, resubmittedItem);
            
            showNotification('✅ Item resubmitted successfully! The original report has been updated.', 'success');
            
            // Reset form
            const form = document.getElementById('wasteReportForm');
            if (form) {
                form.reset();
                
                const today = new Date().toISOString().split('T')[0];
                const reportDateInput = document.getElementById('reportDate');
                if (reportDateInput) {
                    reportDateInput.value = today;
                }
                
                const expiredFields = document.getElementById('expiredFields');
                const wasteFields = document.getElementById('wasteFields');
                if (expiredFields) expiredFields.innerHTML = '';
                if (wasteFields) wasteFields.innerHTML = '';
                
                const expiredContainer = document.getElementById('expiredContainer');
                const wasteContainer = document.getElementById('wasteContainer');
                if (expiredContainer) expiredContainer.classList.remove('show');
                if (wasteContainer) wasteContainer.classList.remove('show');
                
                updateDisposalTypeHint();
                
                isResubmitting = false;
                originalItemData = null;
            }
            
            // Re-enable submit button
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            showLoading(false);
            
            // Ask user to view reports
            setTimeout(() => {
                const viewReports = confirm(
                    `Item successfully resubmitted!\n\n✅ Original report updated\n📧 Notification sent\n🔄 Item status reset to pending\n\nWould you like to view the updated report?`
                );
                if (viewReports) {
                    window.location.href = 'waste_report_table.html';
                }
            }, 1500);
            
        } catch (error) {
            console.error('❌ Error resubmitting item:', error);
            showNotification('Error resubmitting item: ' + error.message, 'error');
            
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            showLoading(false);
        }
        
        return;
    }
    
    // Regular new report submission (unchanged)
    const mainReportId = 'REPORT-' + Date.now().toString();
    
    const baseReportData = {
        email: document.getElementById('email').value.trim(),
        store: document.getElementById('store').value,
        personnel: document.getElementById('personnel').value.trim(),
        reportDate: document.getElementById('reportDate').value,
        disposalTypes: disposalTypes,
        reportId: mainReportId,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'submitted',
        createdAt: new Date().toISOString(),
        emailSent: false,
        emailStatus: 'pending',
        isResubmission: false
    };
    
    if (disposalTypes.includes('noWaste')) {
        baseReportData.noWaste = true;
        baseReportData.notes = "No waste or expired items to report for this period";
    }
    
    try {
        console.log('Processing new report data for ID:', mainReportId);
        
        // Collect all items data first (without files)
        let allItems = [];
        let totalFiles = 0;
        
        // Process expired items data
        if (disposalTypes.includes('expired')) {
            const expiredFields = document.querySelectorAll('#expiredFields .field-group');
            
            for (let field of expiredFields) {
                const itemId = field.id.split('-')[1];
                
                const dropdown = document.getElementById(`expiredItem-${itemId}`);
                let selectedItem = '';
                if (dropdown && dropdown.value) {
                    selectedItem = dropdown.value;
                } else {
                    const selectElement = $(`#expiredItem-${itemId}`);
                    if (selectElement.length > 0) {
                        selectedItem = selectElement.select2('data')[0]?.id || '';
                    }
                }
                
                const itemCost = await getItemCost(selectedItem);
                
                const expiredItem = {
                    type: 'expired',
                    item: selectedItem,
                    deliveredDate: document.getElementById(`deliveredDate-${itemId}`).value,
                    manufacturedDate: document.getElementById(`manufacturedDate-${itemId}`).value,
                    expirationDate: document.getElementById(`expirationDate-${itemId}`).value,
                    quantity: parseFloat(document.getElementById(`quantity-${itemId}`).value) || 0,
                    unit: document.getElementById(`unit-${itemId}`).value,
                    notes: document.getElementById(`notes-${itemId}`).value.trim() || '',
                    itemId: itemId,
                    itemCost: itemCost,
                    documentation: [],
                    approvalStatus: 'pending',
                    submittedAt: new Date().toISOString()
                };
                
                // Check for files
                const fileInput = document.getElementById(`documentation-${itemId}`);
                if (fileInput && fileInput.files.length > 0) {
                    expiredItem.hasFiles = true;
                    expiredItem.fileCount = fileInput.files.length;
                    totalFiles += fileInput.files.length;
                }
                
                allItems.push(expiredItem);
            }
            
            baseReportData.totalExpiredItems = allItems.filter(item => item.type === 'expired').length;
        }
        
        // Process waste items data
        if (disposalTypes.includes('waste')) {
            const wasteFields = document.querySelectorAll('#wasteFields .field-group');
            
            for (let field of wasteFields) {
                const itemId = field.id.split('-')[1];
                
                const dropdown = document.getElementById(`wasteItem-${itemId}`);
                let selectedItem = '';
                if (dropdown && dropdown.value) {
                    selectedItem = dropdown.value;
                } else {
                    const selectElement = $(`#wasteItem-${itemId}`);
                    if (selectElement.length > 0) {
                        selectedItem = selectElement.select2('data')[0]?.id || '';
                    }
                }
                
                const itemCost = await getItemCost(selectedItem);
                
                const wasteItem = {
                    type: 'waste',
                    item: selectedItem,
                    reason: document.getElementById(`reason-${itemId}`).value,
                    quantity: parseFloat(document.getElementById(`wasteQuantity-${itemId}`).value) || 0,
                    unit: document.getElementById(`wasteUnit-${itemId}`).value,
                    notes: document.getElementById(`wasteNotes-${itemId}`).value.trim() || '',
                    itemId: itemId,
                    itemCost: itemCost,
                    documentation: [],
                    approvalStatus: 'pending',
                    submittedAt: new Date().toISOString()
                };
                
                // Check for files
                const fileInput = document.getElementById(`wasteDocumentation-${itemId}`);
                if (fileInput && fileInput.files.length > 0) {
                    wasteItem.hasFiles = true;
                    wasteItem.fileCount = fileInput.files.length;
                    totalFiles += fileInput.files.length;
                }
                
                allItems.push(wasteItem);
            }
            
            baseReportData.totalWasteItems = allItems.filter(item => item.type === 'waste').length;
        }
        
        // Update with file info
        baseReportData.hasImages = totalFiles > 0;
        baseReportData.imageCount = totalFiles;
        baseReportData.fileUploadComplete = false;
        
        // Save to Firestore FIRST (before file uploads)
        console.log('Saving report to Firestore (initial)...');
        const docRef = db.collection('wasteReports').doc(mainReportId);
        await docRef.set(baseReportData);
        
        console.log('✅ Initial report saved to Firestore');
        
        // Step 1: Send email confirmation NOW (before file uploads)
        showLoading(true, 'Sending email confirmation...');
        const emailResult = await sendEmailConfirmation(baseReportData, mainReportId, allItems, false);
        
        if (emailResult.success) {
            console.log('✅ Email confirmation sent');
            await docRef.update({
                emailSent: true,
                emailSentAt: new Date().toISOString(),
                emailStatus: 'sent',
                emailService: 'Google Apps Script'
            });
            
            showNotification('✅ Email confirmation sent!', 'success');
        } else {
            console.warn('⚠️ Email sending failed:', emailResult.error);
            await docRef.update({
                emailSent: false,
                emailError: emailResult.error,
                emailStatus: 'failed',
                lastEmailAttempt: new Date().toISOString()
            });
            
            showNotification('⚠️ Report saved, but email failed. Please check email configuration.', 'warning');
        }
        
        // If there are files, upload them in background
        if (totalFiles > 0) {
            showLoading(true, 'Uploading files in background...');
            showUploadProgress(true, 0, totalFiles, 'Starting file upload...');
            
            // Process uploads in background
            setTimeout(async () => {
                try {
                    // Upload files with progress
                    const processedItems = await processAllItemsWithUploads(
                        mainReportId,
                        allItems,
                        (completed, total) => {
                            const progress = (completed / total) * 100;
                            showUploadProgress(true, completed, total, `Item ${completed}/${total}`);
                        }
                    );
                    
                    // Update Firestore with file information
                    const expiredItems = processedItems.filter(item => item.type === 'expired');
                    const wasteItems = processedItems.filter(item => item.type === 'waste');
                    
                    const updateData = {};
                    if (expiredItems.length > 0) {
                        updateData.expiredItems = expiredItems;
                        updateData.totalExpiredItems = expiredItems.length;
                    }
                    if (wasteItems.length > 0) {
                        updateData.wasteItems = wasteItems;
                        updateData.totalWasteItems = wasteItems.length;
                    }
                    
                    // Calculate totals
                    const uploadedFiles = processedItems.reduce((sum, item) => sum + (item.documentation?.length || 0), 0);
                    const totalStorage = processedItems.reduce((sum, item) => sum + (item.storageUsed || 0), 0);
                    const totalOriginalSize = processedItems.reduce((sum, item) => sum + (item.originalFileSize || 0), 0);
                    
                    updateData.hasImages = uploadedFiles > 0;
                    updateData.imageCount = uploadedFiles;
                    updateData.storageUsed = totalStorage;
                    updateData.originalFileSize = totalOriginalSize;
                    updateData.fileUploadComplete = true;
                    updateData.fileUploadedAt = new Date().toISOString();
                    
                    await docRef.update(updateData);
                    
                    console.log('✅ Files uploaded and report updated');
                    showUploadProgress(false);
                    showLoading(false);
                    
                    if (uploadedFiles > 0) {
                        showNotification('✅ All files uploaded successfully!', 'success');
                    }
                    
                } catch (uploadError) {
                    console.error('File upload failed:', uploadError);
                    showUploadProgress(false);
                    showLoading(false);
                    
                    // Mark as failed but report is still saved
                    await docRef.update({
                        fileUploadError: uploadError.message,
                        fileUploadComplete: false
                    });
                    
                    showNotification('⚠️ Some files failed to upload. Report was still saved successfully.', 'warning');
                }
            }, 100);
        } else {
            // No files, just mark as complete
            await docRef.update({
                fileUploadComplete: true,
                hasImages: false,
                imageCount: 0
            });
            
            showLoading(false);
            showNotification('✅ Report submitted successfully! Email sent.', 'success');
        }
        
        // Reset form
        const form = document.getElementById('wasteReportForm');
        if (form) {
            form.reset();
            
            const today = new Date().toISOString().split('T')[0];
            const reportDateInput = document.getElementById('reportDate');
            if (reportDateInput) {
                reportDateInput.value = today;
            }
            
            const expiredFields = document.getElementById('expiredFields');
            const wasteFields = document.getElementById('wasteFields');
            if (expiredFields) expiredFields.innerHTML = '';
            if (wasteFields) wasteFields.innerHTML = '';
            
            const expiredContainer = document.getElementById('expiredContainer');
            const wasteContainer = document.getElementById('wasteContainer');
            if (expiredContainer) expiredContainer.classList.remove('show');
            if (wasteContainer) wasteContainer.classList.remove('show');
            
            updateDisposalTypeHint();
        }
        
        // Re-enable submit button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        
        // Ask user to view reports
        setTimeout(() => {
            const viewReports = confirm(
                `Report ${mainReportId} has been submitted successfully!\n\n✅ Data saved to database\n📧 Email sent to ${baseReportData.email}\n${totalFiles > 0 ? '📁 Files uploading in background\n' : ''}\nWould you like to view all reports?`
            );
            if (viewReports) {
                window.location.href = 'waste_report_table.html';
            }
        }, 1500);
        
    } catch (error) {
        console.error('❌ Error submitting report:', error);
        
        let errorMessage = 'Error submitting report: ';
        errorMessage += error.message || 'Unknown error';
        
        showNotification(errorMessage, 'error');
        
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        showLoading(false);
        showUploadProgress(false);
        
        // Save to localStorage as backup
        try {
            const reports = JSON.parse(localStorage.getItem('wasteReports_backup') || '[]');
            reports.push({
                ...baseReportData,
                savedLocally: true,
                error: error.message,
                timestamp: new Date().toISOString()
            });
            localStorage.setItem('wasteReports_backup', JSON.stringify(reports));
        } catch (localError) {
            console.error('Could not save to localStorage:', localError);
        }
    }
}

// ================================
// MODAL FUNCTIONS
// ================================
function closeDetailsModal() {
    const detailsModal = document.getElementById('detailsModal');
    if (detailsModal) {
        detailsModal.style.display = 'none';
    }
}

// ================================
// CHECK URL PARAMETERS FOR ITEM ID
// ================================
function checkUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('itemId');
    
    if (itemId) {
        document.getElementById('itemId').value = itemId;
        showNotification('Item ID detected from URL. Click "Load Rejected Item" to populate the form.', 'info');
        
        setTimeout(() => {
            if (!isResubmitting) {
                const loadBtn = document.getElementById('loadItemButton');
                if (loadBtn) {
                    loadBtn.focus();
                }
            }
        }, 1000);
    }
}

// ================================
// INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Document loaded, initializing form...');
    
    const reportDateInput = document.getElementById('reportDate');
    if (reportDateInput) {
        const today = new Date().toISOString().split('T')[0];
        reportDateInput.value = today;
    }
    
    const form = document.getElementById('wasteReportForm');
    if (form) {
        form.addEventListener('submit', function(e) {
            console.log('Form submit event triggered');
            handleSubmit(e);
        });
    }
    
    const disposalTypeCheckboxes = document.querySelectorAll('input[name="disposalType"]');
    disposalTypeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            toggleDisposalType(this.id);
        });
    });
    
    updateDisposalTypeHint();
    
    try {
        await fetchItemsFromFirestore();
    } catch (error) {
        console.error('Failed to load items:', error);
        showNotification('Failed to load items. Please refresh the page.', 'error');
    }
    
    checkUrlParameters();
    
    window.addEventListener('click', function(event) {
        const detailsModal = document.getElementById('detailsModal');
        if (event.target === detailsModal) {
            closeDetailsModal();
        }
    });
    
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            closeDetailsModal();
        }
    });
});

// Export functions for global access
window.loadRejectedItem = loadRejectedItem;
window.addExpiredItem = addExpiredItem;
window.addWasteItem = addWasteItem;
window.removeField = removeField;
window.toggleDisposalType = toggleDisposalType;
window.toggleAdditionalNotesRequirement = toggleAdditionalNotesRequirement;
window.debugSubmit = handleSubmit;