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
// ITEMS LIST FOR DROPDOWN
// ================================
let ITEMS_LIST = [];
let itemsLoaded = false;

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

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function calculateObjectSize(obj) {
    return new TextEncoder().encode(JSON.stringify(obj)).length;
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
function compressImage(file, quality = 0.5, maxWidth = 800) {
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

async function fileToBase64(file) {
    return new Promise(async (resolve, reject) => {
        try {
            let fileToProcess = file;
            let isCompressed = false;
            let originalSize = file.size;
            
            if (file.type.startsWith('image/')) {
                console.log(`Compressing image: ${file.name} (${Math.round(file.size / 1024)} KB)`);
                
                if (file.size > 150 * 1024) {
                    let quality = 0.6;
                    let maxWidth = 600;
                    
                    if (file.size > 500 * 1024) {
                        quality = 0.5;
                        maxWidth = 500;
                    }
                    if (file.size > 1000 * 1024) {
                        quality = 0.4;
                        maxWidth = 400;
                    }
                    
                    fileToProcess = await compressImage(file, quality, maxWidth);
                    isCompressed = true;
                    console.log(`Compressed from ${Math.round(file.size / 1024)}KB to ${Math.round(fileToProcess.size / 1024)}KB`);
                }
            }
            
            const reader = new FileReader();
            reader.readAsDataURL(fileToProcess);
            
            reader.onload = () => resolve({
                name: file.name,
                type: fileToProcess.type,
                size: fileToProcess.size,
                base64: reader.result.split(',')[1],
                dataUrl: reader.result,
                originalSize: originalSize,
                isCompressed: isCompressed,
                compressionRatio: isCompressed ? Math.round((fileToProcess.size / originalSize) * 100) : 100
            });
            
            reader.onerror = error => reject(error);
            
        } catch (error) {
            reject(error);
        }
    });
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
            hasAttachments: reportData.originalFileSize > 0
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

function initSelect2Dropdown(selectElementId) {
    if (ITEMS_LIST.length === 0) {
        console.log('Items not loaded yet, delaying Select2 initialization for:', selectElementId);
        return;
    }
    
    // SIMPLE DROPDOWN WITHOUT COST DISPLAY
    $(`#${selectElementId}`).select2({
        data: ITEMS_LIST.map(item => ({ id: item, text: item })),
        placeholder: "Select or type to search...",
        allowClear: false,
        width: '100%',
        dropdownParent: $(`#${selectElementId}`).parent()
    });
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
                <span class="note">Upload photos or PDFs (Max 1MB per file, 3 files max)</span>
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
                <span class="note">Upload photos or PDFs (Max 1MB per file, 3 files max)</span>
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
    const maxSize = 1 * 1024 * 1024;
    const maxFiles = 3;
    
    if (fileInput.files.length > maxFiles) {
        return `Maximum ${maxFiles} files allowed`;
    }
    
    for (let file of fileInput.files) {
        if (file.size > maxSize) {
            return `File "${file.name}" exceeds 1MB limit (${formatFileSize(file.size)})`;
        }
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
// BATCH PROCESSING FUNCTIONS
// ================================
function splitIntoBatches(items, maxBatchSize = 800 * 1024) {
    const batches = [];
    let currentBatch = [];
    let currentBatchSize = 0;
    
    for (const item of items) {
        const itemSize = calculateObjectSize(item);
        
        if (currentBatchSize + itemSize > maxBatchSize && currentBatch.length > 0) {
            batches.push([...currentBatch]);
            currentBatch = [item];
            currentBatchSize = itemSize;
        } else {
            currentBatch.push(item);
            currentBatchSize += itemSize;
        }
    }
    
    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }
    
    return batches;
}

async function saveReportInBatches(mainReportId, baseReportData, items) {
    const batches = splitIntoBatches(items);
    const totalBatches = batches.length;
    
    console.log(`Splitting report into ${totalBatches} batches`);
    
    for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchReportId = `${mainReportId}_BATCH${i + 1}`;
        
        const batchReport = {
            ...baseReportData,
            reportId: batchReportId,
            batchNumber: i + 1,
            totalBatches: totalBatches,
            mainReportId: mainReportId,
            itemCount: batch.length
        };
        
        const expiredBatch = batch.filter(item => item.type === 'expired');
        const wasteBatch = batch.filter(item => item.type === 'waste');
        
        if (expiredBatch.length > 0) {
            batchReport.expiredItems = expiredBatch;
        }
        if (wasteBatch.length > 0) {
            batchReport.wasteItems = wasteBatch;
        }
        
        const batchSize = calculateObjectSize(batchReport);
        batchReport.reportSizeKB = Math.round(batchSize / 1024);
        
        console.log(`Saving batch ${i + 1}/${totalBatches}: ${batchReport.reportSizeKB}KB, ${batch.length} items`);
        
        const docRef = db.collection('wasteReports').doc(batchReportId);
        await docRef.set(batchReport);
        
        console.log(`✅ Batch ${i + 1} saved with ID: ${batchReportId}`);
    }
    
    return totalBatches;
}

// ================================
// FORM SUBMISSION HANDLER
// ================================
async function handleSubmit(event) {
    console.log('Form submission started...');
    
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
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
    showLoading(true);
    
    const disposalTypes = [];
    const disposalTypeCheckboxes = document.querySelectorAll('input[name="disposalType"]:checked');
    disposalTypeCheckboxes.forEach(checkbox => {
        disposalTypes.push(checkbox.value);
    });
    
    const baseReportData = {
        email: document.getElementById('email').value.trim(),
        store: document.getElementById('store').value,
        personnel: document.getElementById('personnel').value.trim(),
        reportDate: document.getElementById('reportDate').value,
        disposalTypes: disposalTypes,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'submitted',
        createdAt: new Date().toISOString(),
        emailSent: false,
        emailSentAt: null,
        emailError: null
    };
    
    if (disposalTypes.includes('noWaste')) {
        baseReportData.noWaste = true;
        baseReportData.notes = "No waste or expired items to report for this period";
    }
    
    try {
        const mainReportId = 'REPORT-' + Date.now().toString();
        baseReportData.reportId = mainReportId;
        
        console.log('Processing report data for ID:', mainReportId);
        
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;
        let allItems = [];
        let savedReportIds = [mainReportId];
        let totalBatches = 1;
        
        if (disposalTypes.includes('expired')) {
            const expiredFields = document.querySelectorAll('#expiredFields .field-group');
            console.log(`Found ${expiredFields.length} expired items`);
            
            for (let field of expiredFields) {
                const itemId = field.id.split('-')[1];
                const fileInput = document.getElementById(`documentation-${itemId}`);
                
                const filesBase64 = [];
                if (fileInput && fileInput.files.length > 0) {
                    for (let i = 0; i < fileInput.files.length; i++) {
                        try {
                            const file = fileInput.files[i];
                            totalOriginalSize += file.size;
                            
                            const fileData = await fileToBase64(file);
                            filesBase64.push(fileData);
                            totalCompressedSize += fileData.size;
                            
                        } catch (fileError) {
                            console.error('Error processing file:', fileError);
                        }
                    }
                }
                
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
                
                // GET AND SAVE THE COST
                const itemCost = await getItemCost(selectedItem);
                console.log(`Item: ${selectedItem}, Cost: ₱${itemCost.toFixed(2)}`);
                
                const expiredItem = {
                    type: 'expired',
                    item: selectedItem,
                    deliveredDate: document.getElementById(`deliveredDate-${itemId}`).value,
                    manufacturedDate: document.getElementById(`manufacturedDate-${itemId}`).value,
                    expirationDate: document.getElementById(`expirationDate-${itemId}`).value,
                    quantity: parseFloat(document.getElementById(`quantity-${itemId}`).value) || 0,
                    unit: document.getElementById(`unit-${itemId}`).value,
                    documentation: filesBase64,
                    notes: document.getElementById(`notes-${itemId}`).value.trim() || '',
                    itemId: itemId,
                    totalFiles: fileInput ? fileInput.files.length : 0,
                    // SAVE COST TO FIRESTORE
                    itemCost: itemCost
                };
                
                allItems.push(expiredItem);
            }
            
            baseReportData.totalExpiredItems = allItems.filter(item => item.type === 'expired').length;
        }
        
        if (disposalTypes.includes('waste')) {
            const wasteFields = document.querySelectorAll('#wasteFields .field-group');
            console.log(`Found ${wasteFields.length} waste items`);
            
            for (let field of wasteFields) {
                const itemId = field.id.split('-')[1];
                const fileInput = document.getElementById(`wasteDocumentation-${itemId}`);
                
                const filesBase64 = [];
                if (fileInput && fileInput.files.length > 0) {
                    for (let i = 0; i < fileInput.files.length; i++) {
                        try {
                            const file = fileInput.files[i];
                            totalOriginalSize += file.size;
                            
                            const fileData = await fileToBase64(file);
                            filesBase64.push(fileData);
                            totalCompressedSize += fileData.size;
                            
                        } catch (fileError) {
                            console.error('Error processing file:', fileError);
                        }
                    }
                }
                
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
                
                // GET AND SAVE THE COST
                const itemCost = await getItemCost(selectedItem);
                console.log(`Item: ${selectedItem}, Cost: ₱${itemCost.toFixed(2)}`);
                
                const wasteItem = {
                    type: 'waste',
                    item: selectedItem,
                    reason: document.getElementById(`reason-${itemId}`).value,
                    quantity: parseFloat(document.getElementById(`wasteQuantity-${itemId}`).value) || 0,
                    unit: document.getElementById(`wasteUnit-${itemId}`).value,
                    documentation: filesBase64,
                    notes: document.getElementById(`wasteNotes-${itemId}`).value.trim() || '',
                    itemId: itemId,
                    totalFiles: fileInput ? fileInput.files.length : 0,
                    // SAVE COST TO FIRESTORE
                    itemCost: itemCost
                };
                
                allItems.push(wasteItem);
            }
            
            baseReportData.totalWasteItems = allItems.filter(item => item.type === 'waste').length;
        }
        
        if (allItems.length > 0) {
            baseReportData.originalFileSize = totalOriginalSize;
            baseReportData.compressedFileSize = totalCompressedSize;
        }
        
        const estimatedReportSize = calculateObjectSize({
            ...baseReportData,
            items: allItems
        });
        
        if (estimatedReportSize > 800 * 1024) {
            console.log('Report is large, splitting into batches...');
            totalBatches = await saveReportInBatches(mainReportId, baseReportData, allItems);
            savedReportIds = [];
            for (let i = 1; i <= totalBatches; i++) {
                savedReportIds.push(`${mainReportId}_BATCH${i}`);
            }
        } else {
            console.log('Report fits in single document, saving...');
            
            const expiredItems = allItems.filter(item => item.type === 'expired');
            const wasteItems = allItems.filter(item => item.type === 'waste');
            
            if (expiredItems.length > 0) {
                baseReportData.expiredItems = expiredItems;
            }
            if (wasteItems.length > 0) {
                baseReportData.wasteItems = wasteItems;
            }
            
            const finalSize = calculateObjectSize(baseReportData);
            baseReportData.reportSizeKB = Math.round(finalSize / 1024);
            
            console.log('Final report size:', baseReportData.reportSizeKB, 'KB');
            
            const docRef = db.collection('wasteReports').doc(mainReportId);
            await docRef.set(baseReportData);
            
            console.log('✅ Report saved to Firestore with ID:', mainReportId);
        }
        
        baseReportData.totalBatches = totalBatches;

        console.log('Attempting to send email confirmation...');
        
        const emailResult = await sendEmailConfirmation(baseReportData, mainReportId, allItems);
        
        if (emailResult.success) {
            console.log('✅ Email confirmation request submitted');
            
            try {
                const updatePromises = savedReportIds.map(reportId => {
                    const reportRef = db.collection('wasteReports').doc(reportId);
                    return reportRef.update({
                        emailSent: true,
                        emailSentAt: new Date().toISOString(),
                        emailStatus: 'sent',
                        emailService: 'Google Apps Script'
                    });
                });
                
                await Promise.all(updatePromises);
                console.log('✅ Email status updated in database');
            } catch (updateError) {
                console.warn('Could not update email status in database:', updateError);
            }
            
            showNotification(
                `✅ Report submitted successfully! Confirmation email sent. ${totalBatches > 1 ? `(${totalBatches} parts)` : ''}`, 
                'success'
            );
            
        } else {
            console.warn('⚠️ Report saved but email failed:', emailResult.error);
            
            try {
                const updatePromises = savedReportIds.map(reportId => {
                    const reportRef = db.collection('wasteReports').doc(reportId);
                    return reportRef.update({
                        emailSent: false,
                        emailError: emailResult.error,
                        emailStatus: 'failed',
                        lastEmailAttempt: new Date().toISOString()
                    });
                });
                
                await Promise.all(updatePromises);
            } catch (updateError) {
                console.warn('Could not update email error in database:', updateError);
            }
            
            showNotification(
                `⚠️ Report saved successfully! (Email failed: ${emailResult.error || 'Check connection'})`, 
                'warning'
            );
        }
        
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
        } else if (error.code === 'failed-precondition') {
            errorMessage += 'Document too large. Please reduce file sizes.';
        } else {
            errorMessage += error.message;
        }
        
        showNotification(errorMessage, 'error');
        
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
        
        const testRef = db.collection('_test').doc('connection');
        await testRef.set({
            test: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        console.log('✅ Firebase write test successful');
        
        await testRef.delete();
        
        console.log('✅ Firebase connection test complete');
        
    } catch (error) {
        console.error('❌ Firebase connection test failed:', error);
        
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
    
    showLoading(true);
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