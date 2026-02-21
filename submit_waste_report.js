// submit_waste_report.js - COMPLETE VERSION with FIXED KITCHEN collapsible behavior

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
            if (this.textElement) this.textElement.textContent = message;
            if (this.progressContainer) this.progressContainer.style.display = 'none';
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
        if (this.textElement) this.textElement.textContent = message;
    },
   
    showUpload(current = 0, total = 0, fileName = '') {
        if (!this.progressContainer || !this.progressFill || !this.progressText) return;
        this.progressContainer.style.display = 'block';
        if (total > 0) {
            const percentage = Math.round((current / total) * 100);
            this.progressFill.style.width = `${percentage}%`;
            this.progressText.textContent = `Uploading: ${percentage}%`;
            if (fileName) this.progressDetails.textContent = `File: ${fileName}`;
        }
    },
   
    hideUpload() {
        if (this.progressContainer) this.progressContainer.style.display = 'none';
        if (this.progressFill) this.progressFill.style.width = '0%';
        if (this.progressText) this.progressText.textContent = 'Uploading: 0%';
        if (this.progressDetails) this.progressDetails.textContent = '';
    },
   
    updateUpload(current, total, fileName = '') {
        if (!this.progressContainer || !this.progressFill || !this.progressText) return;
        const percentage = Math.round((current / total) * 100);
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = `Uploading: ${percentage}%`;
        if (fileName) this.progressDetails.textContent = `File: ${fileName}`;
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
// FILE SIZE LIMITS
// ================================
const FILE_CONFIG = {
    MAX_SIZE_PER_FILE: 10 * 1024 * 1024, // 10MB per file
    MAX_TOTAL_SIZE: 10 * 1024 * 1024,   // 10MB total
    MAX_FILES_PER_ITEM: 3
};

// ================================
// GLOBAL STATE
// ================================
let ALL_ITEMS_LIST = [];
let REGULAR_ITEMS_LIST = [];
let KITCHEN_ITEMS_LIST = [];
let KITCHEN_ITEMS_BY_CATEGORY = { meat: [], vegetables: [], seafood: [] };
let itemsLoaded = false;
let isResubmitting = false;
let originalItemData = null;
let currentStoreType = null;
let currentStoreValue = '';

const KITCHEN_STORES = ['CTK', 'Tabaco CN 2', 'Concourse Hall', 'Concourse Convention', 'FG Kitchen LC', 'FG Kitchen Naga'];
const CONCOURSE_VARIANTS = ['Tabaco CN 2', 'Concourse Hall', 'Concourse Convention'];

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
    setTimeout(() => { notification.style.display = 'none'; }, 5000);
}

function showLoading(show, message = '') {
    if (show) Loader.show(message); else Loader.hide();
}

function showUploadProgress(show, current = 0, total = 0, fileName = '') {
    if (show) Loader.showUpload(current, total, fileName); else Loader.hideUpload();
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ================================
// STORE CHANGE HANDLER
// ================================
function handleStoreChange(selectElement) {
    const selectedStore = selectElement.value;
    const indicator = document.getElementById('storeTypeIndicator');
    const indicatorText = document.getElementById('storeTypeText');
   
    console.log('Store changed to:', selectedStore);
    console.log('Previous store type:', currentStoreType);
   
    currentStoreValue = selectedStore;
   
    if (!selectedStore) {
        currentStoreType = null;
        indicator.style.display = 'none';
        showNotification('Please select a store location first.', 'info');
    } else if (KITCHEN_STORES.includes(selectedStore)) {
        currentStoreType = 'kitchen';
        indicator.style.display = 'flex';
        indicator.className = 'store-type-indicator kitchen';
        let displayText = '';
        if (CONCOURSE_VARIANTS.includes(selectedStore)) {
            displayText = `<strong>🍳 KITCHEN LOCATION - ${selectedStore}</strong> - Only kitchen items (Meat, Vegetables, Seafood) are available.`;
        } else {
            displayText = `<strong>🍳 KITCHEN LOCATION - ${selectedStore}</strong> - Only kitchen items (Meat, Vegetables, Seafood) are available.`;
        }
        indicatorText.innerHTML = displayText;
        showNotification('Kitchen location selected. Item dropdowns now show KITCHEN ITEMS ONLY.', 'info');
    } else {
        currentStoreType = 'regular';
        indicator.style.display = 'flex';
        indicator.className = 'store-type-indicator regular';
        indicatorText.innerHTML = '<strong>📦 REGULAR STORE</strong> - Only store items are available.';
        showNotification('Regular store selected. Item dropdowns now show STORE ITEMS ONLY.', 'info');
    }
   
    refreshAllDropdowns();
}

// ================================
// DISPOSAL TYPES PREVIEW
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
// FILE UPLOAD FUNCTIONS
// ================================
async function uploadFilesForItemParallel(files, reportId, itemId, itemType, itemIndex) {
    const uploadedFiles = [];
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
                            resolve({
                                url: downloadURL,
                                name: file.name,
                                type: file.type,
                                size: fileToUpload.size,
                                path: fileName,
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
                item.documentation = uploadedFiles.map(file => ({
                    url: file.url,
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    path: file.path,
                    storagePath: file.storagePath,
                    originalName: file.originalName,
                    uploadedAt: file.uploadedAt
                }));
                item.totalFiles = uploadedFiles.length;
                item.hasImages = uploadedFiles.length > 0;
                item.storageUsed = uploadedFiles.reduce((sum, file) => sum + (file.size || 0), 0);
                item.originalFileSize = files.reduce((sum, file) => sum + file.size, 0);
            } catch (error) {
                console.error(`❌ Failed to upload files for item ${itemId}:`, error);
                throw error;
            }
        } else {
            item.documentation = [];
            item.totalFiles = 0;
            item.hasImages = false;
        }
       
        completedItems++;
        if (progressCallback) progressCallback(completedItems, totalItems);
    }
   
    console.log(`✅ All items processed for report ${reportId}`);
    return allItems;
}

