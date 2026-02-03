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
        
        // Update loading message if provided
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
        
        console.log(`Fetching cost for item: ${itemName}`);
        
        const query = await db.collection('items')
            .where('name', '==', itemName)
            .limit(1)
            .get();
        
        if (!query.empty) {
            const doc = query.docs[0];
            const itemData = doc.data();
            const cost = parseFloat(itemData.cost) || 0;
            console.log(`Found cost for ${itemName}: ₱${cost.toFixed(2)}`);
            return cost;
        }
        
        console.log(`No cost found for ${itemName}, using 0`);
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
    if (ITEMS_LIST.length === 0) {
        console.log('Items not loaded yet, delaying Select2 initialization for:', selectElementId);
        return;
    }
    
    $(`#${selectElementId}`).select2({
        data: ITEMS_LIST.map(item => ({ id: item, text: item })),
        placeholder: "Select or type to search...",
        allowClear: false,
        width: '100%',
        dropdownParent: $(`#${selectElementId}`).parent()
    });
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
            if (expiredFields && expiredFields.querySelectorAll('.field-group').length === 0) {
                addExpiredItem();
            }
        }
        
        if (checkboxId === 'waste' && wasteCheckbox.checked) {
            if (wasteContainer) wasteContainer.classList.add('show');
            const wasteFields = document.getElementById('wasteFields');
            if (wasteFields && wasteFields.querySelectorAll('.field-group').length === 0) {
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
                if (expiredFields && expiredFields.querySelectorAll('.field-group').length === 0) {
                    addExpiredItem();
                }
            }
            if (wasteCheckbox.checked && wasteContainer) {
                wasteContainer.classList.add('show');
                const wasteFields = document.getElementById('wasteFields');
                if (wasteFields && wasteFields.querySelectorAll('.field-group').length === 0) {
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
// IMAGE COMPRESSION FUNCTIONS
// ================================
function compressImage(file, quality = 0.7, maxWidth = 1200) {
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
                
                // Only resize if image is larger than maxWidth
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
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
            
            img.onerror = function() {
                reject(new Error('Failed to load image'));
            };
        };
        
        reader.onerror = function() {
            reject(new Error('Failed to read file'));
        };
    });
}

async function prepareFileForUpload(file) {
    let fileToUpload = file;
    let compressionInfo = null;
    
    // Only compress images that are too large
    if (file.type.startsWith('image/') && file.size > FILE_CONFIG.MAX_SIZE_PER_FILE) {
        console.log(`Compressing large image: ${file.name} (${Math.round(file.size / (1024 * 1024) * 100) / 100} MB)`);
        
        // Calculate compression ratio based on file size
        let quality = 0.6;
        let maxWidth = 800;
        
        if (file.size > 3 * 1024 * 1024) { // Over 3MB
            quality = 0.5;
            maxWidth = 600;
        }
        if (file.size > 4 * 1024 * 1024) { // Over 4MB
            quality = 0.4;
            maxWidth = 500;
        }
        
        try {
            fileToUpload = await compressImage(file, quality, maxWidth);
            compressionInfo = {
                originalSize: file.size,
                compressedSize: fileToUpload.size,
                compressionRatio: Math.round((fileToUpload.size / file.size) * 100)
            };
            console.log(`Compressed from ${Math.round(file.size / 1024)}KB to ${Math.round(fileToUpload.size / 1024)}KB (${compressionInfo.compressionRatio}%)`);
        } catch (error) {
            console.error('Compression failed, using original:', error);
        }
    }
    
    return {
        file: fileToUpload,
        compressionInfo: compressionInfo
    };
}

// ================================
// FIREBASE STORAGE FUNCTIONS
// ================================
async function uploadFileToStorage(file, reportId, itemId, index) {
    try {
        if (!storage) {
            throw new Error('Firebase Storage not initialized');
        }
        
        // Create a unique filename
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(7);
        const fileExtension = file.name.split('.').pop();
        const fileName = `${reportId}/${itemId}/${timestamp}_${randomString}.${fileExtension}`;
        
        // Create storage reference
        const storageRef = storage.ref().child(fileName);
        
        // Upload file
        const uploadTask = storageRef.put(file);
        
        // Return a promise that resolves with download URL
        return new Promise((resolve, reject) => {
            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    // Show upload progress
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    showUploadProgress(true, snapshot.bytesTransferred, snapshot.totalBytes, file.name);
                },
                (error) => {
                    console.error('Upload error:', error);
                    reject(error);
                },
                async () => {
                    try {
                        // Get download URL
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        
                        resolve({
                            url: downloadURL,
                            name: file.name,
                            type: file.type,
                            size: file.size,
                            path: fileName,
                            storagePath: storageRef.fullPath
                        });
                    } catch (urlError) {
                        reject(urlError);
                    }
                }
            );
        });
        
    } catch (error) {
        console.error('Error in uploadFileToStorage:', error);
        throw error;
    }
}

