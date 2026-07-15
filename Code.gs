function createPasswordHash(password) {
  const rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  return rawHash.map(byte => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, '0')).join('');
}

function getCurrentUser() {
  try {
    const props = PropertiesService.getUserProperties();
    const token = props.getProperty('SESSION_TOKEN');
    if (!token) return null;
    const cached = CacheService.getUserCache().get(token);
    if (!cached) return null;
    return JSON.parse(cached);
  } catch (err) {
    return null;
  }
}

function isAuthenticated() {
  return getCurrentUser() !== null;
}

function doGet(e) {
  try {
    if (typeof createDefaultAdmin === 'function') {
      createDefaultAdmin();
    }
    
    const authenticated = isAuthenticated();
    const page = e && e.parameter && e.parameter.page ? e.parameter.page : 'Dashboard';

    if (!authenticated) {
      const template = HtmlService.createTemplateFromFile('Main');
      template.page = 'Login';
      template.isAuthenticated = false;
      template.currentUser = null;
      return template.evaluate()
        .setTitle('تسجيل الدخول - نظام قاعدة بيانات الموظفين')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }

    const currentUser = getCurrentUser();

    const template = HtmlService.createTemplateFromFile('Main');
    template.page = page;
    template.isAuthenticated = true;
    template.currentUser = currentUser;
    return template.evaluate()
      .setTitle('نظام قاعدة بيانات الموظفين')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  } catch (error) {
    return HtmlService.createHtmlOutput('<div style="direction:ltr; padding:20px; font-family:sans-serif;"><h3>System Error</h3><p style="color:red;"><b>Message:</b> ' + error.message + '</p><pre>' + error.stack + '</pre></div>');
  }
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    return '<!-- Error loading ' + filename + ': ' + error.message + ' -->';
  }
}

/* ==========================================================
   Phase 3: Backend Document, Timeline & HR Notes Operations
   ========================================================== */

function saveDocumentMeta(docData) {
  try {
    docData.documentId = Helpers.generateId('DOC');
    docData.uploadedAt = new Date().toISOString();
    Database.insertRow(SHEET_DOCUMENTS, docData);
    return Helpers.buildResponse(true, 'Document metadata saved', docData);
  } catch (err) {
    return Helpers.buildResponse(false, err.message);
  }
}

function getDocumentsByEmployeeId(employeeId) {
  try {
    const rows = Database.getAllRows(SHEET_DOCUMENTS);
    const results = rows.filter(r => r.employeeId === employeeId);
    return Helpers.buildResponse(true, 'Retrieved documents', results);
  } catch (err) {
    return Helpers.buildResponse(false, err.message);
  }
}

function updateDocumentStatus(documentId, newStatus, updatedBy) {
  try {
    const doc = Database.findRow(SHEET_DOCUMENTS, 'documentId', documentId);
    if (!doc) {
      return Helpers.buildResponse(false, 'Document not found');
    }

    const updateData = {
      status: newStatus,
      uploadedBy: updatedBy || doc.uploadedBy || 'Admin'
    };

    const success = Database.updateRow(SHEET_DOCUMENTS, 'documentId', documentId, updateData);
    return Helpers.buildResponse(success, success ? 'Document status updated successfully' : 'Failed to update document status');
  } catch (err) {
    return Helpers.buildResponse(false, err.message);
  }
}

