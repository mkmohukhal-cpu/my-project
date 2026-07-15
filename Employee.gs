/**
 * Employee backend data layer operations.
 */
function saveEmployee(employeeData) {
  try {
    employeeData.employeeId = Helpers.generateId('EMP');
    employeeData.createdAt = new Date().toISOString();
    employeeData.updatedAt = new Date().toISOString();
    Database.insertRow(SHEET_EMPLOYEES, employeeData);
    LoggerService.info('Saved employee: ' + employeeData.employeeId);
    return Helpers.buildResponse(true, 'Employee saved successfully', employeeData);
  } catch (error) {
    LoggerService.error('saveEmployee error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}

function getEmployee(employeeId) {
  try {
    const emp = Database.findRow(SHEET_EMPLOYEES, 'employeeId', employeeId);
    return Helpers.buildResponse(true, 'Retrieved employee', emp);
  } catch (error) {
    LoggerService.error('getEmployee error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}

function getAllEmployees() {
  try {
    const emps = Database.getAllRows(SHEET_EMPLOYEES);
    return Helpers.buildResponse(true, 'Retrieved all employees', emps);
  } catch (error) {
    LoggerService.error('getAllEmployees error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}

function updateEmployee(employeeId, employeeData) {
  try {
    employeeData.updatedAt = new Date().toISOString();
    const success = Database.updateRow(SHEET_EMPLOYEES, 'employeeId', employeeId, employeeData);
    return Helpers.buildResponse(success, success ? 'Employee updated' : 'Employee not found');
  } catch (error) {
    LoggerService.error('updateEmployee error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}

function deleteEmployee(employeeId) {
  try {
    const success = Database.deleteRow(SHEET_EMPLOYEES, 'employeeId', employeeId);
    return Helpers.buildResponse(success, success ? 'Employee deleted' : 'Employee not found');
  } catch (error) {
    LoggerService.error('deleteEmployee error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}

function searchEmployees(query, filters) {
  try {
    const rows = Database.getAllRows(SHEET_EMPLOYEES);
    const q = (query || '').toLowerCase();
    const results = rows.filter(r => {
      const matchQuery = !q || Object.values(r).some(val => String(val).toLowerCase().includes(q));
      return matchQuery;
    });
    return Helpers.buildResponse(true, 'Search completed', results);
  } catch (error) {
    LoggerService.error('searchEmployees error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}

/**
 * Phase 3: Employee Status Management
 * Updates employee status and adds a historical log record without overwriting.
 */
function updateEmployeeStatus(employeeId, newStatus, effectiveDate, reason, approvedBy) {
  try {
    const emp = Database.findRow(SHEET_EMPLOYEES, 'employeeId', employeeId);
    if (!emp) {
      return Helpers.buildResponse(false, 'Employee not found');
    }

    // تحديث الحالة الحالية في جدول الموظفين الأساسي
    const previousStatus = emp.status;
    Database.updateRow(SHEET_EMPLOYEES, 'employeeId', employeeId, { status: newStatus, updatedAt: new Date().toISOString() });

    // حفظ السجل التاريخي للحالة في جدول StatusHistory
    const statusRecord = {
      id: Helpers.generateId('STAT'),
      employeeId: employeeId,
      status: newStatus,
      effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
      reason: reason || '',
      approvedBy: approvedBy || 'Admin',
      createdAt: new Date().toISOString()
    };
    Database.insertRow('StatusHistory', statusRecord);

    LoggerService.info('Updated status for employee ' + employeeId + ' from ' + previousStatus + ' to ' + newStatus);
    return Helpers.buildResponse(true, 'Employee status updated successfully', statusRecord);
  } catch (error) {
    LoggerService.error('updateEmployeeStatus error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}
/**
 * Phase 3: Employee Transfer Module
 * Records employee transfer or manager change and stores history.
 */
function transferEmployee(employeeId, transferType, newValue, effectiveDate, reason, approvedBy) {
  try {
    const emp = Database.findRow(SHEET_EMPLOYEES, 'employeeId', employeeId);
    if (!emp) {
      return Helpers.buildResponse(false, 'Employee not found');
    }

    // تحديد الحقل المناسب للتحديث بناءً على نوع النقل
    let updateField = '';
    if (transferType === 'Branch') updateField = 'branch'; // تأكد من اسم العمود إذا كان موجوداً
    else if (transferType === 'Department') updateField = 'department';
    else if (transferType === 'Position') updateField = 'jobTitle';
    else if (transferType === 'Manager') updateField = 'managerId';

    const oldValue = updateField ? (emp[updateField] || '') : '';
    
    // تحديث بيانات الموظف الأساسية إذا كان الحقل معتمداً
    if (updateField) {
      let updateData = {};
      updateData[updateField] = newValue;
      updateData.updatedAt = new Date().toISOString();
      Database.updateRow(SHEET_EMPLOYEES, 'employeeId', employeeId, updateData);
    }

    // حفظ سجل التنقل التاريخي في شيت Transfers
    const transferRecord = {
      id: Helpers.generateId('TRF'),
      employeeId: employeeId,
      transferType: transferType,
      oldValue: oldValue,
      newValue: newValue,
      effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
      reason: reason || '',
      approvedBy: approvedBy || 'Admin',
      createdAt: new Date().toISOString()
    };
    Database.insertRow('Transfers', transferRecord);

    LoggerService.info('Transferred employee ' + employeeId + ' - Type: ' + transferType + ' to ' + newValue);
    return Helpers.buildResponse(true, 'Employee transferred successfully', transferRecord);
  } catch (error) {
    LoggerService.error('transferEmployee error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}
/**
 * Phase 3: Promotion Module
 * Records employee promotion, demotion, job grade or salary grade changes.
 */
function promoteEmployee(employeeId, actionType, newPosition, newSalary, effectiveDate, approval, notes) {
  try {
    const emp = Database.findRow(SHEET_EMPLOYEES, 'employeeId', employeeId);
    if (!emp) {
      return Helpers.buildResponse(false, 'Employee not found');
    }

    const previousPosition = emp.jobTitle || '';
    const previousSalary = emp.salary || ''; // أو الحقل المناسب للراتب في بيانات الموظف

    // تحديث بيانات الموظف الأساسية بالمنصب أو الراتب الجديد
    let updateData = {
      updatedAt: new Date().toISOString()
    };
    if (newPosition) updateData.jobTitle = newPosition;
    if (newSalary !== undefined && newSalary !== '') updateData.salary = newSalary;

    Database.updateRow(SHEET_EMPLOYEES, 'employeeId', employeeId, updateData);

    // حفظ سجل الترقية أو التغيير التاريخي في شيت Promotions
    const promotionRecord = {
      id: Helpers.generateId('PRM'),
      employeeId: employeeId,
      actionType: actionType || 'Promotion',
      previousPosition: previousPosition,
      newPosition: newPosition || previousPosition,
      previousSalary: previousSalary,
      newSalary: newSalary !== undefined ? newSalary : previousSalary,
      effectiveDate: effectiveDate || new Date().toISOString().split('T')[0],
      approval: approval || 'Admin',
      notes: notes || '',
      createdAt: new Date().toISOString()
    };
    Database.insertRow('Promotions', promotionRecord);

    LoggerService.info('Processed ' + (actionType || 'Promotion') + ' for employee ' + employeeId);
    return Helpers.buildResponse(true, 'Promotion record saved successfully', promotionRecord);
  } catch (error) {
    LoggerService.error('promoteEmployee error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}
/**
 * Phase 3: Contract Management Module
 * Manages employee contracts, renewal, extension, and expiration tracking.
 */
function saveContractRecord(employeeId, contractType, startDate, endDate, duration, position, fileId) {
  try {
    const emp = Database.findRow(SHEET_EMPLOYEES, 'employeeId', employeeId);
    if (!emp) {
      return Helpers.buildResponse(false, 'Employee not found');
    }

    const contractRecord = {
      id: Helpers.generateId('CNT'),
      employeeId: employeeId,
      contractType: contractType || 'New Contract',
      startDate: startDate || new Date().toISOString().split('T')[0],
      endDate: endDate || '',
      duration: duration || '',
      position: position || emp.jobTitle || '',
      fileId: fileId || '',
      createdAt: new Date().toISOString()
    };
    Database.insertRow('Contracts', contractRecord);

    LoggerService.info('Saved contract record for employee ' + employeeId);
    return Helpers.buildResponse(true, 'Contract record saved successfully', contractRecord);
  } catch (error) {
    LoggerService.error('saveContractRecord error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}
/**
 * Phase 3: Employee Timeline Module
 * Aggregates all employee events into a chronological timeline array.
 */
function getEmployeeTimeline(employeeId) {
  try {
    const emp = Database.findRow(SHEET_EMPLOYEES, 'employeeId', employeeId);
    if (!emp) {
      return Helpers.buildResponse(false, 'Employee not found');
    }

    const timelineEvents = [];

    // إضافة حدث التعيين
    if (emp.hireDate) {
      timelineEvents.push({
        eventType: 'Hired',
        description: 'Joined the company as ' + (emp.jobTitle || 'Employee'),
        eventDate: emp.hireDate,
        createdAt: emp.createdAt || emp.hireDate
      });
    }

    // جلب أحداث الحالات التاريخية
    const statusRows = Database.getAllRows('StatusHistory');
    statusRows.filter(r => r.employeeId === employeeId).forEach(r => {
      timelineEvents.push({
        eventType: 'Status Change',
        description: 'Status changed to ' + r.status + (r.reason ? ' (' + r.reason + ')' : ''),
        eventDate: r.effectiveDate,
        createdAt: r.createdAt
      });
    });

    // جلب أحداث التنقلات
    const transferRows = Database.getAllRows('Transfers');
    transferRows.filter(r => r.employeeId === employeeId).forEach(r => {
      timelineEvents.push({
        eventType: 'Transfer',
        description: r.transferType + ' changed from ' + r.oldValue + ' to ' + r.newValue,
        eventDate: r.effectiveDate,
        createdAt: r.createdAt
      });
    });

    // جلب الترقيات
    const promoRows = Database.getAllRows('Promotions');
    promoRows.filter(r => r.employeeId === employeeId).forEach(r => {
      timelineEvents.push({
        eventType: r.actionType || 'Promotion',
        description: 'Position changed to ' + r.newPosition,
        eventDate: r.effectiveDate,
        createdAt: r.createdAt
      });
    });

    // ترتيب الأحداث تصاعدياً حسب التاريخ
    timelineEvents.sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));

    return Helpers.buildResponse(true, 'Timeline retrieved successfully', timelineEvents);
  } catch (error) {
    LoggerService.error('getEmployeeTimeline error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}
/**
 * Phase 3: HR Notes Module
 * Manages secure, categorized HR notes with history and visibility controls.
 */
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
/**
 * Phase 3: Audit Logs Module
 * Records security and administrative actions for tracking changes.
 */
function logAuditAction(user, action, employeeId, previousValue, newValue) {
  try {
    const now = new Date();
    const auditRecord = {
      id: Helpers.generateId('AUD'),
      user: user || 'System Admin',
      action: action || 'Action',
      employeeId: employeeId || '',
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      previousValue: previousValue ? JSON.stringify(previousValue) : '',
      newValue: newValue ? JSON.stringify(newValue) : '',
      createdAt: now.toISOString()
    };
    Database.insertRow('AuditLogs', auditRecord);

    LoggerService.info('Audit log recorded for action: ' + action);
    return Helpers.buildResponse(true, 'Audit log saved successfully', auditRecord);
  } catch (error) {
    LoggerService.error('logAuditAction error: ' + error.message);
    return Helpers.buildResponse(false, error.message);
  }
}