// ================================
// FETCH ITEMS FROM FIRESTORE
// ================================
async function fetchItemsFromFirestore() {
    try {
        if (!db) throw new Error('Firebase not initialized');
        console.log('Fetching items from Firestore...');
        Loader.show('Loading items...');
       
        const snapshot = await db.collection('items').orderBy('name', 'asc').get();
       
        ALL_ITEMS_LIST = [];
        REGULAR_ITEMS_LIST = [];
        KITCHEN_ITEMS_LIST = [];
        KITCHEN_ITEMS_BY_CATEGORY = { meat: [], vegetables: [], seafood: [] };
       
        snapshot.forEach(doc => {
            const itemData = doc.data();
            const itemName = itemData.name;
            const category = itemData.category || 'regular';
            const kitchenCategory = itemData.kitchenCategory;
           
            ALL_ITEMS_LIST.push(itemName);
           
            if (category === 'kitchen') {
                KITCHEN_ITEMS_LIST.push(itemName);
                if (kitchenCategory === 'meat') KITCHEN_ITEMS_BY_CATEGORY.meat.push(itemName);
                else if (kitchenCategory === 'vegetables') KITCHEN_ITEMS_BY_CATEGORY.vegetables.push(itemName);
                else if (kitchenCategory === 'seafood') KITCHEN_ITEMS_BY_CATEGORY.seafood.push(itemName);
            } else {
                REGULAR_ITEMS_LIST.push(itemName);
            }
        });
       
        REGULAR_ITEMS_LIST.sort();
        KITCHEN_ITEMS_LIST.sort();
        KITCHEN_ITEMS_BY_CATEGORY.meat.sort();
        KITCHEN_ITEMS_BY_CATEGORY.vegetables.sort();
        KITCHEN_ITEMS_BY_CATEGORY.seafood.sort();
       
        console.log(`✅ Loaded ${ALL_ITEMS_LIST.length} total items`);
        console.log(` - REGULAR: ${REGULAR_ITEMS_LIST.length}`);
        console.log(` - KITCHEN: ${KITCHEN_ITEMS_LIST.length}`);
       
        itemsLoaded = true;
        initializeAllSelect2Dropdowns();
        return ALL_ITEMS_LIST;
       
    } catch (error) {
        console.error('❌ Error fetching items:', error);
        showNotification('Failed to load items. Please try again.', 'error');
        throw error;
    } finally {
        Loader.hide();
    }
}

// ================================
// ITEM COST LOOKUP
// ================================
async function getItemCost(itemName) {
    try {
        if (!itemName || !db) return 0;
        const query = await db.collection('items').where('name', '==', itemName).limit(1).get();
        if (!query.empty) {
            return parseFloat(query.docs[0].data().cost) || 0;
        }
        return 0;
    } catch (error) {
        console.error('Error getting item cost:', error);
        return 0;
    }
}

