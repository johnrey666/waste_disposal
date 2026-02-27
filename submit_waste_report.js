// submit_waste_report.js - COMPLETE FILE - FIXED VERSION (February 27, 2026)
// CHANGES:
// 1. Fixed resubmission issue - now preserves other items in the report
// 2. When resubmitting one item, other items in the same report are kept intact
// 3. Removed FG Kitchen LC and FG Kitchen Naga as individual options
// 4. When FG LEGAZPI is selected, all items (regular + kitchen) are visible
// 5. When FG NAGA is selected, all items (regular + kitchen) are visible
// 6. Kitchen items automatically use KG as fixed unit of measurement
// 7. FIXED: Waste and expired sections now properly open when loading rejected items

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

const firebaseConfig = {
    apiKey: "AIzaSyAyp2f1b6cG4E_Dx9eako31LgTDuZrZ8_E",
    authDomain: "disposal-e6b83.firebaseapp.com",
    projectId: "disposal-e6b83",
    storageBucket: "disposal-e6b83.firebasestorage.app",
    messagingSenderId: "1050986320678",
    appId: "1:1050986320678:web:deb5f4c58c3ef0cbc6a7e7",
    measurementId: "G-3Q7705T5FE"
};

const GAS_CONFIG = {
    ENDPOINT: 'https://script.google.com/macros/s/AKfycbyPGgZ54q-lDUu5YxaeQbSJ-z2pDqM8ia4eTfshdpSNbrqBFF7fQZvglx9IeZn0PqHSTg/exec',
    SENDER_EMAIL: 'tsliferich@gmail.com',
    SENDER_NAME: 'FG Operations'
};

const FILE_CONFIG = {
    MAX_SIZE_PER_FILE: 10 * 1024 * 1024,
    MAX_TOTAL_SIZE: 10 * 1024 * 1024,
    MAX_FILES_PER_ITEM: 3
};

let ALL_ITEMS_LIST = [];
let REGULAR_ITEMS_LIST = [];
let KITCHEN_ITEMS_LIST = [];
let KITCHEN_ITEMS_BY_CATEGORY = { meat: [], vegetables: [], seafood: [] };
let itemsLoaded = false;
let isResubmitting = false;
let resubmissionData = null;
let currentStoreType = null;
let currentStoreValue = '';
let currentUser = null;

// Updated store definitions
const KITCHEN_STORES = ['CTK', 'Tabaco CN 2', 'Concourse Hall', 'Concourse Convention'];
const HYBRID_STORES = ['FG LEGAZPI', 'FG NAGA']; // These stores show both regular and kitchen items
const REGULAR_STORES = [
    'FG Express IROSIN', 'FG Express LIGAO', 'FG Express POLANGUI', 
    'FG Express MASBATE', 'FG Express DARAGA', 'FG Express BAAO', 
    'FG Express PIODURAN', 'FG Express RIZAL', 'FG to go TABACO', 'FG to go LEGAZPI'
];
const CONCOURSE_VARIANTS = ['Tabaco CN 2', 'Concourse Hall', 'Concourse Convention'];

let db, storage, auth;

function initializeFirebase() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
            console.log('✅ Firebase app initialized');
        }
      
        db = firebase.firestore();
        storage = firebase.storage();
        auth = firebase.auth();
      
        console.log('✅ Firebase services initialized successfully');
        return true;
    } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        showNotification('Firebase connection failed. Please check console.', 'error');
        return false;
    }
}

initializeFirebase();

if (auth) {
    auth.onAuthStateChanged((user) => {
        currentUser = user;
        console.log('Auth state changed:', user ? `User: ${user.email}` : 'No user');
    });
}

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

async function getItemCostSafe(itemName) {
    if (!itemName || itemName === 'N/A') return 0;
    try {
        const cost = await getItemCost(itemName);
        return Number(cost) || 0;
    } catch (err) {
        console.warn(`Could not fetch cost for "${itemName}"`, err);
        return 0;
    }
}

function getSelect2Value(selectId) {
    const $select = $(`#${selectId}`);
    if (!$select.length) {
        console.warn(`Select not found: #${selectId}`);
        return '';
    }

    let val;

    try {
        $select.trigger('change');
        $select.trigger('change.select2');
    } catch (e) {}

    try {
        val = $select.select2('data')?.[0]?.id;
        if (val && String(val).trim()) return String(val).trim();
    } catch (e) {}

    val = $select.val();
    if (val && String(val).trim()) return String(val).trim();

    const text = $select.next('.select2-container')
                       ?.find('.select2-selection__rendered')
                       ?.text()
                       ?.trim();

    if (text && text.length > 2 && !text.includes('Select') && !text.includes('search')) {
        return text;
    }

    console.warn(`All methods failed for #${selectId}`);
    return '';
}

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
    } else if (HYBRID_STORES.includes(selectedStore)) {
        // FG LEGAZPI or FG NAGA - show ALL items (regular + kitchen)
        currentStoreType = 'hybrid';
        indicator.style.display = 'flex';
        indicator.className = 'store-type-indicator hybrid';
        let displayText = `<strong>🏢 ${selectedStore}</strong> - ALL items (Store + Kitchen) are available.`;
        indicatorText.innerHTML = displayText;
        showNotification(`${selectedStore} selected. ALL items (Store + Kitchen) are now available.`, 'info');
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

function isKitchenItem(itemName) {
    return KITCHEN_ITEMS_LIST.includes(itemName);
}

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

    if (currentStoreType === 'hybrid') {
        // Show ALL items (regular + kitchen) grouped by type
        if (REGULAR_ITEMS_LIST.length > 0) {
            groupedItems.push({
                text: '📦 STORE ITEMS',
                children: REGULAR_ITEMS_LIST.map(item => ({ id: item, text: item }))
            });
        }
        
        // Add kitchen items with their categories
        if (KITCHEN_ITEMS_BY_CATEGORY.meat.length > 0) {
            groupedItems.push({
                text: '🥩 KITCHEN - MEAT',
                children: KITCHEN_ITEMS_BY_CATEGORY.meat.map(item => ({ id: item, text: item }))
            });
        }
        if (KITCHEN_ITEMS_BY_CATEGORY.vegetables.length > 0) {
            groupedItems.push({
                text: '🥬 KITCHEN - VEGETABLES',
                children: KITCHEN_ITEMS_BY_CATEGORY.vegetables.map(item => ({ id: item, text: item }))
            });
        }
        if (KITCHEN_ITEMS_BY_CATEGORY.seafood.length > 0) {
            groupedItems.push({
                text: '🦐 KITCHEN - SEAFOOD',
                children: KITCHEN_ITEMS_BY_CATEGORY.seafood.map(item => ({ id: item, text: item }))
            });
        }
    } else if (currentStoreType === 'kitchen') {
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
        const placeholderText = 'No items available';
        groupedItems = [{ id: '', text: placeholderText, disabled: true }];
    }

    $(`#${selectElementId}`).select2({
        data: groupedItems,
        placeholder: "Select an item...",
        disabled: false,
        allowClear: false,
        width: '100%',
        dropdownParent: $(`#${selectElementId}`).parent(),
        templateResult: formatItemResult,
        templateSelection: formatItemSelection
    }).on('select2:select', function(e) {
        // When an item is selected, check if it's a kitchen item and set unit to KG
        const selectedItem = e.params.data.id;
        const fieldId = selectElementId.replace('expiredItem-', '').replace('wasteItem-', '');
        
        if (isKitchenItem(selectedItem)) {
            // Find the unit select element for this field
            const isExpired = selectElementId.startsWith('expiredItem-');
            const unitSelectId = isExpired ? `unit-${fieldId}` : `wasteUnit-${fieldId}`;
            const unitSelect = document.getElementById(unitSelectId);
            
            if (unitSelect) {
                unitSelect.value = 'kilogram';
                unitSelect.disabled = true; // Lock it for kitchen items
                
                // Add visual indicator
                const unitGroup = unitSelect.closest('.form-group');
                if (unitGroup) {
                    let indicator = unitGroup.querySelector('.kitchen-unit-indicator');
                    if (!indicator) {
                        indicator = document.createElement('span');
                        indicator.className = 'kitchen-unit-indicator';
                        indicator.innerHTML = '🍳 Fixed: KG';
                        unitGroup.querySelector('label').appendChild(indicator);
                    }
                }
            }
        }
    });
}

