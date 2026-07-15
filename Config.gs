const SHEET_EMPLOYEES = 'Employees';
const SHEET_DOCUMENTS = 'Documents';
const SHEET_USERS = 'Users';
const SHEET_SETTINGS = 'Settings';
const SHEET_LOGS = 'Logs';

const ROLE_ADMIN = 'ROLE_ADMIN';
const ROLE_HR = 'ROLE_HR';
const ROLE_VIEWER = 'ROLE_VIEWER';

const STATUS_ACTIVE = 'Active';
const STATUS_DISABLED = 'Disabled';

function getConfigValue(key, defaultValue) {
  try {
    const row = Database.findRow(SHEET_SETTINGS, 'configKey', key);
    return row && row.configValue ? row.configValue : defaultValue;
  } catch (err) {
    return defaultValue;
  }
}