// ================================
// REFRESH ITEM DROPDOWNS
// ================================
function refreshAllDropdowns() {
    const expiredFields = document.querySelectorAll('#expiredFields .field-group');
    expiredFields.forEach(field => {
        const itemId = field.id.split('-')[1];
        const selectId = `expiredItem-${itemId}`;
        if (document.getElementById(selectId)) {
            $(`#${selectId}`).select2('destroy');
            initSelect2Dropdown(selectId);
        }
    });
   
    const wasteFields = document.querySelectorAll('#wasteFields .field-group');
    wasteFields.forEach(field => {
        const itemId = field.id.split('-')[1];
        const selectId = `wasteItem-${itemId}`;
        if (document.getElementById(selectId)) {
            $(`#${selectId}`).select2('destroy');
            initSelect2Dropdown(selectId);
        }
    });
}

// ================================
// ITEM DROPDOWN INITIALIZATION (store-type aware)
// ================================
function initSelect2Dropdown(selectElementId) {
    const selectElement = document.getElementById(selectElementId);
    if (!selectElement) return;
   
    const storeSelect = document.getElementById('store');
    const hasStoreSelected = storeSelect && storeSelect.value && storeSelect.value !== '';
   
    if (!hasStoreSelected || !currentStoreType) {
        $(`#${selectElementId}`).select2({
            data: [{ id: '', text: 'Please select a store location first', disabled: true }],
            placeholder: 'Select store first',
            disabled: true,
            allowClear: false,
            width: '100%',
            dropdownParent: $(`#${selectElementId}`).parent()
        });
        return;
    }
   
    let groupedItems = [];
   
    if (currentStoreType === 'kitchen') {
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
    } else if (currentStoreType === 'regular') {
        if (REGULAR_ITEMS_LIST.length > 0) {
            groupedItems.push({
                text: '📦 STORE ITEMS',
                children: REGULAR_ITEMS_LIST.map(item => ({ id: item, text: item }))
            });
        }
    }
   
    if (groupedItems.length === 0) {
        const placeholderText = currentStoreType === 'kitchen' ? 'No kitchen items available' : 'No store items available';
        groupedItems = [{ id: '', text: placeholderText, disabled: true }];
    }
   
    $(`#${selectElementId}`).select2({
        data: groupedItems,
        placeholder: currentStoreType === 'kitchen' ? "Select a kitchen item..." : "Select a store item...",
        disabled: false,
        allowClear: false,
        width: '100%',
        dropdownParent: $(`#${selectElementId}`).parent(),
        templateResult: formatItemResult,
        templateSelection: formatItemSelection
    });
}

function formatItemResult(item) {
    if (!item.id || item.disabled) return item.text;
   
    if (currentStoreType === 'kitchen') {
        let categoryClass = '';
        let categoryText = '';
        if (KITCHEN_ITEMS_BY_CATEGORY.meat.includes(item.id)) {
            categoryClass = 'category-meat'; categoryText = 'MEAT';
        } else if (KITCHEN_ITEMS_BY_CATEGORY.vegetables.includes(item.id)) {
            categoryClass = 'category-vegetables'; categoryText = 'VEG';
        } else if (KITCHEN_ITEMS_BY_CATEGORY.seafood.includes(item.id)) {
            categoryClass = 'category-seafood'; categoryText = 'SEA';
        }
        return $(`<span><i class="fas fa-utensils" style="margin-right:5px;color:#856404;"></i> ${item.text} <span class="kitchen-category-badge ${categoryClass}">${categoryText}</span></span>`);
    } else {
        return $(`<span><i class="fas fa-box" style="margin-right:5px;color:#2e7d32;"></i> ${item.text}</span>`);
    }
}

function formatItemSelection(item) {
    return item.text || item.id;
}

function initializeAllSelect2Dropdowns() {
    $('.item-dropdown').each(function() {
        const selectId = $(this).attr('id');
        if (selectId) initSelect2Dropdown(selectId);
    });
}