function getEmployeeTimeline(employeeId) {
  try {
    const emp = Database.findRow(SHEET_EMPLOYEES, 'employeeId', employeeId);
    if (!emp) {
      return Helpers.buildResponse(false, 'Employee not found');
    }

    const timelineEvents = [];

    if (emp.hireDate) {
      timelineEvents.push({
        eventType: 'Hired',
        description: 'Joined the company as ' + (emp.jobTitle || 'Employee'),
        eventDate: emp.hireDate,
        createdAt: emp.createdAt || emp.hireDate
      });
    }

    const statusRows = Database.getAllRows('StatusHistory');
    statusRows.filter(r => r.employeeId === employeeId).forEach(r => {
      timelineEvents.push({
        eventType: 'Status Change',
        description: 'Status changed to ' + r.status + (r.reason ? ' (' + r.reason + ')' : ''),
        eventDate: r.effectiveDate,
        createdAt: r.createdAt
      });
    });

    const transferRows = Database.getAllRows('Transfers');
    transferRows.filter(r => r.employeeId === employeeId).forEach(r => {
      timelineEvents.push({
        eventType: 'Transfer',
        description: r.transferType + ' changed from ' + r.oldValue + ' to ' + r.newValue,
        eventDate: r.effectiveDate,
        createdAt: r.createdAt
      });
    });

    const promoRows = Database.getAllRows('Promotions');
    promoRows.filter(r => r.employeeId === employeeId).forEach(r => {
      timelineEvents.push({
        eventType: r.actionType || 'Promotion',
        description: 'Position changed to ' + r.newPosition,
        eventDate: r.effectiveDate,
        createdAt: r.createdAt
      });
    });

    timelineEvents.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));

    return Helpers.buildResponse(true, 'Timeline retrieved successfully', timelineEvents);
  } catch (error) {
    LoggerService.error('getEmployeeTimeline error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}

function saveHRNote(employeeId, category, text, visibility, user) {
  try {
    const emp = Database.findRow(SHEET_EMPLOYEES, 'employeeId', employeeId);
    if (!emp) {
      return Helpers.buildResponse(false, 'Employee not found');
    }

    const noteRecord = {
      id: Helpers.generateId('NOTE'),
      employeeId: employeeId,
      date: new Date().toISOString().split('T')[0],
      user: user || 'HR Admin',
      category: category || 'General',
      text: text || '',
      visibility: visibility || 'Confidential',
      history: '',
      createdAt: new Date().toISOString()
    };
    Database.insertRow('HRNotes', noteRecord);

    LoggerService.info('Saved HR note for employee ' + employeeId);
    return Helpers.buildResponse(true, 'HR note saved successfully', noteRecord);
  } catch (error) {
    LoggerService.error('saveHRNote error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}
// حساب حالة المستند أو العقد تلقائياً
function calculateExpiryStatus(expiryDateStr, warningDays = 30) {
  if (!expiryDateStr) return 'Valid';
  const expiryDate = new Date(expiryDateStr);
  const today = new Date();
  const diffTime = expiryDate - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return 'Expired';
  if (diffDays <= warningDays) return 'Expiring Soon';
  return 'Valid';
}

// دالة رفع المستندات إلى Google Drive وربطها بالموظف
function uploadEmployeeDocument(empCode, docType, fileData, fileName, mimeType, issueDate, expiryDate, notes) {
  try {
    const empFolder = getOrCreateEmployeeFolder(empCode);
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
    const file = empFolder.createFile(blob);
    const fileId = file.getId();
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName("Documents");
    if (!sheet) {
      sheet = ss.insertSheet("Documents");
      sheet.appendRow(["Document ID", "Employee ID", "Document Type", "Issue Date", "Expiry Date", "Status", "Drive File ID", "File Name", "Notes", "Created Date", "Last Updated"]);
    }
    
    const docId = "DOC_" + new Date().getTime();
    const status = calculateExpiryStatus(expiryDate);
    const now = new Date();
    
    sheet.appendRow([docId, empCode, docType, issueDate, expiryDate, status, fileId, fileName, notes, now, now]);
    logAuditAction(Session.getActiveUser().getEmail(), empCode, "Upload Document", "--", docType);
    
    return { success: true, message: "تم الرفع وتسجيل المستند بنجاح", documentId: docId };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}
// دالة لجلب مستندات الموظف لعرضها في الملف الشخصي
function getEmployeeDocuments(empCode) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Documents");
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const docs = [];
  
  // تخطي الصف الأول (العناوين)
  for (let i = 1; i < data.length; i++) {
    if (data[i][1] == empCode) { // Employee ID في العمود الثاني (index 1)
      const expiryDate = data[i][4];
      const status = calculateExpiryStatus(expiryDate);
      docs.push({
        documentId: data[i][0],
        employeeId: data[i][1],
        documentType: data[i][2],
        issueDate: data[i][3],
        expiryDate: expiryDate,
        status: status,
        driveFileId: data[i][6],
        fileName: data[i][7],
        notes: data[i][8]
      });
    }
  }
  return docs;
}

// دالة لجلب إحصائيات المستندات والعقود لعرضها في لوحة التحكم (Widgets)
function getSystemStatsForDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let totalDocs = 0;
  let expiredDocs = 0;
  let expiringSoonDocs = 0;
  
  const docSheet = ss.getSheetByName("Documents");
  if (docSheet) {
    const data = docSheet.getDataRange().getValues();
    totalDocs = data.length - 1;
    if (totalDocs < 0) totalDocs = 0;
    
    for (let i = 1; i < data.length; i++) {
      const status = calculateExpiryStatus(data[i][4]);
      if (status === 'Expired') expiredDocs++;
      if (status === 'Expiring Soon') expiringSoonDocs++;
    }
  }
  
  return {
    totalDocs: totalDocs,
    expiredDocs: expiredDocs,
    expiringSoonDocs: expiringSoonDocs
  };
}
// دالة لجلب الإشعارات الخاصة بالعقود والمستندات المنتهية والتي توشك على الانتهاء
function getSystemNotifications() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let notifications = [];
  
  // فحص المستندات
  const docSheet = ss.getSheetByName("Documents");
  if (docSheet) {
    const data = docSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      const status = calculateExpiryStatus(data[i][4]);
      if (status === 'Expired' || status === 'Expiring Soon') {
        notifications.push({
          employeeId: data[i][1],
          type: 'مستند: ' + data[i][2],
          expiryDate: data[i][4],
          status: status,
          fileName: data[i][7] || '-'
        });
      }
    }
  }
  
  return notifications;
}