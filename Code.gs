/**
 * =====================================================================
 * Code.gs — عمليات المستندات (Documents) وإحصائيات لوحة التحكم فقط.
 * كل ما يخص المصادقة والتوجيه (doGet, include, isAuthenticated...) موجود
 * حصريًا في Auth.gs. كل ما يخص الموظفين (Timeline, HR Notes...) موجود
 * حصريًا في Employee.gs. لا تكرر أي دالة من دول هنا.
 * =====================================================================
 */

/**
 * حفظ بيانات مستند (بدون رفع ملف) — تُستخدم من Documents.html للتحديثات اليدوية.
 */
function saveDocumentMeta(docData) {
  try {
    docData.documentId = Helpers.generateId('DOC');
    docData.uploadedAt = new Date().toISOString();
    if (!docData.status) docData.status = STATUS_ACTIVE;
    Database.insertRow(SHEET_DOCUMENTS, docData);
    return Helpers.buildResponse(true, 'Document metadata saved', docData);
  } catch (err) {
    return Helpers.buildResponse(false, err.message);
  }
}

/**
 * يجيب كل مستندات موظف معيّن، مع حساب حالة انتهاء الصلاحية ديناميكيًا
 * (expiryStatus) بدون التأثير على حقل status الخاص بسير العمل (Active/Archived/Replaced).
 */
function getDocumentsByEmployeeId(employeeId) {
  try {
    const rows = Database.getAllRows(SHEET_DOCUMENTS);
    const results = rows
      .filter(r => r.employeeId === employeeId)
      .map(r => Object.assign({}, r, { expiryStatus: calculateExpiryStatus(r.expiryDate) }));
    return Helpers.buildResponse(true, 'Retrieved documents', results);
  } catch (err) {
    return Helpers.buildResponse(false, err.message);
  }
}

/**
 * تحديث حالة سير عمل المستند (Active / Archived / Replaced).
 */
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

/**
 * يرفع ملف مستند فعلي على Google Drive (داخل مجلد الموظف) ويسجل بياناته
 * في شيت Documents عبر طبقة Database الموحّدة (بدل الكتابة المباشرة القديمة).
 */
function uploadEmployeeDocument(employeeId, docType, fileData, fileName, mimeType, issueDate, expiryDate, notes) {
  try {
    const emp = Database.findRow(SHEET_EMPLOYEES, 'employeeId', employeeId);
    if (!emp) {
      return Helpers.buildResponse(false, 'الموظف غير موجود');
    }

    const empFolder = getOrCreateEmployeeFolder(employeeId);
    const blob = Utilities.newBlob(Utilities.base64Decode(fileData), mimeType, fileName);
    const file = empFolder.createFile(blob);
    const fileId = file.getId();

    const docRecord = {
      documentId: Helpers.generateId('DOC'),
      employeeId: employeeId,
      documentType: docType,
      documentName: fileName,
      issueDate: issueDate || '',
      expiryDate: expiryDate || '',
      driveFileId: fileId,
      uploadedBy: Session.getActiveUser().getEmail() || 'Admin',
      uploadedAt: new Date().toISOString(),
      status: STATUS_ACTIVE,
      notes: notes || ''
    };
    Database.insertRow(SHEET_DOCUMENTS, docRecord);
    logAuditAction(docRecord.uploadedBy, 'Upload Document', employeeId, '--', docType);

    return Helpers.buildResponse(true, 'تم رفع المستند وتسجيله بنجاح', docRecord);
  } catch (error) {
    LoggerService.error('uploadEmployeeDocument error: ' + error.message);
    return Helpers.buildResponse(false, error.toString());
  }
}

/**
 * إحصائيات لوحة التحكم: عدد الموظفين، النشطين، المستندات، المنتهية والموشكة على الانتهاء.
 */
function getSystemStatsForDashboard() {
  try {
    const employees = Database.getAllRows(SHEET_EMPLOYEES);
    const documents = Database.getAllRows(SHEET_DOCUMENTS);

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(e => e.status === STATUS_ACTIVE).length;

    let expiredDocs = 0;
    let expiringSoonDocs = 0;
    documents.forEach(d => {
      const status = calculateExpiryStatus(d.expiryDate);
      if (status === 'Expired') expiredDocs++;
      if (status === 'Expiring Soon') expiringSoonDocs++;
    });

    return Helpers.buildResponse(true, 'Stats retrieved', {
      totalEmployees: totalEmployees,
      activeEmployees: activeEmployees,
      totalDocs: documents.length,
      expiredDocs: expiredDocs,
      expiringSoonDocs: expiringSoonDocs
    });
  } catch (error) {
    LoggerService.error('getSystemStatsForDashboard error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}