// ================================
// LOAD REJECTED ITEM
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
        if (parts.length < 3) throw new Error('Invalid Item ID format');
       
        const reportId = parts[0];
        const itemType = parts[1];
        const itemIndex = parseInt(parts[2]);
       
        const reportDoc = await db.collection('wasteReports').doc(reportId).get();
        if (!reportDoc.exists) throw new Error('Report not found');
       
        const report = reportDoc.data();
        const items = itemType === 'expired' ? report.expiredItems : report.wasteItems;
        if (!items || itemIndex >= items.length) throw new Error('Item not found in report');
       
        const rejectedItem = items[itemIndex];
        if (rejectedItem.approvalStatus !== 'rejected') {
            showNotification('This item is not rejected', 'warning');
            return;
        }
       
        originalItemData = {
            reportId,
            itemType,
            itemIndex,
            originalItem: rejectedItem,
            originalReportDate: report.reportDate
        };
       
        isResubmitting = true;
       
        const storeSelect = document.getElementById('store');
        if (storeSelect) {
            $(storeSelect).val(report.store || '').trigger('change');
            handleStoreChange({ value: report.store });
        }
       
        const reportDateInput = document.getElementById('reportDate');
        const reportDateNote = document.getElementById('reportDateNote');
        if (reportDateInput) {
            reportDateInput.value = report.reportDate || new Date().toISOString().split('T')[0];
            if (reportDateNote) {
                reportDateNote.innerHTML = `<i class="fas fa-info-circle"></i> You can edit this date if needed. Original report date was ${formatDate(report.reportDate)}`;
            }
            reportDateInput.disabled = false;
            reportDateInput.style.backgroundColor = '#fff';
            reportDateInput.style.cursor = 'text';
        }
       
        document.getElementById('email').value = report.email || '';
        document.getElementById('personnel').value = report.personnel || '';
       
        if (itemType === 'expired') {
            document.getElementById('expired').checked = true;
            toggleDisposalType('expired');
        } else if (itemType === 'waste') {
            document.getElementById('waste').checked = true;
            toggleDisposalType('waste');
        }
       
        document.getElementById('expiredFields').innerHTML = '';
        document.getElementById('wasteFields').innerHTML = '';
       
        if (itemType === 'expired') {
            addExpiredItemWithData(rejectedItem);
        } else {
            addWasteItemWithData(rejectedItem);
        }
       
        showNotification('Rejected item loaded. You can edit all fields including the date for resubmission.', 'success');
       
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
// ADD ITEM WITH PRE-FILLED DATA (for resubmission)
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
                <input type="file" id="documentation-${itemId}" name="expiredItems[${itemId}][documentation]" required accept="image/*,.pdf" multiple onchange="createFilePreview(this, 'documentation-${itemId}-preview')">
                <div id="documentation-${itemId}-preview" class="file-preview"></div>
                <span class="note">Upload photos or PDFs (Max 10MB per file, 3 files max)</span>
                ${itemData.documentation && itemData.documentation.length > 0 ? `<div style="margin-top:5px;font-size:12px;color:#666;"><i class="fas fa-info-circle"></i> Previous documentation: ${itemData.documentation.length} file(s)</div>` : ''}
            </div>
            <div class="form-group">
                <label for="notes-${itemId}">Additional Notes</label>
                <textarea id="notes-${itemId}" name="expiredItems[${itemId}][notes]" rows="2" placeholder="Any additional information">${itemData.notes || ''}</textarea>
            </div>
            ${itemData.rejectionReason ? `
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Previous Rejection Reason</label>
                <div style="background:#fff3cd;padding:10px;border-radius:4px;border-left:4px solid #ffc107;">
                    <strong><i class="fas fa-exclamation-triangle"></i> ${itemData.rejectionReason}</strong>
                    <div style="font-size:11px;color:#856404;margin-top:5px;">
                        <i class="fas fa-info-circle"></i> Please correct the issue and resubmit
                    </div>
                </div>
            </div>` : ''}
        </div>
    `;
   
    expiredFields.appendChild(fieldGroup);
    setTimeout(() => initSelect2Dropdown(`expiredItem-${itemId}`), 100);
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
                <div id="reason-note-${itemId}" class="note" style="margin-top:5px;font-size:12px;color:#666;"></div>
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
                <input type="file" id="wasteDocumentation-${itemId}" name="wasteItems[${itemId}][documentation]" required accept="image/*,.pdf" multiple onchange="createFilePreview(this, 'wasteDocumentation-${itemId}-preview')">
                <div id="wasteDocumentation-${itemId}-preview" class="file-preview"></div>
                <span class="note">Upload photos or PDFs (Max 10MB per file, 3 files max)</span>
                ${itemData.documentation && itemData.documentation.length > 0 ? `<div style="margin-top:5px;font-size:12px;color:#666;"><i class="fas fa-info-circle"></i> Previous documentation: ${itemData.documentation.length} file(s)</div>` : ''}
            </div>
            <div class="form-group">
                <label for="wasteNotes-${itemId}">Additional Notes <span id="notes-required-${itemId}" class="required" style="${(itemData.reason === 'human_error' || itemData.reason === 'customer_return' || itemData.reason === 'quality_issue' || itemData.reason === 'other' || itemData.reason === 'spoilage') ? '' : 'display:none;'}">*</span></label>
                <textarea id="wasteNotes-${itemId}" name="wasteItems[${itemId}][notes]" rows="2" placeholder="${getNotesPlaceholder(itemData.reason)}">${itemData.notes || ''}</textarea>
                <span id="notes-note-${itemId}" class="note" style="margin-top:5px;font-size:12px;color:#666;">${getNotesNote(itemData.reason)}</span>
            </div>
            ${itemData.rejectionReason ? `
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Previous Rejection Reason</label>
                <div style="background:#fff3cd;padding:10px;border-radius:4px;border-left:4px solid #ffc107;">
                    <strong><i class="fas fa-exclamation-triangle"></i> ${itemData.rejectionReason}</strong>
                    <div style="font-size:11px;color:#856404;margin-top:5px;">
                        <i class="fas fa-info-circle"></i> Please correct the issue and resubmit
                    </div>
                </div>
            </div>` : ''}
        </div>
    `;
   
    wasteFields.appendChild(fieldGroup);
    setTimeout(() => {
        initSelect2Dropdown(`wasteItem-${itemId}`);
        toggleAdditionalNotesRequirement(itemId);
    }, 100);
}

