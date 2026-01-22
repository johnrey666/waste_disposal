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
// SENDGRID CONFIGURATION - USING YOUR API KEY
// ================================
const SENDGRID_CONFIG = {
    API_KEY: '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',
    SENDER_EMAIL: 'fo.technicalsupport@lccgroup.com',
    SENDER_NAME: 'FG Operations',
    TEMPLATE_ID: null // Not using template, using inline HTML
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
// SENDGRID EMAIL FUNCTION
// ================================
async function sendEmailConfirmation(reportData, reportId, itemsDetails) {
    try {
        console.log('Preparing SendGrid email...');
        
        if (!SENDGRID_CONFIG.API_KEY) {
            console.error('❌ SendGrid API key not configured');
            return {
                success: false,
                error: 'SendGrid API key not configured. Please check your configuration.'
            };
        }
        
        // Format the submission time
        const submissionTime = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        // Prepare report details
        let reportDetails = 'Item details:\n\n';
        
        if (reportData.disposalType === 'expired' && itemsDetails && itemsDetails.length > 0) {
            itemsDetails.forEach((item, index) => {
                reportDetails += `${index + 1}. ${item.item || 'N/A'} - ${item.quantity || 0} ${item.unit || ''}\n`;
                if (item.notes) {
                    reportDetails += `   Notes: ${item.notes}\n`;
                }
            });
        } else if (reportData.disposalType === 'waste' && itemsDetails && itemsDetails.length > 0) {
            itemsDetails.forEach((item, index) => {
                reportDetails += `${index + 1}. ${item.item || 'N/A'} - ${item.quantity || 0} ${item.unit || ''} (Reason: ${item.reason || 'N/A'})\n`;
                if (item.notes) {
                    reportDetails += `   Notes: ${item.notes}\n`;
                }
            });
        } else if (reportData.disposalType === 'noWaste') {
            reportDetails = 'No waste or expired items to report for this period.';
        }
        
        // Create email data for SendGrid
        const emailData = {
            personalizations: [
                {
                    to: [
                        {
                            email: reportData.email,
                            name: reportData.personnel || 'User'
                        }
                    ],
                    dynamic_template_data: {
                        reportId: reportId || 'N/A',
                        submissionTime: submissionTime,
                        store: reportData.store || 'N/A',
                        personnel: reportData.personnel || 'N/A',
                        reportDate: formatDate(reportData.reportDate) || 'N/A',
                        disposalType: (reportData.disposalType || 'N/A').toUpperCase(),
                        itemCount: itemsDetails ? itemsDetails.length : 0,
                        totalBatches: reportData.totalBatches || 1,
                        reportDetails: reportDetails
                    }
                }
            ],
            from: {
                email: SENDGRID_CONFIG.SENDER_EMAIL,
                name: SENDGRID_CONFIG.SENDER_NAME
            },
            reply_to: {
                email: SENDGRID_CONFIG.SENDER_EMAIL,
                name: SENDGRID_CONFIG.SENDER_NAME
            },
            subject: `Waste Report Confirmation - ${reportId}`,
            content: [
                {
                    type: 'text/plain',
                    value: `
                    Waste Report Confirmation
                    -------------------------
                    Report ID: ${reportId}
                    Store: ${reportData.store || 'N/A'}
                    Personnel: ${reportData.personnel || 'N/A'}
                    Report Date: ${formatDate(reportData.reportDate) || 'N/A'}
                    Disposal Type: ${(reportData.disposalType || 'N/A').toUpperCase()}
                    Submitted On: ${submissionTime}
                    
                    Report Details:
                    ${reportDetails}
                    
                    This email serves as confirmation of your submission.
                    FG Operations Waste Management System
                    `
                },
                {
                    type: 'text/html',
                    value: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <title>Waste Report Confirmation</title>
                        <style>
                            body { 
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                                line-height: 1.6; 
                                color: #333; 
                                background-color: #f5f5f5;
                                margin: 0;
                                padding: 20px;
                            }
                            .container { 
                                max-width: 600px; 
                                margin: 0 auto; 
                                background: white;
                                border-radius: 10px;
                                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                                overflow: hidden;
                            }
                            .header { 
                                background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); 
                                color: white; 
                                padding: 30px 20px; 
                                text-align: center; 
                            }
                            .header h1 {
                                margin: 0;
                                font-size: 24px;
                                font-weight: 600;
                            }
                            .content { 
                                padding: 30px; 
                            }
                            .footer { 
                                margin-top: 30px; 
                                text-align: center; 
                                color: #666; 
                                font-size: 12px; 
                                padding: 20px;
                                background: #f9f9f9;
                                border-top: 1px solid #eee;
                            }
                            table { 
                                width: 100%; 
                                border-collapse: collapse; 
                                margin: 20px 0; 
                                font-size: 14px;
                            }
                            th, td { 
                                padding: 12px 15px; 
                                text-align: left; 
                                border: 1px solid #ddd; 
                            }
                            th { 
                                background-color: #f2f2f2; 
                                font-weight: 600;
                                width: 40%;
                            }
                            .highlight { 
                                background-color: #e8f5e9; 
                                padding: 15px; 
                                border-left: 4px solid #4CAF50; 
                                margin: 20px 0; 
                                border-radius: 4px;
                            }
                            .report-details {
                                background: #f9f9f9;
                                padding: 15px;
                                border-radius: 5px;
                                border: 1px solid #eee;
                                margin: 20px 0;
                                white-space: pre-wrap;
                                font-family: 'Courier New', monospace;
                                font-size: 13px;
                            }
                            .logo {
                                text-align: center;
                                margin-bottom: 20px;
                            }
                            .logo img {
                                max-width: 150px;
                                height: auto;
                            }
                            .thank-you {
                                background: #e3f2fd;
                                padding: 15px;
                                border-radius: 5px;
                                border-left: 4px solid #2196F3;
                                margin-top: 25px;
                            }
                            @media (max-width: 600px) {
                                .content { padding: 20px; }
                                th, td { padding: 10px; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>📋 Waste Report Submission Confirmation</h1>
                                <p style="margin-top: 10px; opacity: 0.9;">FG Operations Waste Management System</p>
                            </div>
                            <div class="content">
                                <div class="logo">
                                    <!-- Add your logo here if you want -->
                                </div>
                                
                                <p>Hello <strong>${reportData.personnel || 'User'}</strong>,</p>
                                <p>Your waste report has been successfully submitted. Here are the details:</p>
                                
                                <table>
                                    <tr>
                                        <th>Report ID:</th>
                                        <td><strong>${reportId || 'N/A'}</strong></td>
                                    </tr>
                                    <tr>
                                        <th>Store Location:</th>
                                        <td>${reportData.store || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <th>Submitted By:</th>
                                        <td>${reportData.personnel || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <th>Report Date:</th>
                                        <td>${formatDate(reportData.reportDate) || 'N/A'}</td>
                                    </tr>
                                    <tr>
                                        <th>Disposal Type:</th>
                                        <td><span style="background: #4CAF50; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px;">${(reportData.disposalType || 'N/A').toUpperCase()}</span></td>
                                    </tr>
                                    <tr>
                                        <th>Number of Items:</th>
                                        <td>${itemsDetails ? itemsDetails.length : 0}</td>
                                    </tr>
                                    <tr>
                                        <th>Submission Time:</th>
                                        <td>${submissionTime}</td>
                                    </tr>
                                </table>
                                
                                ${reportData.totalBatches && reportData.totalBatches > 1 ? `
                                <div class="highlight">
                                    <strong>📝 Note:</strong> This report was split into <strong>${reportData.totalBatches}</strong> parts due to large file attachments. All parts have been saved successfully.
                                </div>
                                ` : ''}
                                
                                <h3 style="color: #4CAF50; margin-top: 25px;">📄 Report Details:</h3>
                                <div class="report-details">${reportDetails}</div>
                                
                                <div class="thank-you">
                                    <p><strong>✅ Submission Confirmed</strong></p>
                                    <p>This email serves as official confirmation of your submission. Please keep this information for your records.</p>
                                </div>
                                
                                <p style="margin-top: 25px; color: #666;">
                                    If you have any questions or need to modify this report, please contact your supervisor or the waste management department.
                                </p>
                            </div>
                            <div class="footer">
                                <p><strong>FG Operations Waste Management</strong></p>
                                <p>This is an automated confirmation. Please do not reply to this email.</p>
                                <p>© ${new Date().getFullYear()} FG Operations. All rights reserved.</p>
                                <p style="font-size: 11px; color: #999; margin-top: 10px;">
                                    <em>Never submit sensitive information on demo forms.</em>
                                </p>
                            </div>
                        </div>
                    </body>
                    </html>
                    `
                }
            ]
        };
        
        console.log('Sending email via SendGrid...');
        
        // Send email via SendGrid API
        const response = await axios.post(
            'https://api.sendgrid.com/v3/mail/send',
            emailData,
            {
                headers: {
                    'Authorization': `Bearer ${SENDGRID_CONFIG.API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        
        console.log('✅ Email sent successfully via SendGrid:', response.status);
        return { success: true, response: response.data };
        
    } catch (error) {
        console.error('❌ SendGrid email sending failed:', error);
        
        let errorMessage = 'Email sending failed: ';
        if (error.response) {
            console.error('SendGrid response error:', error.response.status);
            console.error('SendGrid error details:', error.response.data);
            
            if (error.response.status === 401) {
                errorMessage += 'Invalid API key. Please check your SendGrid configuration.';
            } else if (error.response.status === 403) {
                errorMessage += 'Permission denied. Check API key permissions.';
            } else if (error.response.status === 429) {
                errorMessage += 'Rate limit exceeded. Please try again later.';
            } else {
                errorMessage += `Server error (${error.response.status}): ${JSON.stringify(error.response.data.errors || 'Unknown error')}`;
            }
        } else if (error.request) {
            console.error('No response received:', error.request);
            errorMessage += 'No response from email server. Check network connection.';
        } else {
            console.error('Request setup error:', error.message);
            errorMessage += error.message;
        }
        
        return { success: false, error: errorMessage };
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
// FORM SUBMISSION HANDLER - UPDATED FOR SENDGRID
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
        // SEND EMAIL CONFIRMATION VIA SENDGRID
        // ================================
        console.log('Attempting to send email confirmation via SendGrid...');
        
        const itemsDetails = allItems.map(item => ({
            type: disposalType.value,
            ...item
        }));
        
        const emailResult = await sendEmailConfirmation(baseReportData, mainReportId, itemsDetails);
        
        if (emailResult.success) {
            console.log('✅ SendGrid email confirmation sent successfully');
            
            try {
                const updatePromises = savedReportIds.map(reportId => {
                    const reportRef = db.collection('wasteReports').doc(reportId);
                    return reportRef.update({
                        emailSent: true,
                        emailSentAt: new Date().toISOString(),
                        emailStatus: 'sent',
                        sendGridMessageId: emailResult.response?.id || 'unknown'
                    });
                });
                
                await Promise.all(updatePromises);
                console.log('✅ Email status updated in database');
            } catch (updateError) {
                console.warn('Could not update email status in database:', updateError);
            }
            
            showNotification(
                `✅ Report submitted successfully! Confirmation email sent to ${baseReportData.email}. ${totalBatches > 1 ? `(${totalBatches} parts)` : ''}`, 
                'success'
            );
            
        } else {
            console.warn('⚠️ Report saved but SendGrid email failed:', emailResult.error);
            
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
                `⚠️ Report saved successfully! (Email failed: ${emailResult.error})`, 
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
    checkSendGridConfig();
    
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

function checkSendGridConfig() {
    console.log('SendGrid Configuration Check:');
    console.log('- API_KEY:', SENDGRID_CONFIG.API_KEY ? 'Set ✓' : 'NOT SET ✗');
    console.log('- SENDER_EMAIL:', SENDGRID_CONFIG.SENDER_EMAIL);
    console.log('- SENDER_NAME:', SENDGRID_CONFIG.SENDER_NAME);
    console.log('- TEMPLATE_ID:', SENDGRID_CONFIG.TEMPLATE_ID || 'Not using template');
    
    if (!SENDGRID_CONFIG.API_KEY) {
        console.warn('⚠️ WARNING: SendGrid API_KEY is not configured');
        showNotification('SendGrid not configured. Emails will not be sent.', 'warning');
    } else if (!SENDGRID_CONFIG.SENDER_EMAIL) {
        console.warn('⚠️ WARNING: Sender email not configured');
    }
}

// Debug functions
window.debugSubmit = handleSubmit;
window.debugFirebase = () => {
    console.log('Firebase status:', {
        initialized: !!firebase.apps.length,
        db: !!db,
        config: firebaseConfig
    });
    testFirebaseConnection();
};
window.debugSendGrid = checkSendGridConfig;

// Test SendGrid connection
window.testSendGridEmail = async () => {
    const testEmail = prompt('Enter email to test SendGrid:');
    if (!testEmail) return;
    
    showLoading(true);
    try {
        const testData = {
            email: testEmail,
            store: 'Test Store',
            personnel: 'Test User',
            reportDate: new Date().toISOString().split('T')[0],
            disposalType: 'noWaste'
        };
        
        const result = await sendEmailConfirmation(testData, 'TEST-' + Date.now(), []);
        
        if (result.success) {
            alert('✅ Test email sent successfully! Check your inbox.');
        } else {
            alert(`❌ Test email failed: ${result.error}`);
        }
    } catch (error) {
        alert(`❌ Error: ${error.message}`);
    } finally {
        showLoading(false);
    }
};