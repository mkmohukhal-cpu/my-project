/**
 * Database management abstraction layer for Google Sheets.
 */
const Database = {
  /**
   * Retrieves active spreadsheet instance or creates/opens default.
   * @return {GoogleAppsScript.Spreadsheet.Spreadsheet}
   */
  getSpreadsheet: function() {
    let ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      // Fallback or script property reference if bound differently
      const files = DriveApp.getFilesByName('EmployeeDatabase_DB');
      if (files.hasNext()) {
        ss = SpreadsheetApp.open(files.next());
      } else {
        ss = SpreadsheetApp.create('EmployeeDatabase_DB');
      }
    }
    this.initializeSchema(ss);
    return ss;
  },

  /**
   * Gets specific sheet by name, creating if missing.
   * @param {string} sheetName 
   * @return {GoogleAppsScript.Spreadsheet.Sheet}
   */
  getSheet: function(sheetName) {
    const ss = this.getSpreadsheet();
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      sheet = ss.insertSheet(sheetName);
      this.ensureColumns(sheet, sheetName);
    }
    return sheet;
  },

  /**
   * Ensures all schema sheets and columns exist without overwriting.
   */
  initializeSchema: function(ss) {
    const schema = {
      'Employees': ['employeeId', 'firstName', 'lastName', 'email', 'phone', 'department', 'jobTitle', 'employmentType', 'status', 'hireDate', 'managerId', 'emergencyContactName', 'emergencyContactPhone', 'createdAt', 'updatedAt'],
      'Documents': ['documentId', 'employeeId', 'documentType', 'documentName', 'issueDate', 'expiryDate', 'driveFileId', 'uploadedBy', 'uploadedAt', 'status', 'notes'],
      'Users': ['userId', 'employeeId', 'email', 'passwordHash', 'role', 'status', 'lastLogin', 'createdAt'],
      'Settings': ['configKey', 'configValue', 'description', 'updatedAt'],
      'Logs': ['timestamp', 'level', 'message', 'user'],
      // --- Phase 3 Additions ---
      'StatusHistory': ['id', 'employeeId', 'status', 'effectiveDate', 'reason', 'approvedBy', 'createdAt'],
      'Transfers': ['id', 'employeeId', 'transferType', 'oldValue', 'newValue', 'effectiveDate', 'reason', 'approvedBy', 'createdAt'],
      'Promotions': ['id', 'employeeId', 'actionType', 'previousPosition', 'newPosition', 'previousSalary', 'newSalary', 'effectiveDate', 'approval', 'notes', 'createdAt'],
      'SalaryHistory': ['id', 'employeeId', 'basicSalary', 'allowances', 'variableSalary', 'grossSalary', 'netSalary', 'effectiveDate', 'endDate', 'reason', 'createdAt'],
      'Contracts': ['id', 'employeeId', 'contractType', 'startDate', 'endDate', 'duration', 'salary', 'position', 'fileId', 'createdAt'],
      'HRNotes': ['id', 'employeeId', 'date', 'user', 'category', 'text', 'visibility', 'history', 'createdAt'],
      'AuditLogs': ['id', 'user', 'action', 'employeeId', 'date', 'time', 'previousValue', 'newValue', 'createdAt']
    };

    for (let sheetName in schema) {
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(schema[sheetName]);
      } else {
        this.ensureColumns(sheet, sheetName);
      }
    }
  },

  ensureColumns: function(sheet, sheetName) {
    const schemas = {
      'Employees': ['employeeId', 'firstName', 'lastName', 'email', 'phone', 'department', 'jobTitle', 'employmentType', 'status', 'hireDate', 'managerId', 'emergencyContactName', 'emergencyContactPhone', 'createdAt', 'updatedAt'],
      'Documents': ['documentId', 'employeeId', 'documentType', 'documentName', 'issueDate', 'expiryDate', 'driveFileId', 'uploadedBy', 'uploadedAt', 'status', 'notes'],
      'Users': ['userId', 'employeeId', 'email', 'passwordHash', 'role', 'status', 'lastLogin', 'createdAt'],
      'Settings': ['configKey', 'configValue', 'description', 'updatedAt'],
      'Logs': ['timestamp', 'level', 'message', 'user'],
      // --- Phase 3 Additions ---
      'StatusHistory': ['id', 'employeeId', 'status', 'effectiveDate', 'reason', 'approvedBy', 'createdAt'],
      'Transfers': ['id', 'employeeId', 'transferType', 'oldValue', 'newValue', 'effectiveDate', 'reason', 'approvedBy', 'createdAt'],
      'Promotions': ['id', 'employeeId', 'actionType', 'previousPosition', 'newPosition', 'previousSalary', 'newSalary', 'effectiveDate', 'approval', 'notes', 'createdAt'],
      'SalaryHistory': ['id', 'employeeId', 'basicSalary', 'allowances', 'variableSalary', 'grossSalary', 'netSalary', 'effectiveDate', 'endDate', 'reason', 'createdAt'],
      'Contracts': ['id', 'employeeId', 'contractType', 'startDate', 'endDate', 'duration', 'salary', 'position', 'fileId', 'createdAt'],
      'HRNotes': ['id', 'employeeId', 'date', 'user', 'category', 'text', 'visibility', 'history', 'createdAt'],
      'AuditLogs': ['id', 'user', 'action', 'employeeId', 'date', 'time', 'previousValue', 'newValue', 'createdAt']
    };
    const expected = schemas[sheetName];
    if (!expected) return;
    
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(expected);
      return;
    }
    
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    expected.forEach(col => {
      if (!headers.includes(col)) {
        sheet.getRange(1, headers.length + 1).setValue(col);
        headers.push(col);
      }
    });
  },

  /**
   * Retrieves all rows as objects mapped to headers.
   * @param {string} sheetName 
   * @return {Array<Object>}
   */
  getAllRows: function(sheetName) {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];
    
    const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const headers = data[0];
    const rows = [];
    
    for (let i = 1; i < data.length; i++) {
      let obj = {};
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = data[i][j];
      }
      rows.push(obj);
    }
    return rows;
  },

  /**
   * Finds a row by matching key and value.
   * @param {string} sheetName 
   * @param {string} key 
   * @param {*} value 
   * @return {Object|null}
   */
  findRow: function(sheetName, key, value) {
    const rows = this.getAllRows(sheetName);
    return rows.find(r => r[key] === value) || null;
  },

  /**
   * Inserts a new row mapping object properties to sheet columns.
   * @param {string} sheetName 
   * @param {Object} dataObj 
   * @return {boolean}
   */
  insertRow: function(sheetName, dataObj) {
    const sheet = this.getSheet(sheetName);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(h => dataObj[h] !== undefined ? dataObj[h] : '');
    sheet.appendRow(newRow);
    return true;
  },

  /**
   * Updates an existing row identified by unique ID key and value.
   * @param {string} sheetName 
   * @param {string} idKey 
   * @param {*} idValue 
   * @param {Object} dataObj 
   * @return {boolean}
   */
  updateRow: function(sheetName, idKey, idValue, dataObj) {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;
    
    const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const headers = data[0];
    const idIndex = headers.indexOf(idKey);
    if (idIndex === -1) return false;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === idValue) {
        const rowNum = i + 1;
        const updatedRow = headers.map((h, idx) => dataObj[h] !== undefined ? dataObj[h] : data[i][idx]);
        sheet.getRange(rowNum, 1, 1, headers.length).setValues([updatedRow]);
        return true;
      }
    }
    return false;
  },

  /**
   * Deletes a row matching idKey and idValue.
   * @param {string} sheetName 
   * @param {string} idKey 
   * @param {*} idValue 
   * @return {boolean}
   */
  deleteRow: function(sheetName, idKey, idValue) {
    const sheet = this.getSheet(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return false;
    
    const data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
    const headers = data[0];
    const idIndex = headers.indexOf(idKey);
    if (idIndex === -1) return false;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][idIndex] === idValue) {
        sheet.deleteRow(i + 1);
        return true;
      }
    }
    return false;
  }
};
// إنشاء هيكل مجلدات الموظف في Google Drive تلقائياً
function getOrCreateEmployeeFolder(employeeCode) {
  const rootFolderName = "Employee Documents";
  let rootFolder;
  
  const folders = DriveApp.getFoldersByName(rootFolderName);
  if (folders.hasNext()) {
    rootFolder = folders.next();
  } else {
    rootFolder = DriveApp.createFolder(rootFolderName);
  }
  
  let empFolders = rootFolder.getFoldersByName(employeeCode);
  let empFolder;
  if (empFolders.hasNext()) {
    empFolder = empFolders.next();
  } else {
    empFolder = rootFolder.createFolder(employeeCode);
    empFolder.createFolder("Contracts");
    empFolder.createFolder("IDs");
    empFolder.createFolder("Certificates");
    empFolder.createFolder("Other");
  }
  
  return empFolder;
}

// ملحوظة: دالة logAuditAction الرسمية الوحيدة موجودة في Employee.gs
// (بترتيب باراميترات: user, action, employeeId, previousValue, newValue)
// وبتكتب في شيت "AuditLogs" المعرّف ضمن Database.initializeSchema.