// ================================
// NOTES HELPERS
// ================================
function getNotesPlaceholder(reason) {
    switch(reason) {
        case 'spoilage': return 'Required: Please describe the spoilage (e.g., smell, appearance, texture, etc.)';
        case 'human_error': return 'Required: Please describe the human error that caused the waste';
        case 'customer_return': return 'Required: Please explain why the item was returned';
        case 'quality_issue': return 'Required: Please describe the specific quality issue';
        case 'other': return 'Required: Please specify the exact reason for waste disposal';
        default: return 'Any additional information';
    }
}

function getNotesNote(reason) {
    switch(reason) {
        case 'spoilage': return 'Required: Describe the specific spoilage indicators (e.g., foul odor, mold, discoloration, texture changes, etc.)';
        case 'human_error': return 'Required: Explain the specific human error (e.g., incorrect preparation, mishandling, mislabeling, etc.)';
        case 'customer_return': return 'Required: Explain the reason for customer return (e.g., wrong order, customer dissatisfaction, etc.)';
        case 'quality_issue': return 'Required: Describe the specific quality problem (e.g., off-taste, wrong color, texture issue, etc.)';
        case 'other': return 'Required: Specify the exact reason for waste disposal';
        default: return '';
    }
}

// ================================
// TOGGLE NOTES REQUIREMENT
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
   
    if (notesTextarea) {
        notesTextarea.placeholder = getNotesPlaceholder(selectedReason);
    }
   
    const isRequired = ['spoilage', 'human_error', 'customer_return', 'quality_issue', 'other'].includes(selectedReason);
   
    if (isRequired) {
        if (notesRequired) notesRequired.style.display = 'inline';
        if (reasonNote) reasonNote.textContent = '⚠️ Additional notes required';
        if (notesNote) notesNote.textContent = getNotesNote(selectedReason);
    } else {
        if (notesRequired) notesRequired.style.display = 'none';
    }
}

// ================================
// DISPOSAL TYPE TOGGLE
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
        document.getElementById('expiredFields').innerHTML = '';
        document.getElementById('wasteFields').innerHTML = '';
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
            document.getElementById('expiredFields').innerHTML = '';
        }
        else if (checkboxId === 'waste') {
            if (wasteContainer) wasteContainer.classList.remove('show');
            document.getElementById('wasteFields').innerHTML = '';
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
        if (!confirmProceed) return false;
    }
   
    return true;
}

// ================================
// IMAGE COMPRESSION
// ================================
async function prepareFileForUpload(file) {
    if (file.size <= 2 * 1024 * 1024 || !file.type.startsWith('image/')) return file;
   
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
               
                canvas.toBlob(blob => {
                    const compressedFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
           
            img.onerror = reject;
        };
       
        reader.onerror = reject;
    });
}

// ================================
// FILE PREVIEW & REMOVAL
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