function formatItemResult(item) {
    if (!item.id || item.disabled) return item.text;

    const isKitchen = isKitchenItem(item.id);
    
    if (isKitchen) {
        let categoryClass = '';
        let categoryText = '';
        if (KITCHEN_ITEMS_BY_CATEGORY.meat.includes(item.id)) {
            categoryClass = 'category-meat'; categoryText = 'MEAT';
        } else if (KITCHEN_ITEMS_BY_CATEGORY.vegetables.includes(item.id)) {
            categoryClass = 'category-vegetables'; categoryText = 'VEG';
        } else if (KITCHEN_ITEMS_BY_CATEGORY.seafood.includes(item.id)) {
            categoryClass = 'category-seafood'; categoryText = 'SEA';
        }
        return $(`<span><i class="fas fa-utensils" style="margin-right:5px;color:#856404;"></i> ${item.text} <span class="kitchen-category-badge ${categoryClass}">${categoryText}</span> <span style="margin-left:5px;font-size:9px;color:#2e7d32;">[KG]</span></span>`);
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

// ========== FIXED RESUBMISSION FUNCTION ==========
async function loadRejectedItem(itemIdFromUrl = null) {
    const itemIdInput = document.getElementById('itemId');
  
    let itemId = itemIdFromUrl || (itemIdInput ? itemIdInput.value.trim() : '');
  
    if (!itemId) {
        showNotification('Please enter an Item ID', 'error');
        return;
    }
  
    Loader.show('Searching for rejected item...');
  
    try {
        const parts = itemId.split('_');
        if (parts.length < 3) {
            console.warn('Item ID format may be invalid:', itemId);
            showNotification('Invalid Item ID format. Expected format: REPORTID_TYPE_INDEX', 'error');
            Loader.hide();
            return;
        }
      
        const reportId = parts[0];
        const itemType = parts[1] || 'expired';
        const itemIndex = parseInt(parts[2]) || 0;
      
        console.log(`Loading item: Report=${reportId}, Type=${itemType}, Index=${itemIndex}`);
      
        const reportDoc = await db.collection('wasteReports').doc(reportId).get();
        if (!reportDoc.exists) {
            throw new Error(`Report not found with ID: ${reportId}`);
        }
      
        const report = reportDoc.data();
        console.log('Full report loaded:', report);
      
        const items = itemType === 'expired' ? report.expiredItems : report.wasteItems;
        if (!items || items.length === 0) {
            throw new Error(`No ${itemType} items found in report`);
        }
      
        if (itemIndex >= items.length) {
            throw new Error(`Item index ${itemIndex} out of range. Report has ${items.length} items.`);
        }
      
        const rejectedItem = items[itemIndex];
        console.log('Rejected item loaded:', rejectedItem);
      
        if (rejectedItem.approvalStatus !== 'rejected' && rejectedItem.approvalStatus !== 'pending') {
            showNotification(`Item status is ${rejectedItem.approvalStatus || 'unknown'}. You can still resubmit.`, 'warning');
        }
      
        // Store COMPLETE report data for resubmission
        resubmissionData = {
            reportId: reportId,
            itemType: itemType,
            itemIndex: itemIndex,
            originalItem: rejectedItem,
            originalReportDate: report.reportDate,
            itemId: itemId,
            fullReport: report  // Store the complete original report
        };
      
        isResubmitting = true;
      
        // Set store
        const storeSelect = document.getElementById('store');
        if (storeSelect && report.store) {
            storeSelect.value = report.store;
            handleStoreChange(storeSelect);
        }
      
        // Set report date
        const reportDateInput = document.getElementById('reportDate');
        const reportDateNote = document.getElementById('reportDateNote');
        if (reportDateInput) {
            reportDateInput.value = report.reportDate || new Date().toISOString().split('T')[0];
            if (reportDateNote) {
                reportDateNote.innerHTML = `<i class="fas fa-info-circle"></i> Using original report date: ${formatDate(report.reportDate)}`;
            }
        }
      
        // Set email and personnel
        document.getElementById('email').value = report.email || '';
        document.getElementById('personnel').value = report.personnel || '';
      
        // Clear existing fields
        document.getElementById('expiredFields').innerHTML = '';
        document.getElementById('wasteFields').innerHTML = '';
      
        // Clear disposal type checkboxes
        document.querySelectorAll('input[name="disposalType"]').forEach(cb => cb.checked = false);
      
        // ===== FIX: Manually check the appropriate checkboxes and show containers =====
        const expiredContainer = document.getElementById('expiredContainer');
        const wasteContainer = document.getElementById('wasteContainer');
        
        // FIRST: Add all expired items from the original report
        if (report.expiredItems && report.expiredItems.length > 0) {
            document.getElementById('expired').checked = true;
            if (expiredContainer) expiredContainer.classList.add('show');
            
            report.expiredItems.forEach((item, idx) => {
                // If this is the rejected item we're resubmitting, mark it specially
                if (idx === itemIndex && itemType === 'expired') {
                    addExpiredItemWithData(item, itemId, reportId, idx, true); // true = isResubmittingItem
                } else {
                    // Add other expired items as read-only (they remain unchanged)
                    addExistingItemReadOnly(item, 'expired', idx, reportId);
                }
            });
        }
        
        // SECOND: Add all waste items from the original report
        if (report.wasteItems && report.wasteItems.length > 0) {
            document.getElementById('waste').checked = true;
            if (wasteContainer) wasteContainer.classList.add('show');
            
            report.wasteItems.forEach((item, idx) => {
                // If this is the rejected item we're resubmitting, mark it specially
                if (idx === itemIndex && itemType === 'waste') {
                    addWasteItemWithData(item, itemId, reportId, idx, true); // true = isResubmittingItem
                } else {
                    // Add other waste items as read-only (they remain unchanged)
                    addExistingItemReadOnly(item, 'waste', idx, reportId);
                }
            });
        }
        
        // ===== END OF FIX =====
      
        // Update UI to show we're in resubmission mode
        if (itemIdInput) {
            itemIdInput.value = itemId;
            itemIdInput.style.borderColor = '#28a745';
            itemIdInput.disabled = true;
        }
      
        const formHeader = document.querySelector('.form-header h1');
        if (formHeader) {
            formHeader.innerHTML = '<i class="fas fa-sync-alt"></i> Resubmit Rejected Item <span style="font-size:14px;color:#28a745;margin-left:10px;">(Updating existing report - other items preserved)</span>';
        }
        
        // Add a note about other items being preserved
        const infoDiv = document.createElement('div');
        infoDiv.className = 'resubmission-info';
        infoDiv.innerHTML = `
            <i class="fas fa-info-circle"></i> 
            You are resubmitting <strong>1 rejected item</strong>. 
            The other ${(report.expiredItems?.length || 0) + (report.wasteItems?.length || 0) - 1} item(s) in this report remain unchanged.
        `;
        
        // Add it after the form header
        const header = document.querySelector('.form-header');
        if (header && !document.querySelector('.resubmission-info')) {
            header.appendChild(infoDiv);
        }
      
        // Update disposal type hint and preview
        updateDisposalTypeHint();
        updateDisposalTypesPreview();
      
        showNotification('Rejected item loaded. Edit and resubmit. Other items in the report are preserved.', 'success');
      
    } catch (error) {
        console.error('Error loading rejected item:', error);
        showNotification('Error loading item: ' + error.message, 'error');
    } finally {
        Loader.hide();
    }
}

// NEW FUNCTION: Add existing item as read-only (cannot be edited)
function addExistingItemReadOnly(itemData, type, index, reportId) {
    const container = type === 'expired' ? document.getElementById('expiredFields') : document.getElementById('wasteFields');
    if (!container) return;
  
    const fieldId = `existing-${type}-${index}-${Date.now()}`;
  
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group existing-item';
    fieldGroup.id = fieldId;
  
    const itemCost = itemData.itemCost || 0;
    const totalCost = itemCost * (itemData.quantity || 0);
  
    let content = '';
    
    if (type === 'expired') {
        content = `
            <div class="field-header">
                <div class="field-title">
                    <i class="fas fa-calendar-times"></i> Existing Expired Item (Read Only)
                    <span class="existing-badge">PRESERVED</span>
                </div>
            </div>
            <div class="form-grid existing-item-grid">
                <div class="info-row"><strong>Item:</strong> ${itemData.item || 'N/A'}</div>
                <div class="info-row"><strong>Delivered:</strong> ${formatDate(itemData.deliveredDate)}</div>
                <div class="info-row"><strong>Manufactured:</strong> ${formatDate(itemData.manufacturedDate)}</div>
                <div class="info-row"><strong>Expiration:</strong> ${formatDate(itemData.expirationDate)}</div>
                <div class="info-row"><strong>Quantity:</strong> ${itemData.quantity || 0} ${itemData.unit || 'units'}</div>
                <div class="info-row"><strong>Total Cost:</strong> ₱${totalCost.toFixed(2)}</div>
                ${itemData.notes ? `<div class="info-row full-width"><strong>Notes:</strong> ${itemData.notes}</div>` : ''}
            </div>
            <input type="hidden" name="existingItems[${fieldId}][type]" value="expired">
            <input type="hidden" name="existingItems[${fieldId}][item]" value="${itemData.item || ''}">
            <input type="hidden" name="existingItems[${fieldId}][quantity]" value="${itemData.quantity || 0}">
            <input type="hidden" name="existingItems[${fieldId}][unit]" value="${itemData.unit || 'pieces'}">
            <input type="hidden" name="existingItems[${fieldId}][itemCost]" value="${itemCost}">
            <input type="hidden" name="existingItems[${fieldId}][index]" value="${index}">
        `;
    } else {
        content = `
            <div class="field-header">
                <div class="field-title">
                    <i class="fas fa-trash-alt"></i> Existing Waste Item (Read Only)
                    <span class="existing-badge">PRESERVED</span>
                </div>
            </div>
            <div class="form-grid existing-item-grid">
                <div class="info-row"><strong>Item:</strong> ${itemData.item || 'N/A'}</div>
                <div class="info-row"><strong>Reason:</strong> ${itemData.reason || 'N/A'}</div>
                <div class="info-row"><strong>Quantity:</strong> ${itemData.quantity || 0} ${itemData.unit || 'units'}</div>
                <div class="info-row"><strong>Total Cost:</strong> ₱${totalCost.toFixed(2)}</div>
                ${itemData.notes ? `<div class="info-row full-width"><strong>Notes:</strong> ${itemData.notes}</div>` : ''}
            </div>
            <input type="hidden" name="existingItems[${fieldId}][type]" value="waste">
            <input type="hidden" name="existingItems[${fieldId}][item]" value="${itemData.item || ''}">
            <input type="hidden" name="existingItems[${fieldId}][quantity]" value="${itemData.quantity || 0}">
            <input type="hidden" name="existingItems[${fieldId}][unit]" value="${itemData.unit || 'pieces'}">
            <input type="hidden" name="existingItems[${fieldId}][itemCost]" value="${itemCost}">
            <input type="hidden" name="existingItems[${fieldId}][index]" value="${index}">
        `;
    }
  
    fieldGroup.innerHTML = content;
    container.appendChild(fieldGroup);
}

// UPDATED addExpiredItemWithData with isResubmittingItem flag
function addExpiredItemWithData(itemData, preservedItemId = null, originalReportId = null, originalItemIndex = null, isResubmittingItem = false) {
    const expiredFields = document.getElementById('expiredFields');
    if (!expiredFields) return;
  
    const fieldId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';
    if (isResubmittingItem) {
        fieldGroup.classList.add('resubmitting-item');
    }
    fieldGroup.id = `expired-${fieldId}`;
  
    const safeItemData = {
        item: itemData?.item || '',
        deliveredDate: itemData?.deliveredDate || '',
        manufacturedDate: itemData?.manufacturedDate || '',
        expirationDate: itemData?.expirationDate || '',
        quantity: itemData?.quantity || 0,
        unit: itemData?.unit || 'pieces',
        notes: itemData?.notes || '',
        documentation: itemData?.documentation || [],
        rejectionReason: itemData?.rejectionReason || '',
        itemId: itemData?.itemId || '',
        originalItemId: preservedItemId || '',
        itemCost: itemData?.itemCost || 0
    };
  
    // Determine if this is a kitchen item to set unit
    const isKitchen = isKitchenItem(safeItemData.item);
    const unitValue = isKitchen ? 'kilogram' : (safeItemData.unit || 'pieces');
    const unitDisabled = isKitchen ? 'disabled' : '';
  
    console.log(`Adding expired field - DOM ID: ${fieldId}, preserved rejection ID: ${preservedItemId}, isKitchen: ${isKitchen}, isResubmittingItem: ${isResubmittingItem}`);
  
    fieldGroup.innerHTML = `
        <div class="field-header">
            <div class="field-title">
                ${isResubmittingItem ? '<i class="fas fa-sync-alt"></i> Resubmitting Expired Item' : 'Expired Item'} 
                ${isKitchen ? '<span class="kitchen-unit-indicator">🍳 Fixed: KG</span>' : ''}
                ${isResubmittingItem ? '<span class="resubmit-badge">RESUBMITTING</span>' : ''}
            </div>
            <button type="button" class="remove-btn" onclick="removeField('expired-${fieldId}')" ${isResubmittingItem ? 'disabled' : ''}>×</button>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="expiredItem-${fieldId}">Item Name <span class="required">*</span></label>
                <select class="item-dropdown" id="expiredItem-${fieldId}" name="expiredItems[${fieldId}][item]" required>
                    <option value="" disabled>Select or type to search...</option>
                </select>
                <span class="note">Type to search or select from dropdown</span>
            </div>
            <div class="form-group">
                <label for="deliveredDate-${fieldId}">Delivered Date <span class="required">*</span></label>
                <input type="date" id="deliveredDate-${fieldId}" name="expiredItems[${fieldId}][deliveredDate]" required value="${safeItemData.deliveredDate || ''}">
            </div>
            <div class="form-group">
                <label for="manufacturedDate-${fieldId}">Manufactured Date <span class="required">*</span></label>
                <input type="date" id="manufacturedDate-${fieldId}" name="expiredItems[${fieldId}][manufacturedDate]" required value="${safeItemData.manufacturedDate || ''}">
            </div>
            <div class="form-group">
                <label for="expirationDate-${fieldId}">Expiration Date <span class="required">*</span></label>
                <input type="date" id="expirationDate-${fieldId}" name="expiredItems[${fieldId}][expirationDate]" required value="${safeItemData.expirationDate || ''}">
            </div>
            <div class="form-group">
                <label for="quantity-${fieldId}">Quantity <span class="required">*</span></label>
                <input type="number" id="quantity-${fieldId}" name="expiredItems[${fieldId}][quantity]" required min="0" step="0.01" placeholder="0.00" value="${safeItemData.quantity || 0}">
            </div>
            <div class="form-group">
                <label for="unit-${fieldId}">Unit of Measure <span class="required">*</span></label>
                <select id="unit-${fieldId}" name="expiredItems[${fieldId}][unit]" required ${unitDisabled}>
                    <option value="" disabled>Select unit</option>
                    <option value="pieces" ${unitValue === 'pieces' ? 'selected' : ''}>Pieces</option>
                    <option value="packs" ${unitValue === 'packs' ? 'selected' : ''}>Packs</option>
                    <option value="kilogram" ${unitValue === 'kilogram' ? 'selected' : ''}>Kilogram</option>
                    <option value="servings" ${unitValue === 'servings' ? 'selected' : ''}>Servings</option>
                </select>
                ${isKitchen ? '<span class="note" style="color:#2e7d32;"><i class="fas fa-lock"></i> Kitchen items use KG only</span>' : ''}
            </div>
            <div class="form-group file-upload-container">
                <label for="documentation-${fieldId}">Documentation <span class="required">*</span></label>
                <input type="file" id="documentation-${fieldId}" name="expiredItems[${fieldId}][documentation]" required accept="image/*,.pdf" multiple onchange="createFilePreview(this, 'documentation-${fieldId}-preview')">
                <div id="documentation-${fieldId}-preview" class="file-preview"></div>
                <span class="note">Upload photos or PDFs (Max 10MB per file, 3 files max)</span>
                ${safeItemData.documentation?.length > 0 ? `<div style="margin-top:5px;font-size:12px;color:#666;"><i class="fas fa-info-circle"></i> Previous: ${safeItemData.documentation.length} file(s) — new uploads replace old</div>` : ''}
            </div>
            <div class="form-group">
                <label for="notes-${fieldId}">Additional Notes</label>
                <textarea id="notes-${fieldId}" name="expiredItems[${fieldId}][notes]" rows="2" placeholder="Any additional information">${safeItemData.notes || ''}</textarea>
            </div>
            <input type="hidden" id="originalItemId-${fieldId}" name="expiredItems[${fieldId}][originalItemId]" value="${preservedItemId || ''}">
            <input type="hidden" id="originalReportId-${fieldId}" name="expiredItems[${fieldId}][originalReportId]" value="${originalReportId || ''}">
            <input type="hidden" id="itemIndex-${fieldId}" name="expiredItems[${fieldId}][itemIndex]" value="${originalItemIndex !== null ? originalItemIndex : ''}">
            <input type="hidden" id="originalItemCost-${fieldId}" name="expiredItems[${fieldId}][originalItemCost]" value="${safeItemData.itemCost || 0}">
            ${safeItemData.rejectionReason ? `
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Previous Rejection Reason</label>
                <div style="background:#fff3cd;padding:10px;border-radius:4px;border-left:4px solid #ffc107;">
                    <strong><i class="fas fa-exclamation-triangle"></i> ${safeItemData.rejectionReason}</strong>
                </div>
            </div>` : ''}
        </div>
    `;
  
    expiredFields.appendChild(fieldGroup);
  
    setTimeout(() => {
        initSelect2Dropdown(`expiredItem-${fieldId}`);
        setTimeout(() => {
            if (safeItemData.item) {
                const $sel = $(`#expiredItem-${fieldId}`);
                $sel.val(safeItemData.item).trigger('change.select2').trigger('change');
                console.log(`[PRE-FILL expired ${fieldId}] Set "${safeItemData.item}" → val:`, $sel.val(), 'displayed:', $sel.next('.select2-container').find('.select2-selection__rendered').text().trim());
            }
        }, 800);
    }, 300);
}

// UPDATED addWasteItemWithData with isResubmittingItem flag
function addWasteItemWithData(itemData, preservedItemId = null, originalReportId = null, originalItemIndex = null, isResubmittingItem = false) {
    const wasteFields = document.getElementById('wasteFields');
    if (!wasteFields) return;
  
    const fieldId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  
    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'field-group';
    if (isResubmittingItem) {
        fieldGroup.classList.add('resubmitting-item');
    }
    fieldGroup.id = `waste-${fieldId}`;
  
    const safeItemData = {
        item: itemData?.item || '',
        reason: itemData?.reason || '',
        quantity: itemData?.quantity || 0,
        unit: itemData?.unit || 'pieces',
        notes: itemData?.notes || '',
        documentation: itemData?.documentation || [],
        rejectionReason: itemData?.rejectionReason || '',
        itemId: itemData?.itemId || '',
        originalItemId: preservedItemId || '',
        itemCost: itemData?.itemCost || 0
    };
  
    // Determine if this is a kitchen item to set unit
    const isKitchen = isKitchenItem(safeItemData.item);
    const unitValue = isKitchen ? 'kilogram' : (safeItemData.unit || 'pieces');
    const unitDisabled = isKitchen ? 'disabled' : '';
  
    console.log(`Adding waste field - DOM ID: ${fieldId}, preserved rejection ID: ${preservedItemId}, isKitchen: ${isKitchen}, isResubmittingItem: ${isResubmittingItem}`);
  
    fieldGroup.innerHTML = `
        <div class="field-header">
            <div class="field-title">
                ${isResubmittingItem ? '<i class="fas fa-sync-alt"></i> Resubmitting Waste Item' : 'Waste Item'} 
                ${isKitchen ? '<span class="kitchen-unit-indicator">🍳 Fixed: KG</span>' : ''}
                ${isResubmittingItem ? '<span class="resubmit-badge">RESUBMITTING</span>' : ''}
            </div>
            <button type="button" class="remove-btn" onclick="removeField('waste-${fieldId}')" ${isResubmittingItem ? 'disabled' : ''}>×</button>
        </div>
        <div class="form-grid">
            <div class="form-group">
                <label for="wasteItem-${fieldId}">Item/Description <span class="required">*</span></label>
                <select class="item-dropdown" id="wasteItem-${fieldId}" name="wasteItems[${fieldId}][item]" required>
                    <option value="" disabled>Select or type to search...</option>
                </select>
                <span class="note">Type to search or select from dropdown</span>
            </div>
            <div class="form-group">
                <label for="reason-${fieldId}">Reason for Waste <span class="required">*</span></label>
                <select id="reason-${fieldId}" name="wasteItems[${fieldId}][reason]" required onchange="toggleAdditionalNotesRequirement('${fieldId}')">
                    <option value="" disabled>Select reason</option>
                    <option value="spoilage" ${safeItemData.reason === 'spoilage' ? 'selected' : ''}>Spoilage</option>
                    <option value="damaged" ${safeItemData.reason === 'damaged' ? 'selected' : ''}>Damaged Packaging</option>
                    <option value="human_error" ${safeItemData.reason === 'human_error' ? 'selected' : ''}>Human Error</option>
                    <option value="customer_return" ${safeItemData.reason === 'customer_return' ? 'selected' : ''}>Customer Return</option>
                    <option value="quality_issue" ${safeItemData.reason === 'quality_issue' ? 'selected' : ''}>Quality Issue</option>
                    <option value="other" ${safeItemData.reason === 'other' ? 'selected' : ''}>Other</option>
                </select>
            </div>
            <div class="form-group">
                <label for="wasteQuantity-${fieldId}">Quantity <span class="required">*</span></label>
                <input type="number" id="wasteQuantity-${fieldId}" name="wasteItems[${fieldId}][quantity]" required min="0" step="0.01" placeholder="0.00" value="${safeItemData.quantity || 0}">
            </div>
            <div class="form-group">
                <label for="wasteUnit-${fieldId}">Unit of Measure <span class="required">*</span></label>
                <select id="wasteUnit-${fieldId}" name="wasteItems[${fieldId}][unit]" required ${unitDisabled}>
                    <option value="" disabled>Select unit</option>
                    <option value="pieces" ${unitValue === 'pieces' ? 'selected' : ''}>Pieces</option>
                    <option value="packs" ${unitValue === 'packs' ? 'selected' : ''}>Packs</option>
                    <option value="kilogram" ${unitValue === 'kilogram' ? 'selected' : ''}>Kilogram</option>
                    <option value="servings" ${unitValue === 'servings' ? 'selected' : ''}>Servings</option>
                </select>
                ${isKitchen ? '<span class="note" style="color:#2e7d32;"><i class="fas fa-lock"></i> Kitchen items use KG only</span>' : ''}
            </div>
            <div class="form-group file-upload-container">
                <label for="wasteDocumentation-${fieldId}">Documentation <span class="required">*</span></label>
                <input type="file" id="wasteDocumentation-${fieldId}" name="wasteItems[${fieldId}][documentation]" required accept="image/*,.pdf" multiple onchange="createFilePreview(this, 'wasteDocumentation-${fieldId}-preview')">
                <div id="wasteDocumentation-${fieldId}-preview" class="file-preview"></div>
                <span class="note">Upload photos or PDFs (Max 10MB per file, 3 files max)</span>
                ${safeItemData.documentation?.length > 0 ? `<div style="margin-top:5px;font-size:12px;color:#666;"><i class="fas fa-info-circle"></i> Previous: ${safeItemData.documentation.length} file(s) — new uploads replace old</div>` : ''}
            </div>
            <div class="form-group">
                <label for="wasteNotes-${fieldId}">Additional Notes <span id="notes-required-${fieldId}" class="required" style="${['spoilage','human_error','customer_return','quality_issue','other'].includes(safeItemData.reason) ? '' : 'display:none;'}">*</span></label>
                <textarea id="wasteNotes-${fieldId}" name="wasteItems[${fieldId}][notes]" rows="2" placeholder="${getNotesPlaceholder(safeItemData.reason)}">${safeItemData.notes || ''}</textarea>
            </div>
            <input type="hidden" id="originalItemId-${fieldId}" name="wasteItems[${fieldId}][originalItemId]" value="${preservedItemId || ''}">
            <input type="hidden" id="originalReportId-${fieldId}" name="wasteItems[${fieldId}][originalReportId]" value="${originalReportId || ''}">
            <input type="hidden" id="itemIndex-${fieldId}" name="wasteItems[${fieldId}][itemIndex]" value="${originalItemIndex !== null ? originalItemIndex : ''}">
            <input type="hidden" id="originalItemCost-${fieldId}" name="wasteItems[${fieldId}][originalItemCost]" value="${safeItemData.itemCost || 0}">
            ${safeItemData.rejectionReason ? `
            <div class="form-group" style="grid-column: 1 / -1;">
                <label>Previous Rejection Reason</label>
                <div style="background:#fff3cd;padding:10px;border-radius:4px;border-left:4px solid #ffc107;">
                    <strong><i class="fas fa-exclamation-triangle"></i> ${safeItemData.rejectionReason}</strong>
                </div>
            </div>` : ''}
        </div>
    `;
  
    wasteFields.appendChild(fieldGroup);
  
    setTimeout(() => {
        initSelect2Dropdown(`wasteItem-${fieldId}`);
        setTimeout(() => {
            if (safeItemData.item) {
                const $sel = $(`#wasteItem-${fieldId}`);
                $sel.val(safeItemData.item).trigger('change.select2').trigger('change');
                console.log(`[PRE-FILL waste ${fieldId}] Set "${safeItemData.item}" → val:`, $sel.val(), 'displayed:', $sel.next('.select2-container').find('.select2-selection__rendered').text().trim());
            }
            toggleAdditionalNotesRequirement(fieldId);
        }, 800);
    }, 300);
}

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

function toggleAdditionalNotesRequirement(itemId) {
    const reasonSelect = document.getElementById(`reason-${itemId}`);
    const notesRequired = document.getElementById(`notes-required-${itemId}`);
    const notesTextarea = document.getElementById(`wasteNotes-${itemId}`);
 
    if (!reasonSelect) return;

    const selectedReason = reasonSelect.value;

    const isRequired = ['spoilage', 'human_error', 'customer_return', 'quality_issue', 'other'].includes(selectedReason);

    if (notesRequired) notesRequired.style.display = isRequired ? 'inline' : 'none';
}

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
                <span class="note kitchen-unit-note" style="display:none; color:#2e7d32;"><i class="fas fa-lock"></i> Kitchen items will automatically use KG</span>
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
                <span class="note kitchen-unit-note" style="display:none; color:#2e7d32;"><i class="fas fa-lock"></i> Kitchen items will automatically use KG</span>
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
        // Validate only editable expired items (those with selects/inputs, not the read-only preserved ones)
        const expiredItems = document.querySelectorAll('#expiredFields .field-group:not(.existing-item)');
        if (expiredItems.length === 0) {
            // If there are only existing items, that's fine
            const hasExisting = document.querySelectorAll('#expiredFields .existing-item').length > 0;
            if (!hasExisting) {
                showNotification('Please add at least one expired item.', 'error');
                return false;
            }
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
        // Validate only editable waste items (those with selects/inputs, not the read-only preserved ones)
        const wasteItems = document.querySelectorAll('#wasteFields .field-group:not(.existing-item)');
        if (wasteItems.length === 0) {
            // If there are only existing items, that's fine
            const hasExisting = document.querySelectorAll('#wasteFields .existing-item').length > 0;
            if (!hasExisting) {
                showNotification('Please add at least one waste item.', 'error');
                return false;
            }
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
     
        const isActuallyResubmission = isResubmissionUpdate || isResubmitting;
     
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

// ========== FIXED HANDLE SUBMIT FUNCTION ==========
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
  
    let originalReportId = null;
    let originalItemIndex = null;
    let originalItemType = null;
    
    // Get resubmission info if available
    if (isResubmitting && resubmissionData) {
        originalReportId = resubmissionData.reportId;
        originalItemIndex = resubmissionData.itemIndex;
        originalItemType = resubmissionData.itemType;
    }

    const mainReportId = (isResubmitting && originalReportId) ? originalReportId : 'REPORT-' + Date.now();

    // Collect ALL items for the report
    let expiredItemsArray = [];
    let wasteItemsArray = [];
    let allItems = [];

    // ===== COLLECT EXISTING (PRESERVED) ITEMS =====
    // These are the read-only items from the original report that we're preserving
    
    // Collect preserved expired items
    const existingExpiredItems = document.querySelectorAll('#expiredFields .existing-item');
    existingExpiredItems.forEach(item => {
        const inputs = item.querySelectorAll('input[type="hidden"]');
        const itemData = {};
        inputs.forEach(input => {
            const name = input.name.split('][').pop().replace(']', '');
            itemData[name] = input.value;
        });
        
        if (itemData.item) {
            const preservedItem = {
                type: 'expired',
                item: itemData.item,
                quantity: parseFloat(itemData.quantity) || 0,
                unit: itemData.unit || 'pieces',
                itemCost: parseFloat(itemData.itemCost) || 0,
                documentation: [], // Keep existing docs? This needs to be handled
                approvalStatus: 'pending', // Reset status to pending
                submittedAt: new Date().toISOString(),
                preservedFromOriginal: true,
                originalIndex: itemData.index
            };
            
            // TODO: Need to preserve original documentation? This is complex
            // For now, we'll mark as needing review
            
            expiredItemsArray.push(preservedItem);
            allItems.push(preservedItem);
        }
    });
    
    // Collect preserved waste items
    const existingWasteItems = document.querySelectorAll('#wasteFields .existing-item');
    existingWasteItems.forEach(item => {
        const inputs = item.querySelectorAll('input[type="hidden"]');
        const itemData = {};
        inputs.forEach(input => {
            const name = input.name.split('][').pop().replace(']', '');
            itemData[name] = input.value;
        });
        
        if (itemData.item) {
            const preservedItem = {
                type: 'waste',
                item: itemData.item,
                quantity: parseFloat(itemData.quantity) || 0,
                unit: itemData.unit || 'pieces',
                itemCost: parseFloat(itemData.itemCost) || 0,
                reason: 'preserved', // Placeholder
                documentation: [],
                approvalStatus: 'pending',
                submittedAt: new Date().toISOString(),
                preservedFromOriginal: true,
                originalIndex: itemData.index
            };
            
            wasteItemsArray.push(preservedItem);
            allItems.push(preservedItem);
        }
    });

    // ===== COLLECT EDITABLE EXPIRED ITEMS (including resubmitted item) =====
    if (disposalTypes.includes('expired')) {
        const editableExpiredFields = document.querySelectorAll('#expiredFields .field-group:not(.existing-item)');
        
        for (let field of editableExpiredFields) {
            const fieldId = field.id.split('-')[1];

            const $sel = $(`#expiredItem-${fieldId}`);
            try {
                $sel.trigger('change.select2').trigger('change');
            } catch (e) {}

            const selectedItem = getSelect2Value(`expiredItem-${fieldId}`) || 'Unknown Item';
            console.log(`[SUBMIT expired ${fieldId}] final selectedItem = "${selectedItem}"`);

            const itemCost = await getItemCostSafe(selectedItem);
            const deliveredDate = document.getElementById(`deliveredDate-${fieldId}`)?.value || '';
            const manufacturedDate = document.getElementById(`manufacturedDate-${fieldId}`)?.value || '';
            const expirationDate = document.getElementById(`expirationDate-${fieldId}`)?.value || '';
            const quantity = parseFloat(document.getElementById(`quantity-${fieldId}`)?.value) || 0;
            
            // Get unit value - for kitchen items, force to kilogram
            let unit = document.getElementById(`unit-${fieldId}`)?.value || '';
            if (isKitchenItem(selectedItem)) {
                unit = 'kilogram';
            }
            
            const notes = document.getElementById(`notes-${fieldId}`)?.value?.trim() || '';
            const originalItemIdInput = document.getElementById(`originalItemId-${fieldId}`);
            const originalItemId = originalItemIdInput?.value || null;
            const itemIndexInputLocal = document.getElementById(`itemIndex-${fieldId}`);
            const itemIndexVal = itemIndexInputLocal ? parseInt(itemIndexInputLocal.value) : null;

            const expiredItem = {
                type: 'expired',
                item: selectedItem,
                deliveredDate,
                manufacturedDate,
                expirationDate,
                quantity,
                unit,
                notes,
                itemId: fieldId,
                itemCost,
                documentation: [],
                approvalStatus: 'pending',
                submittedAt: new Date().toISOString(),
                originalItemId,
                itemIndex: itemIndexVal,
                resubmittedAt: isResubmitting ? new Date().toISOString() : null,
                previousRejectionReason: resubmissionData?.originalItem?.rejectionReason || null
            };

            const fileInput = document.getElementById(`documentation-${fieldId}`);
            if (fileInput?.files?.length > 0) {
                expiredItem.hasFiles = true;
                expiredItem.fileCount = fileInput.files.length;
            }

            expiredItemsArray.push(expiredItem);
            allItems.push(expiredItem);
        }
    }

    // ===== COLLECT EDITABLE WASTE ITEMS (including resubmitted item) =====
    if (disposalTypes.includes('waste')) {
        const editableWasteFields = document.querySelectorAll('#wasteFields .field-group:not(.existing-item)');
        
        for (let field of editableWasteFields) {
            const fieldId = field.id.split('-')[1];

            const $sel = $(`#wasteItem-${fieldId}`);
            try {
                $sel.trigger('change.select2').trigger('change');
            } catch (e) {}

            const selectedItem = getSelect2Value(`wasteItem-${fieldId}`) || 'Unknown Item';
            console.log(`[SUBMIT waste ${fieldId}] final selectedItem = "${selectedItem}"`);

            const itemCost = await getItemCostSafe(selectedItem);
            const reason = document.getElementById(`reason-${fieldId}`)?.value || '';
            const quantity = parseFloat(document.getElementById(`wasteQuantity-${fieldId}`)?.value) || 0;
            
            // Get unit value - for kitchen items, force to kilogram
            let unit = document.getElementById(`wasteUnit-${fieldId}`)?.value || '';
            if (isKitchenItem(selectedItem)) {
                unit = 'kilogram';
            }
            
            const notes = document.getElementById(`wasteNotes-${fieldId}`)?.value?.trim() || '';
            const originalItemIdInput = document.getElementById(`originalItemId-${fieldId}`);
            const originalItemId = originalItemIdInput?.value || null;
            const itemIndexInputLocal = document.getElementById(`itemIndex-${fieldId}`);
            const itemIndexVal = itemIndexInputLocal ? parseInt(itemIndexInputLocal.value) : null;

            const wasteItem = {
                type: 'waste',
                item: selectedItem,
                reason,
                quantity,
                unit,
                notes,
                itemId: fieldId,
                itemCost,
                documentation: [],
                approvalStatus: 'pending',
                submittedAt: new Date().toISOString(),
                originalItemId,
                itemIndex: itemIndexVal,
                resubmittedAt: isResubmitting ? new Date().toISOString() : null,
                previousRejectionReason: resubmissionData?.originalItem?.rejectionReason || null
            };

            const fileInput = document.getElementById(`wasteDocumentation-${fieldId}`);
            if (fileInput?.files?.length > 0) {
                wasteItem.hasFiles = true;
                wasteItem.fileCount = fileInput.files.length;
            }

            wasteItemsArray.push(wasteItem);
            allItems.push(wasteItem);
        }
    }

    const totalFiles = allItems.reduce((sum, item) => sum + (item.fileCount || 0), 0);

    // ===== BUILD REPORT DATA =====
    let baseReportData;
    
    if (isResubmitting && originalReportId && resubmissionData) {
        console.log(`🔄 Updating existing report: ${originalReportId}`);
      
        const originalReport = resubmissionData.fullReport;
      
        // Create updated items arrays
        let updatedExpiredItems = [];
        let updatedWasteItems = [];
        
        // Keep track of which indices we've processed
        const processedExpiredIndices = new Set();
        const processedWasteIndices = new Set();
        
        // First, add all preserved items at their original indices
        if (originalReport.expiredItems) {
            originalReport.expiredItems.forEach((originalItem, idx) => {
                // Check if this is the item being resubmitted
                if (idx === originalItemIndex && originalItemType === 'expired') {
                    // This will be replaced by the resubmitted item later
                    return;
                }
                
                // Check if this item was preserved (i.e., we have it in existingExpiredItems)
                const preservedItem = expiredItemsArray.find(item => 
                    item.preservedFromOriginal && item.originalIndex === idx
                );
                
                if (preservedItem) {
                    updatedExpiredItems[idx] = preservedItem;
                    processedExpiredIndices.add(idx);
                } else {
                    // If not preserved, keep original but reset status
                    updatedExpiredItems[idx] = {
                        ...originalItem,
                        approvalStatus: 'pending',
                        resubmissionHistory: [
                            ...(originalItem.resubmissionHistory || []),
                            {
                                preservedAt: new Date().toISOString(),
                                note: 'Item preserved during resubmission of another item'
                            }
                        ]
                    };
                    processedExpiredIndices.add(idx);
                }
            });
        }
        
        if (originalReport.wasteItems) {
            originalReport.wasteItems.forEach((originalItem, idx) => {
                // Check if this is the item being resubmitted
                if (idx === originalItemIndex && originalItemType === 'waste') {
                    // This will be replaced by the resubmitted item later
                    return;
                }
                
                // Check if this item was preserved
                const preservedItem = wasteItemsArray.find(item => 
                    item.preservedFromOriginal && item.originalIndex === idx
                );
                
                if (preservedItem) {
                    updatedWasteItems[idx] = preservedItem;
                    processedWasteIndices.add(idx);
                } else {
                    // If not preserved, keep original but reset status
                    updatedWasteItems[idx] = {
                        ...originalItem,
                        approvalStatus: 'pending',
                        resubmissionHistory: [
                            ...(originalItem.resubmissionHistory || []),
                            {
                                preservedAt: new Date().toISOString(),
                                note: 'Item preserved during resubmission of another item'
                            }
                        ]
                    };
                    processedWasteIndices.add(idx);
                }
            });
        }
        
        // Now add the resubmitted items (they go at their original indices)
        if (originalItemType === 'expired') {
            const resubmittedItem = expiredItemsArray.find(item => 
                !item.preservedFromOriginal && item.originalItemId
            );
            if (resubmittedItem) {
                updatedExpiredItems[originalItemIndex] = {
                    ...resubmittedItem,
                    resubmissionHistory: [
                        ...(updatedExpiredItems[originalItemIndex]?.resubmissionHistory || []),
                        {
                            resubmittedAt: new Date().toISOString(),
                            previousData: originalReport.expiredItems[originalItemIndex],
                            resubmittedBy: currentUser?.email || 'System'
                        }
                    ]
                };
                processedExpiredIndices.add(originalItemIndex);
            }
        } else if (originalItemType === 'waste') {
            const resubmittedItem = wasteItemsArray.find(item => 
                !item.preservedFromOriginal && item.originalItemId
            );
            if (resubmittedItem) {
                updatedWasteItems[originalItemIndex] = {
                    ...resubmittedItem,
                    resubmissionHistory: [
                        ...(updatedWasteItems[originalItemIndex]?.resubmissionHistory || []),
                        {
                            resubmittedAt: new Date().toISOString(),
                            previousData: originalReport.wasteItems[originalItemIndex],
                            resubmittedBy: currentUser?.email || 'System'
                        }
                    ]
                };
                processedWasteIndices.add(originalItemIndex);
            }
        }
        
        // Add any new items (these will go at the end)
        expiredItemsArray.forEach(item => {
            if (!item.preservedFromOriginal && !item.originalItemId) {
                // New item
                updatedExpiredItems.push(item);
            }
        });
        
        wasteItemsArray.forEach(item => {
            if (!item.preservedFromOriginal && !item.originalItemId) {
                // New item
                updatedWasteItems.push(item);
            }
        });
        
        // Filter out any undefined entries and re-index
        updatedExpiredItems = updatedExpiredItems.filter(item => item !== undefined);
        updatedWasteItems = updatedWasteItems.filter(item => item !== undefined);
      
        baseReportData = {
            ...originalReport,
            expiredItems: updatedExpiredItems,
            wasteItems: updatedWasteItems,
            resubmissionUpdatedAt: new Date().toISOString(),
            resubmissionHistory: [
                ...(originalReport.resubmissionHistory || []),
                {
                    updatedAt: new Date().toISOString(),
                    itemType: originalItemType,
                    itemIndex: originalItemIndex,
                    resubmittedBy: currentUser?.email || 'System',
                    note: `Resubmitted one item, preserved ${(originalReport.expiredItems?.length || 0) + (originalReport.wasteItems?.length || 0) - 1} other items`
                }
            ]
        };
    } else {
        baseReportData = {
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
    }

    if (disposalTypes.includes('noWaste')) {
        baseReportData.noWaste = true;
        baseReportData.notes = "No waste or expired items to report for this period";
    }

    try {
        const emailItems = allItems.map(item => ({
            type: item.type,
            item: item.item || 'N/A',
            quantity: Number(item.quantity) || 0,
            unit: item.unit || '',
            reason: item.reason || 'N/A',
            notes: item.notes || '',
            itemCost: Number(item.itemCost) || 0
        }));
        console.log("Items that will be sent to email:", JSON.stringify(emailItems, null, 2));

        const docRef = db.collection('wasteReports').doc(mainReportId);
        await docRef.set(baseReportData, { merge: true });
      
        console.log(`✅ Report ${isResubmitting ? 'updated' : 'created'}: ${mainReportId}`);
     
        const emailResult = await sendEmailConfirmation(
            baseReportData,
            mainReportId,
            emailItems,
            isResubmitting
        );
     
        if (emailResult.success) {
            await docRef.update({
                emailSent: true,
                emailSentAt: new Date().toISOString(),
                emailStatus: 'sent'
            });
            showNotification('Email confirmation sent!', 'success');
        } else {
            await docRef.update({
                emailSent: false,
                emailError: emailResult.error,
                emailStatus: 'failed'
            });
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
         
            await docRef.update({
                expiredItems: processedExpired,
                wasteItems: processedWaste,
                totalExpiredItems: processedExpired.length,
                totalWasteItems: processedWaste.length,
                hasImages: processedItems.some(i => i.hasImages),
                imageCount: processedItems.reduce((s, i) => s + (i.totalFiles || 0), 0),
                fileUploadComplete: true,
                fileUploadedAt: new Date().toISOString()
            });
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
      
        const itemIdInput = document.getElementById('itemId');
        if (itemIdInput) {
            itemIdInput.value = '';
            itemIdInput.style.borderColor = '';
            itemIdInput.disabled = false;
        }
        
        // Remove the resubmission info div if it exists
        const resubmitInfo = document.querySelector('.resubmission-info');
        if (resubmitInfo) {
            resubmitInfo.remove();
        }
      
        isResubmitting = false;
        resubmissionData = null;
      
        const formHeader = document.querySelector('.form-header h1');
        if (formHeader) {
            formHeader.innerHTML = '<i class="fas fa-file-alt"></i> Submit Waste/Disposal Report';
        }
     
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        Loader.hide();
     
        setTimeout(() => {
            if (confirm(`Report ${mainReportId} ${isResubmitting ? 'updated' : 'submitted'} successfully!\n\nView all reports?`)) {
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

function getUrlParameter(name) {
    name = name.replace(/[\[\]]/g, '\\$&');
    const url = window.location.href;
    const regex = new RegExp('[?&]' + name + '(=([^&#]*)|&|#|$)');
    const results = regex.exec(url);
    if (!results) return null;
    if (!results[2]) return '';
    return decodeURIComponent(results[2].replace(/\+/g, ' '));
}

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
      
        const itemIdFromUrl = getUrlParameter('itemId');
        if (itemIdFromUrl) {
            console.log('Found itemId in URL:', itemIdFromUrl);
            const itemIdInput = document.getElementById('itemId');
            if (itemIdInput) itemIdInput.value = itemIdFromUrl;
           
            setTimeout(() => {
                loadRejectedItem(itemIdFromUrl);
            }, 1200);
        }
    } catch (err) {
        console.error('Failed to load items:', err);
    }
});

window.loadRejectedItem = loadRejectedItem;
window.addExpiredItem = addExpiredItem;
window.addWasteItem = addWasteItem;
window.removeField = removeField;
window.toggleDisposalType = toggleDisposalType;
window.handleStoreChange = handleStoreChange;
window.isKitchenItem = isKitchenItem;