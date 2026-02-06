// FIXED createConfirmationEmail function
// Replace the existing createConfirmationEmail function with this one

function createConfirmationEmail(data) {
  // CRITICAL FIX: Explicitly check if isResubmission is the boolean true value
  // Only treat as resubmission if explicitly set to true
  const isResubmission = data.isResubmission === true || data.isResubmission === 'true';
  
  // Use htmlDisposalTypes if provided, otherwise use disposalType
  let disposalTypesDisplay = data.htmlDisposalTypes || data.disposalType || 'N/A';
  
  // Generate report details HTML
  let reportDetailsHtml = '';
  if (data.htmlReportDetails) {
    reportDetailsHtml = data.htmlReportDetails;
  } else if (data.reportDetails) {
    // Convert plain text report details to HTML
    const lines = data.reportDetails.split('\n');
    reportDetailsHtml = '<ul style="margin: 0; padding-left: 20px;">';
    lines.forEach(line => {
      if (line.trim()) {
        reportDetailsHtml += `<li style="margin-bottom: 8px;">${line}</li>`;
      }
    });
    reportDetailsHtml += '</ul>';
  }
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Submission Confirmation</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            margin: 0;
            padding: 20px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid #e0e0e0;
        }
        
        .email-header {
            background: #4CAF50;
            color: white;
            padding: 30px 20px;
            text-align: center;
            border-bottom: 4px solid #388e3c;
        }
        
        .email-header.resubmission {
            background: #ff9800;
            border-bottom-color: #f57c00;
        }
        
        .email-title {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .email-subtitle {
            font-size: 14px;
            opacity: 0.9;
        }
        
        .email-content {
            padding: 30px;
        }
        
        .greeting {
            font-size: 16px;
            margin-bottom: 25px;
            color: #444;
        }
        
        .resubmission-banner {
            background: #fff8e1;
            border: 1px solid #ffd54f;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 20px;
        }
        
        .info-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            font-size: 14px;
        }
        
        .info-table th,
        .info-table td {
            padding: 12px 15px;
            text-align: left;
            border: 1px solid #e0e0e0;
        }
        
        .info-table th {
            background: #f5f5f5;
            font-weight: 600;
            color: #555;
            width: 35%;
        }
        
        .badge {
            background: #4CAF50;
            color: white;
            padding: 4px 12px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
        }
        
        .report-details {
            background: #f9f9f9;
            padding: 20px;
            border-radius: 6px;
            border: 1px solid #e0e0e0;
            margin: 20px 0;
            font-size: 14px;
        }
        
        .highlight-box {
            background: #e8f5e9;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #4CAF50;
        }
        
        .confirmation-box {
            background: #e3f2fd;
            padding: 20px;
            border-radius: 6px;
            margin: 20px 0;
            border-left: 4px solid #2196f3;
        }
        
        .email-footer {
            background: #f5f5f5;
            padding: 20px;
            text-align: center;
            color: #666;
            font-size: 13px;
            border-top: 1px solid #e0e0e0;
        }
        
        .company-name {
            color: #333;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .footer-text {
            margin: 5px 0;
        }
        
        @media (max-width: 600px) {
            body { padding: 10px; }
            .email-content { padding: 20px; }
            .info-table th, 
            .info-table td { padding: 10px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="email-header ${isResubmission ? 'resubmission' : ''}">
            ${isResubmission ? 
              '<h1 class="email-title">🔄 Resubmission Confirmed</h1><p class="email-subtitle">Item Resubmitted for Review</p>' 
              : 
              '<h1 class="email-title">✅ Submission Confirmed</h1><p class="email-subtitle">Waste Report Management System</p>'
            }
        </div>
        
        <div class="email-content">
            <p class="greeting">
                Hello <strong>${data.personnel || 'Team Member'}</strong>,<br>
                ${isResubmission ? 'Your rejected item has been successfully resubmitted for review.' : 'Your waste report has been successfully submitted.'}
            </p>
            
            <table class="info-table">
                <tr><th>Report ID:</th><td><strong>${data.reportId || 'N/A'}</strong></td></tr>
                <tr><th>Store:</th><td>${data.store || 'N/A'}</td></tr>
                <tr><th>Submitted By:</th><td>${data.personnel || 'N/A'}</td></tr>
                <tr><th>Report Date:</th><td>${data.reportDate || 'N/A'}</td></tr>
                <tr><th>Disposal Type:</th><td>${disposalTypesDisplay}</td></tr>
                <tr><th>Number of Items:</th><td>${data.itemCount || 0}</td></tr>
                <tr><th>Submitted On:</th><td>${data.submissionTime || new Date().toLocaleString()}</td></tr>
            </table>
            
            ${data.totalBatches > 1 ? `
            <div class="highlight-box">
                <strong>📝 Note:</strong> Report was split into <strong>${data.totalBatches}</strong> parts due to large file attachments.
            </div>
            ` : ''}
            
            ${data.hasAttachments ? `
            <div class="highlight-box">
                <strong>📎 Attachments:</strong> Documentation included with submission.
            </div>
            ` : ''}
            
            <div style="margin: 25px 0;">
                <h3 style="color: ${isResubmission ? '#ff9800' : '#4CAF50'}; margin-bottom: 15px; font-size: 18px;">📄 Submitted Items:</h3>
                <div class="report-details">
                    ${reportDetailsHtml || '<p>No item details provided.</p>'}
                </div>
            </div>
            
            <div class="confirmation-box">
                <p><strong>✅ ${isResubmission ? 'Resubmission Complete' : 'Submission Complete'}</strong></p>
                <p style="margin-top: 10px;">
                    ${isResubmission 
                      ? 'Your resubmitted item has been received and is now pending approval.' 
                      : 'Your report has been received and recorded in the system. Please keep this email for your records.'}
                </p>
            </div>
        </div>
        
        <div class="email-footer">
            <p class="company-name">FG Operations Waste Management</p>
            <p class="footer-text">Automated confirmation — do not reply.</p>
            <p class="footer-text">© ${new Date().getFullYear()} FG Operations</p>
        </div>
    </div>
</body>
</html>`;
}


function createConfirmationPlainText(data) {
  // CRITICAL FIX: Explicitly check if isResubmission is the boolean true value
  const isResubmission = data.isResubmission === true || data.isResubmission === 'true';
  
  return `
${isResubmission ? '🔄 RESUBMISSION CONFIRMED\nYour rejected item has been successfully resubmitted for review.\n' : '✅ WASTE REPORT CONFIRMATION\n============================='}

Report ID: ${data.reportId || 'N/A'}
Store: ${data.store || 'N/A'}
Submitted By: ${data.personnel || 'N/A'}
Report Date: ${data.reportDate || 'N/A'}
Disposal Type: ${data.disposalType || 'N/A'}
Number of Items: ${data.itemCount || 0}
Submitted On: ${data.submissionTime || new Date().toLocaleString()}

${data.reportDetails || 'No item details provided.'}

${data.totalBatches > 1 ? 'Note: Report split into ' + data.totalBatches + ' parts due to large files.\n' : ''}
${data.hasAttachments ? 'Note: Includes documentation attachments.\n' : ''}

${isResubmission ? '✅ Resubmission Complete\nYour resubmitted item has been received and is now pending approval.' : '✅ Submission Complete\nYour report has been received and recorded in the system.'}

FG Operations Waste Management System
=====================================
Automated confirmation — do not reply.
© ${new Date().getFullYear()} FG Operations
  `.trim();
}