// ================================
// ADD NEW ITEM FIELDS
// ================================
function addExpiredItem() {
    const expiredFields = document.getElementById('expiredFields');
    if (!expiredFields) return;
   
    if (!currentStoreType) {
        showNotification('Please select a store location first before adding items.', 'error');
        return;
    }
   
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
                <input type="file" id="documentation-${itemId}" name="expiredItems[${itemId}][documentation]" required accept="image/*,.pdf" multiple onchange="createFilePreview(this, 'documentation-${itemId}-preview')">
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
    setTimeout(() => initSelect2Dropdown(`expiredItem-${itemId}`), 100);
}

function addWasteItem() {
    const wasteFields = document.getElementById('wasteFields');
    if (!wasteFields) return;
   
    if (!currentStoreType) {
        showNotification('Please select a store location first before adding items.', 'error');
        return;
    }
   
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
                <div id="reason-note-${itemId}" class="note" style="margin-top:5px;font-size:12px;color:#666;"></div>
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
                <input type="file" id="wasteDocumentation-${itemId}" name="wasteItems[${itemId}][documentation]" required accept="image/*,.pdf" multiple onchange="createFilePreview(this, 'wasteDocumentation-${itemId}-preview')">
                <div id="wasteDocumentation-${itemId}-preview" class="file-preview"></div>
                <span class="note">Upload photos or PDFs (Max 10MB per file, 3 files max)</span>
            </div>
            <div class="form-group">
                <label for="wasteNotes-${itemId}">Additional Notes <span id="notes-required-${itemId}" class="required" style="display:none;">*</span></label>
                <textarea id="wasteNotes-${itemId}" name="wasteItems[${itemId}][notes]" rows="2" placeholder="Any additional information"></textarea>
                <span id="notes-note-${itemId}" class="note" style="margin-top:5px;font-size:12px;color:#666;"></span>
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
    if (field) field.remove();
}

// ================================
// VALIDATION HELPERS
// ================================
function validateFiles(fileInput) {
    const maxSize = FILE_CONFIG.MAX_SIZE_PER_FILE;
    const maxFiles = FILE_CONFIG.MAX_FILES_PER_ITEM;
    const maxTotalSize = FILE_CONFIG.MAX_TOTAL_SIZE;
   
    if (fileInput.files.length > maxFiles) return `Maximum ${maxFiles} files allowed`;
   
    let totalSize = 0;
    for (let file of fileInput.files) {
        if (file.size > maxSize) return `File "${file.name}" exceeds ${formatFileSize(maxSize)} limit`;
        totalSize += file.size;
    }
   
    if (totalSize > maxTotalSize) return `Total file size exceeds ${formatFileSize(maxTotalSize)} limit`;
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
           
            if (fileInput && fileInput.files.length === 0) {
                showNotification('Please upload documentation for all expired items.', 'error');
                return false;
            }
            if (fileInput) {
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
           
            if (fileInput && fileInput.files.length === 0) {
                showNotification('Please upload documentation for all waste items.', 'error');
                return false;
            }
            if (fileInput) {
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
                if (['spoilage', 'human_error', 'customer_return', 'quality_issue', 'other'].includes(selectedReason) &&
                    (!notesTextarea.value || notesTextarea.value.trim() === '')) {
                    showNotification(`Additional notes are required for ${selectedReason.replace('_', ' ')}.`, 'error');
                    notesTextarea.focus();
                    return false;
                }
            }
        }
    }
   
    return true;
}

