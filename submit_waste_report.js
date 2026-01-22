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
// EMAILJS CONFIGURATION
// ================================
const EMAILJS_CONFIG = {
    USER_ID: 'TwPt4meJ4Z2h_6ufb',
    SERVICE_ID: 'service_txc1dw9',
    TEMPLATE_ID: 'template_jnrgr6r'
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

// Initialize EmailJS
try {
    if (EMAILJS_CONFIG.USER_ID) {
        emailjs.init(EMAILJS_CONFIG.USER_ID);
        console.log('✅ EmailJS initialized successfully');
    } else {
        console.warn('⚠️ EmailJS not initialized: USER_ID missing');
    }
} catch (error) {
    console.error('❌ EmailJS initialization error:', error);
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
// EMAIL SENDING FUNCTION - FIXED TO MATCH TEMPLATE VARIABLES EXACTLY
// ================================
async function sendEmailConfirmation(reportData, reportId, itemsDetails) {
    try {
        console.log('Preparing email confirmation...');
        
        // Format the submission time
        const submissionTime = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Prepare report details (same as before)
        let reportDetails = 'Item details:\n\n';
        
        if (reportData.disposalType === 'expired' && reportData.expiredItems) {
            reportData.expiredItems.forEach((item, index) => {
                reportDetails += `${index + 1}. ${item.item || 'N/A'} - ${item.quantity || 0} ${item.unit || ''}\n`;
            });
        } else if (reportData.disposalType === 'waste' && reportData.wasteItems) {
            reportData.wasteItems.forEach((item, index) => {
                reportDetails += `${index + 1}. ${item.item || 'N/A'} - ${item.quantity || 0} ${item.unit || ''}\n`;
            });
        } else if (reportData.disposalType === 'noWaste') {
            reportDetails = 'No waste or expired items to report for this period.';
        }

        // CRITICAL FIX: Use exact variable names from your EmailJS template
        const templateParams = {
            to_email: reportData.email,  // Required by EmailJS service

            reportId: reportId || 'N/A',                              // ← matches {{reportId}}
            submissionTime: submissionTime || 'N/A',                  // ← matches {{submissionTime}}
            store: reportData.store || 'N/A',                         // ← matches {{store}}
            personnel: reportData.personnel || 'N/A',                 // ← matches {{personnel}}
            reportDate: formatDate(reportData.reportDate) || 'N/A',   // ← matches {{reportDate}}
            disposalType: (reportData.disposalType || 'N/A').toUpperCase(), // ← matches {{disposalType}}
            itemCount: itemsDetails.length || 0,                      // ← matches {{itemCount}}
            totalBatches: reportData.totalBatches || 1,               // ← matches {{#if totalBatches}} and {{totalBatches}}
            reportDetails: reportDetails || 'No details provided'     // ← matches {{reportDetails}}
        };
        
        console.log('Email template parameters:', templateParams);
        
        // Send email using EmailJS
        const response = await emailjs.send(
            EMAILJS_CONFIG.SERVICE_ID,
            EMAILJS_CONFIG.TEMPLATE_ID,
            templateParams
        );
        
        console.log('✅ Email sent successfully:', response);
        return { success: true, response };
        
    } catch (error) {
        console.error('❌ Email sending failed:', error);
        
        if (error.text) {
            console.error('EmailJS error text:', error.text);
        }
        if (error.message) {
            console.error('Error message:', error.message);
        }
        
        return { 
            success: false, 
            error: error.text || error.message || 'Email sending failed' 
        };
    }
}

// ================================
// FORM FUNCTIONS (unchanged)
// ================================
function toggleDynamicFields() {
    const disposalType = document.querySelector('input[name="disposalType"]:checked');
    if (!disposalType) return;
    
    const expiredContainer = document.getElementById('expiredContainer');
    const wasteContainer = document.getElementById('wasteContainer');
    
    if (expiredContainer) expiredContainer.classList.remove('show');
    if (wasteContainer) wasteContainer.classList.remove('show');
    
    const expiredFields = document.getElementById('expiredFields');
    const wasteFields = document.getElementById('wasteFields');
    if (expiredFields) expiredFields.innerHTML = '';
    if (wasteFields) wasteFields.innerHTML = '';
    
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
                <span class="note">Upload photos or PDFs (Max 1MB per file, 3 files max)</span>
            </div>
            <div class="form-group">
                <label for="notes-${itemId}">Additional Notes</label>
                <textarea id="notes-${itemId}" name="expiredItems[${itemId}][notes]" rows="2" placeholder="Any additional information"></textarea>
            </div>
        </div>
    `;
    
    expiredFields.appendChild(fieldGroup);
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
                <span class="note">Upload photos or PDFs (Max 1MB per file, 3 files max)</span>
            </div>
            <div class="form-group">
                <label for="wasteNotes-${itemId}">Additional Notes</label>
                <textarea id="wasteNotes-${itemId}" name="wasteItems[${itemId}][notes]" rows="2" placeholder="Any additional information"></textarea>
            </div>
        </div>
    `;
    
    wasteFields.appendChild(fieldGroup);
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

function calculateTotalFileSize(fileInputs) {
    let totalSize = 0;
    fileInputs.forEach(input => {
        if (input && input.files) {
            Array.from(input.files).forEach(file => {
                totalSize += file.size;
            });
        }
    });
    return totalSize;
}

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
        
    } else if (disposalType.value === 'waste') {
        const wasteItems = document.querySelectorAll('#wasteFields .field-group');
        if (wasteItems.length === 0) {
            showNotification('Please add at least one waste item.', 'error');
            return false;
        }
        
        for (let item of wasteItems) {
            const requiredFields = item.querySelectorAll('input[required], select[required]');
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
    
    return true;
}

// ================================
// BATCH PROCESSING FUNCTIONS (unchanged)
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
        
        if (baseReportData.disposalType === 'expired') {
            batchReport.expiredItems = batch;
            batchReport.totalExpiredItems = batch.length;
        } else if (baseReportData.disposalType === 'waste') {
            batchReport.wasteItems = batch;
            batchReport.totalWasteItems = batch.length;
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
// FORM SUBMISSION HANDLER (unchanged except passing totalBatches to email)
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
    
    if (!validateDynamicFields()) {
        console.error('Dynamic field validation failed');
        return;
    }
    
    // Show loading state
    submitBtn.textContent = 'Submitting...';
    submitBtn.disabled = true;
    showLoading(true);
    
    // Initialize base report data
    const baseReportData = {
        email: document.getElementById('email').value.trim(),
        store: document.getElementById('store').value,
        personnel: document.getElementById('personnel').value.trim(),
        reportDate: document.getElementById('reportDate').value,
        disposalType: disposalType.value,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        status: 'submitted',
        createdAt: new Date().toISOString(),
        emailSent: false,
        emailSentAt: null,
        emailError: null
    };
    
    try {
        // Generate main report ID
        const mainReportId = 'REPORT-' + Date.now().toString();
        baseReportData.reportId = mainReportId;
        
        console.log('Processing report data for ID:', mainReportId);
        
        let totalOriginalSize = 0;
        let totalCompressedSize = 0;
        let allItems = [];
        
        // Process based on disposal type
        if (disposalType.value === 'expired') {
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
                
                allItems.push(expiredItem);
            }
            
            baseReportData.totalExpiredItems = allItems.length;
            baseReportData.originalFileSize = totalOriginalSize;
            baseReportData.compressedFileSize = totalCompressedSize;
            
        } else if (disposalType.value === 'waste') {
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
                
                allItems.push(wasteItem);
            }
            
            baseReportData.totalWasteItems = allItems.length;
            baseReportData.originalFileSize = totalOriginalSize;
            baseReportData.compressedFileSize = totalCompressedSize;
        } else if (disposalType.value === 'noWaste') {
            baseReportData.noWaste = true;
            baseReportData.notes = "No waste or expired items to report for this period";
        }
        
        const estimatedReportSize = calculateObjectSize({
            ...baseReportData,
            items: allItems
        });
        
        let totalBatches = 1;
        let savedReportIds = [mainReportId];
        
        if (estimatedReportSize > 800 * 1024) {
            console.log('Report is large, splitting into batches...');
            totalBatches = await saveReportInBatches(mainReportId, baseReportData, allItems);
            
        } else {
            console.log('Report fits in single document, saving...');
            
            if (disposalType.value === 'expired') {
                baseReportData.expiredItems = allItems;
            } else if (disposalType.value === 'waste') {
                baseReportData.wasteItems = allItems;
            }
            
            const finalSize = calculateObjectSize(baseReportData);
            baseReportData.reportSizeKB = Math.round(finalSize / 1024);
            
            console.log('Final report size:', baseReportData.reportSizeKB, 'KB');
            
            const docRef = db.collection('wasteReports').doc(mainReportId);
            await docRef.set(baseReportData);
            
            console.log('✅ Report saved to Firestore with ID:', mainReportId);
        }
        
        // Add totalBatches to baseReportData for email
        baseReportData.totalBatches = totalBatches;

        // ================================
        // SEND EMAIL CONFIRMATION
        // ================================
        console.log('Attempting to send email confirmation...');
        
        if (!EMAILJS_CONFIG.USER_ID) {
            console.warn('⚠️ EmailJS not configured: USER_ID missing');
            showNotification(
                `Report submitted successfully! (No email sent - EmailJS not configured) ${totalBatches > 1 ? `(${totalBatches} parts)` : ''}`, 
                'warning'
            );
        } else {
            const itemsDetails = allItems.map(item => ({
                type: disposalType.value,
                ...item
            }));
            
            const emailResult = await sendEmailConfirmation(baseReportData, mainReportId, itemsDetails);
            
            if (emailResult.success) {
                console.log('✅ Email confirmation sent successfully');
                
                try {
                    const updatePromises = savedReportIds.map(reportId => {
                        const reportRef = db.collection('wasteReports').doc(reportId);
                        return reportRef.update({
                            emailSent: true,
                            emailSentAt: new Date().toISOString(),
                            emailStatus: 'sent'
                        });
                    });
                    
                    await Promise.all(updatePromises);
                    console.log('✅ Email status updated in database');
                } catch (updateError) {
                    console.warn('Could not update email status in database:', updateError);
                }
                
                showNotification(
                    `Report submitted successfully! Confirmation email sent to ${baseReportData.email}. ${totalBatches > 1 ? `(${totalBatches} parts)` : ''}`, 
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
                            emailStatus: 'failed'
                        });
                    });
                    
                    await Promise.all(updatePromises);
                } catch (updateError) {
                    console.warn('Could not update email error in database:', updateError);
                }
                
                showNotification(
                    `Report saved successfully! (Email failed: ${emailResult.error})`, 
                    'warning'
                );
            }
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
        }
        
        // Show option to view reports
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
// MODAL FUNCTIONS (unchanged)
// ================================
function closeDetailsModal() {
    const detailsModal = document.getElementById('detailsModal');
    if (detailsModal) {
        detailsModal.style.display = 'none';
    }
}

