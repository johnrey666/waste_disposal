// ================================
// ENHANCED LOADER FUNCTIONS
// ================================
const Loader = {
    overlay: document.getElementById('loadingOverlay'),
    textElement: document.getElementById('loaderText'),
    progressContainer: document.getElementById('uploadProgress'),
    progressFill: document.getElementById('progressFill'),
    progressText: document.getElementById('progressText'),
    progressDetails: document.getElementById('progressDetails'),
    
    show(message = 'Loading...') {
        if (!this.overlay) return;
        
        requestAnimationFrame(() => {
            this.overlay.style.display = 'flex';
            if (this.textElement) {
                this.textElement.textContent = message;
            }
            if (this.progressContainer) {
                this.progressContainer.style.display = 'none';
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
    },
    
    showUpload(current = 0, total = 0, fileName = '') {
        if (!this.progressContainer || !this.progressFill || !this.progressText) return;
        
        this.progressContainer.style.display = 'block';
        
        if (total > 0) {
            const percentage = Math.round((current / total) * 100);
            this.progressFill.style.width = `${percentage}%`;
            this.progressText.textContent = `Uploading: ${percentage}%`;
            
            if (fileName) {
                this.progressDetails.textContent = `File: ${fileName}`;
            }
        }
    },
    
    hideUpload() {
        if (this.progressContainer) {
            this.progressContainer.style.display = 'none';
        }
        if (this.progressFill) {
            this.progressFill.style.width = '0%';
        }
        if (this.progressText) {
            this.progressText.textContent = 'Uploading: 0%';
        }
        if (this.progressDetails) {
            this.progressDetails.textContent = '';
        }
    },
    
    updateUpload(current, total, fileName = '') {
        if (!this.progressContainer || !this.progressFill || !this.progressText) return;
        
        const percentage = Math.round((current / total) * 100);
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = `Uploading: ${percentage}%`;
        
        if (fileName) {
            this.progressDetails.textContent = `File: ${fileName}`;
        }
    }
};

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
// ITEMS LIST FOR DROPDOWN - UPDATED WITH KITCHEN CATEGORIES
// ================================
let ALL_ITEMS_LIST = [];           // All items from database
let REGULAR_ITEMS_LIST = [];       // Only regular items
let KITCHEN_ITEMS_LIST = [];       // Only kitchen items
let KITCHEN_ITEMS_BY_CATEGORY = {  // Kitchen items grouped by category
    meat: [],
    vegetables: [],
    seafood: []
};

let itemsLoaded = false;
let isResubmitting = false;
let originalItemData = null;
let currentStoreType = 'regular'; // 'regular' or 'kitchen'

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

// Wrapper functions for backward compatibility
function showLoading(show, message = '') {
    if (show) {
        Loader.show(message);
    } else {
        Loader.hide();
    }
}

function showUploadProgress(show, current = 0, total = 0, fileName = '') {
    if (show) {
        Loader.showUpload(current, total, fileName);
    } else {
        Loader.hideUpload();
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
// STORE HANDLER - NEW FUNCTION
// ================================
function handleStoreChange(selectElement) {
    const selectedStore = selectElement.value;
    const indicator = document.getElementById('storeTypeIndicator');
    const indicatorText = document.getElementById('storeTypeText');
    
    // Define kitchen stores
    const kitchenStores = ['CTK', 'Concourse', 'FG Kitchen LC', 'FG Kitchen Naga'];
    
    if (kitchenStores.includes(selectedStore)) {
        currentStoreType = 'kitchen';
        indicator.style.display = 'flex';
        indicator.className = 'store-type-indicator kitchen';
        indicatorText.innerHTML = '<strong>Kitchen Location Selected</strong> - Only kitchen items (Meat, Vegetables, Seafood) will be available in dropdowns.';
        
        showNotification('Kitchen location selected. Item dropdowns now show kitchen items only.', 'info');
    } else if (selectedStore && selectedStore !== '') {
        currentStoreType = 'regular';
        indicator.style.display = 'flex';
        indicator.className = 'store-type-indicator regular';
        indicatorText.innerHTML = '<strong>Regular Store Selected</strong> - All store items will be available in dropdowns.';
        
        showNotification('Regular store selected. Item dropdowns now show all store items.', 'info');
    } else {
        currentStoreType = 'regular';
        indicator.style.display = 'none';
    }
    
    // Refresh all dropdowns with the new filtered items
    refreshAllDropdowns();
}

// ================================
// UPDATE DISPOSAL TYPES PREVIEW
// ================================
function updateDisposalTypesPreview() {
    const disposalTypeCheckboxes = document.querySelectorAll('input[name="disposalType"]:checked');
    const previewContainer = document.getElementById('disposalTypesPreview');
    const tagsContainer = document.getElementById('disposalTypesTags');
    
    if (!previewContainer || !tagsContainer) return;
    
    if (disposalTypeCheckboxes.length === 0) {
        previewContainer.style.display = 'none';
        return;
    }
    
    const disposalTypeMap = {
        'expired': 'Expired Items',
        'waste': 'Waste',
        'noWaste': 'No Waste'
    };
    
    tagsContainer.innerHTML = '';
    
    disposalTypeCheckboxes.forEach(checkbox => {
        const tag = document.createElement('span');
        tag.className = 'disposal-type-tag';
        tag.textContent = disposalTypeMap[checkbox.value] || checkbox.value;
        tagsContainer.appendChild(tag);
    });
    
    previewContainer.style.display = 'block';
}

// ================================
// OPTIMIZED FIREBASE STORAGE FUNCTIONS - FIXED
// ================================

// CRITICAL FIX: Upload files with correct path structure
async function uploadFilesForItemParallel(files, reportId, itemId, itemType, itemIndex) {
    const uploadedFiles = [];
    
    // Clean itemId and create a clean identifier
    const cleanItemId = itemId.replace(/[^a-zA-Z0-9]/g, '_');
    const cleanItemType = itemType === 'expired' ? 'expired' : 'waste';
    
    console.log(`📤 Uploading files for: Report=${reportId}, Item=${cleanItemId}, Type=${cleanItemType}, Index=${itemIndex}`);
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        try {
            let fileToUpload = file;
            if (file.size > 2 * 1024 * 1024 && file.type.startsWith('image/')) {
                fileToUpload = await prepareFileForUpload(file);
            }
            
            const timestamp = Date.now() + i;
            const randomString = Math.random().toString(36).substring(7);
            const fileExtension = file.name.split('.').pop();
            
            // CRITICAL FIX: Use a clean, consistent path structure
            const fileName = `reports/${reportId}/${cleanItemType}_${cleanItemId}_${i}_${timestamp}.${fileExtension}`;
            
            console.log(`📁 Storage path: ${fileName}`);
            
            const storageRef = storage.ref().child(fileName);
            const uploadTask = storageRef.put(fileToUpload);
            
            const result = await new Promise((resolve, reject) => {
                uploadTask.on(
                    'state_changed',
                    null,
                    reject,
                    async () => {
                        try {
                            const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                            console.log(`✅ File uploaded: ${fileName}`);
                            console.log(`🔗 Download URL: ${downloadURL}`);
                            
                            resolve({
                                url: downloadURL,
                                name: file.name,
                                type: file.type,
                                size: fileToUpload.size,
                                path: fileName, // CRITICAL: This is what waste_report_table.js needs
                                storagePath: fileName,
                                originalName: file.name,
                                uploadedAt: new Date().toISOString(),
                                fileIndex: i
                            });
                        } catch (error) {
                            reject(error);
                        }
                    }
                );
            });
            
            uploadedFiles.push(result);
            
            // Update progress
            const currentProgress = (uploadedFiles.length / files.length) * 100;
            Loader.updateUpload(uploadedFiles.length, files.length, `${uploadedFiles.length}/${files.length} files`);
            
        } catch (error) {
            console.error(`❌ Failed to upload file ${file.name}:`, error);
            throw new Error(`Failed to upload ${file.name}: ${error.message}`);
        }
    }
    
    console.log(`✅ All files uploaded for item ${cleanItemId}:`, uploadedFiles);
    return uploadedFiles.sort((a, b) => a.fileIndex - b.fileIndex);
}

// Process all items with uploads - FIXED
async function processAllItemsWithUploads(reportId, allItems, progressCallback) {
    const totalItems = allItems.length;
    let completedItems = 0;
    
    console.log(`🔄 Processing ${totalItems} items with uploads for report ${reportId}`);
    
    for (let i = 0; i < allItems.length; i++) {
        const item = allItems[i];
        const itemId = item.itemId;
        const itemType = item.type;
        const itemIndex = i;
        
        const fileInput = document.getElementById(
            item.type === 'expired' ? `documentation-${itemId}` : `wasteDocumentation-${itemId}`
        );
        
        if (fileInput && fileInput.files.length > 0) {
            const files = Array.from(fileInput.files);
            console.log(`📄 Found ${files.length} files for item ${itemId} (${itemType})`);
            
            try {
                const uploadedFiles = await uploadFilesForItemParallel(files, reportId, itemId, itemType, itemIndex);
                
                // CRITICAL: Store the documentation with proper structure
                item.documentation = uploadedFiles.map(file => ({
                    url: file.url,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    path: file.path, // This is what waste_report_table.js looks for
                    storagePath: file.storagePath,
                    originalName: file.originalName,
                    uploadedAt: file.uploadedAt
                }));
                
                item.totalFiles = uploadedFiles.length;
                item.hasImages = uploadedFiles.length > 0;
                item.storageUsed = uploadedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
                item.originalFileSize = files.reduce((sum, file) => sum + file.size, 0);
                
                console.log(`✅ Files processed for item ${itemId}:`, item.documentation);
                
            } catch (error) {
                console.error(`❌ Failed to upload files for item ${itemId}:`, error);
                throw error;
            }
        } else {
            item.documentation = [];
            item.totalFiles = 0;
            item.hasImages = false;
            console.log(`ℹ️ No files for item ${itemId}`);
        }
        
        completedItems++;
        if (progressCallback) {
            progressCallback(completedItems, totalItems);
        }
    }
    
    console.log(`✅ All items processed for report ${reportId}`);
    return allItems;
}

// ================================
// FETCH ITEMS FROM FIRESTORE - UPDATED WITH KITCHEN CATEGORIES
// ================================
async function fetchItemsFromFirestore() {
    try {
        if (!db) {
            console.error('Firebase not initialized');
            throw new Error('Firebase not initialized');
        }
        
        console.log('Fetching items from Firestore...');
        Loader.show('Loading items...');
        
        const snapshot = await db.collection('items')
            .orderBy('name', 'asc')
            .get();
        
        ALL_ITEMS_LIST = [];
        REGULAR_ITEMS_LIST = [];
        KITCHEN_ITEMS_LIST = [];
        KITCHEN_ITEMS_BY_CATEGORY = {
            meat: [],
            vegetables: [],
            seafood: []
        };
        
        snapshot.forEach(doc => {
            const itemData = doc.data();
            const itemName = itemData.name;
            const category = itemData.category || 'regular';
            const kitchenCategory = itemData.kitchenCategory;
            
            // Add to all items
            ALL_ITEMS_LIST.push(itemName);
            
            // Categorize by type
            if (category === 'kitchen') {
                KITCHEN_ITEMS_LIST.push(itemName);
                
                // Group by kitchen category
                if (kitchenCategory === 'meat') {
                    KITCHEN_ITEMS_BY_CATEGORY.meat.push(itemName);
                } else if (kitchenCategory === 'vegetables') {
                    KITCHEN_ITEMS_BY_CATEGORY.vegetables.push(itemName);
                } else if (kitchenCategory === 'seafood') {
                    KITCHEN_ITEMS_BY_CATEGORY.seafood.push(itemName);
                }
            } else {
                REGULAR_ITEMS_LIST.push(itemName);
            }
        });
        
        // Sort all lists alphabetically
        REGULAR_ITEMS_LIST.sort();
        KITCHEN_ITEMS_LIST.sort();
        KITCHEN_ITEMS_BY_CATEGORY.meat.sort();
        KITCHEN_ITEMS_BY_CATEGORY.vegetables.sort();
        KITCHEN_ITEMS_BY_CATEGORY.seafood.sort();
        
        console.log(`✅ Loaded ${ALL_ITEMS_LIST.length} total items from Firestore`);
        console.log(`   - Regular items: ${REGULAR_ITEMS_LIST.length}`);
        console.log(`   - Kitchen items: ${KITCHEN_ITEMS_LIST.length}`);
        console.log(`     • Meat: ${KITCHEN_ITEMS_BY_CATEGORY.meat.length}`);
        console.log(`     • Vegetables: ${KITCHEN_ITEMS_BY_CATEGORY.vegetables.length}`);
        console.log(`     • Seafood: ${KITCHEN_ITEMS_BY_CATEGORY.seafood.length}`);
        
        itemsLoaded = true;
        
        // Initialize any existing dropdowns
        initializeAllSelect2Dropdowns();
        return ALL_ITEMS_LIST;
        
    } catch (error) {
        console.error('❌ Error fetching items from Firestore:', error);
        showNotification('Failed to load items from database. Please try again.', 'error');
        throw error;
    } finally {
        Loader.hide();
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

// ================================
// REFRESH ALL DROPDOWNS - NEW FUNCTION
// ================================
function refreshAllDropdowns() {
    // Refresh all expired item dropdowns
    const expiredFields = document.querySelectorAll('#expiredFields .field-group');
    expiredFields.forEach(field => {
        const itemId = field.id.split('-')[1];
        const selectId = `expiredItem-${itemId}`;
        const selectElement = document.getElementById(selectId);
        if (selectElement) {
            // Destroy and recreate
            $(`#${selectId}`).select2('destroy');
            initSelect2Dropdown(selectId);
        }
    });
    
    // Refresh all waste item dropdowns
    const wasteFields = document.querySelectorAll('#wasteFields .field-group');
    wasteFields.forEach(field => {
        const itemId = field.id.split('-')[1];
        const selectId = `wasteItem-${itemId}`;
        const selectElement = document.getElementById(selectId);
        if (selectElement) {
            // Destroy and recreate
            $(`#${selectId}`).select2('destroy');
            initSelect2Dropdown(selectId);
        }
    });
}

// ================================
// INITIALIZE SELECT2 DROPDOWN - UPDATED WITH KITCHEN CATEGORIES
// ================================
function initSelect2Dropdown(selectElementId) {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) return;
    
    // Determine which items to show based on store type
    let itemsToShow = [];
    let groupedItems = [];
    
    if (currentStoreType === 'kitchen') {
        // Kitchen store - show kitchen items grouped by category
        itemsToShow = KITCHEN_ITEMS_LIST;
        
        // Create grouped options
        if (KITCHEN_ITEMS_BY_CATEGORY.meat.length > 0) {
            groupedItems.push({
                text: '🥩 MEAT',
                children: KITCHEN_ITEMS_BY_CATEGORY.meat.map(item => ({ id: item, text: item }))
            });
        }
        if (KITCHEN_ITEMS_BY_CATEGORY.vegetables.length > 0) {
            groupedItems.push({
                text: '🥬 VEGETABLES',
                children: KITCHEN_ITEMS_BY_CATEGORY.vegetables.map(item => ({ id: item, text: item }))
            });
        }
        if (KITCHEN_ITEMS_BY_CATEGORY.seafood.length > 0) {
            groupedItems.push({
                text: '🦐 SEAFOOD',
                children: KITCHEN_ITEMS_BY_CATEGORY.seafood.map(item => ({ id: item, text: item }))
            });
        }
    } else {
        // Regular store - show all items (regular + kitchen)
        // But separate them into groups for better UX
        if (REGULAR_ITEMS_LIST.length > 0) {
            groupedItems.push({
                text: '📦 STORE ITEMS',
                children: REGULAR_ITEMS_LIST.map(item => ({ id: item, text: item }))
            });
        }
        if (KITCHEN_ITEMS_LIST.length > 0) {
            groupedItems.push({
                text: '🍳 KITCHEN ITEMS',
                children: KITCHEN_ITEMS_LIST.map(item => ({ id: item, text: item }))
            });
        }
    }
    
    // If no grouped items, show all items flat
    if (groupedItems.length === 0 && itemsToShow.length > 0) {
        groupedItems = itemsToShow.map(item => ({ id: item, text: item }));
    }
    
    // Initialize select2
    $(`#${selectElementId}`).select2({
        data: groupedItems,
        placeholder: "Select or type to search...",
        allowClear: false,
        width: '100%',
        dropdownParent: $(`#${selectElementId}`).parent(),
        templateResult: formatItemResult,
        templateSelection: formatItemSelection
    });
}

// Format item result for dropdown display
function formatItemResult(item) {
    if (!item.id) {
        return item.text;
    }
    
    // Check if this is a kitchen item
    const isKitchenItem = KITCHEN_ITEMS_LIST.includes(item.id);
    
    if (isKitchenItem) {
        // Determine kitchen category
        let categoryClass = '';
        let categoryText = '';
        
        if (KITCHEN_ITEMS_BY_CATEGORY.meat.includes(item.id)) {
            categoryClass = 'category-meat';
            categoryText = 'MEAT';
        } else if (KITCHEN_ITEMS_BY_CATEGORY.vegetables.includes(item.id)) {
            categoryClass = 'category-vegetables';
            categoryText = 'VEG';
        } else if (KITCHEN_ITEMS_BY_CATEGORY.seafood.includes(item.id)) {
            categoryClass = 'category-seafood';
            categoryText = 'SEA';
        }
        
        return $(`<span><i class="fas fa-utensils" style="margin-right: 5px; color: #856404;"></i> ${item.text} <span class="kitchen-category-badge ${categoryClass}">${categoryText}</span></span>`);
    } else {
        return $(`<span><i class="fas fa-box" style="margin-right: 5px; color: #2e7d32;"></i> ${item.text}</span>`);
    }
}

// Format item selection
function formatItemSelection(item) {
    if (!item.id) {
        return item.text;
    }
    return item.text;
}

function initializeAllSelect2Dropdowns() {
    $('.item-dropdown').each(function() {
        const selectId = $(this).attr('id');
        if (selectId) {
            initSelect2Dropdown(selectId);
        }
    });
}

// ================================
// LOAD REJECTED ITEM FUNCTION - UPDATED TO ALLOW DATE EDITING
// ================================
async function loadRejectedItem() {
    const itemIdInput = document.getElementById('itemId');
    const itemId = itemIdInput ? itemIdInput.value.trim() : '';
    
    if (!itemId) {
        showNotification('Please enter an Item ID', 'error');
        return;
    }
    
    Loader.show('Searching for rejected item...');
    
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
            originalItem: rejectedItem,
            originalReportDate: report.reportDate // Store original report date
        };
        
        isResubmitting = true;
        
        // Set store based on original item
        const store = report.store || '';
        const storeSelect = document.getElementById('store');
        if (storeSelect) {
            // Use Select2 to set value
            $(storeSelect).val(store).trigger('change');
            // Trigger store change handler
            handleStoreChange({ value: store });
        }
        
        // FIX: Use original report date instead of today's date
        const reportDateInput = document.getElementById('reportDate');
        const reportDateNote = document.getElementById('reportDateNote');
        
        if (reportDateInput) {
            // Set to original report date
            reportDateInput.value = report.reportDate || new Date().toISOString().split('T')[0];
            
            // Add note about date editing
            if (reportDateNote) {
                reportDateNote.innerHTML = '<i class="fas fa-info-circle"></i> You can edit this date if needed. Original report date was ' + formatDate(report.reportDate);
            }
            
            // Enable date editing
            reportDateInput.disabled = false;
            reportDateInput.style.backgroundColor = '#fff';
            reportDateInput.style.cursor = 'text';
        }
        
        // Fill other form fields from original report
        document.getElementById('email').value = report.email || '';
        document.getElementById('personnel').value = report.personnel || '';
        
        // Set disposal types based on item type
        if (itemType === 'expired') {
            document.getElementById('expired').checked = true;
            toggleDisposalType('expired');
        } else if (itemType === 'waste') {
            document.getElementById('waste').checked = true;
            toggleDisposalType('waste');
        }
        
        // Clear existing fields
        const expiredFields = document.getElementById('expiredFields');
        const wasteFields = document.getElementById('wasteFields');
        if (expiredFields) expiredFields.innerHTML = '';
        if (wasteFields) wasteFields.innerHTML = '';
        
        // Add item with data
        if (itemType === 'expired') {
            addExpiredItemWithData(rejectedItem);
        } else {
            addWasteItemWithData(rejectedItem);
        }
        
        showNotification('Rejected item loaded. You can edit all fields including the date for resubmission.', 'success');
        
        // Scroll to the relevant section
        if (itemType === 'expired') {
            document.getElementById('expiredContainer').scrollIntoView({ behavior: 'smooth' });
        } else {
            document.getElementById('wasteContainer').scrollIntoView({ behavior: 'smooth' });
        }
        
    } catch (error) {
        console.error('Error loading rejected item:', error);
        showNotification('Error loading item: ' + error.message, 'error');
    } finally {
        Loader.hide();
    }
}

// ================================
// ADD ITEM WITH PRE-POPULATED DATA - UPDATED
// ================================
function addExpiredItemWithData(itemData) {
    const expiredFields = document.getElementById('expiredFields');
    if (!expiredFields) return;
    
    const itemId = Date.now() + Math.random().toString(36).substr(2, 9);
    
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
                <input type="date" id="deliveredDate-${itemId}" name="expiredItems[${itemId}][deliveredDate]" required value="${itemData.deliveredDate || ''}">
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
                    <option value="human_error" ${itemData.reason === 'human_error' ? 'selected' : ''}>Human Error</option>
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
                <label for="wasteNotes-${itemId}">Additional Notes <span id="notes-required-${itemId}" class="required" ${(itemData.reason === 'human_error' || itemData.reason === 'customer_return' || itemData.reason === 'quality_issue' || itemData.reason === 'other') ? 'style="display: inline;"' : 'style="display: none;"'}>*</span></label>
                <textarea id="wasteNotes-${itemId}" name="wasteItems[${itemId}][notes]" rows="2" placeholder="${getNotesPlaceholder(itemData.reason)}">${itemData.notes || ''}</textarea>
                <span id="notes-note-${itemId}" class="note" style="margin-top: 5px; font-size: 12px; color: #666;">${getNotesNote(itemData.reason)}</span>
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

// Helper function for notes placeholder
function getNotesPlaceholder(reason) {
    switch(reason) {
        case 'human_error':
            return 'Required: Please describe the human error that caused the waste';
        case 'customer_return':
            return 'Required: Please explain why the item was returned';
        case 'quality_issue':
            return 'Required: Please describe the specific quality issue';
        case 'other':
            return 'Required: Please specify the exact reason for waste disposal';
        default:
            return 'Any additional information';
    }
}

// Helper function for notes note
function getNotesNote(reason) {
    switch(reason) {
        case 'human_error':
            return 'Required: Explain the specific human error (e.g., incorrect preparation, mishandling, mislabeling, etc.)';
        case 'customer_return':
            return 'Required: Explain the reason for customer return (e.g., wrong order, customer dissatisfaction, etc.)';
        case 'quality_issue':
            return 'Required: Describe the specific quality problem (e.g., off-taste, wrong color, texture issue, etc.)';
        case 'other':
            return 'Required: Specify the exact reason for waste disposal';
        default:
            return '';
    }
}

// ================================
// TOGGLE ADDITIONAL NOTES REQUIREMENT
// ================================
function toggleAdditionalNotesRequirement(itemId) {
    const reasonSelect = document.getElementById(`reason-${itemId}`);
    const notesRequired = document.getElementById(`notes-required-${itemId}`);
    const notesTextarea = document.getElementById(`wasteNotes-${itemId}`);
    const reasonNote = document.getElementById(`reason-note-${itemId}`);
    const notesNote = document.getElementById(`notes-note-${itemId}`);
    
    if (!reasonSelect) return;
    
    const selectedReason = reasonSelect.value;
    
    if (reasonNote) reasonNote.textContent = '';
    if (notesNote) notesNote.textContent = '';
    
    // Update placeholder based on selected reason
    if (notesTextarea) {
        if (selectedReason === 'human_error') {
            notesTextarea.placeholder = 'Required: Please describe the human error that caused the waste';
        } else if (selectedReason === 'customer_return') {
            notesTextarea.placeholder = 'Required: Please explain why the item was returned';
        } else if (selectedReason === 'quality_issue') {
            notesTextarea.placeholder = 'Required: Please describe the specific quality issue';
        } else if (selectedReason === 'other') {
            notesTextarea.placeholder = 'Required: Please specify the exact reason for waste disposal';
        } else {
            notesTextarea.placeholder = 'Any additional information';
        }
    }
    
    // Make notes required for human_error, customer_return, quality_issue, and other
    if (selectedReason === 'human_error' || selectedReason === 'customer_return' || selectedReason === 'quality_issue' || selectedReason === 'other') {
        if (notesRequired) notesRequired.style.display = 'inline';
        
        if (selectedReason === 'human_error') {
            if (reasonNote) reasonNote.textContent = '⚠️ Additional notes required: Please describe the human error';
            if (notesNote) notesNote.textContent = 'Required: Explain the specific human error (e.g., incorrect preparation, mishandling, mislabeling, etc.)';
        } else if (selectedReason === 'customer_return') {
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
    updateDisposalTypesPreview();
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
// IMAGE COMPRESSION FUNCTIONS
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
                    <option value="human_error">Human Error</option>
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
                
                if ((selectedReason === 'human_error' || selectedReason === 'customer_return' || selectedReason === 'quality_issue' || selectedReason === 'other') && 
                    (!notesTextarea.value || notesTextarea.value.trim() === '')) {
                    
                    let reasonText = '';
                    if (selectedReason === 'human_error') {
                        reasonText = 'human error';
                    } else if (selectedReason === 'customer_return') {
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
        
        let formattedDisposalTypes = reportData.disposalTypes || [];
        let disposalTypesText = 'N/A';
        
        if (formattedDisposalTypes.length > 0) {
            const disposalTypeMap = {
                'expired': 'Expired Items',
                'waste': 'Waste',
                'noWaste': 'No Waste'
            };
            
            formattedDisposalTypes = formattedDisposalTypes.map(type => 
                disposalTypeMap[type] || type
            );
            
            disposalTypesText = formattedDisposalTypes.join(', ');
        }
        
        let reportDetails = '';
        let htmlReportDetails = '';
        
        const expiredItems = itemsDetails.filter(item => item.type === 'expired');
        const wasteItems = itemsDetails.filter(item => item.type === 'waste');
        
        if (reportData.noWaste || formattedDisposalTypes.includes('No Waste')) {
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
                    let reasonDisplay = item.reason || 'N/A';
                    if (reasonDisplay === 'human_error') reasonDisplay = 'Human Error';
                    
                    reportDetails += `${index + 1}. ${item.item || 'N/A'} - ${item.quantity || 0} ${item.unit || ''} (Reason: ${reasonDisplay}) (Cost: ₱${totalCost.toFixed(2)})\n`;
                    htmlReportDetails += `<li><strong>${item.item || 'N/A'}</strong> - ${item.quantity || 0} ${item.unit || ''} (Reason: ${reasonDisplay}) (Cost: ₱${totalCost.toFixed(2)})`;
                    if (item.notes) {
                        reportDetails += `   Notes: ${item.notes}\n`;
                        htmlReportDetails += `<br><small>Notes: ${item.notes}</small>`;
                    }
                    htmlReportDetails += '</li>';
                });
                htmlReportDetails += '</ul>';
            }
        }
        
        const isActuallyResubmission = isResubmissionUpdate || false;
        
        const emailData = {
            to: reportData.email,
            subject: isActuallyResubmission ? `Item Resubmitted - ${reportId}` : `Waste Report Confirmation - ${reportId}`,
            store: reportData.store || 'N/A',
            personnel: reportData.personnel || 'N/A',
            reportDate: formatDate(reportData.reportDate) || 'N/A',
            disposalType: disposalTypesText,
            htmlDisposalTypes: formattedDisposalTypes.map(type => 
                `<span style="background-color: #e8f4fd; padding: 3px 8px; border-radius: 3px; margin-right: 5px; display: inline-block; margin-bottom: 5px;">${type}</span>`
            ).join(''),
            itemCount: itemsDetails.length,
            reportDetails: reportDetails,
            htmlReportDetails: htmlReportDetails,
            submissionTime: submissionTime,
            reportId: reportId,
            totalBatches: reportData.totalBatches || 1,
            hasAttachments: reportData.hasImages || false,
            isResubmission: isActuallyResubmission
        };

        console.log('Final email data being sent:');
        console.log('- isResubmission:', emailData.isResubmission);
        console.log('- Subject:', emailData.subject);

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
            
            Object.keys(emailData).forEach(key => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = key;
                input.value = emailData[key];
                form.appendChild(input);
            });
            
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
// RESUBMISSION HANDLER - UPDATED FOR DATE EDITING
// ================================
async function handleResubmission(originalItemData, updatedItem, newReportDate) {
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
        
        const originalItem = items[originalItemData.itemIndex];
        
        const mergedItem = {
            ...originalItem,
            ...updatedItem,
            approvalStatus: 'pending',
            previousApprovalStatus: 'rejected',
            resubmitted: true,
            resubmissionCount: (originalItem.resubmissionCount || 0) + 1,
            resubmittedAt: new Date().toISOString(),
            resubmittedBy: 'User',
            previousRejectionReason: originalItem.rejectionReason,
            rejectionReason: null,
            rejectedAt: null,
            rejectedBy: null,
            // Use the new report date if provided
            reportDate: newReportDate || originalItem.reportDate || report.reportDate
        };
        
        items[originalItemData.itemIndex] = mergedItem;
        
        const updateData = {
            [itemsField]: items,
            updatedAt: new Date().toISOString(),
            hasResubmission: true
        };
        
        // If the report date is being changed, update it in the main report too
        if (newReportDate && newReportDate !== report.reportDate) {
            updateData.reportDate = newReportDate;
            updateData.originalReportDate = report.reportDate;
        }
        
        await db.collection('wasteReports').doc(originalItemData.reportId).update(updateData);
        
        console.log('✅ Item resubmitted successfully');
        
        const emailResult = await sendEmailConfirmation(
            { ...report, reportDate: newReportDate || report.reportDate },
            originalItemData.reportId,
            [mergedItem],
            true
        );
        
        return {
            success: true,
            reportId: originalItemData.reportId,
            emailSent: emailResult.success,
            item: mergedItem,
            reportDateChanged: newReportDate && newReportDate !== report.reportDate
        };
        
    } catch (error) {
        console.error('❌ Error processing resubmission:', error);
        throw error;
    }
}

// ================================
// OPTIMIZED FORM SUBMISSION HANDLER - FIXED FOR ITEMS SAVING
// ================================
async function handleSubmit(event) {
    console.log('Form submission started...');
    console.log('Is this a resubmission?', isResubmitting);
    
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
    
    if (!itemsLoaded || ALL_ITEMS_LIST.length === 0) {
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
    Loader.show('Preparing submission...');
    
    const disposalTypes = [];
    const disposalTypeCheckboxes = document.querySelectorAll('input[name="disposalType"]:checked');
    disposalTypeCheckboxes.forEach(checkbox => {
        disposalTypes.push(checkbox.value);
    });
    
    // Get the current report date from the form
    const currentReportDate = document.getElementById('reportDate').value;
    
    // Check if this is a resubmission
    if (isResubmitting && originalItemData) {
        try {
            console.log('Processing ACTUAL resubmission...');
            console.log('Using report date:', currentReportDate);
            
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
                
                const fileInput = document.getElementById(`documentation-${itemId}`);
                if (fileInput && fileInput.files.length > 0) {
                    resubmittedItem.hasFiles = true;
                    resubmittedItem.fileCount = fileInput.files.length;
                    
                    Loader.showUpload(0, fileInput.files.length, 'Starting upload...');
                    const files = Array.from(fileInput.files);
                    const uploadedFiles = await uploadFilesForItemParallel(
                        files, 
                        originalItemData.reportId, 
                        `resubmitted-expired-${itemId}`,
                        'expired',
                        0
                    );
                    
                    // CRITICAL: Store documentation with proper structure
                    resubmittedItem.documentation = uploadedFiles.map(file => ({
                        url: file.url,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        path: file.path,
                        storagePath: file.storagePath,
                        originalName: file.originalName,
                        uploadedAt: file.uploadedAt
                    }));
                    Loader.hideUpload();
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
                
                const fileInput = document.getElementById(`wasteDocumentation-${itemId}`);
                if (fileInput && fileInput.files.length > 0) {
                    resubmittedItem.hasFiles = true;
                    resubmittedItem.fileCount = fileInput.files.length;
                    
                    Loader.showUpload(0, fileInput.files.length, 'Starting upload...');
                    const files = Array.from(fileInput.files);
                    const uploadedFiles = await uploadFilesForItemParallel(
                        files, 
                        originalItemData.reportId, 
                        `resubmitted-waste-${itemId}`,
                        'waste',
                        0
                    );
                    
                    // CRITICAL: Store documentation with proper structure
                    resubmittedItem.documentation = uploadedFiles.map(file => ({
                        url: file.url,
                        name: file.name,
                        type: file.type,
                        size: file.size,
                        path: file.path,
                        storagePath: file.storagePath,
                        originalName: file.originalName,
                        uploadedAt: file.uploadedAt
                    }));
                    Loader.hideUpload();
                }
            }
            
            // Pass the current report date to the resubmission handler
            const result = await handleResubmission(originalItemData, resubmittedItem, currentReportDate);
            
            showNotification('✅ Item resubmitted successfully! The original report has been updated.', 'success');
            
            const form = document.getElementById('wasteReportForm');
            if (form) {
                form.reset();
                
                // Reset to today's date for new submissions
                const today = new Date().toISOString().split('T')[0];
                const reportDateInput = document.getElementById('reportDate');
                if (reportDateInput) {
                    reportDateInput.value = today;
                    reportDateInput.disabled = false;
                    reportDateInput.style.backgroundColor = '#fff';
                    reportDateInput.style.cursor = 'text';
                }
                
                // Reset the date note
                const reportDateNote = document.getElementById('reportDateNote');
                if (reportDateNote) {
                    reportDateNote.textContent = 'Date of disposal report';
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
                updateDisposalTypesPreview();
                
                const itemIdInput = document.getElementById('itemId');
                if (itemIdInput) {
                    itemIdInput.value = '';
                }
                
                isResubmitting = false;
                originalItemData = null;
            }
            
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            Loader.hide();
            
            setTimeout(() => {
                const viewReports = confirm(
                    `Item successfully resubmitted!\n\n✅ Original report updated\n📧 Notification sent\n🔄 Item status reset to pending\n${result.reportDateChanged ? '📅 Report date updated\n' : ''}\nWould you like to view the updated report?`
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
            Loader.hide();
        }
        
        return;
    }
    
    // Regular new report submission
    console.log('Processing NEW report submission (NOT a resubmission)');
    const mainReportId = 'REPORT-' + Date.now().toString();
    
    // ============================================
    // CRITICAL FIX: COLLECT ALL ITEMS FIRST
    // ============================================
    let expiredItemsArray = [];
    let wasteItemsArray = [];
    let allItems = [];
    
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
            }
            
            expiredItemsArray.push(expiredItem);
            allItems.push(expiredItem);
        }
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
            }
            
            wasteItemsArray.push(wasteItem);
            allItems.push(wasteItem);
        }
    }
    
    const totalFiles = allItems.reduce((sum, item) => sum + (item.fileCount || 0), 0);
    
    // ============================================
    // CRITICAL FIX: INCLUDE ITEMS IN BASE REPORT DATA
    // ============================================
    const baseReportData = {
        email: document.getElementById('email').value.trim(),
        store: document.getElementById('store').value,
        personnel: document.getElementById('personnel').value.trim(),
        reportDate: currentReportDate,
        disposalTypes: disposalTypes,
        reportId: mainReportId,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'submitted',
        createdAt: new Date().toISOString(),
        emailSent: false,
        emailStatus: 'pending',
        isResubmission: false,
        // CRITICAL: Include items in initial save
        expiredItems: expiredItemsArray,
        wasteItems: wasteItemsArray,
        totalExpiredItems: expiredItemsArray.length,
        totalWasteItems: wasteItemsArray.length,
        hasImages: totalFiles > 0,
        imageCount: totalFiles,
        fileUploadComplete: false
    };
    
    if (disposalTypes.includes('noWaste')) {
        baseReportData.noWaste = true;
        baseReportData.notes = "No waste or expired items to report for this period";
    }
    
    try {
        console.log('Processing new report data for ID:', mainReportId);
        console.log(`📊 Found ${expiredItemsArray.length} expired items, ${wasteItemsArray.length} waste items`);
        
        // Save to Firestore FIRST (with items already included)
        console.log('Saving report to Firestore (with items)...');
        const docRef = db.collection('wasteReports').doc(mainReportId);
        await docRef.set(baseReportData);
        
        console.log('✅ Initial report saved to Firestore with items');
        
        // Step 1: Send email confirmation NOW (before file uploads)
        Loader.updateMessage('Sending email confirmation...');
        
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
        
        // If there are files, upload them in background and update items
        if (totalFiles > 0) {
            Loader.updateMessage('Uploading files...');
            Loader.showUpload(0, totalFiles, 'Starting file upload...');
            
            // Process uploads with proper file structure
            const processedItems = await processAllItemsWithUploads(
                mainReportId,
                allItems,
                (completed, total) => {
                    const progress = (completed / total) * 100;
                    Loader.updateUpload(completed, total, `Item ${completed}/${total}`);
                }
            );
            
            // Separate processed items back into expired and waste
            const processedExpiredItems = processedItems.filter(item => item.type === 'expired');
            const processedWasteItems = processedItems.filter(item => item.type === 'waste');
            
            // Update Firestore with file information
            const updateData = {};
            
            if (processedExpiredItems.length > 0) {
                updateData.expiredItems = processedExpiredItems;
                updateData.totalExpiredItems = processedExpiredItems.length;
            }
            if (processedWasteItems.length > 0) {
                updateData.wasteItems = processedWasteItems;
                updateData.totalWasteItems = processedWasteItems.length;
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
            
            console.log('✅ Files uploaded and report updated with processed items');
            Loader.hideUpload();
            
            if (uploadedFiles > 0) {
                showNotification('✅ All files uploaded successfully!', 'success');
            }
            
        } else {
            // No files, just mark as complete
            await docRef.update({
                fileUploadComplete: true
            });
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
            updateDisposalTypesPreview();
            
            // Clear Item ID field if it exists
            const itemIdInput = document.getElementById('itemId');
            if (itemIdInput) {
                itemIdInput.value = '';
            }
        }
        
        // Re-enable submit button
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        Loader.hide();
        
        // Ask user to view reports
        setTimeout(() => {
            const viewReports = confirm(
                `Report ${mainReportId} has been submitted successfully!\n\n✅ Data saved to database\n📧 Email sent to ${baseReportData.email}\n📦 ${expiredItemsArray.length} expired items, ${wasteItemsArray.length} waste items saved\n${totalFiles > 0 ? '📁 Files uploaded successfully\n' : ''}\nWould you like to view all reports?`
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
        Loader.hide();
        Loader.hideUpload();
        
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
    updateDisposalTypesPreview();
    
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
window.handleStoreChange = handleStoreChange;