// ================================
// EMAIL CONFIRMATION
// ================================
async function sendEmailConfirmation(reportData, reportId, itemsDetails, isResubmissionUpdate = false) {
    try {
        console.log('📧 Sending email confirmation...');
       
        if (!GAS_CONFIG.ENDPOINT) return { success: false, error: 'Email service URL not configured' };
       
        const submissionTime = new Date().toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
       
        let formattedDisposalTypes = reportData.disposalTypes || [];
        let disposalTypesText = 'N/A';
       
        if (formattedDisposalTypes.length > 0) {
            const disposalTypeMap = { 'expired': 'Expired Items', 'waste': 'Waste', 'noWaste': 'No Waste' };
            formattedDisposalTypes = formattedDisposalTypes.map(type => disposalTypeMap[type] || type);
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
                        reportDetails += ` Notes: ${item.notes}\n`;
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
                    if (reasonDisplay === 'spoilage') reasonDisplay = 'Spoilage';
                    reportDetails += `${index + 1}. ${item.item || 'N/A'} - ${item.quantity || 0} ${item.unit || ''} (Reason: ${reasonDisplay}) (Cost: ₱${totalCost.toFixed(2)})\n`;
                    htmlReportDetails += `<li><strong>${item.item || 'N/A'}</strong> - ${item.quantity || 0} ${item.unit || ''} (Reason: ${reasonDisplay}) (Cost: ₱${totalCost.toFixed(2)})`;
                    if (item.notes) {
                        reportDetails += ` Notes: ${item.notes}\n`;
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
            htmlDisposalTypes: formattedDisposalTypes.map(type => `<span style="background-color:#e8f4fd;padding:3px 8px;border-radius:3px;margin-right:5px;display:inline-block;margin-bottom:5px;">${type}</span>`).join(''),
            itemCount: itemsDetails.length,
            reportDetails: reportDetails,
            htmlReportDetails: htmlReportDetails,
            submissionTime: submissionTime,
            reportId: reportId,
            totalBatches: reportData.totalBatches || 1,
            hasAttachments: reportData.hasImages || false,
            isResubmission: isActuallyResubmission
        };
       
        const formData = new FormData();
        Object.keys(emailData).forEach(key => formData.append(key, emailData[key]));
       
        let success = false;
       
        try {
            const response = await fetch(GAS_CONFIG.ENDPOINT, { method: 'POST', body: formData });
            if (response.ok) success = true;
        } catch (err) {
            console.log('FormData failed, trying fallback...');
        }
       
        if (!success) {
            try {
                const params = new URLSearchParams(emailData);
                const url = `${GAS_CONFIG.ENDPOINT}?${params.toString()}`;
                const response = await fetch(url);
                if (response.ok) success = true;
            } catch (err) {
                console.log('GET fallback failed');
            }
        }
       
        return { success };
       
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return { success: false, error: error.message };
    }
}

// ================================
// FORM SUBMISSION (main logic)
// ================================
async function handleSubmit(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
   
    if (!db || !storage) {
        showNotification('Firebase not initialized. Cannot submit.', 'error');
        return;
    }
   
    const submitBtn = document.querySelector('.submit-btn');
    if (!submitBtn) return;
   
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
   
    Loader.show('Preparing submission...');
   
    if (!itemsLoaded) {
        showNotification('Items still loading. Please wait.', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        Loader.hide();
        return;
    }
   
    if (!currentStoreType) {
        showNotification('Please select a store location first.', 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        Loader.hide();
        return;
    }
   
    const requiredFields = ['email', 'store', 'personnel', 'reportDate'];
    for (let field of requiredFields) {
        const el = document.getElementById(field);
        if (!el || !el.value.trim()) {
            showNotification(`Please fill in ${field}.`, 'error');
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
            Loader.hide();
            return;
        }
    }
   
    if (!validateDisposalTypeSelection() || !validateDynamicFields()) {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        Loader.hide();
        return;
    }
   
    const disposalTypes = [];
    document.querySelectorAll('input[name="disposalType"]:checked').forEach(cb => disposalTypes.push(cb.value));
   
    const currentReportDate = document.getElementById('reportDate').value;
    const mainReportId = 'REPORT-' + Date.now().toString();
   
    let expiredItemsArray = [];
    let wasteItemsArray = [];
    let allItems = [];
   
    if (disposalTypes.includes('expired')) {
        const expiredFields = document.querySelectorAll('#expiredFields .field-group');
        for (let field of expiredFields) {
            const itemId = field.id.split('-')[1];
            const selectedItem = $(`#expiredItem-${itemId}`).select2('data')[0]?.id || '';
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
                itemId,
                itemCost,
                documentation: [],
                approvalStatus: 'pending',
                submittedAt: new Date().toISOString()
            };
           
            const fileInput = document.getElementById(`documentation-${itemId}`);
            if (fileInput && fileInput.files.length > 0) {
                expiredItem.hasFiles = true;
                expiredItem.fileCount = fileInput.files.length;
            }
           
            expiredItemsArray.push(expiredItem);
            allItems.push(expiredItem);
        }
    }
   
    if (disposalTypes.includes('waste')) {
        const wasteFields = document.querySelectorAll('#wasteFields .field-group');
        for (let field of wasteFields) {
            const itemId = field.id.split('-')[1];
            const selectedItem = $(`#wasteItem-${itemId}`).select2('data')[0]?.id || '';
            const itemCost = await getItemCost(selectedItem);
           
            const wasteItem = {
                type: 'waste',
                item: selectedItem,
                reason: document.getElementById(`reason-${itemId}`).value,
                quantity: parseFloat(document.getElementById(`wasteQuantity-${itemId}`).value) || 0,
                unit: document.getElementById(`wasteUnit-${itemId}`).value,
                notes: document.getElementById(`wasteNotes-${itemId}`).value.trim() || '',
                itemId,
                itemCost,
                documentation: [],
                approvalStatus: 'pending',
                submittedAt: new Date().toISOString()
            };
           
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
   
    const baseReportData = {
        email: document.getElementById('email').value.trim(),
        store: document.getElementById('store').value,
        personnel: document.getElementById('personnel').value.trim(),
        reportDate: currentReportDate,
        disposalTypes,
        reportId: mainReportId,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'submitted',
        createdAt: new Date().toISOString(),
        emailSent: false,
        emailStatus: 'pending',
        isResubmission: false,
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
        const docRef = db.collection('wasteReports').doc(mainReportId);
        await docRef.set(baseReportData);
       
        const emailResult = await sendEmailConfirmation(baseReportData, mainReportId, allItems, false);
       
        if (emailResult.success) {
            await docRef.update({ emailSent: true, emailSentAt: new Date().toISOString(), emailStatus: 'sent' });
            showNotification('Email confirmation sent!', 'success');
        } else {
            await docRef.update({ emailSent: false, emailError: emailResult.error, emailStatus: 'failed' });
            showNotification('Report saved, but email failed.', 'warning');
        }
       
        if (totalFiles > 0) {
            Loader.updateMessage('Uploading files...');
            Loader.showUpload(0, totalFiles);
           
            const processedItems = await processAllItemsWithUploads(mainReportId, allItems, (c, t) => {
                Loader.updateUpload(c, t, `Item ${c}/${t}`);
            });
           
            const processedExpired = processedItems.filter(i => i.type === 'expired');
            const processedWaste = processedItems.filter(i => i.type === 'waste');
           
            const updateData = {
                expiredItems: processedExpired,
                wasteItems: processedWaste,
                totalExpiredItems: processedExpired.length,
                totalWasteItems: processedWaste.length,
                hasImages: processedItems.some(i => i.hasImages),
                imageCount: processedItems.reduce((s, i) => s + (i.totalFiles || 0), 0),
                fileUploadComplete: true,
                fileUploadedAt: new Date().toISOString()
            };
           
            await docRef.update(updateData);
            Loader.hideUpload();
        } else {
            await docRef.update({ fileUploadComplete: true });
        }
       
        // Reset form
        document.getElementById('wasteReportForm').reset();
        document.getElementById('reportDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('expiredFields').innerHTML = '';
        document.getElementById('wasteFields').innerHTML = '';
        document.getElementById('expiredContainer').classList.remove('show');
        document.getElementById('wasteContainer').classList.remove('show');
        updateDisposalTypeHint();
        updateDisposalTypesPreview();
        document.getElementById('itemId').value = '';
       
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        Loader.hide();
       
        setTimeout(() => {
            if (confirm(`Report ${mainReportId} submitted successfully!\n\nWould you like to view all reports?`)) {
                window.location.href = 'waste_report_table.html';
            }
        }, 1500);
       
    } catch (error) {
        console.error('❌ Submission failed:', error);
        showNotification('Error submitting report: ' + error.message, 'error');
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        Loader.hide();
    }
}

// ================================
// INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', async () => {
    const reportDateInput = document.getElementById('reportDate');
    if (reportDateInput) reportDateInput.value = new Date().toISOString().split('T')[0];
   
    document.getElementById('wasteReportForm').addEventListener('submit', handleSubmit);
   
    document.querySelectorAll('input[name="disposalType"]').forEach(cb => {
        cb.addEventListener('change', () => toggleDisposalType(cb.id));
    });     
   
    updateDisposalTypeHint();
    updateDisposalTypesPreview();
   
    try {
        await fetchItemsFromFirestore();
    } catch (err) {
        console.error('Failed to load items:', err);
    }
});

// Global exports
window.loadRejectedItem = loadRejectedItem;
window.addExpiredItem = addExpiredItem;
window.addWasteItem = addWasteItem;
window.removeField = removeField;
window.toggleDisposalType = toggleDisposalType;
window.handleStoreChange = handleStoreChange;f