async function uploadFilesForItem(files, reportId, itemId) {
    const uploadedFiles = [];
    
    for (let i = 0; i < files.length; i++) {
        try {
            const preparedFile = await prepareFileForUpload(files[i]);
            const uploadResult = await uploadFileToStorage(
                preparedFile.file, 
                reportId, 
                itemId, 
                i
            );
            
            // Add compression info if available
            if (preparedFile.compressionInfo) {
                uploadResult.compressionInfo = preparedFile.compressionInfo;
            }
            
            uploadedFiles.push(uploadResult);
            
        } catch (error) {
            console.error(`Failed to upload file ${files[i].name}:`, error);
            throw new Error(`Failed to upload ${files[i].name}: ${error.message}`);
        }
    }
    
    return uploadedFiles;
}

// ================================
// EMAIL FUNCTION
// ================================
async function sendEmailConfirmation(reportData, reportId, itemsDetails) {
    try {
        console.log('📧 Preparing email via Google Apps Script...');
        
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
            subject: `Waste Report Confirmation - ${reportId}`,
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
            hasAttachments: reportData.hasImages || false
        };
        
        console.log('📤 Sending email to:', emailData.to);
        
        try {
            const formData = new FormData();
            formData.append('data', JSON.stringify(emailData));
            
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
            } else {
                return { success: true, message: 'Email likely sent (non-200 but processed)' };
            }
        } catch (err) {
            console.log('FormData failed, trying fallback methods...', err);
        }
        
        try {
            const params = new URLSearchParams();
            Object.keys(emailData).forEach(key => params.append(key, emailData[key]));
            const url = `${GAS_CONFIG.ENDPOINT}?${params.toString()}`;
            
            await fetch(url, { method: 'GET', mode: 'no-cors' });
            console.log('✅ GET fallback request submitted');
            return { success: true, message: 'Email sent via GET fallback' };
        } catch (err) {
            console.log('GET fallback failed, trying iframe...');
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
            
            setTimeout(() => {
                document.body.removeChild(iframe);
                document.body.removeChild(form);
                console.log('✅ Iframe fallback submitted');
                resolve({ success: true, message: 'Email sent via iframe fallback' });
            }, 2000);
            
            form.submit();
        });
        
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        return { success: false, error: error.message || 'Unknown error' };
    }
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
                <span class="note">Upload photos or PDFs (Max 10MB per file, 3 files max)</span>
            </div>
            <div class="form-group">
                <label for="wasteNotes-${itemId}">Additional Notes</label>
                <textarea id="wasteNotes-${itemId}" name="wasteItems[${itemId}][notes]" rows="2" placeholder="Any additional information"></textarea>
            </div>
        </div>
    `;
    
    wasteFields.appendChild(fieldGroup);
    
    setTimeout(() => {
        initSelect2Dropdown(`wasteItem-${itemId}`);
    }, 100);
}

function removeField(fieldId) {
    const field = document.getElementById(fieldId);
    if (field) {
        field.remove();
    }
}

function validateFiles(fileInput) {
    const maxSize = FILE_CONFIG.MAX_SIZE_PER_FILE; // 10MB
    const maxFiles = FILE_CONFIG.MAX_FILES_PER_ITEM; // 3 files
    const maxTotalSize = FILE_CONFIG.MAX_TOTAL_SIZE; // 10MB total
    
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
    
    let isValid = true;
    
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
        }
    }
    
    return isValid;
}

// ================================
// FORM SUBMISSION HANDLER - WITH FIREBASE STORAGE
// ================================
async function handleSubmit(event) {
    console.log('Form submission started...');
    
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (!db || !storage) {
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
    
    if (!itemsLoaded || ITEMS_LIST.length === 0) {
        showNotification('Please wait for items to load before submitting.', 'error');
        return;
    }
    
    const requiredFields = ['email', 'store', 'personnel', 'reportDate'];
    for (let field of requiredFields) {
        const fieldElement = document.getElementById(field);
        if (!fieldElement || !fieldElement.value.trim()) {
            showNotification(`Please fill in the ${field} field.`, 'error');
            console.error(`Missing field: ${field}`);
            return;
        }
    }
    
    if (!validateDisposalTypeSelection()) {
        console.error('Invalid disposal type selection');
        return;
    }
    
    if (!validateDynamicFields()) {
        console.error('Dynamic field validation failed');
        return;
    }
    
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
    showLoading(true, 'Preparing submission...');
    showUploadProgress(false);
    
    const disposalTypes = [];
    const disposalTypeCheckboxes = document.querySelectorAll('input[name="disposalType"]:checked');
    disposalTypeCheckboxes.forEach(checkbox => {
        disposalTypes.push(checkbox.value);
    });
    
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
        emailSentAt: null,
        emailError: null,
        hasImages: false,
        imageCount: 0,
        storageUsed: 0,
        originalFileSize: 0
    };
    
    if (disposalTypes.includes('noWaste')) {
        baseReportData.noWaste = true;
        baseReportData.notes = "No waste or expired items to report for this period";
    }
    
    try {
        console.log('Processing report data for ID:', mainReportId);
        
        let allItems = [];
        let totalOriginalSize = 0;
        let totalStorageUsed = 0;
        
        // Process expired items
        if (disposalTypes.includes('expired')) {
            const expiredFields = document.querySelectorAll('#expiredFields .field-group');
            console.log(`Found ${expiredFields.length} expired items`);
            
            for (let field of expiredFields) {
                const itemId = field.id.split('-')[1];
                const fileInput = document.getElementById(`documentation-${itemId}`);
                
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
                
                // Get item cost
                const itemCost = await getItemCost(selectedItem);
                console.log(`Item: ${selectedItem}, Cost: ₱${itemCost.toFixed(2)}`);
                
                // Create base item data
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
                    documentation: [] // Will be populated with upload results
                };
                
                // Upload files if any
                if (fileInput && fileInput.files.length > 0) {
                    showLoading(true, 'Uploading files...');
                    
                    // Calculate original size
                    for (let file of fileInput.files) {
                        totalOriginalSize += file.size;
                    }
                    
                    try {
                        const uploadedFiles = await uploadFilesForItem(
                            Array.from(fileInput.files),
                            mainReportId,
                            `expired-${itemId}`
                        );
                        
                        expiredItem.documentation = uploadedFiles;
                        expiredItem.totalFiles = uploadedFiles.length;
                        
                        // Calculate storage used
                        uploadedFiles.forEach(file => {
                            totalStorageUsed += file.size || 0;
                        });
                        
                        console.log(`✅ Uploaded ${uploadedFiles.length} files for expired item ${itemId}`);
                        
                    } catch (uploadError) {
                        console.error(`Failed to upload files for expired item ${itemId}:`, uploadError);
                        showNotification(`Failed to upload files for ${selectedItem}. Please try again.`, 'error');
                        throw uploadError;
                    }
                }
                
                allItems.push(expiredItem);
            }
            
            baseReportData.totalExpiredItems = allItems.filter(item => item.type === 'expired').length;
        }
        
        // Process waste items
        if (disposalTypes.includes('waste')) {
            const wasteFields = document.querySelectorAll('#wasteFields .field-group');
            console.log(`Found ${wasteFields.length} waste items`);
            
            for (let field of wasteFields) {
                const itemId = field.id.split('-')[1];
                const fileInput = document.getElementById(`wasteDocumentation-${itemId}`);
                
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
                
                // Get item cost
                const itemCost = await getItemCost(selectedItem);
                console.log(`Item: ${selectedItem}, Cost: ₱${itemCost.toFixed(2)}`);
                
                // Create base item data
                const wasteItem = {
                    type: 'waste',
                    item: selectedItem,
                    reason: document.getElementById(`reason-${itemId}`).value,
                    quantity: parseFloat(document.getElementById(`wasteQuantity-${itemId}`).value) || 0,
                    unit: document.getElementById(`wasteUnit-${itemId}`).value,
                    notes: document.getElementById(`wasteNotes-${itemId}`).value.trim() || '',
                    itemId: itemId,
                    itemCost: itemCost,
                    documentation: [] // Will be populated with upload results
                };
                
                // Upload files if any
                if (fileInput && fileInput.files.length > 0) {
                    showLoading(true, 'Uploading files...');
                    
                    // Calculate original size
                    for (let file of fileInput.files) {
                        totalOriginalSize += file.size;
                    }
                    
                    try {
                        const uploadedFiles = await uploadFilesForItem(
                            Array.from(fileInput.files),
                            mainReportId,
                            `waste-${itemId}`
                        );
                        
                        wasteItem.documentation = uploadedFiles;
                        wasteItem.totalFiles = uploadedFiles.length;
                        
                        // Calculate storage used
                        uploadedFiles.forEach(file => {
                            totalStorageUsed += file.size || 0;
                        });
                        
                        console.log(`✅ Uploaded ${uploadedFiles.length} files for waste item ${itemId}`);
                        
                    } catch (uploadError) {
                        console.error(`Failed to upload files for waste item ${itemId}:`, uploadError);
                        showNotification(`Failed to upload files for ${selectedItem}. Please try again.`, 'error');
                        throw uploadError;
                    }
                }
                
                allItems.push(wasteItem);
            }
            
            baseReportData.totalWasteItems = allItems.filter(item => item.type === 'waste').length;
        }
        
        // Update report data with storage information
        baseReportData.originalFileSize = totalOriginalSize;
        baseReportData.storageUsed = totalStorageUsed;
        baseReportData.hasImages = allItems.some(item => item.documentation.length > 0);
        baseReportData.imageCount = allItems.reduce((sum, item) => sum + (item.documentation?.length || 0), 0);
        
        // Add items to report data
        const expiredItems = allItems.filter(item => item.type === 'expired');
        const wasteItems = allItems.filter(item => item.type === 'waste');
        
        if (expiredItems.length > 0) {
            baseReportData.expiredItems = expiredItems;
        }
        if (wasteItems.length > 0) {
            baseReportData.wasteItems = wasteItems;
        }
        
        // Save the report to Firestore
        console.log('Saving report to Firestore...');
        showLoading(true, 'Saving report...');
        
        const docRef = db.collection('wasteReports').doc(mainReportId);
        await docRef.set(baseReportData);
        
        console.log('✅ Report saved to Firestore with ID:', mainReportId);
        
        // Send email confirmation
        console.log('Attempting to send email confirmation...');
        showLoading(true, 'Sending email confirmation...');
        
        const emailResult = await sendEmailConfirmation(baseReportData, mainReportId, allItems);
        
        if (emailResult.success) {
            console.log('✅ Email confirmation request submitted');
            
            try {
                await docRef.update({
                    emailSent: true,
                    emailSentAt: new Date().toISOString(),
                    emailStatus: 'sent',
                    emailService: 'Google Apps Script'
                });
                console.log('✅ Email status updated in database');
            } catch (updateError) {
                console.warn('Could not update email status in database:', updateError);
            }
            
            showNotification(
                `✅ Report submitted successfully! Confirmation email sent.`, 
                'success'
            );
            
        } else {
            console.warn('⚠️ Report saved but email failed:', emailResult.error);
            
            try {
                await docRef.update({
                    emailSent: false,
                    emailError: emailResult.error,
                    emailStatus: 'failed',
                    lastEmailAttempt: new Date().toISOString()
                });
            } catch (updateError) {
                console.warn('Could not update email error in database:', updateError);
            }
            
            showNotification(
                `⚠️ Report saved successfully! (Email failed: ${emailResult.error || 'Check connection'})`, 
                'warning'
            );
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
        
        // Ask user to view reports
        setTimeout(() => {
            const viewReports = confirm(
                `Report ${mainReportId} has been submitted. Would you like to view all reports?`
            );
            if (viewReports) {
                window.location.href = 'waste_report_table.html';
            }
        }, 1500);
        
    } catch (error) {
        console.error('❌ Error submitting report:', error);
        console.error('Error details:', error.message, error.stack);
        
        let errorMessage = 'Error submitting report: ';
        if (error.code === 'permission-denied') {
            errorMessage += 'Permission denied. Check Firebase rules.';
        } else if (error.code === 'unavailable') {
            errorMessage += 'Network error. Please check your connection.';
        } else if (error.code === 'storage/unauthorized') {
            errorMessage += 'Storage permission denied. Check Firebase Storage rules.';
        } else if (error.code === 'storage/retry-limit-exceeded') {
            errorMessage += 'Upload failed after multiple attempts. Please try again.';
        } else {
            errorMessage += error.message || 'Unknown error';
        }
        
        showNotification(errorMessage, 'error');
        
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
            console.log('Saved to localStorage as backup');
        } catch (localError) {
            console.error('Could not save to localStorage:', localError);
        }
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
        showLoading(false);
        showUploadProgress(false);
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
// INITIALIZATION
// ================================
document.addEventListener('DOMContentLoaded', async function() {
    console.log('Document loaded, initializing form...');
    
    const reportDateInput = document.getElementById('reportDate');
    if (reportDateInput) {
        const today = new Date().toISOString().split('T')[0];
        reportDateInput.value = today;
        console.log('Set report date to:', today);
    }
    
    const form = document.getElementById('wasteReportForm');
    if (form) {
        console.log('Form found:', form.id);
        
        form.addEventListener('submit', function(e) {
            console.log('Form submit event triggered');
            handleSubmit(e);
        });
        
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            console.log('Submit button found:', submitBtn.className);
        }
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
    
    testFirebaseConnection();
    checkGASConfig();
    
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

async function testFirebaseConnection() {
    try {
        if (!firebase.apps.length) {
            console.error('Firebase not initialized');
            return;
        }
        
        console.log('Testing Firebase connection...');
        
        // Test Firestore
        const testRef = db.collection('_test').doc('connection');
        await testRef.set({
            test: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Firebase Firestore write test successful');
        
        await testRef.delete();
        
        // Test Storage
        const storageRef = storage.ref().child('_test/test.txt');
        const testBlob = new Blob(['Firebase Storage Test'], { type: 'text/plain' });
        await storageRef.put(testBlob);
        
        console.log('✅ Firebase Storage write test successful');
        
        await storageRef.delete();
        
        console.log('✅ Firebase connection test complete');
        
    } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
        
        let errorMessage = 'Firebase connection issue: ';
        if (error.code === 'permission-denied') {
            errorMessage += 'Permission denied. Please check Firebase rules.';
        } else if (error.code === 'unavailable') {
            errorMessage += 'Network error. Please check your internet connection.';
        } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'error');
    }
}

function checkGASConfig() {
    console.log('Google Apps Script Configuration Check:');
    console.log('- ENDPOINT:', GAS_CONFIG.ENDPOINT);
    console.log('- SENDER_EMAIL:', GAS_CONFIG.SENDER_EMAIL);
    console.log('- SENDER_NAME:', GAS_CONFIG.SENDER_NAME);
    
    if (!GAS_CONFIG.ENDPOINT) {
        console.warn('⚠️ WARNING: Google Apps Script URL not configured');
        showNotification('Email service not configured. Please set up Google Apps Script backend.', 'warning');
    }
}

window.testGASEmail = async () => {
    const testEmail = prompt('Enter email to test email service:');
    if (!testEmail) return;
    
    showLoading(true, 'Sending test email...');
    try {
        const testData = {
            email: testEmail,
            store: 'Test Store',
            personnel: 'Test User',
            reportDate: new Date().toISOString().split('T')[0],
            disposalTypes: ['noWaste']
        };
        
        const result = await sendEmailConfirmation(testData, 'TEST-' + Date.now(), []);
        
        if (result.success) {
            alert('✅ Test email request submitted! Check your inbox.');
        } else {
            alert(`❌ Test email failed: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
    } finally {
        showLoading(false);
    }
};

window.debugSubmit = handleSubmit;
window.debugFirebase = () => {
    console.log('Firebase status:', {
        initialized: !!firebase.apps.length,
        db: !!db,
        storage: !!storage,
        config: firebaseConfig
    });
    testFirebaseConnection();
};
window.debugGAS = checkGASConfig;

window.refreshItems = async () => {
    try {
        showNotification('Refreshing items from database...', 'info');
        await fetchItemsFromFirestore();
        showNotification('Items refreshed successfully!', 'success');
    } catch (error) {
        showNotification('Failed to refresh items: ' + error.message, 'error');
    }
};

window.testStorageUpload = async () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    
    fileInput.onchange = async (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            showLoading(true, 'Testing storage upload...');
            
            try {
                const result = await uploadFileToStorage(file, 'TEST-' + Date.now(), 'test-item', 0);
                alert(`✅ Storage upload successful!\nURL: ${result.url}`);
                console.log('Storage upload result:', result);
            } catch (error) {
                alert(`❌ Storage upload failed: ${error.message}`);
            } finally {
                showLoading(false);
            }
        }
    };
    
    fileInput.click();
};