// ================================
// INITIALIZATION (unchanged)
// ================================
document.addEventListener('DOMContentLoaded', function() {
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
    
    const disposalTypeRadios = document.querySelectorAll('input[name="disposalType"]');
    disposalTypeRadios.forEach(radio => {
        radio.addEventListener('change', toggleDynamicFields);
    });
    
    testFirebaseConnection();
    checkEmailJSConfig();
    
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

function checkEmailJSConfig() {
    console.log('EmailJS Configuration Check:');
    console.log('- USER_ID:', EMAILJS_CONFIG.USER_ID ? 'Set ✓' : 'NOT SET ✗');
    console.log('- SERVICE_ID:', EMAILJS_CONFIG.SERVICE_ID);
    console.log('- TEMPLATE_ID:', EMAILJS_CONFIG.TEMPLATE_ID);
    
    if (!EMAILJS_CONFIG.USER_ID) {
        console.warn('⚠️ WARNING: EmailJS USER_ID is not set');
        showNotification('EmailJS not configured. Emails will not be sent.', 'warning');
    }
}

window.debugSubmit = handleSubmit;
window.debugFirebase = () => {
    console.log('Firebase status:', {
        initialized: !!firebase.apps.length,
        db: !!db,
        config: firebaseConfig
    });
    testFirebaseConnection();
};